# Foundation — Workflow

Last update: 2026-09-10
Status: Live

---

## 1. Description

The development loop for contributing to `sliceui-skill`: branching, local iteration, commits, releases, and issue tracking.

## 2. Important

- Trunk-based on `main`; feature work happens on short-lived `feat/*` branches.
- **Commit message convention (observed in history):** `type(scope): message` — types in use: `feat`, `fix`, `refactor`, `test`, `chore`, `docs`; version bumps use `chore(vX.Y.Z): bump version`. Scopes seen: `pilar`, `verify`, `init`, `publish`, `eval-hope`, `vX.Y.Z`.
- **Releases are commit-driven:** a feature lands with a `feat(vX.Y.Z):` commit, then a `chore(vX.Y.Z): bump version` commit. No tags are used (git tag list is empty). Inferred from codebase.

## 3. Table of Contents

- [4. Scope](#4-scope)
- [5. Goals](#5-goals)
- [6. Non Goals](#6-non-goals)
- [7. Local Dev Loop](#7-local-dev-loop)
- [8. Branching Strategy](#8-branching-strategy)
- [9. PR & Code Review](#9-pr--code-review)
- [10. Issue Tracking](#10-issue-tracking)
- [Success Metrics](#success-metrics)
- [Related Documents](#related-docs)
- [Open Questions](#open-questions)

## 4. Scope

How code gets from working tree to `main` and out as a release.

## 5. Goals

Small, verifiable increments; every increment keeps the suite green; no release without the publish guard.

## 6. Non Goals

No CI-enforced conventional-commit linting — the convention is by practice, not by tooling. Inferred from codebase (no commit-lint config present).

## 7. Local Dev Loop

1. `npm test` before starting (baseline green: 183 tests across 28 files — Inferred from codebase, memory of reorg completion).
2. Work in small increments; keep each commit self-contained.
3. `npm test` before every commit.
4. When touching generated files, regenerate via extractors — see `technical-guidelines/generated-catalog.md`.

## 8. Branching Strategy

| Branch | Purpose |
| :--- | :--- |
| `main` | Trunk. CI runs on push + PRs to it. |
| `feat/<name>` | Feature work (e.g. `feat/framework-reorg`, `feat/render-mount` — both merged history shows these landed via main-line commits). |

No `develop`, no release branches (releases are version-bump commits on main).

## 9. PR & Code Review

- PRs target `main`; CI must pass (`npm ci`, fixture deps, Playwright chromium, `npm test`).
- Solo-maintainer project: review is self-review against the SDD docs + commit-message discipline.

## 10. Issue Tracking

No issue tracker configured (no `.github/ISSUE_TEMPLATE/`, no board config). Open items live in:
- `docs/project-docs/foundation/status.md` (roadmap/risks)
- `docs/project-docs/foundation/phases/` (phase trackers)

## Success Metrics

Every merge keeps `npm test` green on ubuntu CI; every release has a matching `chore(vX.Y.Z)` bump commit.

## Related Documents

- `development/testing.md` — what must pass before commit
- `operations/ci-cd.md` — pipeline + publish flow
- `foundation/phases/` — where open work is tracked

## Open Questions

- Should the project start tagging releases (e.g. `v0.15.0` tags) so npm versions are traceable? (No tags exist today — Inferred from codebase.)
