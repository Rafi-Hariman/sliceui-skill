# SliceUI — Experience Report & Improvement Suggestions

Ditulis dari sesi slicing nyata di repo `lib-uii-gateway-bill-angular` (Angular 13 monorepo, `projects/uiigateway/bill`). Empat komponen dibuat: `StudentRatesExtendsAddComponent`, `StudentRatesExtendsEditComponent` (2 iterasi — termasuk swap ke `InstallmentSpreadsheetComponent`), dan `ModalEditMassStudentRatesExtendsComponent`.

Tujuan dokumen ini: **hanya saran perbaikan** — apa yang membuat eksekusi sulit, dan bagaimana sebaiknya. Bukan laporan keberhasilan.

---

## Ringkasan satu kalimat

`sliceui transcribe` dan `resolve` bekerja sangat baik (transkripsi FIGML 100% presisi, tidak pernah jadi sumber masalah). Kesulitan hampir seluruhnya ada di **`sliceui verify` yang tidak bisa menemukan ground truth di monorepo**, plus **beberapa check yang memberi false-positive** dan membuat saya "memperbaiki" kode yang sebenarnya sudah benar.

---

## A. BLOKER — bikin verifikasi tidak bisa dipercaya

### A1. `sliceui verify` tidak menemukan `.sliceui/` di monorepo (paling krusial)

`nearestProjectRoot(dir)` naik ke atas sampai menemukan `package.json` pertama. Di repo ini, `projects/uiigateway/bill/package.json` **menaungi** root repo, sehingga root `.sliceui/` tidak pernah ditemukan.

Akibat langsung:
- `conventions.json` = `null` → `noBareNgDeep`, `classVocabulary`, `loadedClass` jalan **buta**.
- Footer cetak `⚠ NO GROUND TRUTH — ... NOT verifiable.`
- `noBareNgDeep` false-fail pada `::ng-deep` yang sebenarnya ada di corpus (korpus kosong → semua `::ng-deep` dianggap "agent-added leak").

**Saran:**
- `nearestProjectRoot` harus **melompati `package.json` yang berada di dalam subdir `projects/*`** (workspace library) dan terus naik ke root workspace (dir yang memuat `angular.json` / `nx.json` / `workspace.json`).
- Atau: baca `projects/<name>/tsconfig.lib.json` → ambil `extends`/`sourceRoot`/`rootDir` untuk tahu root-nya.
- Minimal: izinkan flag `--conventions <path>` (saat ini cuma `--xml` dan `--transcript`). `--xml`/`--transcript` memang bisa lewat flag, tapi `conventions.json` **hanya** dibaca via root-walk — tidak ada flag-nya. Ini yang paling gampang ditambal.

### A2. `referee --target` / `target-exists` mati di library

`target-exists` mencari `<componentDir>/<name>.component.ts` dengan `componentDir: src/app` — yang **tidak ada** untuk library Angular (`projects/*/src/lib`). Jadi guard "jangan overwrite komponen yang sudah ada" **tidak pernah menyala** di repo ini.

Saya harus manual: `git ls-files`, `grep` deklarasi module, cek apakah target adalah stub kosong atau punya kontrak.

**Saran:** ambil `componentDir` dari `project-context.json` yang sebenarnya sudah berisi struktur module (`moduleStructure`, `appModulePath`) — jangan hardcode `src/app`.

---

## B. BIKIN KODE SALAH — false-positive yang memancing "perbaikan" keliru

### B1. `rowAuth` false-positive (paling mahal)

Dua masalah sekaligus:
1. Guard regex `/\[actionColumn\]/` cocok dengan string `[actionColumn]="false"` **juga** — tidak bisa bedakan true/false. Saya sudah set `actionColumn=false` (benar, sesuai design tanpa kolom Aksi), tapi check tetap menuntut `canRead`/`canDelete`.
2. Check tidak membaca sinyal `visible=false` yang dinyatakan lewat `<override overriddenField="visible">` (gaya Figma), hanya atribut `visible="false"` langsung pada node.

Akibat: saya **menambahkan kolom aksi + auth yang tidak ada di design** hanya untuk bikin check hijau. User yang menangkapnya.

