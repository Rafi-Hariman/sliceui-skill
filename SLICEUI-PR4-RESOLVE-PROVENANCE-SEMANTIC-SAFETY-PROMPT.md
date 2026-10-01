# SliceUI PR 4 Implementation Plan: Resolve Provenance and Semantic Safety

Repository SliceUI:

```text
/Users/bsi-2-2200019/Development/freelance/sliceui-skill
```

Project target nyata yang hanya boleh digunakan sebagai sumber bukti read-only:

```text
/Users/bsi-2-2200019/Development/finance/lib-uii-gateway-bill-angular
```

Checkpoint baseline resmi:

```text
f67f8bb feat(sliceui): add compact agent context and snapshot referee
```

Dokumen yang wajib dibaca sebelum implementasi:

```text
docs/SLICEUI-READ-PATH-CONTEXT-AUDIT.md
docs/SLICEUI-PR1-VERIFICATION-REPORT.md
docs/SLICEUI-PR2-VERIFICATION-REPORT.md
docs/SLICEUI-PR3-VERIFICATION-REPORT.md
docs/project-docs/development/api-contract.md
docs/project-docs/foundation/architecture.md
docs/project-docs/foundation/workflow.md
docs/project-docs/technical-guidelines/verify-gate-trust.md
skill/SKILL.md
```

Prompt PR sebelumnya boleh dibaca hanya sebagai secondary context bila diperlukan. Jangan menjadikannya lebih authoritative daripada source dan verification reports.

## 1. Mandatory Entry Gate

Sebelum mengubah source:

1. Pastikan current repository HEAD memiliki checkpoint `f67f8bb` pada history atau perubahan setara sudah tersedia.
2. Baca laporan verifikasi PR 3.
3. Pastikan PR 3 telah ditutup resmi setelah documentation-only correction `FPR-001`.
4. Pastikan keputusan terakhir menyatakan:

```text
PR 3 official status: COMPLETE
PR 4 may start: YES
```

5. Jalankan baseline tests terdekat dengan resolve, spec, agent context, snapshot, referee, dan verify.
6. Pastikan tidak ada perubahan user yang tidak dikenal atau belum diklasifikasikan.
7. Jika entry gate tidak terpenuhi, hentikan dan laporkan. Jangan mengubah source.

Catat entry-gate evidence pada respons akhir.

## 2. Masalah yang Harus Diselesaikan

Audit dan brainstorming sebelumnya menemukan bahwa `resolved.json` mencampur beberapa jenis informasi:

```text
literal design fact
normalized design fact
semantic hypothesis
project capability fact
implementation recommendation
fallback note
```

Contoh risiko:

```text
Design evidence:
- icon instance/component metadata says sync

Current resolved output:
- fa-refresh

Problem:
- output tidak selalu menyatakan mapping source, confidence, authority,
  rejected alternatives, atau fallback usage.
```

Contoh lain:

```text
Design evidence:
- status text and color

Current resolved output:
- label-custom-active

Problem:
- project idiom recommendation dapat terlihat seperti literal design fact.
```

Risiko utamanya adalah semantic assumptions menjadi authoritative terlalu dini:

```text
transcript
→ resolver inference
→ spec renders inference inline
→ agent follows it as fact
→ output may be internally consistent but semantically wrong
```

PR 4 harus membuat setiap resolved decision traceable, explicitly typed, confidence-scored, and non-authoritative unless the source is genuinely authoritative.

## 3. Tujuan PR 4

Implementasikan provenance dan semantic-safety layer pada resolve pipeline dengan perubahan minimal dan backward-compatible.

PR ini harus menghasilkan:

