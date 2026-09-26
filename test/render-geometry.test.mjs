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
import { collectGeometryFacts, compareGeometry, GEOMETRY_TOLERANCE, factKey } from "../src/framework/angular/render-geometry.mjs";
import { renderVerify } from "../src/framework/angular/render-verify.mjs";
import { indexSelectorMap } from "../src/framework/angular/selector-map.mjs";

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
    // The box semantics vocabulary extends in PR 6C (§12) — typography-style and container-frame
    // join border-box/structural. Every fact must still declare one of the bounded set.
    assert.ok(["border-box", "content-box", "container-frame", "structural", "typography-style"].includes(f.box), `box semantic: ${f.box}`);
    // An exact-match family (border color, font family) compares by equality and carries no pixel
    // tolerance — `null` is the honest encoding, not a missing bound.
    assert.ok(f.tolerance == null || f.tolerance >= 0, "bounded tolerance");
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
  for (const f of facts) {
    if (f.tolerance == null) continue; // exact-match family — equality, not a pixel bound
    assert.ok(Object.values(GEOMETRY_TOLERANCE).includes(f.tolerance), `${f.id} uses a centralized tolerance`);
  }
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

// ---------- PR 6C: structural families, locator map, typography ----------

const STRUCT = join(FIX, "structural");
const structTranscript = JSON.parse(readFileSync(join(STRUCT, "transcript.json"), "utf8"));
const structMap = JSON.parse(readFileSync(join(STRUCT, "geometry.map.json"), "utf8"));

function readStructural(which) {
  const read = (ext) => {
    const p = join(STRUCT, which, `geometry.component.${ext}`);
    return existsSync(p) ? readFileSync(p, "utf8") : "";
  };
  return { scss: read("scss"), html: read("html"), ts: read("ts") };
}
async function runStructural(t, which) {
  if (!fixtureReady()) { t.skip("mount fixture deps missing"); return null; }
  try {
    return await renderVerify({ ...readStructural(which), transcript: structTranscript, fixtureDir: MOUNT_FIX, selectorMap: structMap });
  } catch (err) {
    if (isSkip(err)) { t.skip(`chromium not installed — ${String(err?.message ?? err)}`); return null; }
    throw err;
  }
}

test("PR6C: structural facts come from the transcript, never from the map", () => {
  const facts = collectGeometryFacts(structTranscript, indexSelectorMap(structMap));
  // The map supplies a locator only — every expected value below is a transcript fact.
  const gap = facts.find((f) => f.family === "gap");
  assert.equal(gap.expected, 12, "gap expected from the design's itemSpacing");
  assert.equal(gap.mapping.selector, "[data-fx='toolbar']", "locator from the map");
  // BOR-001: a uniform border fact expects all four sides equal.
  assert.deepEqual(facts.find((f) => f.family === "border-width").expected, [1, 1, 1, 1]);
  assert.deepEqual(facts.find((f) => f.family === "border-color").expected, ["#b1bccc", "#b1bccc", "#b1bccc", "#b1bccc"]);
  assert.deepEqual(facts.find((f) => f.family === "radius").expected, [6, 6, 6, 6]);
  assert.equal(facts.find((f) => f.family === "font-family").expected, "inter");
  assert.equal(facts.find((f) => f.family === "letter-spacing").expected, 0.5);
});

test("PR6C: a design node with a fact but NO locator emits nothing (no guessed locator)", () => {
  // Same transcript, empty map → structural families cannot bind, so they must not be emitted.
  const facts = collectGeometryFacts(structTranscript, new Map());
  assert.equal(facts.filter((f) => f.family === "gap").length, 0);
  assert.equal(facts.filter((f) => f.family === "radius").length, 0);
  // Typography needs no locator (text mapping) and must still be present.
  assert.ok(facts.some((f) => f.family === "font-family"), "text-mapped families survive without a map");
});

