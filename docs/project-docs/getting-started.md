# Getting Started

Last update: 2026-09-10
Status: Live

---

## 1. Description

Orientation and local setup for developing `sliceui-skill` itself (not for end users installing the published package — that flow is in the repo README).

## 2. Important

- Node >= 20 (Node 18 is EOL; `engines` enforces it).
- End-user install is `npm i -g sliceui-skill` + `sliceui install`. Contributing to this repo does **not** require that.
- CI runs on ubuntu only; macOS-specific behavior (static tier: `sips` + `swiftc` OCR) is manually tested. Inferred from codebase: README "Requirements" + `.github/workflows/ci.yml`.

## 3. Table of Contents

- [4. Scope](#4-scope)
- [5. Goals](#5-goals)
- [6. Non Goals](#6-non-goals)
- [7. Prerequisites](#7-prerequisites)
- [8. First Steps](#8-first-steps)
- [9. Local Setup](#9-local-setup)
- [10. Verification](#10-verification)
- [11. Troubleshooting](#11-troubleshooting)
- [Success Metrics](#success-metrics)
- [Related Documents](#related-documents)
- [Open Questions](#open-questions)

## 4. Scope

Contributor onboarding: clone → install → test → run the CLI locally.

## 5. Goals

A new contributor runs the test suite green within minutes, without a Gemini key or macOS.

## 6. Non Goals

Does not document how end users slice a design (README + `skill/SKILL.md` own that).

## 7. Prerequisites

- Node >= 20
- npm (repo uses `package-lock.json`; CI uses `npm ci`)
- For the screenshot static tier only (macOS): `sips` + `swiftc` (Xcode CLT)
- For render tests: Playwright chromium (`npx playwright install --with-deps chromium` on Linux)
- Optional: `GEMINI_API_KEY` for the Gemini transcription tier

## 8. First Steps

```bash
git clone https://github.com/Rafi-Hariman/sliceui-skill.git
cd sliceui-skill
npm install
npm test
```

Run the CLI locally:

```bash
node src/cli.mjs --help
```

## 9. Local Setup

- No build step is required to run from source — the CLI is plain ESM (`"type": "module"`).
- Runtime deps: `fast-glob`, `fast-xml-parser`, `typescript`. Dev-only: `esbuild`, `playwright`, `sass`.
- To use your working copy as the `sliceui` command: `npm link` (or run `node src/cli.mjs` directly).
- Test fixture with its own deps: `test/fixtures/angular-mount` (CI runs `npm ci --prefix` on it).

## 10. Verification

```bash
npm test                      # node --test test/ — full suite (28 test files)
```

Full quality gates and coverage expectations: `development/testing.md`.

## 11. Troubleshooting

| Symptom | Cause / fix |
| :--- | :--- |
| Tests fail on missing chromium | Run `npx playwright install --with-deps chromium` (render tests skip/degrade without it). Inferred from codebase: ci.yml installs it explicitly. |
| `sliceui` command not found | You cloned the repo, not installed the package. Use `node src/cli.mjs` or `npm link`. |
| Gemini tier fails | Expected without a key. XML (FIGML) tier needs no key; `doctor` treats a missing key as a warning, not a blocker. |
| Static tier unavailable on Linux | Expected — `sips`/`swiftc` are macOS-only. |
| Publish fails | `prepublishOnly` runs tests + `scripts/guard-publish.mjs`, which refuses publishes to registries other than `npm.uii.ac.id`. See `technical-guidelines/publish-guard.md`. |

## Success Metrics

A fresh clone passes `npm test` without any API key or macOS requirement.

## Related Documents

- `development/testing.md` — gates and coverage policy
- `operations/ci-cd.md` — CI pipeline and publish flow
- Repo `README.md` — end-user install and command reference

## Open Questions

None.
