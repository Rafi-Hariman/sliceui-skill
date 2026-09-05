# SliceUI: Agent Skill + CLI

Convert a UI design into component code that matches your project's framework, version, and UI libraries.

Built for agentic coding CLIs (Claude Code, Cursor, GLM Code, …) and models that cannot see images. SliceUI first turns the design into a structured text transcript, so any text-only model can generate accurate UI code.

## Why

Two inputs, one pipeline:

- **XML (preferred):** export a Figma design with the FIGML plugin, then `sliceui transcribe design.xml` parses it deterministically: exact text, colors, geometry, and component names. No API key, no vision, instant, roughly 90%+ attribute fidelity.
- **Screenshot (fallback):** for non-Figma sources. Gemini vision (your key), with a macOS static and OCR fallback.

Beyond transcription, SliceUI learns the project's **framework** and **conventions**. `init` scans the codebase to build a `capabilities` map (which library serves each UI element category, with a real usage snippet) plus a `conventions` profile (reusable classes, deep-selector override corpus, page anatomy, naming). Generated code reuses the components and styles the team already uses, including hover and focus states, instead of raw elements and invented classes.

## Framework support

SliceUI is **Angular-first**. Support is honest per layer — please read the matrix, not a single "supported ✅" column:

| Framework | Detect | Codegen rules | Deep adaptation (library wiring · convention mining · **verify**) |
|---|---|---|---|
| **Angular** (v13-first, incl. `@uiigateway`/`pilar` profile) | ✅ version · prefix · module | ✅ version-aware (`*ngIf` vs `@if`, DI, standalone) | ✅ **full** — the only framework whose generated code is gated by `sliceui verify` |
| React (TSX) | ✅ | ✅ `className`, Tailwind, FC | ⚠️ **experimental** — transcribe/resolve work, but conventions mining is Angular-shaped and `sliceui verify` does **not** read `.tsx` (exit 2: "only `*.component.{scss,html,ts}`") |
| Next.js | ✅ | ✅ App Router, server/client | ⚠️ **experimental** — same caveat as React |
| Vue 3 (SFC) | ✅ | ✅ `<script setup lang="ts">`, scoped | ⚠️ **experimental** — same caveat |
| Svelte | ✅ | ✅ Svelte 5 runes | ⚠️ **experimental** — same caveat |
| Tailwind / HTML | ✅ (fallback) | ✅ utility classes / semantic HTML | ⚠️ **experimental** — no conventions corpus, no verify gate |

The **transcription** layer is framework-agnostic: a transcript carries only design facts (text, color, geometry, icons), so it is equally useful in every framework. The **codegen-rules** layer ships a rule set per framework and is genuinely multi-framework.

The **deep-adaptation** layer — library registry + capabilities, `::ng-deep` convention mining, golden references, and `sliceui verify` — is **implemented for Angular only today**. Non-Angular projects get correct detection, neutral transcription, and idiomatic *syntax* rules, but SliceUI does **not** verify the generated component and does not mine the project's component-library idiom. Treat non-Angular output as *experimental*: native markup with an explicit note, never a guessed library.

## Install

```bash
npm i -g sliceui-skill
sliceui install            # writes the skill into ~/.claude/skills/sliceui/
```

Then in any project, ask your agent:

> slice this into my app: .sliceui/xml/design.xml

The skill activates, the CLI does the heavy lifting, and the agent writes the files.

## The pipeline

```
sliceui init        → project-context.json (WHAT) + conventions.json/.md (HOW this team writes) + referee corruption map
sliceui transcribe  → transcript (exact layout + colors + text + icons + checkbox) + fidelity score
sliceui resolve     → every styled leaf → resolved[] (exact idiom candidates)
sliceui referee     → pre-generate gate: ground-truth validation (design + codebase), must be green
sliceui verify      → post-generate blocking gate: fidelity + conventions + structure (must exit 0)
```

## Commands

| Command | What it does |
|---|---|
| `sliceui install [--dir DIR]` | Install the agent skill (default `~/.claude/skills/sliceui`). Use `--dir` for other agent CLIs' skill dirs. |
| `sliceui init [--key-from F]` | Set up this project: `.sliceui/{images,xml,transcript}/`, config, `.env.local`, gitignore, detect + conventions |
| `sliceui detect` | Detect framework, library usage, and conventions → `.sliceui/project-context.json` + `conventions.json` |
| `sliceui transcribe <input>` | `.xml`/`.figml` → exact FIGML parse; image → Gemini → static fallback. Writes `.sliceui/transcript/<name>.transcript.*` |
| `sliceui resolve <xml\|json>` | Resolve every styled leaf to exact idiom candidates → `.sliceui/resolve/<name>.resolved.json` |
| `sliceui verify <dir> [name]` | Gate a generated component: deterministic checks (fidelity + conventions + structure). Exit 0/1 |
| `sliceui referee [root]` | Validate ground-truth artifacts against the design and codebase |
| `sliceui doctor` | Diagnose install (Node, platform, sips/swiftc, key, skill, live Gemini) |
| `sliceui fidelity <xml>` | Score visual-attribute preservation (FIGML → transcript) as a single % plus per-attribute breakdown |
| `sliceui uninstall` | Remove this project's `.sliceui/` setup |
| `sliceui update` | Self-update the CLI and refresh the installed skill |
| `sliceui --help` | Usage |

