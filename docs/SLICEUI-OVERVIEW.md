# SliceUI — What It Is and How It Works

> A complete briefing document for anyone reading SliceUI cold — to understand the tool before
> proposing changes, or to brainstorm improvements against the current design and its known
> pain points.
>
> **Last updated:** 2026-09-24 · **Version:** v0.15.0 (+ in-flight uncommitted work)
> **Repo:** `github.com/Rafi-Hariman/sliceui-skill` · **License:** MIT · **Node:** ≥ 20

---

## 1. What SliceUI Is

SliceUI is an **agent skill + CLI** that converts a UI design into component code that drops into
a target project using that project's own framework, version, and UI-library idiom — and it
**proves** the result is faithful with a deterministic verification gate.

One sentence: *"slice a design into code that looks like the team wrote it, and gate it before the
agent claims success."*

It is built for **text-only coding agents** (Claude Code, Cursor, GLM Code, and models that cannot
see images). The core product move is **transcription**: the design is first turned into a
structured text transcript, so a model that can't see a screenshot can still generate accurate UI
code from exact text, colors, geometry, and component names.

It ships as two things:

1. **A CLI** (`sliceui`, published to npm as `sliceui-skill`) — a deterministic engine of ~13
   commands (see §5).
2. **An agent skill** (`skill/SKILL.md`) — installed into the agent's skill directory by
   `sliceui install`; it teaches the agent *how to drive* the CLI and *what invariants* to obey.

---

## 2. The Problem It Solves, and the Bet

**The problem.** A coding agent handed a Figma design or screenshot tends to do one of two bad
things:

1. **Guess the design** — it "looks at" the image (or can't see it at all) and hallucinates text,
   colors, spacing, and structure.
2. **Guess the project** — it emits raw `<select>`/`<table>`/`<div>` and invented CSS classes,
   ignoring the team's actual component library (`ngx-select-ex`, `uii-table`, `pilar`,
   `@uiigateway/core`) and its unwritten conventions (reusable classes, `::ng-deep` overrides).

**The bet.** Both failure modes are *removable with determinism*, not with a better prompt:

- **Design facts** come from a machine parse of the design (exact, no vision) wherever possible.
- **Project idiom** comes from a machine scan of the codebase (which library serves each UI
  category, plus the reusable classes and `::ng-deep` corpus the team already uses).
- **Correctness** is not left to the agent's judgment — a blocking gate (`verify`) checks the
  output against the design *and* the project before the agent may call a slice "done."

The product's center of gravity is **gate trustworthiness**: *red must mean real defect, green
must mean real correctness* (see §10).

---

## 3. Inputs: XML First, Screenshot as Fallback

Two input paths feed the same pipeline. They degrade tier-by-tier, never guess.

