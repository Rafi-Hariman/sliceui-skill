# Laporan Pengalaman Menggunakan SliceUI

> Disusun setelah menylicing **7 design** (design-1 s.d. design-7) menjadi 7 komponen Angular 13
> di project **sliceui-sandbox** (UII Gateway / pilar + `@uiigateway/core`).
> Laporan ini fokus pada **layouting**, **rounded corner**, **gap/spacing**, dan **properti**,
> plus/minus, konsistensi, kendala, dan saran perbaikan agar hasil slicing lebih maksimal.

---

## 1. Ringkasan

| Aspek | Penilaian |
|---|---|
| Akurasi transkripsi teks & warna | **Sangat bagus** — 100% fidelity di semua 7 design (426–536 atribut) |
| Wiring framework/library (pilar, ngx-select, uii-table) | **Sangat bagus** — dibantu `pilar-reference.md`, `pilar-showcase.md`, `uii-profile.md` |
| Layouting (radius, gap, border, spacing) | **Cukup, tapi sering kehilangan detail** — per-corner radius & border/stroke sering hilang |
| Konsistensi antar design | **Bagus di level transkripsi, beragam di level implementasi** |
| Gate verifikasi (`referee`/`verify`) | **Berguna tapi ada false-positive** yang menghabiskan waktu |

Kesimpulan: SliceUI sudah **sangat membantu** dan layak pakai, tapi bagian **layouting halus**
(radius per sudut, warna border, `visible=false`, `gap` semantik) adalah titik terlemah dan paling
sering memaksa saya menggali raw XML manual.

---

## 2. Plus / Kelebihan

1. **Transkripsi FIGML akurat 100%.** Teks, warna, geometri terbaca persis; tidak ada OCR yang salah.
   Ini fondasi yang sangat kuat — saya tidak pernah ragu soal "apa tulisannya" / "warna apa".

2. **Deteksi project otomatis.** Framework, prefix selector (`app`), component dir, module,
   capability (select → `ngx-select-ex`, table → `pilar/uii-table`, dll.) terdeteksi benar.

3. **`conventions.md` + `conventions.json` = corpus `::ng-deep` reusable.**
   Saya tinggal copy-paste verbatim (`.ngx-select__choices`, `.ugw-pagination-container li.page-box`,
   `.label-custom-*`, dll.) — styling library-internal yang tidak mungkin dilihat dari XML.

4. **Reference pilar sangat detail.** `pilar-reference.md` (API `@Input`/`@Output` tiap `uii-*`),
   `pilar-showcase.md` (contoh kerja nyata), `uii-profile.md` (tabel action→authKey→icon).
   Ini yang membuat wiring `uii-table` (checkbox/action/auth/input-number) akurat.

5. **`resolve` memetakan ikon & tombol dengan benar** untuk kasus umum:
   `caret-down → fa-caret-down`, `pencil → fa-pencil`, `eye → fa-eye`,
   `primary → btn-primary`, `secondary → btn-secondary`.

6. **Gate `verify` menangkap kesalahan nyata.** Mis. `tableBindings` (whitelist legal binding),
   `pilarBindings` (hanya input/output yang dideklarasikan), `ngxSelectBinding`
   (wajib `[(ngModel)]` + `(select)`), `noTranslation`, `no v17 syntax`.

7. **Prinsip "raw XML menang" menyelamatkan saya** (design-6): transcript sempat drop isi tabel,
   dan instruksi skill mengarahkan untuk membaca raw XML.

---

## 3. Minus / Kekurangan

1. **Transcript bisa drop konten secara diam-diam.** Design-6: bagian "Rincian komponen"
   (tabel 5 kolom × 3 baris) hilang total dari transcript, padahal ada di raw XML.
   Ini fatal karena saya sempat render tabel kosong.

2. **`visible="false"` tidak disurfacing.** Node tersembunyi (asterisk required di design-7,
   section "Angsuran Caturdharma" di design-6, action icon tersembunyi di `<Aksi>` design-2/3)
   tidak ditandai. Saya harus grep raw XML berulang kali.

3. **Layouting halus hilang** (detail di §5):
   - Per-corner radius (`topLeftRadius`/`bottomRightRadius`) tidak dipertahankan.
   - Warna **stroke/border** tidak dibedakan dari **fill/background**.
   - `gap` besar (mis. `gap:497`) adalah artifact `space-between`, tapi dilaporkan literal.

4. **False-positive di gate `verify`** (detail di §6): `libraryTable` dan `iconColor` sering
   salah flag komponen yang sebenarnya benar.

5. **`mockRowCount` memaksa literal row.** Design-2 (120 data) dan design-3 (513 data) memaksa
   saya menulis 120/513 literal objek di `.ts` (file 60KB+), padahal loop runtime jauh lebih bersih.

6. **Status badge umum tidak ada di corpus.** Badge "Aktif" (biru muda `#eef6ff`/`#3e82f3`)
   muncul di design-2/3/4 tapi `resolve` mengembalikan `native-plain`, sehingga saya menciptakan
   `.label-aktif` **dua kali** (duplikat antar komponen).

