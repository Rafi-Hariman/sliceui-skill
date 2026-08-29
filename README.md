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
| `sliceui uninstall` | Remove this project's `.sliceui/` setup |
| `sliceui --help` | Usage |

## What this sends where

- **XML input:** 100% local — parsed deterministically, no network, no key.
- **Screenshot (tier 1 Gemini):** the image is sent to Google's Gemini API using **your** key, transcribed into a layout transcript. Requires `GEMINI_API_KEY` (or `VITE_GEMINI_API_KEY`).
- **Screenshot (tier 2 static):** everything stays local — image decode (`sips`), OCR (macOS Swift Vision), layout extraction. Requires macOS.
- **No telemetry.** SliceUI never phones home. Your key is never committed or logged.
- **Privacy:** prefer XML (local) or `--static` when the material is sensitive.

## How it adapts (project context)

`detect` builds a `capabilities` map by scanning your project's actual library usage:

```json
"capabilities": {
  "select": { "library": "ngx-select-ex", "sampleHtml": "<ngx-select ...>", "source": "local" },
  "table":  { "library": "ngx-datatable", "sampleHtml": "...", "source": "local" },
  "modal":  { "library": "ngx-bootstrap", "sampleHtml": "...", "source": "local" }
}
```

The agent maps each transcript element to the matching capability. If a category has no library, it falls back to plain HTML (`<select>`/`<table>`) with a note — never inventing a library the project doesn't have.

## Requirements

- Node ≥ 20 (Node 18 is EOL).
- macOS for the screenshot static tier (`sips` + `swiftc`). XML input works everywhere.

## Status

v0.3.0 — exact FIGML fidelity (frame/divider fills + hidden-layer dropping, transcript schema v3) + accurate library detection (import-first, comment-aware, `@danielmoncada/angular-datetime-picker`, local `<ngx-select>`).
v0.2.0 — XML-first input + library-aware project context.
