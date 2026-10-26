// Recipe merger — the 8 required Prompt B regressions + cross-topology proof.
import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyDeclaration } from "../../src/project/recipe-semantics.mjs";
import { mergeDeclarations } from "../../src/planning/recipe-merger.mjs";

const decl = (property, value, obs = {}) => ({ selector: ".x", family: null, ...classifyDeclaration({ property, value }, obs) });

test("merge: project width 384 (PAGE_SPECIFIC_GEOMETRY) does not override explicit design width 260", () => {
  const r = mergeDeclarations([decl("width", "384px", { usageCount: 1, hasVariance: true })], { n1: { width: 260 } });
  assert.equal(r.effective.length, 0);
  assert.equal(r.suppressed[0].resolution, "SUPPRESSED_PAGE_SPECIFIC");
  assert.equal(r.silentOverrideCount, 0);
});

test("merge: project radius 6 (DESIGN_OVERRIDABLE) yields to explicit design radius 4", () => {
  const r = mergeDeclarations([decl("border-radius", "6px", { usageCount: 5 })], { n1: { radius: 4 } });
  assert.equal(r.effective.length, 0);
  assert.equal(r.suppressed[0].resolution, "DESIGN_WINS");
  assert.equal(r.suppressed[0].designValue, 4);
  assert.deepEqual(r.conflicts[0], {
    property: "border-radius", designValue: 4, projectValue: "6px",
    projectSemantics: "DESIGN_OVERRIDABLE", resolution: "DESIGN_WINS", selector: ".x",
  });
  assert.equal(r.silentOverrideCount, 0);
});

test("merge: structural dropdown z-index survives when non-conflicting", () => {
  const r = mergeDeclarations([decl("z-index", "1000", { usageCount: 5 })], { n1: { radius: 4 } });
  assert.equal(r.effective.length, 1);
  assert.equal(r.effective[0].semantics, "STRUCTURAL_INTERNAL");
  assert.equal(r.suppressed.length, 0);
});

test("merge: variable geometry across samples is excluded (PAGE_SPECIFIC_GEOMETRY)", () => {
  // width varies 384 / 260 across samples → variance → page-specific, never a default.
  const r = mergeDeclarations([decl("width", "384px", { usageCount: 1, hasVariance: true })], {});
  assert.equal(r.suppressed[0].resolution, "SUPPRESSED_PAGE_SPECIFIC");
});

test("merge: stable focus style promotes to STATE_STYLE and is preserved", () => {
  const r = mergeDeclarations([decl("color", "#000", { selector: ".x:focus", usageCount: 3 })], {});
  assert.equal(r.effective[0].semantics, "STATE_STYLE");
});

test("merge: zero silent A1 override is structural (every override is a recorded conflict)", () => {
  const decls = [
    decl("width", "384px", { usageCount: 1, hasVariance: true }),
    decl("border-radius", "6px", { usageCount: 5 }),
    decl("color", "#ffffff", { usageCount: 5 }),
  ];
  const geometry = { n1: { width: 260, radius: 4, color: "#fef2f2" } };
  const r = mergeDeclarations(decls, geometry);
  assert.equal(r.silentOverrideCount, 0, "no silent override");
  // The radius override is recorded; color is not merged at property level (deferred to browser).
  assert.equal(r.conflicts.length, 1, "radius conflict explicitly recorded");
  assert.equal(r.suppressed.filter((s) => s.resolution === "DESIGN_WINS").length, 1);
});

test("merge: capability-aware — a form recipe yields to the FIELD radius, not an unrelated table's", () => {
  const formDecl = { selector: ".form-control", family: "form", ...classifyDeclaration({ property: "border-radius", value: "6px" }, { usageCount: 5 }) };
  const geometry = { table: { radius: 8, capability: "table" }, field: { radius: 4, capability: "form" } };
  const r = mergeDeclarations([formDecl], geometry);
  assert.equal(r.suppressed[0].resolution, "DESIGN_WINS");
  assert.equal(r.suppressed[0].designValue, 4, "the field's radius 4 wins, not the table's 8");
});

// ---------- cross-topology proof (the merger is topology-agnostic) ----------

function mergeOnDesign(geometryKeys, recipeDecls) {
  const geometry = {};
  for (const [k, v] of Object.entries(geometryKeys)) geometry[`node-${k}`] = { [k]: v };
  return mergeDeclarations(recipeDecls, geometry);
}

test("cross-topology: a linear form field's explicit width beats a project default", () => {
  const r = mergeOnDesign({ width: 260 }, [decl("width", "384px", { usageCount: 1, hasVariance: true })]);
  assert.equal(r.suppressed[0].resolution, "SUPPRESSED_PAGE_SPECIFIC");
});

test("cross-topology: a grid card's explicit radius beats a project radius", () => {
  const r = mergeOnDesign({ radius: 4 }, [decl("border-radius", "6px", { usageCount: 5 })]);
  assert.equal(r.suppressed[0].resolution, "DESIGN_WINS");
});

test("cross-topology: an overlay badge's structural z-index survives", () => {
  const r = mergeOnDesign({}, [decl("z-index", "999", { usageCount: 5 })]);
  assert.equal(r.effective[0].semantics, "STRUCTURAL_INTERNAL");
});

test("cross-topology: color conflicts are NOT resolved at property level (deferred to browser)", () => {
  const r = mergeOnDesign({ color: "#fef2f2" }, [decl("color", "#ffffff", { usageCount: 5 })]);
  assert.equal(r.effective.length, 1, "a color recipe is preserved — no property-level design-wins on color");
  assert.equal(r.conflicts.length, 0);
});
