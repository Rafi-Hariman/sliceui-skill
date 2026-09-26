# Foundation — Architecture

Last update: 2026-09-10
Status: Live

---

## 1. Description

How `sliceui-skill` is structured: repo layout, the pipeline module graph, the Angular-first framework strategy, and the decisions that shaped both.

## 2. Important

- Plain ESM (`"type": "module"`), no build step to run from source. Runtime deps: `fast-glob`, `fast-xml-parser`, `typescript`; dev: `esbuild`, `playwright`, `sass`.
- The Angular knowledge is deliberately **not** behind a framework-neutral abstraction — that abstraction was vetoed by council (ADR-2) until a second framework proves the fields.
- Two file families must never be hand-edited: the generated pilar catalogs (see `technical-guidelines/generated-catalog.md`).

## 3. Table of Contents

- [4. Scope](#4-scope)
- [5. Goals](#5-goals)
- [6. Non Goals](#6-non-goals)
- [7. Tech Stack Overview](#7-tech-stack-overview)
- [8. Architecture Pattern](#8-architecture-pattern)
- [9. System Flow](#9-system-flow)
- [10. Data Flow / Artifacts](#10-data-flow--artifacts)
- [11. Tools Integration](#11-tools-integration)
- [12. Global Parameters and Constraints](#12-global-parameters-and-constraints)
- [13. Architecture Decision Records](#13-architecture-decision-records)
- [Success Metrics](#success-metrics)
- [Related Documents](#related-docs)
- [Open Questions](#open-questions)

## 4. Scope

The CLI/skill engine in this repo. The target project being sliced (Angular 13 + pilar etc.) is consumer context, not part of this architecture.

## 5. Goals

- Each framework gets one "home" folder (`src/framework/<id>/`) so new frameworks land without disturbing existing code.
- Deterministic-first: every layer degrades tier-by-tier, never guesses.
- Private org knowledge stays out of the public package while internal builds use the identical tool.

## 6. Non Goals

- No framework-neutral `index.mjs` descriptor / `initCore()` extraction until React proves the shared fields (ADR-2, ADR-3).
- No server, no daemon, no telemetry.

## 7. Tech Stack Overview

| Concern | Choice |
| :--- | :--- |
| Language | JavaScript ESM (Node >= 20), no TS build for the CLI itself |
| XML parsing | `fast-xml-parser` (FIGML) |
| TypeScript AST | `typescript` package (extractors, typecheck) |
| File discovery | `fast-glob` |
| Headless render | Playwright chromium (dev dep) |
| Tests | `node --test` (built-in runner) |
| CI | GitHub Actions, ubuntu-latest, Node 20 |

## 8. Architecture Pattern

Pipeline-of-gates. Five stages, each an independent CLI command with a file-based artifact contract (§10):

```
init → transcribe → resolve → referee (pre-generate gate)
                              ↓
                        agent writes code
                              ↓
                    verify (post-generate blocking gate)
```

Layered framework strategy (README matrix is the product-level source of truth):

- **Detection** — all frameworks (`src/commands/detect.mjs` + `src/lib/detect-utils.mjs`)
- **Codegen rules** — per-framework syntax rule sets (`src/framework/*/rules.mjs`)
- **Deep adaptation** — Angular only: conventions mining, golden references, verify, referee

## 9. System Flow

```
src/cli.mjs ── commands (src/commands/) ── lib (src/lib/) ── framework (src/framework/)
```

- `src/commands/` — 13 CLI verbs (init, detect, transcribe, resolve, verify, referee, doctor, fidelity, install, uninstall, update, transcribe-gemini, transcribe-static)
- `src/lib/` — shared engine: transcript schema/validation, FIGML parsing, fidelity scoring, referee, render transcript/probe, resolve, library registry/scan, OCR, style tokens, TS AST, prompt-rules
- `src/framework/angular/` — Angular deep layer: conventions, detect, rules, verify, render-probe, render-mount, uii-profile, uii-slice-policy, pilar-* (catalog/showcase/typecheck/mount)
- `src/ocr/` — macOS static OCR tier
- `scripts/` — pilar catalog extractors + publish guard; `scripts/lib/ts-ast-shared.mjs` shared AST helpers
- `skill/SKILL.md` — the agent-facing skill manifest + workflow contract
- `test/` — 28 test files, `node --test`; fixtures incl. `test/fixtures/angular-mount` (own npm deps)

## 9b. Data Flow / Artifacts

All inter-stage contracts are files under the target project's `.sliceui/` (schemas in `development/api-contract.md`):

```
design.xml / image
  → .sliceui/artifacts/<name>/transcript.{md,json} + .meta.json          (transcribe; input-stamped)
  → .sliceui/artifacts/<name>/resolved.json                              (resolve; schemaVersion 2,
                                                                          typed: classification /
                                                                          authority / confidence /
                                                                          provenance)
  → .sliceui/artifacts/<name>/spec.md + agent-context.md                 (spec; facts vs hints)
  → .sliceui/project-context.json + conventions.json                     (init/detect)
  → verify reads transcript + conventions + generated .ts/.html/.scss
```

The resolve step stays snapshot-only: `resolve`/`spec`/`agent-context` read the design input plus
`.sliceui` (never project source). Public-API precedence (`paginationAlign` over behavioral CSS) is
verified against the in-memory pilar catalog, not a repository read.

## 11. Tools Integration

- **Gemini API** — screenshot tier 1 (`src/lib/gemini-client.mjs`), key from env/`.env.local`/`~/.sliceui/.env.local`.
- **macOS `sips` + Swift Vision** — static image decode + OCR (`src/ocr/`).
- **Playwright** — render-probe (CSS cascade check) and render-mount (real Angular mount) probes; also run in CI.
- **pilar private registry** — publish guard refuses non-`npm.uii.ac.id` publishes because catalogs embed private source.

## 12. Global Parameters and Constraints

- `TRANSCRIPT_VERSION = 3` (`src/lib/transcript-schema.mjs:5`) — transcript format is versioned.
- Publish allowlist: `package.json` `files` excludes all `pilar-*` + `uii-profile` + `uii-slice-policy` + `pilar-version` files.
- CI is ubuntu-only; macOS behavior is manually tested (documented gap).
- Angular 13-first: version-aware codegen (`*ngIf` vs `@if`, DI, standalone vs module).

## 13. Architecture Decision Records

### ADR-1 — Deterministic-first transcription (earlier, pre-reorg)
XML parse exact/no-key when available; vision model only when no XML; static OCR only when no key. Never guess. Inferred from codebase + README.

### ADR-2 — No premature framework abstraction (council, 2026-08-31 — LOCKED)
"Folder `framework/` as pure layout" approved; `index.mjs` per-framework descriptor and `capabilities` schema declared **premature** — only after React proves real shared fields. Source: `PLAN-framework-reorg-e2e.md` §2 (locked council decisions).

### ADR-3 — initCore() extraction deferred (council — LOCKED)
Same source; extract only from the diff that is genuinely identical after React works deeply first.

### ADR-4 — Org grammar gated, not removed (2026-09-05, v0.13.0–0.13.1)
UII/pilar grammar lives in the repo (`src/framework/angular/uii-profile.mjs`, pilar catalogs) but is excluded from the published package (`files` allowlist + `guard-publish.mjs`). Public installs degrade gracefully to project-detected conventions only.

### ADR-5 — Render probes close the "green ≠ correct" gap (v0.14.0–v0.15.0)
Static text checks alone can't see CSS cascade — headless probes (cascade check + real mount) assert the mechanism, run in CI. Source: gap analysis superseded-doc conclusion, implemented in 6ca0bf1 + 5b796c9.

### ADR-6 — Reorg kept Angular-first layout, not abstraction
v0.13.1 reorg moved verify/conventions/uii-profile/deep-detect into `src/framework/angular/`; no `index.mjs` descriptor was written (per ADR-2). Inferred from commit lineage 3ed3963, ad98033, e91758a, 7b39412.

## Success Metrics

A new framework can be added as a folder without touching shared `src/lib/` (the reorg's stated goal, verified by layout).

## Related Documents

- `development/api-contract.md` — artifact schemas (§9b flow targets)
- `development/testing.md` — how the architecture is gated
- `technical-guidelines/generated-catalog.md` — the generated-file rulebook
- `docs/archive/PLAN-framework-reorg-e2e.md` — reorg plan with locked council decisions
- `docs/archive/council/` — historical council transcripts behind ADR-2/3

## Open Questions

- Whether `src/framework/react/` starts with rules only or also a `verify` seam — decision deferred until React work begins (ADR-2 constraint applies).
