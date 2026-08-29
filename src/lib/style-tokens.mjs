// style-tokens — mine the project's SCSS/CSS for design tokens so generated styles reuse
// the team's real variables instead of hardcoded hex. Emits literal values only; a token
// whose value is another variable/function is emitted with value:null (name-only reference).
// No sass evaluation — deterministic, zero deps beyond fast-glob.

import fg from "fast-glob";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const SKIP = ["**/node_modules/**", "**/dist/**", "**/.angular/**", "**/build/**", "**/.sliceui/**"];

/**
 * Extract design tokens from a project's stylesheets.
 * @param {string} root — project root
 * @param {string[]} [stylePaths] — angular.json `styles[]` (project-owned entries only)
 * @returns {{ scss: Array<{name:string,value:string|null}>, cssProps: Array<{name:string,value:string|null}>, mixins: string[] }}
 */
export function extractStyleTokens(root, stylePaths = []) {
  const files = collectScssFiles(root, stylePaths);

  const scss = [];
  const cssProps = [];
  const mixins = [];
  const seenScss = new Set();
  const seenCss = new Set();
  const seenMixins = new Set();

  for (const file of files) {
    let src;
    try { src = readFileSync(file, "utf8"); } catch { continue; }

    for (const m of src.matchAll(/^\s*\$([a-zA-Z_][\w-]*)\s*:\s*([^;]+);/gm)) {
      const name = m[1];
      if (seenScss.has(name)) continue;
      seenScss.add(name);
      scss.push({ name: `$${name}`, value: literalValue(m[2]) });
    }
    for (const m of src.matchAll(/(--[a-zA-Z_][\w-]*)\s*:\s*([^;]+);/g)) {
      const name = m[1];
      if (seenCss.has(name)) continue;
      seenCss.add(name);
      cssProps.push({ name, value: literalValue(m[2]) });
    }
    for (const m of src.matchAll(/@mixin\s+([a-zA-Z_][\w-]*)/g)) {
      const name = m[1];
      if (seenMixins.has(name)) continue;
      seenMixins.add(name);
      mixins.push(name);
    }
  }

  return { scss, cssProps, mixins };
}

// ---------- internals ----------

/** Collect project-owned SCSS/CSS: explicit style paths + all partials under src/. */
function collectScssFiles(root, stylePaths) {
  const files = [];
  const push = (p) => {
    if (p && !files.includes(p)) files.push(p);
  };
  for (const s of stylePaths) {
    if (typeof s !== "string" || !s) continue;
    // design-system / library stylesheets live in node_modules — not project tokens.
    if (s.includes("node_modules")) continue;
    push(resolve(root, s));
  }
  for (const f of fg.sync(["src/**/*.scss", "src/**/*.css"], { cwd: root, ignore: SKIP, absolute: true })) {
    push(f);
  }
  return files;
}

/**
 * Return the token value if it is a literal the generator can use verbatim, else null
 * (the value is a reference to another variable or a function call — name-only).
 */
function literalValue(raw) {
  const v = raw.replace(/\s*!important\s*$/i, "").trim();
  if (!v) return null;
  if (/^#[0-9a-fA-F]{3,8}$/.test(v)) return v;                     // hex
  if (/^-?\d+(\.\d+)?(px|rem|em|%|vh|vw|vmin|vmax|pt|ch|ex|fr|s|ms|deg)?$/.test(v)) return v; // number + unit
  if (/^["'][^"']*["']$/.test(v)) return v;                        // quoted string
  if (/^(rgb|rgba|hsl|hsla)\([^)]*\)$/i.test(v)) return v;         // color function
  return null;                                                      // $other-var, var(--x), calc(), etc.
}