1. Classification eksplisit untuk setiap resolved entry.
2. Evidence yang menunjuk ke design fact atau project capability source.
3. Provenance yang dapat ditelusuri.
4. Confidence yang konsisten dan terdokumentasi.
5. Authority status yang eksplisit.
6. Fallback usage yang eksplisit.
7. Candidate ranking yang transparan.
8. Rejected alternatives bila material.
9. Public component API precedence atas behavioral CSS.
10. Icon resolver precedence berbasis metadata, bukan label text.
11. Unknown/ambiguous resolution tetap unresolved daripada ditebak.
12. `spec.md` dan `agent-context.md` menampilkan semantic hints sebagai hints, bukan fakta desain.
13. Existing commands dan artifact consumers tetap kompatibel.
14. Tidak ada repository scan baru.
15. Tidak ada perubahan visual verification atau verify architecture yang menjadi scope PR berikutnya.

## 4. Scope yang Diizinkan

PR 4 boleh mengubah:

```text
src/lib/resolve.mjs
src/commands/resolve.mjs
src/commands/spec.mjs
src/lib/agent-context.mjs
src/lib/transcript-schema.mjs
src/lib/render-transcript.mjs hanya jika provenance pointer membutuhkannya
src/framework/angular/pilar-catalog.mjs consumers, bukan generated catalog content
src/framework/angular/uii-profile.mjs bila mapping provenance diperlukan
src/framework/angular/uii-slice-policy.mjs bila precedence policy memang dimiliki di sana
src/lib/library-registry.mjs bila capability provenance perlu diekspos
skill/SKILL.md
tests resolve/spec/agent-context dan fixture terkait
active documentation yang memiliki ownership atas artifact contract
```

Buat helper kecil baru di `src/lib/` bila diperlukan, misalnya conceptual:

```text
resolution-provenance.mjs
resolution-policy.mjs
```

Jangan membuat subsystem besar jika perubahan dapat tetap terpusat pada resolver.

## 5. Di Luar Scope

Jangan mengimplementasikan:

- PR 5 Verify Reliability;
- PascalCase normalization verify;
- unknown Angular input validation baru di verify;
- wrapper/modal invention detector baru di verify;
- render atau visual verification;
- screenshot comparison;
- FIGML parser rewrite;
- repository indexing baru;
- project refresh command;
- referee fingerprint changes;
- verdict atomic-write hardening;
- fs-trace redesign;
- conventions-body conflict CNF-001;
- cold-path scan reuse PER-001;
- TypeScript migration;
- Python rewrite;
- generated Angular output changes unrelated to hints;
- dependency baru tanpa kebutuhan mutlak;
- unrelated cleanup/refactor;
- commit atau push kecuali user meminta setelah verification.

Jika menemukan defect lain, dokumentasikan sebagai deferred finding.

## 6. Core Authority Model

Implementasikan authority hierarchy yang eksplisit dan dapat dieksekusi.

Urutan konseptual:

```text
1. Framework/build constraints
2. Verified public component API
3. Explicit design/XML properties
4. Structural relationships in design
5. Verified project tokens and utility classes
6. Approved reusable visual style corpus
7. Semantic inference
8. Conservative fallback
```

Catatan penting:

- Framework constraint dapat melarang implementation tertentu, tetapi tidak boleh mengubah visible design tanpa diagnostic.
- Public API precedence berlaku untuk cara implementasi behavior, bukan untuk mengalahkan fakta visual desain.
- Explicit XML/design fact tidak boleh dioverride fallback.
- Project samples mengajarkan wiring, bukan structure.
- Semantic inference tidak pernah menjadi literal fact.
- Conservative fallback harus terlihat jelas dan tidak boleh menyamar sebagai verified project idiom.

## 7. Classification Model

Setiap resolved entry wajib memiliki classification atau `kind` yang berasal dari set terbatas.

Contoh conceptual union:

```text
literal-design-fact
normalized-design-fact
structural-design-fact
project-capability
project-token
project-utility
semantic-hypothesis
implementation-recommendation
approved-style-recipe
conservative-fallback
unresolved
```

Gunakan nama yang konsisten dengan repository. Jangan menambah kategori tanpa tests.

Definisi:

### Literal design fact

Exact property dari source design, misalnya:

```text
text
color
padding
gap
radius
component metadata
variant property
required state
checkbox state
```

### Normalized design fact

Transform deterministik, misalnya:

