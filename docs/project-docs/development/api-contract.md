# Development — API Contract (CLI Commands & Artifacts)

Last update: 2026-09-10
Status: Live

---

## 1. Description

The machine-facing contract of SliceUI: every CLI command's inputs/outputs/exit codes, and the schemas of the `.sliceui/` artifacts stages exchange. This is a CLI, so this doc plays the role `api-contract.md` plays for services.

## 2. Important

- `TRANSCRIPT_VERSION = 3` (`src/lib/transcript-schema.mjs:5`) — transcript artifacts are versioned; a schema change is a breaking artifact change.
- The agent-facing contract (`skill/SKILL.md`) is built on top of this one and must not contradict it.
- Facts below verified against `src/commands/` and `README.md` (2026-09-10); where code and README disagree, code wins and the doc says so.

## 3. Table of Contents

- [4. Scope](#4-scope)
- [5. Goals](#5-goals)
- [6. Non Goals](#6-non-goals)
- [7. Base Contract & Conventions](#7-base-contract--auth)
- [8. Request/Response Format](#8-requestresponse-format)
- [9. Endpoints (CLI Commands)](#9-endpoints-cli-commands)
- [10. Artifact Schemas](#10-artifact-schemas)
- [11. Rate Limiting](#11-rate-limiting)
- [Success Metrics](#success-metrics)
- [Related Documents](#related-docs)
- [Open Questions](#open-questions)

## 4. Scope

CLI surface + `.sliceui/` artifact files. Library internals (`src/lib/*`) are implementation, not contract.

## 5. Goals

An agent (or script) can drive the full pipeline from these signatures alone.

## 6. Non Goals

Does not document the Gemini HTTP API itself (external service; see `gemini-client.mjs`).

## 7. Base Contract & Auth

- **Invocation:** `sliceui <command> [args]` (bin `src/cli.mjs`) or `node src/cli.mjs <command>` from source.
- **Working context:** commands operate on the CWD's `.sliceui/` directory (created by `init`).
- **Auth:** none for XML/static tiers. Gemini tier reads `GEMINI_API_KEY` / `VITE_GEMINI_API_KEY` from env, `.env.local`, or `~/.sliceui/.env.local`.
- **Exit codes:** `0` success; `1` gate failure (verify/referee red, doctor problems); `2` usage/framework-not-supported (e.g. verify on `.tsx`); `3` **unverifiable** — verify ran but its required ground truth is missing/stale/malformed (PR 5). See §9.1.

## 8. Request/Response Format

Commands are argument-driven; results are either stdout text (human/agent-readable) or files under `.sliceui/`. No JSON stdout contract is guaranteed except where stated.

### 9.1 Verify trust and diagnostic contract (PR 5)

`sliceui verify` distinguishes four evidence trust sources (see `technical-guidelines/verify-gate-trust.md` §2):

| Trust source | Meaning | Can it block? |
| :--- | :--- | :--- |
| `literal-design` | raw XML / transcript facts (text, geometry, colors, node relationships) | yes |
| `verified-capability` | exact Pilar catalog selector/input/output, framework version | yes |
| `shared-assumption` | classVocabulary / ngDeepCorpus / loadedClassRegistry — the same corpus the generator copied | only against valid provenance, and it is labelled `shared-assumption`, never presented as independent design fidelity |
| `independent` | generated-implementation structural facts (the subject under test, not ground truth) | — |

Every check emits a **stable diagnostic record** — `id` (`SUI-VERIFY-<CATEGORY>-<NNN>`), `category`
(bounded: `ground-truth`, `target`, `framework-syntax`, `component-api`, `template-structure`,
`design-fidelity`, `layout`, `style`, `shared-convention`, `module-wiring`, `auth-wiring`), `trust`
source, and `severity` (`error` = blocking, `warning` = material but non-blocking, `info` =
completed/pass). The command's **primary state** is one of `pass` / `fail` / `unverifiable` /
`invalid-input`, mapping to exit `0` / `1` / `3` / `2`.

- **Target-name normalization:** `testingcomponent`, `TestingcomponentComponent`,
  `testingcomponent.component`, `testingcomponent.component.ts` all address the same target;
  path traversal and separators are rejected (`invalid-input`, exit 2); a genuinely ambiguous
  name is surfaced, never first-picked.
- **No false green:** missing/stale/malformed ground truth, a target-not-found, or an all-skip
  run with required checks skipped is **non-green** — `unverifiable` (exit 3) or `invalid-input`
  (exit 2). `resolved.json`/`spec.md`/`agent-context.md` are never verify ground truth; verify
  stays independent of the resolve pipeline.

### 9.2 Rendered gate (PR 6A — development-only)

`sliceui verify <dir> [name] --render` is an **opt-in, development-only** rendered visual-fidelity
gate. Static verify runs first and short-circuits on a blocking static fail/unverifiable state
(render is a superset, never a retry of an invalid foundation). When static passes, it mounts the
component in an isolated `/tmp` Angular 13 workspace (real SCSS → Dart Sass → esbuild bundle →
`platformBrowserDynamic` bootstrap in headless Chromium) and measures rendered style + geometry
against the transcript.

- **Availability:** `--render` requires the dev-only Angular mount fixture (`test/fixtures/
  angular-mount`) and Playwright/Chromium. The published npm tarball ships the render source but
  **not** the fixture or browser provisioning, so a packaged invocation deterministically returns
  `fixture-unavailable` (exit 3) with "provision the mount fixture" guidance — it is never
  advertised as working out of the box for public users.
- **Result states → exit:** `pass` (0) · `visual-fail`/`build-fail`/`mount-fail`/`runtime-fail`/
  `browser-unavailable` (1, each a distinct state) · `unverifiable`/`fixture-unavailable` (3) ·
  `invalid-input` (2, bad target or `--viewport`). Every render-stage exception is caught by a
  single phase-aware error boundary and mapped to a deterministic non-green state — no raw
  uncaught crash.
- **Viewport bounds:** default `1440×900`; `--viewport WxH` accepts integers `200–7680` on each
  axis. Anything outside (including `99999x99999`) is `invalid-input` (exit 2) before any browser
  launch.
- **Deterministic environment:** animations/transitions disabled, `document.fonts.ready` awaited,
  bounded timeouts. **Network is actively blocked**: a `context.route` interceptor aborts any
  non-`data:`/`blob:`/`about:` request before it leaves the browser; a blocked external attempt
  produces a sanitized `SUI-RENDER-NETWORK-001` diagnostic (scheme+host+resource-type only, never
  the query string/headers/body) and flips the state to `runtime-fail` (non-green). A captured
  page error also makes the state `runtime-fail` — rendered geometry is never trusted after an
  invalid runtime/network state.
- **Oracle:** transcript literal/structural facts only. Measured families (PR 6A + 6B): root padding
  (`SUI-RENDER-GEOMETRY-001`), control height (`-002`), button frame height (`-003`, optional),
  divider thickness (`-004`), line-height (`-005`), table frame height (`-008`, optional), plus text
  color/size/weight (`SUI-RENDER-STYLE-*`). `spec.md`/`resolved.json`/`agent-context.md` and pixel
  similarity are NOT the oracle — screenshot is supporting evidence only.
- **Fact semantics & required/optional (`render-geometry.mjs`):** each fact declares its `box`
  (`border-box` = the design frame IS the rendered box; `structural` = a derived relation). A
  **required** fact — root padding, control height (a literal input height mapped to the visible
  control border box), divider thickness, line-height — that is `missing`/`ambiguous`/outside
  tolerance is `visual-fail` (blocking). An **optional** fact (a button's design-frame height, which
  a correct implementation legitimately reaches via font+padding, or a table container frame) that
  mismatches is a non-blocking `warn`; a `missing` optional fact skips. Tolerances are centralized
  (`GEOMETRY_TOLERANCE`): box `±2px`, line-height `±1px`, divider `±1px`.
- **Required-count guard (no false green):** when **no required fact exists at all** (style or
  geometry — e.g. a transcript whose only design fact is an optional button frame), the run is
  `unverifiable` (exit 3) with a bounded `SUI-RENDER-GEOMETRY-000` diagnostic — an optional-only
  render proves nothing blocking, so it can never be `pass`. Mirrors §9.1's exit-3 rule for skipped
  required checks.
- **Verdict precedence (explicit, PR 6C corrective):** `1.` build/browser/mount/runtime/setup or
  blocked-network failure (highest) → `visual-fail`/`runtime-fail`; `2.` invalid input/map → exit 2
  before any browser; `3.` required comparison **and** required mapping failures → `visual-fail`;
  `4.` zero required facts → `unverifiable`; `5.` required passes + optional warnings → `pass`. The
  zero-required guard runs **after** fail aggregation and only fires when nothing failed, so a real
  required mismatch can never be downgraded to `unverifiable` — a required style failure outranks a
  zero-required-geometry state. Per-run metrics expose `requiredFactCount`,
  `requiredExecutedCount`, `requiredPassCount`, `requiredFailureCount` (a required comparison that
  *executed and failed* counts as executed evidence, never as passed evidence; optional and
  unsupported rows never increment a required counter).
- **Required border presence (PR 6C corrective):** a required evidenced border with a **positive
  expected width** that renders at **0px** is *absent*, not approximately correct — the presence
  rule is applied **before** the numeric comparison, so the general `±1px` tolerance can never
  swallow a missing border (design `1px` vs actual `0px` fails). Normal tolerance is preserved for
  present borders (`2px` at `±1px` passes, `2.1px` fails). Border **color** is only meaningful where
  the side renders with positive width: a zero-width side measures as unmeasured (non-green) rather
  than comparing the browser's default `rgb(0,0,0)`, and a fully transparent computed color
  (`alpha 0`) never compares equal to an opaque design value. Divider facts remain side-specific.
- **Mapping contract:** a fact resolves to `unique` (one visible candidate → measured), `missing`,
  or `ambiguous` (>1 visible candidate). A mapper **never first-picks**: required `missing`/
  `ambiguous` → non-green with a *mapping* diagnostic; optional `missing` → skip, optional
  `ambiguous` → non-blocking warn. Non-rendered elements are filtered before counting (a hidden
  duplicate cannot create false ambiguity); a nested text duplicate uses one documented deterministic
  refinement, never DOM order.
- **PR 6C families:** flex/structural `gap` (`SUI-RENDER-GAP-001`, axis-correct), uniform border
  width (`-BORDER-001`, **all four sides**) and color (`-BORDER-002`, **all four sides**), uniform
  radius (`-RADIUS-001`) and per-corner (`-RADIUS-002`), letter-spacing (`-TYPO-001`), role
  font-size (`-TYPO-002`) and font-weight (`-TYPO-003`), font family (`-FONT-001`), objective
  overflow (`-OVERFLOW-001` x / `-002` y on the page container, `-003` mapped-element content
  overflow, `-004` off-viewport), and optional table frame (`-TABLE-001`). Exact-match families
  (border color, font family) compare by equality with no pixel tolerance; the diagnostic reports
  `exact match` rather than a bound.
- **Selector map (PR 6C, fixture-scoped):** a design node whose fact cannot be identified by text or
  role (pagination items, footer frames) may be bound through a fixture's `geometry.map.json`. The
  map is **locator-only** and strictly validated: an explicit schema allowlist (root/mapping/
  locator) rejects any unknown field, and a recursive, case-/separator-insensitive scan rejects any
  `expected*`/`actual*` or named semantic-exception field (`expectedScroll`, `allowOverflow`,
  `validTruncation`, …) anywhere in the payload. Non-`css` strategy, script/URL/absolute-path
  content, and selectors over 200 chars are also rejected. An invalid map is `invalid-input` (exit 2)
  before a browser launches, with a bounded `SUI-RENDER-MAP-001` diagnostic. The map identifies an
  element; **every expected value still comes from the transcript/XML**. A missing or ambiguous
  required target stays non-green — the map does not bypass the PR 6B contract.
- **Selector-map ownership & loading (production path):** `verify --render` resolves the map at ONE
  bounded, deterministic location — a **sibling of the component files named after the resolved
  component stem** (`<stem>.map.json`), i.e. `geometry.component.ts` → `geometry.map.json`. There is
  no recursive search and no repository scan; the path derives from the component directory the
  caller already addressed, so traversal is not expressible and no arbitrary user-supplied path is
  accepted. The map is read **at most once per render**, parsed safely, and validated before any
  browser launch — an unreadable, unparseable, or schema-invalid map exits `2` with
  `SUI-RENDER-MAP-001` and launches **zero** browsers. Absence is legal and map-optional: without a
  map the text/role mappings still run, structural families emit nothing (a design node that cannot
  be identified is not guessed at), and the zero-required protection stays active — a missing map can
  never produce a false pass. Static verify (no `--render`) never reads the map and never loads
  browser tooling.
- **Mapping ambiguity stays non-green for locator-bound facts** — a selector matching several
  elements is not resolved by DOM order.
- **Honest unsupported (no design fact in the transcript format):** table row height and cell
  padding (the parser emits no row/cell node type — only container frames), border *style*,
  non-`space-between` alignment, and an explicit "expected scroll"/"valid truncation" contract.
  `overflow: hidden` alone never fails. These are declared, not approximated.
- **Artifacts:** PNG + report under `.sliceui/artifacts/<name>/render/` only with
  `--preserve-render-artifacts`. Otherwise the screenshot is **temporary supporting evidence under
  `/tmp`**: removed when the render passes, and retained (with its path printed) when it does not, so
  a failure keeps its evidence. Never writes the target project, never installs dependencies, never
  commits screenshots.
- **Diagnostics:** every projected diagnostic carries its bounded `detail` sentence alongside
  `expected`/`actual`/`delta`/`tolerance`/`unit`/`trust`/`remediation`. A missing optional bound
  prints as `null` (an explicit "no bound"), never as a literal `undefined`.

## 9. Endpoints (CLI Commands)

| Command | Input | Output | Exit |
| :--- | :--- | :--- | :--- |
| `sliceui init [--key-from F]` | — | `.sliceui/{images,xml,transcript}/`, `config.json`, `.env.local`, gitignore, `project-context.json`, `conventions.json`, `.sliceui/context/*.md` (+3 pilar files for UII projects) | 0/1 |
| `sliceui detect` | CWD project | `.sliceui/project-context.json` + `.sliceui/context/*.md` | 0/1 |
| `sliceui transcribe <input>` | `.xml`/`.figml` file or image | `.sliceui/transcript/<name>.transcript.{md,json}` + `.transcript.meta.json` (input-stamped) | 0/1 |
| `sliceui resolve <xml\|json>` | FIGML XML or transcript JSON | `.sliceui/artifacts/<name>/resolved.json` | 0/1 |
| `sliceui referee [root] [--target <name>]` | ground-truth artifacts | stdout verdict per claim (green/red per check) — **snapshot mode** (reads `.sliceui` + design input, no repo scan) | 0/1 |
| `sliceui referee [root] [--target <name>] --deep` | ground-truth artifacts + live repo | stdout verdict per claim + writes `.sliceui/referee-verdict.json` | 0/1 |
| `sliceui verify <dir> [name] [--xml F] [--transcript F] [--conventions F]` | generated `.ts/.html/.scss` | stdout per-check verdicts | 0 (pass) / 1 (fail) / 2 (invalid input/target) / 3 (unverifiable) |
| `sliceui verify <dir> [name] --render [--viewport WxH] [--preserve-render-artifacts]` | generated component + transcript | **opt-in rendered gate** — mounts + renders in headless Chromium, measures geometry/computed styles against the transcript | 0 (pass) / 1 (visual/build/mount/runtime fail) / 2 (invalid input/viewport) / 3 (unverifiable) |
| `sliceui doctor` | — | environment diagnosis (Node, platform, sips/swiftc, key, skill, live Gemini) | 0/1 |
| `sliceui fidelity <xml>` | FIGML XML | stdout % + per-attribute breakdown | 0/1 |
| `sliceui install [--dir D]` | — | skill files into `~/.claude/skills/sliceui` (or D) | 0/1 |
| `sliceui uninstall` | — | removes `.sliceui/` | 0/1 |
| `sliceui update` | — | self-update CLI + refresh installed skill | 0/1 |
| `sliceui --help` | — | usage | 0 |

For UII (pilar) projects, `init` additionally writes `.sliceui/uii-profile.md`, `.sliceui/pilar-reference.md`, `.sliceui/pilar-showcase.md` (Inferred from codebase: HANDOFF-pilar doc §B; public installs degrade to none of these).

## 10. Artifact Schemas

### 10.1 `.sliceui/transcript/<name>.transcript.json` (version 3)

Validated by `src/lib/transcript-schema.mjs` (`validateTranscript`). Key structure (Inferred from codebase):

- `meta` — includes the source input path (staleness stamp), fidelity, degraded flag.
- `nodes[]` — layout tree; each node: `type` (per `LAYOUT_TYPES`), `text`, `bg`, `style {size,weight,color}`, geometry `[x, y, W, H]`, `pad:t/r/b/l`, `gap:`, radius `r:`, `children[]`.
- `meta.transcriptVersion: 3`.

### 10.2 `.sliceui/transcript/<name>.transcript.meta.json`

Names the exact input file the transcript was generated from — the staleness check compares this against the current input before trusting the transcript (SKILL.md invariant).

### 10.3 `.sliceui/project-context.json`

Produced by detect/init. Carries:

- `capabilities` — per UI-category library resolution: `{ library, sampleHtml, source }` with `source ∈ {local, installed}` or `null` (plain HTML + note). Precedence: local usage > installed package > null. Categories: `select, table, modal, toast, editor, date, slider, switch, pagination, divider, well, checkbox, layout`.
- `provenance` — per-claim signal: `sourceCode | configFile | registryDefault` (source code is ground truth). `provenance.componentDir` carries `angularJsonLibrary | angularJsonMain | registryDefault`.
- `designTokens` — the project's variables/CSS-props/mixins (literal values only).
- `sampleComponents` — feature components (app shell excluded) chosen by relevance for idiom learning.
- `moduleStructure`, `componentDir`, `componentDirSource`, `generatedAt`, `inputHash`.

The agent-facing slice `.sliceui/context/{INDEX,capabilities,design-tokens,samples}.md` is written
alongside (additive views — the root JSON stays the machine contract, since it can exceed the
agent's Read cap).

### 10.4 `.sliceui/conventions.json`

Deterministic facts (the verify gate's ground truth): `classVocabulary`, deep-selector override corpus (scoped by capability family), `componentAnatomy`, `naming` (selector prefix + event-handler pattern), plus the loaded-class registry the verify gate reads (wired in 8a1628d).

**Single-owner (PR 2):** `conventions.json` is the canonical owner of `loadedClassRegistry` and
the convention facts. `project-context.json` no longer carries `loadedClassRegistry` or a nested
`conventions` object. Readers use `src/lib/snapshot.mjs` (`loadConventionsSnapshot`): canonical
first, then legacy fallback to the pre-PR-2 `project-context.json` location, with a conflict
diagnostic when the two copies disagree (canonical wins). No repository scan is ever performed as
a fallback.

`loadConventionsSnapshot` returns three explicit states:
- `source: "canonical"` — `conventions.json` present (even if its collections are empty); `conventions` is the parsed object.
- `source: "legacy"` — `conventions.json` absent/invalid but `project-context.json` carries the pre-PR-2 fields; `conventions` is recovered in-memory.
- `source: "none"` — no canonical and no legacy data; `conventions` is **`null`** (never a truthy empty object), with a `SUI-SNAPSHOT-001` diagnostic. A malformed canonical file that has no legacy fallback is also `none` (corruption diagnostic, not silent empty).

`sliceui verify` treats `source: "none"` as missing ground truth: it prints "NO GROUND TRUTH …
NOT verifiable" and exits non-zero — a run with no conventions/transcript/XML can never be green.

### 10.4b `.sliceui/referee-verdict.json` (PR 3)

The stored codebase-evidence verdict, written by `sliceui init` (cold path) and `sliceui referee
--deep` (explicit live scan). It carries the codebase-head findings (duplicate selectors, convention
provenance, well/corpus claims) as a small summary — never source bodies. It is bound to two
fingerprints (`projectFingerprint` = detect `inputHash`; `snapshotFingerprint` = sha256 of
`conventions.json` + `project-context.json`). The default `referee --target` reads it (snapshot mode,
**zero project-source reads**); `--deep` re-scans and refreshes it. A missing/stale/invalid verdict
is **non-green** (exit non-zero) with a diagnostic — never a silent re-scan, never a pass-by-absence.

**Freshness boundary (what "fresh" means).** Snapshot mode never reads repository source, so it
cannot detect working-tree edits that its fingerprint anchors do not cover:

- `snapshotFingerprint` covers `conventions.json` + `project-context.json` — a change to either makes
  the verdict **stale**.
- `projectFingerprint` is detect's `inputHash` (`package.json`, `angular.json`, `tsconfig.json`,
  `package-lock.json`, `git HEAD`) — it does **not** cover uncommitted HTML/SCSS/CSS/component-`.ts`
  edits. Such edits can leave the verdict assessed as `fresh` even though the source changed.
- A `fresh` verdict therefore means "the stored fingerprints still match the bounded anchors snapshot
  mode checks", **not** "the working tree is proven identical to the deep-scan state".

**Remediation.** After a relevant source edit, after a component/library usage change not yet reflected
in the snapshot, or whenever freshness is in doubt, re-validate explicitly — `sliceui referee --target
<name> --deep` — which re-scans and refreshes the verdict. Snapshot mode never silently falls back to
deep mode.

### 10.5 `.sliceui/artifacts/<name>/resolved.json`

**schemaVersion 2** (PR 4 — typed resolution). A `groups[]` array of unique styled-leaf mappings —
identical table rows are deduped into one entry with `count` + `ids[]`. Each group carries
`resolved[]` (the exact idiom candidates the agent may emit; keyed by design evidence: color, icon,
Figma glyph name) plus optional `candidates`/`fallback`. `meta` holds `totalLeaves`/`uniqueGroups`.

Every group also carries the PR 4 provenance fields — **all additive**; the `resolved[]`/`evidence`/
`fallback` shape is unchanged from schema 1, so older readers stay valid:

| Field | Values | Meaning |
| :--- | :--- | :--- |
| `classification` | `implementation-recommendation` \| `semantic-hypothesis` \| `unresolved` | what kind of statement the value makes |
| `authority` | `hint` \| `fallback` (emitted); full ladder `authoritative`/`verified`/`hint`/`fallback`/`unresolved` in `resolution-policy.mjs` | how much the agent may trust it |
| `confidence` | `0` / `0.5` / `0.7` / `0.85` / `0.95` | deterministic tier — never model-assigned |
| `fallbackUsed` | boolean | the recommended output IS the conservative fallback |
| `provenance` | `{design[], project[], mapping{rule, detail?}}` | traceable pointers (transcript node ids, vocabulary/corpus/catalog locators); bounded to 5 per side, never full source bodies |
| `rejected` | `[{value, reason}]` (≤3) | material rejected alternatives — e.g. behavioral CSS superseded by a public input |
| `candidates` | `string[]` (≤3) | ambiguous mappings — the agent picks from design evidence |
| `diagnostics` | `[{code, nodeId, …}]` | explicit ambiguity/failure signals, e.g. `SUI-RESOLVE-STATUS-AMBIGUOUS` |

**Ambiguous taxonomy rule (TAX-001 corrective patch).** A status badge whose co-occurrence yields
**multiple** `label-custom-*` candidates and no status text that decides them is **never silently
picked**: `resolved[]` carries no `class` entry, `candidates[]` holds the top-3 stable-ordered
names, `classification` is `semantic-hypothesis`, `authority` is `hint`, `confidence` is `0.5`, and
a `SUI-RESOLVE-STATUS-AMBIGUOUS` diagnostic names the node, the candidate count, and the handling
("pick from the design's status text, never guess"). Exactly **one** candidate selects as a `hint`
at ≤0.70; **zero** candidates stays `unresolved`/`fallback`/`fallbackUsed:true`.

`behaviorBindings[]` (top level) carries public-API precedence recommendations derived from
structural design evidence + the machine-verified pilar catalog: `{property, value, implementation
{category, component, binding, expression}, authority, confidence, evidence[], rejected[]}`. The
**top-level `authority` is `hint`** — the binding value is a recommendation, not a verified fact.
The verified capability (`uii-table.paginationAlign` exists) is represented on the `project-capability`
evidence entry, whose `authority` is `verified`.

**Confidence tiers** (deterministic by rule — same input ⇒ same score; missing provenance can never
score `exact`/`high`; multiple candidates cap at `low`; fallback is `none`): `0.95` deterministic
metadata alias (glyph name/variant → FA class) · `0.85` strong structural relationship + verified
capability (SPACE_BETWEEN footer → `paginationAlign`) or status-text table + verified class ·
`0.70` name/color semantic match, single-candidate co-occurrence · `0.5` ambiguous candidates ·
`0` unresolved/fallback.

**Semantic-safety rules.** A resolved value is always a mapping *from* design evidence, never the
evidence itself — literal design facts stay in `transcript.json`. Authority `authoritative` is never
given to a status taxonomy, an icon color inference, a repository sample, or a fallback. `spec.md`
labels every non-high-confidence idiom `hint(<level>):` and keeps `CANDIDATES:`/`FALLBACK:` visible;
`agent-context.md` restates the same in its non-authoritative "Implementation Hints" section.

The agent emitting anything outside `resolved[]` is a verify failure mode. (`--json` still prints
the full per-leaf `leaves`/`statusTable` for callers.) The artifact is diagnostic input to the agent
and is **not** read by any command: `spec`/`agent-context` re-derive in memory via `resolveTranscript()`,
and `verify` stays independent of it.

### 10.6 Config / env files

- `.sliceui/config.json` — init config.
- `.env.local` (project) / `~/.sliceui/.env.local` (global) — Gemini key; gitignored by init.

## 11. Rate Limiting

Only the Gemini tier has external rate concerns (Google's API quotas apply to the user's key). Local tiers are unbounded.

## Success Metrics

An agent following `skill/SKILL.md` never needs to read engine source to drive the pipeline.

## Related Documents

- `foundation/architecture.md` §9b — artifact flow between stages
- `foundation/prd.md` FR-1..FR-8 — behavioral requirements behind these contracts
- `skill/SKILL.md` — agent-facing workflow on top of this contract

## Open Questions

- Should stdout become a stable machine-readable format (`--json` flag) for agent parsing? (Currently prose — Inferred from codebase.)