7. **Ikon tertentu tidak terpetakan.** `Icon_primary` (ikon tombol "Get data") dan `Icon_white`
   (glyph centang di badge) → `native-plain`; saya menebak `fa-cloud-download` dan `fa-check-circle`.

8. **Pola "select vs static box" tidak dibedakan.** Field "NIM" berisi teks "Pilih NIM" **tanpa
   caret/dropdown** di design-1/7. Naifnya akan jadi `<ngx-select>`; saya harus sadari sendiri
   bahwa itu read-only box.

---

## 4. Konsistensi Hasil

- **Level transkripsi: konsisten tinggi.** 7/7 design fidelity 100%, teks & warna identik dengan XML.
- **Level implementasi: beragam tapi "benar per design".** Saya menghasilkan 3 gaya tabel berbeda:
  - `uii-table` untuk index flat (design-2, 3, 7).
  - native `<table>` matrix untuk design-4 (rowspan/colspan grouping).
  - native `<table>` read-only untuk design-5 (detail) dan design-6 (modal detail).
  Ini benar secara desain, tapi memperlihatkan aturan "selalu `uii-table`" terlalu kaku dan
  butuh pengecualian yang lebih jelas.
- **Duplikasi styling.** `.label-aktif` (badge "Aktif") ditulis di dua komponen — menunjukkan
  corpus reusable belum mencakup status badge umum di domain ini.

---

## 5. Detail Masalah Layouting (radius, gap, border, properti)

Ini area yang paling diminta untuk diperbaiki. Bukti konkret dari pengalaman:

### 5.1 Rounded corner / per-corner radius
- **Kasus design-6 (tabel "Rincian komponen").** Raw XML punya:
  - Frame `cornerRadius="4"` + stroke `#bdbdbd`.
  - Rectangle header `topLeftRadius="4" topRightRadius="4"`.
  - Rectangle terakhir `bottomLeftRadius="4" bottomRightRadius="4"`.
  Transcript hanya memberi `[TABLE] r:4`. Akibatnya saya:
  1. Salah pakai `border-collapse: collapse` (mematikan `border-radius` di tabel).
  2. Salah pakai border `#e0e5ed` (dari daftar token) padahal stroke asli `#bdbdbd`.
  **Perbaikan yang diharapkan:** transcript mencatat radius per sudut + warna stroke secara terpisah.

### 5.2 Gap / spacing
- `gap` kecil (`gap:10`, `gap:20`) dan `pad:12/12/12/12` umumnya benar.
- Tapi **`gap:497`** (toolbar "Tampilkan… data" vs search bar di design-2/3/7) adalah artifact
  flex `space-between` Figma, bukan gap nyata. Kalau diikuti literal akan merusak layout.
  **Perbaikan:** deteksi pola `primaryAxisSizingMode="FIXED"` + jarak lebar sebagai distribusi
  flex, bukan `gap` literal.

### 5.3 Properti yang hilang dari transcript
| Properti raw XML | Ada di transcript? | Dampak |
|---|---|---|
| `visible="true|false"` | **Tidak** | Render elemen tersembunyi / salah set auth |
| `topLeftRadius`/`bottomRightRadius` dll. | **Tidak** (hanya `r:4`) | Sudut tabel salah |
| `stroke` (warna border) | **Tidak** (hanya `bg`) | Border salah warna |
| `fontName` (`Symbol(figma.mixed)` → Roboto) | Sebagian | Family ikon/glyph tidak jelas |
| `letterSpacing` | Tidak | Minor |
| `layoutSizingHorizontal="FILL"` (flex grow) | Sebagian (`layoutGrow`) | Lebar kolom meleset |

### 5.4 Judul & divider yang bervariasi
- Divider kuning: design-1/2/3/4/7 = `#fdd835`, design-5/6 = `#fbc02d`.
  (Transcript benar, tapi ini sumber jebakan jika diasumsikan satu token.)
- Judul halaman: `.h1` default 16px/500 hitam, tapi design-5 "Detail tagihan" = 16px **w700** `#555555`,
  design-6 "Detail komponen" = **14px** w700 `#555555`. Aturan "render as `h1.h1`" perlu pengecualian.

---

## 6. Kendala Saat Slicing (bug / jebakan spesifik)

1. **Infinite loop `uii-table` `(rowsChanged)`.** (Kesalahan saya, tapi memperlihatkan gap.)
   Saya bind `(rowsChanged)` lalu reassign `this.rows = $event`. Pilar `client-table` meng-emit
   `rowsChanged` saat `preprocessRows` (sort/page/search/limit), dan reassign memicu `ngOnChanges`
   → `preprocessRows` → emit lagi → loop → browser hang.
   - `rowsChanged` ada di whitelist `SLICE_TABLE_OUTPUTS`, padahal itu footgun.
   - **Saran:** beri peringatan eksplisit, atau hapus dari whitelist (kolom input `type:'input-number'`
     sudah menulis ke row via `[(ngModel)]` tanpa perlu output).

