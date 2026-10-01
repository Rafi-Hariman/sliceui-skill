# SliceUI PR 1 Verification Plan for Claude Code

Anda sedang bekerja pada repository SliceUI:

```text
/Users/bsi-2-2200019/Development/freelance/sliceui-skill
```

Project target nyata:

```text
/Users/bsi-2-2200019/Development/finance/lib-uii-gateway-bill-angular
```

Snapshot project target:

```text
/Users/bsi-2-2200019/Development/finance/lib-uii-gateway-bill-angular/.sliceui
```

Design fixture utama:

```text
figml-export (7)
```

Audit yang menjadi dasar PR 1:

```text
docs/SLICEUI-READ-PATH-CONTEXT-AUDIT.md
```

Implementation prompt PR 1 bila masih tersedia:

```text
SLICEUI-PR1-AGENT-CONTEXT-REDUCTION-PROMPT.md
```

## 1. Tujuan

Verifikasi bahwa implementasi PR 1 Agent Context Reduction:

1. benar-benar mengurangi context agent;
2. tidak menghilangkan capability penting dari desain;
3. tidak memasukkan capability yang tidak digunakan;
4. mempertahankan exact public API dan kapitalisasi input;
5. tidak membocorkan full machine snapshot ke agent;
6. tidak menambah repository scan pada hot path;
7. tetap menghasilkan slicing Angular 13 yang lengkap dan kompatibel;
8. tidak menurunkan kualitas hasil dibanding baseline sebelum PR 1;
9. tidak merusak command, artifact, atau tests yang sudah ada;
10. layak ditutup sebelum memulai PR 2.

Verifikasi ini bukan implementation task.

## 2. Batas Scope

Lakukan verifikasi dan tulis laporan.

Jangan:

- memperbaiki source code;
- melakukan refactor;
- mengubah algoritma context selection;
- mengubah skill;
- mengubah tests;
- melanjutkan PR 2;
- menghapus file;
- menjalankan formatter dalam write mode;
- melakukan commit;
- mengubah snapshot project nyata tanpa backup;
- memperbaiki output slicing secara manual;
- menggunakan repository search sebagai bantuan generation pada eksperimen minimal-context;
- menyatakan PR 1 lolos jika bukti runtime belum cukup.

Jika ditemukan defect, dokumentasikan lengkap. Jangan memperbaikinya dalam task ini.

Satu-satunya file baru yang boleh dibuat di repository SliceUI adalah:

```text
docs/SLICEUI-PR1-VERIFICATION-REPORT.md
```

Artifact sementara, output slicing percobaan, screenshot, log, dan copy snapshot harus disimpan di temporary directory di luar repository, misalnya:

```text
/tmp/sliceui-pr1-verification-<timestamp>/
```

## 3. Keadaan Implementasi yang Harus Diverifikasi

PR 1 dilaporkan mengubah:

```text
skill/SKILL.md
src/commands/spec.mjs
src/lib/agent-context.mjs
test/agent-context.test.mjs
```

PR 1 dilaporkan menghasilkan artifact baru per design:

```text
.sliceui/artifacts/<design-name>/agent-context.md
.sliceui/artifacts/<design-name>/context-manifest.json
```

Reading order baru yang diklaim:

```text
1. .sliceui/context/INDEX.md
2. .sliceui/artifacts/<name>/agent-context.md
3. .sliceui/artifacts/<name>/spec.md
4. transcript.md hanya jika detail literal tidak cukup
5. resolved.json hanya untuk ambiguity diagnostics
6. Jangan membaca conventions.json atau full Pilar docs secara default
```

Hasil yang diklaim untuk fixture `figml-export (7)`:

```text
agent-context characters   : 7,498
estimated tokens           : 1,875
capabilities selected      : 4
style recipes selected     : 36
unused capabilities        : 0
raw source examples        : 0
budget exceeded            : no
```

Jangan menerima klaim tersebut tanpa memverifikasinya dari source, artifact, dan command output.

## 4. Pertanyaan Keputusan Utama

Laporan harus memberikan keputusan untuk pertanyaan berikut:

1. Apakah context benar-benar design-scoped?
2. Apakah design inventory cukup lengkap untuk generation?
3. Apakah empat capability yang dipilih benar dan mencukupi?
4. Apakah capability penting seperti button, text input, checkbox, table search, table action, status label, footer information, dan icon hilang atau memang direpresentasikan oleh capability induk?
5. Apakah 36 style recipes semuanya relevan?
6. Apakah ada behavioral CSS yang seharusnya digantikan public API?
7. Apakah exact API names dan kapitalisasinya benar?
8. Apakah agent dapat slicing hanya dengan compact context tanpa repository lookup?
9. Apakah build dan verification gate berhasil?
10. Apakah kualitas hasil tidak lebih buruk dari baseline?
11. Apakah PR 1 layak ditutup?
12. Jika belum layak, apa koreksi minimum yang dibutuhkan sebelum PR 2?

## 5. Tahap 0: Safety dan Baseline

Sebelum verifikasi, jalankan:

```bash
git status --short
git rev-parse HEAD
node --version
npm --version
```

Catat seluruh perubahan yang sudah ada.

Jangan menghapus atau menimpa perubahan user.

Buat temporary workspace:

```bash
TMP_ROOT="/tmp/sliceui-pr1-verification-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$TMP_ROOT"
```

Simpan path tersebut di laporan.

Catat hash file implementasi sebelum menjalankan command:

```bash
shasum -a 256 skill/SKILL.md src/commands/spec.mjs src/lib/agent-context.mjs test/agent-context.test.mjs
```

Jalankan kembali hashing pada akhir verifikasi untuk membuktikan bahwa source tidak berubah.

## 6. Tahap 1: Static Implementation Review

Audit minimal:

```text
src/lib/agent-context.mjs
src/commands/spec.mjs
skill/SKILL.md
test/agent-context.test.mjs
```

Periksa dan dokumentasikan:

### 6.1 Builder purity

Pastikan `src/lib/agent-context.mjs`:

- tidak membaca repository;
- tidak memakai recursive glob;
- tidak memakai raw `fs` untuk mencari source;
- hanya menerima data melalui parameter;
- tidak mengimpor command atau module yang melakukan scan;
- menghasilkan output deterministik untuk input yang sama.

Tulis call chain aktual dari `spec` sampai artifact ditulis.

### 6.2 Data sources

Untuk setiap section pada `agent-context.md`, identifikasi source sebenarnya:

- framework;
- design inventory;
- capabilities;
- dangerous defaults;
- style recipes;
- constraints;
- reading order;
- metrics.

Klasifikasikan source sebagai:

```text
authoritative machine fact
derived design fact
semantic heuristic
human-readable projection
fallback
```

### 6.3 Backward compatibility

Pastikan:

- `buildSpec()` tidak berubah secara semantik;
- `spec.md` lama tetap dihasilkan;
- command positional arguments tidak berubah;
- snapshot lama tanpa `agent-context.md` masih memiliki fallback;
- skill tidak tetap memerintahkan full `conventions.json` read di bagian lain;
- skill tidak memiliki instruksi kontradiktif mengenai Pilar docs atau repository search.

### 6.4 Test quality

Jangan hanya menghitung jumlah test. Nilai apakah tests benar-benar membuktikan:

- no full conventions leakage;
- no loaded class registry leakage;
- capability pruning;
- exact case-sensitive input preservation;
- public API precedence;
- style recipe pruning;
- context budget;
- old snapshot fallback;
- no raw source examples;
- unchanged spec behavior.

Cari false-positive tests seperti assertion terlalu lemah, fixture terlalu sederhana, atau test yang hanya memeriksa substring generik.

## 7. Tahap 2: Re-run Tests

Jalankan validasi berikut dari root repository:

```bash
node --test test/agent-context.test.mjs
```

Lalu relevant suite:

```bash
node --test \
  test/agent-context.test.mjs \
  test/spec.test.mjs \
  test/resolve.test.mjs \
  test/conventions.test.mjs \
  test/conventions-generated.test.mjs \
  test/pilar-catalog.test.mjs \
  test/transcript-schema.test.mjs
```

Kemudian full suite:

```bash
npm test
```

Catat:

- pass;
- fail;
- skip;
- duration;
- warning;
- apakah ada test yang bergantung pada environment.

Jangan memperbaiki test yang gagal. Dokumentasikan failure dan tentukan apakah failure berasal dari PR 1 atau kondisi pre-existing.

## 8. Tahap 3: Generate Artifacts pada Temporary Copy

Jangan menjalankan `spec` langsung pada snapshot project target tanpa copy.

Salin hanya data yang diperlukan ke temporary workspace. Pertahankan path dengan spasi menggunakan quoting yang benar.

Contoh konseptual:

```bash
cp -R "/Users/bsi-2-2200019/Development/finance/lib-uii-gateway-bill-angular/.sliceui" \
  "$TMP_ROOT/.sliceui"
```

Jika command membutuhkan project metadata lain, buat fixture temporary yang aman atau gunakan existing test fixture. Jangan memodifikasi project nyata.

Jalankan `sliceui spec` terhadap copy `figml-export (7)` menggunakan CLI repository yang sedang diuji.

Catat exact command.

Setelah selesai, pastikan artifact berikut tersedia:

```text
agent-context.md
context-manifest.json
spec.md
```

Validasi JSON:

```bash
node -e "JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8')); console.log('valid')" \
  "$TMP_ROOT/.sliceui/artifacts/figml-export (7)/context-manifest.json"
```

Bandingkan `spec.md` baru dengan baseline lama jika baseline tersedia:

```bash
shasum -a 256 <old-spec> <new-spec>
cmp -s <old-spec> <new-spec>
```

Jika baseline byte-identical tidak tersedia, nyatakan tidak dapat diverifikasi. Jangan mengarang.

## 9. Tahap 4: Artifact Inspection

Inspect penuh:

```text
agent-context.md
context-manifest.json
```

Laporan harus menyertakan ringkasan terstruktur dari:

```text
designInventory
capabilities
dangerousDefaults
styleRecipes
constraints
metrics
sources/provenance
```

### 9.1 Leakage checks

Pastikan agent context tidak memuat:

- `loadedClassRegistry`;
- seluruh `classVocabulary`;
- seluruh `ngDeepCorpus`;
- seluruh Pilar reference;
- seluruh Pilar showcase;
- raw repository component source;
- path source project yang tidak perlu;
- secrets, credentials, tokens, atau environment values.

Gunakan targeted searches dan catat hasil:

```bash
rg -n "loadedClassRegistry|classVocabulary|pilar-showcase|BEGIN.*SOURCE|API_KEY|TOKEN|PASSWORD" <agent-context>
```

Sesuaikan pattern bila perlu. Jangan menampilkan credential value bila ditemukan. Redact dan tandai sebagai critical.

### 9.2 Size and metrics validation

Hitung ulang secara independen:

```text
bytes
characters
lines
estimatedTokens = ceil(characters / 4)
```

Bandingkan dengan metrics manifest.

Perbedaan metrics harus nol atau dijelaskan oleh newline/encoding policy yang konsisten.

### 9.3 Inventory completeness

Baca transcript/spec/XML fixture dan buat expected inventory manual yang tidak bergantung pada builder output.

Minimal periksa keberadaan atau representasi:

- page title atau heading;
- divider;
- select;
- text input;
- buttons;
- icons;
- checkbox;
- table;
- table search;
- table limit;
- table action;
- table footer information;
- pagination;
- status label;
- bulk action toolbar;
- required markers bila ada.

Untuk setiap item, tandai:

```text
present directly
covered by parent capability
not applicable
missing
false positive
uncertain
```

Jangan menganggap semua visual node harus menjadi capability terpisah. Yang dinilai adalah apakah agent menerima informasi implementasi yang cukup.

### 9.4 Capability correctness

Untuk setiap capability terpilih, periksa:

- evidence desain;
- selector;
- exact input names;
- exact capitalization;
- outputs yang relevan;
- defaults;
- policy;
- provenance ke machine catalog;
- apakah capability benar-benar digunakan desain.

Khusus pagination, bedakan:

```text
uii-table.paginationAlign
uii-pagination.paginationALign
```

Jangan menerima kapitalisasi yang tertukar.

Khusus table, periksa bila relevan:

```text
rows
columns
checkboxColumn
actionColumn
searchOptions
limitOptions
paginationOptions
paginationAlign
footerInfo
```

Khusus row actions, periksa requirement seperti:

```text
auth.canUpdate
```

### 9.5 Dangerous defaults completeness

Nilai apakah dangerous defaults relevan dan cukup.

Cari dua jenis defect:

1. Missing dangerous default yang dapat menyebabkan output salah.
2. Irrelevant dangerous default yang menambah noise.

### 9.6 Style recipe audit

Audit seluruh 36 style recipes yang dilaporkan.

Untuk setiap recipe, catat:

- ID atau selector;
- family;
- reason selected;
- provenance;
- design evidence;
- type: visual, behavioral, layout, unknown;
- whether a public API exists;
- relevan atau tidak;
- duplicate atau tidak;
- risk of style amplification.