```text
hex normalization
numeric unit normalization
canonical icon metadata name
```

### Structural design fact

Relationship parent-child atau ordering, misalnya:

```text
search and limit share table toolbar
pagination is rightmost footer child
```

### Project capability

Verified exact public API:

```text
uii-table.paginationAlign
uii-table.searchOptions
uii-pagination.paginationALign
```

### Semantic hypothesis

Interpretasi non-authoritative:

```text
node likely represents table toolbar
status likely maps to warning taxonomy
```

### Implementation recommendation

Suggested project-aware implementation:

```text
use [paginationAlign]="'right'"
use label-custom-warning
```

### Conservative fallback

Native or generic implementation karena capability verified tidak tersedia.

### Unresolved

Tidak ada evidence cukup. Jangan menebak.

## 8. Proposed `resolved.json` Contract

Pertahankan top-level compatibility sejauh memungkinkan. Tambahkan schema version jika belum ada atau gunakan versioning existing.

Conceptual shape:

```json
{
  "schemaVersion": 2,
  "design": "figml-export (7)",
  "generatedAt": "ISO-8601",
  "entries": [
    {
      "id": "resolution-id",
      "nodeId": "17214:15859",
      "property": "paginationAlignment",
      "classification": "implementation-recommendation",
      "value": "right",
      "implementation": {
        "category": "component-api",
        "component": "uii-table",
        "binding": "paginationAlign",
        "expression": "'right'"
      },
      "authority": "hint",
      "confidence": 1,
      "fallbackUsed": false,
      "evidence": [
        {
          "type": "structural-design-fact",
          "source": "transcript.layout",
          "path": "footer.primaryAxisAlignItems",
          "value": "SPACE_BETWEEN"
        },
        {
          "type": "project-capability",
          "source": "pilar-catalog",
          "component": "uii-table",
          "api": "paginationAlign"
        }
      ],
      "candidates": [],
      "rejected": [],
      "diagnostics": []
    }
  ]
}
```

Final shape harus mengikuti style project. Wajib:

```text
schema/version
stable entry id or traceable node/property
classification
value or unresolved state
authority
confidence
fallbackUsed
evidence
provenance
candidates when ambiguous
diagnostics
```

Jangan menyimpan full source bodies atau large documentation snippets.

## 9. Authority Values

Gunakan limited enum, misalnya:

```text
authoritative
verified
hint
fallback
unresolved
```

Interpretasi:

```text
authoritative → literal/normalized design fact with deterministic source
verified      → exact project capability or token verified by machine source
hint          → semantic or implementation recommendation
fallback      → conservative implementation because verified mapping absent
unresolved    → insufficient evidence
```

Jangan memberi `authoritative` kepada:

- semantic role classification;
- status taxonomy inference;
- icon mapping dari button text;
- component choice inferred from visual similarity;
- fallback;
- repository sample layout.

## 10. Confidence Policy

Confidence harus deterministic dan policy-based, bukan angka dekoratif dari model.

Gunakan finite scale atau normalized number dengan criteria jelas.

Contoh:

```text
1.00 exact literal fact or exact case-sensitive public API
0.95 deterministic metadata alias mapping
0.85 strong structural relationship + verified capability
0.70 name/color semantic match with supporting evidence
0.50 ambiguous candidates
0.00 unresolved/no evidence
```

Jangan hardcode angka tanpa documented rationale. Lebih baik gunakan named level:

```text
exact
high
medium
low
none
```

lalu optional numeric representation jika consumers membutuhkan.

Acceptance:

- input sama menghasilkan confidence sama;
- confidence tidak bergantung pada ordering tidak deterministik;
- fallback tidak memiliki confidence tinggi;
- multiple candidates menurunkan confidence;
- missing provenance tidak dapat menghasilkan exact/high silently.

## 11. Provenance Contract

Setiap source harus traceable tanpa repository re-scan.

Design provenance dapat menunjuk ke:

```text
transcript.json path
nodeId
property name
raw XML attribute name
componentProperties
variantProperties
parent/child relationship
```

Project provenance dapat menunjuk ke:

```text
pilar catalog component + API name + version
uii profile mapping id
slice policy rule id
conventions corpus entry id/hash
project token id
library registry entry id
```

Fallback provenance harus menunjukkan:

```text
no verified capability found
policy used
candidate count
reason for fallback
```

Jangan gunakan vague provenance seperti:

```text
source: project
source: design
```

jika path yang lebih spesifik tersedia.

## 12. Candidate and Rejection Model

Untuk ambiguous resolution, simpan candidates secara bounded.

Conceptual candidate:

```json
{
  "value": "label-custom-warning",
  "score": 0.72,
  "evidence": [],
  "source": "conventions.classVocabulary"
}
```

Rejected alternatives hanya disimpan bila material untuk memahami decision, misalnya:

```text
public component input exists, so behavioral CSS rejected
icon metadata says sync, so label-text inference search rejected
modal evidence absent, so modal wrapper rejected
```

Jangan menyimpan setiap impossible alternative dan membuat artifact membengkak.

Tetapkan budget:

```text
maximum candidates per resolved property: 3 or existing reasonable limit
maximum rejected alternatives: 3
```

Jika lebih banyak, simpan count dan top candidates.

## 13. Public API Precedence

Ini requirement wajib.

Jika verified public API tersedia untuk behavior:

```text
use component API recommendation
reject behavioral/internal CSS recommendation
```

Contoh:

```text
pagination alignment
→ uii-table.paginationAlign available
→ recommend component-api
→ behavioral ::ng-deep alignment rejected
```

Resolver harus membedakan:

```text
visual internal style
behavioral configuration
layout behavior
```

Approved `::ng-deep` tetap boleh untuk visual state yang tidak tersedia melalui public API, misalnya:

```text
open-state border
hover color
radius
internal icon sizing
```

Namun output provenance wajib menyatakan why CSS is needed.

PR 4 tidak menambah verifier rule baru. Ia menambah safe recommendation/provenance yang nanti dapat digunakan PR 5.

## 14. Icon Resolver Precedence

Implementasikan atau rapikan precedence berikut berdasarkan data yang benar-benar tersedia:

```text
1. componentProperties
2. variantProperties
3. mainComponent ID registry
4. instance semantic name
5. verified vector/icon fingerprint
6. project icon alias registry
7. bounded text-based fallback
8. unresolved
```

Rules:

- Metadata icon tidak boleh dikalahkan button label.
- Text fallback harus `fallbackUsed: true`.
- Text fallback confidence harus lebih rendah.
- Mapping project icon harus menyimpan alias source.
- Unknown icon tidak boleh diganti icon populer secara arbitrer.
- Exact design icon name dan implementation icon harus disimpan terpisah.

Conceptual output:

```json
{
  "property": "icon",
  "designValue": "sync",
  "implementationValue": "fa-refresh",
  "mappingSource": "icon-alias-registry",
  "authority": "hint",
  "confidence": 0.95,
  "fallbackUsed": false
}
```

## 15. Status/Taxonomy Resolution

Status mapping seperti `Aktif`, `Belum bayar`, atau `Dibatalkan` harus menyimpan:

```text
exact design text
exact design colors
candidate project taxonomy classes
project evidence/provenance
confidence
fallback status
```

Rules:

- Text and color both supporting mapping may increase confidence.
- Color alone must not create exact semantic status.
- Project class presence alone does not prove semantic match.
- Ambiguous mapping remains candidates or unresolved.
- Agent context/spec must label taxonomy as recommended project idiom, not design fact.

## 16. Semantic Role Safety

Semantic roles such as:

```text
table-toolbar
table-search
page-search
bulk-action-toolbar
modal-header
modal-body
modal-footer
```

are hypotheses unless explicit semantic metadata exists.

Store:

```text
role
confidence
evidence parent-child relationships
authority = hint
```

Modal/card semantics require evidence. Absence of evidence should produce:

```text
role unresolved or page/component root
rejected modal candidate with reason
```