**Saran:**
- Guard harus match `\[actionColumn\]\s*=\s*"?(true)` — bukan sekadar kehadiran atribut.
- `requiredAuthKeysFromXml` harus menaati `visible="false"` termasuk lewat `<override overriddenField="visible">`. Kalau tidak bisa parse override, lebih aman **skip** daripada memaksa.
- Simetri dengan aturan `[HIDDEN]`: node `[HIDDEN]` ≠ action column. `<Aksi>` di dalam frame tersembunyi bukanlah kolom aksi yang terlihat.

### B2. `mockRowCount` menghitung trailing comma sebagai elemen

Regex hitung `countArrayElements` menghitung koma di akhir array sebagai elemen ekstra → 15 baris terbaca 16, fail. Saya harus **menghapus trailing comma** dari semua array mock (padahal trailing comma valid dan idiomatis di TS).

**Saran:** parser harus mengabaikan koma terakhir sebelum `]` (atau pakai pendekatan yang benar-benar menghitung elemen, bukan koma).

### B3. `classVocabulary` match `id="btn-..."` sebagai class

Regex `\bbtn-([a-z0-9-]+)` scan seluruh teks HTML, jadi `id="btn-foo"` dianggap class `btn-foo`. Repo ini punya **46** `id="btn-*"` (konvensi dominan). Temuan "invented button class" yang asli cuma satu (`btn-get-data`), sisanya noise dari `id`.

**Saran:** hanya scan nilai atribut `class="..."`, bukan seluruh teks. Atau minimal kecualikan `id="..."`.

### B4. `iconColor` menolak `fa-*` dengan warna struktural biru

Check membaca `fa-pencil { color: #03337b }` sebagai badge warna. `#03337b` adalah biru struktural project (bukan warna status), dan design memakainya untuk ikon aksi. Saya harus memindahkan warna ke class semantik (`.action-icon`) agar check skip.

**Saran:** daftar "warna struktural" (yang di-skip) seharusnya termasuk `#03337b` ketika `#03337b` dominan sebagai `designTokens.surface`/accent di project (bisa diambil dari `project-context.json`), bukan hanya hardcode `#03337b/#303030/#ffffff`.

### B5. `styleFidelity` bingung oleh SCSS nested + class berprefiks tabrakan

Saya pakai SCSS nesting `& + .summary-row` dan class `.summary-row-danger`. Checker resolve warna salah: melaporkan `.summary-label` berwarna `#f44444` padahal seharusnya `#555555` — karena class `.summary-row-danger` (prefiks dari `.summary-row`) "menangkap" selector `.summary-row`.

Ini sekaligus bug kode saya (cascade nyata), tapi pesan error tool-nya **menunjuk class yang salah**, bikin debugging membingungkan.

**Saran:** di `authoredRule`/`declMap`, pencocokan class harus pakai boundary yang benar (`\.\bsummary-row\b` bukan substring) sehingga `.summary-row-danger` tidak cocok dengan `.summary-row`. Dan deteksi nested-SCSS sebaiknya di-flatten dulu (atau minimal di-warn) sebelum di-resolve.

---

## C. FRICTION — tidak salah, tapi menambah kerja

### C1. `ng build bill` hijau padahal komponen tidak ter-declare

Library `ng build` **melewati** komponen yang tidak di-declare di NgModule. Green build ≠ komponen ter-compile. Saya baru tahu komponen tidak ter-compile setelah grep marker unik di `dist/.../fesm2015/*.mjs` (0 hit). Dan error `NG8001 'ngx-select' is not a known element` baru muncul saat `ng serve` (app build), bukan saat `ng build bill`.

**Saran:** skill harus menegaskan untuk library Angular: gate yang benar adalah **app build** (`ng build <app-project>`), bukan `ng build <lib>`. Atau verifikasi harus memeriksa `declarations` di NgModule. Idealnya `sliceui verify` punya check "component declared in module" (sudah ada data `appModulePath`/`moduleStructure` di context, tinggal dipakai).

### C2. Dua class beda file dengan nama sama → butuh import alias

