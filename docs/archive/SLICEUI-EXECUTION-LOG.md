# SliceUI Execution Log — `ChangeBillComponent` dari `snx.xml`

> Dokumen ini adalah **rekaman wawancara step-by-step** eksekusi skill SliceUI, ditulis ulang secara
> detail untuk keperluan **perbaikan kerusakan (bug-fixing)** pada skill/CLI SliceUI.
>
> Input: `.sliceui/xml/snx.xml` (FIGML/Figma XML, 1047×769px, 1670 baris)
> Target: `ChangeBillComponent` (Angular 13, module-based, prefix `app`, SCSS)
> CLI: `sliceui` v0.15.0 · Skill: v0.15.0 (matched)
> Tanggal eksekusi: 2026-09-05

---

## 0. Ringkasan hasil

| Aspek | Hasil |
|---|---|
| Transcribe | `tier 0 (figml)`, fidelity **100% (307/307)**, `degraded: false` |
| Framework terdeteksi | Angular `~13.3.0`, module-based, prefix `app`, SCSS, `isUii: true` (pilar) |
| File dihasilkan | `.ts` (3137 B), `.html` (3423 B), `.scss` (7945 B); `.spec.ts` tidak disentuh |
| Registrasi module | **Tidak perlu edit** — `ChangeBillComponent` sudah terdaftar di `app.module.ts` dan di-route ke `/ubah-tagihan` |
| Build | `ng build --configuration development` → **PASS** (9.12 MB) |
| Render | Semua 20 string transkrip **FOUND**; semua token warna desain **tergambar** (histogram) |
| `sliceui verify` | **2 fail** (`mockRowCount`, `styleFidelity`) — keduanya **false positive** (dijelaskan di §3) |
| `sliceui referee` | **1 red** (`target-exists`) — karena komponen hasil generate sudah ada (dijelaskan di §3) |

---

## 1. Step-by-step eksekusi (kronologis)

### Step 0 — Cek environment & keberadaan input

```bash
sliceui --version        # → 0.15.0
ls .sliceui/xml/snx.xml  # ada, 130689 B, 1670 baris
```

Kemudian:

```bash
sliceui doctor
```

Output penting:
```
✅  Node 22.19.0 (engines >=20 ok)
✅  sips / swiftc (static tier ok)
❌  Gemini API key: NOT found  →  "transcription falls back to static tier"
❌  Gemini live call: skipped (no key)
❌ doctor: 2 problem(s) found — fix above before generating.
```

**Catatan §1.1 (membingungkan):** `doctor` melaporkan "2 problem" dan menyuruh "fix before generating",
padahal inputnya adalah **XML/FIGML** yang diparse **tanpa** kunci Gemini. Pesan ini tidak membedakan
"perlu kunci (path screenshot)" vs "tidak perlu (path XML)".

### Step 1 — Transcribe

```bash
sliceui transcribe .sliceui/xml/snx.xml
```

Output:
```
Fidelity: 100% (307/307 visual attributes preserved)
{ ok: true, tier: 0, source: "figml", degraded: false, fidelity: { score: 1, preserved: 307, total: 307 } }
out: .sliceui/transcript/snx.transcript.md   (10719 B, 172 baris)
```

Verifikasi stale-check: `.sliceui/transcript/snx.transcript.meta.json` → `image: snx.xml`, `degraded: false`.
✅ Transkrip segar, tidak degraded, nama input cocok.

### Step 2 — Baca project context & conventions

Dibaca berurutan:
1. `.sliceui/project-context.json` — keys: `framework`, `prefix`, `styleExt`, `componentDir`,
   `capabilities`, `designTokens`, `conventions`, `sampleComponents`, dll.
2. `.sliceui/uii-profile.md` — tabel `action → authKey → icon` untuk `uii-table`.
3. `.sliceui/conventions.json` + `.sliceui/conventions.md` — reusable classes + korpus `::ng-deep`.

Fakta kunci yang dipakai:

| Field | Nilai |
|---|---|
| framework | Angular `~13.3.0`, `moduleOrStandalone: module` |
| prefix | `app` (alternate `ugw`) |
| styleExt | `scss` |
| componentDir | `src/app` |
| isUii | `true` |
| capabilities.select | `ngx-select (local)` |
| capabilities.table | `pilar (uii-table)` |
| capabilities.pagination | `pilar (uii-pagination)` |
| conventions.componentAnatomy | `tableTag: uii-table`, `mockRowsFloor: 15`, `pagination: false` |

