// vendors — load vendored real-usage snippets extracted from a component library's own
// showcase (see scripts/extract-pilar.mjs). These are VERBATIM usage examples, not
// hand-written registry samples — the same material that lets a repo-reading agent win.
// Precedence inside library-scan: local project usage > vendored > registry default.

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const VENDOR_DIR = join(HERE, "vendors", "pilar");

let _catalog = null;

function catalog() {
  if (_catalog) return _catalog;
  try {
    _catalog = JSON.parse(readFileSync(join(VENDOR_DIR, "index.json"), "utf8"));
  } catch {
    _catalog = null;
  }
  return _catalog;
}

/**
 * The vendored usage sample for a tag ("uii-table" | "ngx-select").
 * Returns { module, pkg, versionPinned, sampleHtml, sampleTs } or null.
 */
export function vendoredSample(tag) {
  const cat = catalog();
  const comp = cat?.components?.[tag];
  if (!comp) return null;
  const read = (pred) => {
    const name = comp.snippets.find(pred);
    if (!name) return null;
    try { return readFileSync(join(VENDOR_DIR, name), "utf8"); } catch { return null; }
  };
  return {
    module: comp.module,
    pkg: comp.pkg,
    versionPinned: cat.versionPinned,
    // The richest HTML/TS pair: prefer kitchen-sink (binds the most inputs), else the first.
    sampleHtml: read((n) => n.endsWith("kitchen-sink.html") || n.endsWith(`${tag}.html`)) ?? read((n) => n.endsWith(".html")),
    sampleTs: read((n) => n.endsWith("column-definitions.ts")) ?? read((n) => n.endsWith(`${tag}.ts`)) ?? read((n) => n.endsWith(".ts")),
  };
}

/** All snippet files for a tag (for richer context when budget allows). */
export function vendoredSnippetList(tag) {
  return catalog()?.components?.[tag]?.snippets ?? [];
}
