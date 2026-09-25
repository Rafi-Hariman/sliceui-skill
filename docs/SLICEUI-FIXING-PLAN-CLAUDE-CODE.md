# SliceUI Fixing Plan for Claude Code

> Implementation plan untuk meningkatkan akurasi, determinisme, kecepatan, dan efisiensi token SliceUI.
>
> Target baseline: SliceUI v0.15.0 dengan Node.js >= 20.
>
> Prinsip utama: scan repository sekali saat `init` atau `refresh`, lalu gunakan snapshot `.sliceui/` untuk seluruh hot path slicing.

---

## 0. Instruksi untuk Claude Code

Kerjakan perubahan ini langsung di repository SliceUI.

Sebelum mengubah kode:

1. Baca `SLICEUI-OVERVIEW.md`, `skill/SKILL.md`, dan implementasi command saat ini.
2. Temukan entry point untuk `init`, `detect`, `transcribe`, `resolve`, `spec`, `referee`, dan `verify`.
3. Petakan semua fungsi yang melakukan repository traversal, glob, grep, pembacaan contoh source, atau pengiriman source code ke model.
4. Jalankan test suite saat ini untuk mendapatkan baseline.
5. Jangan menghapus behavior lama sebelum tersedia migration path dan regression test.

Aturan implementasi:

- Jangan membuat redesign besar yang tidak diperlukan.
- Pertahankan CLI compatibility sejauh mungkin.
- Gunakan TypeScript types yang eksplisit.
- Jangan menyembunyikan fallback atau deep scan.
- Default hot path tidak boleh melakukan repository-wide traversal.
- Semua keputusan hasil resolve harus mempunyai provenance.
- Public component API harus diprioritaskan sebelum CSS internal override.
- Jangan mengklaim selesai sebelum seluruh acceptance criteria P0 lulus.

---

## 1. Masalah yang Harus Diselesaikan

### 1.1 Performa

Proses slicing dapat memakan waktu lebih dari lima menit karena command per-slice mencari ulang referensi di repository. Repository search dilakukan untuk menemukan pola komponen, API library, reusable class, `::ng-deep`, icon mapping, dan contoh wiring.

Masalah:

- pekerjaan indexing diulang pada setiap slice;
- file source yang sama dibaca berkali-kali;
- prompt atau context agent memuat source code yang terlalu panjang;
- hasil dapat berubah berdasarkan kandidat source yang ditemukan saat runtime;
- `resolve`, `spec`, `referee`, atau `verify` berpotensi mencampurkan indexing dan slicing.

### 1.2 Konsumsi token

Agent menerima terlalu banyak source code mentah, padahal mayoritas informasi dapat diringkas saat `sliceui init` menjadi aturan terstruktur.

Contoh pemborosan:

- beberapa komponen referensi penuh hanya untuk mengetahui pola `@Component`;
- seluruh capability project dikirim walaupun desain hanya memakai select dan table;
- seluruh corpus styling dikirim walaupun hanya dua block yang diperlukan;
- file repository dibaca ulang untuk membuktikan informasi yang sudah disimpan di `.sliceui/`.

### 1.3 Akurasi slicing

Kasus yang sudah ditemukan:

1. Outer padding dibuat dari asumsi wrapper atau modal.
2. Koordinat canvas Figma berisiko diterjemahkan sebagai margin atau centering.
3. Icon `sync` salah dipetakan menjadi search.
4. Search milik toolbar table salah diklasifikasikan sebagai page search atau dimatikan.
5. Pagination dipindahkan dengan banyak `::ng-deep`, padahal tersedia public input alignment.
6. Binding Angular yang tidak terverifikasi dapat dibuat, misalnya `[pagination]`.
7. Wrapper, shadow, `max-width`, dan card semantics dapat diinvent tanpa bukti XML.
8. Required marker untuk field optional dibuat lalu disembunyikan.
9. Import, service injection, atau lifecycle infrastructure dapat dibuat walaupun tidak dipakai.

### 1.4 Gate trustworthiness

`verify` harus memenuhi:

```text
red   = defect nyata atau context stale yang harus diperbaiki
green = output dapat dijelaskan dari design + project capability snapshot
```

Gate tidak boleh pass karena data ground truth tidak tersedia. Gate juga tidak boleh melakukan scan mahal yang seharusnya sudah diselesaikan saat indexing.

---

## 2. Target Arsitektur

Gunakan model berikut:

```text
init / refresh = compiler front-end untuk project
.sliceui/      = compiled Project Knowledge Index
per-slice      = deterministic lookup terhadap index
--deep         = fallback eksplisit, bukan default
```

### 2.1 Cold path

Cold path boleh membaca repository:

```text
sliceui init
sliceui refresh
sliceui index
sliceui referee --context
```

Cold path bertugas:

- deteksi framework dan versinya;
- deteksi struktur module/component;
- ekstraksi public API komponen;
- ekstraksi conventions;
- ekstraksi reusable classes;
- ekstraksi locked style corpus;
- ekstraksi icon registry;
- ekstraksi module manifest;
- ekstraksi minimal writing patterns;
- pembuatan provenance dan fingerprint.

### 2.2 Hot path

Hot path default tidak boleh melakukan repository-wide search:

```text
sliceui transcribe
sliceui resolve
sliceui spec
sliceui referee --target
sliceui verify
```

Hot path hanya boleh membaca:

```text
.sliceui/**
design input
generated target files
owning NgModule target jika diperlukan
```

Jika context stale atau capability tidak ditemukan:

- berhenti dengan diagnostic yang actionable; atau
- gunakan native HTML dan flag sesuai handoff; atau
- lakukan deep scan hanya jika pengguna memberikan `--deep`.

Jangan silently scan repository.

---

## 3. Struktur `.sliceui/` Baru

Implementasikan Project Knowledge Index sebagai artifacts terpisah dan versioned.

```text
.sliceui/
├── config.json
├── index-manifest.json
├── project-fingerprint.json
├── project-context.json
├── framework-rules.json
├── component-capabilities.json
├── semantic-role-map.json
├── conventions.json
├── style-corpus.json
├── icon-registry.json
├── component-patterns.json
├── module-manifest.json
├── provenance.json
├── cache/
│   ├── files.json
│   └── content/
└── artifacts/
    └── <slice-name>/
        ├── transcript.json
        ├── transcript.md
        ├── transcript.meta.json
        ├── resolved.json
        ├── spec.md
        ├── referee.json
        └── verify.json
```

### 3.1 `index-manifest.json`

```json
{
  "schemaVersion": 1,
  "sliceuiVersion": "0.15.0",
  "createdAt": "ISO_DATE",
  "updatedAt": "ISO_DATE",
  "status": "fresh",
  "artifacts": {
    "projectContext": "project-context.json",
    "frameworkRules": "framework-rules.json",
    "componentCapabilities": "component-capabilities.json",
    "semanticRoleMap": "semantic-role-map.json",
    "conventions": "conventions.json",
    "styleCorpus": "style-corpus.json",
    "iconRegistry": "icon-registry.json",
    "componentPatterns": "component-patterns.json",
    "moduleManifest": "module-manifest.json",
    "provenance": "provenance.json"
  }
}
```

### 3.2 `project-fingerprint.json`

Simpan hash file konfigurasi dan fingerprint source yang relevan.

```json
{
  "schemaVersion": 1,
  "packageJsonHash": "sha256:...",
  "lockfileHash": "sha256:...",
  "frameworkConfigHash": "sha256:...",
  "tsconfigHash": "sha256:...",
  "indexedSourceHash": "sha256:...",
  "indexedAt": "ISO_DATE",
  "fileCount": 0
}
```

Freshness check harus murah. Jangan menghitung ulang seluruh source hash pada setiap hot-path command. Gunakan manifest file, mtimes, cached hashes, dan selected configuration hashes.

### 3.3 `component-capabilities.json`

Simpan API komponen dengan nama input persis, default, constraint, dan provenance.

```json
{
  "schemaVersion": 1,
  "components": {
    "uii-table": {
      "package": "pilar",
      "version": "3.3.18",
      "publicInputs": {
        "rows": "rows",
        "columns": "columns",
        "actionColumn": "actionColumn",
        "checkboxColumn": "checkboxColumn",
        "search": "searchOptions",
        "limit": "limitOptions",
        "pagination": "paginationOptions",
        "paginationAlignment": "paginationAlign",
        "footerInfo": "footerInfo"
      },
      "defaults": {
        "actionColumn": true
      },
      "rules": {
        "clientModeOnlyForSlice": true,
        "paginatedMockRows": 15,
        "rowAuthorizationRequiredForActions": true
      },
      "provenanceIds": ["prov-uii-table-inputs"]
    },
    "uii-pagination": {
      "package": "pilar",
      "publicInputs": {
        "currentPage": "currentPage",
        "amountOfData": "amountOfData",
        "dataPerPage": "dataPerPage",
        "alignment": "paginationALign"
      },
      "provenanceIds": ["prov-uii-pagination-inputs"]
    }
  }
}
```

Nama input harus case-sensitive. Jangan menormalisasi `paginationALign` menjadi `paginationAlign`.

### 3.4 `style-corpus.json`

```json
{
  "schemaVersion": 1,
  "blocks": [
    {
      "id": "ngx-select-open-state",
      "category": "select",
      "scope": "visual-internal",
      "locked": true,
      "contentHash": "sha256:...",
      "content": "...",
      "selectors": [
        ".ngx-select__choices",
        ".ngx-select__item_active",
        ".ngx-select__item_active:hover"
      ],
      "provenanceIds": ["prov-select-styles"]
    }
  ]
}
```

