import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSpec } from "../src/commands/spec.mjs";

const CONVENTIONS = {
  ngDeepCorpus: [
    { selector: "ngx-select__choices", family: "select", reusable: true, block: "::ng-deep .ngx-select__choices { border-radius: 7px; }" },
    { selector: "label-custom-success", family: "label", reusable: true, block: ":host ::ng-deep .label-custom-success { background: #dcf5ef; }" },
    // A component-specific block must NOT be copied verbatim.
    { selector: "custom-select .ngx-select__toggle-caret", family: "select", reusable: false, block: ":host ::ng-deep .custom-select .ngx-select__toggle-caret { display: none; }" },
  ],
  classVocabulary: [{ name: "label-custom-success", family: "label-custom" }],
};

/** A transcript with a badge (status idiom) + a glyph-as-text (icon idiom). */
function transcript() {
  return {
    version: 3,
    meta: { source: "figml", tier: 0, image: "design.xml", width: 400, height: 300, textQuality: "exact" },
    tokens: { colors: [], fonts: [] },
    layout: [
      { id: "title", type: "text", text: "Daftar", style: { size: 16, weight: 500, color: "#000000" } },
      { id: "badge", type: "group", bg: "#fef2f2", children: [
        { id: "ic", type: "icon", bg: "#f44444" },
        { id: "tx", type: "text", text: "Dibatalkan" },
      ] },
      { id: "tgl", type: "text", text: "", glyphName: "Icon_Font_Awesome_Free_Solid_T_toggle-on", style: { color: "#03337b" } },
    ],
    images: [],
    icons: [],
  };
}

test("spec: includes every transcript node id in document order", () => {
  const s = buildSpec(transcript(), CONVENTIONS);
  for (const id of ["title", "badge", "ic", "tx", "tgl"]) {
    assert.ok(s.includes(`#${id}`), `element ${id} present`);
  }
  assert.ok(s.indexOf("#title") < s.indexOf("#badge"), "document order preserved");
});

test("spec: resolved idioms are inline and honest (no invented idiom)", () => {
  const s = buildSpec(transcript(), CONVENTIONS);
  // The toggle glyph resolves from its name (not the #03337b family).
  assert.match(s, /#tgl[\s\S]*fa-toggle-on/, "toggle glyph resolves fa-toggle-on inline");
  // The badge resolves a label-custom-* (status text or co-occurrence), never a bare color guess.
  assert.match(s, /#badge[\s\S]*→/, "badge carries an idiom");
  // No invented idiom string ever appears.
  assert.ok(!s.includes("fa-search"), "the ambiguous #03337b family is NOT emitted for the named glyph");
});

test("spec: copies only reusable corpus blocks verbatim", () => {
  const s = buildSpec(transcript(), CONVENTIONS);
  // The design has NO select or table, so the select-family block is pruned (P0-4)…
  assert.ok(!s.includes("ngx-select__choices"), "select-family block pruned when the design has no select");
  // …but the label/status block is kept: its family is not uniquely derivable from the transcript,
  // so it is never dropped on a guess.
  assert.ok(s.includes("label-custom-success"), "label/status block kept (not prunable)");
  assert.ok(!s.includes("custom-select .ngx-select__toggle-caret"), "component-specific block excluded");
});

test("spec: P0-4 — prunes select/table corpus to the design's actual capabilities", () => {
  // A design WITH a select keeps the select block; one WITHOUT drops it. A table-marked design
  // keeps the table block. This is the design-driven pruning the context budget depends on.
  const withSelect = {
    ...transcript(),
    layout: [...transcript().layout, { id: "f", type: "input", label: "NIM" }],
  };
  assert.ok(buildSpec(withSelect, CONVENTIONS).includes("ngx-select__choices"),
    "select block kept when a select is in play");

  const bare = transcript();
  assert.ok(!buildSpec(bare, CONVENTIONS).includes("ngx-select__choices"),
    "select block pruned when no select is in play");
});

test("spec: carries the layout recipe (N+button flex, grid sum ≤ 12)", () => {
  const s = buildSpec(transcript(), CONVENTIONS);
  assert.match(s, /flex:1 1 0/, "N-field flex recipe present");
  assert.match(s, /≤ 12/, "grid sum rule present");
});

test("spec: F9 — inline geometry [x,y w×h] and a divider inset verdict", () => {
  const t = {
    version: 3,
    meta: { source: "figml", tier: 0, image: "design.xml", width: 800, height: 300, textQuality: "exact" },
    tokens: { colors: [], fonts: [] },
    layout: [
      { id: "hdr", type: "group", x: 0, y: 0, w: 800, h: 60, children: [
        { id: "div", type: "divider", x: 20, y: 55, w: 760, h: 1, bg: "#fbc02d" },
      ] },
    ],
    images: [], icons: [],
  };
  const s = buildSpec(t, CONVENTIONS);
  assert.match(s, /#div[^\n]*\[20,55 760×1\]/, "geometry [x,y w×h] is inline for the divider");
  assert.match(s, /divider#div: INSET 20px/, "divider inset verdict is emitted (not full-width)");
});
