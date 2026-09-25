# SliceUI Fixing Plan (Revised) — Grounded in the Current Codebase

> Revisi dari `SLICEUI-FIXING-PLAN-CLAUDE-CODE.md`, dikoreksi terhadap **kondisi kode aktual**
> (v0.15.0 + work in-flight, audit 2026-09-24).
>
> **Prinsip revisi:** setiap klaim masalah harus punya bukti di kode, dan setiap perubahan harus
> dinyatakan dalam satuan *check yang berubah* — bukan dalam satuan arsitektur baru.
>
> **Yang berubah dari plan asli:** urutan eksekusi dibalik (instrumentasi dulu, front-end
> compiler terakhir), satu kontradiksi dengan R1 diperbaiki, satu bagian dihapus karena
> abstraksi framework-nya sudah diveto ADR-2, dan satu analisis biaya (§14) yang membatasi
> target waktu ke angka yang bisa dicapai.

---

## 0. Hasil Audit: Klaim Plan Asli vs Kondisi Kode

Audit dilakukan dengan membaca entry point langsung, bukan dari dokumen. Hasilnya mengubah
prioritas secara material.

| Klaim plan asli | Bukti di kode | Verdict |
| :--- | :--- | :--- |
| §1.1 "command per-slice mencari ulang referensi di repository" | `resolve.mjs:28-29` dan `spec.mjs:196-197` **hanya** membaca transcript + `.sliceui/conventions.json`. Nol glob. | ❌ **Salah** untuk resolve/spec |
| §2.2 "`referee --target` melakukan scan repository" | `referee.mjs:23,56-58` hanya membaca `.sliceui/**`. | ❌ **Salah** |
| §1.1 "pekerjaan indexing diulang pada setiap slice" | Scan mahal ada di `detect.mjs:94` (`scanLibraryUsage`, 3 glob) + `:138` (`extractConventions`, 2 glob). Tapi `SKILL.md` Step 0 = init (jalankan detect) **dan** Step 1 = `sliceui detect` sebagai langkah normal. | ⚠️ **Benar, tapi penyebabnya workflow** — bukan arsitektur |
| §2.2 "`verify` melakukan repository-wide search" | `verify.mjs:218-232` `readOwningModules()` menelusuri **seluruh** source tree secara rekursif (skip hanya `node_modules`/`dist`/`.sliceui`), tiap kali verify dijalankan. | ✅ **BENAR — dan ini satu-satunya** |
| §2 "per-slice = deterministic lookup terhadap index" | Sudah berlaku untuk resolve/spec/referee. | ✅ Sudah tercapai |

**Konsekuensi:** sebagian besar plan asli (§2, §3, §4, §6 — yaitu PR 2, 3, 4, 5, 7) membangun
compiler front-end untuk masalah yang **sebagian besar tidak ada**. Yang benar-benar ada hanya
tiga: (a) `verify` traversal tak terbatas, (b) `detect` terulang karena alur skill, (c)
pemborosan token dari membaca source mentah.

---

## 1. Yang Sudah Selesai — Jangan Dikerjakan Ulang

Beberapa item plan asli sudah mendarat di sesi kerja 2026-09-24. Daftar ini mengikat: jangan
mengulang.

| Item plan asli | Status | Bukti |
| :--- | :--- | :--- |
| §7.4 icon resolver order (`variantProperties` → ... ) | ✅ **Selesai** | `resolve.mjs` mewariskan `variantName` dari wrapper icon ke leaf Vector; `sync → fa-refresh` (FA4) |
| §7.5 optional element omission (`required=false`) | ✅ **Selesai** | `required` dibaca dari `<variantProperties>`; check `requiredMarker` men-fail "emit-then-hide" |
| §6 public-API-before-deep-CSS untuk pagination | ✅ **Selesai** | `paginationAlign` di-un-forbid + evidence-gated (SPACE_BETWEEN); check `alignmentViaDeepCss` (warn) |
| §7.1 sebagian: root padding hilang | ✅ **Selesai** | `findRootAttrs` menempelkan padding root frame ke node konten; check `containerPadding` |
| §7.6 unknown Angular input | ✅ **Sudah ada** | `checkPilarBindings` vs pilar-catalog (case-sensitive), `checkTableBindings` vs slice policy |
| §7.7 sebagian: unused import | ❌ **Belum** | Tidak ada check |
| §7.1 sebagian: canvas x/y → layout CSS | ❌ **Belum** | Belum ada `scope`/`emitCss` di transcript |
| §7.2 wrapper invention detector | ⚠️ **Sebagian** | `phantomWrapper` hanya menangkap `.well` dan `page-canvas`; `max-width`/`margin:auto`/`box-shadow` belum |
| §7.3 modal evidence classifier | ❌ **Belum** | Tidak ada |

