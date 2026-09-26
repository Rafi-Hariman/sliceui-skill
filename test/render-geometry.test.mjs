// render-geometry (PR 6B) — evidence-backed rendered geometry facts + comparison.
//
// Pure-helper tests (facts + comparison) always run; the browser-backed comparisons skip gracefully
// when chromium / the mount fixture are unavailable. The synthetic fixture in
// test/fixtures/render-geometry carries NO real data (generic "Daftar Item" / "Contoh Baris") —
// the real tester.xml design (which contains PII) is intentionally NOT a repository fixture.

import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readFileSync, existsSync } from "node:fs";
import { collectGeometryFacts, collectRenderedGeometry, compareGeometry, GEOMETRY_TOLERANCE } from "../src/framework/angular/render-geometry.mjs";
import { renderVerify } from "../src/framework/angular/render-verify.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIX = join(HERE, "fixtures", "render-geometry");
const MOUNT_FIX = join(HERE, "fixtures", "angular-mount");
const transcript = JSON.parse(readFileSync(join(FIX, "transcript.json"), "utf8"));

function readComponent(which) {
  const read = (ext) => {
    const p = join(FIX, which, `geometry.component.${ext}`);
    return existsSync(p) ? readFileSync(p, "utf8") : "";
  };
  return { scss: read("scss"), html: read("html"), ts: read("ts") };
}
function fixtureReady() { return existsSync(join(MOUNT_FIX, "node_modules", "@angular", "core")); }
function isSkip(err) { return /Executable doesn't exist|npx playwright install|browserType\.launch|Cannot find package 'playwright'/.test(String(err?.message ?? err ?? "")); }

// ---------- fact derivation (pure) ----------

test("PR6B: geometry facts derive from transcript design facts only", () => {
  const facts = collectGeometryFacts(transcript);
  const byId = Object.fromEntries(facts.map((f) => [f.id, f]));
  assert.ok(byId["SUI-RENDER-GEOMETRY-001"], "root padding fact");
  assert.deepEqual(byId["SUI-RENDER-GEOMETRY-001"].expected, [20, 20, 20, 20]);
  assert.equal(byId["SUI-RENDER-GEOMETRY-001"].required, true);
  assert.ok(byId["SUI-RENDER-GEOMETRY-002"], "control-height fact");
  assert.equal(byId["SUI-RENDER-GEOMETRY-005"].expected, 20, "line-height from the design's explicit lineHeight");
  assert.equal(byId["SUI-RENDER-GEOMETRY-004"].expected, 1, "divider thickness from the design");
});

test("PR6B: every fact carries id/category/box/tolerance/trust/mapping — no invented expected", () => {
  for (const f of collectGeometryFacts(transcript)) {
    assert.ok(f.id.startsWith("SUI-RENDER-"), `stable id: ${f.id}`);
    assert.ok(f.category, "category");
    assert.ok(["border-box", "structural"].includes(f.box), `box semantic: ${f.box}`);
    assert.ok(f.tolerance != null && f.tolerance >= 0, "bounded tolerance");
    assert.equal(f.trust, "literal-design", "transcript-derived trust");
    assert.ok(f.mapping?.kind, "DOM mapping strategy");
    assert.ok(f.expected != null, "expected from design facts");
  }
});

test("PR6B: an empty transcript yields no facts (never invented)", () => {
  assert.equal(collectGeometryFacts({ layout: [] }).length, 0);
  assert.equal(collectGeometryFacts(null).length, 0);
});

test("PR6B: compareGeometry — required unmapped fact is non-green; optional unmapped skips", () => {
  const facts = [
    { id: "A", family: "control-height", category: "control-height", required: true, trust: "literal-design", expected: 40, tolerance: 2, unit: "px", mapping: { kind: "control" }, remediation: "fix" },
    { id: "B", family: "table-box", category: "table-density", required: false, trust: "literal-design", expected: 200, tolerance: 2, unit: "px", mapping: { kind: "control" }, remediation: "fix" },
  ];
  const checks = compareGeometry(facts, [{ factId: "A", status: "missing" }, { factId: "B", status: "missing" }]);
  assert.equal(checks.find((c) => c.id === "A").status, "fail", "required unmapped → fail");
  assert.equal(checks.find((c) => c.id === "B").status, "skip", "optional unmapped → skip");
});

test("PR6B: compareGeometry — tolerance boundary semantics (inside/at/outside)", () => {
  const mk = (expected) => ({ id: "X", family: "line-height", category: "typography", required: true, trust: "literal-design", expected, tolerance: 1, unit: "px", mapping: { kind: "text" }, remediation: "fix" });
  const run = (actual) => compareGeometry([mk(20)], [{ factId: "X", status: "unique", actual, candidates: 1 }])[0];
  assert.equal(run(20).status, "pass", "exact");
  assert.equal(run(21).status, "pass", "exactly at tolerance");
  assert.equal(run(22).status, "fail", "just outside tolerance");
  assert.equal(run(30).status, "fail", "large mismatch");
  assert.equal(run(22).delta, 2, "delta reported");
  assert.equal(run(22).tolerance, 1, "tolerance reported");
  assert.equal(run(22).unit, "px", "unit reported");
});

test("PR6B: compareGeometry — an optional mismatch is a warning, never a blocking fail", () => {
  const facts = [{ id: "Y", family: "button-height", category: "button-geometry", required: false, trust: "literal-design", expected: 40, tolerance: 2, unit: "px", mapping: { kind: "button-text" }, remediation: "fix" }];
  const c = compareGeometry(facts, [{ factId: "Y", status: "unique", actual: 21, candidates: 1 }])[0];
  assert.equal(c.status, "warn", "optional design-frame mismatch warns");
});

// ---------- browser-backed (skip when unavailable) ----------

async function runFixture(t, which) {
  if (!fixtureReady()) { t.skip("mount fixture deps missing"); return null; }
  try {
    return await renderVerify({ ...readComponent(which), transcript, fixtureDir: MOUNT_FIX });
  } catch (err) {
    if (isSkip(err)) { t.skip(`chromium not installed — ${String(err?.message ?? err)}`); return null; }
    throw err;
  }
}

test("PR6B: known-good geometry fixture passes (root padding, control height, line-height, divider)", async (t) => {
  const r = await runFixture(t, "known-good");
  if (!r) return;
  assert.equal(r.state, "pass", "known-good fixture passes");
  const byId = Object.fromEntries(r.checks.map((c) => [c.id, c]));
  assert.equal(byId["SUI-RENDER-GEOMETRY-001"].status, "pass", "root padding");
  assert.equal(byId["SUI-RENDER-GEOMETRY-002"].status, "pass", "control height");
  assert.equal(byId["SUI-RENDER-GEOMETRY-005"].status, "pass", "line height");
  assert.equal(byId["SUI-RENDER-GEOMETRY-004"].status, "pass", "divider");
});

test("PR6B: defect geometry fixture visual-fails with a measurable delta", async (t) => {
  const r = await runFixture(t, "defect");
  if (!r) return;
  assert.equal(r.state, "visual-fail", "defect fixture fails");
  const lh = r.checks.find((c) => c.id === "SUI-RENDER-GEOMETRY-005");
  assert.equal(lh.status, "fail");
  assert.equal(lh.expected, 20);
  assert.equal(lh.actual, 30);
  assert.equal(lh.delta, 10);
});

test("PR6B: geometry diagnostics are deterministic across repeated runs", async (t) => {
  if (!fixtureReady()) { t.skip("mount fixture deps missing"); return; }
  const runs = [];
  for (let i = 0; i < 2; i++) {
    try { runs.push(await renderVerify({ ...readComponent("known-good"), transcript, fixtureDir: MOUNT_FIX })); }
    catch (err) { if (isSkip(err)) { t.skip(`chromium not installed — ${String(err?.message ?? err)}`); return; } throw err; }
  }
  const sig = (r) => JSON.stringify(r.checks.filter((c) => c.name === "renderGeometry").map((c) => [c.id, c.status, c.actual]));
  assert.equal(sig(runs[0]), sig(runs[1]), "geometry results identical across runs");
});

test("PR6B: tolerances are centralized (no scattered magic numbers)", () => {
  assert.equal(GEOMETRY_TOLERANCE.box, 2);
  assert.equal(GEOMETRY_TOLERANCE.line, 1);
  const facts = collectGeometryFacts(transcript);
  for (const f of facts) assert.ok(Object.values(GEOMETRY_TOLERANCE).includes(f.tolerance), `${f.id} uses a centralized tolerance`);
});

// --- PR 6B corrective patch: MAP-001 (mapping ambiguity) + DOC-001 (control-height contract) ---

test("PR6Bc MAP-001: an ambiguous required mapping is non-green (no first-pick)", () => {
  const f = { id: "X", family: "line-height", category: "typography", required: true, trust: "literal-design", expected: 20, tolerance: 1, unit: "px", mapping: { kind: "text" }, remediation: "add a locator" };
  const c = compareGeometry([f], [{ factId: "X", status: "ambiguous", candidates: 3, candidateSummaries: [{ tag: "div" }, { tag: "span" }] }])[0];
  assert.equal(c.status, "fail", "required ambiguity → fail");
  assert.equal(c.mapping, "ambiguous");
  assert.equal(c.candidateCount, 3);
  assert.match(c.detail, /visible candidate/, "diagnostic names the mapping problem");
  assert.doesNotMatch(c.detail, /tolerance/, "not presented as a geometry mismatch");
});

test("PR6Bc MAP-001: a missing required mapping is non-green, not a mismatch", () => {
  const f = { id: "X", family: "line-height", category: "typography", required: true, trust: "literal-design", expected: 20, tolerance: 1, unit: "px", mapping: { kind: "text" }, remediation: "fix" };
  const c = compareGeometry([f], [{ factId: "X", status: "missing" }])[0];
  assert.equal(c.status, "fail");
  assert.equal(c.mapping, "missing");
  assert.match(c.detail, /no visible element/);
});

test("PR6Bc MAP-001: optional ambiguity is a visible non-blocking warning", () => {
  const f = { id: "X", family: "button-height", category: "button-geometry", required: false, trust: "literal-design", expected: 40, tolerance: 2, unit: "px", mapping: { kind: "button-text" }, remediation: "fix" };
  const c = compareGeometry([f], [{ factId: "X", status: "ambiguous", candidates: 2, candidateSummaries: [] }])[0];
  assert.equal(c.status, "warn", "optional ambiguity warns, never blocks");
});

test("PR6Bc DOC-001: control-height is required for a literal visible control box", () => {
  const facts = collectGeometryFacts(transcript);
  const ch = facts.find((f) => f.id === "SUI-RENDER-GEOMETRY-002");
  assert.equal(ch.required, true, "control height is required");
  assert.equal(ch.box, "border-box");
});

test("PR6Bc DOC-001: control-height tolerance boundaries (40±2)", () => {
  const f = { id: "X", family: "control-height", category: "control-height", required: true, trust: "literal-design", expected: 40, tolerance: 2, unit: "px", mapping: { kind: "control" }, remediation: "fix" };
  const run = (actual) => compareGeometry([f], [{ factId: "X", status: "unique", actual, candidates: 1 }])[0];
  for (const v of [40, 38, 42]) assert.equal(run(v).status, "pass", `${v} within tolerance`);
  for (const v of [37.9, 42.1, 30]) assert.equal(run(v).status, "fail", `${v} outside tolerance blocks`);
  const c = run(42.1);
  assert.equal(c.required, true);
  assert.equal(c.tolerance, 2);
  assert.equal(c.unit, "px");
  assert.equal(c.delta, 2.1);
});

test("PR6Bc MAP-001 (browser): two visible controls matching one required fact → non-green", async (t) => {
  if (!fixtureReady()) { t.skip("mount fixture deps missing"); return; }
  // Two VISIBLE inputs in the template — the single control-height fact is ambiguous.
  const html = `<div class="content" style="padding:20px"><input class="a" style="height:40px;box-sizing:border-box"><input class="b" style="height:40px;box-sizing:border-box"></div>`;
  const scss = ".content{padding:20px}";
  let r;
  try { r = await renderVerify({ html, scss, ts: "", transcript, fixtureDir: MOUNT_FIX }); }
  catch (err) { if (isSkip(err)) { t.skip(`chromium not installed — ${String(err?.message ?? err)}`); return; } throw err; }
  const ch = r.checks.find((c) => c.id === "SUI-RENDER-GEOMETRY-002");
  assert.equal(ch.mapping, "ambiguous", "two visible inputs → ambiguous mapping");
  assert.equal(ch.status, "fail", "required ambiguity is non-green");
  assert.equal(r.state, "visual-fail", "render state blocks");
});

test("PR6Bc AGG (browser): zero required geometry facts is non-green, never a false pass", async (t) => {
  if (!fixtureReady()) { t.skip("mount fixture deps missing"); return; }
  // A transcript whose ONLY design fact is a button frame — optional by design. There is nothing
  // blocking to prove, so the render gate must report `unverifiable`, never `pass` (§9 aggregation).
  const buttonOnly = {
    version: 3, meta: { tier: 0, source: "figml", image: "geometry-fixture.xml", textQuality: "exact" },
    tokens: { colors: [], fonts: [] },
    layout: [{ id: "b1", type: "button", text: "Cari", w: 80, h: 40 }],
    images: [], icons: [],
  };
  const html = `<div class="content" style="padding:20px"><button class="btn btn-primary">Cari</button></div>`;
  const scss = ".content{padding:20px}";
  let r;
  try { r = await renderVerify({ html, scss, ts: "", transcript: buttonOnly, fixtureDir: MOUNT_FIX }); }
  catch (err) { if (isSkip(err)) { t.skip(`chromium not installed — ${String(err?.message ?? err)}`); return; } throw err; }
  const geom = r.checks.filter((c) => c.name === "renderGeometry");
  assert.ok(geom.length >= 1, "the optional button frame fact was collected");
  assert.ok(geom.every((c) => c.required === false), "none of them is required");
  assert.equal(r.state, "unverifiable", "zero required geometry is non-green");
  assert.equal(r.diagnostics[0].id, "SUI-RENDER-GEOMETRY-000", "names the missing-required-check gap");
});

test("PR6Bc MAP-001 (browser): a hidden duplicate does NOT create false ambiguity", async (t) => {
  if (!fixtureReady()) { t.skip("mount fixture deps missing"); return; }
  // One visible + one hidden input → unique after visible filtering.
  const html = `<div class="content" style="padding:20px"><input class="a" style="height:40px;box-sizing:border-box"><input class="b" hidden style="height:40px;box-sizing:border-box"></div>`;
  const scss = ".content{padding:20px}";
  let r;
  try { r = await renderVerify({ html, scss, ts: "", transcript, fixtureDir: MOUNT_FIX }); }
  catch (err) { if (isSkip(err)) { t.skip(`chromium not installed — ${String(err?.message ?? err)}`); return; } throw err; }
  const ch = r.checks.find((c) => c.id === "SUI-RENDER-GEOMETRY-002");
  assert.equal(ch.mapping, "unique", "hidden duplicate filtered → unique");
  assert.equal(ch.status, "pass", "measured the visible input");
});
