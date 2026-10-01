# SliceUI PR 2 Implementation Prompt: Snapshot Deduplication

Anda sedang bekerja pada repository SliceUI:

```text
/Users/bsi-2-2200019/Development/freelance/sliceui-skill
```

Project target nyata yang digunakan sebagai fixture validasi:

```text
/Users/bsi-2-2200019/Development/finance/lib-uii-gateway-bill-angular
```

Snapshot project target:

```text
/Users/bsi-2-2200019/Development/finance/lib-uii-gateway-bill-angular/.sliceui
```

Dokumen yang wajib dibaca sebelum implementasi:

```text
docs/SLICEUI-READ-PATH-CONTEXT-AUDIT.md
docs/SLICEUI-PR1-VERIFICATION-REPORT.md
```

Prompt dan laporan PR 1 bila tersedia:

```text
SLICEUI-PR1-AGENT-CONTEXT-REDUCTION-PROMPT.md
docs/SLICEUI-PR1-VERIFICATION-REPORT.md
```

## 1. Mandatory Entry Gate

Sebelum mengubah source, baca laporan verifikasi PR 1 dan temukan keputusan eksplisit:

```text
PR 1: PASS / CONDITIONAL PASS / FAIL
PR 2 may start: YES / NO
```

Aturan:

1. Jika `PR 2 may start: NO`, hentikan pekerjaan.
2. Jika PR 1 berstatus `FAIL`, hentikan pekerjaan.
3. Jika PR 1 berstatus `CONDITIONAL PASS`, lanjutkan hanya jika laporan secara eksplisit menyatakan PR 2 boleh dimulai dan tidak ada blocking finding yang terkait format snapshot.
4. Jika laporan tidak memiliki keputusan yang jelas, hentikan pekerjaan dan laporkan ambiguity.
5. Jangan memperbaiki temuan PR 1 dalam task ini.
6. Catat decision gate dan evidence-nya pada respons akhir.

## 2. Tujuan PR 2

Implementasikan deduplikasi snapshot `.sliceui` dengan perubahan minimal dan backward-compatible.

Audit telah membuktikan dua duplikasi utama:

1. `loadedClassRegistry` tersimpan byte-identical pada:

```text
project-context.json.loadedClassRegistry
conventions.json.loadedClassRegistry
```

2. Data conventions tersimpan byte-identical atau ekuivalen pada:

```text
project-context.json.conventions
conventions.json
```

Target source-of-truth setelah PR 2:

```text
project-context.json
→ framework, project paths, package/library summary, capability summary,
  sample references, design tokens, snapshot metadata

conventions.json
→ loadedClassRegistry, classVocabulary, ngDeepCorpus,
  anatomy rules, naming rules, convention facts,
  convention profile and provenance
```

`project-context.json` tidak lagi menyimpan:

```text
loadedClassRegistry
conventions
```

Tujuan utama:

- menghapus exact duplicate blobs;
- menetapkan satu machine authority per fakta;
- mengurangi ukuran snapshot;
- mempertahankan seluruh kemampuan CLI, skill, verifier, dan artifact generation;
- tetap dapat membaca snapshot lama;
- tidak mengubah kualitas atau semantics slicing;
- tidak memperluas pekerjaan ke PR 3.

## 3. Scope yang Diizinkan

PR ini mencakup:

1. Mengaudit semua producer dan consumer `project-context.json` dan `conventions.json`.
2. Menghapus penulisan `loadedClassRegistry` dari `project-context.json`.
3. Menghapus penulisan nested `conventions` dari `project-context.json`.
4. Menetapkan `conventions.json` sebagai pemilik tunggal data tersebut.
5. Mengadaptasi reader agar menggunakan canonical owner.
6. Menyediakan compatibility reader untuk snapshot lama.
7. Menambahkan schema version atau snapshot metadata bila diperlukan.
8. Menambahkan migration-on-read atau normalization in-memory bila benar-benar diperlukan.
9. Menambahkan tests untuk snapshot baru dan lama.
10. Mengukur pengurangan bytes, characters, dan estimated tokens.
11. Menyinkronkan dokumentasi source-of-truth yang langsung terdampak.

