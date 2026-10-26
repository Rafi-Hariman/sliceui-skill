import { test } from "node:test";
import assert from "node:assert/strict";
import {
  deriveFeatures,
  resolveRecipes,
  resolveDesign,
  detectConflicts,
  rejectedSelectorSet,
  selectorRejected,
  splitBlockByResponsibility,
  isRejectedRecipe,
} from "../src/lib/design-resolution.mjs";

const CONVENTIONS = {
  ngDeepCorpus: [
    { selector: "ngx-select__choices", family: "select", reusable: true, block: "::ng-deep .ngx-select__choices { border-radius: 7px; }" },
    { selector: "ugw-pagination-container li.page-box", family: "table", reusable: true, block: ":host ::ng-deep .ugw-pagination-container li.page-box { font-weight: bold; }" },
    { selector: "label-custom-success", family: "label", reusable: true, block: ":host ::ng-deep .label-custom-success { background: #dcf5ef; }" },
    { selector: "checkbox-only-selector", family: "checkbox", reusable: true, block: "::ng-deep .checkbox-only-selector { display: none; }" },
    // component-specific (non-reusable) — never selected
    { selector: "custom .ngx-select__toggle-caret", family: "select", reusable: false, block: ":host ::ng-deep .custom .ngx-select__toggle-caret { display: none; }" },
  ],
  classVocabulary: [],
};

function tableNoBadge() {
  return {
    meta: { image: "d.xml" },
    layout: [
      { id: "tbl", type: "group", table: true },
      { id: "sel", type: "input", label: "Pilih", children: [{ id: "caret", type: "icon", description: "caret-down" }] },
    ],
  };
}

test("deriveFeatures: table/select present, status badge from resolved groups", () => {
  const f = deriveFeatures(tableNoBadge(), []);
  assert.equal(f.table.present, true, "table flagged");
  assert.equal(f.select.present, true, "input + icon child = select");
  assert.equal(f.table.statusBadge, false, "no badge without a status group");
  assert.equal(f.table.checkbox, false, "no checkbox");

  const withBadge = deriveFeatures(tableNoBadge(), [{ kind: "status" }]);
  assert.equal(withBadge.table.statusBadge, true, "status group → badge feature");
});

test("resolveRecipes: feature-level pruning — no badge → no label recipes, no checkbox → no checkbox recipes", () => {
  const f = deriveFeatures(tableNoBadge(), []);
  const recipes = resolveRecipes(CONVENTIONS, f, []);
  const sels = recipes.map((r) => r.selector);
  assert.ok(sels.includes("ngx-select__choices"), "select recipe selected");
  assert.ok(sels.includes("ugw-pagination-container li.page-box"), "table recipe selected");
  assert.ok(!sels.includes("label-custom-success"), "label recipe pruned (no badge)");
  assert.ok(!sels.includes("checkbox-only-selector"), "checkbox recipe pruned (no checkbox)");
  assert.ok(!sels.includes("custom .ngx-select__toggle-caret"), "non-reusable never selected");

  // A badge feature selects the label recipe.
  const withBadge = deriveFeatures(tableNoBadge(), [{ kind: "status" }]);
  const r2 = resolveRecipes(CONVENTIONS, withBadge, []);
  assert.ok(r2.some((r) => r.selector === "label-custom-success" && r.state === "required"), "badge → label recipe required");
});

test("resolveRecipes: rejected alignment recipe is not required (G3)", () => {
  const corpus = [
    { selector: ".table-footer", family: "table", reusable: true, block: "::ng-deep .table-footer { justify-content: flex-end; }" },
    { selector: ".ugw-pagination-container li.page-box", family: "table", reusable: true, block: "::ng-deep .ugw-pagination-container li.page-box { font-weight: bold; }" },
  ];
  const features = { table: { present: true } };
  const behaviorBindings = [{ rejectedSelectors: [".table-footer", ".ugw-pagination-container"] }];
  const recipes = resolveRecipes({ ngDeepCorpus: corpus }, features, behaviorBindings);
  const footer = recipes.find((r) => r.selector === ".table-footer");
  assert.equal(footer.state, "rejected", "alignment block is rejected");
  // The visual li.page-box block (a descendant of the rejected container) is NOT rejected.
  const pageBox = recipes.find((r) => r.selector === ".ugw-pagination-container li.page-box");
  assert.equal(pageBox.state, "required", "visual descendant block is still required");
});

test("selectorRejected: precise element-level matching, not descendant over-match", () => {
  const rejected = rejectedSelectorSet([{ rejectedSelectors: [".ugw-pagination-container"] }]);
  assert.equal(selectorRejected(".ugw-pagination-container", rejected), true);
  assert.equal(selectorRejected(".ugw-pagination-container li.page-box", rejected), false, "descendant selector not over-rejected");
});

