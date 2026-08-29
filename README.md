# SliceUI — Agent Skill + CLI

Convert a UI design into **idiomatic component code that matches your project** — its framework, version, and the actual UI libraries it uses (`ngx-select`, `ngx-datatable`, `ngx-bootstrap`, `uii-*`, `pilar`, …).

Built for agentic coding CLIs (Claude Code, Cursor, GLM Code, …) and **models that cannot see images**. SliceUI converts the design into a structured text transcript first, so any text-only model can generate accurate UI code.

## Why

Two inputs, one pipeline:

- **XML (preferred)** — export your Figma design with the FIGML plugin → `sliceui transcribe design.xml` parses it **deterministically**: exact text, exact colors, exact geometry, and component names. No API key, no vision, instant, ~90%+ accuracy.
- **Screenshot (fallback)** — for non-Figma sources. Gemini vision (your key) → macOS static+OCR fallback.

SliceUI also **learns your project's libraries**: `detect` scans `node_modules` usage to build a `capabilities` map (select → `ngx-select-ex` with a real usage snippet, table → `ngx-datatable`, etc.), so generated code reuses the components the team already uses — hover/focus/UX included — instead of raw `<select>`/`<table>`.

## Install

```bash
npm i -g sliceui-skill
sliceui install            # writes the skill into ~/.claude/skills/sliceui/
```

Then in **any** project, just ask your agent:

> slice this into my app: .sliceui/xml/design.xml

The skill activates, the CLI does the heavy lifting, the agent writes the files.

## Commands

| Command | What it does |
|---|---|
| `sliceui install [--dir DIR]` | Install the agent skill (default `~/.claude/skills/sliceui`). Use `--dir` for other agent CLIs' skill dirs. |
| `sliceui init [--key-from F]` | Set up this project: `.sliceui/{images,xml,transcript}/`, config, `.env.local`, gitignore, detect |
| `sliceui detect` | Detect framework + library usage → `.sliceui/project-context.json` (with `capabilities`) |
| `sliceui transcribe <input>` | `.xml`/`.figml` → exact FIGML parse; image → Gemini → static fallback. Writes `.sliceui/transcript/<name>.transcript.*` |
| `sliceui doctor` | Diagnose install (Node, platform, sips/swiftc, key, skill, live Gemini) |
| `sliceui fidelity <xml>` | Score visual-attribute preservation (FIGML → transcript) as a single % + per-attribute breakdown |
| `sliceui uninstall` | Remove this project's `.sliceui/` setup |
| `sliceui --help` | Usage |

## What this sends where

- **XML input:** 100% local — parsed deterministically, no network, no key.
- **Screenshot (tier 1 Gemini):** the image is sent to Google's Gemini API using **your** key, transcribed into a layout transcript. Requires `GEMINI_API_KEY` (or `VITE_GEMINI_API_KEY`).
- **Screenshot (tier 2 static):** everything stays local — image decode (`sips`), OCR (macOS Swift Vision), layout extraction. Requires macOS.
- **No telemetry.** SliceUI never phones home. Your key is never committed or logged.
- **Privacy:** prefer XML (local) or `--static` when the material is sensitive.

## How it adapts (project context)

`detect` builds a `capabilities` map from two signals:

1. **actual usage** in source (import-first, then template tags), and
2. **`package.json` deps** — so a freshly-scaffolded project resolves its libraries *before* any component imports them.

Resolution precedence per category: **local usage (`source:"local"`) → installed package (`source:"installed"`) → `null`** (plain HTML + note). When several libraries are installed for one category, registry order wins (org design-systems like `pilar`/`@uiigateway/core` are prioritized).

```json
"capabilities": {
  "select": { "library": "ngx-select-ex", "sampleHtml": "<ngx-select ...>", "source": "installed" },
  "table":  { "library": "pilar (uii-table)", "sampleHtml": "...", "source": "installed" },
  "modal":  { "library": "ngx-bootstrap", "sampleHtml": "...", "source": "local" }
}
```

Covered categories: `select`, `table`, `modal`, `toast`, `editor`, `date`, `slider`, `switch`, `pagination`, `divider`, `well`, `checkbox`, `layout`. The agent maps each transcript element to the matching capability — never inventing a library the project doesn't have.

`project-context.json` (v3) also carries, beyond capabilities:

- **`provenance`** — which signal produced each claim (`prefix`/`styleExt`/`componentDir`/`uiLibrary`), tagged `sourceCode | configFile | registryDefault`. Source code is ground truth; config is only a fallback. This is why `prefix` derives from actual `selector:` usage (with `prefixAlternates` showing the full distribution), not blindly from `angular.json`.
- **`designTokens`** — the project's own SCSS variables, CSS custom props, and mixins, mined from its stylesheets (literal values only), so generated styles reference real tokens instead of hardcoded hex.
- **`sampleComponents`** — inlined verbatim (`sampleTs` imports + `sampleHtml` template), no "read the file" round-trip.
- **`appModulePath` + `moduleStructure`** — where to register a new Angular component, no repo search.
- **`generatedAt` + `inputHash`** — detect stale context.

## Requirements

- Node ≥ 20 (Node 18 is EOL).
- macOS for the screenshot static tier (`sips` + `swiftc`). XML input works everywhere.

## Status

v0.5.2 — `sliceui fidelity <xml>`: deterministic visual-attribute coverage score (parser → transcript), closing the "70% vs 95%" gap from a gut feeling to a number you can CI-enforce. Also carries `axis` on INSTANCE nodes.
v0.5.1 — fidelity fix: transcript now carries `cornerRadius`/`padding`/`itemSpacing`(gap)/`lineHeight` (previously dropped), so generated spacing/radius matches the design instead of being guessed from geometry.
v0.5.0 — project-context v3: source>config prefix/provenance, `uii-*`/`@uiigateway`/bootstrap catalog, package.json-driven capabilities, design-token mining, inlined samples, non-silent nulls, module structure + staleness.
v0.4.0 — kill generation-time search: capabilities are authoritative (local samples for re-exported components), mock data + literal text by default, no i18n/test wiring during a slice.
v0.3.0 — exact FIGML fidelity (frame/divider fills + hidden-layer dropping, transcript schema v3) + accurate library detection (import-first, comment-aware, `@danielmoncada/angular-datetime-picker`, local `<ngx-select>`).
v0.2.0 — XML-first input + library-aware project context.