test("PR6C (browser): known-good structural fixture passes every family", async (t) => {
  const r = await runStructural(t, "known-good");
  if (!r) return;
  assert.equal(r.state, "pass", `known-good passes; failures: ${r.checks.filter((c) => c.status === "fail").map((c) => c.detail).join(" | ")}`);
  const byFamily = Object.fromEntries(r.checks.map((c) => [c.family, c]));
  for (const fam of ["gap", "border-width", "border-color", "radius", "letter-spacing", "font-family", "font-size-body"]) {
    assert.equal(byFamily[fam]?.status, "pass", `${fam} passes`);
  }
});

test("PR6C (browser): each intended structural defect is caught with a measurable delta", async (t) => {
  const r = await runStructural(t, "defect");
  if (!r) return;
  assert.equal(r.state, "visual-fail", "defect fixture fails");
  const byFamily = Object.fromEntries(r.checks.map((c) => [c.family, c]));
  assert.equal(byFamily.gap.status, "fail", "gap defect blocks");
  assert.equal(byFamily.gap.actual, 20, "measured gap reported");
  assert.equal(byFamily.gap.expected, 12);
  assert.equal(byFamily.gap.delta, 8);
  assert.equal(byFamily.radius.status, "fail", "radius defect blocks");
  assert.equal(byFamily["border-color"].status, "fail", "border color defect blocks");
});

test("PR6C: radius tolerance boundary (exact/at/outside)", () => {
  const mk = (expected) => ({ id: "R", family: "radius", category: "radius", required: true, trust: "literal-design", expected, tolerance: 1, unit: "px" });
  const run = (actual) => compareGeometry([mk([6, 6, 6, 6])], [{ factId: "R", status: "unique", actual, candidates: 1 }])[0];
  assert.equal(run([6, 6, 6, 6]).status, "pass", "exact");
  assert.equal(run([7, 5, 6, 7]).status, "pass", "each corner within ±1");
  assert.equal(run([8, 6, 6, 6]).status, "fail", "one corner outside blocks");
  // A `50%` elliptical corner returns null — inconclusive, never a silent pass.
  assert.equal(run([null, 6, 6, 6]).status, "fail", "an unmeasurable corner is non-green");
});

test("PR6C: exact-match families compare by equality, not by pixel tolerance", () => {
  const mk = (expected, tolerance = null) => ({ id: "C", family: "border-color", category: "border", required: true, trust: "literal-design", expected, tolerance, unit: null });
  const run = (f, actual) => compareGeometry([f], [{ factId: "C", status: "unique", actual, candidates: 1 }])[0];
  assert.equal(run(mk("#b1bccc"), "#b1bccc").status, "pass");
  assert.equal(run(mk("#b1bccc"), "#000000").status, "fail", "any difference blocks (no tolerance to hide it)");
  assert.equal(run(mk("#b1bccc"), null).status, "fail", "unmeasured required fact is non-green");
  assert.equal(run(mk("#b1bccc"), "#b1bccc").tolerance, null, "no invented tolerance");
});

test("PR6C: font-weight uses the centralized weight tolerance (exact enum)", () => {
  assert.equal(GEOMETRY_TOLERANCE.weight, 0);
  const f = { id: "W", family: "font-weight-body", category: "typography", required: true, trust: "literal-design", expected: 700, tolerance: GEOMETRY_TOLERANCE.weight, unit: null };
  const run = (actual) => compareGeometry([f], [{ factId: "W", status: "unique", actual, candidates: 1 }])[0];
  assert.equal(run(700).status, "pass");
  assert.equal(run(400).status, "fail", "a different weight is a material mismatch");
  assert.equal(run(null).status, "fail", "unmeasured is non-green");
});

test("PR6C: a fact family may contribute several facts without collapsing to the first", () => {
  // Two text nodes both bearing a font-size-body fact must be independently addressable — the
  // stable diagnostic id is shared, so the per-fact key must disambiguate by design node.
  const a = { id: "SUI-RENDER-TYPO-002", family: "font-size-body", designNodeId: "h1" };
  const b = { id: "SUI-RENDER-TYPO-002", family: "font-size-body", designNodeId: "c1" };
  assert.notEqual(factKey(a), factKey(b), "distinct design nodes → distinct keys");
  // A fact with no design node keeps the bare id (the PR 6B contract).
  assert.equal(factKey({ id: "X" }), "X");
});