2. **`sliceui verify` salah pasangkan ground truth.** `verify <dir> <name>` mencocokkan
   transcript/XML berdasarkan nama file yang diawali nama komponen (`design-2.xml` ≠
   `new-tariff-manual-index`), lalu **fallback ke file pertama** (`design-1.xml`).
   Hasil: `[checkboxColumn]` dan `styleFidelity` salah flag (memeriksa design yang salah).
   Saya terpaksa menulis script Node untuk memanggil `verifyComponent` dengan XML yang benar.
   - **Saran:** dukung flag eksplisit `--xml`/`--transcript`, atau manifest pemetaan component→xml.

3. **`libraryTable` false-positive.** Proyek ini `tableTag: uii-table`, jadi native `<table>`
   selalu difail. Tapi benar untuk: matrix table (design-4), read-only detail (design-5),
   placeholder kosong (design-6) — yang semuanya **tidak punya** search/limit/pagination.
   - **Saran:** skip/relax jika tidak ada evidence search/pagination, atau izinkan opt-out.

4. **`iconColor` false-positive.** `fa-info-circle` dengan `#004c88` (banner info design-1/4/7)
   difail karena `#004c88` tidak ada di map `FA_ICON_COLORS`. Workaround: pindah warna ke container.
   - **Saran:** tambah `#004c88` (info) & `#3e82f3`/`#eef6ff` (badge "Aktif") ke map semantik.

5. **`mockRowCount` butuh literal.** Regex menghitung elemen array literal, bukan hasil loop.
   Design-3 "dari 513 data" → 513 literal objek. File jadi gemuk dan tidak idiomatik.
   - **Saran:** kenali `for`/`Array.from`/`.map` expansion sebagai row count.

6. **"Pilih NIM" read-only box.** Tidak ada caret → bukan dropdown. Transcript tidak memberi
   sinyal ini; saya harus inspeksi manual.

7. **Aksi tersembunyi di `<Aksi>`.** Design-2 `<Aksi>` berisi pencil (visible) + eye + toggle-on
   (keduanya `visible=false`). Design-3 eye (visible) + lainnya hidden. Untuk set `auth` yang benar
   (hanya `canUpdate` vs `canRead`) saya harus baca raw XML.

---

## 7. Saran Perbaikan (diprioritaskan)

### A. Layouting & properti (fokus utama)
1. **Surface `visible` di transcript** — tandai node tersembunyi (`hidden: true`) agar agen tidak
   render asterisk/section/action icon tersembunyi. *(Dampak terbesar, menyentuh design 2/3/6/7.)*
2. **Pertahankan radius per sudut + stroke.** Emit `radius: {tl,tr,bl,br}` dan `border` (stroke)
   terpisah dari `bg` (fill). *(Menyelesaikan kasus design-6.)*
3. **Bedakan fill vs stroke** untuk badge/kontainer.
4. **Normalisasi `gap` artifact** — deteksi `space-between` dan terjemahkan ke flex distribusi,
   bukan `gap` literal (hindari `gap:497px`).
5. **Deteksi "select vs static box"** — field dengan teks placeholder tanpa caret = read-only input,
   bukan dropdown.

### B. Fidelity transcript
6. **Jangan drop tabel berstruktur** yang nested dalam `Group`/`Frame` (kasus design-6).
7. **Tambahkan ikon ke corpus resolve**: `Icon_primary` (aksi utama), `Icon_white`/check glyph
   (→ `fa-check-circle`), dan badge "Aktif" biru muda → class reusable (hindari duplikasi `.label-aktif`).
8. **Dokumentasikan varian token**: divider `#fdd835` vs `#fbc02d`; judul 16/500 vs 16/700 vs 14/700.

### C. Gate & verify
9. **Perbaiki pairing ground truth** — flag eksplisit `--xml`/`--transcript` atau manifest.
10. **Relax `libraryTable`** untuk tabel non-paginated (matrix/read-only/placeholder).
11. **Perbaiki `iconColor`** — lengkapi map warna semantik.
12. **`mockRowCount` hitung loop/runtime** — jangan hanya literal array.
13. **Peringatan `(rowsChanged)`** — tambah warning atau hapus dari whitelist `SLICE_TABLE_OUTPUTS`.

### D. Kualitas output
14. **Deduplikasi class reusable** — badge "Aktif" dan pola status umum sebaiknya masuk
    `conventions.md` corpus, bukan ditulis ulang tiap komponen.

---

## 8. Lain-lain

- **Effort & biaya konteks.** Karena transcript/`resolve` tidak lengkap, saya harus berulang kali
  `grep` raw XML dan `node_modules/pilar/*.mjs` untuk disambiguasi (auth, visible, radius, border).
  Ini menambah waktu signifikan. Transcript yang self-sufficient untuk **struktur yang terlihat**
  akan sangat mengurangi ini.
- **Yang paling membantu tetap dipertahankan:** fidelity 100%, corpus `::ng-deep` reusable,
  reference pilar (API + showcase + action→authKey), dan gate `verify` yang menangkap binding ilegal.
- **Saran proses:** pertimbangkan "layout snapshot" terpisah (radius/gap/border/stroke/visible)
  agar agen bisa render 1:1 tanpa harus menebak.

---

*Report dibuat 2026-09-07 oleh Claude Code (SliceUI skill), berdasarkan 7 design nyata.*