Klasifikasikan:

```text
KEEP
REMOVE FROM CONTEXT
REQUIRES REVIEW
PUBLIC API SHOULD WIN
```

PR 1 tidak otomatis lolos hanya karena file berada di bawah budget. Jika 36 recipes tidak relevan atau mendorong CSS berlebihan, catat sebagai defect.

Kriteria utama:

- behavioral/layout recipe tidak boleh menggantikan verified public input;
- recipe family harus digunakan desain;
- identical blocks tidak boleh muncul berulang;
- selector internal harus memiliki provenance;
- visual recipe tidak boleh menambah wrapper atau structure;
- recipe tidak boleh memaksakan font size, min-height, padding, atau density tanpa evidence yang tepat.

## 10. Tahap 5: Agent Reading Contract Verification

Audit `skill/SKILL.md` secara keseluruhan, bukan hanya section baru.

Pastikan tidak ada instruksi lain yang masih mewajibkan:

```text
read conventions.json
read resolved.json unconditionally
read full pilar-reference.md
read full pilar-showcase.md
search repository for a similar component
copy layout from samples
```

Pastikan fallback snapshot lama tidak diam-diam mengembalikan behavior boros.

Expected default reading contract:

```text
INDEX.md
→ agent-context.md
→ spec.md
→ transcript.md only if needed
→ resolved.json only for diagnostics
→ targeted Pilar lookup only if context is unresolved
```

Laporkan setiap contradiction beserta line number.

## 11. Tahap 6: Hot-Path Read Verification

Tujuannya memastikan PR 1 tidak menambahkan repository scanning baru pada `spec`.

Gunakan instrumentation yang tersedia atau read-only shim audit sebelumnya jika masih aman dan tersedia. Jangan mengubah source.

Minimal buktikan:

```text
spec reads design artifact
spec reads .sliceui snapshot
spec does not recursively read project source
agent-context builder does not read project source
```

Catat:

- unique files read;
- files outside `.sliceui`;
- project-source reads;
- bytes read;
- recursive traversal bila dapat diketahui.

Jika instrumentation tidak mampu membuktikan seluruh read behavior, gunakan static call-chain evidence dan tulis limitation secara eksplisit.

## 12. Tahap 7: Real Slicing Smoke Test

Lakukan satu generation smoke test pada sesi agent terpisah atau isolated sub-agent jika environment mendukung.

Tujuan: membuktikan compact context cukup untuk menghasilkan slicing, bukan sekadar artifact valid.

### 12.1 Allowed generation inputs

Agent generation hanya boleh membaca:

```text
.sliceui/context/INDEX.md
.sliceui/artifacts/figml-export (7)/agent-context.md
.sliceui/artifacts/figml-export (7)/spec.md
```

Agent boleh membaca:

```text
transcript.md
```

hanya jika detail literal desain tidak terdapat atau ambigu di spec.

Agent tidak boleh membaca:

```text
conventions.json
project-context.json
pilar-reference.md penuh
pilar-showcase.md penuh
repository source components
output slicing lama
baseline implementation
```

Target output harus ditulis di temporary directory di luar repository project nyata.

### 12.2 Generation instruction

Gunakan instruction netral dan singkat:

```text
Buat slicing Angular 13 lengkap berdasarkan agent-context.md dan spec.md yang diberikan.
Gunakan data mock.
Jangan mencari repository.
Jangan menebak API yang tidak terdapat pada context.
Gunakan public component API sebelum CSS internal override.
Jangan menambahkan wrapper, spacing, modal semantics, endpoint, service, atau layout yang tidak memiliki evidence desain.
Simpan output .ts, .html, dan .scss pada output directory yang ditentukan.
Catat ambiguity secara terpisah.
```

Jangan memberikan expected answer atau daftar defect baseline kepada generation agent.

### 12.3 Capture metrics

Catat bila tersedia:

- wall-clock time;
- input context characters;
- estimated tokens;
- output size;
- files/tools read;
- repository searches;
- correction count;
- ambiguity count.

Jika actual model token usage tidak tersedia, gunakan estimasi dan labeli dengan benar.

## 13. Tahap 8: Structural and Project Validation of Generated Slice

Periksa hasil `.ts`, `.html`, dan `.scss` tanpa memperbaiki.

### 13.1 Structural checks

Periksa:

- visible elements lengkap;
- order dan hierarchy;
- no invented wrapper;
- no invented modal/card semantics;
- root internal padding versus canvas position;
- controls dan actions sesuai desain;
- table features hadir bila diperlukan;
- literal text tidak hilang;
- required markers tepat.

### 13.2 Project compatibility

Periksa:

- Angular 13 syntax;
- no standalone unless project requires;
- no `inject()`;
- no `@if` atau `@for`;
- exact component selectors;
- exact public inputs;
- no unknown input;
- row auth requirement;
- status taxonomy;
- imports dan types konsisten;
- no invented endpoint/service/API;
- no dead subscription infrastructure;
- no unnecessary handler.

### 13.3 CSS minimality

Catat:

- total SCSS lines;
- `::ng-deep` count;
- `!important` count;
- media query count;
- internal library selector count;
- explicit font-size count;
- explicit min-height/height count;
- wrapper/layout rules;
- potential duplicated library defaults;
- likely style amplification.

Jangan menganggap lebih sedikit CSS selalu lebih baik. Gunakan design evidence dan project ownership.

## 14. Tahap 9: Build dan Verify

Build output melalui safe temporary fixture atau project copy. Jangan mengubah module project nyata secara permanen.

Jika tersedia automated mount helper, gunakan hanya bila tidak memodifikasi project nyata.

Catat exact build command dan hasil.

Untuk `verify`, gunakan file stem kebab-case karena PascalCase normalization adalah defect deferred yang sudah diketahui.

Contoh:

```bash
sliceui verify <component-directory> testingcomponent
```

Jangan gunakan class name PascalCase untuk acceptance PR 1.

Catat:

- exit code;
- pass/fail/skip checks;
- diagnostic;
- apakah failure berasal dari generation, verifier, atau fixture integration.

Jika verify tidak dapat dijalankan karena setup temporary tidak menyediakan owning module atau ground truth, jangan menyatakan pass. Jelaskan limitation dan lakukan static validation sebagai fallback.

## 15. Tahap 10: Baseline Comparison

Bandingkan output minimal-context dengan baseline sebelum PR 1 bila baseline tersedia.

Prioritas baseline:

1. Output terbaik yang sebelumnya telah direview user.
2. Output current pipeline sebelum PR 1.
3. Existing fixture atau golden output.

Jangan menggunakan baseline yang tidak sebanding tanpa label.

Nilai minimal:

```text
structural completeness
public API correctness
invented structure
SCSS complexity
visual density risk
build success
verify result
agent time
generation context size
human correction burden
```

Jika screenshot runtime dapat dibuat, lakukan blind side-by-side review terhadap desain asli.

Jika screenshot atau baseline tidak tersedia, nyatakan bahwa visual non-regression belum dapat dibuktikan. Jangan menyimpulkan kualitas maksimal hanya dari build dan verify.

Gunakan hasil:

```text
BETTER
EQUIVALENT
WORSE
NOT VERIFIABLE
```

untuk setiap area.

## 16. PR 1 Pass/Fail Gate

PR 1 dinyatakan `PASS` hanya jika:

- source review tidak menemukan repository scan baru;
- tests relevan dan full suite lulus atau hanya memiliki skip pre-existing;
- artifact context valid;
- metrics dapat direproduksi;
- no full conventions leakage;
- no raw source example leakage;
- design inventory cukup untuk generation;
- selected capabilities benar dan relevan;
- exact public API names benar;
- style recipes relevan atau jumlah berlebih tidak memengaruhi generation;
- one-shot generation dapat diselesaikan tanpa repository lookup;
- generated slice structurally complete;
- build berhasil;
- verify berhasil, atau limitation verifier terbukti pre-existing dan tidak dipicu PR 1;
- hasil tidak lebih buruk dari baseline pada area yang dapat diverifikasi;
- tidak ada perubahan source selama verification;
- default context tetap di bawah budget atau mandatory overflow terdokumentasi.

PR 1 dinyatakan `CONDITIONAL PASS` jika:

- structure, compatibility, build, dan context reduction lolos;
- tetapi visual comparison belum tersedia;
- tidak ada defect material yang menunjukkan kualitas generation menurun.

PR 1 dinyatakan `FAIL` jika salah satu terjadi:

- capability penting hilang dan menyebabkan output tidak lengkap;
- context memberi API salah;
- capitalization salah;
- agent perlu membaca repository agar generation selesai;
- output build gagal karena context kurang;
- context memuat full machine snapshot;
- style recipes mendorong behavioral override yang bertentangan dengan public API;
- PR 1 menambah repository scan;
- tests memberikan false confidence terhadap defect nyata;
- output secara material lebih buruk daripada baseline.