## 4. Di Luar Scope

Jangan mengimplementasikan:

- pemindahan `referee` full scan dari hot path;
- `referee --deep`;
- command `refresh` baru;
- filesystem interception atau redesign `fs-trace`;
- perbaikan PascalCase pada `verify`;
- perubahan algoritma `resolve`;
- confidence/provenance baru untuk resolved decisions;
- visual verification;
- render verification;
- perubahan FIGML parser;
- redesign penuh `.sliceui` folder;
- perubahan nama command;
- perubahan positional arguments CLI;
- capability pruning baru di luar PR 1;
- perubahan behavior `agent-context.md` kecuali reader harus disesuaikan dengan canonical snapshot;
- dependency baru tanpa kebutuhan mutlak;
- unrelated cleanup atau refactor;
- perubahan output generated Angular component.

Jika menemukan defect lain, dokumentasikan sebagai deferred finding. Jangan memperluas scope.

## 5. Prinsip Utama

1. Satu fakta memiliki satu canonical machine owner.
2. Projection human-readable boleh tetap ada jika memiliki fungsi jelas.
3. PR ini menghapus duplicate storage, bukan menghapus data.
4. Snapshot lama harus tetap dapat dibaca.
5. Snapshot baru tidak boleh menulis duplicate fields kembali.
6. Reader internal tidak boleh bergantung pada duplicate fallback setelah snapshot baru dibuat.
7. Compatibility logic harus terpusat, bukan tersebar di banyak command.
8. Jangan diam-diam melakukan repository scan jika canonical data hilang.
9. Missing canonical data harus menghasilkan diagnostic jelas atau fallback snapshot lama yang terkontrol.
10. Jangan mencampur migration dengan PR 3.
11. Pertahankan minimal-change principle.

## 6. Target Source-of-Truth Contract

Setelah PR 2, gunakan kontrak berikut.

### `project-context.json`

Boleh memiliki data seperti:

```text
schemaVersion
snapshotVersion
generatedAt
inputHash
framework
frameworkVersion
projectRoot metadata
componentDir
componentPrefix
package/library detection
capabilities summary
designTokens
sampleComponents
context index pointers
snapshot references
```

Tidak boleh memiliki:

```text
loadedClassRegistry
conventions
ngDeepCorpus
classVocabulary
full convention anatomy
full convention naming rules
```

### `conventions.json`

Menjadi canonical owner untuk:

```text
schemaVersion
snapshotVersion
generatedAt
inputHash
profile
loadedClassRegistry
classVocabulary
ngDeepCorpus
anatomy
naming
reusable convention facts
provenance required by current implementation
```

Gunakan field aktual repository. Jangan mengarang field jika tidak diperlukan.

### Human-readable projections

File berikut boleh tetap ada:

```text
conventions.md
context/INDEX.md
context/capabilities.md
context/design-tokens.md
context/samples.md
```

Mereka adalah projection atau index, bukan canonical machine source.

### Design-scoped PR 1 artifacts

Pertahankan:

```text
agent-context.md
context-manifest.json
spec.md
resolved.json
transcript.json
transcript.md
```

Jangan mengubah semantics-nya.

## 7. Audit Consumer Wajib

Sebelum implementasi, cari seluruh akses terhadap:

```text
loadedClassRegistry
projectContext.conventions
project-context.json
conventions.json
```

Gunakan minimal:

```bash
rg -n "loadedClassRegistry|\.conventions\b|project-context\.json|conventions\.json" src test skill scripts docs README.md
```

Untuk setiap consumer, klasifikasikan:

```text
writer
canonical reader
legacy reader
agent-facing reader
verify reader
referee reader
spec/context reader
test fixture
documentation only
```

