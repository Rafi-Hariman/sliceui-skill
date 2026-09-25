# SliceUI — Penjelasan Lengkap (briefing untuk diskusi lintas-agent)

> **Untuk siapa dokumen ini:** agent/AI lain yang diajak brainstorming soal *slicing*
> (mengubah desain UI → kode komponen). Isinya self-contained — tidak butuh akses ke repo.
> **Status fakta:** diverifikasi terhadap source `sliceui-skill` v0.15.0, 2026-09-19.
> **Bahasa:** Indonesia. Istilah teknis dipertahankan dalam Inggris apa adanya.

---

## 1. TL;DR

**SliceUI** adalah sebuah **agent skill + CLI** yang mengubah desain UI (Figma XML atau screenshot)
menjadi kode komponen yang **idiomatik untuk project tujuan** — mengikuti framework, versi,
naming, class, dan design token yang sudah dipakai tim — lalu **memverifikasi hasilnya dengan
gate deterministik** sebelum boleh dinyatakan selesai.

Tiga kalimat yang membedakannya dari "screenshot-to-code" biasa:

1. **Transkripsi adalah produknya.** Desain diubah dulu menjadi *transcript* teks terstruktur
   (layout, warna, teks, ikon, geometry), lalu kode di-generate dari transcript itu. Ini membuat
   model yang **tidak bisa melihat gambar** tetap bisa menghasilkan UI akurat.
2. **Codebase-nya ikut dipelajari.** `init` menambang project tujuan untuk membangun peta
   `capabilities` (library apa yang melayani tiap kategori UI) dan `conventions` (aturan tak
   tertulis tim: class yang dipakai ulang, korpora `::ng-deep`, anatomi halaman, naming).
3. **Ada gate, bukan harapan.** `referee` (sebelum generate) dan `verify` (sesudah generate)
   adalah gate deterministik yang bisa gagal. "Selesai" artinya `sliceui verify` exit 0 — bukan
   "model merasa sudah benar".

---

## 2. Masalah yang dipecahkan

Saat coding agent diminta "buatkan komponen dari desain ini", ada empat mode kegagalan yang
berulang:

| # | Mode kegagalan | Akar masalah |
|---|---|---|
| F1 | **Model menebak tampilan** | Model tidak bisa melihat gambar, atau melihatnya tapi tidak presisi (warna jadi "biru tua", padding jadi "sekitar 16px") |
| F2 | **Kode tidak idiomatik** | Model menghasilkan `<select>` dan `<table>` polos, padahal project punya `ngx-select-ex` dan `uii-table` dengan binding spesifik |
| F3 | **Konvensi tak tertulis hilang** | Effect hover dropdown, warna status label, radius tabel, dan state open library internal **tidak ada di markup** — ia hidup di blok `::ng-deep` yang cuma diketahui tim |
| F4 | **Tidak ada cara membuktikan hasilnya benar** | Output terlihat "masuk akal", build hijau, tapi warna/teks/struktur menyimpang dari desain — dan tidak ada yang memeriksa |

SliceUI menjawabnya berurutan: F1 → transcript eksak, F2 → `capabilities`, F3 → `conventions`,
F4 → `verify` + `referee`.

**Anti-konsensus yang sengaja diambil:** mayoritas tool di ruang ini mengejar "model yang lebih
bisa melihat". SliceUI justru berasumsi model **tidak perlu melihat sama sekali** — presisi
diperoleh dari parsing deterministik, bukan dari kapabilitas visual model. Konsekuensinya model
sekecil apa pun bisa dipakai, dan hasilnya jauh lebih bisa diaudit (setiap angka di kode punya
asal-usul di transcript).

---

## 3. Bentuknya: skill + CLI, bukan aplikasi

SliceUI **bukan** web app dan **bukan** service. Ia punya dua bagian yang bekerja berpasangan:

- **CLI (`sliceui`)** — mesin deterministik. Parsing XML, deteksi framework, penambangan konvensi,
  scoring, validasi. Semua logika berat ada di sini. Node ≥ 20, ESM polos, tanpa build step,
  **tanpa server, tanpa telemetry**.
- **Agent skill (`skill/SKILL.md`)** — kontrak kerja untuk coding agent (Claude Code, Cursor,
  GLM Code, dll). Berisi workflow, urutan perintah, aturan authoritas, output contract, dan
  daftar anti-pattern. Di-install ke direktori skill agent (`sliceui install`).

