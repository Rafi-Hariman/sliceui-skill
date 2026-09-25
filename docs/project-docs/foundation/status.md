# Foundation — Status

Last update: 2026-09-10
Status: Live

---

## 1. Description

High-level project status: what state SliceUI is in, what recently landed, what's next, and what's blocked.

## 2. Important

Current released version: **v0.15.0** (package.json). Working tree has uncommitted changes across 14 modified files (verify/resolve/referee/fidelity/figml-parse + tests) — an in-flight quality pass not yet released. Historical detail lives in `docs/` (execution log, experience reports); this doc owns only the current summary.

## 3. Table of Contents

- [4. Scope](#4-scope)
- [5. Goals](#5-goals)
- [6. Non Goals](#6-non-goals)
- [7. Current State](#7-current-state)
- [8. Recent Accomplishments](#8-recent-accomplishments)
- [9. Upcoming Focus](#9-upcoming-focus)
- [10. Key Metrics](#10-key-metrics)
- [11. Roadmap](#11-roadmap)
- [12. Epics](#12-epics)
- [13. Risks/Blockers](#13-risksblockers)
- [Success Metrics](#success-metrics)
- [Related Documents](#related-docs)
- [Open Questions](#open-questions)

## 4. Scope

Point-in-time snapshot as of 2026-09-10. Owned changes only — deep history belongs to git + changelog.

## 5. Goals

Any agent or maintainer can answer "what's the state and what's next" from this one file.

## 6. Non Goals

Does not duplicate the changelog (releases) or phase trackers (per-phase task state).

## 7. Current State

- **v0.15.0 released** (2026-09-05/06 lineage): verify gate catching real render defects; headless render probes (cascade + Angular mount) in CI; resolve keyed by Figma name not just color; public package stripped of org-private source.
- **Pilar integration complete:** 47-component catalog + showcase (generated, extractor-regenerated), policy gate, typecheck, mount, version drift guard, publish guard.
- **Docs:** SDD doc set created 2026-09-10 (this doc set) — first `docs/project-docs/` in the repo.
- **In flight (uncommitted):** modifications across verify/resolve/referee/fidelity/figml-parse + 5 test files + skill/SKILL.md + angular conventions/uii-profile — described in `docs/archive/SLICEUI-EXPERIENCE-REPORT-2.md` as the false-positive-gate fixes.
- **Pending plan:** `docs/phases/REMEDIATION-PLAN-2026-09-11.md` (F1–F14, DRAFT) — not yet fully landed.

## 8. Recent Accomplishments

- v0.13.0→v0.13.1 framework reorg (Angular knowledge centralized in `src/framework/angular/`).
- v0.13.x pilar integration (catalogs, showcase, gating, typecheck, mount).
- v0.14.0 render-probe; v0.15.0 render-mount — the "verify green ≠ UI correct" gap addressed at the mechanism level.
- Quality-gate red-signal trustworthiness pass (commit 4aa33be).
- eval-hope A/B fixture runs permanently in CI.

## 9. Upcoming Focus

1. Land the in-flight uncommitted quality pass (verify/referee false-positive fixes) as v0.15.1 or v0.16.0.
2. render-probe follow-up issue from the reorg handoff (memory: 1 issue remaining).
3. Reduce gate friction documented in experience reports (15–20 min false-positive fights).
4. Decide React deep-adaptation start (ADR-2 constraint: extraction only after React proves fields).

## 10. Key Metrics

- Test suite: 36 files, 362 tests — 359 pass / 3 skip (skips are environment-gated: pilar mount + catalog roundtrip need `PILAR_CHECKOUT`). Measured 2026-09-24 on the working tree; the pre-change baseline was 305 pass / 3 skip / 0 fail.
- Verify checks: 30 (was 25). Added 2026-09-24: `alignmentViaDeepCss`, `requiredMarker`, `containerPadding`, `inventedLayout`, `deadCode`.
- Field-data fixture: `test/fixtures/mahasiswa-tarif/raw.xml` — the real "Tambah mahasiswa tarif" export, exercised end-to-end by `test/mahasiswa-tarif.test.mjs` (parse → resolve → verify).
- Fixing plan (P0) landed 2026-09-24: `--profile`/`--json-report` instrumentation (`fs-trace`), `verify` owning-module read scoped (no root traversal), `detect` freshness gate, `spec` corpus pruning. See `docs/SLICEUI-FIXING-PLAN-REVISED.md`.
- XML-tier fidelity: ~90%+ attribute fidelity (README claim, `sliceui fidelity` measured 100% on the two field executions in `docs/`).
- Field cost per slice: ~36 min for one component, ~80% consumed by gate friction + library reverse-engineering (experience report 2) — the improvement target.

## 11. Roadmap

1. **Now:** stabilize the verify/referee false-positive pass (in flight).
2. **Next:** render-probe follow-up; reduce resolve/library reverse-engineering cost (the 8–10 min wiring hunt).
3. **Later:** React deep adaptation (detection + syntax rules exist; conventions/verify do not).
4. **Someday:** Vue → Svelte → Next per the reorg plan's sequencing.

## 12. Epics

| Epic | State |
| :--- | :--- |
| Framework reorg (v0.13.x) | Complete |
| Pilar integration + publish guard (v0.13–v0.15) | Complete |
| Render verification layer (v0.14–v0.15) | Complete (1 follow-up open) |
| Gate false-positive reduction | In progress (uncommitted work) |
| SDD documentation set | Complete (this refresh) |

## 13. Risks/Blockers

- **macOS test coverage gap** — CI is ubuntu-only; static tier manually tested (README-documented).
- **No git tags** — releases traceable only via commit messages (workflow.md open question).
- **Gate friction is the product risk** — experience reports show verify false-positives dominate slice time; the in-flight pass targets exactly this.

## Success Metrics

This doc is updated at every release and at major state changes; no stale "in flight" claims older than a release cycle.

## Related Documents

- `foundation/changelog.md` — release history
- `foundation/phases/` — per-phase trackers
- `docs/archive/SLICEUI-EXPERIENCE-REPORT-2.md` — field evidence behind the friction risk

## Open Questions

- Version number for the in-flight pass: v0.15.1 (fix-only) vs v0.16.0 (includes resolve/referee behavior changes)?
