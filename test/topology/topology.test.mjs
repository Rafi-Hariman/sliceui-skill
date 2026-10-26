// Topology classification — each production family detected on a synthetic fixture (neutral labels).
import { test } from "node:test";
import assert from "node:assert/strict";
import { ingestDesign } from "../../src/design/ingest.mjs";
import { gridFixture, overlayFixture, repeatedFixture, linearFilterFixture, mixedSizingFixture, endAlignedActionFixture, hiddenActionFixture, ratioFixture } from "./fixtures.mjs";

function topoFor(xml, nodeId) {
  const r = ingestDesign(xml, "fixture.xml");
  assert.equal(r.ok, true);
  return r.topologies.find((t) => t.rootNodeId === nodeId);
}

test("topology: a 2×3 card layout classifies as GRID", () => {
  const t = topoFor(gridFixture(), "gridroot");
  assert.equal(t.family, "GRID");
  assert.equal(t.tracks.columns, 3);
  assert.equal(t.tracks.rows, 2);
});

test("topology: an absolutely-positioned badge classifies as OVERLAY with a top-right anchor", () => {
  const t = topoFor(overlayFixture(), "card");
  assert.equal(t.family, "OVERLAY");
  const anchor = t.constraints.find((c) => c.type === "ANCHOR");
  assert.equal(anchor.nodeId, "badge", "the overlay anchor names the floating badge");
  assert.equal(anchor.value.horizontal, "END");
  assert.equal(anchor.value.vertical, "START");
});

test("topology: three same-height stacked items classify as REPEATED", () => {
  const t = topoFor(repeatedFixture(), "list");
  assert.equal(t.family, "REPEATED");
  assert.equal(t.repeatedCount, 3);
});

test("topology: a horizontal filter row is LINEAR (not REPEATED), ratio 1:1:1:1", () => {
  const t = topoFor(linearFilterFixture(), "filters");
  assert.equal(t.family, "LINEAR");
  const ratio = t.constraints.find((c) => c.type === "SIBLING_RATIO");
  assert.deepEqual(ratio.value, [1, 1, 1, 1]);
});

test("topology: mixed FIXED + FILL + HUG siblings are LINEAR with per-node sizing", () => {
  const t = topoFor(mixedSizingFixture(), "row");
  assert.equal(t.family, "LINEAR");
  const sizing = Object.fromEntries(t.sizing.map((s) => [s.nodeId, s.horizontal?.value]));
  assert.equal(sizing.fixed, "FIXED");
  assert.equal(sizing.fill, "FILL");
  assert.equal(sizing.hug, "HUG");
});

test("topology: a SPACE_BETWEEN toolbar has an END-aligned action", () => {
  const t = topoFor(endAlignedActionFixture(), "toolbar");
  assert.equal(t.family, "LINEAR");
  const add = t.alignments.find((a) => a.nodeId === "add");
  assert.equal(add.value, "END", "the add action is end-aligned");
});

test("topology: hidden actions are excluded from the implementation surface", () => {
  const r = ingestDesign(hiddenActionFixture(), "fixture.xml");
  const visibleNodeIds = r.intentGraph.nodes.map((n) => n.id);
  assert.ok(visibleNodeIds.includes("vis"), "the visible action is in the intent graph");
  assert.ok(!visibleNodeIds.includes("hid"), "the hidden action is excluded from the intent graph");
});

test("topology: sibling ratios 1:1 and 1:1:1 are derived from two separate rows", () => {
  const r1 = topoFor(ratioFixture(), "r1");
  const r2 = topoFor(ratioFixture(), "r2");
  assert.deepEqual(r1.constraints.find((c) => c.type === "SIBLING_RATIO").value, [1, 1]);
  assert.deepEqual(r2.constraints.find((c) => c.type === "SIBLING_RATIO").value, [1, 1, 1]);
});
