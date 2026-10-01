# SliceUI PR 1 Implementation Prompt: Agent Context Reduction

Anda sedang bekerja pada repository SliceUI berikut:

```text
/Users/bsi-2-2200019/Development/freelance/sliceui-skill
```

Project nyata yang digunakan sebagai fixture validasi:

```text
/Users/bsi-2-2200019/Development/finance/lib-uii-gateway-bill-angular
```

Snapshot hasil `sliceui init` pada project tersebut:

```text
/Users/bsi-2-2200019/Development/finance/lib-uii-gateway-bill-angular/.sliceui
```

Audit yang menjadi dasar pekerjaan:

```text
docs/SLICEUI-READ-PATH-CONTEXT-AUDIT.md
```

## 1. Tujuan

Implementasikan PR pertama untuk mengurangi context yang dibaca agent saat melakukan slicing, tanpa mengubah arsitektur utama SliceUI dan tanpa mengubah semantics hasil `transcribe`, `resolve`, `spec`, `referee`, atau `verify`.

Masalah yang telah dibuktikan oleh audit:

1. Agent diarahkan membaca `.sliceui/conventions.json`, yang pada fixture nyata berukuran sekitar 452 KB atau sekitar 113 ribu estimated tokens.
2. Agent sebenarnya hanya membutuhkan bagian conventions yang relevan untuk generation. Registry penuh dan data machine-only terutama dibutuhkan CLI serta verifier.
3. Agent diarahkan membaca `resolved.json` dan `spec.md`, padahal `spec.md` sudah memasukkan hasil resolve.
4. Agent diarahkan melakukan grep pada dokumentasi Pilar yang besar, termasuk `pilar-reference.md` dan `pilar-showcase.md`.
5. Tidak ada satu context package per desain yang secara eksplisit membatasi capability, dangerous defaults, dan style recipe yang relevan.
6. Ukuran context agent belum direkam secara konsisten.

Target perubahan ini:

```text
Design inventory
+ pruned project capabilities
+ relevant conventions
+ relevant style recipes
+ design spec
= compact agent context
```

Bukan:

```text
full conventions.json
+ full Pilar reference
+ full Pilar showcase
+ resolved.json
+ spec.md
+ additional project documentation
```

## 2. Batas Scope

Kerjakan hanya Agent Context Reduction.

Jangan mengimplementasikan dalam PR ini:

- pemindahan full scan `referee` ke cold path;
- command `refresh` baru;
- redesign penuh `.sliceui`;
- penghapusan `resolve`;
- penghapusan `spec`;
- perubahan algoritma FIGML parser;
- perubahan visual verification;
- render verification;
- incremental repository indexing;
- content-addressed cache;
- loader-level filesystem interception;
- refactor framework support yang tidak berkaitan;
- perubahan output code generation yang tidak diperlukan;
- perbaikan styling desain tertentu;
- perubahan besar pada verifier;
- dependency baru tanpa kebutuhan mutlak.

Jika menemukan masalah lain, dokumentasikan pada ringkasan akhir. Jangan memperluas scope secara otomatis.

## 3. Prinsip Implementasi

Ikuti prinsip berikut:

1. Terapkan perubahan terkecil yang dapat mengurangi context agent secara nyata.
2. Pertahankan compatibility command yang sudah ada.
3. Pertahankan format `transcript.json`, `resolved.json`, dan `spec.md` kecuali penambahan metadata yang benar-benar diperlukan.
4. `conventions.json` tetap tersedia sebagai machine artifact untuk CLI dan verifier.
5. Agent generator tidak boleh diarahkan membaca seluruh `conventions.json` secara default.
6. `spec.md` menjadi dokumen generation utama setelah dibuat.
7. `resolved.json` tetap dibuat, tetapi tidak menjadi bacaan wajib agent jika `spec.md` tersedia.
8. Pilar machine catalog tetap menjadi authority public API.
9. Context per desain harus hanya membawa capability yang digunakan desain.
10. Jangan mengubah rekomendasi menjadi keputusan jika evidence desain tidak cukup.
11. Setiap data yang dimasukkan ke context package harus mempunyai source atau provenance.
12. Jangan membaca ulang repository untuk membangun context per desain.
13. Context builder hanya boleh menggunakan design artifacts dan snapshot `.sliceui` yang sudah ada.