`sampleComponents` berisi 3 slice sebelumnya (yang jadi referensi idiom menulis):
`edit-bill-end-date`, `history-agreement`, `ubah-tagihan`. Tidak ada yang `golden: true`.

### Step 3b — Resolve styled leaves

```bash
sliceui resolve .sliceui/xml/snx.xml
```

Output ringkas:
```
10 styled leaves resolved
status leaves: 3
  #dcf5ef + #4fbbbb → fa-check-circle   ⚠ no label-custom-* matches "Sudah bayar" — use plain badge
  #dcf5ef + #4fbbbb → fa-check-circle   ⚠ no label-custom-* matches "Sudah bayar" — use plain badge
  #fef2f2 + #f44444 → fa-exclamation-circle  ⚠ no label-custom-* matches "Belum bayar" — use plain badge
```

**Bug §3.1:** di `.resolved.json`, ikon *mata* (`Icon_Font_Awesome_Free_Solid_E_eye`) dan ikon
*pensil* (`Icon_Font_Awesome_Free_Solid_P_pencil-alt`) **dua-duanya** di-resolve menjadi `fa-search`
(karena resolve hanya melihat `color: #03337b` + `name: "vector"`, dan mengabaikan nama ikon asli di XML).

### Step 3.5 — Referee gate (pre-generate)

```bash
sliceui referee --target change-bill
```

Output (run pertama):
```
✗ [codebase] FAIL  component target  [mode: static/simple]
   ALREADY EXISTS (static/simple, ~11 lines). STOP — ask the user: overwrite / merge / skip.
✓ [xml] PASS  transcript  100% (307/307); dropped=0
✓ [codebase] PASS  conventions.componentAnatomy.mockRowsFloor
✓ [codebase] PASS  conventions.ngDeepCorpus.cell-html
✓ [codebase] PASS  conventions.ngDeepCorpus  24 verified
1 red · 5 checks
```

Target memang sudah ada — tapi isinya **scaffold kosong** (`.ts` 11 baris cuma `ngOnInit(){}`,
`.html`/`.scss` 0 byte). Sesuai aturan skill, saya **tidak boleh overwrite diam-diam**, jadi saya
pakai `AskUserQuestion`. Jawaban user: **Overwrite**.

### Step 3 — Investigasi mendalam (sebelum generate)

Karena struktur field ambigu (select vs readonly), saya periksa **raw XML**:

- Semua 4 `Field_FNC` (`25129`, `25130`, `25177`, `25178`) → `type: "input"`, `variant: "text"`,
  **tidak ada glyph caret/chevron/dropdown** di seluruh XML.
- Kesimpulan: 4 field adalah **kotak read-only**, bukan `<ngx-select>`.
- `Checkbox_FNC` count = **0** → tidak ada kolom checkbox di tabel.

Saya juga baca definisi library pilar untuk keputusan tabel:
- `node_modules/pilar/lib/components/table/table.component.d.ts` — input `columns, rows, actionColumn,
  actionTitle, checkboxColumn, paginationOptions, searchOptions, limitOptions, selectedLimit, …`,
  output `editClicked, detailClicked, deleteClicked, …`.
- `node_modules/pilar/fesm2015/pilar.mjs` (PaginationComponent) — pagination hanya render bila
  `amountOfData > dataPerPage` (`*ngIf="amountOfData > dataPerPage"`).

Referensi idiom (baca 3 slice): `ubah-tagihan` (title `h1` + `hr` kuning + `uii-table`),
`edit-bill-end-date` (badge status `label-custom-warning`/`-cancel`, `fa-exclamation-circle`/`-times`),
`pilar-sample` (tabel **7 kolom identik**, `uii-table` tanpa `auth` per baris).

### Pass 1 — Inventory (semua node dipetakan)