---

## 2. Invariant yang Tidak Boleh Dilanggar

Semua pekerjaan di dokumen ini tunduk pada ini. Kalau sebuah usulan melanggarnya, usulan itu
yang salah — bukan invariant-nya.

```text
R1  No ground truth ⇒ never green.      (verify-gate-trust.md)
R2  False positive adalah defect, bukan noise — perbaiki di akar.
R3  Red harus actionable: sebutkan apa yang salah dan apa perbaikannya.
R4  Verdict yang bergantung pada CSS cascade harus dicek render probe.
R5  Output buatan SliceUI sendiri bukan pelanggaran.
R6  Setiap perubahan check mendarat bersama test berpasangan.

ADR-2 (LOCKED): tidak ada abstraksi framework netral sebelum React membuktikan field bersama.
ADR-4: grammar org (pilar/UII) tetap di repo tapi dikeluarkan dari paket publik.
```

**Kontradiksi yang diperbaiki.** Plan asli §1.4 menulis *"gate tidak boleh pass karena data
ground truth tidak tersedia"* (= R1), tetapi §9 melarang `verify` melakukan "source tree
traversal" — padahal pembacaan itu yang menghidupkan check `declaredInModule`. Larang total, dan
check itu akan `skip` selamanya, yang **justru melanggar R1**. Revisi ini memperbaiki §9:
yang dilarang adalah **traversal tak terbatas**, bukan pembacaan yang ter-scope.

---

## 3. Target Arsitektur (Revisi)

Plan asli mengusulkan enam artifact index baru. Kondisi sekarang sudah punya padanannya:

| Artifact usulan plan asli | Padanan yang SUDAH ADA | Yang benar-benar kurang |
| :--- | :--- | :--- |
| `component-capabilities.json` | `pilar-catalog.mjs` (47 komponen, input asli case-sensitive) + `uii-profile.mjs` | Tidak ada untuk komponen non-pilar — tapi lihat §8 (ADR-2) |
| `conventions.json` | ✅ Ada | — |
| `style-corpus.json` | `conventions.json.ngDeepCorpus` (dengan flag `reusable`) | Hash lock untuk blok `locked` |
| `component-patterns.json` | `conventions.md` + `sampleComponents[*]` | Ekstraksi pola ringkas (bukan source penuh) |
| `icon-registry.json` | `resolve.mjs` `NAME_GLYPH` + `FA_ICON_COLORS` | Registry terpisah dengan provenance |
| `provenance.json` | `detect.mjs:144` sudah menulis `provenance` (tag `sourceCode\|configFile\|registryDefault`) | Provenance per-keputusan resolve |

**Kesimpulan arsitektur:** yang dibutuhkan bukan compiler front-end baru, melainkan **tiga
perbaikan pada yang sudah ada**:

```text
1. Freshness    — deteksi "index sudah ada dan masih valid" supaya detect tidak diulang.
2. Read scope   — batasi pembacaan verify ke apa yang benar-benar dipakai.
3. Budget       — potong context yang dikirim ke agent berdasarkan inventory desain.
```

---

## 4. Pekerjaan P0 (Urutan Eksekusi Wajib)

> Urutan ini adalah inti revisi. Plan asli menaruh profiling di PR 1 tapi lalu membangun
> compiler di PR 2–5 sebelum angkanya ada. Revisi ini menahan semua pekerjaan struktural
> sampai langkah 1–3 memberi angka.

### P0-1 — Instrumentasi dulu (prasyarat semua)

