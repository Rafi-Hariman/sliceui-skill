# Guideline — Generated Catalog Discipline

Last update: 2026-09-10
Status: Live

---

## 1. Summary

`src/framework/angular/pilar-catalog.mjs` and `pilar-showcase.mjs` are **GENERATED files**. They are produced by TypeScript-AST extractors from the private pilar checkout and must never be hand-edited; all change flows through regeneration.

## 2. Scope

The generated pilar artifacts and their extractors. Hand-written engine code is out of scope.

## 3. Rules

1. **R1 — Never hand-edit generated files.** Applies to: `pilar-catalog.mjs`, `pilar-showcase.mjs` (and any future `*-catalog.mjs` produced by an extractor).
2. **R2 — Regenerate, don't patch:** `node scripts/extract-pilar.mjs <pilar-path>` and `node scripts/extract-pilar.showcase.mjs <pilar-path>`.

3. **R3 — Shared AST helpers live in one place:** `scripts/lib/ts-ast-shared.mjs` serves both extractors; do not duplicate AST helpers.
4. **R4 — Internal components stay non-public:** internals (uii-server-table, picker internals) are tagged `public: false` in the catalog; do not flip tags by hand — fix at the pilar source + regenerate.
5. **R5 — Catalog drift guard:** `pilar-version.mjs` compares installed pilar vs `PILAR_VERSION`; `init`/`doctor` warn on drift. When pilar changes, regenerate + bump `PILAR_VERSION` together.

## 4. Preferred Patterns

- Change in pilar → run both extractors → run `npm test` → land catalog + version bump in one commit.
- New extracted fact needed (e.g. a new binding fact) → extend the extractor, regenerate, verify the diff is only what you intended.

## 5. Anti-Patterns

- Hot-fixing a typo in the catalog directly (silently reverted at the next regeneration, and untestable).
- Adding a second AST helper file for a new extractor.
- Editing a generated file as part of an unrelated refactor commit (pollutes the regeneration diff).

## 6. Related Docs

- `foundation/phases/phase-P2-pilar-integration.md` — the phase that introduced the catalogs
- `foundation/architecture.md` — module layout
- `docs/archive/HANDOFF-pilar-sliceui-2026-09-06.md` — original integration handoff

## 7. Open Questions

None.

---
