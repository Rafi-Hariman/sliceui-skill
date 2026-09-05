// detect-utils — shared fs/walk/token helpers for the detect pipeline.
// Split out of commands/detect.mjs so the Angular-specific deep-detect module
// (framework/angular/detect-angular.mjs) can use them WITHOUT importing back into
// the generic commands/detect.mjs orchestrator (which would be a layering cycle).

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

export const SKIP_DIRS = new Set(["node_modules", ".git", "dist", ".angular", "build", ".sliceui", ".claude", "coverage"]);

/** Recursively collect files matching `rx` under `dir`, bounded by budget + depth. */
export function walkFiles(dir, out, rx, budget, depth) {
  if (depth > 8 || budget.count <= 0) return;
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    if (budget.count <= 0) return;
    if (SKIP_DIRS.has(e.name)) continue;
    const full = join(dir, e.name);
    if (e.isDirectory()) {
      walkFiles(full, out, rx, budget, depth + 1);
    } else if (rx.test(e.name)) {
      out.push(full);
      budget.count -= 1;
    }
  }
}

export function readJsonSafe(p) {
  try { return JSON.parse(readFileSync(p, "utf8")); } catch { return null; }
}

export function readFileSyncSafe(p) {
  try { return readFileSync(p, "utf8"); } catch { return null; }
}

export function extOf(p) {
  const i = p.lastIndexOf(".");
  return i === -1 ? "" : p.slice(i + 1);
}

export function toRel(root, p) {
  return p.startsWith(root) ? p.slice(root.length + 1) : p;
}

export function extractTsconfigPaths(tsconfig) {
  if (!tsconfig) return {};
  const paths = tsconfig.compilerOptions?.paths ?? {};
  const out = {};
  for (const [alias, targets] of Object.entries(paths)) {
    out[alias] = Array.isArray(targets) ? targets[0] : String(targets);
  }
  return out;
}