## 4. Perilaku Target

Setelah perubahan, alur agent yang direkomendasikan harus menjadi:

```text
1. Baca .sliceui/context/INDEX.md.
2. Baca artifact context ringkas untuk desain aktif.
3. Baca spec.md sebagai generation document utama.
4. Baca transcript.md hanya jika detail literal desain tidak cukup jelas di spec.
5. Baca resolved.json hanya untuk debugging ambiguity atau provenance.
6. Jangan membaca conventions.json secara default.
7. Jangan membaca seluruh pilar-reference.md atau pilar-showcase.md.
8. Jangan mencari source repository kecuali pengguna secara eksplisit meminta investigasi mendalam.
```

Jika context ringkas tidak tersedia, fallback lama masih boleh bekerja dengan warning yang jelas. Jangan merusak snapshot lama.

## 5. Output Artifact Baru

Tambahkan satu artifact per desain:

```text
.sliceui/artifacts/<design-name>/agent-context.md
```

Tambahkan juga manifest machine-readable:

```text
.sliceui/artifacts/<design-name>/context-manifest.json
```

Nama boleh disesuaikan hanya jika repository telah memiliki konvensi yang lebih kuat. Jika diubah, jelaskan alasannya.

### 5.1 `context-manifest.json`

Manifest minimal harus memiliki struktur konseptual berikut:

```json
{
  "schemaVersion": 1,
  "design": "figml-export (7)",
  "generatedAt": "ISO-8601",
  "sources": {
    "spec": "spec.md",
    "transcript": "transcript.json",
    "resolved": "resolved.json",
    "conventions": "../../conventions.json",
    "componentCatalog": "pilar-catalog"
  },
  "framework": {
    "name": "angular",
    "version": "13.3.11",
    "standalone": false,
    "templateSyntax": "structural-directives"
  },
  "designInventory": [],
  "capabilities": [],
  "dangerousDefaults": [],
  "styleRecipes": [],
  "constraints": [],
  "metrics": {
    "characters": 0,
    "estimatedTokens": 0,
    "capabilityCount": 0,
    "styleRecipeCount": 0,
    "unusedCapabilityCount": 0
  }
}
```

Struktur final boleh mengikuti style project, tetapi harus memenuhi tujuan berikut:

- machine-readable;
- versioned;
- memiliki provenance;
- hanya menyertakan data relevan;
- dapat diuji;
- tidak menyimpan seluruh `conventions.json`;
- tidak menyimpan seluruh Pilar catalog;
- tidak menyimpan raw source component;
- tidak menyertakan capability yang tidak digunakan oleh desain.

### 5.2 `agent-context.md`

File ini adalah context utama yang dibaca agent.

Isi yang diizinkan:

1. Framework dan version constraint.
2. Project grammar yang relevan.
3. Design inventory ringkas.
4. Exact public APIs untuk komponen yang digunakan.
5. Dangerous defaults yang relevan.
6. Relevant reusable style recipes.
7. Forbidden or unsupported APIs yang relevan.
8. Generation reading order.
9. Provenance ringkas.
10. Metrics context.

File ini tidak boleh memasukkan:

- daftar 14 ribu class;
- seluruh `loadedClassRegistry`;
- seluruh `classVocabulary`;
- seluruh `ngDeepCorpus`;
- seluruh Pilar reference;
- seluruh Pilar showcase;
- source component project mentah;
- capability yang tidak digunakan desain;
- duplikasi penuh transcript;
- duplikasi penuh spec;
- narasi panjang yang tidak membantu generation.

Contoh bentuk akhir:

```markdown
# Agent Context: figml-export (7)

## Framework

- Angular 13.3.11
- NgModule component model
- Constructor dependency injection
- Use `*ngIf` and `*ngFor`
- Do not use standalone components, `inject()`, `@if`, or `@for`

## Design Inventory

- Select controls
- Text input
- Primary search button
- Bulk action buttons
- `uii-table`
- Checkbox column
- Action column
- Internal table search
- Pagination
- Status labels

## Verified Component APIs

### `uii-table`

- `[rows]`
- `[columns]`
- `[checkboxColumn]`
- `[actionColumn]`
- `[searchOptions]`
- `[limitOptions]`
- `[paginationOptions]`
- `[paginationAlign]`
- `[footerInfo]`

Source: Pilar catalog for the indexed version.

## Dangerous Defaults

- `actionColumn` may default to enabled.
- Row edit requires `auth.canUpdate`.
- Use `[paginationAlign]="'right'"` for table pagination alignment.
- Do not substitute behavior with `::ng-deep` when a public input exists.

## Relevant Style Recipes

Only include recipes selected for this design.

## Primary Generation Input

Read `spec.md`.
Use `transcript.md` only to inspect literal design details not clear in the spec.
Use `resolved.json` only for ambiguity diagnostics.
Do not read `conventions.json` during normal generation.
```