Pembagiannya disengaja: **CLI memutuskan fakta, agent memutuskan penulisan.** CLI tidak pernah
menulis komponen; agent tidak pernah menebak warna.

### Alur pemakaian

```bash
npm i -g sliceui-skill
sliceui install            # menulis skill ke ~/.claude/skills/sliceui/
```

Lalu di dalam project target, user cukup berkata ke agent-nya:

> slice this into my app: .sliceui/inputs/xml/design.xml

Skill aktif, CLI mengerjakan bagian berat, agent menulis file-nya.

---

## 4. Pipeline — lima tahap, semuanya file-based

```
                        ┌─ PRE-GENERATE GATE ─┐
init → transcribe → resolve → referee ─────────┴→ [ AGENT MENULIS KODE ] → verify ─→ selesai
 (WHAT+HOW)  (desain→teks)  (idiom)   (validasi ground truth)                      ↑
                                                                      POST-GENERATE BLOCKING GATE
```

Setiap tahap adalah perintah CLI independen, dan **kontrak antar-tahap adalah file** di dalam
`.sliceui/` milik project target. Tidak ada state di memori, tidak ada daemon — tiap tahap bisa
diinspeksi, di-diff, dan diulang.

| Tahap | Perintah | Input | Output (artifact) | Arti |
|---|---|---|---|---|
| 1 | `sliceui init` | project target | `.sliceui/` + `project-context.json` + `conventions.json/.md` + `.sliceui/context/*.md` | Project ini **apa** dan tim ini menulis **bagaimana** |
| 2 | `sliceui transcribe <file>` | `.xml`/`.figml` atau gambar | `artifacts/<name>/transcript.{md,json,meta.json}` | Desain → teks eksak |
| 2b | `sliceui resolve <file>` | FIGML XML / transcript JSON | `artifacts/<name>/resolved.json` | Setiap elemen ber-style → kandidat idiom **eksak** |
| 2c | `sliceui spec <file>` | FIGML XML | `artifacts/<name>/spec.md` | Satu dokumen render (inventory + idiom + `::ng-deep` yang harus disalin) |
| 3 | `sliceui referee` | artifact ground truth | verdict per klaim (hijau/merah) | **Gate pra-generate** |
| 4 | *(agent menulis file)* | transcript + context + conventions | `.ts` / `.html` / `.scss` | — |
| 5 | `sliceui verify <dir> <name>` | komponen hasil | verdict per check | **Gate pasca-generate, blocking** |

Perintah pendukung: `detect` (deteksi saja), `fidelity` (skor % preservasi atribut visual),
`doctor` (diagnosa environment), `install/uninstall/update`.

**Exit code** adalah kontraknya: `0` sukses · `1` gate gagal · `2` usage / framework tidak didukung.

---

## 5. Tiga hal yang dipelajari dari codebase (`init`/`detect`)

Ini bagian yang paling membedakan SliceUI. `init` menghasilkan **tiga jenis pengetahuan** yang
berbeda sifatnya:

### 5.1 `project-context.json` — *APA* project ini

Peta `capabilities`: untuk setiap kategori UI, library mana yang melayaninya, plus cuplikan
pemakaian nyata.

```json
"capabilities": {
  "select": { "library": "<yang terdeteksi>", "sampleHtml": "…", "source": "local" },
  "table":  { "library": "<yang terdeteksi>", "sampleHtml": "…", "source": "installed" }
}
```

Kategori yang dicakup: `select, table, modal, toast, editor, date, slider, switch, pagination,
divider, well, checkbox, layout`.

Presedensi resolusi: **pemakaian lokal di source** (`local`) → **paket terinstal** (`installed`)
→ **`null`** (HTML polos + catatan eksplisit). `null` itu **non-silent** — agent wajib memberi
tahu user, bukan menebak library.

Selain itu ada `provenance` (tiap klaim ditandai `sourceCode | configFile | registryDefault`;
source code adalah ground truth), `designTokens` (var SCSS, CSS custom prop, mixin — nilai
literal), `sampleComponents`, `componentDir`, dan `moduleStructure`.

### 5.2 `conventions.json` + `conventions.md` — *BAGAIMANA* tim ini menulis

Aturan tak tertulis yang tidak bisa ditangkap oleh peta "APA":

- `classVocabulary` — class yang project pakai ulang (`.well`, `.control-label`,
  `.label-custom-success`, …). Agent **harus** memakai ini, bukan mengarang class baru.