**Alasan:** tanpa angka, seluruh plan ini adalah tebakan. Plan asli sendiri mengakui ini di §15
Phase 1 tapi tidak menahan diri di fase berikutnya.

Deliverable:

```text
sliceui <command> --profile      # laporan manusia
sliceui <command> --json-report  # laporan mesin
benchmarks/baseline.json         # hasil sebelum perubahan
```

Yang diukur (minimum):

```text
files read
bytes read
project files read di luar .sliceui/ dan target output
glob operations
context characters yang akan dikirim ke agent
wall-clock per tahap
```

Guardrail: **jangan** log isi source, secret, atau API key (NFR-1).

Test: filesystem adapter di-spy; test gagal jika hot path membaca di luar allowlist.

### P0-2 — Perbaiki scope pembacaan `verify` (satu fungsi)

**Masalah nyata:** `verify.mjs:218-232` `readOwningModules(root)` menelusuri seluruh tree
rekursif setiap verify, semata untuk `checkDeclaredInModule`.

Perbaikan:

```text
1. Turunkan kandidat module dari componentDir (project-context.json), bukan dari root.
2. Baca hanya *.module.ts pada dan di atas componentDir.
3. Jika componentDir tidak tersedia → skip check dengan diagnostic yang jelas,
   JANGAN fallback ke traversal root.
```

**Kenapa bukan dilarang total:** melarang pembacaan apa pun akan mematikan `declaredInModule`
secara permanen → melanggar R1. Yang dilarang adalah traversal **tak terbatas**.

Diagnostic: `SUI-PERF-001` dengan pesan yang menyebut path yang dibaca, bukan sekadar "scan".

### P0-3 — Freshness `detect` (masalah workflow, bukan arsitektur)

**Masalah nyata:** `SKILL.md` Step 0 = init (menjalankan detect) **dan** Step 1 = `sliceui detect`
sebagai langkah normal. Agent yang mengikuti alur ini menjalankan 5 glob per slice tanpa alasan.

Perbaikan (pilih satu, jangan keduanya):

```text
Opsi A (lebih murah): ubah SKILL.md — Step 1 hanya dijalankan bila codebase berubah sejak init;
  nyatakan eksplisit bahwa init SUDAH menjalankan detect.
Opsi B (lebih kuat): detect menulis fingerprint (hash package.json, tsconfig, angular.json,
  mtime source terpilih) dan pada run berikutnya berhenti dengan "context fresh, tidak ada
  perubahan relevan" kecuali --force.
```

Rekomendasi: **A sekarang, B belakangan.** A adalah perubahan teks; B menambah permukaan state
yang harus diuji. Kerjakan B hanya jika A terbukti tidak cukup.

### P0-4 — Context budget (memotong pemborosan token yang nyata)

**Masalah nyata:** bukan scan repo, tapi agent membaca source mentah besar. `SKILL.md` sendiri
memperingatkan `pilar-showcase.md` ~184KB dan `project-context.json` pernah 479 KB.

Perbaikan:

```text
1. Pruning berbasis inventory desain: spec hanya memuat capability yang dipakai.
2. Style block hanya yang relevan dengan capability yang dipakai.
3. Tidak ada source component penuh di context default.
4. Budget configurable, default maxCharacters.
5. Jika budget terlampaui: buang hint yang tidak dipakai, ringkas prosa — JANGAN buang
   exact text, layout facts, atau API names.
```

Ini pekerjaan berorientasi-dampak tertinggi per usaha di seluruh plan.

### P0-5 — Fidelity fixes yang belum dikerjakan

Lihat §5.

---

## 5. Fidelity Fixes (Yang Masih Terbuka)

Diambil dari §7 plan asli, dikurangi yang sudah selesai (§1 di dokumen ini).

### 5.1 Canvas position bukan outer spacing — §7.1

```text
x="270" y="140" pada root frame  →  JANGAN menjadi margin/padding/absolute
```

Tambahkan scope pada transcript:

```json
{ "scope": "canvas-position", "sourceNodeId": "...", "x": 270, "y": 140, "emitCss": false }
{ "scope": "root-internal",   "sourceNodeId": "...", "top": 20, "left": 20, "emitCss": true  }
```

