# Operations — CI/CD

Last update: 2026-09-10
Status: Live

---

## 1. Description

The CI pipeline and the release/publish flow for `sliceui-skill`.

## 2. Important

CI is a single `quality` job on **ubuntu-latest** (`.github/workflows/ci.yml`): checkout → Node 20 → npm cache → `npm ci` → fixture `npm ci` → Playwright chromium → `npm test`. Publishes are guarded — `prepublishOnly` refuses to publish private source to any registry other than `npm.uii.ac.id`.

## 3. Table of Contents

- [4. Scope](#4-scope)
- [5. Goals](#5-goals)
- [6. Non Goals](#6-non-goals)
- [7. Pipeline Architecture](#7-pipeline-architecture)
- [8. Build Steps](#8-build-steps)
- [9. Testing & Quality Gates](#9-testing--quality-gates)
- [10. Deployment Environments](#10-deployment-environments)
- [11. Secrets](#11-secrets)
- [Success Metrics](#success-metrics)
- [Related Documents](#related-docs)
- [Open Questions](#open-questions)

## 4. Scope

GitHub Actions CI + npm publish flow. No deploy targets exist (the product is an npm package + skill files).

## 5. Goals

Every push/PR to `main` is proven green on ubuntu; no private source can ever reach the public registry.

## 6. Non Goals

No macOS CI, no matrix builds, no artifact caching beyond npm.

## 7. Pipeline Architecture

Single job, single OS:

```
push / PR → main
  └─ job: quality (ubuntu-latest, 25 min timeout)
       ├─ actions/checkout@v4
       ├─ actions/setup-node@v4 (node 20, npm cache)
       ├─ npm ci
       ├─ npm ci --prefix test/fixtures/angular-mount
       ├─ npx playwright install --with-deps chromium
       └─ npm test
```

## 8. Build Steps

None — no build artifact. The published package is the source ESM (plus `skill/`), filtered by the `files` allowlist.

## 9. Testing & Quality Gates

- **CI gate:** `npm test` (full suite incl. render probes — chromium is installed by the workflow).
- **Publish gate:** `prepublishOnly` = `npm test` + `node scripts/guard-publish.mjs` (registry check + private-file allowlist enforcement; see `technical-guidelines/publish-guard.md`).

## 10. Deployment Environments

| Target | Mechanism | Gate |
| :--- | :--- | :--- |
| Public npm | `npm publish` | tests + guard-publish (blocks non-private registries) |
| Private registry `npm.uii.ac.id` | `npm publish --registry=...` | tests only; guard permits this registry |
| Agent CLIs | `sliceui install` (writes skill into agent skill dir) | none (local) |

Release act: `chore(vX.Y.Z): bump version` commit → publish. No git tags (see workflow.md open question).

## 11. Secrets

- **CI:** none required — the suite is key-free by design.
- **Local:** `GEMINI_API_KEY` lives in `.env.local` (gitignored by init) or `~/.sliceui/.env.local`. Never committed or logged. Missing key = doctor warning, not a blocker.

## Success Metrics

CI green on main; zero private-source leaks to the public registry (enforced, tested by `guard-publish.test.mjs`).

## Related Documents

- `development/testing.md` — what the CI gate runs
- `technical-guidelines/publish-guard.md` — the private-source rulebook
- `foundation/workflow.md` — release commit convention

## Open Questions

None.