- **Korpora override** — setiap blok *style penetration*/deep selector di seluruh project,
  digabung dan diplok per keluarga capability. Ini menyimpan effect yang **tidak ada di markup**
  dan tidak terlihat di XML: state hover pemilih, dropdown open-state, radius pagination, warna
  status label, dsb. Agent menyalinnya **verbatim**; satu selector yang lupa disalin = satu
  effect desain yang hilang.
- `componentAnatomy` — idiom struktur halaman (kerangka tabel, pagination, batas baris mock).
- `naming` — prefix selector dan pola event handler.

### 5.3 Fingerprint org (kondisional, untuk project tertentu)

Kalau project ter-fingerprint sebagai milik organisasi tertentu yang punya UI library privat,
`init` juga menulis katalog library privat itu: reference API lengkap tiap komponen, showcase
contoh nyata, dan tabel action→authKey→icon. **Kalau tidak ada, SliceUI tidak pernah menyebut
komponen privat itu sama sekali** — ia turun anggun ke konvensi yang dideteksi project saja.
Paket publiknya sendiri **nol file source privat** (dijaga oleh *publish guard*).

---

## 6. Invariant inti — aturan authoritas (jantung desainnya)

Ini bagian konseptual paling penting, dan yang paling layak didiskusikan.

> **Transkrip/XML memiliki SELURUH tampilan yang terlihat.** Teks persis, warna, radius, padding,
> gap, wrapper, level heading, layout kolom. Reproduksi apa adanya; kalau XML tidak menunjukkannya,
> **jangan diciptakan**.

> **Sample komponen hanyalah sample PENULISAN.** Fungsinya cuma mengajarkan *cara mengeja*
> framework dan *cara menyambung* library (nama binding, tipe prop, registrasi module) —
> **bukan** untuk menyalin wrapper, gaya form, atau struktur UI-nya. Sample boleh basi
> tampilannya; yang penting cara wiring-nya.

> **Satu-satunya hal styling yang boleh disalin dari codebase adalah korpora `::ng-deep` yang
> reusable** — karena ia menyasar DOM internal library yang tidak bisa dilihat XML (hover,
> open-state, border, pagination).

> **Struktur = XML saja.** Konvensi (`.well`, `.control-label`, skeleton) adalah **styling**
> untuk elemen yang **sudah ada** di desain — ia **tidak pernah menambah wrapper struktural**.
> Kalau XML tidak punya wrapper kontainer, agent tidak boleh memunculkannya. `verify` punya
> check khusus yang menandai wrapper "hantu" seperti ini.

Pembagian ini — **desain untuk tampilan, codebase untuk wiring, keduanya wajib** — adalah
kompromi yang membedakan SliceUI dari dua ekstrem yang gagal: "generate dari desain saja"
(hasilnya generik dan tidak idiomatik) dan "tiru komponen tetangga saja" (hasilnya tidak sesuai
desain dan menyebarkan drift).

### Yang dihasilkan

- **Literal text, tanpa i18n.** Teks dari desain dipakai apa adanya; **tidak** menambah key
  kamus, **tidak** membungkus `| translate` — walau template codebase sendiri penuh `| translate`.
  Ini penyimpangan yang sengaja: slicing menghasilkan kode mock/placeholder, bukan kode produksi
  yang sudah i18n.
- **Mock data saja.** Setiap opsi dropdown, baris tabel, dan item list adalah data karangan yang
  ditandai `// TODO: wire to <service>`. SliceUI tidak pernah menebak endpoint atau service call.
- **Selalu file nyata**, bukan dump satu `index.html` — kecuali framework-nya memang HTML-only.
- Tiap file diawali `// Generated by SliceUI`.

---

## 7. Gate deterministik — apa yang sebenarnya diperiksa

### 7.1 `referee` — gate **pra**-generate

Memvalidasi setiap artifact ground truth terhadap **dua sumber kebenaran**: desain (fidelity)
dan codebase (apakah tiap klaim konvensi benar-benar punya kejadian nyata di source — bukan
klaim karangan atau basi). Output-nya daftar merah `✗` (gagal) / `△` (basi).

Dengan `--target <nama>`, ia juga menjalankan check **target-exists**: kalau komponen dengan nama
itu **sudah ada** di project, itu dilaporkan merah beserta mode-nya (mock data / real API) dan
jumlah barisnya. Reaksinya bukan overwrite diam-diam, melainkan **bertanya ke user**: `overwrite`,
`merge` (ambil `.html`/`.scss` dari desain, pertahankan `.ts` yang sudah ada), atau `skip`.

