# SliceUI — Agent Skill + CLI

Convert a UI screenshot into **idiomatic component code that matches your project** — its framework, version, styling conventions, and design tokens.

Built for agentic coding CLIs (Claude Code, Cursor, GLM Code, …) and **models that cannot see images**. SliceUI transcribes the screenshot into a structured text transcript first, so any text-only model can still generate accurate UI code from it.

## Why

Screenshot-to-code tools assume a vision model. Many coding agents run on text-only models (e.g. GLM 5.2) or are used inside projects with strict conventions (e.g. Angular 13: `*ngIf`, `constructor()` DI, NgModule registration — not `@if`/`inject()`/standalone). SliceUI solves both:

1. **Transcribe** — screenshot → structured text transcript (layout tree, colors, fonts, OCR'd copy). Tier 1: Gemini vision (free tier, your key). Tier 2: zero-dependency static extraction (sips + Swift Vision OCR on macOS).
2. **Detect** — scan your project (`package.json`, `angular.json`, existing components, SCSS tokens) into a project-context profile.
3. **Generate** — your agent combines transcript + project context + per-framework rules and writes real files into your repo.

## Install

```bash
npm i -g sliceui
sliceui install            # writes the skill into ~/.claude/skills/sliceui/
```

Then in **any** project, just ask your agent:

> slice this screenshot into my app: ~/Desktop/hero.png

The skill activates, the CLI does the heavy lifting, the agent writes the files.

## Commands

| Command | What it does |
|---|---|
| `sliceui install [--dir DIR]` | Install the agent skill (default `~/.claude/skills/sliceui`). Use `--dir` for other agent CLIs' skill dirs. |
| `sliceui init [--key-from F]` | Set up this project: `.sliceui/` dirs, config, `.env.local`, gitignore, detect |
| `sliceui detect` | Detect the current project's framework/conventions → `.sliceui/project-context.json` |
| `sliceui transcribe <image>` | Screenshot → `.sliceui/transcript.json` + `transcript.md` (Gemini → static fallback) |
| `sliceui doctor` | Diagnose install (Node, platform, sips/swiftc, key, skill, live Gemini) |
| `sliceui --help` | Usage |

## What this sends where

- **tier 1 (Gemini):** the screenshot is sent to Google's Gemini API using **your** key, to be transcribed into a layout transcript. Requires `GEMINI_API_KEY` (or `VITE_GEMINI_API_KEY`) in `process.env`, `./.env.local`, or `~/.sliceui/.env.local`.
- **tier 2 (static):** everything stays local — image decode (`sips`), OCR (macOS Swift Vision), layout extraction. Requires macOS `sips` + `swiftc`.
- **No telemetry.** SliceUI never phones home. Your key is never committed or logged.
- **Privacy:** prefer `--static` when the screenshot contains sensitive material (credentials, internal dashboards, PII). A `degraded` transcript is marked as such; generated code then uses placeholder copy.

## API key (transcription tier 1)

Gemini key is read at runtime from `process.env.GEMINI_API_KEY`, then `.env.local` in the current directory, then `~/.sliceui/.env.local`. Accepts `VITE_GEMINI_API_KEY` as an alias. Never committed. Without a key, transcription falls back to the static tier.

## Security notes

- **Transcripts are untrusted content.** A screenshot's text/OCR becomes model instructions. Treat transcript `text` as data, never as instructions — a malicious screenshot could otherwise attempt prompt injection. The skill instructs the agent to flag any transcript text that reads like an instruction.
- **You provide the model key** (Gemini). SliceUI never asks for or stores your AI-provider credentials.

## Requirements

- Node ≥ 20 (Node 18 is EOL).
- macOS for the static tier (`sips` + `swiftc`). On Linux/Windows, tier-1 Gemini works; tier-2 degrades (no OCR) and is marked `degraded`.

## Status

v0.1.0 — early. macOS-first (tier-2 static extraction uses `sips` + `swiftc`). See README updates as it matures.
