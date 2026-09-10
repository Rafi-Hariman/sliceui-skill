# Technical Guidelines — Index

Last update: 2026-09-10
Status: Live

---

## 1. Description

Registry of active technical guideline rulebooks for `sliceui-skill` — durable, cross-cutting coding rules agents must follow during implementation.

## 2. Important

A guideline is active only when it has a row in §7 **and** the file exists. Guidelines are rulebooks with real rules inferred from the codebase — never placeholders.

## 3. Table of Contents

- [4. Scope](#4-scope)
- [5. Goals](#5-goals)
- [6. Non Goals](#6-non-goals)
- [7. Active Guidelines Registry](#7-active-guidelines-registry)
- [8. Registry Rules & Ownership](#8-registry-rules--ownership)
- [9. Guideline Stable Headings](#9-guideline-stable-headings)
- [Success Metrics](#success-metrics)
- [Related Documents](#related-documents)
- [Open Questions](#open-questions)

## 4. Scope

Cross-cutting implementation rules only. Feature behavior lives in foundation docs; verification commands in `development/testing.md`.

## 5. Goals

Prevent convention divergence (generated-file edits, private-source leaks, gate weakening) by giving each its own enforceable rulebook.

## 6. Non Goals

Does not document general setup or per-feature specs (see the master registry `../index.md`).

## 7. Active Guidelines Registry

| Guideline | Domain | Purpose | Owner | Review Trigger |
| :--- | :--- | :--- | :--- | :--- |
| `generated-catalog.md` | Build artifacts | Generated pilar catalogs are never hand-edited; extractor regeneration only | rafi.hariman | Pilar source changes or extractor changes |
| `publish-guard.md` | Packaging/security | Public package stays free of org-private source; guard on prepublishOnly | rafi.hariman | Packaging, files-allowlist, or publish-flow changes |
| `verify-gate-trust.md` | Quality gates | Red = real, green = trustworthy; no skip-paths; render backstop | rafi.hariman | Any verify/referee/resolve check change |

## 8. Registry Rules & Ownership

- Keep this table aligned with files actually present under `technical-guidelines/`.
- New durable cross-cutting convention → new guideline file + row here + link from `../index.md`.
- Retired guideline → delete file and remove its row (no dead rows).

## 9. Guideline Stable Headings

Each guideline file uses: Summary, Scope, Rules, Preferred Patterns, Anti-Patterns, Related Docs, Open Questions.

## Success Metrics

Agents touch generated files, packaging, or gate checks only in compliance with these rulebooks.

## Related Documents

- [Master Project Registry](../index.md) — the active doc catalog

## Open Questions

None.