### 7.2 `verify` — gate **pasca**-generate, blocking

Menjalankan pemeriksaan deterministik terhadap komponen yang baru ditulis. Contoh check yang ada:

- **Cakupan stylesheet & teks** — semua teks dari transcript ada di output? style-nya ada?
- **Binding tabel** — `[checkboxColumn]` hanya boleh muncul kalau desain **membuktikan** kolom
  checkbox; jumlah baris mock benar; tiap baris membawa objek `auth` kalau ada kolom aksi; opsi
  pencarian/pagination/limit di map ke prop yang tepat — **dan sebuah search bar di area filter
  tidak boleh membuat tabel merender search box kedua**.
- **Kosakata class** — output tidak boleh mengarang class yang tidak ada di `classVocabulary`.
- **Binding mati** — `<select>` wajib membawa model binding + handler; filter yang tidak
  tersambung ditolak.
- **Tombol yang hilang** — tombol `Cari` di XML tidak boleh hilang dari baris filter.
- **Urutan tombol** — `flex-direction: row-reverse` (yang membalik urutan kiri→kanan XML) ditolak.
- **Wrapper struktural hantu** — wrapper yang tidak ada di desain.
- **Warna ikon / mapping idiom** — ikon yang salah untuk warna tertentu bikin gagal.
- **Heading tanpa `font-size` eksplisit** — default browser itu ±2× ukuran desain, jadi ini gagal.

Dua aturan penting soal gate ini:

1. **Run tanpa ground truth tidak pernah hijau.** Gate tidak bisa "lulus karena tidak ada data".
2. **Ada batas retry.** Verify boleh diulang maksimal **3 kali**; kalau masih gagal, agent harus
   menyerahkan diff + perintah persisnya ke user — **tidak boleh loop selamanya**.
   Juga dibedakan: (a) `✗ fail` = output salah, perbaiki; (b) perintah tidak bisa dijalankan sama
   sekali (environment/harness) = **bukan** kesalahan kode, jangan loop — langsung hand-off.

### 7.3 Render probe — menutup celah "hijau ≠ benar"

Check teks statis tidak bisa melihat **cascade CSS**. Karena itu CI menjalankan *headless render
probe*: check cascade CSS, dan **mount Angular sungguhan**. Jadi verdict gate diperiksa terhadap
bagaimana output **benar-benar ter-render**, bukan cuma terhadap isi file.

---

## 8. Dukungan framework — jujur per lapisan

SliceUI **Angular-first**, dan kejujurannya eksplisit per lapisan (bukan satu kolom "supported"):

| Framework | Deteksi | Aturan codegen | Deep adaptation (wiring library, tambang konvensi, verify) |
|---|---|---|---|
| **Angular (v13-first)** | ✅ versi, prefix, module | ✅ version-aware (`*ngIf` vs `@if`, DI, standalone) | ✅ penuh — satu-satunya yang output-nya dijaga `sliceui verify` |
| React (TSX) | ✅ | ✅ `className`, Tailwind, FC | ⚠️ eksperimental — `verify` tidak membaca `.tsx` (exit 2) |
| Next.js | ✅ | ✅ App Router, server/client | ⚠️ eksperimental |
| Vue 3 (SFC) | ✅ | ✅ `<script setup lang="ts">`, scoped | ⚠️ eksperimental |
| Svelte | ✅ | ✅ Svelte 5 runes | ⚠️ eksperimental |
| Tailwind / HTML | ✅ (fallback) | ✅ utility/semantic HTML | ⚠️ eksperimental — tanpa korpora konvensi, tanpa gate |

Cara membacanya: **lapisan transkripsi itu framework-agnostic** (transcript hanya membawa fakta
desain: teks, warna, geometry, ikon), jadi ia sama bergunanya di framework apa pun. Lapisan
**aturan codegen** pun benar-benar multi-framework. Yang masih Angular-only adalah **deep
adaptation** — penambangan konvensi, golden reference, dan `verify`.

Output non-Angular harus diberi catatan eksperimental eksplisit; **tidak pernah** menebak library.

Detail penting Angular 13 (module-based, versinya penting): file dipecah
`.component.ts` + `.html` + `.scss`; template **hanya** `*ngIf`/`*ngFor` (bukan `@if`/`@for`
v17+); **bukan** `inject()` (v14+); **bukan** standalone; DI lewat constructor; wajib terdaftar
di `declarations` NgModule-nya.