Aturan: hanya padding **internal** (root/child) yang boleh menjadi CSS padding; koordinat canvas
tidak pernah.

Diagnostic: `SUI-LAYOUT-001`.

**Catatan penting:** ini harus dikerjakan di `figml-parse.mjs` (tempat ia sudah punya
`paddingOf`/`justifyContentOf`), bukan sebagai modul baru — pola yang sudah terbukti di sesi
2026-09-24 (memakai predikat yang sama dengan `fidelity.mjs` supaya gate dan skor tidak bisa
saling bertentangan).

### 5.2 Wrapper invention detector — §7.2

`phantomWrapper` sekarang hanya menangkap `.well` dan `page-canvas`. Perluas ke:

```text
max-width, margin: 0 auto, box-shadow, outer padding, card wrapper, modal wrapper, absolute
```

Aturan: setiap wrapper/efek harus punya provenance — (a) frame XML sumber, (b) host wajib
framework, (c) wrapper library terverifikasi, atau (d) kebutuhan aksesibilitas. Kalau tidak ada:
`SUI-STRUCT-004`.

Warn dulu, bukan fail — tier string tidak selalu bisa membedakan drift dari kebutuhan sah
(preseden: `alignmentViaDeepCss` dan `containerPadding` keduanya warn).

### 5.3 Modal evidence classifier — §7.3

Jangan klasifikasikan modal dari: root rounded, lebar tetap, ada header/body/footer, tombol
tengah, atau posisi x/y di tengah canvas. Modal evidence valid hanya: backdrop, close control,
nama node eksplisit, instance komponen modal terverifikasi.

Diagnostic: `SUI-STRUCT-007`.

### 5.4 Unknown Angular input + casing — §7.6

**Sudah ada** untuk pilar (`checkPilarBindings`). Yang belum: input case-sensitive untuk
komponen non-pilar. Kerjakan hanya jika ada sumber API-nya (§8).

### 5.5 Dead code prevention — §7.7

Belum ada check. Target: `OnDestroy` tanpa cleanup, `destroy$` tanpa pakai, service injection
tanpa pakai, unused import/type import, route/API spekulatif.

Ini murni lint output — tidak butuh index, tidak butuh registry. Murah dan berdampak langsung
pada kualitas output.

---

## 6. Diagnostics

**Adopsi, dengan satu koreksi.** Ide diagnostics bergaya compiler (kode + Evidence/Expected/
Suggested fix) bagus dan murah: ia adalah **format pesan**, bukan arsitektur baru.

Koreksi terhadap plan asli: jangan memperkenalkan skema penomoran SUI-* sebagai sistem terpisah.
Check verify sudah punya nama (`requiredMarker`, `containerPadding`, …). Pakai kode SUI sebagai
**string** di dalam pesan check yang sudah ada — pola yang sudah dipakai (`alignmentViaDeepCss`
mencetak "SUI006"). Kalau nanti butuh ID mesin, tambahkan field `code` pada objek check — bukan
registry kode terpisah.

Format pesan:

```text
CODE — Judul

Evidence:
- ...
Expected:
- ...
Suggested fix:
- ...
```

Kode minimum yang berguna (bukan 14 kode kosong):

```text
SUI-PERF-001   Read di luar allowlist
SUI-LAYOUT-001 Canvas coordinate menjadi layout CSS
SUI-STRUCT-004 Wrapper tanpa bukti design/framework
SUI-STRUCT-007 Semantik modal tanpa bukti modal
SUI-ICON-002   Metadata ikon diabaikan (sudah tertutup oleh resolve)
SUI-API-001    Public capability diabaikan demi deep CSS (sudah tertutup)
```

---

## 7. Repository Access Guard (Revisi §9 Plan Asli)

**Koreksi:** allowlist harus mengizinkan pembacaan yang ter-scope, bukan melarang pembacaan.

```text
allowed (hot path):
- .sliceui/**
- design input
- generated component target
- owning module (ter-scope dari componentDir — lihat P0-2)

denied:
- repository-wide glob
- traversal source tree dari root
- pencarian source package
```