test("PR6C (browser): unintended horizontal overflow is non-green; a fitting container passes", async (t) => {
  if (!fixtureReady()) { t.skip("mount fixture deps missing"); return; }
  const tr = {
    version: 3, meta: { tier: 0, source: "figml", image: "x.xml", textQuality: "exact" },
    tokens: { colors: [], fonts: [] },
    layout: [{ id: "root", type: "group", w: 300, h: 200, padding: { top: 10, right: 10, bottom: 10, left: 10 } }],
    images: [], icons: [],
  };
  const run = async (html) => {
    try { return await renderVerify({ html, scss: ".content{padding:10px}", ts: "", transcript: tr, fixtureDir: MOUNT_FIX }); }
    catch (err) { if (isSkip(err)) { t.skip(`chromium not installed — ${String(err?.message ?? err)}`); return null; } throw err; }
  };
  const fits = await run(`<div class="content" style="width:280px">ok</div>`);
  if (!fits) return;
  assert.equal(fits.state, "pass", "a container that fits passes");
  assert.equal(fits.checks.find((c) => c.family === "overflow-x").status, "pass");

  const over = await run(`<div class="content" style="width:280px;padding:10px"><div style="width:900px;height:20px">wide</div></div>`);
  const ox = over.checks.find((c) => c.family === "overflow-x");
  assert.equal(ox.status, "fail", "unintended overflow blocks");
  assert.ok(ox.actual > 0, `overflow amount reported (got ${ox.actual})`);
  assert.equal(over.state, "visual-fail");
});

test("PR6C: a selector-map-bound required fact that maps to nothing is non-green", () => {
  const f = { id: "G", family: "gap", category: "spacing", required: true, trust: "literal-design", expected: 12, tolerance: GEOMETRY_TOLERANCE.gap, unit: "px", designNodeId: "toolbar" };
  const c = compareGeometry([f], [{ key: factKey(f), status: "missing" }])[0];
  assert.equal(c.status, "fail", "a missing required locator target blocks");
  assert.equal(c.mapping, "missing");
});

test("PR6C: a selector-map-bound required fact matching several elements is ambiguous", () => {
  const f = { id: "P", family: "radius", category: "radius", required: true, trust: "literal-design", expected: [6, 6, 6, 6], tolerance: 1, unit: "px", designNodeId: "panel" };
  const c = compareGeometry([f], [{ key: factKey(f), status: "ambiguous", candidates: 3 }])[0];
  assert.equal(c.status, "fail", "required ambiguity blocks — the map does not bypass PR 6B");
  assert.equal(c.mapping, "ambiguous");
});

// ---------- PR 6C corrective patch: OVF-001 (objective overflow) + BOR-001 (full-side border) ----------

function correctiveTranscript(children = []) {
  return {
    version: 3, meta: { tier: 0, source: "figml", image: "x.xml", textQuality: "exact" },
    tokens: { colors: [], fonts: [] },
    layout: [{ id: "root", type: "group", w: 300, h: 200, padding: { top: 10, right: 10, bottom: 10, left: 10 }, children }],
    images: [], icons: [],
  };
}

test("PR6Cc BOR-001 (browser): a uniform border with a wrong bottom/left side is non-green", async (t) => {
  if (!fixtureReady()) { t.skip("mount fixture deps missing"); return; }
  const tr = correctiveTranscript([{ id: "panel", type: "group", w: 100, h: 50, radius: 6, border: { color: "#b1bccc", width: 1 }, children: [] }]);
  const sm = { version: 1, mappings: [{ designNodeId: "panel", renderLocator: { strategy: "css", selector: ".panel" } }] };
  const run = (scss) => renderVerify({ html: `<div class="content" style="padding:10px"><div class="panel">x</div></div>`, scss, ts: "", transcript: tr, fixtureDir: MOUNT_FIX, selectorMap: sm });
  // Correct all sides → pass.
  let r = await run(".content{padding:10px}.panel{border:1px solid #b1bccc;border-radius:6px}");
  assert.equal(r.state, "pass", "all sides correct passes");
  // Wrong bottom + left → must fail on both width and color.
  r = await run(".content{padding:10px}.panel{border-top:1px solid #b1bccc;border-right:1px solid #b1bccc;border-bottom:4px solid #ff0000;border-left:9px solid #00ff00;border-radius:6px}");
  const bw = r.checks.find((c) => c.family === "border-width");
  const bc = r.checks.find((c) => c.family === "border-color");
  assert.equal(bw.status, "fail", "wrong side width blocks");
  assert.deepEqual(bw.actual, [1, 1, 4, 9], "all four widths measured");
  assert.equal(bc.status, "fail", "wrong side color blocks");
  assert.equal(r.state, "visual-fail");
});

