// relationship (browser, FULL PATH) — sibling ratio through intent → plan → mount → verdict.
import { test } from "node:test";
import assert from "node:assert/strict";
import { fixtureReady, isSkip, mountAndVerify } from "./browser-harness.mjs";

function ratioIntent(expected = [1, 1]) {
  return {
    constraints: [{ type: "SIBLING_RATIO", regionId: "r1", parentId: "row", childIds: ["a", "b"], axis: "x", value: expected, tolerance: 0.1 }],
    tables: [], content: [], states: [],
  };
}

const HTML = `<div class="row"><div class="a"></div><div class="b"></div></div>`;
const MAP = { a: ".a", b: ".b" };

test("sibling ratio (browser, full path): equal flex siblings → 1:1 PASS", async (t) => {
  if (!fixtureReady()) { t.skip("mount fixture deps missing"); return; }
  let out;
  try {
    out = await mountAndVerify({ html: HTML, scss: ".row{display:flex}.a,.b{flex:1;height:40px}", map: MAP, intentGraph: ratioIntent() });
  } catch (err) { if (isSkip(err)) { t.skip("chromium unavailable"); return; } throw err; }
  const check = out.result.checks.find((c) => c.family === "sibling-ratio");
  assert.equal(check.status, "pass", check.detail);
  assert.deepEqual(check.actual, [1, 1], "measured from getBoundingClientRect");
});

test("sibling ratio (browser, full path): one fixed sibling → fails for the right reason", async (t) => {
  if (!fixtureReady()) { t.skip("mount fixture deps missing"); return; }
  let out;
  try {
    out = await mountAndVerify({ html: HTML, scss: ".row{display:flex}.a{flex:1;height:40px}.b{flex:0 0 100px;height:40px}", map: MAP, intentGraph: ratioIntent() });
  } catch (err) { if (isSkip(err)) { t.skip("chromium unavailable"); return; } throw err; }
  assert.equal(out.result.state, "fail");
  const check = out.result.checks.find((c) => c.family === "sibling-ratio");
  assert.equal(check.status, "fail");
  assert.ok(check.actual[0] > 1, "the ratio is measured, not authored");
});