Do not implement full modal/wrapper verifier in PR 4. Only prevent resolver/spec from presenting unsupported semantics as authoritative.

## 17. Facts Must Remain Separate from Recommendations

Do not mutate transcript literal facts to include project recommendations.

Pipeline target:

```text
transcript.json
→ design facts only

resolved.json
→ typed mappings, hypotheses, recommendations, provenance

spec.md
→ design facts + clearly labeled project hints

agent-context.md
→ verified APIs and bounded project guidance
```

Do not copy implementation recommendations back into transcript.

## 18. Spec Rendering Changes

`spec.md` remains primary generation document.

Update its rendering so resolved items show distinction clearly.

Example conceptual format:

```markdown
Design fact:
- Pagination is the rightmost footer child.

Verified project capability:
- `uii-table.paginationAlign`

Implementation hint:
- Use `[paginationAlign]="'right'"`.

Confidence: exact
Fallback used: no
Evidence: transcript footer relationship + Pilar catalog
```

Keep spec compact. Do not dump full JSON provenance.

Rules:

- literal facts visually separated from hints;
- unresolved items visible;
- fallback warning visible;
- low-confidence hint not stated imperatively;
- exact public API names preserved;
- current layout/design sections remain compatible.

If preserving byte-identical spec is impossible due to intentional safety labels, document expected diff and update snapshots/tests deliberately.

## 19. Agent Context Changes

`agent-context.md` should continue to be compact.

It may include:

```text
verified capabilities
high-value dangerous defaults
relevant style recipes
unresolved capability warnings
high-confidence implementation hints
```

It must not include:

```text
full candidates list
full provenance arrays
all rejected alternatives
full resolved.json
low-value diagnostics
full conventions corpus
```

When hint is low confidence or fallback:

```text
state ambiguity explicitly
instruct agent not to treat it as fact
```

Maintain context budget from PR 1.

## 20. Backward Compatibility

Existing consumers may expect current `resolved.json` fields.

Before changing shape:

1. Audit every producer/consumer.
2. Identify external/public contract documented by project.
3. Prefer additive fields over destructive rename.
4. If schema version increments, support legacy reading where commands consume older artifacts.
5. Do not force re-transcribe when only resolve schema changes, unless explicit diagnostic explains it.
6. Old `resolved.json` should remain readable by `spec` if practical.
7. New spec/agent context should handle both schemas during transition.

Do not carry legacy fields forever without documentation. Use one contained compatibility adapter if needed.

## 21. Determinism Requirements

Same inputs must produce semantically identical output.

Ensure:

- stable ordering by node/property/id;
- candidates stable-sorted by score then deterministic key;
- object hashes not dependent on absolute temp paths;
- timestamps excluded from semantic comparison;
- no random IDs;
- confidence deterministic;
- no repository scan;
- no LLM/network call;
- bounded artifact size.

## 22. Artifact Size Budget

Provenance must not recreate context bloat.

Define and test reasonable budgets.

Suggested starting target:

```text
resolved.json maximum growth on real fixture: <= 3x current size
maximum evidence entries per decision: 5
maximum candidates: 3
maximum rejected alternatives: 3
no source bodies
no full corpus blocks
no full Pilar docs
```

If 3x is insufficient for mandatory traceability, report actual size and justify. Do not silently emit very large artifacts.

Agent context budget remains:

```text
<= 30,000 characters default
```

## 23. Diagnostics

Use diagnostic style existing in repository.

Conceptual codes:

```text
SUI-RESOLVE-001 unresolved capability
SUI-RESOLVE-002 low-confidence semantic mapping
SUI-RESOLVE-003 fallback used
SUI-RESOLVE-004 public API supersedes behavioral CSS
SUI-ICON-002 metadata exists but text inference attempted
```

Do not create excessive codes. Reuse existing mechanism if available.

Diagnostics should state:

```text
property
node/evidence
candidates
selected or unresolved status
recommended action
```

## 24. Audit Consumer Wajib

Before implementation, run:

```bash
rg -n "resolved\.json|resolved\[|resolved\.|resolveTranscript|buildSpec|fallbackUsed|confidence|provenance|candidates|label-custom|FA_ICON|STATUS_LABEL|icon" \
  src test skill docs README.md
```

Classify every consumer:

```text
writer
spec reader
agent-context reader
verify reader
referee reader
test fixture
documentation
external/public contract
```

Note: audit sebelumnya menyatakan verify tidak membaca resolved/spec. Confirm this remains true. Do not make verify dependent on resolved output in PR 4.

## 25. Tests Wajib

### 25.1 Classification

Each resolved entry has valid classification.

### 25.2 Authority

- literal fact → authoritative;
- exact API → verified;
- semantic mapping → hint;
- fallback → fallback;
- insufficient evidence → unresolved.

### 25.3 Confidence determinism

Same input yields same confidence and ordering.

### 25.4 Provenance completeness

Resolved recommendation has design and/or project source trace as required.

### 25.5 Explicit XML wins

Fallback cannot override explicit design value.

### 25.6 Public API supremacy

Given public input available:

- component-api recommendation selected;
- behavioral CSS candidate rejected;
- rejection reason stored.

### 25.7 Visual style exception

Approved visual internal recipe may remain when no public API controls that visual detail.

### 25.8 Icon metadata precedence

Metadata `sync` with button label suggesting search:

- sync metadata wins;
- project implementation mapping uses verified alias;
- text fallback rejected/not used.

### 25.9 Icon fallback

No metadata + bounded text inference:

- fallbackUsed true;
- lower confidence;
- provenance says text fallback.

### 25.10 Unknown icon

No evidence:

- unresolved;
- no invented icon.

### 25.11 Status mapping strong evidence

Text + color + project taxonomy evidence → high-confidence hint.

### 25.12 Status mapping weak evidence

Color only → not exact/authoritative.

### 25.13 Semantic role ambiguity

Table search versus page search candidates remain traceable.

### 25.14 Modal evidence absence

No modal evidence → modal recommendation not authoritative and preferably rejected/unresolved.

### 25.15 Fallback visibility

Spec and agent context clearly mark fallback.

### 25.16 Old resolved schema

Legacy resolved artifact remains consumable by spec if compatibility is required.

### 25.17 New schema roundtrip

Resolve → spec → agent-context works.

### 25.18 Artifact budget

No source body/full catalog/corpus leakage; size within configured expectation.

### 25.19 No repository reads

Resolve/spec/context generation remain snapshot-only.

### 25.20 PR 1–3 non-regression

- compact agent context;
- snapshot dedup;
- missing ground truth non-green;
- hot referee zero reads;
- existing tests pass.

## 26. Fixtures

Use existing fixtures where possible:

```text
test/fixtures/mahasiswa-tarif
test/fixtures/pilar-golden
test/fixtures/eval-hope
test/fixtures/angular13
real figml-export fixture through temporary copy if safe
```

Add minimal focused fixture only when existing fixtures cannot express:

```text
icon metadata vs label conflict
public API vs behavioral CSS
ambiguous taxonomy
modal evidence absence
```

Do not add large duplicate fixture trees.

## 27. Validation Commands

Before changes:

```bash
git status --short
git rev-parse HEAD
git log -1 --oneline
node --version
npm --version
```

Baseline focused tests:

```bash
node --test test/resolve.test.mjs
node --test test/spec.test.mjs
node --test test/agent-context.test.mjs
```

After implementation, syntax-check all changed source.

Focused suite:

```bash
node --test test/resolve.test.mjs
node --test test/spec.test.mjs
node --test test/agent-context.test.mjs
node --test test/pilar-catalog.test.mjs
```

Relevant combined suite:

```bash
node --test \
  test/resolve.test.mjs \
  test/spec.test.mjs \
  test/agent-context.test.mjs \
  test/transcript-schema.test.mjs \
  test/pilar-catalog.test.mjs \
  test/pilar-roundtrip.test.mjs \
  test/conventions.test.mjs \
  test/snapshot.test.mjs \
  test/referee.test.mjs \
  test/referee-verdict.test.mjs \
  test/verify.test.mjs
```

