// pilar-version — drift guard for the checked-in pilar catalogs.
//
// The catalogs (pilar-catalog.mjs / pilar-showcase.mjs) are SNAPSHOTS of the private pilar
// repo at a fixed version (PILAR_VERSION). When a UII project installs a newer pilar, the
// snapshot silently goes stale: the agent keeps generating against the old API and nothing
// fails until runtime. This module makes that skew LOUD — a warning in `sliceui init`'s result
// and a check line in `sliceui doctor` — and carries the exact regeneration command.
//
// Semver policy: exact match = ok. Catalog OLDER than installed (installed 3.4.0, catalog
// 3.3.23) = warn (the known drift direction). Catalog NEWER than installed (project pins an
// older pilar) = a milder warn too — the bindings may reference inputs the installed pilar
// lacks. Any skew is worth surfacing; neither direction is silently fine.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PILAR_VERSION } from "../framework/angular/pilar-catalog.mjs";

/** Extract major.minor from an exact or range semver ("3.3.23", "^3.3.23", "~3.4"). */
function majorMinor(v) {
  const m = /(\d+)\.(\d+)/.exec(String(v ?? ""));
  return m ? `${m[1]}.${m[2]}` : null;
}

/** The pilar version a project actually has: node_modules/pilar/package.json (exact) is the
 *  ground truth; the package.json dependency (a range) is the fallback for a fresh scaffold. */
export function installedPilarVersion(root, deps = {}) {
  const nm = join(root, "node_modules", "pilar", "package.json");
  if (existsSync(nm)) {
    try { return JSON.parse(readFileSync(nm, "utf8")).version ?? null; } catch { /* fall through */ }
  }
  const dep = deps.pilar;
  return typeof dep === "string" ? dep : null;
}

/**
 * Compare the installed pilar against the catalog snapshot.
 * @returns {{ present: boolean, catalog: string|null, installed: string|null, skew: boolean,
 *            message: string|null }}
 *  `present: false` = the project doesn't reference pilar at all (generic or non-UII) —
 *  nothing to guard, message null.
 */
export function pilarVersionStatus(root, deps = {}) {
  const installed = installedPilarVersion(root, deps);
  if (!installed) {
    return { present: false, catalog: PILAR_VERSION, installed: null, skew: false, message: null };
  }
  const catMM = majorMinor(PILAR_VERSION);
  const instMM = majorMinor(installed);
  if (!catMM || !instMM) {
    return { present: true, catalog: PILAR_VERSION, installed, skew: true,
      message: `pilar catalog snapshot version (PILAR_VERSION=${PILAR_VERSION}) or installed version (${installed}) is not readable semver — regenerate the catalog to be safe: node scripts/extract-pilar.mjs <path-to-pilar>` };
  }
  if (catMM === instMM) {
    return { present: true, catalog: PILAR_VERSION, installed, skew: false, message: null };
  }
  const direction = catMM < instMM ? "older than" : "newer than";
  return {
    present: true,
    catalog: PILAR_VERSION,
    installed,
    skew: true,
    message:
      `pilar catalog snapshot is ${PILAR_VERSION} but this project uses ${installed} (${direction} installed) — ` +
      `bindings/types may be stale. Regenerate: node scripts/extract-pilar.mjs <path-to-pilar> && node scripts/extract-pilar-showcase.mjs <path-to-pilar>, then re-run sliceui init.`,
  };
}

/** A doctor check line ({ ok, warn, label, detail }) for the pilar catalog skew. */
export function pilarDoctorCheck(root, deps = {}) {
  const st = pilarVersionStatus(root, deps);
  if (!st.present) {
    return { ok: true, label: "Pilar catalog: not applicable", detail: "no pilar dependency detected (generic project) — embedded catalog unused" };
  }
  if (!st.skew) {
    return { ok: true, label: `Pilar catalog: ${st.catalog}`, detail: `matches installed pilar ${st.installed}` };
  }
  return { ok: false, warn: true, label: `Pilar catalog: ${st.catalog} (skew)`, detail: st.message };
}