Scope yang didukung:

```text
visual-internal
behavioral
layout
status-style
```

Aturan:

- `visual-internal` dapat dimasukkan ketika category dipakai desain.
- `behavioral` dan `layout` tidak boleh dipilih jika public component API menangani intent yang sama.
- locked block diverifikasi memakai hash.

### 3.5 `component-patterns.json`

Jangan simpan source component penuh. Simpan pola yang sudah diekstrak.

```json
{
  "angularComponent": {
    "moduleBased": true,
    "standalone": false,
    "templateUrl": true,
    "styleUrls": true,
    "dependencyInjection": "constructor",
    "lifecycle": ["OnInit"],
    "helperNaming": ["initX", "getX"],
    "eventNaming": "onXxx"
  },
  "tableColumns": {
    "builderMethod": "initColumns",
    "shape": ["name", "prop", "type"],
    "htmlType": "html",
    "numberType": "number"
  }
}
```

### 3.6 `provenance.json`

```json
{
  "schemaVersion": 1,
  "entries": {
    "prov-uii-table-inputs": {
      "kind": "component-api",
      "sourceFiles": ["relative/path/to/source-or-dts"],
      "sourceHashes": ["sha256:..."],
      "extractedAt": "ISO_DATE"
    }
  }
}
```

Hot path membaca provenance metadata, bukan source file.

---

## 4. Perubahan Command

## 4.1 `sliceui init`

Tujuan baru:

```text
setup + full indexing + context referee
```

Implementasi:

1. Deteksi framework dan versi.
2. Deteksi package library.
3. Ekstrak public component API.
4. Ekstrak project conventions.
5. Ekstrak locked style corpus.
6. Ekstrak icon registry.
7. Ekstrak module manifest.
8. Ekstrak compact writing patterns.
9. Tulis fingerprint.
10. Jalankan `referee --context`.
11. Tulis `index-manifest.json` dengan status `fresh` hanya jika context referee lulus.

Output CLI minimum:

```text
Project index created
Files scanned           : N
Capabilities extracted  : N
Style blocks indexed    : N
Icons indexed           : N
Modules indexed         : N
Context referee         : PASS
```

## 4.2 Tambahkan `sliceui refresh`

Command baru:

```bash
sliceui refresh
sliceui refresh --changed-only
sliceui refresh --framework
sliceui refresh --capabilities
sliceui refresh --styles
sliceui refresh --icons
sliceui refresh --modules
sliceui refresh --full
```

Default harus setara dengan:

```bash
sliceui refresh --changed-only
```

Perilaku:

- gunakan hash cache;
- scan hanya file baru, berubah, atau dihapus;
- rebuild artifacts yang terdampak;
- jalankan context referee;
- update fingerprint atomically;
- jangan meninggalkan mixed old/new index jika gagal.

Gunakan temporary directory lalu atomic rename.

## 4.3 `sliceui transcribe`

Tidak perlu membaca repository.

Input:

```text
XML/FIGML atau image
```

Output transcript harus menyimpan:

- source nodes;
- exact text;
- exact color;
- spacing;
- radius;
- visibility;
- component metadata;
- parent-child relationships;
- sibling relationships;
- Auto Layout alignment;
- canvas coordinates dengan scope `canvas-position`;
- internal padding dengan scope `root-internal` atau `child-internal`.

Tambahkan tipe:

```ts
interface LayoutEvidence {
  scope: 'canvas-position' | 'root-internal' | 'child-internal';
  sourceNodeId: string;
  x?: number;
  y?: number;
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
  emitCss: boolean;
}
```

Aturan:

```text
canvas-position → emitCss=false
root/child padding → emitCss=true
```

## 4.4 `sliceui resolve`

Default mode:

```text
transcript + Project Knowledge Index → resolved intent
```

Dilarang pada default mode:

- repository-wide glob;
- source example search;
- grep codebase;
- membuka file reference mentah;
- model call untuk mencari project idiom yang sudah terindeks.

Tambahkan flag:

```bash
sliceui resolve design.xml --deep
```

`--deep` hanya dijalankan jika diminta eksplisit.

Resolution order:

```text
1. framework build constraints
2. verified public component API
3. explicit XML properties
4. structural relationship in XML
5. project reusable class
6. locked visual style corpus
7. conservative native fallback
```

Setiap resolved decision wajib mempunyai:

```ts
interface ResolvedDecision {
  intent: string;
  value: unknown;
  sourceNodeIds: string[];
  evidence: string[];
  implementationKind:
    | 'component-api'
    | 'project-class'
    | 'local-css'
    | 'locked-style-block'
    | 'native-html'
    | 'fallback';
  implementation: unknown;
  capabilityId?: string;
  styleBlockIds?: string[];
  confidence: number;
  fallbackUsed: boolean;
}
```

