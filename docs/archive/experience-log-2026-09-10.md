# SliceUI Experience Log — 2026-09-10

Sesi: slice `tarif-extend-index.xml` → `StudentRatesExtendsComponent` (Angular 13, pilar/uii-table).
Hasil akhir: BERHASIL (user konfirmasi UI bagus). Catatan ini hanya **kekurangan** yang ditemui,
sebagai bahan perbaikan skill/CLI ke depan.

## 1. Transkrip & Resolve

1. **Ikon sebagai teks kosong.** Glyph ikon yang di Figma berupa teks (fa caret di limit-selector,
   ikon search di search-bar, ikon paginasi) masuk transkrip sebagai string kosong (`"" {15px w900}`).
   Informasi glyph hilang total; hanya ukuran/warna yang tersisa.
2. **Resolve ambigu untuk glyph tanpa nama.** Ikon `toggle-on` di kolom Aksi resolve-nya gagal ke
   keputusan tunggal — malah mengembalikan `resolved: [fa-search, fa-pencil, fa-eye]` (ketiganya
   sekaligus) + `fallback: native-plain`. Kontrak skill bilang "emit ONLY strings in resolved[]",
   padahal salah satu dari ketiganya pasti salah (fa-search untuk tombol toggle jelas keliru).
   Agent harus balik ke nama glyph XML (`Icon_..._T_toggle-on`) untuk memutuskan — resolve tidak
   menghemat langkah ini.
3. **Resolve sangat repetitif.** 1 layar → `resolved.json` 1.659 baris, karena leaf identik yang
   berulang 10× di tabel (status Aktif, ikon pencil) dicetak per-baris tanpa dedup. ±90% isinya
   duplikat; membaca utuh memakan konteks.
4. **Transkrip mengexpand semua row.** 10 row tabel ditulis lengkap (~360 baris) padahal bentuknya
   identik; untuk generate cukup 1 bentuk row + jumlah. Boros konteks pada tabel besar.

## 2. project-context.json & Deteksi

5. **Ukuran file tidak bisa dibaca langsung.** `project-context.json` 479 KB — melebihi batas baca
   tool (256 KB). Skill menyuruh "read the capabilities dari project-context", faktanya harus
   grep/sed per-fragment. Kapabilitas, designTokens, dan sampleComponents tersebar sampai baris 17k+.
6. **`componentDir` salah untuk monorepo.** Deteksi mengarah ke `src/app` (project root host app),
   padahal komponen library ada di `projects/uiigateway/bill/src/lib/...`. `detectionWarnings` hanya
   memperingatkan soal pemilihan project, tidak soal path komponen. Target penulisan harus
   ditentukan manual dengan mengikuti komponen existing.
7. **`sampleComponents` tidak relevan dengan domain.** Tiga sample yang ditulis (bill-history,
   edit-bill, edit-bill-end-date) jauh dari pola halaman index+filter+tabel; sample yang benar-benar
   dipakai adalah sibling domain (`student-rates`) yang dicari sendiri via grep.

## 3. Konvensi & Referee

8. **Korpora `::ng-deep` hampir-duplikat & saling bertentangan.** Ada `.label-custom-warning` vs
   `-warnings` (beda satu huruf, isi sama), dan radius konflik (`.form-control` 7px vs `.input` 6px)
   tanpa penjelasan kapan pakai yang mana.
9. **Kontradiksi `.well`:** konvensi mendorong `.well` untuk kartu filter, sementara gate
   `sliceui verify` (phantomWrapper) menandai `well` sebagai fail jika kata "well" tidak ada di
   transkrip. Dua aturan berlawanan; harus pilih class deskriptif (`.filter-card`) untuk lolos
   keduanya — tidak didokumentasikan di skill.
10. **Referee `--target` tidak memberi detail yang dijanjikan.** Skill menjanjikan mode
    (mock/real API) + jumlah baris komponen existing pada temuan target-exists; karena referee tidak
    bisa dijalankan, status stub harus diselidiki manual (ls/wc + baca file).

## 4. Aturan Skill vs Realita Desain

11. **Aturan "exactly 15 mock rows" vs desain.** Transkrip menampilkan limit "Tampilkan **5** data"
    dan 10 row; aturan memaksa 15 row agar paginasi aktif. Ada ketegangan fidelity-vs-gate yang
    tidak dijelaskan bagaimana direkonsiliasi.
12. **Aturan literal-text vs halaman yang sudah ter-i18n penuh.** Halaman sibling memakai
    `| translate` di mana-mana; hasil slice literal-text menonjol sebagai inkonsistensi kode.
    Memang disengaja (mock), tapi menyulitkan saat convert mock → produksi nanti.

## 5. Operasional (environment, bukan salah CLI)

13. **Semua gate membutuhkan Bash; tanpa fallback.** Saat safety classifier harness outage,
    `referee`, `verify`, dan `ng build` sama sekali tidak bisa dijalankan agent — workflow terhenti
    di tahap verifikasi padahal semua file sudah jadi. Perlu jalur fallback terdokumentasi
    (mis. user menjalankan `! sliceui verify ...` / `! npx ng build bill` dari prompt).
14. **Type-check via IDE diagnostics (read-only) berhasil jadi jaring penyelamat** — layak
    dicatat sebagai fallback resmi ketika Bash tidak tersedia (menangkap tidak ada error TS di
    .ts/.html yang digenerate).

## Ringkasan Prioritas Perbaikan

| # | Masalah | Usulan |
|---|---------|--------|
| 1 | resolve repetitif (1.6k baris) | dedup leaf identik per evidence |
| 2 | project-context 479 KB tak terbaca | pecah per-bagian / sertakan ringkasan |
| 3 | glyph→teks kosong di transkrip | sertakan nama glyph FIGML di transkrip |
| 4 | resolve ambiguous mengembalikan 3 ikon sekaligus | pilih 1 berdasar glyph-name, atau tandai `ambiguous` eksplisit |
| 5 | componentDir salah di monorepo | deteksi workspace + peta project→dir |
| 6 | kontradiksi `.well` konvensi vs verify | samakan aturan di kedua gate |
