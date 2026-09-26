// selector-map (PR 6C) — locator-only contract tests (§38).
//
// The load-bearing property is negative: a locator map must NEVER become an expected-value oracle.
// Most of these tests assert REJECTION, because that rejection is the only thing keeping the
// transcript the sole source of design truth.

import { test } from "node:test";
import assert from "node:assert/strict";
import { validateSelectorMap, indexSelectorMap, SELECTOR_MAP_VERSION, MAX_SELECTOR_LENGTH } from "../src/framework/angular/selector-map.mjs";

const ok = (mappings) => ({ version: SELECTOR_MAP_VERSION, mappings });
const loc = (sel) => ({ strategy: "css", selector: sel });

test("PR6C selector-map: a valid map resolves a unique target", () => {
  const m = ok([{ designNodeId: "toolbar", renderLocator: loc("[data-fx='toolbar']") }]);
  const v = validateSelectorMap(m);
  assert.equal(v.ok, true, v.errors.join("; "));
  const idx = indexSelectorMap(m);
  assert.equal(idx.get("toolbar").selector, "[data-fx='toolbar']");
  assert.equal(idx.get("toolbar").required, true, "required by default");
});

test("PR6C selector-map: an unknown schema version is rejected", () => {
  const v = validateSelectorMap({ version: 99, mappings: [] });
  assert.equal(v.ok, false);
  assert.match(v.errors.join(" "), /version must be 1/);
});

test("PR6C selector-map: duplicate design-node mapping is rejected", () => {
  const v = validateSelectorMap(ok([
    { designNodeId: "panel", renderLocator: loc(".a") },
    { designNodeId: "panel", renderLocator: loc(".b") },
  ]));
  assert.equal(v.ok, false);
  assert.match(v.errors.join(" "), /duplicated/);
});

// --- the anti-oracle property: expected values can never ride along in a locator ---

test("PR6C selector-map: expected-value fields are rejected at the mapping level", () => {
  for (const field of ["expected", "expectedHeight", "expectedGap", "expectedColor", "expectedRadius", "value"]) {
    const v = validateSelectorMap(ok([
      { designNodeId: "panel", [field]: 42, renderLocator: loc(".panel") },
    ]));
    assert.equal(v.ok, false, `${field} must be rejected`);
    assert.match(v.errors.join(" "), /forbidden/);
  }
});

test("PR6C selector-map: expected-value fields are rejected inside the locator", () => {
  const v = validateSelectorMap(ok([
    { designNodeId: "panel", renderLocator: { strategy: "css", selector: ".panel", expectedWidth: 300 } },
  ]));
  assert.equal(v.ok, false);
  assert.match(v.errors.join(" "), /unknown field "expectedWidth"/);
});

test("PR6C selector-map: no accepted map ever yields an expected value to the geometry layer", () => {
  // A valid map exposes ONLY a selector + required flag once indexed. (Unknown fields are now
  // rejected outright by the allowlist — see the strictness tests — so there is no way for an extra
  // field to survive to this point; this test pins the downstream shape regardless.)
  const m = ok([{ designNodeId: "panel", renderLocator: loc(".panel"), required: true }]);
  assert.equal(validateSelectorMap(m).ok, true);
  for (const [, entry] of indexSelectorMap(m)) {
    assert.deepEqual(Object.keys(entry).sort(), ["required", "selector"]);
  }
});

// --- selector safety ---

test("PR6C selector-map: unsafe or executable selector content is rejected", () => {
  const bad = [
    "<script>alert(1)</script>",
    "javascript:void(0)",
    "https://example.com/x",
    "/Users/someone/private/component.html",
    "eval(document)",
  ];
  for (const sel of bad) {
    const v = validateSelectorMap(ok([{ designNodeId: "x", renderLocator: loc(sel) }]));
    assert.equal(v.ok, false, `selector must be rejected: ${sel}`);
    assert.match(v.errors.join(" "), /unsafe/);
  }
});

test("PR6C selector-map: selector length is bounded and empty selectors rejected", () => {
  const long = validateSelectorMap(ok([{ designNodeId: "x", renderLocator: loc(".".repeat(MAX_SELECTOR_LENGTH + 1) + "a") }]));
  assert.equal(long.ok, false);
  assert.match(long.errors.join(" "), /exceeds/);
  const empty = validateSelectorMap(ok([{ designNodeId: "x", renderLocator: loc("   ") }]));
  assert.equal(empty.ok, false);
  assert.match(empty.errors.join(" "), /non-empty/);
});

