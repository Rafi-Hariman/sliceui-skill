import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyCheck, listCheckLayers, renderCheckLayers, LAYERS } from "../src/framework/angular/check-layers.mjs";
import { buildVerifyArgv, parseCheckArgs } from "../src/commands/check.mjs";

// The 32 checks the verify engine actually emits (enumerated from verify.mjs). A new check that
// is not classified returns null — this list is the regression net that keeps the layer contract
// complete.
const ALL_CHECKS = [
  "alignmentViaDeepCss", "anatomy", "buttonOrder", "classVocabulary", "containerPadding",
  "deadCode", "declaredInModule", "filterRowButton", "frameworkSyntax", "gridColumns",
  "iconColor", "inventedLayout", "inventedUtility", "libraryTable", "loadedClass",
  "mockRowCount", "modalWrapper", "ngxSelectBinding", "noBareNgDeep", "noHashedSelectors",
  "noTranslation", "phantomWrapper", "pilarBindings", "pilarInjection", "requiredMarker",
  "rowAuth", "scssCompiles", "scssCoverage", "styleFidelity", "tableBindings",
  "tableOptions", "textCoverage",
];

test("check-layers: every emitted check is classified (no orphan)", () => {
  for (const name of ALL_CHECKS) {
    assert.ok(LAYERS.includes(classifyCheck(name)), `${name} has a valid layer`);
  }
  const grouped = listCheckLayers();
  const total = Object.values(grouped).reduce((n, list) => n + list.length, 0);
  assert.equal(total, ALL_CHECKS.length, "classification covers exactly the emitted checks");
  assert.deepEqual(
    Object.values(grouped).flat().sort(),
    [...ALL_CHECKS].sort(),
    "no check classified twice or missing",
  );
});

test("check-layers: doc §12 example classifications hold", () => {
  assert.equal(classifyCheck("textCoverage"), "design");
  assert.equal(classifyCheck("styleFidelity"), "design");
  assert.equal(classifyCheck("phantomWrapper"), "design");
  assert.equal(classifyCheck("scssCompiles"), "framework");
  assert.equal(classifyCheck("declaredInModule"), "framework");
  assert.equal(classifyCheck("libraryTable"), "project");
  assert.equal(classifyCheck("ngxSelectBinding"), "project");
  assert.equal(classifyCheck("pilarBindings"), "policy");
  assert.equal(classifyCheck("rowAuth"), "policy");
  assert.equal(classifyCheck("pilarInjection"), "policy");
  assert.equal(classifyCheck("mockRowCount"), "policy");
});

test("check-layers: render is a backstop, not a check layer", () => {
  const md = renderCheckLayers();
  assert.ok(md.includes("## design"), "design layer present");
  assert.ok(md.includes("## framework"), "framework layer present");
  assert.ok(md.includes("## project"), "project layer present");
  assert.ok(md.includes("## policy"), "policy layer present");
  assert.ok(md.includes("render (backstop, not a layer)"), "render is not a layer");
  assert.ok(!LAYERS.includes("render"), "LAYERS has no render entry");
});

test("check: maps <target> [design] onto verify argv", () => {
  assert.deepEqual(buildVerifyArgv("src/app", null), ["src/app"]);
  assert.deepEqual(buildVerifyArgv("src/app", "student-list"), ["src/app", "student-list"]);
  assert.deepEqual(buildVerifyArgv("src/app", "design.xml"), ["src/app", "--xml", "design.xml"]);
  assert.deepEqual(buildVerifyArgv("src/app", "design.figml"), ["src/app", "--xml", "design.figml"]);
  assert.deepEqual(buildVerifyArgv("src/app", "t.json"), ["src/app", "--transcript", "t.json"]);
  assert.deepEqual(buildVerifyArgv("src/app", null, ["--render"]), ["src/app", "--render"]);
});

test("check: parses --layers and value flags without reordering", () => {
  const r = parseCheckArgs(["src/app", "design.xml", "--layers", "--viewport", "1440x900"]);
  assert.equal(r.target, "src/app");
  assert.equal(r.design, "design.xml");
  assert.equal(r.layers, true);
  assert.deepEqual(r.passthrough, ["--viewport", "1440x900"]);

  const r2 = parseCheckArgs(["src/app", "--xml=design.xml"]);
  assert.equal(r2.target, "src/app");
  assert.equal(r2.design, null);
  assert.deepEqual(r2.passthrough, ["--xml=design.xml"]);
});