Instrumentasi wajib menghitung dan melaporkan:

```text
files read
bytes read
project files read di luar allowlist
glob operations
```

Test harus **gagal** jika hot path membaca di luar allowlist — diuji lewat spy pada adapter
filesystem, bukan dengan memeriksa log.

---

## 8. Yang Dihapus dari Plan Asli, dan Kenapa

### 8.1 Registry capability generik (§3.3) — DIHAPUS

`foundation/architecture.md` ADR-2 (LOCKED, council): *"no premature framework abstraction until
React proves the shared fields."* Plan asli §3.3 mendefinisikan `component-capabilities.json`
generik, tapi **seluruh contohnya `uii-*`/pilar**. Itu abstraksi berbentuk pilar yang menyamar
sebagai generik — persis yang diveto.

**Gantinya:** perluas `pilar-catalog.mjs` + `uii-profile.mjs` di `src/framework/angular/` (tempat
yang sudah benar). Untuk framework lain, tunggu ADR-2 terpenuhi.

### 8.2 Semantic IR penuh (§5) — DIKURANGI

Daftar 20 role (page-root, filter-row, table-toolbar, …) adalah taksonomi baru dengan cakupan
besar. Kerjakan **hanya** role yang menutup cacat nyata:

```text
table-toolbar / table-limit / table-search   ← §4.3 laporan (klasifikasi search)
table-footer-info / table-pagination          ← §4.4 laporan (alignment)
```

Role lain ditambahkan hanya ketika ada fixture yang gagal karenanya.

### 8.3 Snapshot testing (§16.4) — DITUNDA

Snapshot dari 6 artifact adalah biaya pemeliharaan tinggi sebelum ada angka yang menunjukkan
perlunya. Kerjakan setelah P0-1 memberi baseline.

### 8.4 Ekspektasi fixture tanpa bukti (§16.2) — DIKOREKSI

Plan asli menetapkan ekspektasi untuk fixture "Edit bill" (`checkboxColumn=true`,
`row auth.canUpdate=true`, dst) **tanpa XML-nya tersedia**. Ini persis pola yang baru kita
berantas: ekspektasi tanpa bukti desain. Kalau ditulis sebagai test, ia akan merah pada output
yang benar.

**Aturan pengganti:** ekspektasi fixture harus **diturunkan dari XML-nya**, bukan dari plan.
Saat ini hanya ada satu fixture ber-XML nyata:

```text
test/fixtures/mahasiswa-tarif/raw.xml        ← ADA (ekspor asli)
test/mahasiswa-tarif.test.mjs                ← ADA (6 test: root padding, required,
                                                icon sync, variantName no-leak,
                                                paginationAlign evidence, containerPadding)
```

Fixture lain ditambahkan **hanya bersama XML aslinya**. Dilarang menulis ekspektasi fixture dari
ingatan atau dari dokumen.

---

## 9. Test Plan (Revisi)

### 9.1 Test yang sudah ada dan harus tetap hijau

Baseline 2026-09-24: **35 file, 351 test, 348 pass / 3 skip** (skip = pilar mount + catalog
roundtrip, butuh `PILAR_CHECKOUT`). Angka ini adalah garis dasar; setiap PR tidak boleh
menurunkannya.

### 9.2 Test baru per pekerjaan P0

| Pekerjaan | Test |
| :--- | :--- |
| P0-1 Instrumentasi | Adapter FS di-spy; hot path membaca 0 file di luar allowlist |
| P0-2 Verify scope | `readOwningModules` hanya membaca module pada/di atas `componentDir`; tanpa `componentDir` → skip + diagnostic |
| P0-3 Freshness | `detect` dua kali berturut-turut tanpa perubahan → run kedua tidak melakukan glob |
| P0-4 Budget | Capability tak terpakai dibuang; style block tak terpakai dibuang; **exact text tidak pernah dibuang** |
| P0-5 §5.1 | Koordinat canvas tidak muncul sebagai margin/padding/absolute |
| P0-5 §5.2 | Wrapper/max-width/shadow tanpa provenance → warn |
| P0-5 §5.5 | `OnDestroy` tanpa cleanup, unused import → warn |

