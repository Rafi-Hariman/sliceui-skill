// loaded-classes — build the registry of CSS classes that ACTUALLY produce CSS in this project.
// The verify gate's class-legality model must ask "does this class resolve to a rule in a loaded
// stylesheet?" — NOT "does the team use this class in some HTML?" (the vocabulary model). A class
// the team uses but never defines (search-col) or a grid class a BS3 build never generates
// (col-12) is invisible to the vocabulary but visibly dead on localhost. This module answers it.
//
// Deterministic, zero deps. Resolution order (most accurate → least):
//   1. A compiled styles.css in dist/ (post-mixin, the ground truth of what ships).
//   2. The angular.json `styles[]` entries + their @import chain + src/ partials, selector-literal
//      extracted (pre-mixin — grid classes generated via @mixin are NOT seen, so a bare literal
//      scan is necessarily conservative; missing does not always mean absent).

import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, resolve, dirname } from "node:path";

const SKIP_DIRS = new Set(["node_modules", ".git", ".angular", "coverage", ".sliceui"]);

/**
 * @param {string} root — project root
 * @param {string[]} [stylePaths] — angular.json `styles[]` string entries (may include node_modules)
 * @returns {{ classes: Set<string>, source: 'dist'|'scss'|'none', files: string[] }}
 */
export function extractLoadedClasses(root, stylePaths = []) {
  const dist = findDistCss(root);
  if (dist) {
    const src = readSafe(dist);
    if (src) {
      return { classes: extractClassSelectors(src), source: "dist", files: [dist] };
    }
  }

  const files = collectLoadedStyles(root, stylePaths);
  const classes = new Set();
  for (const f of files) {
    const src = readSafe(f);
    if (!src) continue;
    for (const c of extractClassSelectors(src)) classes.add(c);
  }
  return { classes, source: files.length ? "scss" : "none", files };
}

/** Find a compiled dist stylesheet (angular.json outputPath default or dist/**.css). */
function findDistCss(root) {
  const cands = [];
  for (const p of [
    join(root, "dist"),
    join(root, "dist", "browser"),
  ]) {
    if (!existsSync(p)) continue;
    collect(p, cands, ".css");
  }
  // Prefer a large styles.css over a tiny app css.
  cands.sort((a, b) => (sizeOf(b) ?? 0) - (sizeOf(a) ?? 0));
  return cands[0] ?? null;
}

function collect(dir, out, ext) {
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    if (SKIP_DIRS.has(e.name)) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) collect(p, out, ext);
    else if (e.isFile() && e.name.endsWith(ext)) out.push(p);
  }
}

function sizeOf(p) { try { return statSync(p).size; } catch { return null; } }

/** Collect the stylesheets that actually load: angular.json `styles[]` + @import chain. */
function collectLoadedStyles(root, stylePaths) {
  const files = [];
  const push = (p) => { if (p && !files.includes(p)) files.push(p); };
  const pending = [];

  for (const s of stylePaths) {
    if (typeof s !== "string" || !s) continue;
    // A node_modules stylesheet may itself @import vendored bootstrap — read its @imports too.
    pending.push(resolve(root, s));
  }
  // Project-owned partials under src/ (mixin helpers etc.) as a lower-priority source.
  for (const d of ["src", "projects"]) {
    const abs = resolve(root, d);
    if (!existsSync(abs)) continue;
    walkDir(abs, (p) => { if (/\.(scss|css)$/i.test(p)) push(p); });
  }

  const seen = new Set();
  while (pending.length) {
    const f = pending.shift();
    if (!f || seen.has(f)) continue;
    seen.add(f);
    if (!existsSync(f)) continue;
    push(f);
    const src = readSafe(f);
    if (!src) continue;
    for (const m of src.matchAll(/@import\s+(?:url\()?["']([^"']+)["']\)?/g)) {
      pending.push(resolveImport(f, m[1]));
    }
  }
  return files;
}

function resolveImport(from, spec) {
  if (spec.startsWith("~")) spec = spec.slice(1);
  const base = dirname(from);
  const candidates = [resolve(base, spec)];
  if (!/\.(scss|css)$/i.test(spec)) {
    candidates.push(resolve(base, `${spec}.scss`), resolve(base, `_${spec}.scss`), resolve(base, `${spec}/_index.scss`), resolve(base, `${spec}.css`));
  }
  return candidates.find((p) => existsSync(p)) ?? candidates[0];
}

function walkDir(dir, fn) {
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    if (SKIP_DIRS.has(e.name)) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) walkDir(p, fn);
    else if (e.isFile()) fn(p);
  }
}

/** Extract `.class` selectors from CSS/SCSS source. Strip comments; split rules on `{` and `}`;
 *  the selector head before each `{` contributes its dotted class names (not pseudo/attr/tag). */
export function extractClassSelectors(src) {
  const clean = String(src ?? "")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\/\/.*$/gm, " ");
  const classes = new Set();
  // Walk rule heads: text before each `{` that is not inside a `@media`/`@keyframes` line.
  const heads = clean.split(/\{/).slice(0, -1).map((s) => s.slice(s.lastIndexOf("}") + 1));
  for (const head of heads) {
    // A head like "@media (min-width…)" or "@keyframes x" contributes no class of its own.
    const body = head.replace(/@[a-z-]+[^;]*/gi, " "); // drop @-directives
    for (const m of body.matchAll(/\.([a-zA-Z_][\w-]*)/g)) {
      classes.add(m[1]);
    }
  }
  return classes;
}

function readSafe(p) { try { return readFileSync(p, "utf8"); } catch { return null; } }
