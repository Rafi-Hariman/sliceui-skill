# SliceUI PR 2 Verification Plan for Claude Code

Anda sedang bekerja pada repository SliceUI:

```text
/Users/bsi-2-2200019/Development/freelance/sliceui-skill
```

Project target nyata yang hanya boleh digunakan sebagai sumber bukti read-only:

```text
/Users/bsi-2-2200019/Development/finance/lib-uii-gateway-bill-angular
```

Snapshot target nyata:

```text
/Users/bsi-2-2200019/Development/finance/lib-uii-gateway-bill-angular/.sliceui
```

Dokumen yang wajib dibaca:

```text
docs/SLICEUI-READ-PATH-CONTEXT-AUDIT.md
docs/SLICEUI-PR1-VERIFICATION-REPORT.md
SLICEUI-PR2-SNAPSHOT-DEDUPLICATION-PROMPT.md
```

Jika implementation prompt berada di lokasi berbeda, temukan file berdasarkan nama. Jangan mengubahnya.

## 1. Tujuan

Lakukan verifikasi independen terhadap implementasi PR 2 Snapshot Deduplication.

Verifikasi harus membuktikan atau membantah klaim berikut:

1. `project-context.json` baru tidak lagi menyimpan `loadedClassRegistry`.
2. `project-context.json` baru tidak lagi menyimpan nested `conventions`.
3. `conventions.json` menjadi canonical machine owner untuk data conventions dan loaded class registry.
4. Snapshot lama tetap dapat dibaca tanpa repository scan.
5. Snapshot canonical, legacy, mixed-identical, mixed-conflict, malformed, dan missing ditangani secara deterministik.
6. Verify tetap menerima registry dan corpus yang sama.
7. Resolve, spec, dan PR 1 agent context tidak mengalami semantic regression.
8. Tidak ada command argument atau artifact contract yang rusak.
9. Snapshot benar-benar menyusut berdasarkan pengukuran reproducible.
10. Tidak ada pekerjaan PR 3 yang masuk ke PR 2.
11. Tidak ada repository scan baru sebagai fallback.
12. Dokumentasi source-of-truth telah sinkron.
13. PR 2 layak ditutup sebelum PR 3 dimulai.

Verifikasi ini bukan implementation task.

## 2. Batas Scope dan Safety

Lakukan inspeksi, pengujian, pengukuran, dan tulis laporan.

Jangan:

- memperbaiki source code;
- mengubah tests;
- mengubah dokumentasi yang sudah ada;
- melakukan refactor;
- menjalankan formatter dalam write mode;
- melanjutkan PR 3;
- memindahkan referee scan;
- memperbaiki PascalCase verify;
- memperbaiki PR 1 findings;
- mengubah snapshot project target nyata;
- menjalankan `init`, `detect --force`, atau command penulis lain pada project target nyata;
- melakukan commit;
- menghapus file untracked milik user;
- memakai destructive Git commands;
- menyatakan PASS hanya berdasarkan jumlah test.

Satu-satunya file baru yang boleh dibuat di repository adalah:

```text
docs/SLICEUI-PR2-VERIFICATION-REPORT.md
```

Semua fixture sementara, generated snapshots, logs, diffs, dan measurements harus disimpan di luar repository, misalnya:

```text
/tmp/sliceui-pr2-verification-<timestamp>/
```

## 3. Keadaan Implementasi yang Dilaporkan

PR 2 dilaporkan menambah atau mengubah:

```text
src/lib/snapshot.mjs
src/commands/init.mjs
src/commands/detect.mjs
src/commands/verify.mjs
src/lib/referee.mjs
src/framework/angular/conventions.mjs
test/snapshot.test.mjs
test/init.test.mjs
docs/project-docs/development/api-contract.md
```

PR 2 mengklaim:

```text
project-context.json = WHAT
conventions.json     = HOW
```

Compatibility yang diklaim:

```text
canonical snapshot     → canonical conventions.json digunakan
legacy snapshot        → fallback dari project-context.json
mixed identical        → canonical digunakan tanpa conflict
mixed conflict         → canonical menang + diagnostic
missing data           → no crash, no repo scan, downstream gate skip
malformed data         → deterministic handling
```

Pengurangan yang diklaim pada fixture nyata:

```text
Before project-context bytes       : 476,039
After project-context bytes        : 17,742
Reduction bytes                    : 458,297
Reduction percent                  : 96.3%
Before combined snapshot bytes     : 928,628
After combined snapshot bytes      : 470,235
Estimated duplicate tokens removed : ~114,573
```

Jangan menerima klaim tersebut tanpa reproduksi.

## 4. Pertanyaan Keputusan Utama

Laporan wajib menjawab:

1. Apakah canonical ownership benar-benar tunggal?
2. Apakah writer baru tidak menulis duplicate blobs?
3. Apakah reader compatibility benar untuk seluruh bentuk snapshot?
4. Apakah conflict body conventions terdeteksi atau hanya registry yang dibandingkan?
5. Apakah missing data dapat menyebabkan verification skip yang terlalu permisif?
6. Apakah schema/version behavior aman untuk current, legacy, dan future schema?
7. Apakah verify memiliki data yang sama seperti sebelum PR 2?
8. Apakah outputs `resolved.json`, `spec.md`, `agent-context.md`, dan manifest tetap ekuivalen?
9. Apakah pengurangan 458,297 bytes benar, dan mengapa berbeda dari estimasi audit awal sekitar 333 KB?
10. Apakah source project atau real `.sliceui` berubah saat implementasi atau verifikasi?
11. Apakah PR 2 dapat ditutup?
12. Apakah PR 3 boleh dimulai?

## 5. Tahap 0: Baseline, Git Safety, dan Hashes

Jalankan dari root repository SliceUI:

```bash
git status --short
git rev-parse HEAD
node --version
npm --version
```

Catat semua perubahan pre-existing dan kelompokkan:

```text
PR 1 changes
PR 2 changes
prompt/report files
unknown changes
```

Buat temporary root:

```bash
TMP_ROOT="/tmp/sliceui-pr2-verification-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$TMP_ROOT"
```

Simpan hash awal seluruh file PR 2:

```bash
shasum -a 256 \
  src/lib/snapshot.mjs \
  src/commands/init.mjs \
  src/commands/detect.mjs \
  src/commands/verify.mjs \
  src/lib/referee.mjs \
  src/framework/angular/conventions.mjs \
  test/snapshot.test.mjs \
  test/init.test.mjs \
  docs/project-docs/development/api-contract.md
```

Jika ada file yang tidak tersedia, catat dan lanjutkan audit terhadap file aktual.

Jalankan status read-only pada project target nyata:

```bash
cd /Users/bsi-2-2200019/Development/finance/lib-uii-gateway-bill-angular
git status --short
```

Catat baseline agar dapat dibuktikan tidak berubah.

## 6. Tahap 1: Static Source Review

Audit lengkap file PR 2 dan seluruh call site relevan.

### 6.1 `splitProjectContext`

Periksa apakah fungsi:

- benar-benar menghapus hanya duplicate fields;
- tidak membuang project data lain;
- tidak mutate input secara tidak terduga;
- mempertahankan metadata yang dibutuhkan;
- deterministik;
- aman terhadap null, undefined, malformed, dan missing fields;
- tidak membaca filesystem atau repository;
- tidak mengubah nested references secara berbahaya.

Dokumentasikan input/output shape aktual.

### 6.2 `loadConventionsSnapshot`

Periksa:

- canonical path resolution;
- legacy fallback;
- canonical-first policy;
- registry merge/fill behavior;
- conventions body behavior;
- conflict detection;
- malformed JSON behavior;
- missing files behavior;
- unknown schema behavior;
- diagnostic output;
- whether files are rewritten on read;
- whether repository scan can occur;
- whether absolute/path traversal risk exists;
- whether loader is pure enough for tests.

Buat decision matrix aktual dari source, bukan dari summary implementasi.

### 6.3 Writer path

Trace:

```text
init → detectProject → split/write project-context → write conventions
standalone detect → split/write project-context → write conventions
```

Periksa bahwa `init` dan standalone `detect` menghasilkan shape yang sama secara semantik, termasuk golden-reference merge.

### 6.4 Consumer path

Trace minimal:

```text
verify
referee
resolve
spec
transcribe
agent-context builder
handoff workflow
```

Untuk setiap consumer, nyatakan:

- file yang dibaca;
- canonical/legacy behavior;
- apakah loader terpusat digunakan;
- apakah duplicate field masih dibaca langsung;
- apakah fallback dapat melakukan scan;
- apakah behavior berubah.

Gunakan:

```bash
rg -n "loadedClassRegistry|projectContext\.conventions|\.conventions\b|loadConventionsSnapshot|splitProjectContext|project-context\.json|conventions\.json" src test skill scripts docs README.md
```

Cari direct legacy reads yang tertinggal. Bedakan test fixture access dari production access.

### 6.5 Scope leakage

Pastikan PR 2 tidak mengimplementasikan:

- referee cold/hot split;
- `--deep`;
- filesystem interception;
- PascalCase normalization;
- resolve confidence;
- visual verification;
- unrelated generated-code behavior.

## 7. Tahap 2: Test Quality Review

Audit `test/snapshot.test.mjs` dan perubahan `test/init.test.mjs`.

Jangan hanya menghitung test. Nilai apakah tests benar-benar membuktikan:

1. New writer absence of duplicate fields.
2. Canonical loaded classes available.
3. Canonical conventions body available.
4. Legacy conventions fallback.
5. Legacy registry fallback.
6. Canonical fills missing pieces only according to explicit policy.
7. Mixed identical behavior.
8. Registry conflict diagnostic.
9. Conventions body conflict behavior.
10. Missing canonical and legacy behavior.
11. Malformed JSON behavior.
12. No repository scan fallback.
13. No rewrite-on-read.
14. Unknown future schema behavior.
15. No input mutation.
16. Golden references remain merged consistently.

Cari false confidence:

- test hanya memeriksa satu field;
- conflict test hanya registry tetapi summary mengklaim seluruh conventions;
- missing-data test menerima silent empty object;
- no-scan tidak benar-benar diinstrumentasi;
- legacy test tidak melalui command consumer nyata;
- tests menggunakan synthetic shape yang berbeda dari artifact nyata.

## 8. Tahap 3: Re-run Tests

Jalankan focused tests:

```bash
node --test test/snapshot.test.mjs
node --test test/init.test.mjs
```

Jalankan relevant combined suite:

```bash
node --test \
  test/snapshot.test.mjs \
  test/init.test.mjs \
  test/detect.test.mjs \
  test/detect-context-files.test.mjs \
  test/conventions.test.mjs \
  test/conventions-generated.test.mjs \
  test/resolve.test.mjs \
  test/spec.test.mjs \
  test/agent-context.test.mjs \
  test/verify.test.mjs \
  test/verify-root.test.mjs \
  test/referee.test.mjs
```

Jalankan full suite:

```bash
npm test
```

Jalankan syntax checks pada file source berubah:

```bash
node --check src/lib/snapshot.mjs
node --check src/commands/init.mjs
node --check src/commands/detect.mjs
node --check src/commands/verify.mjs
node --check src/lib/referee.mjs
node --check src/framework/angular/conventions.mjs
```

Catat exact pass/fail/skip, durations, warnings, dan environment-dependent tests.

Jangan memperbaiki failure.

## 9. Tahap 4: Build Snapshot Scenario Matrix

Buat fixture sementara realistis dari artifact nyata atau fixture representative.

Uji minimal skenario berikut secara terpisah:

### A. New canonical snapshot

```text
project-context.json tanpa loadedClassRegistry/conventions
conventions.json lengkap
```

Expected:

- canonical source digunakan;
- no fallback;
- no conflict;
- no repository scan;
- consumers mendapatkan full data.

### B. Legacy-only snapshot

```text
project-context.json memiliki loadedClassRegistry + conventions
conventions.json tidak ada
```

Expected:

- legacy source digunakan in-memory;
- no file rewrite;
- no repository scan;
- explicit source classification tersedia.

### C. Incomplete canonical + legacy fill

Contoh:

```text
conventions.json memiliki conventions body tetapi registry hilang
project-context.json memiliki registry
```

Expected harus sesuai documented policy. Pastikan tidak menghasilkan hybrid yang sulit diprovokasi atau conflict tersembunyi.

### D. Mixed identical

Canonical dan legacy copy identik.

Expected:

- canonical dipilih;
- no hard conflict;
- no duplicate merge;
- output stabil.

### E. Registry conflict

Canonical dan legacy loadedClassRegistry berbeda.

Expected:

- canonical menang;
- diagnostic muncul;
- conflict tidak silent;
- no repository scan.

### F. Conventions body conflict

Canonical dan legacy conventions body berbeda, registry sama.

Ini wajib diuji karena implementasi mengakui conflict detection hanya membandingkan registry.

Tentukan actual behavior:

- diagnostic ada atau tidak;
- canonical menang atau merge;
- risiko stale snapshot;
- apakah limitation dapat diterima untuk menutup PR 2.

### G. Missing both

Tidak ada canonical conventions dan tidak ada legacy data.

Periksa:

- loader output;
- diagnostic;
- verify behavior;
- apakah gate skip;
- apakah command dapat green karena data tidak ada;
- no repository scan.

Missing data tidak boleh menghasilkan false green untuk checks yang memerlukan ground truth.

### H. Malformed canonical JSON

Periksa apakah:

- error jelas;
- legacy fallback dilakukan atau tidak sesuai policy;
- corruption tidak disamarkan sebagai missing;
- no rewrite;
- no repo scan.

### I. Unknown future schema

Jika schema version tersedia, buat versi lebih tinggi dari supported.

Periksa safe behavior. Jika versioning tidak diimplementasikan, catat limitation tanpa menganggap defect otomatis.

## 10. Tahap 5: Reproduce Snapshot Writing End-to-End

Jangan menggunakan project target nyata.

Gunakan temporary copy dari fixture yang mendukung `detect --force` atau `init` secara aman.

Jalankan writer path end-to-end:

```text
standalone detect path
init path bila aman dan practical
```

Periksa kedua outputs:

```text
project-context.json
conventions.json
context/*.md
```

Validasi:

```bash
node -e "const fs=require('fs'); const p=JSON.parse(fs.readFileSync(process.argv[1],'utf8')); console.log(Object.keys(p))" <project-context>
node -e "const fs=require('fs'); const c=JSON.parse(fs.readFileSync(process.argv[1],'utf8')); console.log(Object.keys(c))" <conventions>
```

Pastikan:

- duplicate fields absent pada project context;
- canonical fields present pada conventions;
- JSON valid;
- init dan detect outputs equivalent;
- no accidental `.sliceui` dibuat di repository SliceUI;
- command executable yang digunakan adalah CLI repository yang sedang diverifikasi, bukan global/on-PATH binary yang berbeda.

Wajib catat binary/entrypoint exact command. Hindari command substitution atau quoting yang dapat mengeksekusi `sliceui` secara tidak sengaja.

## 11. Tahap 6: Independent Size Measurement

### 11.1 Real baseline

Ukur read-only artifact nyata:

```text
project-context bytes/chars
conventions bytes/chars
combined bytes/chars
```

### 11.2 Simulated split

Jalankan `splitProjectContext` terhadap copy artifact nyata di temporary directory.

Ukur:

```text
before project-context
simulated after project-context
canonical conventions unchanged
combined before
combined after
```

### 11.3 Generated fixture

Ukur output detect/init temporary fixture.

### 11.4 Arithmetic check

Verifikasi:

```text
reduction bytes = before project-context - after project-context
reduction percent = reduction / before * 100
combined after = after project-context + conventions bytes
estimated token reduction = ceil(removed characters / 4)
```

Jelaskan perbedaan terhadap audit awal:

- audit menemukan registry duplicate sekitar 264 KB;
- audit juga menemukan conventions duplicate sekitar 69 KB;
- implementation summary mengklaim sekitar 458 KB removed;
- tentukan field lain yang ikut terhapus atau perbedaan metode serialisasi;
- pastikan tidak ada data non-duplicate yang ikut hilang.

Buat top-level key size diff agar pengurangan 458 KB dapat dijelaskan secara exact.

Jangan menganggap ukuran token storage sama dengan context model aktual.

## 12. Tahap 7: Semantic Non-Regression

Gunakan fixture yang sama sebelum dan setelah dedup.

Jalankan atau reproduce:

```text
resolve
spec
agent context generation
verify
```

Bandingkan:

### `resolved.json`

- byte-identical bila deterministic;
- jika metadata berbeda, lakukan normalized deep comparison;
- list exact differences.

### `spec.md`

- hash/cmp;
- jika tidak identical, berikan diff dan klasifikasi expected/unexpected.

### `agent-context.md`

PR 1 memiliki conditional findings. Jangan memperbaikinya, tetapi pastikan PR 2 tidak mengubah output lebih lanjut.

Bandingkan bytes atau normalized output.

### `context-manifest.json`

- ignore generated timestamp/temp paths hanya jika variabel tersebut memang expected;
- bandingkan semantic fields.

### Verify findings

