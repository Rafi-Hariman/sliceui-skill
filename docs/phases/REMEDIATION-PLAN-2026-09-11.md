# SliceUI Remediation Plan — Session Feedback 2026-09-11 (F1–F14)

> **Dari:** `docs/archive/session-feedback-2026-09-11.md` (sesi 3 slice di `lib-uii-gateway-bill-angular`)
> **Tanggal:** 2026-09-11 · **Status:** DRAFT — menunggu review, lalu eksekusi atas instruksi user
> **Tujuan:** menutup false-pass/fail yang memancing agent salah arah, dan menghilangkan trap
> deterministik yang membuang waktu. Khususnya: beberapa temuan ini adalah **bug di fix saya
> sendiri** (F2 false-pass `declaredInModule`, F5 strip hash yang cuma separuh) — jadi ini koreksi
> terhadap pekerjaan kemarin, bukan fitur baru.

---

## 0. Status vs laporan (diverifikasi ke source)

| # | Temuan | Verdict |
|---|---|---|
| F1 | pairing gagal → fallback artefak salah (false fail + potensi false pass) | ❌ terbuka — P0 |
| F2 | `declaredInModule` false-pass (match `component: X,` di route) | ❌ terbuka — P0 (bug fix saya sendiri) |
| F3 | `detectAuthFlags` tak kenal `Object.assign(new AuthorizationModel(), {…})` | ❌ terbuka |
| F4 | `mockRowCount` ambil array terbesar (bisa `columns`), paksa 15 walau pagination off | ❌ terbuka — P0 |
| F5 | corpus ber-hash `[_ngcontent-*]` → `scssCoverage` wajib vs `noHashedSelectors` larang | ⚠️ sebagian — `normalizeSelector` sudah strip hash, tapi **`block` masih verbatim** → hash bocor ke copy-target |
| F6 | `scssCoverage` tidak scope ke binding truthy | ❌ terbuka |
| F7 | `[checkboxColumn]="false"` / `[showSummary]="false"` dianggap pelanggaran | ❌ terbuka |
| F8 | resolve fallback icon — contoh inferensi salah + `variantProperties` tak dibaca | ❌ terbuka |
| F9 | `spec.md` buang koordinat → inset salah (2 dari 3 bug user) | ❌ terbuka — tinggi |
| F10 | `button-action-center` di vocab tanpa definisi CSS | ❌ terbuka |
| F11 | `anatomy` paksa `<uii-table-skeleton>` walau design tanpa loading | ❌ terbuka |
| F12 | referee merah pada utang pre-existing + exit code + target-exists hilang | ❌ terbuka |
| F13 | `getData()` tanpa guard → runtime crash | ❌ terbuka (docs) |
| F14 | dua search box (dekoratif filter + `searchOptions=true`) | ❌ terbuka |

---

## Fase & urutan kerja (dikunci)

| Fase | Isi | Dampak |
|---|---|---|
| **1** | F1 (pairing) + F2 (declaredInModule) + F4 (mockRowCount) | P0 — false pass/fail paling berbahaya |
| **2** | F5 + F3 + F7 + F8 + F9 + F6 + F11 | P1 — trap deterministik + false-fail |
| **3** | F10 + F12 + F13 + F14 | P2 — UX/docs/referee |

Eksekusi bertahap; `node --test test/` hijau di akhir tiap fase.

---

## FASE 1 — P0 (false pass/fail)

### F1 — pairing: skip saat unpaired + warning di baris atas + token-overlap + config map

**Masalah.** `pairGroundTruth` (verify) fallback ke artefak "sembarang" saat nama komponen ≠ nama
design (`modal-detail-x` vs `x-modal-detail`). Check XML-dependent tetap jalan dengan artefak screen
lain → 3 false fail (styleFidelity/libraryTable/divider). Warning hanya di footer (agent baca `tail`
kelewatan).

**Fix (4 langkah):**
1. **Skip, bukan fallback.** Bila `name` diberikan dan tidak ada pasangan yang *pasti* (folder
   artifact / XML exact), tandai `unpaired: true` dan **skip semua check yang butuh transcript/XML**
   (mirror pola `pilarInjection` warn) — status `unverified`, exit tetap non-zero dengan alasan jelas.
   Ini menghilangkan false-pass sekaligus false-fail.
2. **Warning ke baris pertama.** Pindahkan ⚠ pairing ke atas output (`verify.mjs` print sebelum
   per-check verdict), bukan footer.
3. **Token-overlap matching.** Normalisasi nama → set token (urutkan, lower, strip `-`):
   `modal-detail-scholarship-deduction-postgraduates` ≈ `scholarship-deduction-modal-detail`
   (overlap tinggi). Gunakan sebagai fallback *hanya* bila overlap ≥ ambang (mis. semua token inti
   hadir) — kalau ragu, tetap skip (jangan tebak).
4. **Config map.** `.sliceui/config.json` dapat `pairings: { "<component-name>": "<design-stem>" }`
   sebagai otoritas tertinggi sebelum token-overlap.

