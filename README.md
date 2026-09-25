# SliceUI: Agent Skill + CLI

Convert a UI design into component code that matches your project's framework, version, and UI libraries.

Built for agentic coding CLIs (Claude Code, Cursor, GLM Code, ...) and models that cannot see images. SliceUI first turns the design into a structured text transcript, so a text-only model can generate accurate UI code.

## Why

Two inputs, one pipeline:

- XML (preferred): export a Figma design with the FIGML plugin, then `sliceui transcribe design.xml` parses it deterministically: exact text, colors, geometry, and component names. No API key, no vision, instant, roughly 90%+ attribute fidelity.
- Screenshot (fallback): for non-Figma sources. Gemini vision (your key), with a macOS static and OCR fallback.

Beyond transcription, SliceUI learns the project's framework and conventions. `init` scans the codebase to build a `capabilities` map (which library serves each UI element category, with a real usage snippet) plus a `conventions` profile (reusable classes, deep-selector override corpus, page anatomy, naming). Generated code reuses the components and styles the team already uses, including hover and focus states, instead of raw elements and invented classes.

## Framework support

SliceUI is Angular-first. Support is honest per layer. Read the matrix rather than a single supported column:

| Framework | Detect | Codegen rules | Deep adaptation (library wiring, convention mining, verify) |
|---|---|---|---|
| **Angular** (v13-first) | ✅ version, prefix, module | ✅ version-aware (`*ngIf` vs `@if`, DI, standalone) | ✅ full: the only framework whose generated code is gated by `sliceui verify` |
| React (TSX) | ✅ | ✅ `className`, Tailwind, FC | ⚠️ experimental: transcribe/resolve work, but conventions mining is Angular-shaped and `sliceui verify` does not read `.tsx` (exit 2: only `*.component.{scss,html,ts}`) |
| Next.js | ✅ | ✅ App Router, server/client | ⚠️ experimental: same caveat as React |
| Vue 3 (SFC) | ✅ | ✅ `<script setup lang="ts">`, scoped | ⚠️ experimental: same caveat |
| Svelte | ✅ | ✅ Svelte 5 runes | ⚠️ experimental: same caveat |
| Tailwind / HTML | ✅ (fallback) | ✅ utility classes / semantic HTML | ⚠️ experimental: no conventions corpus, no verify gate |

The transcription layer is framework-agnostic: a transcript carries only design facts (text, color, geometry, icons), so it is equally useful in every framework. The codegen-rules layer ships a rule set per framework and is genuinely multi-framework.

The deep-adaptation layer (library registry and capabilities, `::ng-deep` convention mining, golden references, `sliceui verify`) is implemented for Angular only today. Non-Angular projects get correct detection, neutral transcription, and idiomatic syntax rules, but SliceUI does not verify the generated component and does not mine the project's component-library idiom. Treat non-Angular output as experimental: native markup with an explicit note, never a guessed library.

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

- XML input: 100% local, parsed deterministically, no network, no key.
- Screenshot, tier 1 Gemini: the image is sent to Google's Gemini API with your key, then transcribed into a layout transcript. Requires `GEMINI_API_KEY` (or `VITE_GEMINI_API_KEY`).
- Screenshot, tier 2 static: everything stays local. Image decode (`sips`), OCR (macOS Swift Vision), layout extraction. Requires macOS.
- No telemetry: SliceUI never phones home. Your key is never committed or logged.
- Privacy: prefer XML (local) or `--static` when the material is sensitive.

## How it adapts (project context + conventions)

`init` runs `detect`, which builds two artifacts.

### 1. `project-context.json`: WHAT the project is

A `capabilities` map from two signals:

1. actual usage in source (import-first, then template tags), and
2. `package.json` deps, so a freshly scaffolded project resolves its libraries before any component imports them.

Resolution precedence per category: local usage (`source:"local"`), then installed package (`source:"installed"`), then `null` (plain HTML plus a note). Local usage wins when the project has its own. The richest sample is preferred, and list views are preferred over form or edit views.

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
- An override corpus: every deep-selector and style-penetration block across the project, merged and scoped by capability family. The agent copies these verbatim; a dropped selector means a lost design effect.
- `componentAnatomy`, the page structure idiom (table skeleton, pagination, mock-row floor).
- `naming`, the selector prefix and event-handler pattern.