Jika capability tidak ditemukan:

```text
- jangan silent repo scan;
- emit native fallback jika aman;
- beri warning di resolved output;
- sarankan `sliceui refresh` atau `--deep`.
```

## 4.5 `sliceui spec`

Spec harus design-driven dan budgeted.

Tambahkan inventory pass:

```text
Design memakai select, table, checkbox, pagination, button
→ sertakan hanya capability tersebut
```

Jangan sertakan capability yang tidak dipakai.

Tambahkan config:

```json
{
  "contextBudget": {
    "maxCharacters": 30000,
    "maxExamplesPerCategory": 0,
    "maxStyleBlocks": 12,
    "includeUnusedCapabilities": false,
    "includeRawSource": false
  }
}
```

Spec harus berisi:

1. Framework constraints ringkas.
2. Design inventory.
3. Hierarki visual.
4. Exact text.
5. Resolved component mapping.
6. Required public inputs.
7. Required local CSS facts.
8. Required locked style block IDs/content.
9. Mock-data rules.
10. Output file target.
11. Verify-relevant assertions.

Spec tidak boleh berisi source component repository penuh.

## 4.6 Pisahkan `referee --context` dan `referee --target`

### `sliceui referee --context`

Dijalankan pada `init` atau `refresh`.

Boleh membaca repository untuk:

- memastikan capability masih valid;
- memastikan style block masih ada;
- memastikan input case sama;
- memastikan provenance source hash cocok;
- memastikan framework version benar.

Hasil:

```json
{
  "status": "pass",
  "trustedIndexHash": "sha256:...",
  "checkedAt": "ISO_DATE"
}
```

### `sliceui referee --target <name>`

Dijalankan per slice.

Tidak membaca seluruh repository. Hanya memeriksa:

- transcript integrity;
- fidelity threshold;
- resolved decisions;
- required capability tersedia pada trusted snapshot;
- tidak ada stale index warning;
- tidak ada missing ground truth.

## 4.7 `sliceui verify`

Default mode tidak boleh scan repository luas.

Allowed reads:

```text
.sliceui/**
generated component files
owning module file jika diberikan
```

Tambahkan opsi:

```bash
sliceui verify <component> <name> --module path/to/module.ts
sliceui verify <component> <name> --deep
```

`--deep` opt-in.

Verify harus melakukan checks lintas-artifact yang dijelaskan pada bagian 8.

---

## 5. Semantic Intermediate Representation

Tambahkan semantic classification sebelum framework emitter.

Role minimum:

```text
page-root
page-title
page-divider
filter-section
filter-row
filter-field
filter-action
table-section
table-toolbar
table-limit
table-search
table
table-column
table-footer-info
table-pagination
bulk-action-toolbar
status-label
modal-root
modal-header
modal-body
modal-footer
```

Contoh table search:

```json
{
  "role": "table-toolbar",
  "sourceNodeId": "...",
  "children": [
    { "role": "table-limit", "sourceNodeId": "..." },
    { "role": "table-search", "sourceNodeId": "..." }
  ],
  "nextSiblingRole": "table"
}
```

Resolve map:

```text
table-search + uii-table capability
→ [searchOptions]="true"
```

Page search:

```text
filter-field with search semantics
→ native/project input
→ [searchOptions]="false"
```

---

## 6. Public API Before Deep CSS

Implementasikan policy engine:

```ts
function chooseImplementation(intent, capabilities, styles) {
  if (capabilities.hasPublicApi(intent)) {
    return capabilities.publicApi(intent);
  }

  if (capabilities.hasProjectClass(intent)) {
    return capabilities.projectClass(intent);
  }

  if (styles.hasVisualInternalBlock(intent)) {
    return styles.visualInternalBlock(intent);
  }

  return nativeFallback(intent);
}
```

Contoh pagination alignment:

```text
Design intent: right
uii-table public API: paginationAlign
Output: [paginationAlign]="'right'"
Deep CSS alignment: forbidden
```

Standalone pagination:

```text
uii-pagination public API: paginationALign
```

Public input case harus persis.

Tambahkan error:

```text
SUI-API-001 Public capability ignored in favor of deep CSS
```

---

## 7. Fidelity Fixes Berdasarkan Kasus Nyata

## 7.1 Canvas position bukan outer spacing

Jangan translasi:

```xml
x="270" y="140"
```

menjadi:

```scss
margin: 140px auto 0;
padding: 20px;
position: absolute;
```

Hanya root `paddingLeft`, `paddingTop`, dan sejenisnya yang boleh menjadi internal padding.

Error:

```text
SUI-LAYOUT-001 Canvas coordinate emitted as layout CSS
```

## 7.2 Wrapper invention detector

