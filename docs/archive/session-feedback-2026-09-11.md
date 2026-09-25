# SliceUI Session Feedback — 2026-09-11

**Environment:** sliceui 0.15.0 · project profile UII (Angular 13, pilar, ngx-bootstrap) · monorepo (lib `bill` + host app)
**Scope sesi:** 3 slice (`scholarship-deduction` list, `scholarship-deduction-add`, `scholarship-deduction-modal-detail`) + 3 bug yang dilaporkan user setelah generate (button centering, divider inset ×2, modal backdrop-blank).

Temuan diurutkan berdasar severity. "Evidence" adalah output tool asli (copy-paste) agar bisa direproduksi.

---

## P0 — hasil salah / false confidence

### F1. `verify` fallback ke artefak yang SALAH saat name-pairing gagal — false fail (dan berpotensi false pass)

**Evidence (slice 3, modal-detail):** komponen `modal-detail-scholarship-deduction-postgraduates`, XML `scholarship-deduction-modal-detail.xml` (urutan kata beda → pairing gagal). Peringatan hanya muncul di PALING BAWAH output:

```
⚠ no transcript matches component "modal-detail-scholarship-deduction-postgraduates" (have: scholarship-deduction, scholarship-deduction-add, scholarship-deduction-modal-detail)
⚠ no XML matches component ...
```

Tapi check yang bergantung transcript/XML TETAP jalan — memakai artefak milik screen lain (halaman list). Hasilnya 3 fail palsu: `styleFidelity 9/13 drift` (membandingkan teks "Nama" label modal vs HEADER TABEL halaman list), `libraryTable fail plain <table> used where the design shows a paged list` (evidence pagination diambil dari XML list), divider `#fdd835` (milik list, bukan modal `#fbc02d`).

Setelah `--transcript .../transcript.json --xml .../scholarship-deduction-modal-detail.xml`: **100% of 27 values, 0 fail.**

Sama juga terjadi saat verify sibling `student-rates-extends` (tanpa pasangan): `tableBindings ... [checkboxColumn] has no <Checkbox_FNC> evidence in the source XML` — "the source XML" yang mana, padahal tidak ada yang matched?

**Akar masalah:** pairing berbasis nama (prefix/suffix basename) gagal pada beda urutan kata — konvensi naming komponen (`modal-detail-x`) vs naming file desain (`x-modal-detail`) hampir selalu beda urutan. Saat gagal, tool tidak skip, tapi tetap memakai sembarang artefak terakhir/tersedia.

**Saran perbaikan:**
1. Saat pairing gagal → **jangan jalankan check yang butuh transcript/XML**. Tandai `unverified` (mirip pola `pilarInjection` warn). Exit code tetap non-zero dengan alasan jelas.
2. Naikkan ⚠ pairing ke BARIS PERTAMA output, jangan footer — agent yang membaca `tail` (umum) pasti kelewatan.
3. Pairing pakai token-overlap (`modal-detail-scholarship-deduction` vs `scholarship-deduction-modal-detail` = set token identik) atau map eksplisit di `.sliceui/config.json` (`pairings: { "modal-detail-scholarship-deduction-postgraduates": "scholarship-deduction-modal-detail.xml" }`).
4. `--transcript`/`--xml` escape hatch-nya sudah bagus dan menyelamatkan — pertahankan.

---

### F2. `declaredInModule` FALSE PASS pada komponen routed-but-undeclared

**Evidence (slice 2):** `ScholarshipDeductionAddComponent` sudah di-rute (`settings-routing.module.ts:190`) tapi TIDAK ada di `declarations` modul mana pun. Verify mengatakan:

```
✓ declaredInModule pass ScholarshipDeductionAddComponent is in the owning NgModule declarations
```

Beberapa menit kemudian app build gagal (inilah bug persis yang gate ini seharusnya tangkap):

```
Error occurs in the template of component ScholarshipDeductionAddComponent.
('ngx-select' is not a known element …)
```

