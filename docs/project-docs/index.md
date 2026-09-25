# SliceUI Project Docs — Index

Last update: 2026-09-10
Status: Live
Taxonomy Tier: 2 (Standard) — flexible baselines applied

---

## 1. Description

Inventory of the active SDD documentation for `sliceui-skill`: an npm CLI + agent skill that converts UI designs (Figma FIGML XML preferred, screenshots fallback) into idiomatic Angular 13 component code, gated by deterministic verification.

## 2. Important

Authority order: project docs → codebase → agent judgment. The docs under `docs/project-docs/` own their topics; historical point-in-time reports live in `docs/` (one level up) and are migration input only — never authoritative.

## 3. Table of Contents

- [4. Scope](#4-scope)
- [5. Goals](#5-goals)
- [6. Non Goals](#6-non-goals)
- [7. Doc Registry](#7-doc-registry)
- [8. Omitted Docs (Flexible Baselines)](#8-omitted-docs-flexible-baselines)
- [9. Historical (Non-SDD) Material](#9-historical-non-sdd-material)
- [Success Metrics](#success-metrics)
- [Related Documents](#related-documents)
- [Open Questions](#open-questions)

## 4. Scope

Covers only the docs registered in §7. Historical analysis (gap analyses, experience reports, council transcripts, handoffs) is out of scope as active truth.

## 5. Goals

One owning doc per durable concern; zero stale summaries; minimal context cost for agents.

## 6. Non Goals

Does not restate command usage (see `getting-started.md` + README) or product vision detail (see `foundation/prd.md`).

## 7. Doc Registry

| Doc | Layer | Owns |
| :--- | :--- | :--- |
| `getting-started.md` | Root | Prerequisites, install, first run, verification, troubleshooting |
| `foundation/prd.md` | foundation | Vision, personas, pipeline value chain, requirements |
| `foundation/architecture.md` | foundation | Repo layout, module graph, framework-first strategy, ADRs |
| `foundation/workflow.md` | foundation | Dev loop, branching, PRs, release flow |
| `foundation/status.md` | foundation | Current state, roadmap, epics, risks |
| `foundation/phases/` | foundation | Phase registry (P1–P4, brownfield) |
| `foundation/changelog.md` | foundation | Version history v0.13.0 → now |
| `development/testing.md` | development | Test suite, quality gates, verification commands |
| `development/api-contract.md` | development | CLI command contract + `.sliceui/` artifact schemas |
| `operations/ci-cd.md` | operations | GitHub Actions pipeline, publish guard, secrets |
| `technical-guidelines/index.md` | technical-guidelines | Registry of active guideline rulebooks |
| `technical-guidelines/generated-catalog.md` | technical-guidelines | Never hand-edit generated files; extractor regeneration |
| `technical-guidelines/publish-guard.md` | technical-guidelines | Private-source exclusion rules |
| `technical-guidelines/verify-gate-trust.md` | technical-guidelines | Anti-false-green design rules |

## 8. Omitted Docs (Flexible Baselines)

| Doc | Why omitted |
| :--- | :--- |
| `development/database.md` | No database anywhere in the stack. |
| `development/ui-ux.md` | This repo is a CLI/compiler, not a UI. Design-to-code rules are product spec (prd) + engine behavior (architecture), not this repo's own UI. |
| `operations/production-runbook.md` | No production deployment; distribution is npm publish (covered in ci-cd.md). |
| `development/internationalization.md` | CLI output is English-only by design. |
| `operations/security-compliance.md` | Security-relevant rules (private-source exclusion, key handling) live in `technical-guidelines/publish-guard.md` and ci-cd.md. |

## 9. Historical (Non-SDD) Material

Under `docs/archive/` — input only, superseded where marked. Nothing here is authoritative.

- `SLICEUI-GAP-ANALYSIS-2026-09-05.md` (superseded, v0.12.1 audit), `REMEDIATION-PLAN-2026-09-05.md`, `BRAINSTORM-sliceui-reality.md`
- `REMEDIATION-PLAN-2026-09-10.md` — monorepo verify-trust plan, executed in commit `3769cf1`
- `PLAN-folder-layout-2026-09-11.md` — `.sliceui/` reorg, executed (`inputs/` + `artifacts/<name>/`)
- `SLICEUI-EXECUTION-LOG.md`, `SLICEUI-EXPERIENCE-REPORT.md`, `SLICEUI-EXPERIENCE-REPORT-2.md`, `sliceui-experience.md`, `experience-log-2026-09-10.md`, `agent-pov-2026-09-10.md` — field evidence for gate friction
- `session-feedback-2026-09-11.md` — session feedback (F1–F14) behind `docs/phases/REMEDIATION-PLAN-2026-09-11.md`
- `HANDOFF-2026-09-05.md`, `HANDOFF-pilar-sliceui-2026-09-06.md` — session handoffs
- `SLICEUI-EXPLAINED.md`, `SLICEUI-HANDOFF-EXPLAINED.md` — cross-agent briefing docs (v0.15.0)
- `council/` — 8 council transcripts/reports
- `PLAN-framework-reorg-e2e.md` — reorg plan, executed in v0.13.1

Pending (not yet executed) plans live in `docs/phases/`.

## Success Metrics

Every durable concern has exactly one owning doc; agent sessions resolve questions by reading the smallest owning doc.

## Related Documents

- Repo README (user-facing feature matrix and install)
- `docs/project-docs/foundation/status.md` for current open items

## Open Questions

- None open.