Jangan hardcode contoh tersebut untuk semua project. Data harus berasal dari snapshot dan design inventory.

## 6. Design Inventory

Gunakan informasi yang sudah tersedia di transcript, resolved artifacts, spec builder, dan family detection.

Audit menunjukkan `spec.mjs` sudah memiliki konsep seperti `familiesInPlay`. Reuse logic yang sudah ada bila cukup. Jangan membuat classifier paralel yang menghasilkan authority baru.

Inventory harus memetakan desain ke kebutuhan seperti:

```text
select
text-input
button
checkbox
table
table-search
pagination
status-label
icon
```

Inventory tidak perlu sempurna secara semantik pada PR ini. Tujuan utamanya adalah pruning context.

Persyaratan:

- deterministik;
- dapat diuji;
- tidak membaca repository;
- tidak mengarang capability yang tidak terlihat;
- mempertahankan evidence atau source node bila tersedia;
- unknown role boleh disimpan sebagai unknown, jangan ditebak.

## 7. Capability Selection

Gunakan machine catalog yang sudah ada:

```text
src/framework/angular/pilar-catalog.mjs
src/framework/angular/pilar-showcase.mjs
src/framework/angular/uii-profile.mjs
src/framework/angular/uii-slice-policy.mjs
src/lib/library-registry.mjs
src/lib/pilar-loader.mjs
```

Jangan menjadikan Markdown sebagai source of truth ketika machine catalog tersedia.

Capability yang disertakan harus:

- cocok dengan role yang ditemukan dalam design inventory;
- exact selector;
- exact case-sensitive input names;
- relevant outputs bila dibutuhkan;
- defaults yang memiliki dampak pada generation;
- slice policy yang relevan;
- satu minimal wiring example bila benar-benar diperlukan.

Jangan memasukkan seluruh catalog.

Jika mapping role ke Pilar component belum tersedia secara eksplisit, gunakan mapping paling kecil yang sudah didukung registry atau policy. Jangan membuat mapping generik besar tanpa test.

Unknown capability harus ditulis seperti:

```json
{
  "role": "date-input",
  "status": "unresolved",
  "reason": "No verified project capability in snapshot"
}
```

Jangan menebak component library.

## 8. Dangerous Defaults

Bangun daftar dangerous defaults dari sumber yang sudah diverifikasi, misalnya:

- component catalog defaults;
- UII slice policy;
- UII profile;
- conventions facts;
- framework constraints;
- known invalid syntax untuk framework version.

Hanya masukkan default yang relevan dengan capability terpilih.

Contoh:

```text
Jika desain tidak menggunakan table, jangan sertakan table defaults.
Jika desain tidak menggunakan standalone pagination, jangan sertakan paginationALign.
Jika desain menggunakan uii-table, sertakan paginationAlign bila pagination terdeteksi.
```

## 9. Style Recipe Selection

Gunakan corpus yang sudah tersedia di `conventions.json`, tetapi jangan memberikan keseluruhan corpus kepada agent.

Hanya masukkan style recipe yang:

- family-nya digunakan desain;
- telah ditandai reusable atau approved oleh current conventions logic;
- tidak menggantikan public component behavior;
- memiliki source/provenance;
- diperlukan untuk visual internal library yang tidak tersedia melalui public API.

Jangan masukkan behavior/layout override jika component public input tersedia.

Pertahankan block verbatim hanya bila current SliceUI memang mensyaratkan verbatim reuse.

Manifest style recipe minimal menyimpan:

```json
{
  "id": "ngx-select-open-state",
  "family": "select",
  "source": "conventions.json.ngDeepCorpus",
  "reason": "Select family used by design",
  "locked": true
}
```

## 10. Perubahan pada Skill