| # | Node transkrip | Render |
|---|---|---|
| 1 | Container 1047px, bg putih, pad 20 | `.content` |
| 2 | Title "Ubah skema" 16px w700 `#555555` | `<h1 class="h1 change-title">` |
| 3 | Divider `#fbc02d` 1px | `<hr class="yellow-divider">` |
| 4 | Info card `#f3f6f9` r4, 5 label:value | `.student-info` + `.info-row` |
| 5–6 | "Skema lama" + "Total tagihan lama (Rp)" (kotak read-only) | `.scheme-row` + `.scheme-box` |
| 7 | Label "Detail tagihan yang sudah tergenerate" | `.section-label` |
| 8 | Tabel 8 kolom, **tanpa checkbox**, 3 baris | `<table class="bill-table">` (plain) |
| 9 | Status badge hijau/merah + FA icon | `.status-badge` (native-plain) |
| 10 | Action icon per baris (eye / pencil `#03337b`) | `.row-action` button |
| 11 | Banner `#fef0f0`, judul+subtitle `#f44444` | `.warning-banner` |
| 12–13 | "Pilih skema baru" (dropdown) + "Total tagihan baru (Rp)" `0` | `<ngx-select>` + `.scheme-box.total` |
| 14 | Footer divider `#b1bccc` | `.footer-divider` |
| 15 | Batal (outline biru) + Simpan (abu `#b1bccc`, disabled) | `.btn.btn-outline` + `.btn.btn-gray` |

### Pass 2 & 3 — Layout + Styling

Tiga file ditulis (setelah `Read` untuk izin overwrite):
- `.ts`: mock data `infoRows`, `skemaLama`, `totalTagihanLama`, `skemaBaruOptions`, `billRows`
  (dengan `status` + `actionIcon`), `onSelectSkemaBaru`, `onRowAction`, `onBatal`, `onSimpan`.
  Setiap sumber mock diberi `// TODO: wire to service`.
- `.html`: `*ngFor` (bukan `@for`), `ngx-select` dengan `[(ngModel)]`+`(select)`.
- `.scss`: warna hex persis transkrip + **korpus `::ng-deep` reusable disalin verbatim lengkap**.

### Step 4 — Build & verify (iterasi)

1. `npx ng build --configuration development` → **PASS** (pertama coba).
2. `sliceui verify src/app/change-bill change-bill` → **3 fail**:
   - `scssCoverage` — 2 korpus hilang (`dropdown-menu > li > a:hover` + `:focus`) → **saya perbaiki**
     dengan menambahkan blok `::ng-deep .dropdown-menu …` → jadi **PASS**.
   - `mockRowCount` — tetap fail (dijelaskan §3.3).
   - `styleFidelity` — tetap fail (dijelaskan §3.2).

### Step 5 — Verifikasi visual (render)

Urutan percobaan yang dilakukan:
1. `python3 -m http.server 8753` pada `dist/` → buka `/ubah-tagihan` → **404** (server statis tanpa
   SPA fallback; `index.html` pakai `base href`). Screenshot → **blank putih**.
2. Coba `--dump-dom` dengan `timeout 25 …` → **exit 127** (`timeout` tidak ada di macOS).
3. Chrome `--headless --dump-dom` dengan `--virtual-time-budget` → **hang** (background task harus
   `TaskStop`).
4. Akhirnya: `ng serve --port 4202` (SPA fallback bawaan) → `--dump-dom` berhasil:
   - **Semua 20 string transkrip FOUND** (judul, NIM, nama, fakultas, skema, tabel, banner, tombol).
   - Histogram warna (PIL) mengkonfirmasi semua token desain tergambar:
     `#f3f6f9`, `#f5f5f5`, `#fef0f0`, `#b1bccc`, `#dcf5ef`, `#03337b`, dst.

### Step 6 — Final gate

- `sliceui verify` → **2 fail** (`mockRowCount`, `styleFidelity`), 19 check lain hijau.
- `sliceui referee --target change-bill` → **1 red** `target-exists` (`mock data, ~76 lines`)
  — sekarang komponen yang baru digenerate terdeteksi sebagai "sudah ada".

---

## 2. Keputusan desain (dan alasan)

### D2.1 — Tabel pakai `<table>` HTML, BUKAN `uii-table`
Desain adalah **detail list per mahasiswa** — tidak ada search bar, tidak ada "Tampilkan N",
tidak ada footer pagination di XML, dan cuma muat ~3 baris pada kanvas 769px. `uii-table` akan
menambahkan toolbar/checkbox/pagination yang tidak ada di desain. `capabilities.pagination` juga
tidak aktif (tidak ada teks footer pagination di XML).

