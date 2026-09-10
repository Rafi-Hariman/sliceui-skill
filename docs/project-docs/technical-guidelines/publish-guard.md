# Guideline — Publish Guard & Private-Source Exclusion

Last update: 2026-09-10
Status: Live

---

## 1. Summary

The public npm package must contain **zero org-private source** (pilar catalogs, uii profiles). Two mechanisms enforce this: the `files` allowlist in `package.json` and `scripts/guard-publish.mjs` on `prepublishOnly`.

## 2. Scope

What ships in the package and how publish is gated. Repo-internal file layout is out of scope (`foundation/architecture.md`).

## 3. Rules

1. **R1 — Allowlist exclusions are load-bearing.** `package.json` `files` excludes: `src/framework/angular/pilar-*.mjs`, `uii-profile.mjs`, `uii-slice-policy.mjs`, `src/lib/pilar-version.mjs`. Removing an exclusion is a security-relevant change.
2. **R2 — Publish to public registries is refused when private files would ship.** `guard-publish.mjs` permits only `npm.uii.ac.id` (the org's private registry) to receive pilar-embedding builds.
3. **R3 — Guard runs at publish time, not CI time:** `prepublishOnly: "npm test && node scripts/guard-publish.mjs"`. Keep it in `prepublishOnly`, not just the CI pipeline — the guard must hold even when a human publishes locally.
4. **R4 — Every guard behavior has a test:** `test/guard-publish.test.mjs`. Changing the guard without updating its test is a defect.
5. **R5 — Graceful public degradation:** public installs (no pilar files) must still run init/detect/verify/doctor, adapting only to project-detected conventions — never emitting or referencing org-private vocabulary.

## 4. Preferred Patterns

- New private file type → add to `files` exclusions + add a guard case + add a guard test, in the same commit.
- Public-behavior claim ("public package is clean") → prove it via the guard test, not by inspection.

## 5. Anti-Patterns

- Relying on `.npmignore` alone (the allowlist is the mechanism; ignore-lists rot).
- Moving a private file to a non-`pilar-*` name to dodge the glob (the guard checks content signals too).
- Publishing with `--no-verify` (bypasses both the test suite and the guard).

## 6. Related Docs

- `operations/ci-cd.md` — where the guard sits in the release flow
- `foundation/phases/phase-P2-pilar-integration.md` — origin (commit f2e4e1f, 965b618)
- `foundation/architecture.md` (ADR-4) — the gated-grammar decision

## 7. Open Questions

None.
