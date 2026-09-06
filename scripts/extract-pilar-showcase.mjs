#!/usr/bin/env node
// extract-pilar-showcase — developer-side generator that scans the pilar demo app's showcase
// (src/app/showcase/components/) and emits src/framework/angular/pilar-showcase.mjs: the complete
// documentation + working usage examples for every pilar component, so a pilar-fingerprinted
// project installs with the FULL code playbook — API docs (selector + properties + events) plus
// every section's real markup/TypeScript/SCSS — WITHOUT the pilar repo being present.
//
//   node scripts/extract-pilar-showcase.mjs <path-to-pilar-repo>
//
// The showcase is the org's authoritative "how to use pilar" — 24 doc-* components plus
// get-started/installation/under-development. Each doc-* has:
//   - initializeMetaData()        → title + description
//   - initializeApiDocumentation()→ apiDocSection { selector, properties[], events[] }
//   - initializeSection()         → <name>Section[] with { anchor, title, desc, markup, typescript }
// The markup/typescript are raw-loader requires pointing at real section component files on disk;
// we resolve and read them (plus the co-located .scss) so nothing is lost.

import { readFileSync, readdirSync, writeFileSync, statSync, existsSync } from "node:fs";
import { join, resolve, relative, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { parse, buildImportMap } from "./lib/ts-ast-shared.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
// OUT can be overridden (tests re-run the extractor into a temp dir to diff against the
// checked-in snapshot — the dev-only source-diff round-trip test).
const OUT = process.env.SLICEUI_EXTRACT_OUT
  ? resolve(process.env.SLICEUI_EXTRACT_OUT)
  : resolve(__dirname, "../src/framework/angular/pilar-showcase.mjs");

function read(p) { return readFileSync(p, "utf8"); }
function exists(p) { return existsSync(p); }

/** Resolve the showcase components dir from a repo root. */
function resolveShowcaseDir(arg) {
  const p = resolve(arg);
  const candidates = [
    p,
    join(p, "src/app/showcase/components"),
    join(p, "projects/uiigateway/pilar/src/lib"), // (sanity — this is NOT the showcase)
  ];
  for (const c of candidates.slice(0, 2)) {
    if (existsSync(join(c, "doc-table"))) return c;
  }
  throw new Error(`Cannot find showcase components dir under ${p}`);
}

function dirsIn(p) {
  return readdirSync(p).filter((n) => {
    try { return statSync(join(p, n)).isDirectory(); } catch { return false; }
  });
}

/** String literal value of `this.<prop> = '…'` (regex — the metadata assignments are regular). */
function thisString(text, prop) {
  const re = new RegExp(`this\\.${prop}\\s*=\\s*['"\`]([\\s\\S]*?)['"\`]\\s*;?`);
  const m = re.exec(text);
  return m ? m[1] : null;
}

/** The apiDocSection object literal → { selector, properties, events } (all captured as JSON-safe). */
function extractApiDoc(text) {
  const sf = parse(text);
  let out = null;
  function objToJson(node) {
    const o = {};
    if (!node || !ts.isObjectLiteralExpression(node)) return o;
    for (const p of node.properties) {
      if (ts.isPropertyAssignment(p) && ts.isIdentifier(p.name)) {
        o[p.name.text] = literalOrJson(p.initializer);
      }
    }
    return o;
  }
  function literalOrJson(node) {
    if (!node) return null;
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
    if (ts.isNumericLiteral(node)) return Number(node.text);
    if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
    if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
    if (ts.isObjectLiteralExpression(node)) return objToJson(node);
    if (ts.isArrayLiteralExpression(node)) {
      return node.elements.map((e) => ts.isObjectLiteralExpression(e) ? objToJson(e) : literalOrJson(e));
    }
    return null;
  }
  function visit(node) {
    if (out) return;
    if (ts.isPropertyAssignment(node) && ts.isIdentifier(node.name) && node.name.text === "apiDocSection") {
      out = objToJson(node.initializer);
      return;
    }
    ts.forEachChild(node, visit);
  }
  visit(sf);
  return out;
}

// buildImportMap: shared from ./lib/ts-ast-shared.mjs

/**
 * The `<name>Section = [ … ]` array (field name varies: accordionSection, buttonSections,
 * gridSystem, pilarFont, sections, …). We match ANY object literal that has an `anchor` string,
 * a `title` string, and a non-null `component` identifier (the apiDocs entries have
 * `component: null`, so they are excluded). Each section's `markup`/`typescript` are either a
 * raw-loader path (read the file) or an inline string literal (kept verbatim). Returns ordered
 * { anchor, title, desc, component, html, ts, scss }.
 */
function extractSections(text, docDir) {
  const sf = parse(text);
  const importMap = buildImportMap(text, docDir);
  const sections = [];

  const strProp = (obj, key) => {
    for (const p of obj.properties) {
      if (ts.isPropertyAssignment(p) && ts.isIdentifier(p.name) && p.name.text === key && ts.isStringLiteral(p.initializer)) {
        return p.initializer.text;
      }
    }
    return null;
  };
  const propValue = (obj, key) => {
    for (const p of obj.properties) {
      if (ts.isPropertyAssignment(p) && ts.isIdentifier(p.name) && p.name.text === key) return p.initializer;
    }
    return null;
  };
  // A section entry: anchor + title strings, component a non-null identifier.
  const isSectionEntry = (obj) => {
    if (!obj.properties.some((p) => ts.isPropertyAssignment(p) && ts.isIdentifier(p.name) && p.name.text === "anchor" && ts.isStringLiteral(p.initializer))) return false;
    if (!obj.properties.some((p) => ts.isPropertyAssignment(p) && ts.isIdentifier(p.name) && p.name.text === "title" && ts.isStringLiteral(p.initializer))) return false;
    const comp = propValue(obj, "component");
    return comp && ts.isIdentifier(comp); // apiDocs entries have `component: null`
  };

  function visit(node) {
    if (ts.isObjectLiteralExpression(node) && isSectionEntry(node)) {
      const anchor = strProp(node, "anchor");
      const title = strProp(node, "title");
      const desc = strProp(node, "desc");
      const compName = propValue(node, "component").text;

      const markupVal = propValue(node, "markup");
      const tsVal = propValue(node, "typescript");

      let html = null, tsSrc = null, htmlAbs = null;
      // markup: raw-loader path → read .html; inline string → keep.
      if (markupVal && (ts.isStringLiteral(markupVal) || ts.isNoSubstitutionTemplateLiteral(markupVal))) {
        html = markupVal.text.trim();
      } else if (markupVal) {
        const p = rawLoaderPath(markupVal.getText(sf));
        htmlAbs = p ? resolveRequirePath(docDir, p) : null;
        html = htmlAbs && exists(htmlAbs) ? read(htmlAbs).trim() : null;
      }
      // typescript: raw-loader path → read .ts; inline string → keep.
      if (tsVal && (ts.isStringLiteral(tsVal) || ts.isNoSubstitutionTemplateLiteral(tsVal))) {
        tsSrc = tsVal.text.trim();
      } else if (tsVal) {
        const p = rawLoaderPath(tsVal.getText(sf));
        const abs = p ? resolveRequirePath(docDir, p) : null;
        tsSrc = abs && exists(abs) ? read(abs).trim() : null;
      }

      // The section component's own .ts — capture when `typescript` was an inline string (so the
      // real class body isn't lost).
      const compAbs = importMap[compName] ?? null;
      if (!tsSrc || tsSrc.includes("Does not require typescript")) {
        if (compAbs && exists(compAbs)) tsSrc = read(compAbs).trim();
      }

      // Co-located SCSS: from the resolved .html path, else the component .ts's sibling .html.
      const scssPath = coLocatedScss(htmlAbs) || coLocatedScss(compAbs ? compAbs.replace(/\.ts$/, ".html") : null);
      const scss = scssPath ? read(scssPath).trim() : null;

      sections.push({ anchor, title, desc, component: compName, html, ts: tsSrc, scss });
    }
    ts.forEachChild(node, visit);
  }
  visit(sf);
  return sections;
}

/** `require('!!raw-loader!./x/y.html')` → `./x/y.html` (or null). */
function rawLoaderPath(callText) {
  const m = /raw-loader!([^'")]+)/.exec(callText);
  return m ? m[1].trim() : null;
}

/** Resolve a require path (relative to doc dir) to an absolute path. `.component` (no .ts) → `.ts`. */
function resolveRequirePath(docDir, p) {
  if (!p) return null;
  let q = p;
  if (!q.endsWith(".html") && !q.endsWith(".ts")) q = q + ".ts";
  return join(docDir, q.replace(/^\.\//, ""));
}

/** Co-located SCSS for a section file (same base name, any .scss in the same dir). */
function coLocatedScss(htmlAbs) {
  if (!htmlAbs) return null;
  const dir = dirname(htmlAbs);
  const base = basename(htmlAbs).replace(/\.html$/, "");
  const candidates = [join(dir, base + ".scss"), join(dir, base + ".css")];
  for (const c of candidates) if (exists(c)) return c;
  // fallback: the only .scss in the dir (if exactly one).
  try {
    const scss = readdirSync(dir).filter((n) => n.endsWith(".scss") && !n.endsWith(".spec.scss"));
    if (scss.length === 1) return join(dir, scss[0]);
  } catch {}
  return null;
}

function walkFiles(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walkFiles(p, out);
    else if (/\.(ts|html|scss|css)$/.test(name) && !name.endsWith(".spec.ts")) out.push(p);
  }
  return out;
}

// Showcase dirs with no pilar usage examples (scaffolding/meta pages — zero sections with
// meaningful markup). Excluded so the catalog is purely a component playbook.
const NON_COMPONENT_DIRS = new Set(["get-started", "installation", "under-development"]);

function main() {
  const arg = process.argv[2];
  if (!arg) { console.error("usage: node scripts/extract-pilar-showcase.mjs <path-to-pilar-repo>"); process.exit(2); }
  const showcaseDir = resolveShowcaseDir(arg);

  const entries = [];
  const covered = new Set(); // absolute paths already captured as section content

  for (const name of dirsIn(showcaseDir).sort()) {
    if (NON_COMPONENT_DIRS.has(name)) continue;
    const docDir = join(showcaseDir, name);
    const mainTs = join(docDir, `${name}.component.ts`);
    if (!exists(mainTs)) continue;
    const text = read(mainTs);
    const title = thisString(text, "title") ?? name;
    const description = thisString(text, "description");
    const apiDoc = extractApiDoc(text);
    const sections = extractSections(text, docDir);

    // Any non-spec file in this doc dir that isn't a section component or the doc scaffolding
    // itself = an "extra" (e.g. doc-table/sections/sections.constant.ts).
    const importMap = buildImportMap(text, docDir);
    const sectionBases = new Set(
      sections
        .map((s) => importMap[s.component])
        .filter(Boolean)
        .map((p) => p.replace(/\.ts$/, ""))
    );
    const extras = [];
    for (const f of walkFiles(docDir)) {
      if (f === mainTs) continue; // the doc scaffolding component itself (metadata source)
      const base = f.replace(/\.(html|scss|css|ts)$/, "");
      // Skip the section components' own files (already captured as html/ts/scss content).
      if ([...sectionBases].some((sb) => base === sb || base.startsWith(sb + "."))) continue;
      // Skip the doc wrapper's own template/style (doc-<name>.component.{html,scss}).
      if (/doc-[a-z-]+\.component\.(html|scss|css)$/.test(relative(docDir, f))) continue;
      extras.push({ path: relative(docDir, f), text: read(f).trim() });
    }

    entries.push({
      id: name,
      selector: /selector:\s*['"]([^'"]+)['"]/.exec(text)?.[1] ?? null,
      title,
      description,
      apiDoc,
      sections,
      extras,
    });
  }

  const src = renderShowcase(entries, new Date().toISOString());
  writeFileSync(OUT, src);
  const sectionCount = entries.reduce((n, e) => n + e.sections.length, 0);
  const extraCount = entries.reduce((n, e) => n + e.extras.length, 0);
  console.log(`Wrote ${OUT}`);
  console.log(`  showcase docs: ${entries.length}  sections: ${sectionCount}  extras: ${extraCount}`);
}

function renderShowcase(entries, generatedAt) {
  const J = (v) => JSON.stringify(v, null, 2);
  return `// pilar-showcase.mjs — GENERATED by scripts/extract-pilar-showcase.mjs. Do not edit by hand.
// The pilar demo app's showcase (src/app/showcase/components/): documentation + working usage
// examples for every pilar component, captured verbatim so a pilar-fingerprinted project gets
// the FULL code playbook without the pilar repo. Regenerate after a pilar change:
//   node scripts/extract-pilar-showcase.mjs <path-to-pilar-repo>
// Generated at: ${generatedAt}

/** Ordered by directory. Each entry: id, selector, title, description, apiDoc (selector +
 *  properties/events), sections[] ({ anchor, title, desc, html, ts, scss }), extras[] (any
 *  supporting file not part of a section). */
export const PILAR_SHOWCASE = ${J(entries)};
`;
}

main();