Fixed dengan menambah import + entry `declarations` di `bill.module.ts`.

**Akar masalah (hipotesis kuat):** deteksi kemungkinan regex naif `ClassName,` di file `*module.ts` — baris routing `{ path: 'create', component: ScholarshipDeductionAddComponent, ... }` mengandung `ScholarshipDeductionAddComponent,` persis seperti entry declarations.

**Saran perbaikan:** parse isi array `declarations: [...]` milai `@NgModule` saja (atau minimal exclude match yang didahului `component:`). Ini P0 karena skill sendiri mengajarkan "library build green ≠ compiled; app build adalah gate sebenarnya" — lalu verify mengklaim menutup gap itu tapi false-pass. Kalau sulit diparse, lebih jujur skip dengan `cannot statically confirm` daripada pass.

---

### F3. `detectAuthFlags` tidak mengenali `Object.assign(new AuthorizationModel(), {...})` → pesan error menyesatkan

**Evidence (slice 1):** TS berisi persis:

```ts
auth: Object.assign(new AuthorizationModel(), { canRead: true, canUpdate: true }),
```

Verify: `✗ rowAuth fail action-column auth missing: canRead` — padahal `canRead` ADA di source. Agent dibiarkan menebak kenapa flag yang eksplisit tertulis "missing".

**Akar masalah:** regex `detectAuthFlags` hanya match `auth: { ... }` dan `new AuthorizationModel({...})` literal — bukan pola `Object.assign(new X(), {...})` (idiom yang dipakai komponen existing di repo ini, `student-rates-extends`).

**Saran perbaikan:** tambah pola `Object.assign(\s*new\s+AuthorizationModel\s*\([^)]*\)\s*,\s*\{([^}]*)\}`. Bonus: kalau flag terdeteksi di source tapi tidak dikenali pattern, kasih hint "detected literal near auth but not parsed — check idiom".

---

### F4. `mockRowCount` menghitung array TERBESAR (termasuk array `columns`!) dan paksa 15 walau pagination OFF

**Evidence (slice 3 final, uii-table dengan semua complement false):**

```
✗ mockRowCount fail 5 mock rows != required 15
```

Fakta: `komponenList` (rows) = 3 elemen, `columns` = 5 elemen. Checker mengambil array terbesar di seluruh TS = **definisi kolom (5)**, bukan rows. Jadi angka "5" sendiri sudah salah sumber.

Bukti false positive pada komponen existing yang sudah diterima tim:

```
✗ mockRowCount fail 7 mock rows != 15   (modal-detail-student-fees-postgraduate — modal detail sah, rows dari API)
```

**Akar masalah:**
1. `countMockRows` = "array literal terbesar di file" — tidak tahu array mana yang di-bind ke `[rows]`.
2. Gate aktif untuk SEMUA `<uii-table>` padahal komentarnya sendiri bilang floor itu untuk "paginated library table". `[paginationOptions]="false"` + `[searchOptions]="false"` + `[limitOptions]="false"` = canvas polos, 15 rows justru salah (semua 15 baris langsung render; desain hanya menunjukkan 3).

**Saran perbaikan:**
1. Resolve array yang di-bind `[rows]="X"` di HTML → cari deklarasi `X` di TS → hitung elemennya. Array `columns`/select-options tidak pernah dihitung.
2. Skip (bukan fail) kalau `paginationOptions` tidak truthy — konsisten dengan filosofi "plain detail table renders only the rows the design shows". (`checkRowAuth` sudah punya guard `="false"` — pola yang sama tinggal dipindah.)

---

## P1 — jebakan deterministik yang membuang waktu agent

### F5. Corpus berisi selector ber-hash `[_ngcontent-art-c12]` → `scssCoverage` WAJIB, `noHashedSelectors` MELARANG

**Evidence (slice 3):** missing list menuntut idiom `filter-options .search-options .search-input`. Bentuknya di corpus:

```scss
.filter-options[_ngcontent-art-c12] .search-options[_ngcontent-art-c12] .search-input[_ngcontent-art-c12] { ... }
```

Disalin verbatim (sesuai instruksi "copy verbatim & complete") → gagal:

```
✗ noHashedSelectors fail compiled [_ngcontent-*] selector(s) leaked into source SCSS: [_ngcontent-art-c12] ×3
```

Dua gate saling kontradiksi pada entry yang sama, deterministik, tanpa jalan keluar kecuali agent sadar harus menulis ulang selector.

**Saran perbaikan:** strip `[_ngcontent-*]` / `[_nghost-*]` saat ekstraksi corpus di `sliceui init`. Normalize sekali di sumber, bukan di setiap konsumen.

### F6. `scssCoverage` menuntut SEMUA idiom corpus, tidak scoped ke capability yang in play

**Evidence (slice 3):** modal dengan `searchOptions/limitOptions/paginationOptions` semua `false` tetap diwajibkan menempel ~100 baris SCSS mati: `search-input`, `search-options button`, `filter-options .limit-options select`, `ugw-pagination-container` (2 blok), `filter-options .search-options .search-input`. Semua men-styling elemen yang tidak pernah render.

Skill text sendiri bilang "copy when the capability is in play" — gate-nya tidak menghormati kalimat itu.

**Saran perbaikan:** scope check ke binding yang ada di HTML (`[searchOptions]` truthy → butuh `search-input`/`search-options`; ada pagination → butuh `ugw-pagination-container`). Hasil: komponen lebih ramping, intent lebih jujur.

### F7. `[checkboxColumn]="false"` dan `[showSummary]="false"` dianggap pelanggaran — butuh guard `="false"`

**Evidence (slice 3):**

```
✗ tableBindings fail forbidden input [showSummary] (server-mode/sliceui is mock-only); [checkboxColumn] has no <Checkbox_FNC> evidence
```

Binding eksplisit `false` = "kolom sengaja OFF" — bukan klaim. `checkRowAuth` sudah punya guard tepat untuk ini (komentar source menyebut fix 2026-09-10 B1 untuk `[actionColumn]="false"`); port guard yang sama ke `checkboxColumn`, dan keluarkan binding bernilai `false` dari forbidden-list (forbidden-list untuk `serverMode`/`page`/`selectedLimit` masuk akal; `[showSummary]` bukan server-mode binding — itu input deklaratif pilar yang sah).

Bonus kecil: pesan pass `tableBindings pass bindings legal + checkbox evidenced` menyesatkan saat TIDAK ada checkbox column sama sekali.

### F8. `resolve` FALLBACK icon: contoh inferensinya AKTIF SALAH — padahal jawabannya ada di XML

**Evidence (slice 2):** tombol "Get data", icon `Icon_primary` #ffffff:

```
FALLBACK: native-plain — ... infer from the action context (e.g. Icon_primary on a "Get data" button → fa-cloud-download), never a confident guess
```

Raw XML ternyata membawa `<variantProperties Alphabet="S" Name="sync" />` — variant **sync**. Project ini sendiri men-spell tombol "Get data" dengan `<i class="pf-sync-alt">`. Saya kebetulan cross-check XML; agent yang mengikuti contoh (fa-cloud-download) langsung salah icon.

**Saran perbaikan:** (1) `resolve` harus baca `variantProperties`/`Name`/`mainComponent` dari instance icon sebelum menyerah — nama variant Figma sering = nama glyph. (2) Hapus/mperbaiki contoh inferensi dalam pesan FALLBACK; contoh yang salah lebih berbahaya daripada tanpa contoh.

### F9. `spec.md` membuang koordinat absolut → salah render inset (bug yang user laporkan 2×)

