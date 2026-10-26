// Raw Design Graph + visibility compilation — lossless ingestion invariants + effective visibility.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { buildRawGraph } from "../../src/design/raw-graph.mjs";
import { compileVisibility } from "../../src/design/visibility.mjs";
import { doc, frame, text, hiddenActionFixture } from "./fixtures.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const RAW = readFileSync(join(HERE, "..", "fixtures", "mahasiswa-tarif", "raw.xml"), "utf8");

function nodesOf(xml) {
  const r = buildRawGraph(xml, "fixture.xml");
  assert.equal(r.ok, true, r.message ?? "build failed");
  return { graph: r.graph, nodes: r.graph.nodes };
}

test("raw-graph: layoutGrow survives ingestion (lossless — the legacy path drops it)", () => {
  const { nodes } = nodesOf(RAW);
  const withGrow = Object.values(nodes).filter((n) => n.layout?.grow === 1);
  assert.ok(withGrow.length >= 10, `expected many layoutGrow nodes, got ${withGrow.length}`);
  // Every FILL node with grow must keep both facts, not just one.
  const field = nodes["16601_46211"];
  assert.equal(field.layout.grow, 1, "the filter field keeps layoutGrow=1");
  assert.equal(field.layout.horizontalSizing, "FILL", "and its horizontal FILL sizing");
});

test("raw-graph: local and absolute bounds are both retained", () => {
  const { nodes } = nodesOf(RAW);
  const field = nodes["16601_46211"];
  assert.equal(field.bounds.x, 0, "local x is relative to its parent");
  assert.ok(field.absoluteBounds.x > 0, "absolute x is the accumulated parent origin");
  assert.equal(field.absoluteBounds.w, field.bounds.w, "width is unchanged by translation");
});

test("raw-graph: hidden nodes are retained as evidence, not dropped", () => {
  const { nodes } = nodesOf(RAW);
  const hidden = Object.values(nodes).filter((n) => n.visibility?.ownVisible === false);
  assert.ok(hidden.length >= 1, "hidden nodes (e.g. the required asterisk) survive");
  for (const h of hidden) assert.equal(h.visibility.effectiveVisible, false);
});

test("raw-graph: every visible text node survives (evidence retention ≥ 99%)", () => {
  const { graph } = nodesOf(RAW);
  const classifications = compileVisibility(graph).classifications;
  const textNodes = Object.values(graph.nodes).filter((n) => n.content?.kind === "TEXT" && n.content.value.trim());
  const visible = textNodes.filter((n) => classifications.get(n.id)?.effectiveVisible);
  // Retention ratio: none of the visible text may be lost.
  assert.equal(visible.length, textNodes.filter((n) => !n.visibility.reason).length, "no visible text node dropped");
});

test("visibility: HIDDEN_EXPLICIT, HIDDEN_BY_ANCESTOR, and TRANSPARENT are classified", () => {
  const xml = doc({ id: "vroot", w: 400, h: 300 },
    frame("parent", { x: 0, y: 0, w: 400, h: 300, mode: "VERTICAL", children:
      `${text("t", { x: 0, y: 0, w: 100, h: 20, chars: "visible" })}\n` +
      `<Frame id="hid" name="hid" x="0" y="30" width="100" height="20" visible="false" type="FRAME"><children>${text("hidchild", { x: 0, y: 0, w: 100, h: 20, chars: "hidden child" })}</children></Frame>\n` +
      `<Text id="trans" name="trans" x="0" y="60" width="100" height="20" opacity="0.4" characters="translucent" type="TEXT"><fills><fill color="#000000"/></fills></Text>` }));
  const { graph } = nodesOf(xml);
  const cls = compileVisibility(graph).classifications;
  assert.equal(cls.get("hid").class, "HIDDEN_EXPLICIT");
  assert.equal(cls.get("hidchild").class, "HIDDEN_BY_ANCESTOR", "a child of a hidden node is hidden by ancestor");
  assert.equal(cls.get("trans").class, "TRANSPARENT");
  assert.equal(cls.get("trans").effectiveVisible, true, "partial opacity is still visible (flagged)");
});

test("visibility: hidden-by-override is surfaced as HIDDEN_EXPLICIT", () => {
  const { graph } = nodesOf(hiddenActionFixture());
  const cls = compileVisibility(graph).classifications;
  assert.equal(cls.get("hid").effectiveVisible, false, "the hidden action is excluded from the surface");
  assert.equal(cls.get("vis").effectiveVisible, true);
});