test("PR6C selector-map: only the css strategy is accepted; a bad shape is rejected", () => {
  assert.equal(validateSelectorMap(ok([{ designNodeId: "x", renderLocator: { strategy: "xpath", selector: "//div" } }])).ok, false);
  assert.equal(validateSelectorMap(ok([{ designNodeId: "x" }])).ok, false);
  assert.equal(validateSelectorMap(ok([{ renderLocator: loc(".a") }])).ok, false, "designNodeId required");
  assert.equal(validateSelectorMap({ version: SELECTOR_MAP_VERSION }).ok, false, "mappings required");
  assert.equal(validateSelectorMap(null).ok, false);
});

test("PR6C selector-map: an optional mapping is carried, and a non-boolean is rejected", () => {
  const m = ok([{ designNodeId: "x", required: false, renderLocator: loc(".x") }]);
  assert.equal(validateSelectorMap(m).ok, true);
  assert.equal(indexSelectorMap(m).get("x").required, false);
  assert.equal(validateSelectorMap(ok([{ designNodeId: "x", required: "yes", renderLocator: loc(".x") }])).ok, false);
});

// ---------- PR 6C corrective patch: SCH-001 (strict allowlist + recursive rejection) ----------

test("PR6Cc SCH-001: semantic-exception fields are rejected by name", () => {
  for (const field of ["expectedScroll", "allowOverflow", "validTruncation", "ellipsisExpected", "scrollIntent", "truncateIntent", "overflowExpected"]) {
    const v = validateSelectorMap(ok([{ designNodeId: "x", [field]: true, renderLocator: loc(".x") }]));
    assert.equal(v.ok, false, `${field} must be rejected`);
    assert.match(v.errors.join(" "), /forbidden|unknown field/, `${field} yields a diagnostic`);
  }
});

test("PR6Cc SCH-001: case and separator variants are rejected", () => {
  for (const field of ["ExpectedScroll", "ALLOWOVERFLOW", "expected_height", "expected-scroll", "expected_scroll", "Expected_Height"]) {
    const v = validateSelectorMap(ok([{ designNodeId: "x", [field]: true, renderLocator: loc(".x") }]));
    assert.equal(v.ok, false, `variant "${field}" must be rejected`);
  }
});

test("PR6Cc SCH-001: nested and array-contained semantic fields are rejected recursively", () => {
  const nestedLoc = validateSelectorMap(ok([{ designNodeId: "x", renderLocator: { strategy: "css", selector: ".x", meta: { expectedScroll: true } } }]));
  assert.equal(nestedLoc.ok, false, "nested locator field rejected");
  const nestedMapping = validateSelectorMap(ok([{ designNodeId: "x", renderLocator: loc(".x"), meta: { validTruncation: true } }]));
  assert.equal(nestedMapping.ok, false, "nested mapping field rejected");
  const arrayContained = validateSelectorMap({ version: 1, mappings: [{ designNodeId: "x", renderLocator: loc(".x"), tags: [{ allowOverflow: true }] }] });
  assert.equal(arrayContained.ok, false, "array-contained semantic field rejected");
});

test("PR6Cc SCH-001: unknown fields are rejected at every level (strict allowlist)", () => {
  assert.equal(validateSelectorMap({ version: 1, mappings: [], foo: 1 }).ok, false, "unknown root field");
  assert.equal(validateSelectorMap(ok([{ designNodeId: "x", renderLocator: loc(".x"), note: "decor" }])).ok, false, "unknown mapping field");
  assert.equal(validateSelectorMap(ok([{ designNodeId: "x", renderLocator: { strategy: "css", selector: ".x", note: "decor" } }])).ok, false, "unknown locator field");
});

test("PR6Cc SCH-001: an innocent selector string is still accepted", () => {
  // The selector VALUE is not field-name-checked — only field names and schema positions are.
  for (const sel of [".item-value", "[data-fx='scroll'] .pagination-item", "table .row", ".expected-results"]) {
    assert.equal(validateSelectorMap(ok([{ designNodeId: "x", renderLocator: loc(sel) }])).ok, true, `selector "${sel}" accepted`);
  }
  // Genuine smuggling through a data-expected attribute is still rejected.
  assert.equal(validateSelectorMap(ok([{ designNodeId: "x", renderLocator: loc("[data-expected='40']") }])).ok, false);
});