test("PR6Cc OVF-001 (browser): a required mapped element outside the viewport is non-green", async (t) => {
  if (!fixtureReady()) { t.skip("mount fixture deps missing"); return; }
  const tr = correctiveTranscript([{ id: "btn", type: "button", text: "Far", w: 80, h: 40 }]);
  const sm = { version: 1, mappings: [{ designNodeId: "btn", renderLocator: { strategy: "css", selector: "button" } }] };
  const run = (html) => renderVerify({ html, scss: ".content{padding:10px}", ts: "", transcript: tr, fixtureDir: MOUNT_FIX, selectorMap: sm });
  // Inside viewport → off-viewport passes.
  let r = await run(`<div class="content" style="padding:10px"><button>Cari</button></div>`);
  assert.equal(r.checks.find((c) => c.family === "off-viewport").status, "pass");
  // Far outside → off-viewport fails, state visual-fail.
  r = await run(`<div class="content" style="padding:10px"><button style="position:absolute;left:99999px">Far</button></div>`);
  const ov = r.checks.find((c) => c.family === "off-viewport");
  assert.equal(ov.status, "fail", "off-viewport required element blocks");
  assert.ok(ov.actual > 0, `out-of-bounds distance reported (${ov.actual})`);
  assert.equal(r.state, "visual-fail");
});

test("PR6Cc OVF-001 (browser): overflow:hidden without measurable clipping still passes", async (t) => {
  if (!fixtureReady()) { t.skip("mount fixture deps missing"); return; }
  const tr = correctiveTranscript([{ id: "btn", type: "button", text: "Cari", w: 80, h: 40 }]);
  const sm = { version: 1, mappings: [{ designNodeId: "btn", renderLocator: { strategy: "css", selector: "button" } }] };
  const r = await renderVerify({
    html: `<div class="content" style="padding:10px;overflow:hidden"><button>Cari</button></div>`,
    scss: ".content{padding:10px}", ts: "", transcript: tr, fixtureDir: MOUNT_FIX, selectorMap: sm,
  });
  assert.equal(r.state, "pass", "overflow:hidden alone never fails (§24 r3)");
  assert.equal(r.checks.find((c) => c.family === "overflow-x").status, "pass");
  assert.equal(r.checks.find((c) => c.family === "overflow-y").status, "pass");
});

test("PR6Cc BOR-001 (pure): uniform border facts carry four sides, never a scalar", () => {
  const tr = correctiveTranscript([{ id: "panel", type: "group", w: 100, h: 50, border: { color: "#b1bccc", width: 1 }, children: [] }]);
  const im = indexSelectorMap({ version: 1, mappings: [{ designNodeId: "panel", renderLocator: { strategy: "css", selector: ".panel" } }] });
  const facts = collectGeometryFacts(tr, im);
  assert.deepEqual(facts.find((f) => f.family === "border-width").expected, [1, 1, 1, 1]);
  assert.deepEqual(facts.find((f) => f.family === "border-color").expected, ["#b1bccc", "#b1bccc", "#b1bccc", "#b1bccc"]);
});