## What this sends where

- **XML input:** 100% local, parsed deterministically, no network, no key.
- **Screenshot (tier 1 Gemini):** the image is sent to Google's Gemini API using your key, then transcribed into a layout transcript. Requires `GEMINI_API_KEY` (or `VITE_GEMINI_API_KEY`).
- **Screenshot (tier 2 static):** everything stays local. Image decode (`sips`), OCR (macOS Swift Vision), layout extraction. Requires macOS.
- **No telemetry.** SliceUI never phones home. Your key is never committed or logged.
- **Privacy:** prefer XML (local) or `--static` when the material is sensitive.

## How it adapts (project context + conventions)

`init` runs `detect`, which builds two artifacts.

### 1. `project-context.json`: WHAT the project is

A `capabilities` map from two signals:

1. actual usage in source (import-first, then template tags), and
2. `package.json` deps, so a freshly scaffolded project resolves its libraries before any component imports them.

Resolution precedence per category: local usage (`source:"local"`) → installed package (`source:"installed"`) → `null` (plain HTML + note). Local usage wins when the project has its own. The richest sample is preferred, and list views are preferred over form or edit views.

```json
"capabilities": {
  "select": { "library": "<detected select library>", "sampleHtml": "…", "source": "local" },
  "table":  { "library": "<detected table library>", "sampleHtml": "…", "source": "installed" },
  "modal":  { "library": "<detected modal library>", "sampleHtml": "…", "source": "local" }
}
```

Covered categories: `select`, `table`, `modal`, `toast`, `editor`, `date`, `slider`, `switch`, `pagination`, `divider`, `well`, `checkbox`, `layout`. The agent maps each transcript element to the matching capability and never invents a library the project does not have.

`project-context.json` also carries:
- `provenance`, which signal produced each claim, tagged `sourceCode | configFile | registryDefault`. Source code is the ground truth.
- `designTokens`, the project's own variables, CSS custom props, and mixins (literal values only).
- `sampleComponents`, the feature components (app shell excluded) that render the project's tables and selects, chosen by relevance. The agent reads these to learn idiom.
- `moduleStructure`, `componentDir`, `generatedAt`, and `inputHash`.

### 2. `conventions.json` + `conventions.md`: HOW this team writes

`init` also captures the codebase's unwritten rules:

- `classVocabulary`, the classes the project reuses, so the agent reuses them instead of inventing.
- An **override corpus**, every deep-selector / style-penetration block across the project, merged and scoped by capability family. The agent copies these verbatim; a dropped selector means a lost design effect.
- `componentAnatomy`, the page structure idiom (table skeleton, pagination, mock-row floor).
- `naming`, the selector prefix and event-handler pattern.

### Single source of truth

Structure comes from the design (XML/transcript) only. Conventions style elements that already exist in the design and never add structural wrappers. If the design has no container wrapper, the agent does not emit one. `sliceui verify` has a check that flags any wrapper the design does not show.

### 3. `resolve`

`sliceui resolve` maps every styled leaf (status badge, icon, caret) from the design evidence (colors, icons) to exact idiom candidates from the project corpus. The agent emits only the strings in each leaf's `resolved[]`. A wrong icon for a given color becomes structurally impossible.

### 4. `verify`