test("splitBlockByResponsibility: separates alignment behavior from visual styling", () => {
  const { alignment, visual } = splitBlockByResponsibility("justify-content: flex-end; border-bottom: 1px solid #ccc; color: #222;");
  assert.deepEqual(alignment, ["justify-content: flex-end"]);
  assert.deepEqual(visual, ["border-bottom: 1px solid #ccc", "color: #222"]);
});

test("isRejectedRecipe: alignment-only block rejected; mixed block keeps visual responsibility", () => {
  const rejected = rejectedSelectorSet([{ rejectedSelectors: [".table-footer"] }]);
  assert.equal(isRejectedRecipe(".table-footer", "justify-content: flex-end;", rejected), true, "alignment-only block is rejected");
  assert.equal(isRejectedRecipe(".table-footer", "justify-content: flex-end; border-bottom: 1px solid #ccc;", rejected), false, "mixed block keeps visual responsibility (not rejected)");
});

test("detectConflicts: design 6px vs recipe 7px → conflict; same value → none; no evidence → none", () => {
  const recipes = [{ selector: ".ngx-select__choices", family: "select", state: "required", block: "::ng-deep .ngx-select__choices { border-radius: 7px; }" }];
  const t = { layout: [{ id: "sel", type: "input", radius: 6, children: [{ id: "c", type: "icon", description: "caret-down" }] }] };

  const c = detectConflicts(t, recipes, {});
  assert.equal(c.length, 1, "conflict surfaced");
  assert.equal(c[0].design, 6);
  assert.equal(c[0].recipe, 7);
  assert.equal(c[0].resolution, "design wins");

  // Same value → no conflict.
  const same = { layout: [{ id: "sel", type: "input", radius: 7, children: [{ id: "c", type: "icon", description: "caret-down" }] }] };
  assert.equal(detectConflicts(same, recipes, {}).length, 0, "same value is not a conflict");

  // No design radius evidence → no fabricated conflict.
  const noRadius = { layout: [{ id: "sel", type: "input" }] };
  assert.equal(detectConflicts(noRadius, recipes, {}).length, 0, "no design evidence → no conflict");
});

test("resolveDesign: one canonical result carries features + recipes + conflicts", () => {
  const t = {
    meta: { image: "d.xml" },
    layout: [
      { id: "tbl", type: "group", table: true },
      { id: "sel", type: "input", radius: 6, children: [{ id: "caret", type: "icon", description: "caret-down" }] },
    ],
  };
  const r = resolveDesign(t, CONVENTIONS, null);
  assert.ok(r.features.table.present, "feature set present");
  assert.ok(r.recipes.some((x) => x.selector === "ngx-select__choices"), "recipes present");
  assert.ok(r.conflicts.some((x) => x.property === "border-radius" && x.design === 6 && x.recipe === 7), "radius conflict detected");
  assert.ok(Array.isArray(r.groups), "groups present");
});

test("visibility: hidden design layers do not enter resolution mappings", () => {
  const t = {
    meta: { image: "d.xml" },
    layout: [
      { id: "hidden-icon", type: "icon", bg: "#03337b", hidden: true, description: "Icon_upload" },
      { id: "visible-icon", type: "icon", bg: "#03337b", description: "Icon_Font_Awesome_Free_Solid_C_caret-down" },
    ],
  };
  const r = resolveDesign(t, { ngDeepCorpus: [], classVocabulary: [] }, null);
  const ids = r.groups.flatMap((g) => g.ids ?? [g.id]);
  assert.ok(ids.includes("visible-icon"), "visible icon resolves");
  assert.ok(!ids.includes("hidden-icon"), "hidden icon does not enter the agent decision surface");
});

test("detectConflicts: per-node semantic correspondence (no family-value leakage)", () => {
  const recipes = [
    { selector: ".gateway-table", family: "table", state: "required", block: "::ng-deep .gateway-table { border-radius: 6px; }" },
    { selector: ".search-options input", family: "table", state: "required", block: "::ng-deep .search-options input { border-radius: 8px; }" },
    { selector: ".ngx-select__toggle", family: "select", state: "required", block: "::ng-deep .ngx-select__toggle { border-radius: 7px; }" },
  ];
  const t = {
    meta: { image: "d.xml" },
    layout: [
      { id: "tbl", type: "group", table: true, radius: 4 },
      { id: "sel", type: "input", radius: 5, children: [{ id: "c", type: "icon", description: "caret-down" }] },
    ],
  };
  const conflicts = detectConflicts(t, recipes, {});
  assert.ok(conflicts.some((c) => c.nodeId === "tbl" && c.selector === ".gateway-table" && c.design === 4 && c.recipe === 6), "table container conflict detected");
  assert.ok(!conflicts.some((c) => c.nodeId === "tbl" && c.selector.includes("search")), "table container NOT compared to search-input recipe");
  assert.ok(conflicts.some((c) => c.nodeId === "sel" && c.design === 5 && c.recipe === 7), "select conflict detected");
});
