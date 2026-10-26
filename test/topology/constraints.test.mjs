// Constraint compilers — golden assertions + property-based + metamorphic tests.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  derive, deriveAlignment, deriveSiblingRatios, deriveItemDistances, deriveRelativeSize,
  deriveAnchor, deriveSizing, tolerance, near,
} from "../../src/design/constraints.mjs";

const n = (id, x, y, w, h, layout = {}) => ({ id, absoluteBounds: { x, y, w, h }, layout, childIds: [] });

// ---------- deterministic PRNG (property-based, no new dependency) ----------
function lcg(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

// ---------- alignment ----------

test("alignment: edge gaps classify END / START / CENTER / STRETCH", () => {
  const parent = n("p", 0, 0, 1000, 100);
  assert.equal(deriveAlignment(n("end", 900, 0, 100, 100), parent, "x").value, "END");
  assert.equal(deriveAlignment(n("start", 0, 0, 100, 100), parent, "x").value, "START");
  assert.equal(deriveAlignment(n("center", 450, 0, 100, 100), parent, "x").value, "CENTER");
  assert.equal(deriveAlignment(n("stretch", 0, 0, 1000, 100), parent, "x").value, "STRETCH");
});

test("alignment: explicit metadata beats geometry inference", () => {
  const parent = n("p", 0, 0, 1000, 100);
  const c = n("c", 900, 0, 100, 100, { primaryAlignment: "CENTER" });
  assert.equal(deriveAlignment(c, parent, "x", "CENTER").value, "CENTER");
  assert.equal(deriveAlignment(c, parent, "x", "CENTER").derivation, "EXPLICIT");
});

// ---------- sibling ratio ----------

test("sibling-ratio: 1:1:1 and 1:1 are normalized from equal FILL widths", () => {
  const row3 = [n("a", 0, 0, 200, 40), n("b", 200, 0, 200, 40), n("c", 400, 0, 200, 40)];
  assert.deepEqual(deriveSiblingRatios(row3, "x").value, [1, 1, 1]);
  const row2 = [n("a", 0, 0, 300, 40), n("b", 300, 0, 300, 40)];
  assert.deepEqual(deriveSiblingRatios(row2, "x").value, [1, 1]);
});

test("sibling-ratio: mixed widths rationalize to a simple ratio", () => {
  const mixed = [n("a", 0, 0, 100, 40), n("b", 100, 0, 200, 40)];
  assert.deepEqual(deriveSiblingRatios(mixed, "x").value, [1, 2]);
});

// ---------- spacing / relative size / anchor ----------

test("item-distance: next.start − prev.end is the rendered distance", () => {
  const row = [n("a", 0, 0, 100, 40), n("b", 110, 0, 100, 40), n("c", 220, 0, 100, 40)];
  const d = deriveItemDistances(row, "x");
  assert.deepEqual(d.map((x) => x.expected), [10, 10]);
});

test("relative-size: child/parent is scale-invariant", () => {
  const parent = n("p", 0, 0, 1000, 500);
  const child = n("c", 0, 0, 500, 250);
  assert.equal(deriveRelativeSize(child, parent, "x").value, 0.5);
  // Uniform 2× scale does not change the ratio.
  const parent2 = n("p", 0, 0, 2000, 1000);
  const child2 = n("c", 0, 0, 1000, 500);
  assert.equal(deriveRelativeSize(child2, parent2, "x").value, 0.5);
});

test("anchor: a top-right badge anchors END/START", () => {
  const parent = n("p", 0, 0, 300, 200);
  const badge = n("b", 260, 0, 40, 40);
  const a = deriveAnchor(badge, parent).value;
  assert.equal(a.horizontal, "END");
  assert.equal(a.vertical, "START");
});

// ---------- sizing precedence ----------

test("sizing: explicit metadata > layoutGrow > geometry", () => {
  const parent = n("p", 0, 0, 1000, 100);
  const explicit = n("e", 0, 0, 1000, 100, { horizontalSizing: "HUG" });
  assert.equal(deriveSizing(explicit, parent).horizontal.value, "HUG");
  const grow = n("g", 0, 0, 1000, 100, { grow: 1 });
  assert.equal(deriveSizing(grow, parent).horizontal.value, "FILL");
});

// ---------- property-based: random linear siblings ----------

test("property: sibling ratios are normalized and invariant under uniform scale", () => {
  const rand = lcg(42);
  for (let trial = 0; trial < 100; trial++) {
    const count = 2 + Math.floor(rand() * 5); // 2..6 siblings
    const base = 50 + Math.floor(rand() * 200);
    const kids = [];
    let x = 0;
    for (let i = 0; i < count; i++) {
      const w = base * (1 + Math.floor(rand() * 3)); // base, 2×base, or 3×base
      kids.push(n(`k${i}`, x, 0, w, 40));
      x += w + 10;
    }
    const ratios = deriveSiblingRatios(kids, "x").value;
    assert.equal(ratios.length, count);
    const min = Math.min(...ratios);
    assert.equal(min, 1, "ratios are normalized to the smallest = 1");

    // Uniform 2× scale preserves the ratios.
    const scaled = kids.map((k) => n(k.id, k.absoluteBounds.x * 2, 0, k.absoluteBounds.w * 2, 40));
    assert.deepEqual(deriveSiblingRatios(scaled, "x").value, ratios, "uniform scale preserves ratios");
  }
});

// ---------- metamorphic ----------

test("metamorphic: translation preserves alignment and ratios", () => {
  const parent = n("p", 0, 0, 1000, 100);
  const kids = [n("a", 0, 0, 300, 40), n("b", 310, 0, 300, 40), n("c", 620, 0, 300, 40)];
  const before = deriveSiblingRatios(kids, "x").value;
  // Translate every node by (500, 700).
  const shifted = kids.map((k) => n(k.id, k.absoluteBounds.x + 500, k.absoluteBounds.y + 700, k.absoluteBounds.w, k.absoluteBounds.h));
  assert.deepEqual(deriveSiblingRatios(shifted, "x").value, before, "translation preserves ratios");
  const parentShifted = n("p", 500, 700, 1000, 100);
  assert.equal(deriveAlignment(shifted[2], parentShifted, "x").value, deriveAlignment(kids[2], parent, "x").value);
});

test("metamorphic: uniform scale preserves normalized relationships", () => {
  const parent = n("p", 0, 0, 1000, 500);
  const child = n("c", 0, 0, 500, 250);
  assert.equal(deriveRelativeSize(child, parent, "x").value, 0.5);
  const parent2 = n("p", 0, 0, 4000, 2000);
  const child2 = n("c", 0, 0, 2000, 1000);
  assert.equal(deriveRelativeSize(child2, parent2, "x").value, 0.5);
});