### D2.2 — 3 mock row, bukan 15 (floor)
Konsekuensi D2.1: floor 15 hanya masuk akal untuk library table yang dipaginasi. Membuat 12 baris
tambahan = memalsukan konten yang tidak ada di desain.

### D2.3 — Empat field skema = read-only box
Raw XML (`Field_FNC`, `variant: text`, tanpa caret) membuktikan bukan select. Hanya "Pilih skema
baru" yang interaktif → `ngx-select` (karena placeholder "Pilih…" + intent ganti skema).

### D2.4 — Status badge pakai `native-plain`
`resolve` menyatakan tidak ada `label-custom-*` yang cocok untuk "Sudah bayar" (hijau) — jadi badge
hijau/merah dibuat polos dengan FA icon sesuai resolve, teks tetap `#303030` sesuai transkrip.

---

## 3. Kerusakan / anomali yang ditemukan (UNTUK PERBAIKAN)

Ini bagian paling penting. Dikelompokkan berdasarkan asal komponen.

### 3.1 — BUG `resolve`: ikon mata & pensil keduanya jadi `fa-search`
- **Bukti:** `.sliceui/resolve/snx.resolved.json`
  - `I16574_25151_3_1942_4845_6841` (raw XML: `Icon_Font_Awesome_Free_Solid_E_eye`) → `fa-search`
  - `I16574_25173_3_1941_4845_6221` (raw XML: `Icon_Font_Awesome_Free_Solid_P_pencil-alt`) → `fa-search`
- **Akar masalah (dugaan):** resolve memetakan berdasarkan `evidence.color` (`#03337b`) +
  `name: "vector"` saja, dan **mengabaikan nama ikon asli** (`…_E_eye`, `…_P_pencil-alt`) yang ada
  di raw XML. Hasilnya semua ikon biru `#03337b` jatuh ke default `fa-search`.
- **Dampak:** icon mata (detail) dan pensil (edit) bisa salah jadi ikon search. Saya mengabaikan
  `fa-search` dan memakai `fa-eye`/`fa-pencil-alt` berdasarkan nama XML + konteks `<Aksi>`.

### 3.2 — FALSE POSITIVE `verify.styleFidelity` (atribusi teks ke class yang salah)
- **Bukti:** 6 drift yang dilaporkan semuanya soal teks *label* ("Total tagihan lama (Rp)",
  "Detail tagihan yang sudah tergenerate") yang dikaitkan ke `.scheme-box`.