**Evidence (slice 3):** divider header. `transcript.md` punya geometri (`divider#…52428 [20,50 760×1]` → inset 20px kiri-kanan, sejajar padding title x=20). `spec.md` — dokumen yang katanya "render this in ONE pass" — hanya menulis `divider#…52428 bg:#fbc02d` tanpa posisi. Akibatnya dua bug beruntun yang user tangkap:

1. Saya render hr full-width (`margin: 0`) — harusnya inset 20.
2. Setelah fix inset, saya menumpuk `margin: 0 20px` DI ATAS `padding: 15px 20px` → title tergeser 40px, tidak sejajar hr lagi. Idiom benar sudah ada di sibling modal (`padding: 15px 0; margin: 0 20px`) tapi tidak pernah ditawarkan sebagai copy-target.

**Saran perbaikan:**
1. Inline `[x,y w×h]` per node di `spec.md` Elements (data sudah ada di transcript; tinggal tidak dibuang).
2. Tambah verdict layout eksplisit untuk pola rawan: "footer action bar: CENTERED (pair 315.5–465.5 / 485.5–635.5 symmetric about 475.5)", "divider: INSET 20px (x=20, w=760, parent 800)". Prose rule di skill sudah ada ("Footer action bars are centered… read the x-offsets") tapi tidak ada di spec maupun verify — agent harus menghitung sendiri.
3. Fitur "nearest-neighbor idiom": saat ada komponen existing dengan elemen setara (modal-header di modal lain), tunjuk file+baris SCSS-nya sebagai copy-target presisi, bukan hanya corpus generik.

### F10. `button-action-center` ada di classVocabulary tapi TIDAK PUNYA definisi CSS di mana pun — jebak nama