Setiap wrapper output harus mempunyai provenance:

```text
source XML frame
framework-mandated host
verified library wrapper
accessibility requirement
```

Jika tidak:

```text
SUI-STRUCT-004 Wrapper has no design or framework evidence
```

Periksa khusus:

```text
max-width
margin: 0 auto
box-shadow
outer padding
card wrapper
modal wrapper
absolute positioning
```

## 7.3 Modal evidence classifier

Jangan klasifikasikan modal hanya karena:

- rounded root;
- fixed width;
- header/body/footer;
- centered buttons;
- x/y berada di tengah Figma canvas.

Modal evidence valid:

```text
backdrop
close control
explicit modal/dialog node name
verified modal component instance
modal host metadata
```

Error:

```text
SUI-STRUCT-007 Modal semantics emitted without modal evidence
```

## 7.4 Icon resolver

Resolution order:

```text
componentProperties
variantProperties
mainComponent registry
instance semantic name
vector/icon fingerprint
text-based fallback
```

Jika metadata `sync`, jangan pilih search berdasarkan label tombol.

Simpan:

```json
{
  "designIcon": "sync",
  "projectIcon": "fa-refresh",
  "mappingSource": "icon-registry",
  "confidence": 0.98
}
```

Error:

```text
SUI-ICON-002 Icon metadata ignored in favor of text inference
```

## 7.5 Optional element omission

Jika XML menyatakan:

```text
required=false
visible=false
```

Jangan emit element lalu sembunyikan.

```text
required=true  → emit marker
required=false → omit marker
visible=false  → omit element kecuali structural requirement terverifikasi
```

## 7.6 Unknown Angular input prevention

Semua Angular binding harus berasal dari capability index atau framework metadata.

Error:

```text
SUI-NG-INPUT-001 Unknown input on component
SUI-NG-INPUT-002 Input casing mismatch
```

Contoh forbidden tanpa evidence:

```html
[pagination]
```

## 7.7 Dead code prevention

Jangan emit:

- `OnDestroy` tanpa subscription/resource cleanup;
- `destroy$` tanpa penggunaan;
- service injection tanpa penggunaan;
- unused import;
- type import tanpa penggunaan;
- speculative navigation route;
- speculative API service.

Tambahkan output lint.

---

## 8. Verify Rules

## 8.1 Design-to-code rules

```text
XML visible text
→ harus muncul literal di output
```

```text
XML table toolbar contains search
→ output harus memakai table search capability atau equivalent visible search
```

```text
XML footer pagination is right-aligned
→ output harus memakai verified API/CSS implementation untuk right alignment
```

```text
XML required=false
→ output tidak boleh mempunyai hidden required marker
```

```text
XML action edit=true
→ uii-table action enabled + row authorization flag sesuai project
```

```text
Paginated client table
→ exactly configured mock row floor
```

## 8.2 Code-to-design rules

```text
Output wrapper
→ harus mempunyai sourceNode/framework provenance
```

```text
Output box-shadow
→ harus mempunyai design effect/project requirement provenance
```

```text
Output max-width
→ harus mempunyai sizing intent provenance
```

```text
Output deep CSS behavior
→ gagal jika public API capability tersedia
```

## 8.3 Framework rules

Angular 13 checks:

```text
no standalone: true
no inject()
no @if/@for
constructor DI only
component exists in declarations
FormsModule present when ngModel is used
known component inputs only
```

## 8.4 Ground-truth rules

Verify tidak pernah pass jika:

- transcript tidak ada;
- resolved artifact tidak ada;
- project index tidak trusted;
- required capability tidak ada;
- index stale dan perubahan menyentuh dependency/capability yang dipakai.

---

## 9. Repository Access Guard

Implementasikan hot-path filesystem guard.

Contoh API:

```ts
interface ReadPolicy {
  allowedRoots: string[];
  deniedRoots: string[];
  mode: 'snapshot' | 'deep';
}
```

Snapshot mode:

```text
allowed:
- .sliceui/
- design input
- generated component target
- explicit module target

denied:
- repository-wide glob
- source tree traversal
- package source search
```

Tambahkan instrumentation yang menghitung:

```text
files read
bytes read
repository files read outside allowlist
glob operations
deep-search operations
```

Test harus gagal jika hot path membaca file source di luar policy.

---

## 10. Context dan Token Budget

Implementasikan pruning berdasarkan design inventory.

Config default:

```json
{
  "contextBudget": {
    "maxCharacters": 30000,
    "includeRawSource": false,
    "includeUnusedCapabilities": false,
    "maxExamplesPerCategory": 0,
    "maxStyleBlocks": 12
  }
}
```

Aturan:

- Jangan kirim source repo mentah ke agent secara default.
- Jangan sertakan capability yang tidak dipakai.
- Jangan sertakan style block yang tidak dipakai.
- Jangan sertakan seluruh status taxonomy jika desain hanya memakai satu status.
- Jangan sertakan semua framework documentation.
- Sertakan exact public input names yang relevan.
- Sertakan source path hanya sebagai provenance reference, bukan source content.

Jika budget terlampaui:

1. buang unused hints;
2. compact prose;
3. deduplicate rules;
4. jangan membuang exact text, layout facts, API names, atau required style blocks;
5. gagal dengan diagnostic jika facts wajib tetap melebihi batas.

---

## 11. Caching

Gunakan content-addressed cache.

Cache key minimum:

```text
file content hash
extractor version
schema version
relevant config hash
```

Cache categories:

```text
parsed AST
component API extraction
style block extraction
icon mapping
module manifest
component pattern extraction
```

Jangan gunakan absolute path sebagai satu-satunya key.

Invalidation:

- extractor version berubah;
- schema version berubah;
- source hash berubah;
- config relevan berubah.

---

## 12. Observability dan Profiling

Tambahkan flag global atau per command:

```bash
sliceui <command> --profile
sliceui <command> --json-report
```

Output manusia:

```text
Project context source : .sliceui snapshot
Context status         : fresh
Deep scan              : disabled
Repository files read  : 0
Capabilities loaded    : 4
Style blocks loaded    : 3
Spec characters        : 18,420
```

Timing:

```text
XML parse               120 ms
Semantic classification 180 ms
Capability lookup        25 ms
Spec generation          90 ms
Repository scan           0 ms
```

JSON report:

```json
{
  "mode": "snapshot",
  "contextStatus": "fresh",
  "deepScan": false,
  "repositoryFilesRead": 0,
  "timingsMs": {},
  "contextCharacters": {},
  "cache": {
    "hits": 0,
    "misses": 0
  }
}
```

Jangan log secrets, API keys, atau source content.

---

## 13. Diagnostics

Gunakan diagnostics seperti compiler.

Format:

```text
CODE Title

Evidence:
- ...

Generated/Detected:
- ...

Expected:
- ...

Suggested fix:
- ...
```

Contoh:

```text
SUI-API-001 Pagination alignment

Evidence:
- footer uses SPACE_BETWEEN
- pagination is the rightmost footer child

Available capability:
- uii-table.paginationAlign

Generated:
- no paginationAlign input
- internal CSS attempts alignment

Expected:
- [paginationAlign]="'right'"

Suggested fix:
- emit the public input
- remove behavioral alignment overrides
```

Diagnostic codes minimum:

```text
SUI-CONTEXT-001 Missing index
SUI-CONTEXT-002 Stale index
SUI-CONTEXT-003 Untrusted index
SUI-API-001 Public capability ignored
SUI-NG-INPUT-001 Unknown Angular input
SUI-NG-INPUT-002 Input casing mismatch
SUI-LAYOUT-001 Canvas coordinate emitted as layout
SUI-STRUCT-004 Invented wrapper
SUI-STRUCT-007 Unsupported modal semantics
SUI-ICON-002 Icon metadata ignored
SUI-STYLE-001 Locked block modified
SUI-STYLE-002 Unused style block included
SUI-PERF-001 Repository scan attempted in snapshot mode
SUI-PERF-002 Context budget exceeded
```

---

## 14. CLI UX

### Default behavior

```bash
sliceui resolve design.xml
```

Harus menampilkan:

```text
Using trusted project snapshot: .sliceui/
Repository scan: skipped
```

### Stale context

Jangan auto-scan.

```text
Project context is stale.
Run: sliceui refresh --changed-only
Or use: --deep
```

Exit code non-zero hanya jika stale context mengganggu capability yang dipakai. Jika perubahan tidak relevan dan policy mengizinkan, warning dapat diteruskan, tetapi keputusan harus eksplisit dan teruji.

### Deep mode

```bash
sliceui resolve design.xml --deep
```

Harus menampilkan warning:

```text
Deep mode enabled: repository search may be slower and use more context.
```

### Offline mode alias

Opsional:

```bash
sliceui resolve design.xml --snapshot-only
```

Command gagal jika membutuhkan repository access.

---

## 15. Migration Plan

## Phase 1: Instrument current behavior

Sebelum behavior change:

- tambahkan profiler;
- hitung files read;
- hitung globs;
- hitung context size;
- tulis benchmark baseline;
- identifikasi command yang scan repository.

Deliverable:

```text
benchmarks/baseline.json
```

## Phase 2: Build index schema

- tambah schemas;
- tambah readers/writers;
- tambah schema version;
- tambah atomic write;
- generate index dalam `init` tanpa mengubah hot path terlebih dahulu.

## Phase 3: Snapshot-first resolve/spec

- ubah `resolve` menggunakan index;
- ubah `spec` menggunakan resolved/index;
- tambahkan `--deep` untuk behavior lama;
- tambahkan repository read guard.