**Test:** (a) name tanpa pasangan → check XML-dependent `unverified` (bukan fail); (b) name dengan
`pairings` map → ter-pair; (c) token-overlap → ter-pair; (d) warning muncul di atas.

### F2 — `declaredInModule` anti false-pass

**Masalah.** Regex `declarations:\s*\[[\s\S]*?ClassName[\s\S]*?\]` menangkap `ClassName` di
routing `{ path, component: ClassName }` karena `component: X,` mirip entry `declarations`.

**Fix.** Ekstrak **hanya blok `declarations: [...]`** (bukan seluruh source), lalu cek keanggotaan
di dalam blok itu. Parsing sederhana: temukan `declarations` di dalam `@NgModule({…})`, ambil
`[...]`-nya (brace-aware), baru test `\bClassName\b`. Bila parsing tidak yakin → **skip
`cannot statically confirm`**, jangan pass.

**Test:** (a) class di `component:` route saja → `warn`/`fail` (bukan pass); (b) class di
`declarations` → pass; (c) source ambigu → skip.

### F4 — `mockRowCount` resolve array `[rows]` + skip saat pagination off

**Masalah.** `countMockRows` ambil "array literal terbesar di file" — bisa `columns` (5) bukan
rows (3). Dan gate aktif untuk SEMUA `<uii-table>` walau `[paginationOptions]="false"` (canvas
polos: 15 rows justru salah).

**Fix (2 langkah):**
1. **Resolve binding `[rows]="X"`** di HTML → cari deklarasi `X` di TS → hitung elemen array itu.
   Array `columns`/select-options tidak pernah dihitung. Fallback ke heuristic "array terbesar"
   hanya bila `[rows]` tidak bisa di-resolve.
2. **Skip (bukan fail) bila `[paginationOptions]` tidak truthy** (dan `[searchOptions]`/`[limitOptions]`
   tidak truthy) — konsisten dengan "plain detail table renders only the rows the design shows".
   Pola guard `="false"` yang sudah dipakai `checkRowAuth` dipindah ke sini.

**Test:** (a) `[rows]="list"` dengan `columns` lebih besar → hitung `list`; (b) `[paginationOptions]="false"`
→ skip; (c) regresi: pagination aktif + 15 rows → pass.

---

## FASE 2 — P1 (trap & false-fail)

### F5 — strip `[_ngcontent-*]`/`[_nghost-*]` di `block` (bukan cuma selector)

**Masalah.** `normalizeSelector` sudah strip hash, tapi `block` disimpan verbatim → hash bocor ke
`spec.md` copy-target → agent menyalin selector ber-hash → `noHashedSelectors` fail. Dua gate
kontradiksi deterministik.

**Fix.** Saat ekstraksi corpus (`extractNgDeepCorpus`), **strip `[_ngcontent-*]`/`[_nghost-*]`
dari `block`** juga (satu normalisasi di sumber), bukan di tiap konsumen.

**Test:** corpus dari SCSS ber-hash → `block` bersih tanpa `[_ngcontent-*]`.

### F3 — `detectAuthFlags` kenal `Object.assign(new AuthorizationModel(), {…})`

**Fix.** Tambah pola:
`/\bauth\s*:\s*Object\.assign\(\s*new\s+AuthorizationModel\s*\([^)]*\)\s*,\s*\{([^}]*)\}/`.
Bonus: bila ada literal `AuthorizationModel`/`auth` dekat tapi tak ter-parse, tambah hint
"detected auth near literal but not parsed — check idiom".

**Test:** `Object.assign(new AuthorizationModel(), { canRead: true, canUpdate: true })` → flags
terdeteksi, `rowAuth` pass.

### F7 — guard `="false"` untuk `checkboxColumn`/`showSummary` + forbidden-list

**Masalah.** `[checkboxColumn]="false"` difailkan ("no `<Checkbox_FNC>` evidence") padahal kolom
sengaja off; `[showSummary]` difailkan padahal input deklaratif pilar yang sah (bukan server-mode).

**Fix:** (a) di `tableBindings`, bila binding bernilai `="false"` → lewati (sengaja off) — pola sama
dengan `checkRowAuth` B1; (b) keluarkan `showSummary` dari forbidden (bukan server-mode binding);
(c) perbaiki pesan pass yang menyesatkan saat tak ada checkbox column.

**Test:** `[checkboxColumn]="false"` → tidak fail; `[showSummary]="false"` → tidak fail.

### F8 — resolve baca `variantProperties`/`Name`/`mainComponent` icon; hapus contoh inferensi salah

**Masalah.** Fallback icon "Get data" mencontohkan `fa-cloud-download`, padahal XML membawa
`<variantProperties Name="sync" />` → glyph benar `pf-sync-alt`. Contoh salah lebih berbahaya dari
tanpa contoh.

**Fix:** (1) di `resolve`, sebelum menyerah ke `native-plain`, baca `variantProperties`/`Name`/
`mainComponent` dari instance icon (nama variant = nama glyph); (2) hapus/ganti contoh inferensi
di pesan FALLBACK (jangan sebut glyph spesifik yang bisa salah).

