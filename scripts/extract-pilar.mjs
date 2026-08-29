#!/usr/bin/env node
// extract-pilar — one-shot offline extractor: pilar source repo → vendored usage catalog.
// NOT part of runtime. Reads the cloned pilar repo's showcase app (real usage examples,
// verbatim) and emits src/lib/vendors/pilar/{index.json,*.html,*.ts}. Re-run when pilar
// bumps; the extracted pilar version is pinned inside index.json (detect warns on drift).
//
// Usage: node scripts/extract-pilar.mjs /path/to/lib-uii-gateway-pilar-angular

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(HERE, "..", "src", "lib", "vendors", "pilar");

// What to extract per component: showcase section dirs → snippet kind.
const EXTRACT = {
  "uii-table": {
    sections: ["kitchen-sink-table", "column-definitions", "table-with-checkbox", "table-with-action"],
    base: "src/app/showcase/components/doc-table/sections",
    module: "TableModule",
    pkg: "pilar",
  },
};

const argv = process.argv.slice(2);
const repo = argv[0];
if (!repo) {
  console.error("usage: node scripts/extract-pilar.mjs /path/to/lib-uii-gateway-pilar-angular");
  process.exit(2);
}

const pilarPkg = JSON.parse(readFileSync(join(repo, "package.json"), "utf8"));
const libPkgPath = join(repo, "projects", "uiigateway", "pilar", "package.json");
let versionPinned = pilarPkg.version;
try {
  versionPinned = JSON.parse(readFileSync(libPkgPath, "utf8")).version ?? pilarPkg.version;
} catch { /* fall back to app package version */ }

mkdirSync(OUT_DIR, { recursive: true });

const index = { source: "pilar", versionPinned, generatedFrom: repo, components: {} };

for (const [tag, spec] of Object.entries(EXTRACT)) {
  const files = [];
  for (const section of spec.sections) {
    const base = join(repo, spec.base, section);
    for (const ext of ["html", "ts"]) {
      // Showcase sections name files either "<dir>.component.ts" or "<dir>-table.component.ts".
      const candidates = [`${section}.component.${ext}`, `${section}-table.component.${ext}`];
      let src = null;
      for (const name of candidates) {
        try {
          src = readFileSync(join(base, name), "utf8");
          break;
        } catch { /* try next */ }
      }
      if (src === null) continue;
      const out = `${tag}--${section}.${ext}`;
      writeFileSync(join(OUT_DIR, out), trimSnippet(src, ext));
      files.push(out);
    }
  }
  index.components[tag] = { module: spec.module, pkg: spec.pkg, snippets: files };
}

// ngx-select idiom: pilar re-exports NgxSelectModule (ngx-select-ex) via pilar.module.ts,
// so the org's select idiom is <ngx-select> — not uii-dropdown. The canonical usage below
// is the form used across UII gateway apps (matches ngx-select-ex 8.x API + pilar re-export).
const ngxSelectHtml = `<ngx-select
  [items]="items"
  [(ngModel)]="selected"
  placeholder="Pilih..."
  [allowClear]="true"></ngx-select>`;
const ngxSelectTs = `// <ngx-select> comes from ngx-select-ex, re-exported by pilar's PilarModule
// (pilar.module.ts imports + exports NgxSelectModule) — import PilarModule or NgxSelectModule.
import { NgxSelectModule } from "ngx-select-ex";
// items: string[] or [{ id, text }] (optionTextField/optionValueField for objects):
// <ngx-select [items]="items" [optionTextField]="'name'" [optionValueField]="'value'">
// Style to match the design: the toggle is .ngx-select__toggle (::ng-deep shim may be needed).`;
writeFileSync(join(OUT_DIR, "ngx-select.html"), ngxSelectHtml);
writeFileSync(join(OUT_DIR, "ngx-select.ts"), ngxSelectTs);
index.components["ngx-select"] = { module: "NgxSelectModule", pkg: "pilar", snippets: ["ngx-select.html", "ngx-select.ts"] };

writeFileSync(join(OUT_DIR, "index.json"), JSON.stringify(index, null, 2) + "\n");
console.log(`extracted pilar@${versionPinned}: ${Object.keys(index.components).length} components → ${OUT_DIR}`);

/** Keep a showcase file verbatim but bounded (comments + leading whitespace trimmed). */
function trimSnippet(src, ext) {
  const lines = src.split("\n");
  const keep = [];
  let inDocComment = false;
  for (const line of lines) {
    if (inDocComment) {
      if (line.includes("*/")) inDocComment = false;
      continue;
    }
    if (ext === "ts" && /^\s*\/\*\*/.test(line) && !line.includes("*/")) {
      inDocComment = true;
      continue;
    }
    if (ext === "ts" && /^\s*\/\/|^import\s.*@angular\/core|^\s*constructor\(/.test(line) && /^import\s/.test(line) === false && /constructor/.test(line)) continue;
    keep.push(line);
    if (keep.length >= 60) break;
  }
  return keep.join("\n").trim() + "\n";
}