Buat call-chain note sebelum perubahan, minimal untuk:

```text
init
detect
transcribe
resolve
spec
referee
verify
agent-context builder
handoff workflow
```

Periksa secara khusus file yang kemungkinan relevan:

```text
src/commands/init.mjs
src/commands/detect.mjs
src/commands/transcribe.mjs
src/commands/resolve.mjs
src/commands/spec.mjs
src/commands/referee.mjs
src/commands/verify.mjs
src/framework/angular/verify.mjs
src/framework/angular/conventions.mjs
src/lib/agent-context.mjs
src/lib/referee.mjs
src/lib/parse-json.mjs
skill/SKILL.md
skill/handoff/SKILL.md
```

Jangan mengubah semua file tersebut secara otomatis. Hanya ubah consumer yang benar-benar terdampak.

## 8. Implementasi yang Direkomendasikan

### 8.1 Centralized snapshot normalization

Jika repository belum memiliki loader terpusat, buat helper kecil dan terfokus untuk memuat serta menormalisasi snapshot, misalnya secara konseptual:

```text
loadProjectSnapshot()
loadConventionsSnapshot()
normalizeLegacySnapshot()
getLoadedClassRegistry()
getConventionFacts()
```

Nama aktual harus mengikuti convention repository.

Jangan membuat abstraction besar yang tidak diperlukan.

Tujuan helper:

- snapshot baru membaca data dari `conventions.json`;
- snapshot lama masih dapat menggunakan fallback data dari `project-context.json` bila canonical artifact belum memiliki data;
- consumer tidak perlu mengetahui perbedaan format lama dan baru;
- tidak ada repository scan sebagai fallback;
- conflict antara dua copy terdeteksi, bukan dipilih diam-diam.

### 8.2 New snapshot writing

Pada `init`/`detect` atau writer terkait:

- tulis `loadedClassRegistry` hanya ke `conventions.json`;
- tulis conventions body hanya ke `conventions.json`;
- jangan menulis duplicate fields ke `project-context.json`;
- bila ada metadata pointer, gunakan pointer kecil atau authority declaration, bukan duplicate data.

Contoh pointer konseptual, hanya jika benar-benar berguna:

```json
{
  "conventionsRef": "conventions.json"
}
```

Jangan menambah pointer jika seluruh consumer sudah mengetahui standard path dan pointer tidak memberi nilai.

### 8.3 Legacy compatibility

Snapshot lama dapat memiliki:

```text
project-context.json.loadedClassRegistry
project-context.json.conventions
```

Compatibility policy:

1. Prefer canonical `conventions.json` jika field tersedia.
2. Jika canonical field hilang dan legacy field tersedia, gunakan legacy field in-memory.
3. Emit warning hanya jika command memiliki diagnostic channel yang sesuai dan warning tidak merusak machine output.
4. Jangan menulis ulang snapshot lama secara otomatis pada read.
5. Jangan menghapus legacy file.
6. Jangan melakukan live repository scan sebagai fallback.
7. Jika canonical dan legacy field sama, gunakan canonical tanpa warning keras.
8. Jika canonical dan legacy field conflict, jangan diam-diam memilih. Gunakan deterministic policy dan diagnostic.

Conflict policy yang direkomendasikan:

```text
canonical conventions.json wins
+ emit stale/conflict diagnostic
+ suggest re-running init/detect in a future explicit workflow
```

Jangan menjalankan refresh otomatis.

### 8.4 Schema version

Jika current artifacts belum mempunyai schema version yang cukup, tambahkan versi minimal dan backward-compatible.

Contoh konseptual:

```json
{
  "schemaVersion": 2
}
```

Persyaratan:

- reader menerima artifact tanpa `schemaVersion` sebagai legacy schema;
- writer baru menulis versi baru;
- version check memiliki test;
- unknown future schema tidak diproses secara berbahaya;
- jangan membuat migration framework besar.