Full suite:

```bash
npm test
```

## 28. Temporary E2E Validation

Use:

```bash
TMP_ROOT="/tmp/sliceui-pr4-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$TMP_ROOT"
```

Use repository CLI explicitly:

```bash
node /Users/bsi-2-2200019/Development/freelance/sliceui-skill/src/cli.mjs ...
```

Do not use global/on-PATH binary.

Run on temporary copy:

```text
transcribe if needed
resolve
spec
inspect agent context
referee hot snapshot mode
verify existing known fixture if applicable
```

Capture:

```text
resolved schema/version
entry count
classification distribution
authority distribution
confidence distribution
fallback count
unresolved count
artifact bytes/chars
spec diff
agent-context diff
repository-source reads
elapsed time
```

## 29. Semantic Comparison Before/After

For representative fixtures, compare old and new resolution.

Create matrix:

```text
property
old selected value
new selected value
same/different
new classification
new authority
confidence
provenance
fallback
reason for change
```

Changes are allowed only when they improve semantic safety or correct an evidenced error.

Do not silently change lots of selected values due to refactor. Investigate each material difference.

## 30. Read-Path and Performance

PR 4 must not reintroduce repository reads.

Dynamically or statically prove:

```text
resolve project-source reads = 0
spec project-source reads = 0
agent-context builder project-source reads = 0
```

Measure before/after:

```text
resolve elapsed
spec elapsed
resolved artifact size
spec size
agent-context size
```

Avoid significant latency regression. If provenance increases file size, report exact cost.

## 31. Documentation and Skill

Update active owning docs only.

Likely:

```text
docs/project-docs/development/api-contract.md
docs/project-docs/foundation/architecture.md
docs/project-docs/foundation/workflow.md
skill/SKILL.md
README.md or SLICEUI-OVERVIEW.md only if they describe resolved artifact authoritatively
```

Document:

- new resolved schema;
- classification and authority;
- confidence policy;
- provenance sources;
- backward compatibility;
- spec labels facts versus hints;
- agent must not treat hints as design facts;
- unresolved and fallback behavior.

Do not duplicate full schema in multiple docs.

## 32. Skill Contract

Update skill minimally:

```text
- spec remains primary generation input;
- verified capability can be followed;
- implementation hints are non-authoritative;
- low-confidence/fallback items require conservative handling;
- unresolved items must not be guessed;
- design facts always own visible structure and appearance;
- public API before behavioral CSS;
- no repository search by default.
```

Do not increase skill length excessively.

## 33. Acceptance Criteria

PR 4 complete only if:

- [ ] Entry gate authorizes PR 4.
- [ ] All resolved consumers audited.
- [ ] Schema/version strategy explicit.
- [ ] Every new entry has classification.
- [ ] Every recommendation has authority.
- [ ] Confidence deterministic and documented.
- [ ] Provenance traceable.
- [ ] Fallback explicit.
- [ ] Unresolved remains unresolved.
- [ ] Candidates bounded.
- [ ] Public API beats behavioral CSS.
- [ ] Icon metadata beats text inference.
- [ ] Status color alone is not authoritative.
- [ ] Semantic roles remain hints unless explicit.
- [ ] Modal semantics require evidence.
- [ ] Transcript remains design-only.
- [ ] Spec distinguishes facts and hints.
- [ ] Agent context remains under budget.
- [ ] Legacy resolved artifacts remain supported as required.
- [ ] No repository scans added.
- [ ] Artifact growth measured and bounded.
- [ ] Focused tests pass.
- [ ] Relevant suite passes.
- [ ] Full suite passes except pre-existing skips.
- [ ] PR 1–3 non-regression confirmed.
- [ ] Documentation synchronized.
- [ ] No PR 5/6 leakage.

## 34. Safety and Git Rules

Do not run:

```text
git reset --hard
git clean -fd
git checkout -- .
git restore .
npm update
auto-format whole repository
```

Do not delete the eight untracked prompt files unless user explicitly requests it.