### 9.3 Aturan test (dari R6)

Setiap check baru/berubah mendarat bersama test-nya di commit yang sama. Test diperbaiki
berdasarkan fixture XML nyata, bukan ekspektasi yang ditulis di dokumen ini.

---

## 10. Benchmark (Revisi §17)

Target absolut berbasis waktu **dilarang** di CI (flaky). Gunakan relatif:

```text
hot path baru <= 25% dari baseline median lama
```

Metrik yang dilaporkan: wall-clock, files read, bytes read, glob count, context characters,
cache hit rate, peak memory.

**Target P0 setelah index fresh:**

```text
project files read di luar allowlist per slice      = 0
raw source examples dimuat ke context              = 0
unused capabilities di spec                        = 0
unused style blocks di spec                        = 0
glob operations di hot path                        = 0
```

Target praktis: `transcribe + resolve + spec` untuk fixture XML selesai dalam hitungan detik,
tanpa network dan tanpa model call. Untuk XML, ini **sudah** benar — benchmark ada untuk
membuktikannya, bukan untuk memperbaikinya.

---

## 11. Acceptance Criteria (Revisi §18)

### P0

- [ ] `--profile` dan `--json-report` tersedia dan melaporkan files/bytes/globs/context size.
- [ ] `benchmarks/baseline.json` ada, diambil **sebelum** perubahan behavior.
- [ ] `verify` hanya membaca owning module yang ter-scope, bukan traversal root.
- [ ] `declaredInModule` tetap hidup (tidak berubah menjadi `skip` permanen) — **penjaga R1**.
- [ ] `detect` tidak mengulang scan mahal bila tidak ada perubahan relevan (atau SKILL.md
      menyatakan langkah itu tidak perlu).
- [ ] Spec hanya memuat capability & style block yang dipakai desain.
- [ ] Exact text dan layout facts **tidak pernah** dibuang oleh pruning.
- [ ] Koordinat canvas tidak pernah menjadi CSS layout.
- [ ] Wrapper/max-width/shadow tanpa provenance → warn dengan diagnostic actionable.
- [ ] Fixture `mahasiswa-tarif` lulus, dan test-nya tetap diturunkan dari XML-nya.
- [ ] Seluruh test lama tetap hijau (≥348 pass).

### P1

- [ ] Modal evidence classifier.
- [ ] Dead-code lint (unused import/injection/lifecycle).
- [ ] Hash lock untuk style block `locked`.
- [ ] Icon registry dengan provenance per-keputusan.
- [ ] Semantic IR diperluas **hanya** untuk role yang menutup fixture gagal.

### P2 (hanya jika angka P0 membenarkannya)

- [ ] Freshness fingerprint penuh dengan dependency graph.
- [ ] Cache content-addressed.
- [ ] Snapshot test lengkap.
- [ ] Visual regression.

---

## 12. Urutan PR (Revisi §20)

Plan asli: PR1 profiling → PR2–5 compiler → PR6 verify → PR7 refresh → PR8 docs.

Revisi membalik arahnya:

```text
PR 1  Instrumentasi + baseline benchmark           (P0-1)
PR 2  Verify read-scope fix                        (P0-2)
PR 3  Freshness detect (SKILL.md atau fingerprint) (P0-3)
PR 4  Context budget + pruning                     (P0-4)
PR 5  Fidelity fixes: canvas position, wrapper     (P0-5 §5.1, §5.2)
PR 6  Dead-code lint                               (P0-5 §5.5)
PR 7  Dokumentasi + migration note
--- hanya jika PR 1–6 menunjukkan kebutuhan terukur ---
PR 8+ Registry/IR/cache (dengan ADR-2 dipatuhi)
```

Setiap PR kecil, testable, dan dapat direview mandiri.

---

## 13. Definition of Done (Revisi §19)