### Single source of truth

Structure comes from the design (XML/transcript) only. Conventions style elements that already exist in the design and never add structural wrappers. If the design has no container wrapper, the agent does not emit one. `sliceui verify` has a check that flags any wrapper the design does not show.

### 3. `resolve`

`sliceui resolve` maps every styled leaf (status badge, icon, caret) from the design evidence (colors, icons) to exact idiom candidates from the project corpus. The agent emits only the strings in each leaf's `resolved[]`. A wrong icon for a given color becomes structurally impossible.

### 4. `verify`

`sliceui verify <dir> [name]` runs deterministic checks covering stylesheet coverage, text coverage, table bindings (checkbox evidenced by the raw design), class vocabulary, anatomy, mock-row count, compiled-scope leaks, icon colors, structural wrappers, ngx-select bindings (`[(ngModel)]` and `(select)`; a dead filter is rejected), filter-row buttons (a `Cari` button in the XML is not dropped), button order (`flex-direction: row-reverse`, which flips the XML's left-to-right order, is rejected), and table options (a search bar, "Tampilkan N data", or pagination footer in the XML must map to `[searchOptions]`, `[limitOptions]`, or `[paginationOptions]`). A run with no ground truth is never green. This is a blocking post-generate gate: the agent must reach exit 0 before declaring a slice done.

### 5. `referee`

`sliceui referee` validates every ground-truth artifact against the two sources of truth: the design (fidelity) and the codebase (whether each claim traces to a real occurrence). By default it runs in **snapshot mode** — it reads the stored codebase-evidence verdict written by `sliceui init` and performs bounded target/design checks, without scanning repository source. Use `sliceui referee --target <name> --deep` to re-scan the repository explicitly and refresh the verdict. If anything is red, the artifacts are refreshed before codegen. See `docs/project-docs/development/api-contract.md` §10.4b for the freshness boundary (snapshot mode does not detect uncommitted source edits).

### 6. Project-specific features

SliceUI is a single general-purpose package. An organization can ship private, project-specific library grammars (component catalogs, convention profiles, reference docs) as an optional add-on. When such a grammar is present in the install, `init`, `detect`, `verify`, and `doctor` make full use of it. When it is absent (the default public install), those same commands degrade gracefully and only adapt to the project's own detected conventions; they never emit or reference an org-private component vocabulary. This keeps the public package free of any private source while letting an org run the identical tool internally against its own libraries.

### 7. Handoff to a CLI-less agent (`/sliceui-handoff`)

Sometimes the slicing must be done by a web agent with no CLI (e.g. a Microsoft Copilot custom agent that only reads uploaded files). `sliceui install` ships a second skill, `/sliceui-handoff`, which writes `.sliceui/handoff.md` — one compact attachment carrying the project's framework rules, capability wiring, styling system, and the SliceUI invariants restated as direct rules. Unlike the CLI commands (whose mining is Angular-first and can be thin on other frameworks), the handoff skill has the agent itself read the real components and write the patterns it finds, so the handoff stays useful on a Vue/React/Svelte/Tailwind project. The file ends by stating plainly that no `sliceui verify` gate will run — a human must review the output.

## Requirements

- Node >= 20 (Node 18 is EOL).
- macOS for the screenshot static tier (`sips` + `swiftc`). XML input works everywhere.
- CI runs the test suite on ubuntu only. The suite is platform-agnostic (no macOS API in tests), so macOS coverage is a known gap. The static tier is exercised manually, not in CI.

## Status

v0.15.0: a verify gate that catches real render defects, plus a public package free of private source. Headless render probes (a CSS-cascade check and a real Angular mount) run in CI, so the gate's verdicts are checked against how the output actually renders. `resolve` maps icons and buttons by their Figma name instead of collapsing on color, so an eye stays `fa-eye` rather than degrading to `fa-search`. `verify` fails a heading whose `font-size` is missing from its authored style (the browser default is roughly 2x the design), an invented `btn-*` class, and a plain `<table>` where the project uses a library table. `referee` no longer red-flags a component SliceUI itself generated, so re-runs do not fight the tool. `doctor` treats a missing Gemini key as a warning rather than a blocker, because XML and static tiers work without it. The package ships no org-private library source; project-specific library grammars load only when they are present.