---

## 9. Tiga tier input — degradasi bertingkat, bukan tebak-tebakan

Prinsipnya **deterministik-first**: setiap lapisan turun tier, tidak pernah menebak.

| Tier | Input | Cara | Kebutuhan | Catatan |
|---|---|---|---|---|
| **0** | `.xml` / `.figml` (ekspor Figma lewat plugin FIGML) | Parse deterministik | Tidak ada key, tidak ada network, instan | **Disarankan.** Fidelity atribut ~90%+ |
| **1** | Gambar/screenshot | Vision model (Gemini) | API key milik user | Gambar **dikirim ke Google** |
| **2** | Gambar/screenshot | Static: decode `sips` + OCR macOS Vision (Swift) | macOS | 100% lokal, kualitas lebih rendah |

### Apa yang dikirim ke mana

- **XML: 100% lokal.** Tidak ada network, tidak ada key.
- **Screenshot tier 1:** gambar dikirim ke Google Gemini dengan key user. Ini **satu-satunya
  egress**.
- **Screenshot tier 2:** semuanya lokal.
- **Tidak ada telemetry.** Key tidak pernah di-commit atau di-log.

`sliceui doctor` mendiagnosa seluruh rantai ini; key Gemini yang tidak ada diperlakukan sebagai
**warning**, bukan blocker — karena tier XML dan static tetap jalan tanpanya.

---

## 10. Peta repo (kalau agent lain perlu menelusuri)

```
src/cli.mjs              # entry point, 13 verb CLI
src/commands/            # satu file per perintah (init, detect, transcribe, resolve, spec,
                         #   verify, referee, doctor, fidelity, install, uninstall, update, …)
src/lib/                 # mesin bersama: schema transcript, parser FIGML, fidelity, referee,
                         #   resolve, registry library, OCR, style token, TS AST, prompt rules
src/framework/angular/   # lapisan dalam Angular: conventions, detect, rules, verify,
                         #   render-probe, render-mount, profil org/privat
src/ocr/                 # tier OCR static (macOS)
scripts/                 # extractor katalog privat + publish guard
skill/SKILL.md           # kontrak skill yang menghadap agent
test/                    # 33 file test, runner bawaan `node --test`
docs/project-docs/       # set dokumentasi SDD (prd, architecture, status, api-contract, dll)
```

- Artifact di dalam project target hidup di `.sliceui/` (di-gitignore oleh `init`).
- Runtime deps: `fast-glob`, `fast-xml-parser`, `typescript`. Dev: `esbuild`, `playwright`, `sass`.
- `TRANSCRIPT_VERSION = 3` — format transcript itu **berversi**; perubahan schema = breaking change
  artifact.
- CI: GitHub Actions, **ubuntu-only**, Node 20. Perilaku macOS diuji manual (gap yang diakui).

---

## 11. Glosarium (biar tidak salah istilah saat diskusi)

| Istilah | Arti |
|---|---|
| **Transcript** | Representasi teks terstruktur dari sebuah desain: pohon layout + teks + warna + geometry + ikon + checkbox. Produk inti SliceUI. |
| **FIGML** | Format XML ekspor dari Figma (lewat plugin). Input tier-0, deterministik. |
| **Slice / slicing** | Aktivitas mengubah satu desain menjadi file komponen di project target. |
| **Capability** | Pemetaan kategori UI → library yang melayaninya di project ini. |
| **Convention** | Aturan tak tertulis tim: class, korpora deep-selector, anatomi, naming. |
| **Korpora `::ng-deep`** | Kumpulan blok style-penetration yang menyimpan effect UI yang tidak terlihat di markup. |
| **Golden reference** | Komponen contoh pilihan user (didaftarkan via config) yang jadi pola penulisan kanonik. |
| **Resolved idiom** | Kandidat string eksak (class label + nama ikon) hasil `resolve`, keyed by bukti desain (warna, ikon, nama glyph Figma). |
| **Referee** | Gate pra-generate: validasi ground truth terhadap desain + codebase. |
| **Verify** | Gate pasca-generate yang blocking: fidelity + konvensi + struktur, wajib exit 0. |
| **Degraded** | Transkrip yang kualitasnya turun (mis. OCR gagal). Output wajib dilabeli *approximate*. |
| **Phantom wrapper** | Wrapper struktural di kode yang tidak ada padanannya di desain — pelanggaran invariant. |
| **Division of authority** | Aturan: desain memilikí tampilan, codebase memiliki wiring; keduanya wajib. |