Jika existing versioning sudah cukup, gunakan yang ada dan jangan menambah field baru.

## 9. Consumer Behavior yang Harus Dipertahankan

### Verify

Verifier harus tetap mendapatkan:

```text
loadedClassRegistry
class vocabulary
convention corpus
transcript/raw XML ground truth
project framework context
```

Namun sumber canonical loaded classes dan conventions harus `conventions.json`.

Acceptance:

- loaded-class checks tidak hilang;
- class vocabulary checks tidak hilang;
- SCSS coverage checks tidak hilang;
- no silent skip karena data pindah;
- verify output lama tetap konsisten untuk fixture yang sama.

### Resolve dan Spec

Tetap membaca snapshot conventions yang sama seperti sebelumnya.

Acceptance:

- `resolved.json` tidak berubah untuk fixture yang sama;
- `spec.md` tetap byte-identical bila data canonical sama;
- `agent-context.md` dan `context-manifest.json` PR 1 tetap konsisten;
- capability/style selection tidak berubah hanya karena data dipindahkan.

### Referee

PR ini tidak memindahkan scan referee.

Namun, jika referee membaca `project-context.json.conventions`, arahkan ke canonical loader tanpa mengubah scan behavior.

### Transcribe

Staleness check tetap berfungsi dan tidak memerlukan duplicate blobs.

### Skill dan Handoff

Primary skill PR 1 sudah seharusnya tidak membaca `conventions.json` secara default untuk generation.

Pastikan perubahan PR 2 tidak membuat agent kembali membaca machine JSON penuh.

Handoff mode hanya diubah jika benar-benar mempunyai dependency langsung terhadap lokasi data lama.

## 10. Snapshot Size Measurement

Sebelum perubahan, ukur snapshot fixture nyata secara read-only:

```text
project-context.json bytes
project-context.json characters
project-context.json estimated tokens
conventions.json bytes
conventions.json characters
conventions.json estimated tokens
combined bytes
combined estimated tokens
```

Formula:

```text
estimatedTokens = ceil(characterCount / 4)
```

Setelah implementasi, generate snapshot baru pada temporary project/copy dan ukur ulang.

Laporan akhir harus membedakan:

```text
total stored size
removable duplicate size
agent context size
```

Jangan menyatakan total storage sebagai token aktual yang dikirim ke model.

Target berdasarkan audit, tetapi harus direproduksi:

```text
project-context.json reduction ≈ 333 KB
removable duplicate estimate ≈ 83k tokens
```

Angka aktual boleh berbeda. Laporkan hasil nyata.

## 11. Temporary Validation Environment

Jangan menjalankan `init` atau `detect --force` langsung pada project target nyata.

Gunakan temporary copy:

```bash
TMP_ROOT="/tmp/sliceui-pr2-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$TMP_ROOT"
```

Salin fixture/project yang diperlukan dengan quoting benar.

Jika copy seluruh project terlalu berat, gunakan test fixture yang merepresentasikan:

- loaded class registry;
- conventions extraction;
- project context output;
- snapshot readers;
- verify consumer.

Untuk pengukuran real fixture, copy `.sliceui` dan metadata minimal yang diperlukan. Jangan menimpa `.sliceui` nyata.

## 12. Tests Wajib

Tambahkan tests terfokus. Reuse fixtures existing bila memungkinkan.

### 12.1 New snapshot writer

Given project detection output,
when new snapshot ditulis,
then:

- `project-context.json` tidak memiliki `loadedClassRegistry`;
- `project-context.json` tidak memiliki nested `conventions`;
- `conventions.json` memiliki canonical `loadedClassRegistry`;
- `conventions.json` memiliki convention facts yang diperlukan;
- metadata/version valid.

### 12.2 New snapshot readers

Untuk snapshot baru:

- verify mendapatkan loaded classes dari canonical file;
- resolve/spec mendapatkan conventions;
- agent-context builder tetap bekerja;
- no fallback legacy path digunakan;
- no repository scan dipicu.