- **Faktanya:** label memakai `.control-label`/`.section-label` (12px/600/#555 — **benar** sesuai
  desain); `.scheme-box` adalah *kotak nilai* (14px/400/#333 — **juga benar**). Keduanya benar.
- **Akar masalah (dari source `verify.mjs`):**
  `authoredRuleForText()` memakai regex datar `anyRe` dengan rentang 120 karakter, **tidak sadar
  nesting DOM**, sehingga teks label (yang berada *sebelum* `.scheme-box`) di-scan dari tag pembuka
  `.scheme-box` terdekat dan dikaitkan ke rule `.scheme-box`.
- **Dampak:** komponen yang sebenarnya 100% benar dihitung "63% match < 80%" → gagal gate.

### 3.3 — FALSE POSITIVE `verify.mockRowCount` (floor 15 untuk detail list)
- **Bukti:** `3 mock rows < required 15 (floor 15)`.
- **Akar masalah:** `checkMockRowCount` selalu memakai `anatomy.mockRowsFloor ?? 15`, tanpa
  membedakan `uii-table` (list terpaginasi) vs `<table>` HTML (detail list). Tidak ada percabangan
  "jika tabel bukan library table, pakai jumlah baris transkrip".
- **Dampak:** desain detail-list 3 baris (yang memang hanya muat 3 baris) selalu gagal.

### 3.4 — `verify.scssCoverage` mengharuskan `.dropdown-menu` sebagai 2 idiom terpisah
- `conventions.md` menuliskan blok `.dropdown-menu > li > a:hover` dan `:focus` **dua kali
  (duplikat)**, dan verify menghitung `hover` + `focus` sebagai 2 "reusable idiom" terpisah.
  Ini menuntut saya menyalin blok `dropdown-menu` walau select hanya 1 dari 4 field. (Minor:
  duplikat di `conventions.md` baris 174–187.)

### 3.5 — `referee --target` tidak bisa bedakan "baru digenerate" vs "kode user"
- Run pertama: `static/simple ~11 lines` (scaffold). Run final: `mock data ~76 lines` (hasil saya).
  `referee` tidak mengenali bahwa file tersebut **sudah** hasil SliceUI (header
  `// Generated by SliceUI` ada di `.ts`). Akibatnya setiap re-run akan selalu merah `target-exists`.

### 3.6 — `sliceui doctor` memberi sinyal menyesatkan untuk path XML
- Melaporkan "2 problem … fix before generating" hanya karena tidak ada Gemini key, padahal input
  XML/FIGML tidak butuh key. Pesan sebaiknya dibedakan per-tier input.

### 3.7 — Friction lingkungan (bukan bug skill, tapi relevan saat eksekusi)
- `timeout` (GNU coreutils) **tidak ada di macOS** → `command not found`, exit 127.
- Chrome headless `--dump-dom`/`--screenshot` dengan `--virtual-time-budget` bisa **hang** (harus
  di-`TaskStop`; exit 144). `--timeout=<ms>` (flag Chrome sendiri) lebih andal untuk DOM dump.
- Tool `Read` tidak bisa menampilkan PNG/JPEG screenshot ("[Unsupported Image]") — verifikasi visual
  akhirnya dilakukan lewat **DOM text probe + histogram warna PIL**, bukan mata.

### 3.8 — File `.scss` termodifikasi eksternal (linter/user)
- Setelah `Write`, blok `:host` bertambah `background-color: #ffffff` yang **bukan dari saya**
  (saya hanya menulis `:host { display: block; }`). Ada proses eksternal (linter/hook) yang
  menyentuh file. Perlu dicatat bila men-debug hasil akhir yang berbeda dari yang ditulis agent.

---

## 4. Saran perbaikan (dipetakan ke §3)

1. **`resolve` (§3.1):** pakai nama ikon asli dari raw XML (`Icon_Font_Awesome_Free_Solid_*`,
   `_E_eye`, `_P_pencil-alt`, `_T_trash`, dst.) sebagai sinyal utama; warna hanya fallback.
   Mapping: `E_eye`→`fa-eye`, `P_pencil-alt`→`fa-pencil-alt`, dst.
2. **`verify.styleFidelity` (§3.2):** buat matcher teks → class **DOM-aware** (teks dikaitkan ke
   elemen *pembungkus terdekat*, bukan regex datar lintas-boundary). Minimal: jangan scan teks yang
   berada *sebelum* elemen class target.
3. **`verify.mockRowCount` (§3.3):** jika tabel adalah `<table>` HTML polos (bukan
   `uii-table`/`ngx-datatable`/`mat-table`), **skip** floor-15; pakai jumlah baris transkrip.
4. **`conventions.md` (§3.4):** hapus duplikat blok `dropdown-menu`; jadikan `hover`+`focus` satu
   idiom (bukan 2 requirement terpisah).
5. **`referee --target` (§3.5):** deteksi header `// Generated by SliceUI` pada file target →
   perlakukan sebagai "aman overwrite" (bukan merah), atau minimal tidak blokir re-run.
6. **`doctor` (§3.6):** bedakan pesan per tier input (XML tidak butuh key).
7. **Portabilitas (§3.7):** jika ada script internal yang memakai `timeout`, ganti dengan pola
   POSIX/macOS-compatible (atau flag `--timeout` milik tool yang dipanggil).

---

## 5. Yang sudah berjalan BENAR (untuk dipertahankan)

- **Transcribe FIGML** cepat, `fidelity 100%`, `degraded:false`, meta cocok — tidak ada masalah.
- **Divisi otoritas** (transkrip/XML = penampilan; sample = cara menulis wiring) sangat membantu —
  saya tidak menyalin styling sample yang stale, hanya pola binding.
- **Invariant "raw XML menang"** terbukti berguna: dipakai untuk membuktikan field = read-only box
  (bukan select) dan tabel tanpa checkbox.
- **`referee`** berhasil mencegah overwrite diam-diam pada target yang sudah ada (scaffold) — sesuai
  aturan, saya diminta konfirmasi.
- **Build gate** jelas dan cepat; `verify` menangkap 1 bug nyata (`scssCoverage` korpus kurang) yang
  langsung saya perbaiki.

---

## 6. Harapan saya sebagai user (jujur & realistis)

> Ditulis sebagai pengguna yang baru saja memakai SliceUI untuk satu kasus nyata dan menemukan
> lubang-lubang di §3. Bukan daftar keinginan ambisius — ini prioritas yang saya yakini paling
> menentukan apakah tool ini *bisa dipercaya*.

### H1. Jangan diam-diam menghasilkan yang salah — lebih baik bilang "tidak tahu"
Bug `resolve` yang mengubah ikon *mata* dan *pensil* jadi `fa-search` (§3.1) berbahaya justru karena
hasilnya *terlihat* rapi dan "terverifikasi". Saya lebih rela menerima `fallback: native-plain`
atau "ikon tidak bisa dipastikan" daripada tool yang percaya diri menghasilkan ikon salah.
**Kejujuran > kepastian palsu.**

### H2. Gate verify harus bisa dipercaya, bukan "menangis serigala"
`styleFidelity` dan `mockRowCount` (§3.2, §3.3) memproduksi false positive. Kalau gate terus salah,
user akan belajar *mengabaikannya* — dan itu menghancurkan alasan gate itu ada. Gate yang salah lebih
berbahaya daripada tidak ada gate. Prioritas perbaikan nomor satu bukan fitur baru, melainkan
**memastikan "merah" selalu berarti "benar-benar salah".**

### H3. Bedakan "tidak berlaku" dari "melanggar"
Floor 15 row untuk detail-list 3 baris bukan pelanggaran — itu check yang *tidak relevan* dengan
desain. Tool perlu konsep tiga status yang jujur: **pass / fail / not-applicable**. Menyamakan
"tidak berlaku" dengan "gagal" memaksa user memilih antara mendistorsi desain atau menerima merah.
Saya memilih menerima merah, tapi itu pengalaman yang buruk.

### H4. Jangan menagih prasyarat yang tidak relevan
`doctor` bilang "fix before generating" karena tidak ada kunci Gemini (§3.6), padahal input saya XML
yang tidak butuh kunci. Saya ingin tool **membaca input dulu, baru** menentukan apa yang dibutuhkan.
Menagih yang tidak perlu mengikis kepercayaan pada keseluruhan diagnostik.

### H5. Bisa dijalankan ulang tanpa melawan dirinya sendiri
`referee` menandai *hasil generate-nya sendiri* sebagai merah `target-exists` tiap re-run (§3.5).
Sebuah tool yang idempoten adalah ekspektasi dasar. File ber-header `// Generated by SliceUI`
seharusnya dikenali sebagai "milik sendiri" dan aman di-overwrite.

### H6. Loop "apakah tampilannya benar?" harus benar-benar berfungsi
Secara praktis ini paling menyakitkan: `timeout` tidak ada di macOS, Chrome headless hang, dan saya
tidak bisa melihat screenshot (§3.7). Padahal verifikasi visual adalah janji utama skill. Saya
berharap ada **satu jalur render-verify yang pasti jalan lintas platform** — bukan tiga percobaan
trial-and-error.

### H7. Tetap jujur soal batas kemampuan
Ini yang sudah bagus dan harus *dipertahankan*: label `degraded`, label `mock data`, literal text
tanpa `| translate`, "string yang saya karang". Jangan sampai, demi terlihat lebih pintar, SliceUI
mulai berpura-pura menghasilkan kode produksi.

### Yang menurut saya realistis & sudah jadi nilai inti
Transkripsi FIGML → teks terstruktur itu **genuine kuat**: 100% fidelity, cepat, dan — paling
penting — membuat model yang tidak bisa melihat gambar pun tetap bisa slice akurat. Divisi otoritas
("transkrip = penampilan, sample = cara menulis") juga keputusan arsitektur yang tepat. Masalahnya
bukan di inti, tapi di **lapisan penjamin kualitas di sekelilingnya** (`resolve`, `verify`,
`referee`) yang saat ini justru tidak akurat.

**Kesimpulan:** harapan realistis saya bukan "buat SliceUI lebih hebat", tapi: **kecilkan klaim yang
belum bisa dipenuhi, dan pastikan sinyal merah layak dipercaya.** User akan memaafkan fitur yang
belum ada; ia tidak akan memaafkan kepastian yang salah.
