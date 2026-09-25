# Laporan Pengalaman #2 — SliceUI (1 design, ±36 menit)

> Disusun setelah menylicing **1 design** (`design1.xml` → `Design1Component`, "Tambah tarif manual")
> di project **sliceui-sandbox** (Angular 13 + pilar + `@uiigateway/core`).
> Durasi sesi: **±36 menit 10 detik** untuk SATU komponen. Laporan ini fokus pada **keluh kesah**
> — di mana waktu habis, dan apa yang membuat gate `verify` memakan waktu di luar proporsi.

---

## 1. Ringkasan

| Aspek | Penilaian |
|---|---|
| Transkripsi (FIGML → transcript) | **Sangat bagus** — 100% fidelity (548/548), teks & warna persis |
| Wiring library (ngx-select, uii-table) | **Bagus tapi mahal** — harus reverse-engineer dari `.d.ts` + bundle minified |
| Layouting (radius, border, gap) | **Cukup** — transcript kali ini cukup lengkap |
| Gate `verify` | **Kendala terbesar** — 1 false-positive (`styleFidelity`) menelan ±15–20 menit |
| Build | **Tersendat** — budget Angular production gagal, harus edit `angular.json` |

**Kesimpulan satu kalimat:** komponennya sendiri 20% pekerjaan; **80% waktu habis melawan
gate `verify` dan reverse-engineering pilar**, bukan menylicing.

---

## 2. Di mana 36 menit habis (perkiraan)

| Aktivitas | ± Waktu | Catatan |
|---|---|---|
| `detect` / `transcribe` / baca transcript + project-context | 3–4 mnt | Lancar, output berkualitas |
| Reverse-engineer wiring `uii-table` + `ngx-select` dari `node_modules` | 8–10 mnt | Grep `.d.ts` + fesm bundle minified berulang |
| Tulis `.ts`/`.html`/`.scss` | 4–5 mnt | Normal |
| `ng build` + perbaikan budget | 4–5 mnt | Budget gagal (pre-existing) |
| **Melawan false-positive `verify.styleFidelity`** | **15–20 mnt** | Baca source `verify.mjs`, reimplement tree-builder + regex fallback, probe berulang |

> Porsi terbesar bukan "menylicing", melainkan **membuktikan bahwa kegagalan gate adalah
> false-positive**, dan mencari cara markup yang lolos tanpa merusak desain.

---

## 3. Plus / yang berjalan baik

1. **Transkripsi FIGML akurat.** `design1.xml` → transcript 100% fidelity, teks "Tambah tarif
   manual", warna `#fdd835`, geometri per node — semua persis. Tidak ada tebakan soal "apa isinya".

2. **Deteksi project benar.** Angular 13, prefix `app`, `componentDir src/app`, capability
   `select → ngx-select-ex`, `table → pilar (uii-table)` terdeteksi otomatis.

3. **`referee --target` berguna dan jujur.** Melaporkan `target-exists` dengan benar (komponen
   `design1` ada sebagai placeholder "siap di-slice", bukan mock/real API) — sehingga tidak perlu
   tanya overwrite.

4. **Fakta wiring pilar yang saya temukan dari `.d.ts` ternyata akurat** setelah dicek ke bundle:
   - kolom `{ name, prop }`; `type:'input-number'` → render `<input>` di cell; `inputType:'number'`.
   - `prop:'number'` di-index otomatis (`getDataOfCurrentPage` menulis `element.number = startPage + i`).
   - `[searchOptions]/[limitOptions]/[paginationOptions]` = flag yang benar untuk search bar /
     "Tampilkan N data" / "Menampilkan 1-10 dari N data".
   - `ngx-select` default `optionValueField='id'`, `optionTextField='text'` (jadi array `{id, text}` cocok).
   - pagination cuma render bila `amountOfData > dataPerPage`.

5. **Beberapa cek `verify` memang menangkap hal nyata** — `noBareNgDeep` memaksa `:host ::ng-deep`
   (benar), `mockRowCount` memaksa 15 row, `ngxSelectBinding` memaksa `[(ngModel)]`+`(select)`.

---

## 4. Keluh kesah (inti laporan)

### 4.1 `verify.styleFidelity` — false-positive "ghost fact" (terbesar)

Cek ini membandingkan nilai SCSS hasil generate dengan transcript. Masalahnya: teks **internal
library** (yang tidak pernah ada di HTML saya) tetap dibandingkan lewat *fallback regex*.

Bukti konkret dari sesi ini — 5 drift yang dilaporkan:

```
text "data"  (.get-data-btn) color: actual #ffffff, design #555555
text "data"  (.get-data-btn) font-weight: actual 700, design 400
text "Tarif" (.h1)           color: actual #000000, design #303030
text "Tarif" (.h1)           font-size: actual 16, design 14
text "Tarif" (.h1)           font-weight: actual 500, design 600
```

**Apa yang sebenarnya terjadi:**