`sliceui verify <dir> [name]` runs deterministic checks covering stylesheet coverage, text coverage, table bindings (checkbox evidenced by the raw design), class vocabulary, anatomy, mock-row count, compiled-scope leaks, icon colors, structural wrappers, **ngx-select bindings** (`[(ngModel)]` and `(select)`; a dead filter is rejected), **per-row auth** (an action column must attach the `AuthorizationModel` flags `uii-table` needs to render its icons, mapped from the XML `<Aksi>` booleans), **filter-row buttons** (a `Cari` button in the XML is not dropped), **button order** (`flex-direction: row-reverse` flipping the XML's left-to-right order is rejected), and **table options** (a search bar / "Tampilkan N data" / pagination footer in the XML must map to `[searchOptions]`/`[limitOptions]`/`[paginationOptions]`). A run with no ground truth is never green. **This is a blocking post-generate gate**: the agent must reach exit 0 before declaring a slice done.

### 5. `referee`

`sliceui referee` validates every ground-truth artifact against the two sources of truth: the design (fidelity) and the codebase (whether each claim traces to a real occurrence). It flags stale or incorrect claims before they reach the agent. **The codebase head also runs automatically at `sliceui init`** (surfacing the corruption map at setup time), and the full run is a mandatory pre-generate step in the skill: if anything is red, the artifacts are refreshed before codegen.

## Requirements

- Node ≥ 20 (Node 18 is EOL).
- macOS for the screenshot static tier (`sips` + `swiftc`). XML input works everywhere.
- **CI runs the test suite on ubuntu only.** The suite is platform-agnostic (no macOS API in tests), so macOS coverage is a known gap — the static tier is exercised manually, not in CI.

## Status

v0.11.1: XML owns appearance; samples are writing-only. A slice exposed an authority inversion — the agent copied legacy `sampleComponents` verbatim (`content-body`, `formControlName`, `| translate`), overriding the XML. The skill's "DIVISION OF AUTHORITY" is rewritten into a hard precedence rule (the XML owns all visible appearance; samples answer only how to wire the library; the `::ng-deep` Reusable corpus is the one styling thing copied from the project), and two deterministic checks now enforce it: `noTranslation` fails on any `| translate` pipe, and `ngxSelectBinding` rejects `formControlName` (reactive-form legacy) alongside requiring `[(ngModel)]` + `(select)`. Also fixes bare `.form-control`/`ngx-select__toggle` being classified non-reusable (selects lost their border/rounding) and adds a `gridColumns` check that fails a filter row whose `col-*-N` spans exceed 12.
v0.11.0: every command actually fires. An audit found three commands built but never wired into the `/sliceui` flow: `referee` (0 mentions in the skill), `fidelity` (dead as a command), and `verify` (a "report-only" suggestion the agent could skip). All three are now wired at the correct point. `sliceui transcribe` chains the fidelity score into its output (`Fidelity: NN%`, warning below 90%) so attribute loss is visible on every slice; `sliceui init` runs the referee codebase-head and surfaces the corruption map in its warnings; the skill gains a mandatory Step 3.5 pre-generate gate (`sliceui referee` must exit 0 before codegen) and the verify gate is upgraded from "report-only" to a **blocking loop** (fix the failing check, re-run, not done until exit 0). Also: corpus hygiene (`::ng-deep` blocks split into reusable vs component-specific sections so a spreadsheet-only `border: none` block can no longer leak into a page filter; majority-vote dedup picks the canonical pagination variant over a buggy outlier; the nested `:host ::ng-deep { … }` group form is now parsed), `scssCoverage` requires the bare `.gateway-table` shell, and a `tableOptions` check maps XML evidence to `[searchOptions]`/`[limitOptions]`/`[paginationOptions]`.
v0.10.0: close the e2e defect gap. `sliceui verify` grows from 9 to 13 checks: `ngxSelectBinding` (every `<ngx-select>` must carry `[(ngModel)]` and `(select)`), `rowAuth` (an action column must attach per-row `AuthorizationModel` flags so `uii-table` renders the edit/detail/delete icons, mapped from the XML `<Aksi>` component-property booleans), `filterRowButton` (a `Cari`/filter button in the XML is not dropped), and `buttonOrder` (`flex-direction: row-reverse` on paired action buttons is rejected). SKILL.md now teaches the agent: grid "N fields + 1 button" rows keep the button, every `ngx-select` is bound, action columns carry per-row `auth` (with an action→authKey→icon table), bulk buttons follow the XML's left→right order, and `sliceui verify` is a post-generate gate. The `uii-table` registry sample carries `[actionColumn]` + an `AuthorizationModel` hint. Calibrated against the same human reference: the reference passes and the known-broken output now fails on all five named defects.
v0.9.0: end-to-end quality pipeline. `sliceui referee` (two-headed ground-truth validator), `sliceui resolve` (resolve-then-assemble, the agent emits only exact idiom candidates), and `sliceui verify` hardened to 9 checks (compiled-scope leaks, invented icon colors, and structural wrappers the design does not have are all rejected). Ground-truth fixes: `sampleComponents` excludes the app shell and picks feature-relevant components (scans monorepo `projects/`), conventions no longer teach a structural wrapper as an instruction (structure comes from the design only), and the mock-row floor is a sane minimum (the slice total is handled by verify). Calibrated against a human-written reference: the reference passes, and a known-corrupt output fails on exactly the corruption signals.
v0.8.0: adapt conventions into init + verify gate. `init` produces 3 artifacts (project-context + conventions.json + conventions.md); `sliceui verify` with deterministic checks; gate-honesty fixes (null-exemplar hard-fails, no-ground-truth never green); parser fixes (vector icon fill color, checkbox detection).
v0.7.1: last-mile styling. `capabilities.*.sampleScss` carries the exemplar stylesheet; stylesheet-coverage gate; SKILL.md button alignment + table mock rules.
v0.7.0: dropped the no-search invariant. project-context is a map, not a mirror. The agent reads pointed-to files to learn idiom; the transcript stays authoritative for design.
v0.6.0: vendored showcase catalog. Real-usage snippets from the library's own showcase app.
v0.5.2: `sliceui fidelity <xml>`. Deterministic visual-attribute coverage score.
v0.5.1: fidelity fix. transcript carries `cornerRadius`/`padding`/`itemSpacing`/`lineHeight`.
v0.5.0: project-context v3. source/config prefix/provenance, library catalog, design-token mining, non-silent nulls.
v0.4.0: kill generation-time search. Capabilities authoritative, mock + literal by default.
v0.3.0: exact FIGML fidelity + accurate library detection.
v0.2.0: XML-first input + library-aware project context.