## 17. Severity Classification

Gunakan severity:

```text
Critical
High
Medium
Low
Informational
```

Gunakan finding IDs:

```text
CTX  context package
INV  design inventory
CAP  capability selection
STY  style recipes
SKL  skill contract
GEN  generation smoke test
BLD  build
VER  verification
PERF performance/context size
BC   backward compatibility
```

Setiap finding material harus memiliki:

```text
Finding ID
Severity
Status: Confirmed / Strong evidence / Suspected / Not found / Unable to verify
Evidence
Impact
Required correction
Blocks PR 1 closure: yes/no
```

## 18. Output Report

Buat satu file:

```text
docs/SLICEUI-PR1-VERIFICATION-REPORT.md
```

Struktur wajib:

```markdown
# SliceUI PR 1 Verification Report

## 1. Executive Decision

PASS / CONDITIONAL PASS / FAIL

## 2. Scope and Environment

## 3. Source Review

## 4. Tests Re-run

## 5. Artifact Generation

## 6. Context Metrics

## 7. Design Inventory Assessment

## 8. Capability Assessment

## 9. Dangerous Defaults Assessment

## 10. Style Recipe Assessment

## 11. Skill Reading Contract

## 12. Hot-Path Read Assessment

## 13. Generation Smoke Test

## 14. Generated Slice Review

## 15. Build Result

## 16. Verify Result

## 17. Baseline Comparison

## 18. Findings by Severity

## 19. PR 1 Acceptance Checklist

## 20. Required Corrections Before PR 2

## 21. Deferred Items

## 22. Final Recommendation

## Appendix A: Commands Executed

## Appendix B: Artifact Summaries

## Appendix C: Style Recipe Classification

## Appendix D: Raw Metrics
```

## 19. Required Report Details

Executive decision harus menjawab secara eksplisit:

```text
Can PR 1 be closed? yes/no/conditional
Can PR 2 start? yes/no
What blocks progress?
What is the smallest correction, if any?
```

Context metrics harus membandingkan:

```text
Reported characters vs independently measured characters
Reported estimated tokens vs independently calculated estimate
Reported capabilities vs actual manifest entries
Reported style recipes vs actual manifest entries
Reported unused capabilities vs audit result
Reported raw source examples vs audit result
```

Style recipe appendix wajib mencantumkan seluruh recipe, bukan hanya sample.

Baseline comparison harus membedakan:

```text
Verified evidence
Human judgment
Unavailable evidence
```

## 20. End-of-Task Validation

Sebelum selesai:

1. Jalankan kembali source hashes dan bandingkan dengan awal.
2. Jalankan `git status --short`.
3. Pastikan hanya report baru yang dibuat oleh verification task.
4. Pastikan temporary artifacts berada di luar repository.
5. Pastikan project target nyata tidak berubah.
6. Jika project target adalah Git repository, jalankan `git status --short` di sana juga.
7. Pastikan tidak ada secret yang ditulis ke report.
8. Pastikan keputusan PASS tidak hanya didasarkan pada test count.
9. Pastikan seluruh limitation ditulis.
10. Jangan commit.

## 21. Respons Akhir yang Diharapkan

Setelah laporan selesai, berikan respons singkat:

### Decision

```text
PR 1: PASS / CONDITIONAL PASS / FAIL
PR 2 may start: YES / NO
```

### Key Evidence

- context size;
- inventory completeness;
- capability correctness;
- style recipe relevance;
- generation result;
- build result;
- verify result;
- baseline result.

### Blocking Findings

Tuliskan hanya finding yang memblokir.

### Report

```text
docs/SLICEUI-PR1-VERIFICATION-REPORT.md
```

### Validation

Daftar command utama dan hasil.

### Git Status

Tampilkan status repository SliceUI dan project target.

Jangan mengimplementasikan correction apa pun setelah verification. Tunggu instruksi selanjutnya.

## 22. Final Instruction

Mulai dengan inspeksi dan pengukuran. Jangan menganggap laporan implementasi sebelumnya benar tanpa reproduksi. Jangan memperbaiki code. Tujuan utama task ini adalah memberikan keputusan yang dapat dipercaya apakah PR 1 aman ditutup dan PR 2 boleh dimulai.