### 12.3 Legacy snapshot compatibility

Buat fixture legacy dengan data hanya pada lokasi lama bila diperlukan.

Pastikan:

- reader masih bekerja;
- output semantik tetap benar;
- tidak menulis ulang artifact pada read;
- tidak scan repository;
- warning/diagnostic sesuai policy.

### 12.4 Mixed snapshot compatibility

Snapshot memiliki canonical dan legacy copy yang identik:

- canonical dipilih;
- behavior stabil;
- tidak ada duplicate merge;
- tidak ada output ganda.

### 12.5 Conflict detection

Snapshot memiliki canonical dan legacy values berbeda:

- conflict terdeteksi;
- canonical policy diterapkan;
- diagnostic tersedia;
- tidak silent.

### 12.6 Missing data

Jika kedua lokasi tidak memiliki loaded classes/conventions:

- command tidak crash dengan error tidak jelas;
- required gate tidak silently pass;
- diagnostic menjelaskan artifact yang hilang;
- tidak live-scan repository secara diam-diam.

### 12.7 Semantic non-regression

Untuk fixture yang sama, bandingkan sebelum/sesudah:

```text
resolved.json
spec.md
agent-context.md
context-manifest.json
verify result
```

Expected:

- `resolved.json` semantically identical;
- `spec.md` byte-identical bila timestamps tidak terlibat;
- agent context semantically identical;
- manifest hanya boleh berubah pada source metadata/schema bila diperlukan;
- verify findings sama.

### 12.8 Snapshot size regression

Test atau measurement harus membuktikan duplicate fields tidak kembali ditulis.

Jangan membuat test rapuh berdasarkan exact total byte seluruh JSON jika timestamp/order dapat berubah. Assert absence, canonical ownership, dan meaningful size reduction.

### 12.9 Skill contract

Pastikan primary skill tetap:

- tidak membaca `conventions.json` untuk normal generation;
- menggunakan `agent-context.md` + `spec.md`;
- tidak kembali ke full machine context setelah dedup.

## 13. Relevant Test Suite

Jalankan minimal:

```bash
node --test test/init.test.mjs
node --test test/detect.test.mjs
node --test test/detect-context-files.test.mjs
node --test test/conventions.test.mjs
node --test test/conventions-generated.test.mjs
node --test test/resolve.test.mjs
node --test test/spec.test.mjs
node --test test/agent-context.test.mjs
node --test test/verify.test.mjs
node --test test/verify-root.test.mjs
node --test test/referee.test.mjs
```

Jalankan combined relevant suite, lalu:

```bash
npm test
```

Catat pass/fail/skip dan duration.

Jangan menyatakan lulus bila command belum dijalankan.

## 14. Smoke Validation

Pada temporary fixture:

1. Generate snapshot baru melalui supported command.
2. Periksa `project-context.json` dan `conventions.json`.
3. Jalankan `transcribe` pada fixture sederhana bila diperlukan.
4. Jalankan `resolve`.
5. Jalankan `spec`.
6. Periksa PR 1 artifacts.
7. Jalankan `verify` pada known fixture menggunakan naming yang didukung.
8. Bandingkan output dengan baseline.

PR ini tidak wajib melakukan AI generation baru karena tidak mengubah agent context semantics. Namun, `agent-context.md` yang dihasilkan harus dibandingkan dengan output PR 1 sebelumnya.

Gunakan normalization bila hanya `generatedAt`, path temporary, atau schema metadata yang berbeda. Dokumentasikan normalization.

## 15. Diagnostics

Gunakan diagnostic yang jelas dan tidak menyesatkan.

Contoh konseptual:

```text
SUI-SNAPSHOT-001: Missing canonical conventions snapshot.
Expected: .sliceui/conventions.json
Legacy fallback: available/unavailable
Repository scan: not attempted
```