1. Seluruh P0 acceptance criteria lulus.
2. Test lama tetap hijau (≥348 pass / 3 skip) atau perubahan behavior didokumentasikan.
3. `benchmarks/baseline.json` ada dan perbandingan before/after terlihat lewat `--profile`.
4. Context size turun dan **terukur**.
5. Fixture XML nyata menghasilkan resolved intent yang benar.
6. `verify` memberi diagnostic actionable untuk intentional-failure fixture.
7. Dokumentasi diperbarui: `SLICEUI-OVERVIEW.md`, `skill/SKILL.md`, CLI help, changelog.
8. **Tidak ada check yang berubah menjadi `skip` permanen** sebagai efek samping penghematan
   performa (penjaga R1).
9. Tidak ada silent fallback ke repository search.
10. `verify` tetap blocking dan tidak pernah green tanpa ground truth.

---

## 14. Analisis Biaya: Berapa Cepat yang Realistis?

> Bagian ini ada supaya tidak ada agent yang menargetkan "slice 5 menit" tanpa tahu dari mana
> angkanya. Semua baseline di sini berasal dari `docs/archive/SLICEUI-EXPERIENCE-REPORT-2.md`
> (satu sesi lapangan, ±36 menit 10 detik untuk satu komponen) — **satu sampel, bukan rata-rata**,
> dan angka itu diambil **sebelum** beberapa perbaikan mendarat.

### 14.1 Pemecahan 36 menit, dengan status terhadap kode hari ini

| Aktivitas | Waktu | Status | Pemilik |
| :--- | :--- | :--- | :--- |
| detect / transcribe / baca transcript + project-context | 3–4 mnt | ⚠️ sebagian bisa dipotong (P0-4) | SliceUI |
| Reverse-engineer wiring `uii-table` / `ngx-select` dari `node_modules` | **8–10 mnt** | ✅ **sudah beres** — `pilar-reference.md` terindeks (`init.mjs:161`) | SliceUI |
| Tulis `.ts` / `.html` / `.scss` | 4–5 mnt | ❌ di luar jangkauan | **model** |
| `ng build` + perbaikan budget | 4–5 mnt | ❌ di luar jangkauan | **proyek** |
| Melawan false-positive `verify.styleFidelity` | **15–20 mnt** | ✅ **sudah beres** — commit `3769cf1` | SliceUI |

**Bacaan kunci:** dua pos terbesar (total **23–30 menit**) sudah hilang **sebelum plan ini
ditulis** — bukan oleh plan ini, tapi oleh kerja yang sudah mendarat (indexing pilar + perbaikan
false-positive). Yang tersisa ~11–14 menit adalah tulis + build, yang **tidak bisa disentuh
SliceUI**.

### 14.2 Lantai yang tidak bisa dilewati

```text
tulis kode      4–5 mnt   ← model menulis file
ng build        4–5 mnt   ← waktu build proyek
────────────────────────
lantai          8–10 mnt  ← sebelum membaca/gate ikut dihitung
```

Target "regular 5 menit" **tidak tercapai** oleh plan jenis apa pun: tulis + build saja sudah
9 menit. Untuk menembusnya harus menyerang **kecepatan build** dan **jumlah kode yang ditulis** —
dua hal di luar arsitektur SliceUI.

### 14.3 Dua definisi "waktu slicing" — dua jawaban berbeda

| Definisi | Sebelum | Sesudah plan | Verdict |
| :--- | :--- | :--- | :--- |
| **Porsi yang dikendalikan SliceUI** (baca + wiring + gate) | 3,5 + 9 + 17,5 = **30 mnt** | 2 + 2 + 1 = **~5 mnt** | ✅ target tercapai |
| **Wall-clock total slice** (termasuk tulis + build) | **36 mnt** | 2 + 2 + 4,5 + 4,5 + 1 = **~14 mnt** | ⚠️ turun ~60%, bukan 5 |

Jawabannya bergantung definisi. **Porsi SliceUI bisa ~5 menit; total slice tidak.**

### 14.4 Sumbangan nyata plan ini

| Pekerjaan | Efek waktu | Efek token |
| :--- | :--- | :--- |
| P0-2 verify read-scope | Detik (kecuali monorepo sangat besar) | Tidak ada |
| P0-3 freshness `detect` | <10 detik/slice (5 glob dihindari) | Tidak ada |
| **P0-4 context budget** | Kecil | **Besar** — `pilar-reference.md` (54KB) + `pilar-showcase.md` (184KB) ≈ **60k token** bila dibaca utuh |
| P0-5 fidelity fixes | Tidak ada | Tidak ada |