| Tier | Input | Mechanism | Network / key | Fidelity |
| :--- | :--- | :--- | :--- | :--- |
| **0 (preferred)** | FIGML XML (`.xml` / `.figml`) from the Figma FIGML plugin | Deterministic parse (`fast-xml-parser`) | None, 100% local | ~90%+ attribute fidelity |
| **1** | Screenshot | Gemini vision (`GEMINI_API_KEY`, the user's own key) | Image sent to Google | Model-dependent |
| **2** | Screenshot | macOS static: `sips` decode + Swift Vision OCR | None, local, macOS-only | OCR-dependent |

**Privacy stance:** XML is fully local. Screenshots only egress to Google on tier 1, with the
user's own key. No telemetry — SliceUI never phones home. Keys are never committed or logged.

The transcript the pipeline produces is **framework-agnostic**: it carries only design facts
(text, color, geometry, icons, checkbox state), so the same transcript is equally useful in any
framework.

---

## 4. The Core Invariant: Division of Authority

Everything about how the agent is supposed to behave flows from one invariant, restated in
`skill/SKILL.md`:

> **The transcript/XML owns ALL visible appearance** — exact text, color, radius, padding, gap,
> spacing, wrapper, heading level, column layout. Reproduce it exactly; if the XML doesn't show
> it, don't invent it.
>
> **Samples are WRITING samples only** — read them to learn *how to spell* the framework and *how
> to wire* the library, not to copy their UI.

Concretely this means:

- **Structure comes from the design only.** Conventions style elements that already exist; they
  never add structural wrappers. If the XML has no `.well` wrapper, the agent must not emit one.
- **Colors come from the transcript** as exact hex, unless the project has a token for it — then
  the token wins.
- **The `::ng-deep` reusable corpus is the ONE styling thing copied verbatim** from the project,
  because it targets library-internal DOM the XML cannot see (hover/open states, dropdown radius,
  pagination borders).
- **A library capability that is `null` is non-silent** — use native HTML and *flag it*, never
  silently guess a library.

---

## 5. The Pipeline (End-to-End)

```
  design.xml / image
        │
        ▼
  ┌─────────────────────────────────────────────────────────────────────────┐
  │  sliceui init        (once per project)                                  │
  │    → .sliceui/ scaffold + project-context.json + conventions.json/.md   │
  │    → runs detect (framework, libraries, conventions)                    │
  │    → runs referee codebase head (surfaces a corruption map at setup)    │
  └─────────────────────────────────────────────────────────────────────────┘
        │
        ▼
  ┌─────────────────────────────────────────────────────────────────────────┐
  │  sliceui transcribe <input>                                             │
  │    → .sliceui/artifacts/<name>/transcript.{md,json,meta.json}           │
  │    → exact layout + colors + text + icons + checkbox + fidelity score   │
  └─────────────────────────────────────────────────────────────────────────┘
        │
        ▼
  ┌─────────────────────────────────────────────────────────────────────────┐
  │  sliceui resolve <input>                                                │
  │    → .sliceui/artifacts/<name>/resolved.json                            │
  │    → every styled leaf → resolved[] (exact idiom candidates)            │
  └─────────────────────────────────────────────────────────────────────────┘
        │
        ▼
  ┌─────────────────────────────────────────────────────────────────────────┐
  │  sliceui spec <input>      (one-pass render doc)                        │
  │    → .sliceui/artifacts/<name>/spec.md                                  │
  │    → inventory + resolved idioms inline + ::ng-deep copy-targets        │
  └─────────────────────────────────────────────────────────────────────────┘
        │
        ▼
  ┌─────────────────────────────────────────────────────────────────────────┐
  │  sliceui referee --target <name>    (PRE-generate gate)                 │
  │    → validates ground-truth artifacts vs design + codebase             │
  │    → red? stop; refresh artifacts before generating                     │
  └─────────────────────────────────────────────────────────────────────────┘
        │
        ▼
  ┌─────────────────────────────────────────────────────────────────────────┐
  │  The agent writes .ts / .html / .scss (from transcript + project ctx)  │
  └─────────────────────────────────────────────────────────────────────────┘
        │
        ▼
  ┌─────────────────────────────────────────────────────────────────────────┐
  │  sliceui verify <dir> <name>    (POST-generate BLOCKING gate)           │
  │    → deterministic checks: fidelity + conventions + structure          │
  │    → must exit 0 before the slice counts as done                       │
  └─────────────────────────────────────────────────────────────────────────┘
```

Two gates bracket the codegen:

- **`referee` (pre-generate)** — ensures the ground-truth artifacts the agent is about to trust
  are themselves correct and not stale (do the convention claims still trace to real code? did
  the transcript drop attributes?).
- **`verify` (post-generate)** — ensures the generated component is faithful (did the agent drop
  text, invent a class, mis-wire a table, reverse the buttons?).

**A verify run with no ground truth is never green** — "pass by absence" is explicitly forbidden
(R1, §10).

---

## 6. The Commands

| Command | What it does |
| :--- | :--- |
| `sliceui install [--dir DIR]` | Install the agent skill (default `~/.claude/skills/sliceui`) |
| `sliceui init [--key-from F]` | Set up `.sliceui/`, config, `.env.local`, gitignore; run detect + conventions |
| `sliceui detect` | Detect framework, library usage, conventions → `project-context.json` + `conventions.json` |
| `sliceui transcribe <input>` | `.xml`/`.figml` → exact parse; image → Gemini → static fallback |
| `sliceui resolve <xml\|json>` | Map every styled leaf to exact idiom candidates → `resolved.json` |
| `sliceui spec <input>` | Merge inventory + resolved idioms + layout rules into one `spec.md` |
| `sliceui referee [--target N]` | Pre-generate gate: validate ground truth vs design + codebase (snapshot mode; `--deep` re-scans) |
| `sliceui verify <dir> [name]` | Post-generate blocking gate: fidelity + conventions + structure; exit 0/1 |
| `sliceui fidelity <xml>` | Score visual-attribute preservation (FIGML → transcript) as a % |
| `sliceui doctor` | Diagnose install (Node, platform, key, skill, live Gemini) |
| `sliceui uninstall` / `update` | Remove `.sliceui/` setup / self-update |
| `sliceui --help` | Usage |

The companion skill **`/sliceui-handoff`** (shipped by `sliceui install`) writes a single compact
`.sliceui/handoff.md` for a **CLI-less** web agent (e.g. a Microsoft Copilot custom agent that can
only read uploaded files). It has the agent itself read real components and restate the invariants
as direct rules, because that agent has no `verify` gate.

---

## 7. The Three Framework Layers

SliceUI is **Angular-first** and honest about it. Framework support is split into three layers,
each with a different maturity:

| Framework | Detect | Codegen rules | Deep adaptation (library wiring, convention mining, verify) |
| :--- | :---: | :---: | :---: |
| **Angular (v13-first)** | ✅ version, prefix, module | ✅ version-aware (`*ngIf` vs `@if`, DI, standalone) | ✅ **full** — the only verify-gated framework |
| React (TSX) | ✅ | ✅ `className`, Tailwind, FC | ⚠️ experimental |
| Next.js | ✅ | ✅ App Router, server/client | ⚠️ experimental |
| Vue 3 (SFC) | ✅ | ✅ `<script setup lang="ts">`, scoped | ⚠️ experimental |
| Svelte | ✅ | ✅ Svelte 5 runes | ⚠️ experimental |
| Tailwind / HTML | ✅ (fallback) | ✅ utility classes / semantic HTML | ⚠️ experimental |

- **Detection** — works for all frameworks (`src/commands/detect.mjs` + `src/lib/detect-utils.mjs`).
- **Codegen rules** — a rule set per framework (`src/framework/*/rules.mjs`), genuinely
  multi-framework.
- **Deep adaptation** — Angular only today: conventions mining, library registry, golden
  references, `verify`, `referee`.

This is a deliberate **honesty** decision: no framework claims "supported" without a verify gate.
Non-Angular output is explicitly labeled experimental and never guesses a library.

---

## 8. The Artifacts (`.sliceui/` contract)

All inter-stage contracts are files under the target project's `.sliceui/`:

```
.sliceui/
  inputs/xml/<name>.xml           (the source design)
  artifacts/<name>/
    transcript.{md,json,meta.json}   (transcribe output; meta stamps the input path for staleness)
    resolved.json                     (resolve output)
    spec.md                           (one-pass render doc)
  project-context.json             (WHAT the project is)
  conventions.json + conventions.md (HOW this team writes)
  config.json, .env.local          (project config + optional Gemini key)
  uii-profile.md, pilar-reference.md, pilar-showcase.md   (UII projects only — see §11)
```

### 8.1 `project-context.json` — WHAT the project is

A `capabilities` map: **which library serves each UI-element category**, resolved by precedence
`local usage > installed package > null (plain HTML + note)`. Categories: `select`, `table`,
`modal`, `toast`, `editor`, `date`, `slider`, `switch`, `pagination`, `divider`, `well`,
`checkbox`, `layout`. Each entry carries a `sampleHtml`/`sampleTs` (real usage snippet) and a
`source`/`provenance` tag. It also carries `designTokens`, `sampleComponents`, `moduleStructure`,
`componentDir`, `generatedAt`, `inputHash`.

### 8.2 `conventions.json` + `conventions.md` — HOW this team writes

The codebase's *unwritten* rules:

- `classVocabulary` — the classes the project reuses (so the agent reuses, not invents).
- An **override corpus** — every `::ng-deep` / style-penetration block, merged and scoped by
  capability family (copied verbatim; a dropped selector = a lost design effect).
- `componentAnatomy` — page-structure idiom (table skeleton, pagination, mock-row floor).
- `naming` — selector prefix and event-handler pattern.

### 8.3 `resolve` — exact idiom candidates

`sliceui resolve` maps every styled leaf (status badge, icon, caret) from design evidence (color,
icon, Figma name) to **exact** idiom candidates from the project corpus. The agent is instructed
to emit **only** strings in each leaf's `resolved[]` — a wrong icon for a given color becomes
structurally impossible. Identical rows are deduped into `groups[]` with a `count` + `ids[]`.

When resolution can't be confident, it emits `candidates` (a list) or `fallback: native-plain`
(render plain CSS and note it) — **never silently drops** a styled element, **never confidently
guesses** the wrong one.

---

## 9. The Verify Gate (Post-Generate, Blocking)

`sliceui verify <dir> <name>` runs **30 deterministic checks**, each returning
`{ name, status: pass|fail|skip, detail }`. A check that lacks its ground truth reports `skip`,
never `pass`.

| # | Check | What it catches |
| :--- | :--- | :--- |
| 1 | `scssCompiles` | Unbalanced SCSS braces / strings |
| 2 | `scssCoverage` | A required reusable `::ng-deep` block dropped |
| 3 | `textCoverage` | Fidelity-critical text (title/buttons/placeholders) dropped |
| 4 | `tableBindings` | Illegal/unknown table inputs; checkbox not evidenced by XML |
| 5 | `pilarBindings` | A `uii-*` binding not declared by the pilar catalog |
| 6 | `classVocabulary` | Invented classes instead of the project's |
| 7 | `anatomy` | Table present but skeleton loading state missing |
| 8 | `mockRowCount` | Paginated table without the required 15 mock rows |
| 9 | `noHashedSelectors` | Compiled `[_ngcontent-*]` leaked into source |
| 10 | `noBareNgDeep` | Agent-added global `::ng-deep` leak (not corpus-blessed) |
| 11 | `alignmentViaDeepCss` | SUI006 — pagination/footer alignment via deep CSS instead of the public input (warn) |
| 12 | `requiredMarker` | A required marker emitted-but-hidden, or reconstructed for an optional field |
| 13 | `containerPadding` | An authored padding the design's explicit XML values don't state |
| 14 | `inventedLayout` | SUI-STRUCT-004 — box-shadow/max-width/absolute/margin-auto with no design evidence (warn) |
| 15 | `deadCode` | An unused named import or injected-but-unused constructor dependency (warn) |
| 16 | `iconColor` | Status-icon color not a design color (invented mapping) |
| 17 | `phantomWrapper` | A structural wrapper the design doesn't show |
| 18 | `ngxSelectBinding` | A `<ngx-select>` without `[(ngModel)]` + `(select)` (dead filter) |
| 19 | `rowAuth` | Action-column rows missing the `auth` flags pilar needs |
| 20 | `filterRowButton` | A filter-row button in the XML (e.g. "Cari") dropped |
| 21 | `buttonOrder` | Paired buttons reversed (`flex-direction: row-reverse`) |
| 22 | `tableOptions` | Search/limit/pagination evidence not mapped to bindings (incl. `paginationAlign`) |
| 23 | `gridColumns` | A filter row's `col-*-N` spans sum to > 12 (wrapped child) |
| 24 | `noTranslation` | A `\| translate` pipe (SliceUI emits literal text, never i18n) |
| 25 | `inventedUtility` | Atomic utility class the project never uses |
| 26 | `styleFidelity` | Authored style value (color/size/weight) doesn't match the design |
| 27 | `libraryTable` | A plain `<table>` where the project uses a library table |
| 28 | `loadedClass` | A utility/grid class that doesn't resolve in loaded CSS |
| 29 | `pilarInjection` | `uii-*` present but the pilar catalog wasn't injected |
| 30 | `declaredInModule` | Component not registered in its owning NgModule |

**Why a gate and not a prompt?** Each check closes a *named defect class* from a
"history-agreement audit" — real field failures recorded in `docs/archive/` experience reports
(e.g. a heading rendered at ~2× the design because its `font-size` was omitted; a dead filter
select; a checkbox column invented without XML evidence). The gate makes the *wrong answer
unemittable, not merely catchable*.

---

## 10. Gate Trustworthiness (The Philosophy)

`docs/project-docs/technical-guidelines/verify-gate-trust.md` codifies how the gate stays honest:

- **R1** — No ground truth ⇒ never green (no "pass by absence").
- **R2** — False positives are defects, not noise: fix at the root, never via skip-paths or
  threshold-loosening.
- **R3** — Red must be actionable: each failing check names what's wrong and what would fix it.
- **R4** — Static checks get a render backstop: any verdict that depends on CSS cascade is
  cross-checked by headless render probes (text analysis can't see cascade).
- **R5** — Self-generated output isn't a violation: referee must not red-flag artifacts SliceUI
  itself generated.
- **R6** — Check changes land with paired tests.

The **render probes** (R4) are the answer to the hardest failure mode — *"verify green ≠ UI
correct"*:

- **`render-probe`** — a CSS-cascade check.
- **`render-mount`** — a real Angular mount in headless Chromium (Playwright).

Both run in CI, so the gate's verdicts are themselves checked against how the output actually
renders.

---

## 11. Org-Private Grammar (Pilar / UII)

SliceUI is a single general-purpose package, but an organization (UII Gateway) ships **private,
project-specific library grammars** as an optional add-on:

- `pilar-catalog.mjs` — a generated inventory of ~47 pilar components (`uii-table`,
  `uii-pagination`, `uii-dialog`, …) with exact `@Input`/`@Output` typing and template shapes.
- `pilar-showcase.mjs` — complete working examples.
- `uii-profile.mjs` — the org's registry entries + the action→authKey→icon truth table.
- `uii-slice-policy.mjs` — the curated slice whitelist (which pilar inputs a *mock slice* may bind).

**The gating (ADR-4):** these files live in the repo but are **excluded from the published
package** (`package.json` `files` allowlist + `scripts/guard-publish.mjs`, which refuses publishes
to any registry other than `npm.uii.ac.id`). Public installs degrade gracefully to
project-detected conventions only; internal installs run the identical tool against the org's
libraries. This keeps private source out of the public package while enabling full
library-constrained codegen internally.

Two file families must never be hand-edited: the generated pilar catalogs
(`technical-guidelines/generated-catalog.md`).

---

## 12. Architecture

Plain ESM (`"type": "module"`), no build step to run from source.

```
src/cli.mjs ── commands (src/commands/) ── lib (src/lib/) ── framework (src/framework/)
```

| Layer | Location | Concern |
| :--- | :--- | :--- |
| CLI verbs | `src/commands/` | 13 verbs: init, detect, transcribe, resolve, spec, verify, referee, doctor, fidelity, install, uninstall, update, transcribe-* |
| Shared engine | `src/lib/` | transcript schema/validation, FIGML parsing, fidelity scoring, referee, resolve, render transcript/probe, library registry/scan, OCR, style tokens, TS AST, prompt-rules |
| Angular deep layer | `src/framework/angular/` | conventions, detect, rules, verify, render-probe, render-mount, uii-profile, uii-slice-policy, pilar-* |
| Vue rules | `src/framework/vue-sfc/` | Vue SFC conventions + rules |
| macOS OCR | `src/ocr/` | static image decode + Swift Vision |
| Scripts | `scripts/` | pilar catalog extractors + publish guard |
| Skill manifest | `skill/SKILL.md` | the agent-facing workflow contract |

**Tech stack:** JavaScript ESM (Node ≥ 20) · `fast-xml-parser` (FIGML) · `typescript` (AST,
typecheck) · `fast-glob` (discovery) · Playwright chromium (render probes, dev-only) ·
`node --test` (tests) · GitHub Actions (ubuntu, Node 20).

**Key architectural decisions (ADRs, from `foundation/architecture.md`):**

- **ADR-1** — Deterministic-first transcription: XML parse when available; vision only when no
  XML; static OCR only when no key.
- **ADR-2** — **No premature framework abstraction** (LOCKED, council). `src/framework/` is pure
  layout; no `index.mjs` descriptor, no shared `initCore()` until React proves the shared fields.
- **ADR-4** — Org grammar gated, not removed (see §11).
- **ADR-5** — Render probes close the "green ≠ correct" gap.

---

## 13. Current State (as of 2026-09-24)

- **v0.15.0 released** — verify gate catching real render defects; headless render probes in CI;
  `resolve` keyed by Figma name not color; public package stripped of org-private source.
- **In-flight (uncommitted):** the false-positive gate-fix pass, plus this session's work
  (§14). Test suite: **36 files, 362 tests, 359 pass / 3 skip** (skips are environment-gated:
  pilar mount + catalog roundtrip need `PILAR_CHECKOUT`).

---

## 14. Known Pain Points & Improvement Targets

> This section is the most useful input for brainstorming. These are the documented frictions and
> open seams, each with its source.

### 14.1 Gate friction is the #1 product risk
Field experience reports record **~15–20 minutes lost per slice to verify false-positives** — the
agent fights the gate on correct output instead of the gate catching real defects. The in-flight
pass targets exactly this. **Source:** `docs/archive/SLICEUI-EXPERIENCE-REPORT-2.md`,
`docs/phases/REMEDIATION-PLAN-2026-09-11.md` (F1–F14).

### 14.2 Non-Angular deep adaptation doesn't exist yet
React / Vue / Svelte / Next get correct detection + neutral transcription + syntax rules, but
**no convention mining and no verify gate**. `verify` literally does not read `.tsx`/`.vue`
(exits 2 — only `*.component.{scss,html,ts}`). The roadmap sequence is React → Vue → Svelte →
Next, gated on "React proves the shared fields" (ADR-2). **Source:** README framework matrix,
`foundation/status.md`.

### 14.3 `resolve` ambiguity still forces agent judgment
When several labels co-occur with an icon, `resolve` returns `candidates` (a list) and the agent
must pick using transcript text. And `resolve`'s `resolved[]` constraint is **not yet formally
versioned** as a gate surface — an open question in `verify-gate-trust.md`. **Source:** SKILL.md
Step 3b, verify-gate-trust §7.

### 14.4 Context-economy ceilings
`project-context.json` can exceed the agent's Read cap (it hit **479 KB** once). The skill works
around it with generated slice files (`.sliceui/context/INDEX.md` + sectioned `.md`s), but the
underlying "one big JSON" contract is a known stress point. **Source:** SKILL.md Step 1 note.

### 14.5 macOS test coverage gap
CI is ubuntu-only. The macOS static tier (`sips` + `swiftc` OCR) is manually tested, not in CI —
a documented, unclosed gap. **Source:** README "Requirements", `foundation/status.md`.

### 14.6 Release traceability
No git tags — releases are traceable only via commit messages (`chore(vX.Y.Z): bump version`).
Listed as an open question in workflow.md. **Source:** `foundation/changelog.md`, status.md.

### 14.7 Render-probe follow-up
The v0.13.1 framework reorg left **one open issue**: a render-probe follow-up, tracked in the
session memory ("1 issue tersisa: render-probe"). **Source:** session memory, status.md.

### 14.8 The prompt-rule "reproduce meaning, not visibility" trap
An earlier output rule told the agent to reproduce a hidden node's *meaning*, and the agent took
it literally — emitting `<span class="required-mark hidden">*</span>` on an optional field. This
class of "emit-then-hide" is a recurring agent failure mode the gate now has to catch after the
fact. **Source:** this session's report §4.5, `src/lib/prompt-rules/output-rules.mjs`.

### 14.9 Capability registry is single-case
The "public component API before deep CSS" principle (§7 report, SUI006) is enforced for
pagination via a hand-written check (`alignmentViaDeepCss`). There is no *generalized* capability
registry the generator consults before writing CSS — the report's §6.2 asks for one, but
generalizing from a single case risks the exact circular-gate flaw the policy module was written
to avoid. **Source:** `src/framework/angular/uii-slice-policy.mjs` header, this session.

---

## 15. Reading Map (Where to Go Next)

| Want to know… | Read |
| :--- | :--- |
| End-user install + command reference | `README.md` |
| The agent's workflow contract + invariants | `skill/SKILL.md` |
| Product vision, personas, requirements | `docs/project-docs/foundation/prd.md` |
| Repo layout, module graph, ADRs | `docs/project-docs/foundation/architecture.md` |
| Current state, roadmap, risks | `docs/project-docs/foundation/status.md` |
| Release history | `docs/project-docs/foundation/changelog.md` |
| Artifact schemas (`.sliceui/`) | `docs/project-docs/development/api-contract.md` |
| How the gate stays honest | `docs/project-docs/technical-guidelines/verify-gate-trust.md` |
| Private-source exclusion rules | `docs/project-docs/technical-guidelines/publish-guard.md` |
| Generated-file rulebook | `docs/project-docs/technical-guidelines/generated-catalog.md` |
| Field evidence of gate friction | `docs/archive/SLICEUI-EXPERIENCE-REPORT-2.md` |

---

## 16. How to Use This for Brainstorming

When another agent proposes a change, the useful first question is always: **"which failure mode
does this close, and does it weaken any gate invariant (R1–R6)?"** A good SliceUI change:

1. Names a real defect class (from a field report, not a hypothetical).
2. Derives its truth from an artifact (transcript / catalog / conventions), never a hardcoded
   vocabulary.
3. Ships with a paired test (`R6`).
4. Does not loosen a check to make a field case pass (`anti-pattern #1`).

The known pain points in §14 are the current best candidates for improvement work.
