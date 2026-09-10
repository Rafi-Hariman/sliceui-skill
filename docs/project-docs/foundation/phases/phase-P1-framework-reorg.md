# Phase P1 — Framework Reorg

Last update: 2026-09-10
Status: Complete

---

## 1. Description

Centralize all Angular knowledge into `src/framework/angular/` without introducing a premature framework-neutral abstraction.

## 2. Important

Executed on branch `feat/framework-reorg`, landed in v0.13.1 (commits 3ed3963, ad98033, e91758a, 7b39412, 6335d92). Council-locked constraints from `PLAN-framework-reorg-e2e.md` §2 remain binding for future frameworks.

## 3. Table of Contents

- [4. Scope](#4-scope)
- [5. Goals](#5-goals)
- [6. Non Goals](#6-non-goals)
- [7. Phase Goal](#7-phase-goal)
- [8. Timeline](#8-timeline)
- [9. Feature Summary & Core Functions](#9-feature-summary--core-functions)
- [10. Sub-Functions / Tasks](#10-sub-functions--tasks)
- [11. Sprint Tracker](#11-sprint-tracker)
- [12. Acceptance Criteria](#12-acceptance-criteria)
- [13. Dependencies & Blockers](#13-dependencies--blockers)
- [14. Status](#14-status)
- [15. Deprecated Features](#15-deprecated-features)
- [Success Metrics](#success-metrics)
- [Related Documents](#related-docs)
- [Open Questions](#open-questions)

## 4. Scope

File-layout reorg + interactive init (Jalur B). Explicitly **not** the framework-neutral descriptor/`initCore()` extraction (vetoed, ADR-2/3).

## 5. Goals

Angular code lives in one folder; shared `src/lib/` is framework-neutral in fact, not just in name.

## 6. Non Goals

No React/Vue/Svelte work; no abstraction extraction.

## 7. Phase Goal

"Tiap framework punya rumah sendiri" — each framework gets a home folder; new frameworks land without disturbing existing code.

## 8. Timeline

Start: 2026-09-05 (re-baseline to v0.13.0 module graph) → End: 2026-09-05 (v0.13.1 bump).

## 9. Feature Summary & Core Functions

- `src/framework/angular/` — verify, conventions, deep-detect, codegen rules, uii-profile.
- Shared `walkNodes` deduplicated into `src/lib/walk-nodes.mjs`.
- Interactive init with `--framework`/`--yes`/`--profile` flags (Jalur B).

## 10. Sub-Functions / Tasks

1. Move verify/conventions/uii-profile into `src/framework/angular/` (3ed3963).
2. Split Angular deep-detect out of `commands/detect.mjs` (ad98033).
3. Move Angular codegen rules to `framework/angular/rules.mjs` (e91758a).
4. Dedup walkNodes into shared lib (7b39412).
5. Interactive init + flags (65e7861).

## 11. Sprint Tracker

| Task | Status |
| :--- | :--- |
| WS1–WS6 reorg workstreams | Done |
| walkNodes dedup | Done |
| Interactive init (Jalur B) | Done |

## 12. Acceptance Criteria

- 183/183 tests green post-reorg (handoff record).
- No `src/lib/` file contains Angular-specific hardcode paths for verify/conventions/detect.
- README per-layer honesty claims match reality.

## 13. Dependencies & Blockers

None — preceded by v0.13.0 remediation groundwork.

## 14. Status

Complete (2026-09-05).

## 15. Deprecated Features

- `src/lib/verify.mjs`, `src/lib/conventions.mjs` paths (moved; old paths invalid — gap-analysis doc paths are stale on purpose).

## Success Metrics

The reorg plan's stated goal verified by layout: a new framework is a folder, not a scattered refactor.

## Related Documents

- `../architecture.md` (ADR-2, ADR-6)
- `PLAN-framework-reorg-e2e.md` (repo root) — locked council decisions

## Open Questions

None — closed phase.
