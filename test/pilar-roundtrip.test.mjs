// Round-trip correctness — the council's "one thing first".
//
// The 214 existing tests prove the pilar catalogs are SELF-consistent (shape, gating, counts).
// They never prove the product claim: that the extracted data is CORRECT pilar API. These tests
// close that gap from two directions:
//
//   1. modelCompiles — concatenate every PILAR_MODELS[].text and compile it with the real
//      TypeScript compiler (noEmit). If the AST round-trip mangled a type, or a model references
//      a type pilar exports but the catalog missed (the CssStyle gap the council predicted),
//      this is red. This is the "snapshot masquerading as truth" check.
//   2. bindingContract — every [input]/(output) the sliceui samples teach (UII_REGISTRY_ENTRIES
//      sampleHtml + the doc-table/doc-pagination showcase examples) must exist in the catalog's
//      declared @Input/@Output surface. A sample teaching a binding the catalog doesn't declare
//      (or the catalog missing one pilar declares) is a silent defect this catches.
//   3. sourceDiff (dev-only) — when PILAR_CHECKOUT env points at a pilar checkout (developer
//      machine only; CI has no access to the private repo), re-run the extractor into a temp
//      dir and diff against the checked-in catalog. Drift or extractor regression = red.
//      Without the env: skip with a clear message (honest, not silently green).

import { test } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync, readFileSync, mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import {
  PILAR_MODELS,
  PILAR_COMPONENTS,
  PILAR_VERSION,
} from "../src/framework/angular/pilar-catalog.mjs";
import { PILAR_SHOWCASE } from "../src/framework/angular/pilar-showcase.mjs";
import { UII_REGISTRY_ENTRIES } from "../src/framework/angular/uii-profile.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));

// ---------- 1. modelCompiles ----------

test("roundtrip: every extracted model compiles as valid TypeScript (AST round-trip fidelity)", () => {
  // Angular/@angular-free compile: the models may import types from pilar's own surface
  // (CssStyle) — prelude every catalog model name so cross-references resolve within the file.
  const known = new Set(PILAR_MODELS.map((m) => m.name));
  const decls = PILAR_MODELS.map((m) => m.text).join("\n\n");
  // Type-only prelude for any identifier the models reference but pilar defines elsewhere.
  // Everything unresolved that is NOT an Angular/primitive lands here and gets declared `any`
  // UNLESS the catalog should carry it (asserted separately below) — this keeps the compile
  // check about SYNTAX fidelity, while the closure test below is about COVERAGE.
  const refs = new Set();
  for (const m of PILAR_MODELS) {
    for (const r of m.text.matchAll(/:\s*([A-Z][A-Za-z0-9_<>,\s|[\]]*)/g)) {
      for (const id of r[1].matchAll(/\b([A-Z][A-Za-z0-9]*)\b/g)) {
        if (!known.has(id[1])) refs.add(id[1]);
      }
    }
  }
  const primitives = new Set(["Array", "Object", "Map", "String", "Number", "Boolean", "T"]);
  const unresolved = [...refs].filter((r) => !primitives.has(r));

  const prelude = unresolved.map((r) => `type ${r} = any; // stub: defined in pilar but not cataloged`).join("\n");
  const source = `${prelude}\n${decls}\n`;
  const sf = ts.createSourceFile("models.ts", source, ts.ScriptTarget.Latest, true);
  // Parse-level diagnostics = syntax fidelity of the extracted text itself.
  const parseDiags = sf.parseDiagnostics ?? [];
  assert.equal(
    parseDiags.length, 0,
    `extracted model text has syntax errors: ${parseDiags.slice(0, 3).map((d) => ts.flattenDiagnosticMessageText(d.messageText, " ")).join("; ")}`,
  );

  // Full type-check compile (noEmit) — cross-model references must resolve.
  const tmp = mkdtempSync(join(tmpdir(), "sliceui-rt-"));
  const file = join(tmp, "models.ts");
  writeFileSync(file, source);
  const program = ts.createProgram([file], {
    noEmit: true,
    strict: false,
    skipLibCheck: true,
    target: ts.ScriptTarget.ES2020,
    types: [],
  });
  const diags = ts.getPreEmitDiagnostics(program).filter((d) => d.file);
  rmSync(tmp, { recursive: true, force: true });
  assert.equal(
    diags.length, 0,
    `extracted models do not compile: ${diags.slice(0, 3).map((d) => ts.flattenDiagnosticMessageText(d.messageText, " ")).join("; ")}`,
  );
});