Audit file berikut:

```text
skill/SKILL.md
skill/handoff/SKILL.md
skill/references/*
```

Ubah instruksi primary skill agar:

1. Agent tidak membaca `.sliceui/conventions.json` secara default.
2. Agent membaca `agent-context.md` setelah tersedia.
3. Agent menggunakan `spec.md` sebagai generation input utama.
4. Agent tidak wajib membaca `resolved.json` jika `spec.md` tersedia.
5. Agent tidak membaca seluruh Pilar docs.
6. Agent hanya membuka Pilar reference/showcase sebagai fallback targeted lookup jika capability tidak terdapat di context package.
7. Agent tidak mencari repository sebagai bagian normal slicing.
8. Fallback untuk snapshot lama tetap dijelaskan.

Jangan memperpanjang skill secara berlebihan. Hapus atau konsolidasikan instruksi yang menjadi redundant.

Tetap pertahankan invariant penting:

```text
Design owns visible structure and appearance.
Project snapshot owns implementation vocabulary.
Samples teach wiring, not UI structure.
Use public API before internal CSS overrides.
```

Untuk `skill/handoff/SKILL.md`, jangan mengubah workflow besar kecuali diperlukan agar terminology dan source-of-truth tetap konsisten. Handoff mode adalah workflow terpisah untuk CLI-less agent.

## 11. Integrasi Command

Preferensi pendekatan minimal:

- Integrasikan pembuatan `context-manifest.json` dan `agent-context.md` ke command `spec`, karena `spec` sudah memiliki transcript, conventions, resolve output, dan family detection.
- Jangan menambah command baru jika tidak diperlukan.
- Jika secara arsitektur lebih bersih menggunakan helper baru, buat helper kecil di `src/lib/` dan panggil dari `spec`.
- Jangan memindahkan business logic ke command file jika helper dapat diuji terpisah.

Contoh conceptual flow:

```text
sliceui spec <design>
├── read design artifact
├── read conventions snapshot
├── build spec
├── derive design inventory
├── select capabilities
├── select dangerous defaults
├── select style recipes
├── write context-manifest.json
├── render agent-context.md
└── report metrics
```

`spec.md` tetap dihasilkan dengan behavior kompatibel.

## 12. Context Budget

Tambahkan budget yang konservatif dan configurable bila project sudah memiliki tempat config yang sesuai.

Default target:

```text
agent-context.md maximum: 30,000 characters
estimated tokens maximum: 7,500
maximum capabilities: only those used by design
maximum examples per capability: 1
raw repository source examples: 0
unused capabilities: 0
```

Jangan langsung gagal hanya karena fixture lama memiliki kasus edge. Gunakan kebijakan berikut:

1. Prune optional examples terlebih dahulu.
2. Prune redundant narrative.
3. Jangan prune exact API names, constraints, dangerous defaults, atau required style recipes.
4. Jika tetap melebihi budget, emit warning dan metrics yang jelas.
5. Jangan memotong file secara string tanpa memahami section boundary.

Jika config baru ditambahkan, berikan default yang backward-compatible.

## 13. Metrics

Setelah context package dibuat, hitung minimal:

```json
{
  "characters": 0,
  "estimatedTokens": 0,
  "capabilityCount": 0,
  "styleRecipeCount": 0,
  "dangerousDefaultCount": 0,
  "unusedCapabilityCount": 0,
  "rawSourceExampleCount": 0,
  "budgetExceeded": false
}
```

Token adalah estimasi:

```text
ceil(characterCount / 4)
```

Labeli sebagai estimated tokens, bukan actual model tokens.

Tampilkan ringkasan setelah `sliceui spec`:

```text
Agent context
- characters             : 18,420
- estimated tokens       : 4,605
- capabilities selected  : 5
- style recipes selected : 2
- unused capabilities    : 0
- raw source examples    : 0
- budget exceeded        : no
```

Jika command mendukung JSON report, sertakan metrics tanpa merusak schema existing. Gunakan optional fields atau schema versioning.

## 14. Backward Compatibility

Snapshot lama yang belum memiliki `agent-context.md` harus tetap dapat digunakan.

Skill fallback:

```text
Jika agent-context.md tersedia:
→ gunakan agent-context.md

Jika tidak tersedia:
→ gunakan INDEX.md + conventions.md + targeted capability lookup
→ jangan otomatis membaca conventions.json penuh
```