---

## 12. Batasan yang diakui (jangan diklaim lebih dari ini)

1. **Deep adaptation masih Angular-only.** Klaim non-Angular harus selalu dibarengi label
   eksperimental.
2. **CI ubuntu-only.** Perilaku macOS (tier static) diuji manual — ini gap yang didokumentasikan,
   bukan diabaikan.
3. **Bukan alat pixel-diff.** Tidak ada metrik `pixel-diff` otomatis. Fidelity diukur di level
   atribut (warna, teks, ukuran, radius), bukan per piksel.
4. **Bukan design-system manager.** Ia mengonsumsi design token project, bukan mengelolanya.
5. **Bukan service.** Semuanya 100% lokal; tidak ada server, daemon, atau telemetry.
6. **Mock data only.** SliceUI tidak menebak endpoint atau service call — itu di luar scope,
   ditandai TODO di output.
7. **Friction gate adalah risiko produk yang nyata.** Laporan lapangan mencatat bahwa
   false-positive `verify` pernah mendominasi waktu pengerjaan (satu komponen ±36 menit, ±80%
   dihabiskan untuk berkelahi dengan gate + reverse-engineering library). Ini target perbaikan
   aktif, bukan masalah yang sudah selesai.
8. **Biaya konteks agent tinggi.** Dokumen ground truth bisa membengkak (peta project pernah
   mencapai 479 KB, melewati batas baca tool). Solusinya adalah ringkasan per-bagian yang
   di-generate, tapi ini tetap area yang perlu dijaga.

---

## 13. Yang sedang terbuka (bahan diskusi paling menarik)

Kalau agent lain mau memberi sudut pandang, ini pertanyaan yang **belum** terjawab:

1. **Kapan abstraksi framework netral layak dibuat?** Saat ini keputusan arsitekturnya: **jangan**
   — pengetahuan Angular sengaja **tidak** diletakkan di balik abstraksi netral sampai framework
   kedua (React) benar-benar bekerja dalam dan membuktikan field mana yang memang bersama.
   Pertukaran: duplikasi sekarang vs abstraksi yang salah bentuk nanti. Apakah ini keputusan yang
   benar untuk ruang "desain → kode" yang sangat framework-spesifik?
2. **Trade-off fidelity vs konvensi saat keduanya konflik.** Contoh nyata: desain menyuruh 10
   baris tabel, tapi konvensi project (dan gate) menyuruh tepat 15 baris mock supaya pagination
   hidup. Aturan siapa yang menang? Sekarang jawabannya di-hardcode; idealnya diputuskan sekali
   di level kontrak, bukan ditimbang ulang tiap sesi.
3. **Seberapa jauh gate boleh menahan?** Gate blocking membuat "selesai" jadi bermakna, tapi
   laporan lapangan menunjukkan agent bisa terjebak retry loop saat gate menuntut sesuatu yang
   environment tidak izinkan. Di mana batas antara "gate disiplin" dan "gate yang menjebak"?
4. **Bagaimana mengukur keberhasilan slicing?** Fidelity atribut adalah proxy yang baik untuk
   tampilan, tapi tidak mengukur "idiomatik". Apa metrik yang jujur untuk itu?
5. **Apakah transcript harus jadi format terbuka?** Transcript di sini berversi dan punya schema.
   Kalau ia jadi format terbuka, tool lain bisa mengonsumsi/menghasilkan transcript yang sama —
   apakah itu menguntungkan, atau justru mengunci desain yang belum matang?

---

## 14. Ringkasan satu paragraf (untuk di-quote)

> SliceUI mengubah desain UI menjadi kode komponen dengan cara yang bisa diaudit: ia lebih dulu
> menerjemahkan desain menjadi transcript teks yang eksak (sehingga model tanpa kemampuan
> melihat gambar pun bisa bekerja), mempelajari framework + konvensi tak tertulis project tujuan
> (sehingga output-nya idiomatik, bukan HTML generik), dan menutup loop dengan dua gate
> deterministik — validasi ground truth sebelum generate, dan verifikasi blocking sesudahnya.
> Fokusnya Angular 13 dengan pengalaman penuh; framework lain didukung dengan jujur sebagai
> eksperimental. Prinsip pemisahnya satu kalimat: **desain memiliki tampilan, codebase memiliki
> wiring, dan keduanya wajib.**
