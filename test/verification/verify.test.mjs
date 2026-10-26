// verify — the orchestrator: compiled plan × DOM evidence → checks + verdict.
import { test } from "node:test";
import assert from "node:assert/strict";
import { verifyIntent } from "../../src/verification/verify.mjs";
import { compileVerificationPlan } from "../../src/verification/plan.mjs";

function intentGraph() {
  return {
    constraints: [
      { type: "SIBLING_RATIO", regionId: "r1", parentId: "row", childIds: ["a", "b"], axis: "x", value: [1, 1], tolerance: 0.1, evidence: [] },
    ],
    tables: [{ tableNodeId: "tbl", headers: [{ value: "Nama" }, { value: "NIM" }], designedVisibleRows: [{ cells: [{ value: "alice" }, { value: "123" }] }] }],
    content: [{ nodeId: "h", kind: "TEXT", value: "Daftar Mahasiswa" }],
    states: [{ kind: "PAGINATION_RUNTIME", total: 20, pageSize: 10 }],
  };
}

test("plan: compiles ratio + table + text + runtime + responsive checks from the intent graph", () => {
  const plan = compileVerificationPlan(intentGraph());
  assert.ok(plan.relationship.some((c) => c.category === "sibling-ratio"));
  assert.ok(plan.semantic.some((c) => c.category === "table-content"));
  assert.ok(plan.semantic.some((c) => c.category === "exact-text"));
  assert.ok(plan.runtime.some((c) => c.category === "pagination-visible"));
  assert.ok(plan.responsive.length >= 1);
});

test("verifyIntent: known-good evidence passes; a wrong ratio fails; a missing rect is unverifiable", () => {
  const rect = (x, w) => ({ x, y: 0, width: w, height: 40 });
  const good = verifyIntent({
    intentGraph: intentGraph(),
    rects: new Map([["a", rect(0, 300)], ["b", rect(300, 300)]]),
    domTexts: ["Daftar Mahasiswa", "Nama", "NIM", "alice", "123"],
    domState: { paginationVisible: true },
  });
  assert.equal(good.state, "pass", JSON.stringify(good.checks.filter((c) => c.status !== "pass")));
  assert.equal(good.summary.fail, 0);

  const bad = verifyIntent({
    intentGraph: intentGraph(),
    rects: new Map([["a", rect(0, 640)], ["b", rect(640, 100)]]),
    domTexts: ["Daftar Mahasiswa", "Nama", "NIM", "alice", "123"],
    domState: { paginationVisible: true },
  });
  assert.equal(bad.state, "fail");
  const ratio = bad.checks.find((c) => c.family === "sibling-ratio");
  assert.equal(ratio.status, "fail");
  assert.deepEqual(ratio.actual, [6.4, 1]);

  const unverifiable = verifyIntent({ intentGraph: intentGraph(), rects: new Map(), domTexts: [], domState: {} });
  assert.ok(unverifiable.summary.unverifiable >= 1, "missing evidence is unverifiable, never a false pass");
});

test("verifyIntent: designed-visible content mutation fails the content layer", () => {
  const r = verifyIntent({
    intentGraph: intentGraph(),
    rects: new Map([["a", { x: 0, y: 0, width: 300, height: 40 }], ["b", { x: 300, y: 0, width: 300, height: 40 }]]),
    domTexts: ["Daftar Mahasiswa", "Nama", "NIM", "BOGUS", "999"], // designed rows replaced
    domState: { paginationVisible: true },
  });
  assert.equal(r.state, "fail");
  const content = r.checks.find((c) => c.family === "table-content");
  assert.equal(content.status, "fail");
  assert.ok(content.actual.missingCells.includes("alice"), "the designed cell was replaced");
});

test("verifyIntent: a style check with an unresolvable property is unresolved (not blocking)", () => {
  const r = verifyIntent({
    intentGraph: intentGraph(),
    rects: new Map([["a", { x: 0, y: 0, width: 300, height: 40 }], ["b", { x: 300, y: 0, width: 300, height: 40 }]]),
    domTexts: ["Daftar Mahasiswa", "Nama", "NIM", "alice", "123"],
    domState: { paginationVisible: true },
    styleChecks: [{ nodeId: "x", property: "transform", expected: "none", node: { role: "CONTAINER" } }],
  });
  const s = r.checks.find((c) => c.category === "style");
  assert.equal(s.status, "unresolved", "no semantic target → unresolved, never fabricated");
});
