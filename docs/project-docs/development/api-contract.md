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
- **Exit codes:** `0` success; `1` gate failure (verify/referee red, doctor problems); `2` usage/framework-not-supported (e.g. verify on `.tsx`). Inferred from codebase (README + verify exit 2 note).

## 8. Request/Response Format

Commands are argument-driven; results are either stdout text (human/agent-readable) or files under `.sliceui/`. No JSON stdout contract is guaranteed except where stated.

## 9. Endpoints (CLI Commands)

| Command | Input | Output | Exit |
| :--- | :--- | :--- | :--- |
| `sliceui init [--key-from F]` | — | `.sliceui/{images,xml,transcript}/`, `config.json`, `.env.local`, gitignore, `project-context.json`, `conventions.json` (+3 pilar files for UII projects) | 0/1 |
| `sliceui detect` | CWD project | `.sliceui/project-context.json` + `conventions.json` | 0/1 |
| `sliceui transcribe <input>` | `.xml`/`.figml` file or image | `.sliceui/transcript/<name>.transcript.{md,json}` + `.transcript.meta.json` (input-stamped) | 0/1 |
| `sliceui resolve <xml\|json>` | FIGML XML or transcript JSON | `.sliceui/resolve/<name>.resolved.json` | 0/1 |
| `sliceui referee [root]` | ground-truth artifacts | stdout verdict per claim (green/red per check) | 0/1 |
| `sliceui verify <dir> [name]` | generated `.ts/.html/.scss` | stdout per-check verdicts | 0 / 1 (gate) / 2 (usage/framework) |
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
- `provenance` — per-claim signal: `sourceCode | configFile | registryDefault` (source code is ground truth).
- `designTokens` — the project's variables/CSS-props/mixins (literal values only).
- `sampleComponents` — feature components (app shell excluded) chosen by relevance for idiom learning.
- `moduleStructure`, `componentDir`, `generatedAt`, `inputHash`.

### 10.4 `.sliceui/conventions.json`

Deterministic facts (the verify gate's ground truth): `classVocabulary`, deep-selector override corpus (scoped by capability family), `componentAnatomy`, `naming` (selector prefix + event-handler pattern), plus the loaded-class registry the verify gate reads (wired in 8a1628d).

### 10.5 `.sliceui/resolve/<name>.resolved.json`

Per styled leaf: `resolved[]` — the exact idiom candidates the agent may emit; keyed by design evidence (color, icon, Figma name). The agent emitting anything outside `resolved[]` is a verify failure mode.

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