test("PR6Cc OVF-001 (pure): a mapped required element contributes objective overflow facts", () => {
  const tr = correctiveTranscript([{ id: "panel", type: "group", w: 100, h: 50, children: [] }]);
  const im = indexSelectorMap({ version: 1, mappings: [{ designNodeId: "panel", renderLocator: { strategy: "css", selector: ".panel" } }] });
  const facts = collectGeometryFacts(tr, im);
  const families = facts.filter((f) => f.category === "overflow").map((f) => f.family);
  assert.ok(families.includes("overflow-x") && families.includes("overflow-y"), "page container x+y overflow");
  assert.ok(families.includes("element-overflow"), "mapped element content overflow");
  assert.ok(families.includes("off-viewport"), "mapped element off-viewport");
});

// ---------- PR 6Cc corrective: BOR-001 border presence ----------

const borderFact = (expected = [1, 1, 1, 1]) => ({
  id: "BW", family: "border-width", category: "border", required: true,
  trust: "literal-design", expected, tolerance: GEOMETRY_TOLERANCE.border, unit: "px",
});
const borderRun = (actual, expected) => compareGeometry([borderFact(expected)], [{ factId: "BW", status: "unique", actual, candidates: 1 }])[0];

test("PR6Cc BOR-001: an ABSENT required border fails despite the ±1px numeric tolerance", () => {
  // Design 1px vs actual 0px has |delta| = 1px, which the general tolerance would accept. A
  // required visible border is not "approximately correct" when it does not exist.
  const c = borderRun([0, 0, 0, 0]);
  assert.equal(c.status, "fail", "a 0px required border is absent, not within tolerance");
  assert.equal(c.required, true);
  assert.match(c.detail, /absent/, "the diagnostic names presence, not a pixel bound");
  assert.match(c.detail, /top\/right\/bottom\/left/, "all four absent sides are named deterministically");
});

test("PR6Cc BOR-001: each individual absent side fails, and the diagnostic names it", () => {
  const sides = ["top", "right", "bottom", "left"];
  for (let i = 0; i < 4; i++) {
    const actual = [1, 1, 1, 1];
    actual[i] = 0;
    const c = borderRun(actual);
    assert.equal(c.status, "fail", `${sides[i]} absent → fail`);
    assert.match(c.detail, new RegExp(sides[i]), `diagnostic names the ${sides[i]} side`);
  }
});

test("PR6Cc BOR-001: presence does not disturb the normal non-zero tolerance boundary", () => {
  assert.equal(borderRun([1, 1, 1, 1]).status, "pass", "exact");
  assert.equal(borderRun([2, 2, 2, 2]).status, "pass", "at tolerance (±1)");
  assert.equal(borderRun([2.1, 2.1, 2.1, 2.1]).status, "fail", "just outside tolerance");
  assert.equal(borderRun([3, 3, 3, 3]).status, "fail", "large mismatch");
  // The presence rule must not loosen or tighten the numeric family for present borders.
  const outside = borderRun([2.1, 1, 1, 1]);
  assert.equal(outside.status, "fail");
  assert.equal(outside.tolerance, GEOMETRY_TOLERANCE.border, "centralized tolerance unchanged");
});

test("PR6Cc BOR-001: a required border-color at 0px width cannot pass on computed color alone", () => {
  // The browser's computed color is meaningless where no border is rendered — the measured value
  // is null (unmeasured), which is non-green for a required fact rather than a silent equality.
  const f = { id: "BC", family: "border-color", category: "border", required: true, trust: "literal-design", expected: ["#b1bccc", "#b1bccc", "#b1bccc", "#b1bccc"], tolerance: null, unit: null };
  const c = compareGeometry([f], [{ factId: "BC", status: "unique", actual: [null, null, null, null], candidates: 1 }])[0];
  assert.equal(c.status, "fail", "an unmeasured (zero-width) side color is non-green");
});