## Phase 4: Split referee

- implement `referee --context`;
- implement `referee --target` snapshot-only;
- simpan trusted index hash.

## Phase 5: Snapshot-first verify

- gunakan artifacts + target output;
- implement cross-artifact rules;
- validasi binding Angular;
- validasi wrapper invention.

## Phase 6: Incremental refresh

- add file cache;
- add changed-only scanner;
- add partial rebuild dependency graph;
- add atomic index updates.

## Phase 7: Deprecation

Jika sebelumnya command melakukan implicit deep scan:

- release pertama: warning;
- release berikutnya: default snapshot mode;
- pertahankan `--deep` sebagai escape hatch.

Tambahkan migration note pada changelog.

---

## 16. Test Plan

## 16.1 Unit tests

### Fingerprint

- hash stabil untuk input sama;
- perubahan config mengubah fingerprint;
- source file yang tidak relevan tidak mengubah scoped artifact yang tidak terkait.

### Capability extraction

- mempertahankan input case;
- mendeteksi defaults;
- menyimpan provenance;
- tidak membuat input dari usage yang ambigu.

### Semantic classifier

- search bersama limit dan table menjadi `table-search`;
- search dalam filter card menjadi `filter-field`;
- footer `SPACE_BETWEEN` dengan pagination child menjadi right-aligned pagination intent;
- canvas x/y diberi `emitCss=false`.

### Resolver

- public API menang atas deep CSS;
- project class menang atas invented class;
- native fallback hanya saat capability tidak ada;
- setiap decision mempunyai provenance.

### Context pruning

- unused capability dibuang;
- unused style block dibuang;
- exact design text tidak dibuang;
- context budget dihormati.

## 16.2 Integration tests

Buat fixtures minimal:

```text
fixtures/angular13-pilar/
fixtures/designs/add-student-rate/
fixtures/designs/bulk-edit-end-date/
fixtures/designs/edit-bill/
```

Test kasus nyata:

### Add student rate

Harus menghasilkan intent/output:

```text
root padding sesuai XML
sync → fa-refresh
searchOptions=true
paginationAlign='right'
no behavioral pagination deep CSS
no hidden required marker
```

### Bulk edit end date

Harus menghasilkan:

```text
no invented outer content padding jika root tidak memilikinya
no max-width
no margin auto
no shadow
no modal classification tanpa evidence
```

### Edit bill

Harus menghasilkan:

```text
root internal padding=20 karena XML eksplisit
canvas x/y ignored
checkboxColumn=true
actionColumn=true
row auth.canUpdate=true
searchOptions=true
paginationAlign='right'
15 mock rows
```

## 16.3 Filesystem policy tests

Given fresh index:

```text
resolve → repository files outside allowlist = 0
spec → repository files outside allowlist = 0
referee --target → repository files outside allowlist = 0
verify → repository-wide traversal = 0
```

Gunakan spy/mock pada filesystem adapter. Jangan hanya memeriksa log.

## 16.4 Snapshot tests

Snapshot:

- transcript JSON;
- semantic IR;
- resolved decisions;
- spec;
- diagnostics;
- verify report.

Jangan snapshot timestamp atau absolute path.

## 16.5 Regression tests

Test false positives dan false negatives:

- no ground truth never green;
- unknown input fails;
- case mismatch fails;
- wrapper without evidence fails;
- public API implementation passes;
- valid locked block passes hash check;
- modified locked block fails.

---

## 17. Performance Benchmarks

Buat command benchmark atau test runner:

```bash
npm run benchmark:sliceui
```

Benchmark cold path dan hot path terpisah.

Metrics:

```text
wall-clock duration
CPU time
files read
bytes read
glob count
repository files outside .sliceui
context characters
model tokens jika tersedia
cache hit rate
peak memory
```

Target P0 setelah fresh init:

```text
repository-wide reads per slice = 0
raw source examples loaded = 0
unused capabilities in spec = 0
unused style blocks in spec = 0
implicit deep scan = 0
```

Target performa praktis:

```text
resolve + spec untuk XML fixture harus selesai dalam hitungan detik lokal,
bukan menit, tanpa network/model call jika XML tersedia.
```

Jangan membuat target waktu yang flaky pada CI. Gunakan relative benchmark:

```text
hot path baru <= 25% dari baseline median lama
```

Gunakan beberapa run dan median.

---

## 18. Acceptance Criteria

## P0 wajib