**Test:** icon dengan `variantProperties Name="sync"` → resolve memakai `sync` (bukan fallback).

### F9 — spec.md sertakan geometri `[x,y w×h]` + verdict inset/centering

**Masalah.** `spec.md` (dokumen "render in ONE pass") membuang koordinat → divider render
full-width, lalu inset salah → title tak sejajar (2 dari 3 bug user). Idiom sibling yang benar
tidak pernah ditawarkan.

**Fix:**
1. Di `summarize` (spec.mjs), inline `[x,y w×h]` per node (data sudah di transcript, tinggal tidak
   dibuang).
2. Tambah verdict layout eksplisit untuk pola rawan: divider inset (`x=20, w=760, parent 800` →
   `INSET 20px`), footer action bar centered (pair simetris). Prose rule di skill sudah ada tapi
   tidak di spec/verify — tuangkan ke spec.
3. (Opsional, fase 3) nearest-neighbor idiom: tunjuk file+baris SCSS sibling setara sebagai
   copy-target presisi.

**Test:** spec.md memuat `[x,y w×h]` dan (untuk divider) keterangan inset.

### F6 — `scssCoverage` scope ke binding truthy

**Masalah.** `relevantCorpus` hanya cek `family in play` — modal dengan semua option `false` tetap
diwajibkan menempel SCSS mati (`search-input`, `ugw-pagination-container`, dll).

**Fix.** Scope ke binding truthy di HTML: `[searchOptions]` truthy → butuh `search-input`/
`search-options`; pagination truthy → butuh `ugw-pagination-container`. Bila binding `false`/
absen → selector keluarga itu bukan "required" (advisory/skip).

**Test:** modal dengan `searchOptions=false` + `paginationOptions=false` → `scssCoverage` tidak
menuntut `search-input`/`ugw-pagination-container`.

### F11 — `anatomy` skeleton → warn (bukan fail) saat design tanpa loading

**Masalah.** `<uii-table-skeleton>` dipaksa walau XML tidak punya loading state — kontradiksi
dengan "STRUCTURE = XML ONLY".

**Fix.** Turunkan ke `warn` (atau aktif fail hanya bila ada bukti loading di transcript/XML).
Selaras dengan filosofi "conventions style, never add structure".

**Test:** table tanpa bukti loading → `anatomy` warn (bukan fail).

---

## FASE 3 — P2 (UX/docs/referee)

### F10 — classVocabulary: tandai `defined | context-dependent | undefined`

**Masalah.** `button-action-center` di vocab tanpa definisi CSS → jebak nama (centering dijanjikan
tapi tidak ada).

**Fix.** Saat mining vocab, cek keberadaan definisi di SCSS (`.button-action-center {`).
Tandai entri: `defined` / `context-dependent` (hanya muncul di dalam `.modal-footer`) / `undefined`.
Kelas `undefined`/`context-dependent` tidak dihitung idiom aktif, atau verify beri hint
"centering promised by name but no definition → ensure justify-content".

### F12 — referee: klasifikasi temuan + exit code konsisten + target-exists

**Masalah.** Merah pada utang pre-existing (duplicate selector repo) melatih agent abaikan merah;
output `1 red · 6 checks` tapi exit 0; `--target` target-exists tak muncul.

**Fix:** (1) klasifikasi `slice-blocking` vs `repo-preexisting`; (2) exit non-zero hanya bila ada
`slice-blocking` red; (3) pastikan `target-exists` benar-benar jalan + dilaporkan (dengan mode +
line count, seperti yang sudah diimplementasi di `refereeArtifacts` — verifikasi wiring CLI-nya).

### F13 — aturan generate: guard baca `dataSvc.getData()`

**Fix (docs, SKILL.md).** Setiap baca `dataSvc.getData()`/`getData()` wajib `|| {}` / `|| []`
(guard undefined) — modal yang di-show tanpa `setData` tidak boleh crash template. Tambah ke
Output Contract / anti-pattern.

### F14 — deteksi `search_bar` di filter (bukan toolbar) → jangan aktifkan `searchOptions`

**Fix (docs/spec).** Saat `search_bar` ada DI DALAM area filter (bukan toolbar tabel), set
`searchOptions="false"` — hindari search box kedua. Deteksi posisi relatif container tabel (atau
instruksi eksplisit di spec).

---

## Verifikasi akhir

1. `node --test test/` → hijau di tiap fase.
2. Uji di `lib-uii-gateway-bill-angular` (setelah re-init struktur baru):
   - `sliceui verify` pada komponen modal-detail → pairing `unverified` bila unpaired (bukan false fail).
   - `declaredInModule` tidak false-pass pada komponen routed-but-undeclared.
   - `mockRowCount` skip saat `paginationOptions=false`.
3. `sliceui spec` → `[x,y w×h]` hadir; divider inset benar.

---

## Ditunda (di luar scope)

- F13/F14 sebagai *verify check otomatis* (butuh analisis cascade/posisi) — cukup docs dulu;
  otomasi menyusul bila pola terbukti.
- Nearest-neighbor idiom (F9 poin 3) — kompleks, fase terpisah.
