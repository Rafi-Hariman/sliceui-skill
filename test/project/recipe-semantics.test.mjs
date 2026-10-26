// Recipe semantics — property-level classification + portability scoring.
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseDeclarations, classifyDeclaration, mineRecipeDeclarations, countBySemantics } from "../../src/project/recipe-semantics.mjs";

test("parseDeclarations: splits a block body into property/value/important", () => {
  const decls = parseDeclarations(".x { width: 384px; border-radius: 6px !important; color: #fff }");
  assert.deepEqual(decls, [
    { property: "width", value: "384px", important: false },
    { property: "border-radius", value: "6px", important: true },
    { property: "color", value: "#fff", important: false },
  ]);
});

test("classify: variable geometry becomes PAGE_SPECIFIC_GEOMETRY", () => {
  const d = classifyDeclaration({ property: "width", value: "384px" }, { usageCount: 1, hasVariance: true });
  assert.equal(d.semantics, "PAGE_SPECIFIC_GEOMETRY");
});

test("classify: stable radius becomes DESIGN_OVERRIDABLE", () => {
  const d = classifyDeclaration({ property: "border-radius", value: "6px" }, { usageCount: 5 });
  assert.equal(d.semantics, "DESIGN_OVERRIDABLE");
});

test("classify: z-index becomes STRUCTURAL_INTERNAL", () => {
  const d = classifyDeclaration({ property: "z-index", value: "1000" }, { usageCount: 5 });
  assert.equal(d.semantics, "STRUCTURAL_INTERNAL");
});

test("classify: a focus selector becomes STATE_STYLE", () => {
  const d = classifyDeclaration({ property: "color", value: "#000" }, { selector: ".x:focus", usageCount: 3 });
  assert.equal(d.semantics, "STATE_STYLE");
});

test("classify: geometry with low usage and no variance stays UNVERIFIED_SAMPLE", () => {
  const d = classifyDeclaration({ property: "margin", value: "12px" }, { usageCount: 1, hasVariance: false });
  assert.equal(d.semantics, "UNVERIFIED_SAMPLE");
});

test("classify: width:100% on an internal fill wrapper is STRUCTURAL_INTERNAL (not page-specific)", () => {
  const d = classifyDeclaration({ property: "width", value: "100%" }, { usageCount: 1, libraryInternal: true, role: "form", selector: ".ngx-select .form-control" });
  assert.equal(d.semantics, "STRUCTURAL_INTERNAL");
});

test("classify: position:absolute on an overlay is STRUCTURAL_INTERNAL (not page-specific)", () => {
  const d = classifyDeclaration({ property: "position", value: "absolute" }, { usageCount: 1, role: "overlay", selector: ".floating-badge" });
  assert.equal(d.semantics, "STRUCTURAL_INTERNAL");
});

test("classify: top:0 on a portal is STRUCTURAL_INTERNAL (offset from responsibility)", () => {
  const d = classifyDeclaration({ property: "top", value: "0" }, { usageCount: 1, role: "portal", selector: ".dropdown-menu" });
  assert.equal(d.semantics, "STRUCTURAL_INTERNAL");
});

test("classify: portability tracks usage count (0.9 / 0.7 / 0.35)", () => {
  const hi = classifyDeclaration({ property: "color", value: "#fff" }, { usageCount: 5 });
  const mid = classifyDeclaration({ property: "color", value: "#fff" }, { usageCount: 2 });
  const lo = classifyDeclaration({ property: "color", value: "#fff" }, { usageCount: 1 });
  assert.equal(hi.portability, 0.9);
  assert.equal(mid.portability, 0.7);
  assert.equal(lo.portability, 0.35);
});

test("mineRecipeDeclarations: counts by semantics for the report", () => {
  const corpus = [
    { selector: ".a", family: "form", block: ".a { width: 384px; border-radius: 6px }", observations: { width: { count: 1, variance: true }, "border-radius": { count: 5 } } },
    { selector: ".b", family: "select", block: ".b { z-index: 1000 }", observations: { "z-index": { count: 5 } } },
  ];
  const decls = mineRecipeDeclarations(corpus);
  const counts = countBySemantics(decls);
  assert.equal(counts.PAGE_SPECIFIC_GEOMETRY, 1);
  assert.equal(counts.DESIGN_OVERRIDABLE, 1);
  assert.equal(counts.STRUCTURAL_INTERNAL, 1);
});