- [ ] `sliceui init` membangun trusted Project Knowledge Index.
- [ ] `sliceui resolve` default tidak scan repository.
- [ ] `sliceui spec` default tidak membaca source examples mentah.
- [ ] `sliceui referee --target` tidak scan repository.
- [ ] `sliceui verify` tidak melakukan repository-wide traversal.
- [ ] `--deep` tersedia sebagai opt-in.
- [ ] Freshness fingerprint tersedia.
- [ ] Stale context menghasilkan diagnostic, bukan silent scan.
- [ ] Public component API registry tersedia.
- [ ] Angular input divalidasi case-sensitive.
- [ ] Public API diprioritaskan atas deep CSS.
- [ ] Canvas coordinates tidak menjadi layout CSS.
- [ ] Wrapper invention detector tersedia.
- [ ] Modal classifier membutuhkan evidence.
- [ ] Spec hanya menyertakan capability/style yang dipakai.
- [ ] Profiler melaporkan repository files read dan context size.
- [ ] Tiga fixture kasus nyata lulus regression test.

## P1

- [ ] `sliceui refresh --changed-only` tersedia.
- [ ] Incremental artifact rebuild tersedia.
- [ ] Module manifest tersedia.
- [ ] Icon registry dan provenance tersedia.
- [ ] Locked style blocks menggunakan hash.
- [ ] Context budget configurable.
- [ ] Verify cross-artifact rules lengkap.
- [ ] Dead-code lint tersedia.

## P2

- [ ] Content-addressed cache tersedia.
- [ ] Shared monorepo cache tersedia jika relevan.
- [ ] Visual regression tersedia.
- [ ] DOM contract tests untuk private UI library tersedia.
- [ ] Automatic minimal failure explanation tersedia.

---

## 19. Definition of Done

Perubahan dianggap selesai jika:

1. Seluruh P0 acceptance criteria lulus.
2. Existing tests tetap lulus atau perubahan behavior didokumentasikan.
3. Benchmark menunjukkan hot path tidak membaca repository luas.
4. Context size turun dan dapat dilihat melalui `--profile`.
5. Tiga design fixture menghasilkan resolved intent yang benar.
6. `verify` memberi diagnostics actionable untuk intentional failure fixtures.
7. Documentation diperbarui:
   - `SLICEUI-OVERVIEW.md`;
   - `skill/SKILL.md`;
   - CLI help;
   - migration guide;
   - changelog.
8. Tidak ada silent fallback ke repository search.
9. Tidak ada silent unknown Angular input.
10. `sliceui verify` tetap blocking dan tidak pernah green tanpa ground truth.

---

## 20. Urutan Pull Request yang Disarankan

### PR 1: Profiling dan filesystem instrumentation

- filesystem adapter;
- file read counter;
- context-size report;
- baseline benchmark.

### PR 2: Project Knowledge Index schemas

- schema definitions;
- index writer/reader;
- provenance;
- fingerprint;
- atomic writes.

### PR 3: Capability and pattern extraction

- public component inputs;
- component patterns;
- style corpus;
- icon registry;
- module manifest.

### PR 4: Snapshot-first resolve and spec

- semantic IR;
- provenance decisions;
- design-driven pruning;
- `--deep` escape hatch;
- read guard.

### PR 5: Referee split

- context referee;
- target referee;
- trusted index hash.

### PR 6: Verify improvements

- cross-artifact checks;
- unknown input validation;
- wrapper detector;
- modal evidence;
- API-before-CSS rule.

### PR 7: Incremental refresh and cache

- changed-only refresh;
- dependency invalidation;
- content-addressed cache.

### PR 8: Documentation and migration

- overview;
- skill instructions;
- command help;
- migration notes;
- benchmark report.

Jaga setiap PR kecil, testable, dan dapat direview mandiri.

---

## 21. Suggested First Actions for Claude Code

Mulai dengan langkah berikut:

```text
1. Locate all repository traversal utilities.
2. Wrap filesystem reads behind one adapter.
3. Add counters and --profile output.
4. Run the three real fixtures and record baseline.
5. Define index schemas and TypeScript types.
6. Make init write the index without changing behavior.
7. Convert resolve to snapshot-first behind a feature flag.
8. Add tests proving repository file reads are zero.
9. Enable snapshot-first by default.
10. Implement remaining verification rules.
```

Gunakan feature flag sementara jika diperlukan:

```text
SLICEUI_SNAPSHOT_FIRST=1
```

Hapus feature flag setelah migration selesai dan snapshot-first menjadi default.

---

## 22. Final Technical Principle

Implementasi akhir harus memegang invariant berikut:

```text
Repository knowledge is compiled once.
Design knowledge is parsed once per slice.
Generation uses compact trusted artifacts.
Verification compares artifacts to output.
Repository search is explicit, observable, and exceptional.
```

Tujuan akhirnya bukan hanya mempercepat SliceUI. Tujuan akhirnya adalah membuat hasil lebih konsisten, lebih mudah dijelaskan, lebih hemat token, dan lebih terpercaya karena setiap keputusan berasal dari design evidence atau project capability snapshot yang tervalidasi.