`StudentRatesExtendsEditComponent` ada di dua file (modal legacy `ui/` + page baru `feature/`), keduanya selector `ugw-student-rates-extends-edit`. Mendeklarasikan keduanya butuh `import { X as Y }` karena TS reject dua import dengan nama sama. Selector duplikat sendiri **tidak** di-error Angular (routing instansiasi by class, tidak ada template pakai tag-nya) — jadi hazard laten yang diam.

**Saran:** `sliceui verify` / `referee` bisa punya check "duplicate selector across declared components" dan "duplicate class name" — ini kelas bug yang berbahaya dan diam.

### C3. `resolve` fallback `native-plain` untuk ikon tanpa nama

Untuk ikon `#03337b` tanpa glyph name, resolve memberi kandidat ambigu `fa-search/fa-pencil/fa-eye` **berulang identik** untuk 5 ikon. Saya harus infer dari konteks aksi. Tidak salah, tapi noisy.

**Saran:** dedup leaf yang identik; jika warna biru struktural dan tanpa nama, cukup satu kali "infer from action context" alih-alih per-ikon.

### C4. Default class framework yang harus di-netralkan

Memakai `.modal-header` bawaan Bootstrap ikut membawa `border-bottom: 1px solid #e5e5e5` yang tabrakan dengan divider kuning. Saya harus eksplisit `border-bottom: none`. Umum: reuse class framework (`.modal-header`, `.well`, `.form-control`) berarti mewarisi default-nya; transcript harus menang tapi **override default yang bertentangan** harus ditulis eksplisit.

**Saran:** tidak banyak yang bisa diotomasi, tapi `sliceui verify` bisa punya check ringan: "element menggunakan class `.modal-header`/`.well` tapi tidak meng-override properti yang sering tabrakan (border/padding)" — atau minimal dokumentasikan di skill bahwa class framework membawa default.

### C5. `init` re-ingest idiom yang baru saya generate

Setelah generate komponen, `sliceui init` **memasukkan `::ng-deep` block hasil slice saya** ke `conventions.md` seolah itu konvensi project lama. Jadi `init` bukan refresh murni kalau repo sudah berisi kode hasil generate.

**Saran:** `init` harus menandai/memisahkan konvensi yang berasal dari file ber-header `// Generated by SliceUI` (jangan dijadikan corpus otoritatif), atau paling tidak tandai sumbernya.

---

## D. YANG SUDAH BAGUS (jangan diubah)

- **`transcribe` FIGML** — presisi 100%, tidak pernah jadi sumber masalah di 4 komponen.
- **`resolve`** untuk ikon/button yang punya nama jelas (`fa-info-circle`, `fa-caret-down`, `btn-primary`/`btn-secondary`) — akurat.
- **`textCoverage`** — memaksa teks kritis (judul, tombol, placeholder) benar-benar ter-render; menangkap drop nyata.
- **`gridColumns`** (sum ≤ 12), **`noTranslation`** (literal text), **`pilarBindings`** (hanya bind input/output yang dideklarasi) — semua berguna dan benar.
- **`tableBindings`** — larangan `[selectedLimit]`/server-mode valid; menangkap kesalahan saya yang asli.
- Konsep **action→authKey→icon** (`uii-profile.md`) bagus; masalahnya hanya di guard regex B1.
- Alur "tiga pass" (inventory → layout → styling) dan "copy `::ng-deep` corpus verbatim" — panduan yang solid.

---

## E. Prioritas perbaikan (saran saya)

1. **A1** — `nearestProjectRoot` lompati `projects/*/package.json`, atau tambah `--conventions`. (Tanpa ini, verify tidak bisa dipercaya sama sekali di monorepo.)
2. **B1** — `rowAuth` guard: bedakan `actionColumn` true/false + hormati `visible=false` (termasuk override). (Ini yang memancing saya menulis kolom aksi salah.)
3. **B2** — `mockRowCount` jangan hitung trailing comma.
4. **C1** — gate build untuk library = app build, bukan lib build; atau check "declared in module".
5. **A2** — `target-exists` pakai `componentDir` dari context, bukan `src/app`.
6. **B3 / B4 / B5** — perbaiki regex classVocabulary, warna struktural iconColor, boundary styleFidelity.

---

*Ditulis 2026-09-10. Repo tool: `~/Development/freelance/sliceui-skill` (npm-linked ke `sliceui@0.15.0`).*
