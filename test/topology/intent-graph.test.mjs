// Design Intent Graph — immutability (freeze), determinism (hash), and metamorphic invariants.
import { test } from "node:test";
import assert from "node:assert/strict";
import { ingestDesign } from "../../src/design/ingest.mjs";
import { doc, frame, text, instance } from "./fixtures.mjs";

test("intent-graph: freeze deep-freezes the graph so project adaptation cannot mutate it", () => {
  const { intentGraph } = ingestDesign(doc({ id: "f", w: 200, h: 100 }, frame("a", { x: 0, y: 0, w: 200, h: 100, mode: "VERTICAL", children: text("t", { x: 0, y: 0, w: 100, h: 20, chars: "hi" }) })), "x.xml");
  assert.equal(Object.isFrozen(intentGraph), true);
  assert.equal(Object.isFrozen(intentGraph.nodes), true);
  assert.throws(() => { intentGraph.nodes = []; }, TypeError, "frozen graph rejects mutation");
});

test("intent-graph: hash is deterministic (same design → same hash)", () => {
  const xml = doc({ id: "f", w: 200, h: 100 }, frame("a", { x: 0, y: 0, w: 200, h: 100, mode: "VERTICAL", children: text("t", { x: 0, y: 0, w: 100, h: 20, chars: "hi" }) }));
  const h1 = ingestDesign(xml, "x.xml").intentGraph.hash;
  const h2 = ingestDesign(xml, "x.xml").intentGraph.hash;
  assert.equal(h1, h2);
  assert.match(h1, /^[0-9a-f]{64}$/, "sha256 hex");
});

test("metamorphic: adding a hidden node does not change visible content or topology", () => {
  const visible = doc({ id: "f", w: 200, h: 100 }, frame("a", { x: 0, y: 0, w: 200, h: 100, mode: "VERTICAL", children: text("t", { x: 0, y: 0, w: 100, h: 20, chars: "visible" }) }));
  const withHidden = doc({ id: "f", w: 200, h: 100 }, frame("a", { x: 0, y: 0, w: 200, h: 100, mode: "VERTICAL", children: `${text("t", { x: 0, y: 0, w: 100, h: 20, chars: "visible" })}\n<Text id="hidden" name="hidden" x="0" y="30" width="100" height="20" visible="false" characters="secret" type="TEXT"><fills><fill color="#000000"/></fills></Text>` }));

  const a = ingestDesign(visible, "x.xml").intentGraph;
  const b = ingestDesign(withHidden, "x.xml").intentGraph;

  assert.deepEqual(a.content.map((c) => c.value), b.content.map((c) => c.value), "hidden node adds no visible content");
  assert.deepEqual(a.regions.map((r) => r.family), b.regions.map((r) => r.family), "hidden node does not change topology");
});

test("metamorphic: reordering siblings changes only the ORDER edges", () => {
  const mk = (first, second) => doc({ id: "f", w: 400, h: 60 },
    frame("row", { x: 0, y: 0, w: 400, h: 60, mode: "HORIZONTAL", children: `${first}\n${second}` }));
  const ab = mk(text("a", { x: 0, y: 0, w: 200, h: 20, chars: "A" }), text("b", { x: 200, y: 0, w: 200, h: 20, chars: "B" }));
  const ba = mk(text("b", { x: 0, y: 0, w: 200, h: 20, chars: "B" }), text("a", { x: 200, y: 0, w: 200, h: 20, chars: "A" }));

  const g1 = ingestDesign(ab, "x.xml").intentGraph;
  const g2 = ingestDesign(ba, "x.xml").intentGraph;

  const orderEdges = (g) => g.edges.filter((e) => e.type === "ORDERED_BEFORE").map((e) => `${e.from}->${e.to}`).sort();
  // The ratio constraint is order-independent; the directed spacing edge is not (it flips with order).
  const ratioEdges = (g) => JSON.stringify(g.edges.filter((e) => e.type === "SIBLING_RATIO").map((e) => JSON.stringify(e)).sort());

  assert.notDeepEqual(orderEdges(g1), orderEdges(g2), "order edges flip");
  assert.equal(ratioEdges(g1), ratioEdges(g2), "ratio edges are order-independent");
});

test("intent-graph: project context cannot affect the hash (graph is project-independent)", () => {
  const xml = doc({ id: "f", w: 200, h: 100 }, frame("a", { x: 0, y: 0, w: 200, h: 100, mode: "VERTICAL", children: text("t", { x: 0, y: 0, w: 100, h: 20, chars: "hi" }) }));
  const g = ingestDesign(xml, "x.xml").intentGraph;
  // The intent graph must not reference Angular/Pilar/Bootstrap/project recipes at all.
  const serialized = JSON.stringify(g);
  for (const forbidden of ["Angular", "Pilar", "Bootstrap", "ngDeep", "recipe", "conventions"]) {
    assert.ok(!serialized.includes(forbidden), `intent graph must not contain project context: ${forbidden}`);
  }
});
