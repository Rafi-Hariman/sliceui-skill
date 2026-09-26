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

// --- PR 4: facts vs hints rendering + behavior bindings ---

test("PR4 spec: corpus co-occurrence idiom renders as a labelled hint, not a bare fact", () => {
  // A status resolved purely by co-occurrence (medium) must carry the hint label. This corpus
  // pairs label-custom-waiting with the red exclamation icon, as the real project's does.
  const conventions = {
    ...CONVENTIONS,
    ngDeepCorpus: [
      ...CONVENTIONS.ngDeepCorpus,
      { selector: "label-custom-waiting .fa-exclamation-circle", block: "::ng-deep .label-custom-waiting .fa-exclamation-circle { color: #f44444; }" },
    ],
  };
  const t = {
    version: 3,
    meta: { source: "figml", tier: 0, image: "design.xml", width: 400, height: 300, textQuality: "exact" },
    tokens: { colors: [], fonts: [] },
    layout: [
      { id: "badge", type: "group", bg: "#fef2f2", children: [
        { id: "ic", type: "icon", bg: "#f44444" },
      ] },
    ],
    images: [], icons: [],
  };
  const s = buildSpec(t, conventions);
  assert.match(s, /hint\(medium\): label-custom-waiting \+ fa-exclamation-circle/, "co-occurrence label rendered as hint(medium)");
  assert.match(s, /Resolved idioms \(project mappings — NOT design facts\)/, "section header states these are mappings");
});

test("PR4 spec: behavior binding section names the API and the rejected CSS", () => {
  const t = {
    version: 3,
    meta: { source: "figml", tier: 0, image: "design.xml", width: 800, height: 600, textQuality: "exact" },
    tokens: { colors: [], fonts: [] },
    layout: [
      { id: "footer", type: "group", justify: "space-between", children: [
        { id: "info", type: "text", text: "Menampilkan 1-10 dari 20 data" },
      ] },
    ],
    images: [], icons: [],
  };
  const pilar = { pilarComponents: [{ selector: "uii-table", inputs: [{ name: "paginationAlign", default: "'center'" }] }] };
  const s = buildSpec(t, CONVENTIONS, pilar);
  assert.match(s, /## Behavior bindings/, "behavior section present");
  assert.match(s, /\[paginationAlign\]="'right'"/, "exact binding expression present");
  assert.match(s, /verified capability: uii-table\.paginationAlign/, "capability named");
  assert.match(s, /rejected: .*::ng-deep/, "the rejected CSS alternative is named");
});

test("PR4 spec: FALLBACK stays visible (never silently dropped)", () => {
  const t = {
    version: 3,
    meta: { source: "figml", tier: 0, image: "design.xml", width: 400, height: 300, textQuality: "exact" },
    tokens: { colors: [], fonts: [] },
    layout: [
      { id: "btn2", type: "button", text: "Kirim", variant: "ghost" },
    ],
    images: [], icons: [],
  };
  const s = buildSpec(t, CONVENTIONS);
  assert.match(s, /FALLBACK: native-plain/, "fallback visible in spec");
});

test("PR4 spec: without pilar the behavior binding states it is unverified", () => {
  const t = {
    version: 3,
    meta: { source: "figml", tier: 0, image: "design.xml", width: 800, height: 600, textQuality: "exact" },
    tokens: { colors: [], fonts: [] },
    layout: [
      { id: "footer", type: "group", justify: "space-between", children: [
        { id: "info", type: "text", text: "Menampilkan 1-10 dari 20 data" },
      ] },
    ],
    images: [], icons: [],
  };
  const s = buildSpec(t, CONVENTIONS, null);
  assert.match(s, /capability NOT machine-verified/, "unverified state explicit");
});

test("PR4-corrective spec: ambiguous status shows candidates, not a selected recommendation", () => {
  const corpus = [
    { selector: "label-custom-waiting .fa-exclamation-circle", block: "::ng-deep .label-custom-waiting .fa-exclamation-circle { color: #f44444; }" },
    { selector: "label-custom-warning .fa-exclamation-circle", block: "::ng-deep .label-custom-warning .fa-exclamation-circle { color: #f44444; }" },
    { selector: "label-custom-new-student .fa-exclamation-circle", block: "::ng-deep .label-custom-new-student .fa-exclamation-circle { color: #f44444; }" },
  ];
  const t = { meta: { image: "d.xml" }, layout: [
    { id: "badge", type: "group", bg: "#fef2f2", children: [{ id: "ic", type: "icon", bg: "#f44444" }] },
  ]};
  const s = buildSpec(t, { ...CONVENTIONS, ngDeepCorpus: corpus, classVocabulary: [] });
  assert.match(s, /UNRESOLVED \(ambiguous taxonomy\)/, "ambiguity visible in spec");
  assert.match(s, /do not guess/, "spec forbids guessing");
  assert.match(s, /label-custom-waiting \/ label-custom-warning/, "candidates bounded and named");
  // The first candidate must NOT be rendered as a bare recommended value.
  assert.ok(!/#badge[\s\S]*→\s*label-custom-waiting(?:\s|$)/.test(s), "no silent first-candidate recommendation");
});

test("PR4-corrective spec: behavior binding labels recommendation as hint, capability as verified", () => {
  const t = { meta: { image: "d.xml" }, layout: [
    { id: "footer", type: "group", justify: "space-between", children: [
      { id: "info", type: "text", text: "Menampilkan 1-10 dari 20 data" },
    ]},
  ]};
  const pilar = { pilarComponents: [{ selector: "uii-table", inputs: [{ name: "paginationAlign", default: "'center'" }] }] };
  const s = buildSpec(t, CONVENTIONS, pilar);
  assert.match(s, /recommendation — hint/, "recommendation labelled hint");
  assert.match(s, /verified capability: uii-table\.paginationAlign/, "capability labelled verified separately");
});