- gunakan component name format yang didukung;
- bandingkan pass/fail/skip IDs, bukan hanya exit code;
- loaded class checks tidak boleh hilang;
- conventions-dependent checks tidak boleh silent skip.

## 13. Tahap 8: Verify Missing-Ground-Truth Safety

Karena summary menyatakan missing data menghasilkan empty conventions dan downstream gates melakukan skip, audit apakah ini aman.

Periksa:

1. Checks mana yang skip jika conventions hilang?
2. Apakah overall verify masih dapat exit 0?
3. Apakah output menyatakan degraded verification?
4. Apakah absence dapat menjadi pass-by-absence?
5. Apakah ini pre-existing behavior atau diperkenalkan PR 2?

Klasifikasikan:

```text
safe explicit degraded mode
acceptable backward compatibility
medium risk
blocking false-green risk
```

Jika PR 2 membuat missing canonical data lebih mudah terjadi tetapi tidak memperkuat gate, nilai apakah blocking.

Jangan memperbaiki dalam task ini.

## 14. Tahap 9: Read-Path and No-Scan Verification

Gunakan static call-chain dan instrumentation read-only bila tersedia.

Buktikan untuk snapshot readers:

- reads bounded `.sliceui` files;
- no `fast-glob` full tree;
- no recursive walk;
- no project component/source reads;
- no child process scan;
- no implicit detect/init refresh.

Jalankan scenario legacy, conflict, dan missing dengan tracing bila memungkinkan.

Catat:

```text
files read
unique files read
bytes read
project-source reads
recursive traversal
```

Jika current `fs-trace` tidak cukup, gunakan read-only shim atau static proof dan nyatakan limitation.

## 15. Tahap 10: Documentation Contract Verification

Audit active documentation:

```text
docs/project-docs/development/api-contract.md
README.md
docs/SLICEUI-OVERVIEW.md
docs/project-docs/foundation/architecture.md
docs/project-docs/foundation/workflow.md
skill/SKILL.md
```

Periksa:

- one canonical owner per fact;
- `project-context.json = WHAT`;
- `conventions.json = HOW`;
- legacy fallback described accurately;
- conflict policy described accurately;
- machine-only versus agent-facing distinction;
- no docs still claim duplicated fields exist;
- no skill regression to reading full conventions JSON.

Jangan menambah atau memperbaiki docs. Catat stale docs jika ada.

## 16. Tahap 11: Diff and Scope Review

Review full diff terhadap baseline commit.

Kelompokkan setiap changed hunk:

```text
required PR 2
necessary test
necessary documentation
unrelated
PR 1 pre-existing
PR 3 leakage
```

Cari:

- unrelated formatting;
- changed output semantics;
- new dependencies;
- altered command args;
- accidental cleanup;
- changes to agent instructions unrelated to PR 2;
- direct PR 1 fixes yang dilarang;
- accidental on-PATH/global CLI effects.

## 17. PR 2 Pass/Fail Gate

PR 2 dinyatakan `PASS` hanya jika:

- writer baru tidak menyimpan duplicate blobs;
- canonical owner lengkap;
- no required project data lost;
- legacy snapshot works;
- mixed identical works;
- registry conflict is diagnosed;
- conventions body conflict behavior is documented and not dangerously silent;
- missing/malformed behavior does not create false green;
- no repository scan fallback;
- resolve/spec/agent context maintain semantic output;
- verify retains equivalent checks and findings;
- size reduction is reproducible and explained exact;
- focused and full tests pass;
- docs are accurate;
- no PR 3 leakage;
- source and target project remain unchanged during verification.

PR 2 dapat `CONDITIONAL PASS` jika:

- canonical ownership, writer, legacy support, non-regression, and tests pass;
- one non-blocking limitation remains, such as conventions-body conflict lacking dedicated diagnostic;
- limitation does not cause data loss, false green, or output regression;
- exact correction is documented for later work.

PR 2 dinyatakan `FAIL` jika:

- duplicate fields still written;
- canonical data incomplete;
- legacy snapshot breaks;
- required checks silently disappear;
- missing data can pass verification by absence;
- conventions conflict silently changes semantics;
- project data beyond duplicates is removed;
- outputs change materially;
- writer behavior differs between init and detect;
- hidden repository scan occurs;
- tests give false confidence against a reproduced defect;
- project target was modified;
- PR 3 work is mixed in materially.

## 18. Finding Format

Gunakan severity:

```text
Critical
High
Medium
Low
Informational
```

Finding IDs:

```text
OWN  ownership
WRT  writer
RDR  reader
LEG  legacy compatibility
CNF  conflict handling
MIS  missing/malformed behavior
REG  semantic regression
SIZ  size measurement
VER  verify behavior
RDP  read path
DOC  documentation
SCP  scope
```

Setiap material finding harus memiliki:

```text
Finding ID
Severity
Status: Confirmed / Strong evidence / Suspected / Not found / Unable to verify
Evidence: path, symbol, line, command, output
Impact
Required correction
Blocks PR 2 closure: yes/no
```

## 19. Output Report

Buat:

```text
docs/SLICEUI-PR2-VERIFICATION-REPORT.md
```

Struktur wajib:

```markdown
# SliceUI PR 2 Verification Report

## 1. Executive Decision

PASS / CONDITIONAL PASS / FAIL
PR 3 may start: YES / NO

## 2. Scope and Environment

## 3. Git and Safety Baseline

## 4. Source Review

## 5. Source-of-Truth Assessment

## 6. Writer Assessment

## 7. Reader and Compatibility Matrix

## 8. Test Quality Review

## 9. Tests Re-run

## 10. End-to-End Snapshot Generation

## 11. Snapshot Size Measurements

## 12. Reduction Arithmetic and Key Diff

## 13. Semantic Non-Regression

## 14. Verify Ground-Truth Safety

## 15. Read-Path Assessment

## 16. Documentation Assessment

## 17. Scope and Diff Review

## 18. Findings by Severity

## 19. PR 2 Acceptance Checklist

## 20. Required Corrections Before PR 3

## 21. Deferred Items

## 22. Final Recommendation

## Appendix A: Commands Executed

## Appendix B: Scenario Matrix Raw Results

## Appendix C: Before/After Artifact Keys and Sizes

## Appendix D: Semantic Diffs

## Appendix E: Source Hashes and Git Status
```

## 20. Required Decision Statements

Executive decision wajib menjawab:

```text
Can PR 2 be closed? YES / NO / CONDITIONAL
Can PR 3 start? YES / NO
Does snapshot ownership meet the target? YES / NO
Does legacy compatibility work? YES / NO
Is verify equivalence preserved? YES / NO / PARTIAL
Is the claimed size reduction reproducible? YES / NO
Are there blocking findings? list
```

## 21. End-of-Task Validation

Sebelum selesai:

1. Jalankan ulang hashes file PR 2 dan bandingkan dengan awal.
2. Jalankan `git status --short` pada SliceUI.
3. Jalankan `git status --short` pada project target nyata.
4. Pastikan source implementation tidak berubah saat verifikasi.
5. Pastikan hanya report baru dibuat di repository.
6. Pastikan temporary artifacts berada di `/tmp`.
7. Pastikan tidak ada `.sliceui` accidental baru pada repository SliceUI.
8. Pastikan tidak ada secrets pada report.
9. Pastikan arithmetic size telah dicek independen.
10. Pastikan PASS tidak hanya berdasarkan tests.
11. Jangan commit.

## 22. Respons Akhir yang Diharapkan

Berikan respons singkat setelah laporan selesai:

### Decision

```text
PR 2: PASS / CONDITIONAL PASS / FAIL
PR 3 may start: YES / NO
```

### Key Evidence

- canonical ownership;
- snapshot scenarios;
- size reduction;
- semantic non-regression;
- verify equivalence;
- read-path result;
- test result.

### Blocking Findings

Tuliskan hanya blockers. Jika tidak ada, tulis `None`.

### Non-Blocking Findings

Tuliskan limitation yang perlu dicatat sebelum PR 3.

### Report

```text
docs/SLICEUI-PR2-VERIFICATION-REPORT.md
```

### Validation

Daftar command utama dan hasil.

### Git Status

Tampilkan status repository SliceUI dan project target nyata.

Jangan memperbaiki temuan setelah verifikasi. Tunggu instruksi selanjutnya.

## 23. Final Instruction

Mulai dari static source review dan baseline measurement. Jangan menerima implementation summary sebagai fakta tanpa reproduksi. Gunakan project target nyata hanya sebagai read-only evidence. Semua command penulis harus dijalankan pada temporary fixture. Tugas ini selesai ketika tersedia keputusan terpercaya apakah PR 2 aman ditutup dan PR 3 boleh dimulai.