**Kesimpulan jujur:** klaim "lebih hemat token" **lebih bisa dipertahankan** daripada klaim
"lebih cepat". Untuk waktu, plan ini memindahkan pekerjaan dari *gate* ke *index* — dan
pemindahan itu sebagian besar sudah terjadi.

### 14.5 Cara mendapat angka nyata (bukan sampel)

`sliceui timing` **sudah ada** dan mengukur persis ini — jangan menebak:

```bash
sliceui timing      # membaca .sliceui/runs.jsonl
```

Melaporkan: wall-clock per tahap, **generate gap** (dari `resolve` terakhir ke `verify` pertama =
kerja model itu sendiri), dan **jumlah retry verify**. Ini memisahkan tiga hal yang sering
tercampur:

```text
waktu CLI        → yang dibahas plan ini
waktu model      → tulis kode + penalaran (di luar jangkauan)
loop gate        → retry verify (target P0-2/P0-5)
```

**Aturan sebelum menginvestasikan PR 1–7:** jalankan `sliceui timing` pada 2–3 slice nyata dan
lihat distribusinya. Angka 36 menit di atas adalah satu sesi; target harus ditetapkan dari
distribusi, bukan dari satu observasi.

### 14.6 Dampak ke Acceptance Criteria (§11)

- **Tetapkan target dalam porsi SliceUI, bukan wall-clock total.** "Hot path CLI ≤ 25% baseline"
  (sudah ada di §10) adalah rumusan yang benar; "slice selesai < 5 menit" adalah rumusan yang
  gagal secara desain.
- **Jangan menargetkan waktu absolut di CI** — tetap relatif, seperti §10.
- **Token adalah metrik utama plan ini**, waktu adalah metrik sekunder.

---

## 15. Risiko & Pertanyaan Terbuka

| Risiko | Mitigasi |
| :--- | :--- |
| Instrumentasi menemukan bahwa performa **bukan** masalah, sehingga P0-3/P0-4 kehilangan pembenaran | Itu hasil yang sah. Hentikan pekerjaan struktural; kerjakan §5 (fidelity) saja. |
| Memperketat scope `verify` membuat `declaredInModule` skip di monorepo yang `componentDir`-nya ambigu | Fallback eksplisit + diagnostic, bukan traversal senyap. |
| Pruning context membuang fakta yang ternyata dibutuhkan | Aturan keras: exact text, layout facts, API names **tidak pernah** dibuang. |
| `ADR-2` menghalangi registry lintas-framework | Itu disengaja. Tunggu React membuktikan field-nya, lalu ekstrak dari diff yang benar-benar identik. |

**Pertanyaan terbuka:**

- Apakah `detect` perlu dijalankan ulang per slice pada monorepo besar, atau cukup di init?
  (Menentukan apakah P0-3 cukup lewat SKILL.md atau butuh fingerprint.)
- Berapa budget karakter yang benar untuk proyek UII dengan pilar-showcase 184KB? Butuh
  pengukuran dari proyek nyata, bukan tebakan.

---

## 16. Prinsip Akhir (Revisi §22)

```text
Repository knowledge is compiled once.          ← sudah berlaku (init/detect)
Design knowledge is parsed once per slice.      ← sudah berlaku (transcribe)
Generation uses compact trusted artifacts.      ← SEBAGIAN: context masih terlalu besar
Verification compares artifacts to output.      ← SEBAGIAN: verify masih traversal root
Repository search is explicit, observable, and exceptional.   ← TERBACA oleh --profile
```

Yang berubah dari plan asli bukan tujuannya — tujuannya sama dan benar. Yang berubah adalah
**di mana jaraknya**: bukan di arsitektur yang belum ada, tapi di tiga lubang yang sudah
teridentifikasi, dan di pembuktian yang belum pernah dilakukan.

Ukur dulu. Perbaiki tiga lubang itu. Baru pertimbangkan struktur baru.
