# SliceUI PR 4 Verification Report

> Read-only independent verification. No source, test, skill, or documentation was modified. The only new repository file is this report. All fixtures, logs, traces, and source copies live under `/tmp/sliceui-pr4-verification-20260926-065958/` (outside the repo). The real target project was used only as a read-only git-status reference.

## 1. Executive Decision

**PR 4: CONDITIONAL PASS**
**PR 5 may start: YES** (with one required correction queued — see §30)

Every core semantic-safety guarantee is dynamically reproduced:

- **Schema v2 is coherent and additive.** `schemaVersion: 2`; the 8 real-fixture groups carry `classification`/`authority`/`confidence`/`provenance`/`fallbackUsed`, and every schema-1 key survives with unchanged meaning (verified: `id`/`kind`/`type`/`evidence`/`resolved`/`count`/`ids` all present).
- **Selected values are byte-identical to the `f67f8bb` baseline** — all 8 groups unchanged (independently re-derived against a clean `git archive` of the baseline tree).
- **Semantic hypotheses do not appear authoritative.** A controlled 15-scenario harness reproduced every precedence rung: `sync` metadata beats a "Cari data" label; `fa-caret-down` from glyph name; `fa-eye` from inherited wrapper name; color/corpus → `semantic-hypothesis`/`hint`/`0.70`; ambiguous family → `hint`/`0.50` with candidates; unknown → `unresolved`/`fallback`/`fallbackUsed:true`. No scenario produced an `authoritative` or `exact` value.
- **Public API precedence works with exact case.** `paginationAlignment = right → [paginationAlign]="'right'"` on `uii-table`, authority `verified`/`0.85` with catalog present, degrading to `hint`/`0.70` with a "catalog unavailable" note when absent; zero recommendations when the footer evidence is absent.
- **Verify and referee stay independent.** `verify.mjs`/`referee.mjs`/`referee-verdict.mjs` contain no `resolved.json`/`spec.md`/`resolveTranscript` references (grep-verified).
- **Zero project-source reads.** fs-shim trace: `resolve` = 0, `spec` = 0 (only `.sliceui` + the design XML; the `sliceui-repo` read is SliceUI's own pilar catalog module).
- **Artifact growth 2.94×, within the 3× budget** — independently re-measured (3,718 → 10,934 bytes). Agent context 8,240 chars (budget 30,000).
- **Full suite 424 pass / 3 pre-existing skip / 0 fail.** PR 1–3 non-regression confirmed (empty-ground-truth verify exits non-zero; hot referee reads 0 project source files).

PR 4 is *conditional*, not a clean PASS, for two Medium findings (neither blocks closure; neither creates a false-authoritative claim) plus three Low/Informational items documented below.

## 2. Scope and Environment

| Item | Value |
|---|---|
| Repository | `sliceui-skill` @ `f67f8bb` (PR 4 uncommitted working-tree changes on top) |
| Node / npm | `v20.19.5` / `10.8.2` |
| Files under review | `src/lib/resolution-policy.mjs`, `src/lib/resolve.mjs`, `src/commands/resolve.mjs`, `src/commands/spec.mjs`, `src/lib/agent-context.mjs` + 3 test files + `skill/SKILL.md` + 4 project docs |
| Target project (read-only) | `lib-uii-gateway-bill-angular` — 3 pre-existing modified `testingcomponent.*` files (2026-09-24, untouched by PR 4) |
| Verification root | `/tmp/sliceui-pr4-verification-20260926-065958/` |
| Source hashes | start = end, byte-identical (Appendix F) |

## 3. Git and Source Integrity Baseline

- `HEAD = f67f8bb` (the checkpoint); PR 4 is uncommitted working-tree changes.
- Working tree grouped: **PR 4 source** (5 src files) · **PR 4 tests** (3) · **PR 4 skill/docs** (skill/SKILL.md + 4 project docs) · **known untracked** (10 prompt files + `resolution-policy.mjs`) · **unknown/unrelated** — none.
- 13 source/docs/test files hashed at start and end: identical (Appendix F).
- Real target project: 3 modified `testingcomponent.*` files — pre-existing, confirmed untouched.

## 4. Producer and Consumer Audit

| Consumer | Type | Reads `resolved.json`? | Evidence |
|---|---|---|---|
| `src/commands/resolve.mjs` | **writer** | — | writes `{schemaVersion, groups, behaviorBindings, meta}` |
| `src/commands/spec.mjs` | spec builder | **No** (re-derives) | `buildSpec` calls `resolveTranscript(transcript, conventions, pilar)` in memory |
| `src/lib/agent-context.mjs` | context builder | **No** (re-derives) | `resolveGroupsOf` → `resolveTranscript`; manifest `sources.resolved` is a pointer string only |
| `src/commands/verify.mjs` + `angular/verify.mjs` | verify | **No** | grep: no `resolved.json`/`spec.md`/`resolveTranscript` |
| `src/lib/referee.mjs` + `referee-verdict.mjs` | referee | **No** | same grep |
| `test/resolve|spec|agent-context|mahasiswa-tarif` | fixture | in-memory | import `resolveTranscript` |
| `skill/SKILL.md` Step 3b | agent diagnostics | yes (diagnostic) | documents typed groups |
| api-contract §10.5 / architecture / status / verify-gate-trust | documentation contract | — | schema v2 documented |

**Conclusion:** no command reads `resolved.json` from disk; `spec`/`agent-context` re-derive in memory; `verify` and `referee` are fully independent. Schema-1 compatibility is therefore *architectural* (additive fields), not a shim — there is no reader to break.

## 5. Schema v2 Assessment

Field ownership map (verified against `commands/resolve.mjs` writer + actual output):

| field | producer | consumer | req | legacy |
|---|---|---|---|---|
| `schemaVersion` (2) | resolve.mjs | agent/docs | required | added |
| `groups[].id/kind/type` | resolve | spec/agent | required | v1 |
| `groups[].evidence` | resolve | spec (inline) | required | v1 |
| `groups[].resolved[]` | resolve | spec/agent/skill | required | v1 (unchanged shape) |
| `groups[].fallback` | resolve | spec (FALLBACK:) | optional | v1 |
| `groups[].candidates` | resolve | spec (CANDIDATES:) | optional | v1 |
| `groups[].count/ids` | resolve | spec (applies-to) | required | v1 |
| `groups[].classification` | resolve | skill/docs | required | added |
| `groups[].authority` | resolve | skill/docs | required | added |
| `groups[].confidence` | resolve | spec (`hint(level):`) | required | added |
| `groups[].fallbackUsed` | resolve | skill | required | added |
| `groups[].provenance` | resolve | docs | required | added |
| `groups[].rejected` | resolve (icons only) | skill | optional | added |
| `behaviorBindings[]` | resolution-policy | spec/agent/skill | optional | added |

- **Stable IDs:** `id` = transcript `nodeId` (deterministic); `ids[]` = member ids. No random IDs.
- **No absolute-path leakage:** provenance carries `nodeId` + property names + locators (`conventions.json.classVocabulary`, `resolve.NAME_GLYPH`, `pilar-catalog`), never `/Users/...` (verified: 0 absolute-path strings in resolve output and spec).
- **No source-body leakage:** scanned for `border-radius:`/`background:`/`color: #`/`!important`/`PILAR_COMPONENTS`/`ngDeepCorpus": [` — all absent; no string > 250 chars.
- **Deterministic ordering:** `groupLeaves` uses a `Map` keyed by a JSON tuple including typing fields; walk order is document order. Verified 3×-deep-equal.

## 6. Classification Assessment

Emitted values (from `resolution-policy.mjs` `CLASSIFICATIONS`): `implementation-recommendation`, `semantic-hypothesis`, `unresolved`. All three are emitted and all are semantically correct in the harness:

- `implementation-recommendation` — glyph/variant/name → FA alias; button variant → `btn-*`; status text-table; the behavior binding. Correct: a documented, deterministic mapping, but still a *mapping*, not the design fact itself.
- `semantic-hypothesis` — corpus exact color; single-family color; ambiguous family; button `bg`→class heuristic. Correct: inferred from co-occurrence/color.
- `unresolved` — no glyph name + no corpus/color mapping; unknown button variant/bg; unknown status. Correct: deliberately not guessed.

The conceptual vocabulary in `resolution-policy.mjs` header (`literal-design-fact`, `normalized-design-fact`, `structural-design-fact`, `project-capability`, `project-token`, `project-utility`, `approved-style-recipe`, `conservative-fallback`) is **documentation only**, correctly *not* emitted as group classifications — those categories belong to transcript/evidence, not to resolved mappings. Docs (`api-contract.md` §10.5) accurately list the 3 emitted values and do not overclaim. A `conservative-fallback` group is represented as `classification: unresolved` + `authority: fallback` + `fallbackUsed: true` — unambiguous because the fallback object carries the implementation and `authority` carries the trust grade. **No ambiguity found.**

## 7. Authority Assessment

All 8 real groups emit `authority: hint` — correct, since every resolved value is a mapping FROM design evidence. The `verified` tier appears exactly where it belongs:

- `behaviorBindings[].authority = "verified"` (0.85) when the catalog verifies `uii-table.paginationAlign`;
- nested `evidence[].type = "project-capability"` carrying `component`/`api`/`default`.

So the model **does** represent "verified capability fact" vs "recommendation" as two layers, and the rendered `spec.md` states both distinctly (`verified capability: uii-table.paginationAlign` on its own line, followed by the recommendation). **One granularity defect** (AUT-001, Medium): the *top-level* `authority: verified` labels the recommendation entry, while the PR 4 §9 vocabulary reserves `verified` for "exact project capability verified by machine source" and `hint` for "implementation recommendation". The value `'right'` is structurally *inferred* (space-between footer), not verified by the catalog — the catalog only verifies that the *input exists*. The two layers are separable in `evidence[]`, so this is imprecise rather than wrong; the rendered spec mitigates it by printing the capability separately. Rated Medium because the plan's §9 explicitly flags this as the critical distinction.

## 8. Confidence Assessment

Deterministic policy tiers reproduced exactly:

| scenario | confidence | level | matches policy |
|---|---|---|---|
| metadata alias (sync→fa-refresh, caret, eye) | 0.95 | high | ✅ |
| button variant → btn-* (vocab present) | 0.85 | high | ✅ |
| behavior binding (catalog verified) | 0.85 | high | ✅ |
| corpus exact color | 0.70 | medium | ✅ |
| single-family color | 0.70 | medium | ✅ |
| button bg heuristic | 0.70 | medium | ✅ |
| status text-table (vocab) | 0.85 | high | ✅ |
| status co-occurrence | 0.70 | medium | ✅ |
| ambiguous color family | 0.50 | low | ✅ |
| unknown icon / unknown status / unknown button | 0.00 | none | ✅ |

- **Same input → same confidence**: 3× deep-equal on a mixed fixture (groups + behavior bindings + spec) — identical, no timestamps in resolved output.
- **Candidate ordering does not affect score**: no score depends on ordering (fixed tier tables).
- **No unsupported exact/high**: no path emits 1.0; `0.85` is the documented "strong structural + verified capability" tier, never silently upgraded.
- **Numeric values match documentation**: `confidenceLevel()` maps 1.0→exact, 0.95/0.85→high, 0.70→medium, 0.50→low, 0→none (verified via a boundary test).

## 9. Provenance Assessment

Representative decisions traced:

- **Design provenance** — `{type:"design-fact", nodeId, property, value}` pointing at `variantName`/`glyphName`/`description`/`bg`/`children.text`. Specific; inspectable from the transcript alone (no repo scan).
- **Project provenance** — `{type, source, ...}` with concrete locators: `conventions.json.classVocabulary` (+`name`), `conventions.json.ngDeepCorpus` (+`selector`), `resolve.NAME_GLYPH` (+`fa4Pinned`), `resolve.FA_ICON_COLORS`, `pilar-catalog` (+`api`). No bare `source: project`/`source: design`.
- **Mapping provenance** — `{rule, detail?}`: `icon-alias-registry`, `corpus-exact-color`, `color-family-single/ambiguous`, `status-text-table`, `corpus-cooccurrence`, `variant-class-mapping`, `bg-class-heuristic`, `public-api-precedence`, `no-evidence`.

**One precision defect** (PRV-001, Low): the behavior-binding structural evidence attributes `justify: space-between` to the pagination-hint *text* node (`info`) rather than the distributed *footer frame* that actually carries the property (verified: `findDistributedPaginationFooter` returns `n.id` of the hint-matching node, while `justify` lives on its space-between ancestor). Traceability is preserved (the node is real and reachable), but the nodeId→property pairing is one hop off.

## 10. Candidate and Rejection Assessment

Controlled fixtures forced: one exact candidate, multiple candidates, >3 candidates, API-vs-CSS, unknown, fallback.

- **candidates ≤ 3**: icon ambiguous family `slice(0, maxCandidates)` — enforced. `maxCandidates` is read in `resolve.mjs`.
- **evidence ≤ 5**: `designEvidence(...).slice(0, maxEvidence)` — enforced.
- **rejected ≤ 3**: the behavior binding emits a single-element `rejected[]`. `maxRejected` is **declared but never read** — not enforced (CND-001, Low; see §22 budget note).
- **Deterministic ordering**: candidates are corpus/family order (stable); no duplicate candidates; the selected value is never repeated in `rejected`.

**Candidate-surfacing gap** (TAX-001, Medium): when a status badge has *multiple* co-occurring `label-custom-*` candidates and no status text decides, `labelFromCooccurrence` returns `all[0]` (a silent first-pick) and the `candidates` array is left `undefined`. The PR 4 §15 rule — "ambiguous mapping remains candidates or unresolved" — is violated for this path: the resolver silently selects `label-custom-waiting` over its siblings. This is **pre-existing behavior** (the `f67f8bb` resolver had the identical `labelFromCooccurrence → all[0]`), it is non-authoritative (`authority: hint`, `0.70`), and it does not fire on the real fixture (where exactly one label pairs `fa-check-circle`). But it is the exact "internally consistent but semantically wrong" hazard PR 4 §2 names, and it is not surfaced. Rated Medium, non-blocking.

## 11. Public API Precedence

| case | result | verdict |
|---|---|---|
| footer space-between + catalog has `paginationAlign` | binding `[paginationAlign]="'right'"`, authority `verified`/0.85, `rejected` CSS stored with reason | ✅ |
| footer space-between, no catalog (`pilar=null`) | authority `hint`/0.70, note "catalog unavailable — binding name not machine-verified" | ✅ |
| footer space-between, catalog present but `uii-table.inputs` lacks the input | authority `hint`/0.70 + same unavailable note | ✅ (degrades, never verifies) |
| no footer evidence | 0 recommendations | ✅ |
| standalone `uii-pagination` | **not emitted** — the resolver hardcodes `uii-table.paginationAlign`; the standalone `paginationALign` (capital L) spelling is never produced, so no normalization hazard exists | ✅ (narrow, safe) |

Exact case `paginationAlign` is preserved (`implementation.expression = "[paginationAlign]=\"'right'\""`). The rejected alternative names `::ng-deep .table-footer / .ugw-pagination-container alignment override` with a reason citing the 2026-09-24 report. The visual-style exception is intact: `::ng-deep` corpus blocks remain in `spec.md` "Copy verbatim" for visual state, and only the *behavioral* alignment CSS is rejected.

## 12. Icon Resolution Assessment

| rung | scenario | value | class | auth | conf | verdict |
|---|---|---|---|---|---|---|
| variantProperties | `variantName="sync"` inside "Cari data" button | fa-refresh | impl-rec | hint | 0.95 | ✅ metadata beats label |
| glyphName | `Icon_..._caret-down` | fa-caret-down | impl-rec | hint | 0.95 | ✅ |
| instance description | inherited `Icon_..._E_eye` on Vector child | fa-eye | impl-rec | hint | 0.95 | ✅ |
| corpus exact color | corpus `.fa-eye` styled `#03337b` | fa-eye | sem-hypo | hint | 0.70 | ✅ |
| single-family color | `#4fbbbb` | fa-check-circle | sem-hypo | hint | 0.70 | ✅ |
| ambiguous family | `#03337b`, generic "Vector" | fa-search+pencil+eye (candidates) | sem-hypo | hint | 0.50 | ✅ |
| unknown | `#123456`, "Vector" | (none) | unresolved | fallback | 0.00, fallbackUsed | ✅ |
| text-fallback absence | button label never a rung | n/a | — | — | — | ✅ (confirmed by code: `resolveIconLeaf` never reads button text) |

Unsupported conceptual rungs (`componentProperties`, `mainComponent`) are **not claimed** as active — the code comment and `api-contract.md` both document them as parser-deferred. `pilar-version.mjs`/`uii-slice-policy.mjs` are not consulted by the resolver (it uses the catalog shape `pilarComponents[].inputs`), which is consistent with "no repository read".

## 13. Status and Taxonomy Assessment

- **Strong evidence (text + color + vocab):** "Belum bayar" → `label-custom-warning` + `fa-exclamation-circle`, classification `implementation-recommendation`, authority `hint`, 0.85. The text-table mapping is the "verified taxonomy source" here (STATUS_LABELS + classVocabulary); correctly still `hint` (a recommended idiom, not a design fact).
- **Corpus co-occurrence (no text):** ≤0.70, `hint`. ✅.
- **Color only:** never `authoritative`, never `exact`/`high` — max 0.70. ✅.
- **Unknown status:** `unresolved`/`fallback`/`fallbackUsed:true`/0.00. ✅.
- **Real `Aktif` case reproduced:** `label-custom-active + fa-check-circle` at `hint`/0.70, provenance `corpus-cooccurrence` → visibly co-occurrence-derived. ✅.

**TAX-001 applies here** (multiple co-occurring candidates, no text → silent first-pick), as described in §10.

## 14. Semantic Role Safety

- No resolver/spec/agent-context path emits `table-toolbar`, `table-search`, `page-search`, `bulk-action-toolbar`, or `modal-*` roles as authoritative. `buildDesignInventory` derives `select`/`table`/`pagination` from node types/text patterns (structural facts), and never invents a modal role (pinned by the pre-existing test `!roles.includes("modal")`).
- The behavior-binding recommendation is derived from structural evidence (space-between footer), not from a name.
- Modal/card semantics: absent in every controlled fixture; no recommendation appears without the footer evidence (verified: "no evidence → 0 behavior entries").
- This assessment only checks resolver/spec/agent-context (no verifier rules added — correct per scope).

## 15. Spec Rendering Assessment

Verified in generated `spec.md` on the real fixture:

- **Literal design facts** remain in the Elements section (geometry `[x,y w×h]`, text, bg, border) — unchanged.
- **Non-high-confidence idioms labeled**: `→ hint(medium): label-custom-active + fa-check-circle`, `→ hint(medium): fa-info-circle`.
- **High-confidence idioms unlabeled** but the section header states "Resolved idioms (project mappings — NOT design facts)", and the `→` arrow separates fact from mapping. High-confidence (0.85/0.95) mappings render bare — consistent with the implementation's own claim and the PR 4 §18 rule that only *low*-confidence hints must not be imperative. Acceptable (noted, not a finding).
- **Behavior bindings section** present: names the API, the rejected CSS, the confidence, and the exact binding string.
- **Fallback visibility**: `FALLBACK:`/`CANDIDATES:` markers present in `renderIdiom` (real fixture has no fallback case, so no literal `FALLBACK:` line appears — expected, and the path is exercised by unit tests).
- **No full provenance dump, no design fact removed, no recommendation copied into transcript** (transcript is written by `transcribe` only; resolve/spec never mutate it).

## 16. Agent Context Assessment

- **Implementation Hints section** present, headed "(non-authoritative)", with the explicit instruction: "Project-aware suggestions, NOT design facts … never treat one as fact. Unresolved items must not be guessed."
- **Bounded**: `selectImplementationHints` returns `slice(0, 8)`; never dumps candidate lists or provenance arrays.
- **No full resolved JSON / conventions / Pilar leakage**: grep for `loadedClassRegistry`/`classVocabulary`/`custom-select` all absent; only selected capabilities + recipes + hints.
- **Budget**: 8,240 chars / ~2,060 est. tokens (≤ 30,000) — `budget exceeded: no`.
- **Metrics match**: `measureContext` uses `ceil(chars/4)`; `unusedCapabilityCount = 0`; `rawSourceExampleCount = 0` — all reproduced.

## 17. Legacy Compatibility

- **schema-1 keys preserved** (unit test `PR4: legacy schema-1 groups remain readable` asserts `id/kind/type/evidence/resolved/count/ids` all present; `resolved[]` shape unchanged).
- **`spec` never reads a resolved file**: `buildSpec` is proven to produce output from transcript + conventions with no resolved artifact input — so a schema-1 artifact on disk is simply never consumed, and nothing can crash on it.
- **No silent reinterpretation**: nothing upgrades a schema-1 artifact to schema-2 certainty (nothing reads it at all).
- **Centralized adapter**: not needed — there is no reader. `RESOLVED_SCHEMA_VERSION` is the single version point.

## 18. Determinism and Roundtrip

- `resolveTranscript` ×3, `buildSpec` ×3 on a mixed fixture (status + ambiguous icon + footer): **deep-equal** — selected values, classification, authority, confidence, provenance, candidates/rejected, behaviorBindings all identical.
- No random IDs (ids are transcript node ids); no absolute temp-path differences; no timestamps in resolved output (only `context-manifest.json`/`agent-context` carry `generatedAt`, which is documented non-semantic and excluded).
- Roundtrip: `resolve` (CLI) → `spec` (CLI) → `agent-context` (in-memory) all produce mutually consistent `paginationAlign` binding (same expression surfaces in resolved.json, spec.md, and the manifest hints).

## 19. Test Quality Review

PR 4 adds 27 tests (16 resolve, 4 spec, 5 agent-context, 2 skill/roundtrip). Coverage assessment:

- ✅ **Classification validity** — asserts every group has a valid enum value + provenance.
- ✅ **Authority mapping** — asserts hint/fallback on the correct scenarios.
- ✅ **Confidence tiers** — `confidenceLevel` boundary test (1.0/0.95/0.85/0.7/0.5/0).
- ✅ **Public API precedence** — verified vs hint vs no-evidence vs no-input.
- ✅ **Icon metadata conflict** — sync-vs-label test (real shape: wrapper + Vector child).
- ✅ **Ambiguous icon** — candidates asserted deep-equal to the fa family.
- ✅ **Unknown icon** — unresolved, no invented icon, fallbackUsed.
- ✅ **Status strong/weak/conflict/unknown** — text-table vs co-occurrence scoring; the real `Aktif` case.
- ✅ **Semantic role ambiguity** — no modal role invented.
- ✅ **Modal evidence absence** — no behavior entries without footer evidence.
- ✅ **Fallback/unresolved visibility** — spec `FALLBACK:`/`hint(...)` assertions.
- ✅ **Legacy schema / roundtrip / artifact budget / zero reads / skill contract** — all present.
- ✅ **Snapshot purity** — asserts no `node:fs`/`fast-glob` in resolver/policy/agent-context.

**Gaps (TST-001, Informational):**
1. The "candidate and evidence budgets hold" test asserts `<= maxCandidates` on a status whose candidates are empty (the silent-pick path sets them `undefined`), so it passes trivially and does **not** force an over-budget scenario — masking TAX-001.
2. The pre-existing "label co-occurrence surfaces candidates" test accepts *either* a candidate list *or* a resolved label (`status.candidates || status.resolved.some(...)`), so it would still pass under the silent-pick behavior.
3. No test asserts `maxRejected`/`resolvedJsonMaxGrowth` are enforced (they aren't — CND-001).

## 20. Tests Re-run

| Command | Result |
|---|---|
| `node --test test/resolve.test.mjs` | 45 pass / 0 fail |
| `node --test test/spec.test.mjs` | 10 pass / 0 fail |
| `node --test test/agent-context.test.mjs` | 17 pass / 0 fail |
| `node --test test/pilar-catalog.test.mjs` | pass (in combined) |
| Relevant combined (12 files incl. snapshot/referee/verify) | 280 → pass / 0 fail / 1 skip |
| `npm test` | **424 pass / 3 skip (pre-existing) / 0 fail** |
| `node --check` (8 changed src/test files) | OK |

Baseline (pre-change) was 400 pass / 3 skip / 0 fail; the +27 tests account for the increase. The 3 skips are the unchanged pre-existing pilar-mount/roundtrip set.

## 21. E2E and Real-Fixture Results

Clean E2E on a fresh copy of the real `.sliceui` (conventions.json + project-context.json + inputs) with the repo CLI:

- `resolve` → schemaVersion 2, 8 groups, 1 behavior binding.
- `spec` → spec.md + agent-context.md + context-manifest.json all written.
- Hot `referee --target` on the copied snapshot → 0 project-source reads (the `exists /Users/.../lib-uii-gateway-bill-angular` probe is a directory-existence check on the missing-verdict path, not a source read; referee is untouched by PR 4).
- `verify` on a component with no `.sliceui` ground truth → `UNVERIFIED` + exit 3 (non-zero), confirming PR 2's empty-ground-truth safeguard.

Real-fixture matrix (8 groups), independently re-derived against the clean `f67f8bb` baseline:

| kind | old value | new value | same | class | auth | conf |
|---|---|---|---|---|---|---|
| icon | fa-info-circle | fa-info-circle | ✅ | semantic-hypothesis | hint | 0.70 |
| icon | fa-caret-down | fa-caret-down | ✅ | implementation-recommendation | hint | 0.95 |
| button | btn-primary | btn-primary | ✅ | implementation-recommendation | hint | 0.85 |
| icon | fa-refresh | fa-refresh | ✅ | implementation-recommendation | hint | 0.95 |
| status | label-custom-active + fa-check-circle | *(same)* | ✅ | implementation-recommendation | hint | 0.70 |
| icon | fa-check-circle | fa-check-circle | ✅ | implementation-recommendation | hint | 0.95 |
| button | btn-secondary | btn-secondary | ✅ | implementation-recommendation | hint | 0.85 |
| button | btn-primary | btn-primary | ✅ | implementation-recommendation | hint | 0.85 |

All 8 selected values identical; `behaviorBindings[]` added `paginationAlignment → [paginationAlign]="'right'"` (verified/0.85).

## 22. Artifact Size and Leakage

| artifact | bytes/chars | note |
|---|---|---|
| resolved.json (old) | 3,718 B | `f67f8bb` baseline (independently re-derived) |
| resolved.json (new) | 10,934 B | **2.94× growth** (≤ 3× budget) |
| spec.md | 22,175 B | +761 B of authority labels + behavior section |
| agent-context.md | 8,240 chars | ≤ 30,000 |
| context-manifest.json | 21,125 B | schema v2 |

- evidence ≤ 4/group (limit 5); candidates ≤ 3; rejected ≤ 1 (single-element behavior binding).
- No source bodies, no full corpus blocks, no full catalog/showcase, no credentials, no absolute private paths (all string-scanned).

**Budget enforcement is observed, not tested** (CND-001, Low): `maxCandidates` and `maxEvidence` are read in `resolve.mjs`; `maxRejected` and `resolvedJsonMaxGrowth` are declared but never read. The 2.94× result is a *measurement*, not an assertion — a future provenance addition could silently cross 3× with no failing test. The implementation's own report noted "if 3× is insufficient, report actual size and justify" — the honest answer is that 2.94× is close to the limit and the bound is not enforced in code.

## 23. Read-Path Assessment

fs-shim trace (loader-level `node:fs` interception, dynamic):

| command | .sliceui reads | design XML | SliceUI own modules | project-source reads |
|---|---|---|---|---|
| resolve | 2 | 1 | 1 (pilar catalog) | **0** |
| spec | 3 | 1 | 1 (pilar catalog) | **0** |
| agent-context | 0 (pure fn) | — | — | **0** (asserted by test: no fs import) |

`loadPilar()` is an in-memory dynamic import of SliceUI's own bundled catalog modules — correctly **not** counted as target-project source. No repository-wide traversal (`readdir` only within `.sliceui`).

## 24. Performance Assessment

Warm subprocess medians (interleaved, 20 runs):

| command | baseline (f67f8bb) | PR 4 | delta |
|---|---|---|---|
| resolve | 61.3 ms | 66.0 ms | +4.7 ms |
| spec | 78.7 ms | 84.1 ms | +5.4 ms |

In-process: `loadPilar` ~5 ms; `buildAgentContext` 0.5 → 0.8 ms; `buildSpec` ~6.7 ms. The delta is pilar-catalog load + typing overhead — **sub-100 ms absolute, no material regression**. (No token/byte claims derived from elapsed time.)

## 25. PR 1–3 Non-Regression

- **PR 1 (compact context):** 8,240 chars / ~2,060 est. tokens under budget; no full-conventions read instruction (skill + agent-context both say "machine-only"); raw source examples 0.
- **PR 2 (snapshot dedup, ground truth):** `snapshot/init/detect` tests pass; project-context dedup untouched; empty-ground-truth verify exits non-zero (reproduced: exit 3 / UNVERIFIED).
- **PR 3 (referee cold/hot):** hot referee 0 project-source reads (reproduced); stored-verdict behavior unchanged (referee files untouched); FPR-001 docs still accurate (skill Step 3.5 + api-contract §10.4b both state the uncommitted-source limit).

## 26. Documentation and Skill Assessment

- **api-contract.md §10.5**: schema v2 path correct (`.sliceui/artifacts/<name>/resolved.json`); classification/authority/confidence tiers match implementation; provenance sources match; fallback/unresolved behavior documented; verify independence stated accurately. ✅
- **architecture.md §9b**: data-flow corrected to the actual artifact paths; "typed" resolve step noted. ✅
- **verify-gate-trust.md §8**: resolves the prior open question (resolve output now versioned as a gate surface; verify stays independent). ✅
- **status.md**: PR 4 state added. ✅
- **skill/SKILL.md Step 3b**: typed fields explained; hint-is-non-authoritative stated; `behaviorBindings` precedence stated; visual-style exception preserved ("behavior vs visual, never 'no ::ng-deep'"). ✅
- **workflow.md / README.md / SLICEUI-OVERVIEW.md**: no stale schema-1-only statements; README/OVERVIEW describe resolve at a level that remains accurate (no authoritative resolved-shape claim). ✅
- **No instruction to guess unresolved decisions** — skill says "never invent one" / "unresolved items must not be guessed". ✅

## 27. Diff and Scope Review

PR 4 hunks relative to `f67f8bb` (12 files, +799/−55):

- **required PR 4** — `src/lib/resolution-policy.mjs` (new), `resolve.mjs`, `commands/resolve.mjs`, `commands/spec.mjs`, `agent-context.mjs`. ✅
- **required tests** — 3 test files (+27). ✅
- **required skill/docs** — `skill/SKILL.md` + 4 project docs. ✅
- **unrelated / scope leakage** — none. No verify/referee/fs-trace/transcript-schema/parser changes; no generated-code changes; no new dependencies (`node:fs`/`node:path`/`node:module` only); no formatter diff; no repository scan; no target-project mutation.
- **pre-existing prompt files** — 10 untracked prompt files, untouched.

## 28. Findings by Severity

| ID | Severity | Status | Summary | Blocks closure |
|---|---|---|---|---|
| TAX-001 | Medium | Confirmed | Status co-occurrence with multiple candidates silently picks the first (`labelFromCooccurrence → all[0]`) and leaves `candidates` undefined, violating PR 4 §15 "ambiguous mapping remains candidates or unresolved." Pre-existing; non-authoritative (`hint`/0.70); does not fire on the real fixture. | No |
| AUT-001 | Medium | Confirmed | Behavior-binding top-level `authority: "verified"` labels the *recommendation*, while only the *capability existence* is verified (the value `'right'` is structurally inferred). PR 4 §9 reserves `verified` for capability facts and `hint` for recommendations. Two layers are separable in `evidence[]`, so imprecise rather than wrong. | No |
| CND-001 | Low | Confirmed | `maxRejected` and `resolvedJsonMaxGrowth` are declared in `RESOLUTION_BUDGET` but never read — budget enforcement is observed (2.94×), not asserted. | No |
| PRV-001 | Low | Confirmed | Behavior-binding structural evidence attributes `justify: space-between` to the hint text node (`info`) rather than the distributed footer frame that owns the property. | No |
| TST-001 | Informational | Confirmed | Budget test passes trivially (asserts `<= 3` on an empty candidates array); "co-occurrence surfaces candidates" test accepts either candidates or a silently-picked label — masking TAX-001. | No |

Positive confirmations: schema v2 (SCH ✓), classification coherent (CLS ✓), confidence deterministic (CNF ✓), provenance specific (PRV ✓, one precision gap), public-API precedence (API ✓), icon precedence safe (ICN ✓), ambiguity/fallback safe except TAX-001, taxonomy stays hint (TAX ✓), modal not invented (SEM ✓), spec facts-vs-hints (SPC ✓), agent context compact (CTX ✓), legacy preserved (BWC ✓), determinism (DET ✓), artifact budget observed (SIZ ✓), zero reads (RDP ✓), performance fine (PER ✓), PR 1–3 healthy (REG ✓), docs accurate (DOC ✓), scope clean (SCP ✓).

## 29. Acceptance Checklist

| Criterion | Status |
|---|---|
| Schema v2 coherent and documented | ✅ |
| Every emitted decision has valid classification + authority | ✅ |
| Verified capability facts representable as verified evidence | ✅ (behavior binding `evidence[]`) |
| Recommendations remain hints | ⚠ (AUT-001: binding top-level `verified`) |
| Confidence deterministic | ✅ |
| Provenance specific and bounded | ✅ (one nodeId precision gap, PRV-001) |
| Explicit design facts not overridden | ✅ (metadata beats label/color; text beats co-occurrence) |
| Public API precedence with exact case | ✅ |
| Icon metadata precedence | ✅ |
| Ambiguous and unknown paths safe | ⚠ (TAX-001: status multi-candidate silent pick) |
| Status color alone not authoritative | ✅ |
| Modal/card semantics not invented | ✅ |
| Spec distinguishes facts and hints | ✅ |
| Agent context compact | ✅ |
| Legacy compatibility | ✅ |
| Artifact budget | ✅ (2.94×; enforcement gap CND-001) |
| No repository reads added | ✅ |
| PR 1–3 healthy | ✅ |
| Tests + full suite pass | ✅ (424/3/0) |
| Documentation matches actual support | ✅ |

## 30. Required Corrections Before PR 5

1. **TAX-001 (Medium)** — surface status co-occurrence ambiguity. When `labelFromCooccurrence` finds multiple candidates and no status text decided, emit the candidate list (bounded) and drop the silent first-pick (classification `semantic-hypothesis`, confidence 0.50), per PR 4 §15. This is a resolver-logic change; do not carry the silent pick into PR 5's verification layer.

(Optional, not blocking): AUT-001 (move `verified` to the capability-evidence layer and mark the binding `hint`), CND-001 (enforce/assert the rejected + growth budgets), PRV-001 (point structural evidence at the footer frame), TST-001 (strengthen the budget + candidate-surfacing tests).

## 31. Deferred Items

```
PR 5 verify reliability
verify PascalCase normalization
unknown Angular input validation
wrapper/modal verification rules
visual/render verification
FIGML parser componentProperties/mainComponent support (documented deferred)
icon text-fallback rung (deliberately absent)
fs-trace redesign
referee fingerprint changes
verdict atomic writing
incremental refresh/cache
```

## 32. Final Recommendation

PR 4 achieves its goal and is safe: the schema is coherent and additive, confidence is deterministic and policy-based, provenance is specific and repo-scan-free, semantic hypotheses cannot masquerade as authoritative facts, public API precedence and icon-metadata precedence both work with exact case, verify and referee stay independent, artifact growth stays within budget, and PR 1–3 remain healthy. Close PR 4 as **conditional** pending one correction — surface status-co-occurrence ambiguity (TAX-001) — then PR 5 may proceed. No blocking correctness defect exists; no false-authoritative claim was produced in any scenario.

---

## Appendix A: Commands Executed

```
git status --short ; git rev-parse HEAD ; git log -1 --oneline ; node --version ; npm --version
shasum -a 256 <13 files>                     (start + end, identical)
git -C <target> status --short                (read-only)
node --test test/resolve.test.mjs             → 45/0
node --test test/spec.test.mjs                → 10/0
node --test test/agent-context.test.mjs       → 17/0
node --test <12-file combined>                → 280 pass / 0 fail / 1 skip
npm test                                      → 424 pass / 3 skip / 0 fail
node --check <8 changed files>                → OK
# controlled scenario harness (15 cases) → <verification root>/scenarios.mjs
# determinism harness (3× resolve + spec) → <verification root>/determinism.mjs
# co-occurrence gap repro → <verification root>/cooccur-gap.mjs, bounds.mjs
# budget enforcement + provenance precision → <verification root>/edge.mjs, prov.mjs
# fs read traces (resolve/spec/referee) via /tmp/pr4v-shim loader
# old-vs-new resolved re-derivation via clean `git archive f67f8bb` tree
# empty-ground-truth verify (exit 3 / UNVERIFIED)
```

## Appendix B: Resolution Scenario Matrix

| scenario | value | classification | authority | conf | fallbackUsed | candidates |
|---|---|---|---|---|---|---|
| metadata sync vs "Cari data" label | fa-refresh | impl-rec | hint | 0.95 | false | [] |
| glyph name caret-down | fa-caret-down | impl-rec | hint | 0.95 | false | [] |
| inherited wrapper eye | fa-eye | impl-rec | hint | 0.95 | false | [] |
| corpus exact color | fa-eye | sem-hypo | hint | 0.70 | false | [] |
| single-family color | fa-check-circle | sem-hypo | hint | 0.70 | false | [] |
| ambiguous family | fa-search+pencil+eye | sem-hypo | hint | 0.50 | false | 3 |
| unknown icon | (none) | unresolved | fallback | 0.00 | true | [] |
| status text-table | label-custom-warning+fa-exclamation-circle | impl-rec | hint | 0.85 | false | [] |
| status co-occurrence (single) | label-custom-waiting+… | impl-rec | hint | 0.70 | false | [] |
| status co-occurrence (multi) | label-custom-waiting+… (silent pick) | impl-rec | hint | 0.70 | false | **undefined** ← TAX-001 |
| status unknown | (none) | unresolved | fallback | 0.00 | true | [] |
| button variant | btn-secondary | impl-rec | hint | 0.85 | false | [] |
| button bg heuristic | btn-secondary | sem-hypo | hint | 0.70 | false | [] |
| button unknown variant | (none) | unresolved | fallback | 0.00 | true | [] |
| API: catalog | paginationAlign='right' | impl-rec | verified | 0.85 | false | — |
| API: no catalog | paginationAlign='right' | impl-rec | hint | 0.70 | false | — |
| API: no input in catalog | paginationAlign='right' | impl-rec | hint | 0.70 | false | — |
| API: no evidence | (none) | — | — | — | — | 0 entries |

## Appendix C: Before/After Semantic Matrix

See §21 — all 8 real-fixture groups byte-identical to baseline; `behaviorBindings[]` added (1 entry).

## Appendix D: Artifact Metrics

resolved.json 3,718 → 10,934 B (2.94×) · spec.md 22,175 B · agent-context.md 8,240 chars · context-manifest.json 21,125 B · evidence ≤ 4/group · candidates ≤ 3 · rejected ≤ 1 · no source bodies / no absolute paths / no credentials.

## Appendix E: Read Trace Results

resolve: 2 `.sliceui` + 1 design XML + 1 SliceUI-own module, **0 project-source reads**. spec: 3 + 1 + 1, **0 project-source reads**. hot referee: 0 project-source *file* reads (one `exists` dir probe on the missing-verdict path). agent-context: pure module (no fs import), asserted by test.

## Appendix F: Source Hashes and Git Status

Hashes (start = end, byte-identical):
`resolution-policy.mjs 78eeaf2e…` · `resolve.mjs 70bd3600…` · `commands/resolve.mjs 0051578f…` · `commands/spec.mjs a3d2124a…` · `agent-context.mjs d7a248cf…` · `test/resolve.test.mjs c7b00c0d…` · `test/spec.test.mjs fabde893…` · `test/agent-context.test.mjs 6ac9ab8a…` · `SKILL.md e64eed35…` · `api-contract.md ba16a911…` · `architecture.md b7907bef…` · `status.md 97eb76ff…` · `verify-gate-trust.md fb3a4af1…`.

`git status --short` (SliceUI): 12 modified (5 src, 3 test, 4 docs) + `resolution-policy.mjs` + 10 untracked prompt files. Target project: 3 modified `testingcomponent.*` files (pre-existing, untouched). No commit; no stray `.sliceui` in the SliceUI repo.

*End of verification. No source, test, skill, or documentation was modified — this report is the only new repository file.*