Command lama tetap harus bekerja:

```bash
sliceui transcribe <input>
sliceui resolve <input>
sliceui spec <input>
sliceui referee --target <name>
sliceui verify <dir> <name>
```

Jangan mengubah CLI positional arguments kecuali benar-benar diperlukan.

## 15. Source-of-Truth Policy

Terapkan dan dokumentasikan policy berikut:

```text
transcript.json    = authoritative design facts
transcript.md      = agent-readable projection
resolved.json      = derived implementation candidates
spec.md            = primary generation document
conventions.json   = machine-only conventions and verify ground truth
conventions.md     = agent-readable convention projection
pilar-catalog.mjs  = authoritative Pilar public API
agent-context.md   = design-scoped agent context projection
context-manifest   = design-scoped machine manifest
```

`agent-context.md` bukan authority baru. Ia hanya projection terpilih dari sources tersebut.

## 16. Tests Wajib

Tambahkan atau update tests dengan perubahan sekecil mungkin.

Minimal test cases:

### 16.1 Context artifact generation

Given transcript dan conventions fixture,
when `sliceui spec` dijalankan,
then:

- `spec.md` tetap dibuat;
- `context-manifest.json` dibuat;
- `agent-context.md` dibuat;
- manifest valid JSON;
- schema version tersedia;
- metrics tersedia.

### 16.2 No full conventions leakage

Pastikan:

- `agent-context.md` tidak mengandung `loadedClassRegistry`;
- tidak berisi seluruh daftar class;
- tidak menyalin seluruh `conventions.json`;
- tidak menyalin seluruh `ngDeepCorpus`;
- hanya recipe relevan yang muncul.

### 16.3 Capability pruning

Untuk fixture tanpa table:

- tidak ada `uii-table` capability;
- tidak ada table dangerous defaults;
- tidak ada table showcase example.

Untuk fixture dengan table:

- exact relevant inputs tersedia;
- case-sensitive names dipertahankan;
- tidak ada capability component yang tidak digunakan.

### 16.4 Public API precedence

Jika `paginationAlign` tersedia pada `uii-table`:

- context menampilkan public input tersebut;
- context tidak merekomendasikan behavioral `::ng-deep` alignment.

### 16.5 Skill contract

Tambahkan test atau snapshot yang membuktikan:

- primary skill tidak memerintahkan membaca `conventions.json` secara default;
- primary skill memprioritaskan `agent-context.md`;
- `resolved.json` adalah debug/fallback jika `spec.md` telah tersedia;
- full Pilar docs hanya targeted fallback.

### 16.6 Context budget

Test:

- metrics dihitung konsisten;
- estimated token formula benar;
- warning muncul bila budget terlampaui;
- mandatory API facts tidak dipotong.

### 16.7 Backward compatibility

- existing spec tests tetap lulus;
- existing resolve tests tetap lulus;
- snapshot tanpa agent context tetap dapat digunakan;
- no breaking change terhadap transcript/resolved/spec consumers.

Gunakan fixtures existing bila cukup. Jangan membuat fixture besar yang duplikatif tanpa alasan.

## 17. Validation Wajib

Jalankan validasi tersempit yang relevan:

1. Tests baru untuk agent context.
2. Existing spec tests.
3. Existing resolve tests.
4. Existing conventions tests.
5. Existing Pilar catalog/typecheck tests yang terdampak.
6. Full test suite jika waktu memungkinkan.
7. CLI smoke test menggunakan temporary copy, bukan menimpa `.sliceui` project nyata.

Pada smoke test, ukur:

- ukuran `agent-context.md`;
- estimated tokens;
- capability count;
- style recipe count;
- unused capability count;
- raw source example count;
- apakah spec output lama tetap dihasilkan.

Gunakan fixture `figml-export (7)` melalui copy sementara jika aman. Jangan menimpa snapshot nyata tanpa backup.

Jangan menyatakan berhasil bila test tidak dijalankan.

Gunakan bahasa validasi yang akurat:

```text
Passed: <command and count>
Not run: <reason>
Failed: <exact failure>
```

## 18. Acceptance Criteria

Perubahan selesai hanya jika seluruh kriterianya terpenuhi:

- [ ] Agent tidak diarahkan membaca `conventions.json` secara default.
- [ ] `conventions.json` tetap tersedia untuk CLI dan verifier.
- [ ] `spec.md` menjadi primary generation document.
- [ ] `resolved.json` tidak menjadi bacaan wajib ketika `spec.md` tersedia.
- [ ] `agent-context.md` dibuat per desain.
- [ ] `context-manifest.json` dibuat per desain.
- [ ] Agent context hanya membawa capability relevan.
- [ ] Unused capabilities pada context manifest = 0 untuk fixtures yang diuji.
- [ ] Raw repository source examples pada context = 0.
- [ ] Full Pilar showcase tidak disalin ke agent context.
- [ ] Full Pilar reference tidak disalin ke agent context.
- [ ] Exact case-sensitive API names dipertahankan.
- [ ] Relevant dangerous defaults disertakan.
- [ ] Relevant style recipes dipilih, bukan seluruh corpus.
- [ ] Public API didahulukan dari behavioral deep CSS.
- [ ] Context metrics tersedia.
- [ ] Estimated tokens diberi label sebagai estimasi.
- [ ] Target default context tidak lebih dari 30,000 karakter pada fixture utama, atau warning dan alasan terdokumentasi bila mandatory facts membuatnya lebih besar.
- [ ] Existing `transcribe`, `resolve`, `spec`, dan `verify` contracts tidak rusak.
- [ ] Existing tests yang relevan lulus.
- [ ] Tidak ada repository-wide scan baru.
- [ ] Tidak ada dependency baru tanpa kebutuhan mutlak.

## 19. Dokumentasi

Update hanya dokumentasi yang terdampak langsung:

```text
skill/SKILL.md
README.md atau workflow documentation jika menjelaskan reading order
SLICEUI-OVERVIEW.md jika masih menjadi active source of truth
project architecture/workflow docs yang secara eksplisit menyebut agent membaca conventions.json
```

Jangan mengubah dokumen archive.

Dokumentasikan:

- reading order baru;
- source-of-truth policy;
- role `agent-context.md`;
- role `context-manifest.json`;
- fallback untuk snapshot lama;
- context budget;
- bahwa `conventions.json` adalah machine-only secara default;
- bahwa Pilar docs hanya targeted fallback.

Hindari dokumentasi duplikatif. Pilih satu owning section dan tautkan dari tempat lain bila diperlukan.

## 20. Git dan Safety Rules

Sebelum mulai:

```bash
git status --short
git rev-parse HEAD
node --version
npm --version
```

Jika working tree sudah memiliki perubahan user:

- jangan menghapusnya;
- jangan menimpanya;
- identifikasi file yang sudah berubah;
- kerjakan hanya file yang aman;
- laporkan conflict bila scope bertabrakan.

Jangan menjalankan:

```text
git reset --hard
git clean -fd
git checkout -- .
git restore .
npm update
auto-format seluruh repository
```

Jangan commit kecuali pengguna secara eksplisit meminta.

## 21. Tahapan Kerja

Ikuti urutan berikut.

### Tahap 1: Inspect

Baca minimal:

```text
docs/SLICEUI-READ-PATH-CONTEXT-AUDIT.md
skill/SKILL.md
skill/handoff/SKILL.md
src/commands/spec.mjs
src/lib/resolve.mjs
src/lib/transcript-schema.mjs
src/lib/library-registry.mjs
src/lib/pilar-loader.mjs
src/framework/angular/pilar-catalog.mjs
src/framework/angular/uii-profile.mjs
src/framework/angular/uii-slice-policy.mjs
src/framework/angular/conventions.mjs
test/spec.test.mjs
test/resolve.test.mjs
test/pilar-catalog.test.mjs
```

Telusuri producer/consumer artifacts sebelum mengubah code.

### Tahap 2: Write short implementation note

Sebelum perubahan, tulis ringkasan pada respons kerja Claude, bukan file baru:

- file yang akan diubah;
- helper yang akan ditambah;
- bagaimana context dipilih;
- bagaimana backward compatibility dijaga;
- test yang akan dibuat.

Tidak perlu meminta confirmation jika implementasinya mengikuti scope ini.

### Tahap 3: Implement minimal context builder

Prefer helper kecil, pure bila memungkinkan, misalnya conceptual functions:

```text
buildDesignInventory()
selectCapabilities()
selectDangerousDefaults()
selectStyleRecipes()
buildContextManifest()
renderAgentContext()
measureContext()
```

Nama aktual harus mengikuti convention repository.

### Tahap 4: Integrate with spec

Pastikan:

- current `spec.md` output tetap ada;
- context files ditulis ke artifact directory yang sama;
- output console menampilkan metrics ringkas;
- failure menulis context tidak meninggalkan artifact set setengah valid tanpa diagnostic.

### Tahap 5: Update skill

Sederhanakan reading order. Jangan menambah instruksi panjang yang mengulang `agent-context.md`.

### Tahap 6: Tests

Tambahkan test terfokus, lalu jalankan relevant suite.

### Tahap 7: Smoke validation

Gunakan temporary project atau copy `.sliceui`. Jangan mengubah fixture nyata bila tidak diperlukan.

### Tahap 8: Review

Periksa:

- no unrelated refactor;
- no new repository scan;
- no full JSON leakage;
- no invalid Pilar input names;
- no obsolete docs;
- no broken fallback.

## 22. Hal yang Memerlukan Keputusan Konservatif

Jika terdapat ambiguity, gunakan keputusan berikut:

### Apakah `conventions.json` dihapus?

Tidak. Tetap machine artifact untuk verifier dan CLI.

### Apakah `resolved.json` dihapus?

Tidak. Tetap artifact derivatif dan diagnostic.

### Apakah `spec.md` dihapus?

Tidak. Tetap primary generation document.

### Apakah Pilar docs dihapus?

Tidak. Tetap tersedia sebagai fallback targeted lookup dan dokumentasi manusia.

### Apakah command baru dibuat?

Tidak, kecuali integrasi ke `spec` terbukti tidak layak. Jelaskan sebelum membuat command baru.

### Apakah seluruh capability catalog dimasukkan ke manifest?

Tidak. Hanya capability yang terkait design inventory.

### Apakah unknown mapping ditebak?

Tidak. Tulis unresolved dengan reason.

### Apakah style recipe boleh menggantikan public behavior API?

Tidak.

### Apakah context budget boleh menghapus mandatory facts?

Tidak. Emit warning jika mandatory content menyebabkan budget terlampaui.

## 23. Respons Akhir yang Diharapkan

Setelah implementasi selesai, berikan ringkasan dengan struktur berikut:

### Summary

Jelaskan perubahan secara ringkas.

### Files Changed

Daftar file dan tujuan perubahan masing-masing.

### New Agent Reading Order

Tuliskan urutan baca final.

### Context Reduction Results

Untuk fixture utama tampilkan:

```text
Before estimated default context : ...
After agent-context characters   : ...
After estimated tokens           : ...
Capabilities selected            : ...
Style recipes selected           : ...
Unused capabilities              : ...
Raw source examples              : ...
Budget exceeded                  : yes/no
```

Jangan mengarang angka before jika tidak dapat diukur dengan pasti. Labeli asumsi dan estimasi.

### Validation

Tuliskan command yang dijalankan dan hasilnya.

### Compatibility

Jelaskan compatibility snapshot lama dan command lama.

### Known Limitations

Tuliskan keterbatasan yang belum diselesaikan dalam PR ini.

### Deferred Findings

Cantumkan tetapi jangan implementasikan:

- referee hot-path scan;
- duplicate snapshot blobs;
- verify PascalCase normalization;
- filesystem tracing gaps;
- visual verification.

### Git Status

Sertakan:

```bash
git status --short
```

Jangan melakukan commit.

## 24. Definition of Done

Task ini selesai jika:

1. Context generation per desain tersedia.
2. Agent tidak perlu membaca full machine conventions.
3. Public component APIs dipilih secara design-scoped.
4. Context dapat diukur.
5. Existing pipeline tetap kompatibel.
6. Tests relevan lulus.
7. Tidak ada perubahan di luar scope.
8. Dokumentasi reading order telah sinkron.
9. Hasil nyata menunjukkan pengurangan context signifikan.
10. Semua limitation dilaporkan secara transparan.

Mulai dengan inspeksi source dan audit report. Jangan langsung menulis ulang pipeline. Implementasikan perubahan minimal yang memenuhi acceptance criteria dan pertahankan seluruh behavior yang tidak terkait.