test("PR6Cc BOR-001 (browser): an entirely absent required border is a visual-fail", async (t) => {
  if (!fixtureReady()) { t.skip("mount fixture deps missing"); return; }
  // A 1px BLACK design border is the worst case: Chromium's computed border-color default is
  // rgb(0,0,0), so a color-only comparison would compare #000000 to #000000 and pass a border that
  // is not rendered at all.
  const tr = correctiveTranscript([{ id: "card", type: "group", w: 100, h: 50, border: { color: "#000000", width: 1 }, children: [] }]);
  const sm = { version: 1, mappings: [{ designNodeId: "card", renderLocator: { strategy: "css", selector: ".card" } }] };
  const run = (style) => renderVerify({
    html: `<div class="content" style="padding:10px"><div class="card" style="${style}">x</div></div>`,
    scss: ".content{padding:10px}", ts: "", transcript: tr, fixtureDir: MOUNT_FIX, selectorMap: sm,
  });
  for (const [label, style] of [["no border rule", ""], ["border:none", "border:none"], ["border-width:0", "border-width:0"]]) {
    const r = await run(style);
    const bw = r.checks.find((c) => c.family === "border-width");
    const bc = r.checks.find((c) => c.family === "border-color");
    assert.equal(bw.status, "fail", `${label}: absent border width fails`);
    assert.equal(bc.status, "fail", `${label}: zero-width computed color cannot pass`);
    assert.equal(r.state, "visual-fail", `${label}: render blocks`);
  }
  // A border painted at alpha 0 HAS width but renders nothing: the width may legitimately match,
  // and the invisible color is rejected as an opaque pass by the color comparison.
  {
    const r = await run("border:1px solid rgba(0,0,0,0)");
    const bc = r.checks.find((c) => c.family === "border-color");
    assert.equal(bc.status, "fail", "transparent color cannot compare equal to an opaque design value");
    assert.equal(r.state, "visual-fail");
  }
  // The control: the same design rendered correctly still passes.
  const ok = await run("border:1px solid #000000");
  assert.equal(ok.state, "pass", "a correctly rendered black border passes");
});

test("PR6Cc BOR-001 (browser): a fully transparent border color is not an opaque pass", async (t) => {
  if (!fixtureReady()) { t.skip("mount fixture deps missing"); return; }
  const tr = correctiveTranscript([{ id: "card", type: "group", w: 100, h: 50, border: { color: "#b1bccc", width: 1 }, children: [] }]);
  const sm = { version: 1, mappings: [{ designNodeId: "card", renderLocator: { strategy: "css", selector: ".card" } }] };
  const r = await renderVerify({
    html: `<div class="content" style="padding:10px"><div class="card" style="border:1px solid rgba(177,188,204,0)">x</div></div>`,
    scss: ".content{padding:10px}", ts: "", transcript: tr, fixtureDir: MOUNT_FIX, selectorMap: sm,
  });
  const bc = r.checks.find((c) => c.family === "border-color");
  assert.equal(bc.status, "fail", "alpha-0 discards to transparency, never to the authored hex");
  assert.equal(r.state, "visual-fail");
});

// ---------- PR 6Cc corrective: AGG-001 verdict precedence ----------

test("PR6Cc AGG-001 (browser): a required style mismatch outranks the zero-required-geometry guard", async (t) => {
  if (!fixtureReady()) { t.skip("mount fixture deps missing"); return; }
  // The only GEOMETRY fact is an optional button frame, but the design also carries a required
  // authored style fact (title color) that the render gets wrong. The real required failure must
  // win as visual-fail — `unverifiable` would mask a measured defect.
  const tr = {
    version: 3, meta: { tier: 0, source: "figml", image: "x.xml", textQuality: "exact" },
    tokens: { colors: [], fonts: [] },
    layout: [
      { id: "t1", type: "text", text: "Daftar Item", w: 100, h: 20, style: { color: "#000000" } },
      { id: "b1", type: "button", text: "Cari", w: 80, h: 40, style: { size: 14 } },
    ],
    images: [], icons: [],
  };
  let r;
  try {
    r = await renderVerify({
      html: `<div class="content"><h1 class="title">Daftar Item</h1><button class="btn">Cari</button></div>`,
      scss: `:host{display:block}.content{padding:20px}.title{color:#ff0000}.btn{font-size:14px}`,
      ts: "", transcript: tr, fixtureDir: MOUNT_FIX,
    });
  } catch (err) { if (isSkip(err)) { t.skip(`chromium not installed — ${String(err?.message ?? err)}`); return; } throw err; }
  const styleFail = r.checks.find((c) => c.name === "renderStyle" && c.status === "fail");
  assert.ok(styleFail, "the required style mismatch is measured");
  assert.equal(r.state, "visual-fail", "a required failure is never downgraded to unverifiable");
  assert.equal(r.exitCode, 1);
  assert.ok(r.diagnostics.some((d) => d.id === "SUI-RENDER-STYLE-001"), "the failing style diagnostic is preserved");
  assert.ok(!r.diagnostics.some((d) => d.id === "SUI-RENDER-GEOMETRY-000"), "the zero-required guard does not pre-empt");
  // §20 counters: a required comparison that EXECUTED and FAILED counts as executed evidence.
  assert.equal(r.metrics.requiredFailureCount, 1);
  assert.equal(r.metrics.requiredExecutedCount, 1);
  assert.equal(r.metrics.requiredPassCount, 0);
});