Do not modify real target project.

Do not commit or push as part of implementation. PR 4 requires independent verification first.

Record initial/final `git status --short`.

## 35. Work Sequence

### Phase 1: Entry gate and baseline

- confirm checkpoint and PR 3 closure;
- classify working tree;
- run baseline tests.

### Phase 2: Consumer audit

- map producer/consumers;
- confirm verify independence;
- define compatibility needs.

### Phase 3: Design note

Before coding, provide short note:

```text
files to change
schema changes
classification model
authority/confidence policy
provenance strategy
compatibility approach
artifact budget
tests
```

No confirmation needed if within scope.

### Phase 4: Implement typed resolution model

- classification;
- authority;
- confidence;
- evidence/provenance;
- candidates/rejections;
- explicit fallback/unresolved.

### Phase 5: Implement safety policies

- API precedence;
- icon precedence;
- taxonomy safety;
- semantic-role hints.

### Phase 6: Update spec and agent context

- facts vs hints;
- compact output;
- backward compatibility.

### Phase 7: Tests

- focused unit cases;
- compatibility;
- determinism;
- artifact budget;
- no-read.

### Phase 8: E2E and comparison

- representative fixtures;
- old/new matrix;
- size/time/read metrics.

### Phase 9: Documentation and skill

- owning docs;
- concise skill changes.

### Phase 10: Final scope review

- no PR 5/6 leakage;
- no unrelated refactor;
- no target mutation.

## 36. Required Final Response

### Entry Gate

```text
Checkpoint baseline:
PR 3 official status:
PR 4 authorized:
Evidence:
```

### Summary

Describe provenance and semantic-safety implementation.

### Files Changed

Group source, tests, skill, docs, and pre-existing untracked files.

### Resolved Schema

Summarize:

```text
schema version
classification values
authority values
confidence policy
provenance sources
fallback model
unresolved model
candidate limits
```

### Safety Policies

Report:

```text
public API precedence
icon precedence
status/taxonomy safety
semantic-role authority
modal evidence behavior
```

### Before/After Semantic Results

List material changed decisions and reasons.

### Artifact and Context Metrics

```text
old resolved bytes/chars
new resolved bytes/chars
growth multiple
spec bytes/chars
agent-context bytes/chars
fallback count
unresolved count
candidate count
```

### Read-Path and Performance

```text
resolve project reads
spec project reads
agent-context project reads
resolve elapsed before/after
spec elapsed before/after
```

### Backward Compatibility

Explain old/new resolved handling.

### Validation

List exact commands and results.

### PR 1–3 Non-Regression

Report compact context, snapshot, referee, and ground-truth safeguards.

### Known Limitations

Only factual unresolved limitations.

### Deferred Findings

Do not implement:

```text
PR 5 verify reliability
verify PascalCase normalization
wrapper/modal verification rules
unknown Angular input verification
visual/render verification
fs-trace redesign
atomic verdict writing
incremental refresh/cache
```

### Documentation Sync

Use `Documentation sync: clear.` or list stale docs.

### Git Status

Include `git status --short`. Do not commit.

## 37. Focused Implementation Decision

End with:

```text
PR 4 implementation: PASS / FAIL
Resolved provenance complete: YES / NO
Semantic hints non-authoritative: YES / NO
Public API precedence enforced: YES / NO
No repository reads added: YES / NO
PR 4 ready for independent verification: YES / NO
```

Do not claim PR 4 officially closed until independent verification completes.

## 38. Definition of Done

Task is done only when every resolved decision has an explicit semantic type and traceable source, semantic hypotheses cannot masquerade as design facts, fallback and ambiguity remain visible, verified public APIs supersede behavioral CSS, icon metadata precedence is enforced, spec and agent context communicate authority correctly, legacy artifacts remain safe, artifact growth is bounded, no repository reads are added, all tests pass, and the implementation is ready for independent PR 4 verification.

Begin by confirming the checkpoint baseline and auditing every resolved artifact consumer. Do not modify source before the authority model and backward-compatibility plan are written down.