```text
SUI-SNAPSHOT-002: Canonical and legacy convention data conflict.
Canonical source: .sliceui/conventions.json
Legacy source: .sliceui/project-context.json.conventions
Resolution: canonical source selected
Recommended action: regenerate project snapshot
```

Ikuti diagnostic style repository jika sudah ada. Jangan menciptakan framework diagnostic baru untuk dua message saja jika cukup menggunakan existing mechanism.

## 16. Acceptance Criteria

PR 2 selesai hanya jika:

- [ ] Entry gate dari laporan PR 1 mengizinkan PR 2.
- [ ] Semua producer/consumer duplicate fields telah diaudit.
- [ ] Snapshot baru tidak menulis `project-context.json.loadedClassRegistry`.
- [ ] Snapshot baru tidak menulis `project-context.json.conventions`.
- [ ] `conventions.json` menjadi canonical owner.
- [ ] Verify tetap mendapatkan loaded class registry.
- [ ] Resolve/spec tetap mendapatkan convention corpus.
- [ ] Agent-context PR 1 tetap berfungsi.
- [ ] Snapshot lama tetap dapat dibaca.
- [ ] Snapshot mixed identik tetap stabil.
- [ ] Snapshot conflict menghasilkan diagnostic.
- [ ] Missing data tidak silent-pass.
- [ ] Tidak ada repository scan baru.
- [ ] Tidak ada perubahan command arguments.
- [ ] `spec.md` tidak berubah secara material.
- [ ] `resolved.json` tidak berubah secara material.
- [ ] Verify findings tidak berubah untuk fixture yang sama.
- [ ] Project context size turun signifikan.
- [ ] Ukuran dan estimated-token reduction diukur, bukan diasumsikan.
- [ ] Existing relevant tests lulus.
- [ ] Full suite lulus, selain known pre-existing skips.
- [ ] Dokumentasi source-of-truth sinkron.
- [ ] Tidak ada perubahan di luar scope.

## 17. Dokumentasi

Update hanya active documentation yang terdampak langsung.

Kemungkinan file:

```text
README.md
docs/SLICEUI-OVERVIEW.md
docs/project-docs/foundation/architecture.md
docs/project-docs/foundation/workflow.md
docs/project-docs/development/api-contract.md
skill/SKILL.md
```

Jangan mengubah semua file secara otomatis. Cari owning documentation.

Dokumentasikan satu kali secara authoritative:

```text
project-context.json ownership
conventions.json ownership
legacy compatibility policy
schema/version policy
agent-facing vs machine-only artifacts
```

Jangan mengubah docs archive.

Documentation sync wajib dinyatakan pada respons akhir.

## 18. Git dan Safety Rules

Sebelum mulai:

```bash
git status --short
git rev-parse HEAD
node --version
npm --version
```

Catat existing user changes.

Jangan menjalankan:

```text
git reset --hard
git clean -fd
git checkout -- .
git restore .
npm update
auto-format seluruh repository
```

Jangan menghapus prompt, audit report, verification report, atau file untracked milik user.

Jangan commit kecuali pengguna secara eksplisit meminta.

Jika working tree PR 1 belum committed, pertahankan perubahan tersebut dan buat daftar jelas file PR 2 versus file pre-existing.

## 19. Tahapan Kerja

### Tahap 1: Gate and inspect

- baca PR 1 verification report;
- putuskan apakah boleh lanjut;
- audit producer/consumer;
- catat source-of-truth aktual.

### Tahap 2: Baseline measurements

- ukur snapshot nyata;
- catat duplicate sizes;
- simpan hashes baseline;
- jangan memodifikasi project nyata.

### Tahap 3: Design minimal compatibility layer

Sebelum coding, tulis implementation note singkat pada respons kerja:

- canonical owner;
- fields removed;
- legacy fallback;
- conflict policy;
- files yang akan diubah;
- tests yang akan ditambah.

Tidak perlu meminta confirmation jika tetap dalam scope.

### Tahap 4: Implement writer changes

