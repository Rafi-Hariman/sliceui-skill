// semantic style (browser) — computed values compared only within the same semantic target:
// foreground / placeholder / background / border / icon / state / inherited. Unresolvable → non-blocking.
import { test } from "node:test";
import assert from "node:assert/strict";
import { fixtureReady, isSkip, mountAndVerify } from "./browser-harness.mjs";

async function run(t, opts) {
  if (!fixtureReady()) { t.skip("mount fixture deps missing"); return null; }
  try { return await mountAndVerify(opts); }
  catch (err) { if (isSkip(err)) { t.skip("chromium unavailable"); return null; } throw err; }
}

const MAP = { fg: ".fg", bg: ".bg", bd: ".bd", ph: ".ph", ic: ".ic", child: ".child" };
const CHECKS = (expected) => [
  { id: "s-fg", nodeId: "fg", property: "color", expected: expected.fg, node: { role: "TEXT" } },
  { id: "s-bg", nodeId: "bg", property: "background-color", expected: expected.bg, node: { role: "CONTAINER" } },
  { id: "s-bd", nodeId: "bd", property: "border-color", expected: expected.bd, node: { role: "CONTAINER" } },
  { id: "s-ph", nodeId: "ph", property: "color", expected: expected.ph, node: { role: "TEXT", sourceName: "placeholder" } },
  { id: "s-ic", nodeId: "ic", property: "color", expected: expected.ic, node: { role: "ICON" } },
  { id: "s-inh", nodeId: "child", property: "color", expected: expected.inh, node: { role: "TEXT" } },
  { id: "s-unk", nodeId: "bg", property: "transform", expected: "none", node: { role: "CONTAINER" } },
];
const HTML = `<div class="bg"><span class="fg">text</span><div class="bd">b</div><input class="ph" placeholder="cari"><span class="ic">icon</span><div class="parent"><span class="child">inh</span></div></div>`;

test("semantic styles (browser): all targets matched → pass; unresolvable stays non-blocking", async (t) => {
  const out = await run(t, {
    html: HTML,
    scss: `.fg{color:#303030}.bg{background-color:#fef2f2}.bd{border:1px solid #bdbdbd}.ic{color:#03337b}.parent{color:#428bca}`,
    globalCss: `input.ph::placeholder{color:#999999}`,
    map: MAP,
    intentGraph: { constraints: [], tables: [], content: [], states: [] },
    styleChecks: CHECKS({ fg: "#303030", bg: "#fef2f2", bd: "#bdbdbd", ph: "#999999", ic: "#03337b", inh: "#428bca" }),
  });
  if (!out) return;
  const styles = out.result.checks.filter((c) => c.category === "style");
  const byId = Object.fromEntries(styles.map((s) => [s.id, s]));
  assert.equal(byId["s-fg"].status, "pass", "foreground");
  assert.equal(byId["s-bg"].status, "pass", "background");
  assert.equal(byId["s-bd"].status, "pass", "border");
  assert.equal(byId["s-ph"].status, "pass", "placeholder (distinct ::placeholder target)");
  assert.equal(byId["s-ic"].status, "pass", "icon fill");
  assert.equal(byId["s-inh"].status, "pass", "inherited color measured via computed style, not source");
  assert.equal(byId["s-unk"].status, "unresolved", "no semantic target → unresolved, never fabricated");
  assert.equal(out.result.state, "pass", "unresolved must not block");
});

test("semantic styles (browser): wrong values fail, and never cross target (fg ≠ bg ≠ border)", async (t) => {
  const out = await run(t, {
    html: HTML,
    scss: `.fg{color:#ff0000}.bg{background-color:#ffffff}.bd{border:1px solid #000000}.ic{color:#000000}.parent{color:#000000}.child{color:#000000}`,
    globalCss: `input.ph::placeholder{color:#000000}`,
    map: MAP,
    intentGraph: { constraints: [], tables: [], content: [], states: [] },
    styleChecks: CHECKS({ fg: "#303030", bg: "#fef2f2", bd: "#bdbdbd", ph: "#999999", ic: "#03337b", inh: "#428bca" }),
  });
  if (!out) return;
  const styles = out.result.checks.filter((c) => c.category === "style");
  for (const s of styles) if (s.id !== "s-unk") assert.equal(s.status, "fail", `${s.id} must fail`);
});

test("semantic styles (browser): focus state color is its own target (good/bad)", async (t) => {
  const good = await run(t, {
    html: `<input class="st" value="x">`,
    scss: `.st:focus{color:#e82f2f}`,
    map: { st: ".st" }, focusSelector: ".st",
    intentGraph: { constraints: [], tables: [], content: [], states: [] },
    styleChecks: [{ id: "s-state", nodeId: "st", property: "color", expected: "#e82f2f", node: { role: "TEXT", selector: ".st:focus" } }],
  });
  if (!good) return;
  assert.equal(good.result.checks.find((c) => c.id === "s-state").status, "pass", "focus color matches");

  const bad = await run(t, {
    html: `<input class="st" value="x">`,
    scss: `.st:focus{color:#000000}`,
    map: { st: ".st" }, focusSelector: ".st",
    intentGraph: { constraints: [], tables: [], content: [], states: [] },
    styleChecks: [{ id: "s-state", nodeId: "st", property: "color", expected: "#e82f2f", node: { role: "TEXT", selector: ".st:focus" } }],
  });
  if (!bad) return;
  assert.equal(bad.result.checks.find((c) => c.id === "s-state").status, "fail", "wrong focus color fails");
});