test("roundtrip: model dependency closure — every referenced pilar type is cataloged (the CssStyle gap)", () => {
  // A model text referencing `CssStyle` while CssStyle is absent from PILAR_MODELS means the
  // playbook is a PARTIAL: an agent copying ModalOptions cannot resolve `class?: CssStyle`.
  // pilar's public_api exports these lib-root files; the extractor must capture their types.
  // Allowed escapes: JS/Angular primitives and generic parameters.
  const known = new Set(PILAR_MODELS.map((m) => m.name));
  const primitives = new Set(["Array", "Object", "Map", "String", "Number", "Boolean", "T"]);
  const missing = new Set();
  for (const m of PILAR_MODELS) {
    for (const r of m.text.matchAll(/:\s*([A-Z][A-Za-z0-9_<>,\s|[\]]*)/g)) {
      for (const id of r[1].matchAll(/\b([A-Z][A-Za-z0-9]*)\b/g)) {
        if (!known.has(id[1]) && !primitives.has(id[1])) missing.add(id[1]);
      }
    }
  }
  assert.deepEqual(
    [...missing].sort(), [],
    `models reference pilar types missing from the catalog: ${[...missing].join(", ")} — extend the extractor (lib-root files: pilar.model.ts, pilar.constant.ts) and regenerate`,
  );
});

// ---------- 2. bindingContract ----------

/** Component lookup by selector (exact, first match). */
function component(selector) {
  return PILAR_COMPONENTS.find((c) => c.selector === selector);
}

/** All [input] names in an html snippet. */
function boundInputs(html) {
  return [...String(html).matchAll(/\[(\w+)\]/g)].map((m) => m[1]);
}
/** All (output)= names in an html snippet. */
function boundOutputs(html) {
  return [...String(html).matchAll(/\((\w+)\)\s*=/g)].map((m) => m[1]);
}

/** One contract assertion: every binding the html teaches must be declared by the catalog. */
function assertBindingsTeachDeclared(html, origin, problems) {
  // Find the FIRST uii-* element in the snippet and check its own bindings. A snippet may
  // contain several (a table + a pagination); walk every element.
  for (const m of String(html).matchAll(/<(uii-[a-z-]+)[^>]*>/gi)) {
    const tag = m[0];
    const selector = m[1].toLowerCase();
    // The skeleton must not be confused with the table (excluded in verify the same way).
    if (selector === "uii-table-skeleton") continue;
    const comp = component(selector);
    if (!comp) {
      problems.push(`${origin}: <${selector}> not in catalog`);
      continue;
    }
    const declaredIn = new Set(comp.inputs.map((i) => i.name));
    const declaredOut = new Set(comp.outputs.map((o) => o.name));
    for (const b of boundInputs(tag)) {
      if (!declaredIn.has(b)) problems.push(`${origin}: <${selector}> teaches [${b}] but catalog does not declare it`);
    }
    for (const o of boundOutputs(tag)) {
      if (!declaredOut.has(o)) problems.push(`${origin}: <${selector}> teaches (${o}) but catalog does not declare it`);
    }
  }
}

test("roundtrip: registry sample bindings all declared by the catalog (binding contract)", () => {
  const problems = [];
  for (const [category, entries] of Object.entries(UII_REGISTRY_ENTRIES)) {
    for (const entry of entries) {
      if (!entry.package || entry.package !== "pilar") continue;
      assertBindingsTeachDeclared(entry.sampleHtml, `registry:${category}:${entry.name}`, problems);
    }
  }
  assert.deepEqual(problems, [], problems.join("\n"));
});

test("roundtrip: showcase example bindings all declared by the catalog (binding contract)", () => {
  const problems = [];
  const relevant = PILAR_SHOWCASE.filter((e) => ["doc-table", "doc-pagination", "doc-switch", "doc-dropdown"].includes(e.id));
  assert.ok(relevant.length >= 4, "the four showcase fixtures are present");
  for (const entry of relevant) {
    for (const s of entry.sections) {
      if (!s.html) continue;
      assertBindingsTeachDeclared(s.html, `showcase:${entry.id}:${s.anchor ?? s.title}`, problems);
    }
  }
  assert.deepEqual(problems, [], problems.join("\n"));
});

