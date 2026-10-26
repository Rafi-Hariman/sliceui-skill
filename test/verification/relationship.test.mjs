// relationship — the 7 relationship/topology verifiers over DOM geometry (known-bad/known-good).
import { test } from "node:test";
import assert from "node:assert/strict";
import { verifyRelationship } from "../../src/verification/relationship.mjs";

const rect = (x, y, w, h) => ({ x, y, width: w, height: h });
const rects = (o) => new Map(Object.entries(o));

test("sibling-ratio: 1:1 and 1:1:1 known-good", () => {
  const two = rects({ a: rect(0, 0, 300, 40), b: rect(300, 0, 300, 40) });
  assert.equal(verifyRelationship({ category: "sibling-ratio", axis: "x", childIds: ["a", "b"], expected: [1, 1], tolerance: 0.1 }, two).status, "pass");
  const three = rects({ a: rect(0, 0, 200, 40), b: rect(200, 0, 200, 40), c: rect(400, 0, 200, 40) });
  assert.equal(verifyRelationship({ category: "sibling-ratio", axis: "x", childIds: ["a", "b", "c"], expected: [1, 1, 1], tolerance: 0.1 }, three).status, "pass");
});

test("sibling-ratio: a 6.4:1 sibling fails against 1:1 (the second container lacks grow)", () => {
  const r = rects({ a: rect(0, 0, 640, 40), b: rect(640, 0, 100, 40) });
  const res = verifyRelationship({ category: "sibling-ratio", axis: "x", childIds: ["a", "b"], expected: [1, 1], tolerance: 0.1, remediation: "apply grow" }, r);
  assert.equal(res.status, "fail");
  assert.deepEqual(res.actual, [6.4, 1], "ratio is measured, not guessed");
});

test("alignment: START / CENTER / END / STRETCH", () => {
  const mk = (c) => rects({ p: rect(0, 0, 1000, 100), c });
  assert.equal(verifyRelationship({ category: "alignment", axis: "x", childId: "c", parentId: "p", expected: "END" }, mk(rect(900, 0, 100, 100))).status, "pass");
  assert.equal(verifyRelationship({ category: "alignment", axis: "x", childId: "c", parentId: "p", expected: "CENTER" }, mk(rect(450, 0, 100, 100))).status, "pass");
  assert.equal(verifyRelationship({ category: "alignment", axis: "x", childId: "c", parentId: "p", expected: "START" }, mk(rect(0, 0, 100, 100))).status, "pass");
  assert.equal(verifyRelationship({ category: "alignment", axis: "x", childId: "c", parentId: "p", expected: "STRETCH" }, mk(rect(0, 0, 1000, 100))).status, "pass");
});

test("relative-size: child/parent = 0.5", () => {
  const r = rects({ p: rect(0, 0, 1000, 500), c: rect(0, 0, 500, 250) });
  assert.equal(verifyRelationship({ category: "relative-size", axis: "x", childId: "c", parentId: "p", expected: 0.5 }, r).status, "pass");
});

test("item-distance: next.start − prev.end catches stacked margins (known-bad)", () => {
  // design gap 10px; a child margin adds 15px → rendered distance 25.
  const r = rects({ a: rect(0, 0, 100, 40), b: rect(0, 55, 100, 40) });
  const res = verifyRelationship({ category: "item-distance", axis: "y", fromNodeId: "a", toNodeId: "b", expected: 10, tolerance: 1 }, r);
  assert.equal(res.status, "fail");
  assert.equal(res.actual, 15);
});

test("containment: a child escaping its container fails", () => {
  const r = rects({ p: rect(0, 0, 300, 200), c: rect(280, 0, 100, 50) });
  assert.equal(verifyRelationship({ category: "containment", childId: "c", parentId: "p", tolerance: 1 }, r).status, "fail");
  assert.equal(verifyRelationship({ category: "containment", childId: "c", parentId: "p", tolerance: 1 }, rects({ p: rect(0, 0, 300, 200), c: rect(0, 0, 100, 50) })).status, "pass");
});

test("grid-track: 3 columns × 2 rows known-good / wrong count fails", () => {
  const cells = {
    a: rect(0, 0, 300, 200), b: rect(320, 0, 300, 200), c: rect(640, 0, 300, 200),
    d: rect(0, 220, 300, 200), e: rect(320, 220, 300, 200), f: rect(640, 220, 300, 200),
  };
  const check = { category: "grid-track", nodeIds: Object.keys(cells), expected: { columns: 3, rows: 2 }, tolerance: 1 };
  assert.equal(verifyRelationship(check, rects(cells)).status, "pass");
  assert.equal(verifyRelationship({ ...check, expected: { columns: 2, rows: 2 } }, rects(cells)).status, "fail");
});

test("anchor: top-right badge anchors END/START; a left-anchored badge fails END", () => {
  const p = { p: rect(0, 0, 300, 200) };
  const good = verifyRelationship({ category: "anchor", nodeId: "b", anchorNodeId: "p", expected: { horizontal: "END", vertical: "START" }, tolerance: 2 }, rects({ ...p, b: rect(260, 0, 40, 40) }));
  assert.equal(good.status, "pass");
  const bad = verifyRelationship({ category: "anchor", nodeId: "b", anchorNodeId: "p", expected: { horizontal: "END", vertical: "START" }, tolerance: 2 }, rects({ ...p, b: rect(0, 0, 40, 40) }));
  assert.equal(bad.status, "fail");
});

test("relationship: a missing rect is unverifiable, never a false pass", () => {
  const res = verifyRelationship({ category: "sibling-ratio", axis: "x", childIds: ["a", "b"], expected: [1, 1] }, new Map([["a", rect(0, 0, 100, 40)]]));
  assert.equal(res.status, "unverifiable");
});
