# Development — Testing

Last update: 2026-09-10
Status: Live

---

## 1. Description

QA policy and quality gates for `sliceui-skill`: the test suite, what each layer covers, and what must pass before commit and release.

## 2. Important

Runner is `node --test test/` (built-in runner; no jest/vitest). 28 test files, ~183 tests. CI runs the whole suite on **ubuntu-latest only** — macOS-specific behavior (static tier: `sips`/`swiftc` OCR) is exercised manually, never in CI (documented gap). Render verification (Playwright chromium + fixture mount) runs in CI, so full-suite local runs need chromium installed.

## 3. Table of Contents

- [4. Scope](#4-scope)
- [5. Goals](#5-goals)
- [6. Non Goals](#6-non-goals)
- [7. Verification Policy & Objectives](#7-verification-policy--objectives)
- [8. Verification Matrix & Coverage](#8-verification-matrix--coverage)
- [9. Test Layers & Environments](#9-test-layers--environments)
- [10. Commands & CI Gates](#10-commands--ci-gates)
- [11. Naming & File Conventions](#11-naming--file-conventions)
- [12. Manual Checks & Fallbacks](#12-manual-checks--fallbacks)
- [Success Metrics](#success-metrics)
- [Related Documents](#related-docs)
- [Open Questions](#open-questions)

## 4. Scope

The repo's own test suite and gates. (The `sliceui verify` gate that SliceUI ships as a *product* is engine behavior — owned by the PRD and `technical-guidelines/verify-gate-trust.md`, not here.)

## 5. Goals

- Deterministic, key-free, offline-capable suite (no test requires `GEMINI_API_KEY`).
- Every gate rule (verify/referee) is regression-checked by at least one test.
- Render probes run in CI so gate verdicts are render-checked, not just text-checked.

## 6. Non Goals

- No macOS in CI (platform limitation; static tier is manually tested).
- No coverage-percentage targets enforced by tooling.

## 7. Verification Policy & Objectives

1. **Red = real.** A failing test must indicate a real defect, not environment drift (objective mirrors the product's verify-gate-trust rules).
2. **Fixture-tracked:** ground-truth fixtures (e.g. eval-hope's synthetic fixture) are committed so evals run permanently in CI, not on a maintainer's machine.
3. **Gate parity:** when a check is added/changed in `verify.mjs`/`referee.mjs`, the change lands together with its test updates (observed discipline in history: 4aa33be + test updates, 971ce6f + test updates).

## 8. Verification Matrix & Coverage

| Layer | What it covers | Suite files (examples) | In CI |
| :--- | :--- | :--- | :--- |
| Unit (parsers/schema) | FIGML parse, transcript schema, style tokens, TS AST | `figml-parse`, `transcript-schema`, `style-tokens`, `static-extract` | ✅ |
| Unit (engine) | fidelity, resolve, referee, render-transcript, walk-nodes | `fidelity`, `resolve`, `referee`, `render-transcript` | ✅ |
| Commands | init, install/uninstall, doctor, detect | `init`, `install`, `uninstall`, `doctor`, `detect` | ✅ |
| Conventions/profile | conventions mining, uii-profile gating | `conventions`, `uii-profile`, `library-scan` | ✅ |
| Pilar layer | catalog, golden, roundtrip, version, mount, publish guard | `pilar-*`, `guard-publish` | ✅ |
| Render | cascade probe + real Angular mount | `render-probe-sliceui`, `render-mount-sliceui` | ✅ (chromium) |
| Eval | human-vs-machine A/B on tracked fixture | `eval-hope-sliceui` | ✅ |
| E2E | CLI end-to-end | `e2e` | ✅ |
| Static tier (macOS) | sips + Swift OCR path | manual only | ❌ |

## 9. Test Layers & Environments

- **Local dev:** `npm test` — needs Node >= 20; chromium for render tests; fixture deps installed (`npm ci --prefix test/fixtures/angular-mount`).
- **CI (ubuntu):** full suite incl. render probes; fixture deps + Playwright installed by the workflow.
- **Manual (macOS):** static-tier transcription; real-slice field runs (recorded in `docs/` experience reports).

## 10. Commands & CI Gates

```bash
npm test                                        # full suite (local gate before every commit)
npm ci --prefix test/fixtures/angular-mount     # one-time fixture deps (CI does this)
npx playwright install --with-deps chromium     # one-time render-probe browser
```

**Publish gate (blocking):** `prepublishOnly` = `npm test` **and** `node scripts/guard-publish.mjs`. A publish attempt fails on any red test or any private-file leak. See `technical-guidelines/publish-guard.md`.

CI gate: single `quality` job — `npm ci` → fixture `npm ci` → Playwright chromium → `npm test` (see `operations/ci-cd.md`).

## 11. Naming & File Conventions

- One file per concern: `test/<concern>.test.mjs` (e.g. `verify.test.mjs`, `pilar-golden.test.mjs`).
- Product-named evals: `eval-hope-sliceui.test.mjs` (hope = human-vs-machine A/B).
- Fixtures under `test/fixtures/`; the Angular-mount fixture is a real npm package (own `package.json`) used by `render-mount`.
- Golden fixtures: `test/fixtures/pilar-golden/` (e.g. `bill-list`) — regression anchors for the pilar pipeline.

## 12. Manual Checks & Fallbacks

- **macOS static tier:** run `sliceui transcribe <image>` on a Mac and confirm OCR output quality — no CI equivalent.
- **Field slice runs:** the accepted end-to-end acceptance is a real slice on a real project; findings are recorded as experience reports in `docs/` and fold into the phases tracker.

## Success Metrics

- CI green on every push to `main`; publish gate has never been bypassed.
- Every new verify/referee rule ships with a paired test (spot-checkable in history).

## Related Documents

- `operations/ci-cd.md` — pipeline that runs these gates
- `getting-started.md` — local setup to reach a green suite
- `technical-guidelines/verify-gate-trust.md` — the product-gate rules the tests protect

## Open Questions

- Exact test count drifts with in-flight work (~183 at reorg completion); should CI publish the count to avoid stale numbers in docs?