test("roundtrip: catalog uii-table surface ⊇ verify's legal binding set", () => {
  // verify.mjs derives LEGAL_TABLE_BINDINGS from the catalog at import time. This test pins
  // the contract from the other side: the specific bindings the verify gate and SKILL.md teach
  // (rows/columns/action*/checkbox/search/limit/pagination) must exist in the catalog — so a
  // catalog regen that silently drops one turns verify's legal set hollow.
  const table = component("uii-table");
  assert.ok(table, "uii-table in catalog");
  const declared = new Set(table.inputs.map((i) => i.name));
  for (const b of ["rows", "columns", "actionColumn", "actionTitle", "checkboxColumn", "paginationOptions", "searchOptions", "limitOptions", "selectedLimit", "serverMode"]) {
    assert.ok(declared.has(b), `uii-table must declare [${b}]`);
  }
  const declaredOut = new Set(table.outputs.map((o) => o.name));
  for (const o of ["editClicked", "deleteClicked", "detailClicked", "pageChanged", "searchChanged"]) {
    assert.ok(declaredOut.has(o), `uii-table must declare (${o})`);
  }
});

// ---------- 3. sourceDiff (dev-only) ----------

test("roundtrip: checked-in catalog matches a fresh extraction from PILAR_CHECKOUT (dev-only)", { skip: !process.env.PILAR_CHECKOUT }, () => {
  const checkout = process.env.PILAR_CHECKOUT;
  assert.ok(existsSync(checkout), `PILAR_CHECKOUT does not exist: ${checkout}`);
  // Re-run BOTH extractors with OUT redirected to a temp dir, then diff against the checked-in
  // catalogs. Any diff = the snapshot is stale or the extractor regressed.
  const tmp = mkdtempSync(join(tmpdir(), "sliceui-diff-"));
  try {
    const scripts = join(HERE, "..", "scripts");
    runExtractor(join(scripts, "extract-pilar.mjs"), checkout, join(tmp, "pilar-catalog.mjs"));
    runExtractor(join(scripts, "extract-pilar-showcase.mjs"), checkout, join(tmp, "pilar-showcase.mjs"));

    const freshCatalog = readFileSync2(join(tmp, "pilar-catalog.mjs"));
    const freshShowcase = readFileSync2(join(tmp, "pilar-showcase.mjs"));
    const checkedCatalog = readFileSync2(join(HERE, "..", "src", "framework", "angular", "pilar-catalog.mjs"));
    const checkedShowcase = readFileSync2(join(HERE, "..", "src", "framework", "angular", "pilar-showcase.mjs"));

    // Normalize away machine/time-specific header lines: the absolute source path and the
    // generatedAt timestamp (both differ between the checked-in snapshot and a fresh run).
    const norm = (s) => s.replace(/^\/\/ Source: .*$/m, "").replace(/^\/\/ Generated at: .*$/m, "");
    assert.equal(norm(freshCatalog), norm(checkedCatalog),
      `checked-in pilar-catalog.mjs differs from a fresh extraction of ${checkout} — regenerate: node scripts/extract-pilar.mjs ${checkout}`);
    assert.equal(norm(freshShowcase), norm(checkedShowcase),
      `checked-in pilar-showcase.mjs differs from a fresh extraction of ${checkout} — regenerate: node scripts/extract-pilar-showcase.mjs ${checkout}`);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("roundtrip: catalog carries a version and it is a plausible pilar semver", () => {
  assert.match(String(PILAR_VERSION), /^\d+\.\d+\.\d+$/, "PILAR_VERSION must be exact semver (x.y.z), not a range or null");
});

/** Run an extractor script with its OUT overridden to a temp path. */
function runExtractor(scriptPath, checkoutArg, outPath) {
  // The extractors hardcode OUT relative to the script; support an override env so this test
  // never writes over the checked-in catalog. (Extractor reads SLICEUI_EXTRACT_OUT.)
  execFileSync(process.execPath, [scriptPath, checkoutArg], {
    env: { ...process.env, SLICEUI_EXTRACT_OUT: outPath },
    stdio: "pipe",
  });
}

function readFileSync2(p) {
  return readFileSync(p, "utf8");
}