- `"Tarif"` adalah **header kolom tabel** (`columns[7].name = 'Tarif'` di `.ts`) — dirender oleh
  `uii-table`, TIDAK ada di HTML saya. Fallback regex `authoredRuleForText` (case-insensitive,
  jendela 120 karakter) mencocokkannya ke `<h1>Tambah **tarif** manual</h1>` → diatribusikan ke `.h1`.
- `"data"` adalah **label filter pagination** ("Tampilkan 10 **data**") — juga internal `uii-table`.
  Fallback mencocokkannya ke tombol "Get **data**" → `.get-data-btn`.

**Akibatnya gate menuntut nilai yang SALING KONTRADIKTIF pada satu class yang sama:**

- `.h1` harus sekaligus `16px/500/#000000` (judul asli) **dan** `14px/600/#303030` (header "Tarif").
- `.get-data-btn` harus `#ffffff/700` (teks tombol) **dan** `#555555/400` (label "data").

Ini **mustahil** dipenuhi — satu rule class tidak bisa punya dua nilai `color`. Saya sempat
"memperbaiki" nilai ke arah yang salah (menyetel `.h1` jadi `#303030`, tombol jadi `400`) sebelum
menyadari itu justru merusak desain asli.

Ini bug yang **sama persis** dengan §3.2 di `SLICEUI-EXPERIENCE-REPORT.md` ("authoredRuleForText
flat-regex attribution"), tapi belum tuntas: perbaikan DOM-aware (`buildElementTree`) hanya menangani
teks yang **ada** di HTML hasil generate; teks internal library (column name, label pagination)
tetap jatuh ke fallback regex yang sama.

**Akar masalah:** fallback seharusnya TIDAK PERNAH jalan untuk teks yang tidak ada di HTML generate.
Kalau `findDeepestByText` miss, dan teks itu hidup di dalam library (`uii-table`, `ngx-select`),
maka itu "bukan authored fact" → harus `skip`, bukan dicoba-cocokkan substring case-insensitive.

**Dampak waktu:** saya harus baca ±200 baris source `verify.mjs`, reimplement `buildElementTree` +
fallback regex di Node, dan jalankan 4–5 probe untuk membuktikan ghost fact. Error message gate
(`text "Tarif" (.h1) color...`) **menyesatkan** — menunjuk ke defect yang tidak ada, tanpa petunjuk
bahwa teksnya internal library.

### 4.2 `classVocabulary` memaksa kelas button yang *kurang* idiomatik

Check ini hard-fail pada **semua** token `\bbtn-*` yang tidak ada di `classVocabulary`. Di sandbox
ini `conventions.json` **tidak punya satu pun** class `btn-*` (hanya `ugw-icon-btn`). Padahal:

- `pilar` memuat bootstrap yang sudah mendefinisikan `.btn-primary` (putih di atas `#03337b`) dan
  `.btn-default` (`#1B3680` di atas putih) — persis idiom UII yang dimaksud.
- `SLICEUI-EXPERIENCE-REPORT.md` sendiri mencatat `primary → btn-primary`, `secondary → btn-secondary`.

Jadi class yang **paling benar** (`.btn.btn-primary`) justru dianggap "invented". Saya terpaksa
memakai nama lokal `get-data-btn`/`cancel-btn`/`generate-btn` — yang **kurang idiomatik** dan
menambah CSS buatan yang seharusnya tidak perlu.

**Saran:** whitelist kelas button framework yang dimuat (`.btn`, `.btn-primary`, `.btn-default`,
`.btn-secondary`, dll.) — atau setidaknya jangan hard-fail saat `classVocabulary` kosong dari
`btn-*` sama sekali.

### 4.3 Conventions kosong, tapi skill mengasumsikan corpus kaya

Skill (Pass 1 & 3) berasumsi ada `.h1`, `.well`, `.control-label`, `.label-custom-*`, corpus
`::ng-deep` yang bisa di-copy. Di sandbox ini:

- `conventions.md` → `::ng-deep corpus (none detected)`.
- `conventions.json.classVocabulary` hanya 33 class shell (`ugw-*`), tidak ada `.h1`/`.well`/`.btn`.

Jadi prinsip "copy-first, invent only where no prior art" → praktis **semua harus invent**.
Tidak fatal, tapi skill tidak menyesuaikan narasinya dengan proyek yang corpusnya tipis.

### 4.4 `ng build` gagal karena budget (pre-existing, tapi menyita waktu)

`npm run build` (default production) gagal di dua budget:

```
design1.component.scss     exceeded maximum budget 2kB (total 2.12kB) — warning
main-layout.component.scss 4.30kB > 4kB maximum error   — pre-existing (bukan hasil saya)
bundle initial 2.92MB > 1MB maximum error               — pilar + @uiigateway/core + ngx-*
```

Saya harus edit `angular.json` (naikkan `anyComponentStyle` & `initial` budget) agar build hijau.
Ini bukan salah SliceUI, tapi langkah "jalankan build" di skill tidak mengantisipasi budget yang
terlalu ketat untuk project UII.

### 4.5 Reverse-engineer pilar mahal (grep bundle minified)

Untuk memastikan wiring `uii-table`/`ngx-select` saya grep `node_modules/pilar/fesm2020/pilar.mjs`
(±10k baris) berulang kali. Output grep sering >30–40KB dan ter-persist ke file. Tidak ada
`pilar-reference.md` yang cukup untuk detail cell-type (`input-number` vs `input-text` vs `number`)
— harus dibongkar dari compiled template.

### 4.6 Inkonsistensi `verifyComponent` (CLI vs library API)

Saat saya panggil `verifyComponent({...})` langsung dari source skill (untuk probe), hasilnya
**meng-skip** `tableBindings`/`pilarBindings`/`rowAuth`/`filterRowButton`/`tableOptions` dengan
alasan `"pilar not present in this install"`. Padahal CLI `sliceui verify` **menjalankan** cek-cek
itu (dengan pilar catalog). Artinya: kalau ada agen yang memakai `verifyComponent` sebagai library
tanpa inject `pilar`, ia bisa dapat verdict hijau yang melewatkan cek wiring pilar. Perlu dirapikan
agar kedua path konsisten.

### 4.7 Ikon `Icon_primary` tidak terpetakan (sama seperti laporan #1)

Tombol "Get data" punya ikon `Icon_primary` (vector putih 11×11) yang `resolve` tidak petakan.
Saya menebak `fa-search`. Ini duplikat keluhan #1 butir 7 — belum diperbaiki.

---

## 5. Detail teknis false-positive `styleFidelity` (bukti)

Mekanisme persis (dari source `verify.mjs`, `authoredRuleForText`):

1. `collectStyleFacts` iterasi semua `textNodes(transcript)` — **termasuk** teks yang akan dirender
   library (header kolom, label "Tampilkan N data", dst.), karena transcript tidak menandai mana
   yang "milik tabel".
2. Untuk tiap teks, `authoredRuleForText(html, text, scss)`:
   - coba `tree.findDeepestByText(t)` (DOM-aware, exact match). Untuk "Tarif"/"data" → **miss**
     (tidak ada di HTML saya).
   - **fallback** ke regex flat `hRe`/`anyRe` (case-insensitive, `[\s\S]{0,120}`):
     - `"Tarif"` cocok `<h1 ...>Tambah tarif manual</h1>` karena substring "tarif".
     - `"data"` cocok `<button ...>Get data</button>` karena substring "data".
3. Fallback mengambil `class` dari atribut elemen → `.h1` / `.get-data-btn` → dianggap authored
   fact → dibandingkan nilainya → **drift** (karena teks aslinya beda elemen).

Bukti bahwa ini ghost (probe Node yang saya jalankan):

```
current:                 {"Tarif":"h1",            "data":"get-data-btn"}
classless h1 + btn:      {"Tarif":"no-class→skip", "data":"no-class→skip"}
```

Dengan kata lain, menghapus class dari elemen yang salah-diikat membuat drift hilang — padahal
nilai visual tidak berubah sama sekali.

---

## 6. Saran perbaikan (diprioritaskan)

1. **Perbaiki `authoredRuleForText` fallback.** Kalau `findDeepestByText` miss, jangan fallback ke
   substring case-insensitive. Teks yang tidak ada di HTML generate = internal library = **skip**.
   *(Ini menghilangkan ±15–20 menit per slice — dampak terbesar.)*
2. **Whitelist class button framework** (`.btn`, `.btn-primary`, `.btn-default`, …) di
   `checkClassVocabulary`, atau jangan hard-fail bila `classVocabulary` tidak memuat `btn-*`.
3. **Tandai di transcript teks mana yang milik tabel/library** (`columns[].name`, label pagination,
   filter bar), supaya cek fidelity tahu untuk melewatinya sejak awal.
4. **Samakan path CLI vs library** untuk `verifyComponent` — inject pilar catalog secara default
   agar cek `tableBindings`/`pilarBindings`/`rowAuth` tidak silent-skip.
5. **Antisipasi budget build** — skill bisa mencatat bahwa project UII (pilar) hampir pasti melebihi
   budget default Angular (`initial 1MB`, `anyComponentStyle 4KB`) dan menyarankan naikkan budget
   sebelum "jalankan build".
6. **Lengkapi resolve untuk `Icon_primary`/`Icon_white`** (duplikat keluhan #1 butir 7).
7. **Error message `verify` lebih deskriptif** — sertakan *mengapa* teks dikaitkan ke class
   (mis. "matched substring 'tarif' in <h1>"), atau tandai `(library-internal)`.

---

*Report dibuat 2026-09-08 oleh Claude Code (SliceUI skill), berdasarkan 1 design (`design1.xml`)
yang dislicing dalam satu sesi ±36 menit.*
