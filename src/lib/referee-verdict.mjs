// referee-verdict — the stored codebase-evidence verdict for the referee cold/hot split (PR 3).
//
// The referee's codebase head (does each convention claim trace to real source? are there
// duplicate selectors?) is a full-repository scan. It is expensive and must NOT run on every
// slice. This module persists the RESULT of that scan to `.sliceui/referee-verdict.json` so the
// hot-path `referee --target` reads the stored verdict instead of re-scanning.
//
// The verdict is small: findings (selector/path/detail strings) + evidence counts. It never
// stores source bodies, concatenated HTML/SCSS/CSS, secrets, or absolute paths beyond what a
// finding needs.
//
// Freshness: the verdict is bound to TWO fingerprints —
//   projectFingerprint  = the existing detect inputHash (config files + git HEAD) — cheap anchor
//   snapshotFingerprint = sha256 of conventions.json + project-context.json — the claims the
//                         codebase head actually validated
// If either is stale, the hot path reports STALE (non-green) and never re-scans silently.
//
// States (explicit, never a truthy empty object — the PR 2 VER-001 lesson):
//   fresh-pass / fresh-fail / missing / stale / invalid

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";

export const REFEREE_VERDICT_SCHEMA = 1;
export const REFEREE_VERDICT_FILE = "referee-verdict.json";

/** Hash the bounded `.sliceui` snapshot files the codebase head validates against. */
export function snapshotFingerprint(root) {
  const hash = createHash("sha256");
  for (const f of ["conventions.json", "project-context.json"]) {
    try {
      hash.update(f).update(readFileSync(join(root, ".sliceui", f), "utf8"));
    } catch {
      /* a missing snapshot file simply leaves the fingerprint over the files present */
    }
  }
  return {
    algorithm: "sha256",
    value: hash.digest("hex"),
    inputs: ["conventions.json", "project-context.json"],
  };
}

/**
 * Serialize a codebase-evidence verdict. `codebaseFindings` are the referee codebase-head
 * findings (already classified blocking/non-blocking); `evidence` are the scan counts.
 */
export function buildRefereeVerdict({ ctx, codebaseFindings, evidence }) {
  const red = (codebaseFindings ?? []).some((f) => f.status === "fail" || f.status === "stale");
  return {
    schemaVersion: REFEREE_VERDICT_SCHEMA,
    generatedAt: new Date().toISOString(),
    mode: "deep",
    projectFingerprint: {
      algorithm: "sha1-truncated (detect inputHash)",
      value: ctx?.inputHash ?? null,
      inputs: ["package.json", "angular.json", "tsconfig.json", "package-lock.json", "git HEAD"],
    },
    snapshotFingerprint: snapshotFingerprint(ctx?.cwd ?? null),
    status: red ? "fail" : "pass",
    findings: codebaseFindings ?? [],
    evidence: evidence ?? { filesConsidered: 0, selectorsChecked: 0, conventionClaimsChecked: 0, duplicateSelectors: [] },
  };
}

function readJsonSafe(p) {
  try { return JSON.parse(readFileSync(p, "utf8")); } catch { return null; }
}

/**
 * Assess the stored verdict for the hot path.
 * @param {string} root — the `.sliceui`-bearing directory
 * @param {object} ctx — the current project-context.json (carries `inputHash`)
 * @returns {{ state: "fresh-pass"|"fresh-fail"|"missing"|"stale"|"invalid", verdict: object|null, diagnostics: string[] }}
 */
export function assessRefereeVerdict(root, ctx) {
  const path = join(root, ".sliceui", REFEREE_VERDICT_FILE);
  let raw;
  try { raw = readFileSync(path, "utf8"); } catch {
    return { state: "missing", verdict: null, diagnostics: ["referee-verdict.json absent — run `sliceui init` or `sliceui referee --target <name> --deep` to build the codebase-evidence verdict."] };
  }

  let verdict;
  try { verdict = JSON.parse(raw); } catch {
    return { state: "invalid", verdict: null, diagnostics: ["referee-verdict.json is malformed JSON — regenerate via `sliceui init` or `sliceui referee --deep`."] };
  }

  if (verdict?.schemaVersion !== REFEREE_VERDICT_SCHEMA) {
    return { state: "invalid", verdict, diagnostics: [`referee-verdict.json has unsupported schemaVersion ${verdict?.schemaVersion ?? "none"} (expected ${REFEREE_VERDICT_SCHEMA}) — regenerate via \`sliceui init\` or \`sliceui referee --deep\`.`] };
  }

  // Project fingerprint: the cheap anchor. A changed inputHash means config/git HEAD changed.
  if ((verdict.projectFingerprint?.value ?? null) !== (ctx?.inputHash ?? null)) {
    return { state: "stale", verdict, diagnostics: ["project fingerprint mismatch (package.json/angular.json/tsconfig/lockfile/git HEAD changed since the verdict) — re-run `sliceui init` or `sliceui referee --deep`."] };
  }

  // Snapshot fingerprint: conventions.json/project-context.json changed since the verdict.
  if (verdict.snapshotFingerprint?.value !== snapshotFingerprint(root).value) {
    return { state: "stale", verdict, diagnostics: ["snapshot fingerprint mismatch (conventions.json or project-context.json changed) — re-run `sliceui init` or `sliceui referee --deep`."] };
  }

  const state = verdict.status === "fail" ? "fresh-fail" : "fresh-pass";
  return { state, verdict, diagnostics: [] };
}
