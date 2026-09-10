# Foundation — Phases Index

Last update: 2026-09-10
Status: Live

---

## 1. Description

Phase registry for `sliceui-skill`'s development cycles (brownfield — phases reconstructed from the completed work in git history).

## 2. Important

All four-signal detection was positive (recent commits, feature branches, planning artifacts). Phases P1–P3 are **retrospective** — they document completed work for traceability; P4 is the only live phase.

## 3. Table of Contents

- [4. Scope](#4-scope)
- [5. Goals](#5-goals)
- [6. Non Goals](#6-non-goals)
- [7. Project Type](#7-project-type)
- [8. Overall Timeline](#8-overall-timeline)
- [9. Phase Registry](#9-phase-registry)
- [10. How to Add New Phases](#10-how-to-add-new-phases)
- [Success Metrics](#success-metrics)
- [Related Documents](#related-docs)
- [Open Questions](#open-questions)

## 4. Scope

The phases registry only — individual phase state lives in each phase file.

## 5. Goals

Every work cycle traceable from registry → phase file → commit lineage.

## 6. Non Goals

Does not track day-to-day tasks (phase files own those).

## 7. Project Type

**Brownfield** — phases were inferred from git history (commits 2026-08-31 → 2026-09-06), not planned up front.

## 8. Overall Timeline

2026-08-31 (first council) → 2026-09-06 (v0.15.0 release + docs trim). Ongoing.

## 9. Phase Registry

| Phase | Name | Status | Timeline | File |
| :--- | :--- | :--- | :--- | :--- |
| P1 | Framework reorg (Angular home, no premature abstraction) | Complete | 2026-09-05 | `phase-P1-framework-reorg.md` |
| P2 | Pilar integration: catalogs, gating, publish guard | Complete | 2026-09-06 | `phase-P2-pilar-integration.md` |
| P3 | Render verification layer (probe + mount) | Complete | 2026-09-05 | `phase-P3-render-verification.md` |
| P4 | Gate false-positive reduction + stability | In Progress | 2026-09-06 → | `phase-P4-gate-stability.md` |

## 10. How to Add New Phases

1. Create `phase-P{N+1}[-description].md` with the standard phase headings.
2. Add its row to the registry table above.
3. Cross-reference in `foundation/status.md` roadmap/epics.

## Success Metrics

Every completed work cycle is traceable from registry → phase file → commit lineage.

## Related Documents

- `foundation/status.md` — epics mirror this registry
- `foundation/changelog.md` — release history alongside phases

## Open Questions

- P3's end date needs the exact v0.14.0/v0.15.0 commit dates confirmed (registry shows TBD-range).