test("PR6Cc AGG-001 (browser): zero required evidence stays unverifiable when nothing failed", async (t) => {
  if (!fixtureReady()) { t.skip("mount fixture deps missing"); return; }
  // Button-only design: the single geometry fact is optional and no authored style fact exists.
  // Nothing blocking was executed → unverifiable, never a pass.
  const tr = {
    version: 3, meta: { tier: 0, source: "figml", image: "x.xml", textQuality: "exact" },
    tokens: { colors: [], fonts: [] },
    layout: [{ id: "b1", type: "button", text: "Cari", w: 80, h: 40 }], images: [], icons: [],
  };
  let r;
  try {
    r = await renderVerify({ html: `<div class="content" style="padding:20px"><button class="btn">Cari</button></div>`, scss: ".content{padding:20px}", ts: "", transcript: tr, fixtureDir: MOUNT_FIX });
  } catch (err) { if (isSkip(err)) { t.skip(`chromium not installed — ${String(err?.message ?? err)}`); return; } throw err; }
  assert.equal(r.state, "unverifiable");
  assert.equal(r.exitCode, 3);
  assert.equal(r.diagnostics[0].id, "SUI-RENDER-GEOMETRY-000");
});

test("PR6Cc AGG-001 (browser): a runtime error outranks a geometry failure", async (t) => {
  if (!fixtureReady()) { t.skip("mount fixture deps missing"); return; }
  // An uncaught page error invalidates the rendered evidence — precedence 1 (§19) beats a
  // geometry `visual-fail`, and the geometry diagnostic is retained, not hidden.
  const tr = {
    version: 3, meta: { tier: 0, source: "figml", image: "x.xml", textQuality: "exact" },
    tokens: { colors: [], fonts: [] },
    layout: [{ id: "root", type: "group", w: 300, h: 200, padding: { top: 10, right: 10, bottom: 10, left: 10 },
      children: [{ id: "search", type: "input", label: "P", w: 100, h: 40 }] }], images: [], icons: [],
  };
  let r;
  try {
    r = await renderVerify({
      html: `<div class="content" style="padding:10px"><input style="height:60px;box-sizing:border-box">{{ nope.deep.val }}</div>`,
      scss: ".content{padding:10px}", ts: "", transcript: tr, fixtureDir: MOUNT_FIX,
    });
  } catch (err) { if (isSkip(err)) { t.skip(`chromium not installed — ${String(err?.message ?? err)}`); return; } throw err; }
  assert.equal(r.state, "runtime-fail", "runtime/setup failure has the highest precedence");
  assert.ok(r.diagnostics.some((d) => d.id === "SUI-RENDER-RUNTIME-002"), "the runtime diagnostic is present");
});

// ---------- PR 6Cc corrective: DIA-001 diagnostic contract ----------

test("PR6Cc DIA-001 (browser): projected diagnostics carry a bounded detail, never undefined", async (t) => {
  const r = await runStructural(t, "defect");
  if (!r) return;
  assert.ok(r.diagnostics.length, "the defect fixture produces diagnostics");
  for (const d of r.diagnostics) {
    assert.equal(typeof d.detail, "string", `${d.id} carries a detail string`);
    assert.ok(d.detail.length > 0 && d.detail !== "undefined", `${d.id} detail is populated and bounded`);
  }
});