- stop duplicate writes;
- preserve existing data in canonical file;
- version if needed.

### Tahap 5: Implement centralized readers

- new snapshot canonical path;
- legacy fallback;
- conflict diagnostic;
- no repository scan.

### Tahap 6: Update consumers minimally

- verify;
- resolve/spec only if needed;
- agent-context builder only if needed;
- referee only if it directly reads legacy fields;
- no unrelated refactor.

### Tahap 7: Tests

- focused tests;
- relevant combined suite;
- full suite.

### Tahap 8: Temporary smoke validation

- generate new snapshot;
- compare outputs;
- measure size reduction.

### Tahap 9: Documentation sync

- update owning docs only.

### Tahap 10: Final review

- inspect diff;
- confirm no PR 3 work;
- confirm no source scan fallback;
- confirm source-of-truth consistency.

## 20. Required Final Response

Berikan respons akhir dengan struktur:

### Entry Gate

```text
PR 1 verification decision: ...
PR 2 authorized: yes/no
Evidence: docs/SLICEUI-PR1-VERIFICATION-REPORT.md section ...
```

### Summary

Jelaskan perubahan PR 2 secara singkat.

### Files Changed

Kelompokkan:

```text
PR 2 source changes
PR 2 tests
PR 2 documentation
Pre-existing PR 1/untracked files not modified
```

### Source-of-Truth After PR 2

Jelaskan ownership final.

### Backward Compatibility

Jelaskan:

- legacy snapshot;
- mixed snapshot;
- conflict snapshot;
- missing data behavior.

### Snapshot Reduction Results

Gunakan format:

```text
Before project-context bytes       : ...
After project-context bytes        : ...
Reduction bytes                    : ...
Reduction percent                  : ...
Before combined snapshot bytes     : ...
After combined snapshot bytes      : ...
Removable duplicate characters     : ...
Estimated duplicate tokens removed : ...
```

Label estimated tokens sebagai estimasi.

### Semantic Non-Regression

Laporkan comparison:

```text
resolved.json      : identical / normalized equivalent / changed
spec.md            : byte-identical / normalized equivalent / changed
agent-context.md   : identical / normalized equivalent / changed
context manifest  : identical / expected metadata change / changed
verify findings   : identical / changed
```

Jelaskan setiap perubahan.

### Validation

Daftar exact commands dan hasil:

```text
focused tests
combined tests
full npm test
smoke commands
```

### Deferred Findings

Jangan implementasikan, hanya sebutkan:

```text
PR 3 referee cold/hot separation
verify PascalCase normalization
fs-trace gap
resolve provenance/confidence
visual verification
```

### Known Limitations

Tuliskan limitation faktual.

### Documentation Sync

Gunakan:

```text
Documentation sync: clear.
```

jika sudah sinkron. Jika belum, sebutkan file yang masih stale.

### Git Status

Tampilkan:

```bash
git status --short
```

Jangan commit.

## 21. Definition of Done

Task selesai jika:

1. PR 1 gate mengizinkan pekerjaan.
2. Duplicate fields tidak lagi ditulis pada snapshot baru.
3. Canonical conventions owner jelas.
4. Legacy snapshots tetap bekerja.
5. Conflict tidak silent.
6. Missing data tidak silent-pass.
7. Snapshot size turun berdasarkan pengukuran nyata.
8. Pipeline outputs tidak mengalami semantic regression.
9. PR 1 agent context tetap valid.
10. Tests relevan dan full suite lulus.
11. Dokumentasi ownership sinkron.
12. Tidak ada pekerjaan PR 3 tercampur.
13. Tidak ada commit atau destructive Git operation.
14. Semua asumsi dan limitation dilaporkan.

Mulai dengan membaca laporan verifikasi PR 1. Jangan mengubah source sebelum entry gate terbukti mengizinkan PR 2. Setelah itu lakukan perubahan minimum untuk menghapus duplicate storage tanpa mengubah semantics slicing.