**Evidence (slice 2, bug user #1):** kelas muncul di conventions (family button-action) dan di pilar showcase markup. Grep seluruh project + `node_modules/pilar` + styles.css: **nol definisi**. Nama kelas menjanjikan centering; realitas tergantung konteks (di showcase ia hidup di dalam `.modal-footer`). Saya pakai di luar modal → button kiri semua, karena `.form-button` saya `display:flex` tanpa `justify-content`.

**Saran perbaikan:** tandai entri classVocabulary dengan status definisi: `defined | context-dependent (only inside .modal-footer) | undefined`. Kelas "undefined/context-dependent" jangan dihitung sebagai idioms aktif — atau minimal verify bisa check "centering promised by class name tapi tak ada definisi → pastikan ada justify-content".

---

## P2 — UX gate & filosofi

### F11. `anatomy` memaksa `<uii-table-skeleton>` padahal design tidak punya loading state

Verify: `✗ anatomy fail table present but <uii-table-skeleton> loading state missing`. Ini memaksa agent MENAMBAH struktur (`isLoading`/`showTable` flag + `*ngIf`) yang tidak ada di XML — kontradiksi langsung dengan aturan paling keras skill sendiri: "STRUCTURE = XML/TRANSCRIPT ONLY … Conventions never ADD structural wrappers". Saran: turunkan ke warn, atau aktif hanya kalau ada bukti loading di design/transcript.

### F12. `referee` merah pada utang teknis repo yang pre-existing + exit code tidak konsisten + `target-exists` tidak muncul

- Setiap run referee (3 slice) selalu merah dengan duplicate selector yang sama (`ugw-generate-bill-unit 2×`, dll.) — utang lama repo, bukan buatan slice, tidak bisa/bisa diperbaiki dalam scope slice. Noise terus-menerus melatih agent mengabaikan merah.
- Output menulis `1 red (fail/stale) · 6 checks` tapi **exit code 0** — skill menyuruh "re-run until referee exits 0"; sesuai exit code sudah 0 dari awal. Menyesatkan.
- `--target` dikatakan menjalankan target-exists check dengan mode + line count — tidak pernah muncul di output, padahal target ada (junk stub `dfxniehmfiofojrof,` di html). Saya harus deteksi manual + tanya user.

Saran: klasifikasi temuan (`slice-blocking` vs `repo-preexisting`), exit code non-zero kalau ada slice-blocking red, dan pastikan target-exists benar-benar berjalan + dilaporkan.

### F13. Kode hasil generate membaca `DataService.getData()` tanpa guard → runtime crash yang tampak sebagai "backdrop doang" (bug user #3)

`getData()` mengembalikan `undefined` sampai `setData()` dipanggil. Modal yang di-show tanpa `setData` → `ngOnInit` set `studentInfo = undefined` → template `studentInfo.tahun_akademik` → TypeError → ngx-bootstrap sudah pasang backdrop, content tidak pernah render — tanpa error yang jelas di UI. Sample sibling memang unguarded (callernya selalu `setData` dulu), dan slice meniru sampel itu.

Saran: (1) aturan generate: setiap baca `dataSvc.getData()` WAJIB `|| {}` / `|| []`; (2) idealnya verify check "template deref pada data service yang bisa undefined".

### F14. Dua kotak pencarian: "Pencarian" dekoratif di filter + `searchOptions=true` milik uii-table

Design list page punya input "Pencarian" DI DALAM area filter (bukan toolbar tabel). Mapping buku saku (`<search_bar>` ⇒ `[searchOptions]="true"`) membuat uii-table merender search box KEDUA. Saran: deteksi posisi `search_bar` relatif container tabel — kalau di dalam filter group, set `searchOptions="false"` (atau instruksi eksplisit di spec: "search bar ada di filter card, bukan toolbar — jangan aktifkan searchOptions").

---

## Yang sudah bagus (pertahankan)

- **`transcribe` tier 0 (FIGML): 100% fidelity di ketiga slice, instan.** Ini fondasinya solid.
- **`resolve` dedup groups** (5 badge identik → 1 entry + count) dan idiom inline di spec (`label-custom-active + fa-check-circle`) — tepat semua, tidak pernah saya menyangkal satu pun.
- **`spec` one-pass** benar-benar menghapus kebutuhan cross-reference — satu-satunya saat saya balik ke transcript/raw XML adalah geometri (lihat F9, justru karena spec membuangnya).
- **uii-profile action→authKey→icon table** — `<Aksi> detail=true` → `canRead` langsung benar, termasuk kasus edit/delete/toggle=false yang tidak ikut.
- **Doktrin app-build vs lib-build** ("library build green ≠ compiled") — tepat, dan justru yang menangkap F2.
- **Aturan 15 mock rows untuk paginated list** — benar untuk slice 1 & 2 (pagination aktif).

## Urutan quick-win yang saya sarankan

| # | Fix | Effort | Dampak |
|---|-----|--------|--------|
| 1 | F1 pairing: skip XML-dependent checks saat unpaired + warning ke atas + config pairings | kecil | tinggi (hilangkan false fail/pass paling besar) |
| 2 | F2 declaredInModule: parse `declarations:` sungguhan | kecil | tinggi (gate anti-silent-failure jadi bisa dipercaya) |
| 3 | F4 mockRowCount: resolve array `[rows]` + skip saat pagination off | kecil | tinggi |
| 4 | F5 strip `[_ngcontent-*]` saat ekstraksi corpus | sangat kecil | sedang (trap deterministik hilang) |
| 5 | F3 regex `Object.assign(new AuthorizationModel(), …)` | sangat kecil | sedang |
| 6 | F7 guard `="false"` untuk checkboxColumn/showSummary | sangat kecil | sedang |
| 7 | F9 spec.md sertakan `[x,y w×h]` + verdict centering/inset | sedang | tinggi (2 dari 3 bug user berasal dari sini) |
| 8 | F6 scssCoverage scoped ke capability in play | sedang | sedang |
| 9 | F8 resolve baca variantProperties; hapus contoh inferensi salah | kecil | sedang |
| 10 | F10 label defined/undefined di classVocabulary; F11 skeleton → warn; F12 klasifikasi referee; F13 guard getData() di aturan generate | kecil-kecil | sedang |
