// responsive (browser, FULL PATH) — safety at multiple widths: page overflow, control overlap,
// critical clipping, FILL tracking, responsive table strategy.
//
// Widths: the fixture exposes NO project breakpoints (projectContext.responsive is null), so
// [1200, 480] are documented LAYOUT-SAFETY PROBES, not design targets. Every width here is
// RESPONSIVE_INFERRED (no responsive design variant is supplied).
//
// Each pair runs: responsive safety requirement → compileVerificationPlan → semantic target mapping
// (controls/critical/fill/scrollers bound to intent node ids) → Angular mount at each width →
// collectResponsiveEvidence (documentElement.scrollWidth/clientWidth, rects) → verifier verdict.
import { test } from "node:test";
import assert from "node:assert/strict";
import { fixtureReady, isSkip, mountAndVerifyResponsive } from "./browser-harness.mjs";

const VIEWPORTS = [{ width: 1200 }, { width: 480 }];
const intent = () => ({ constraints: [], tables: [], content: [], states: [], responsive: { variants: [], designVerified: false } });

async function run(t, opts) {
  if (!fixtureReady()) { t.skip("mount fixture deps missing"); return null; }
  try { return await mountAndVerifyResponsive({ viewports: VIEWPORTS, intentGraph: intent(), ...opts }); }
  catch (err) { if (isSkip(err)) { t.skip("chromium unavailable"); return null; } throw err; }
}
const respCheck = (out) => out.result.checks.find((c) => c.family === "responsive-safety");

// ---------- page-level horizontal overflow ----------

test("overflow (browser): fluid content stays inside the viewport at both widths", async (t) => {
  const out = await run(t, { html: `<div class="content"><p>fluid</p></div>`, scss: `.content{width:100%;padding:8px;box-sizing:border-box}` });
  if (!out) return;
  const c = respCheck(out);
  assert.equal(c.status, "pass", c.detail);
  assert.ok(out.evidence.every((w) => w.pageOverflow === 0), "document never scrolls sideways");
});

test("overflow (browser): wide content inside an INTENDED scroller does not overflow the page", async (t) => {
  const out = await run(t, {
    html: `<div class="scroll"><div class="wide">wide</div></div>`,
    scss: `.scroll{overflow-x:auto;max-width:100%}.wide{width:1600px;height:20px}`,
    scrollers: [".scroll"],
  });
  if (!out) return;
  const c = respCheck(out);
  assert.equal(c.status, "pass", "the scroller absorbs the width — not a defect");
  const narrow = out.evidence.find((w) => w.width === 480);
  assert.ok(narrow.scrollers[0].scrollWidth > narrow.scrollers[0].clientWidth, "scroller dimensions reported (scrollWidth > clientWidth)");
  assert.equal(narrow.pageOverflow, 0, "the DOCUMENT does not scroll");
});

test("overflow (browser): a fixed desktop child causes document-level overflow → FAIL", async (t) => {
  const out = await run(t, { html: `<div class="fixed">x</div>`, scss: `.fixed{width:1200px;height:20px}` });
  if (!out) return;
  const c = respCheck(out);
  assert.equal(c.status, "fail");
  const narrow = out.evidence.find((w) => w.width === 480);
  const f = c.actual.findings.find((x) => x.kind === "page-overflow");
  assert.ok(f, "the finding is page-level");
  assert.ok(narrow.documentWidths.scrollWidth > narrow.documentWidths.clientWidth, "documentElement scrollWidth/clientWidth reported");
  assert.ok(f.detail.includes("scrollWidth"), "the evidence names both widths");
});

// ---------- control overlap ----------

test("overlap (browser): toolbar controls wrap without overlap at the narrow width", async (t) => {
  const out = await run(t, {
    html: `<div class="toolbar"><button class="ctl">Filter One</button><button class="ctl">Filter Two</button><button class="ctl">Filter Three</button></div>`,
    scss: `.toolbar{display:flex;flex-wrap:wrap;gap:8px}.ctl{padding:6px 14px}`,
    controls: [".ctl"],
  });
  if (!out) return;
  assert.equal(respCheck(out).status, "pass");
});

test("overlap (browser): overlapping controls at a narrow viewport → FAIL (rects compared)", async (t) => {
  const out = await run(t, {
    html: `<div class="toolbar"><button class="a ctl">Alpha Action</button><button class="b ctl">Beta Action</button></div>`,
    scss: `.toolbar{display:flex}.ctl{padding:6px 14px}.b{margin-left:-70px}`,
    controls: [".ctl"],
  });
  if (!out) return;
  const c = respCheck(out);
  assert.equal(c.status, "fail");
  const overlap = c.actual.findings.find((x) => x.kind === "overlap");
  assert.ok(overlap && overlap.evidence.area > 0, "the overlap area is measured from bounding rectangles");
});

// ---------- critical content clipping ----------

test("clipping (browser): a critical action stays inside the usable region", async (t) => {
  const out = await run(t, {
    html: `<div class="region"><button class="action">Simpan</button></div>`,
    scss: `.region{padding:8px}.action{padding:6px 14px}`,
    critical: [{ nodeId: "saveAction", selector: ".action" }], region: ".region",
  });
  if (!out) return;
  assert.equal(respCheck(out).status, "pass");
});

test("clipping (browser): a critical action outside the usable region → FAIL", async (t) => {
  const out = await run(t, {
    html: `<div class="region"><button class="action">Simpan</button></div>`,
    scss: `.region{padding:8px;position:relative}.action{position:absolute;left:-80px;top:0}`,
    critical: [{ nodeId: "saveAction", selector: ".action" }], region: ".region",
  });
  if (!out) return;
  const c = respCheck(out);
  assert.equal(c.status, "fail");
  const clip = c.actual.findings.find((x) => x.kind === "clipping");
  assert.equal(clip.evidence.nodeId, "saveAction", "the intent node id is named");
  assert.ok(clip.evidence.outsideBy > 0, "the outside distance is measured");
});

// ---------- FILL behavior ----------

test("fill (browser): a FILL intent node tracks its parent at wide AND narrow widths", async (t) => {
  const out = await run(t, {
    html: `<div class="parent"><div class="fill">f</div></div>`,
    scss: `.parent{width:100%}.fill{width:100%;height:20px}`,
    fill: [{ nodeId: "fillNode", selector: ".fill" }],
  });
  if (!out) return;
  const c = respCheck(out);
  assert.equal(c.status, "pass", c.detail);
  for (const w of out.evidence) {
    const f = w.fill.find((x) => x.nodeId === "fillNode");
    assert.ok(Math.abs(f.ratio - 1) <= 0.05, `ratio ${f.ratio} at ${w.width}px (${f.width}/${f.parentWidth})`);
  }
});

test("fill (browser): a FILL intent node pinned to a desktop width stops tracking → FAIL", async (t) => {
  const out = await run(t, {
    html: `<div class="parent"><div class="fill">f</div></div>`,
    scss: `.parent{width:100%;overflow:hidden}.fill{width:1200px;height:20px}`,
    fill: [{ nodeId: "fillNode", selector: ".fill" }],
  });
  if (!out) return;
  const c = respCheck(out);
  assert.equal(c.status, "fail");
  const fill = c.actual.findings.find((x) => x.kind === "fill");
  const narrow = out.evidence.find((w) => w.width === 480).fill.find((x) => x.nodeId === "fillNode");
  assert.ok(fill.detail.includes("does not track"), "the defect is named");
  assert.ok(narrow.ratio > 1.5, `measured ratio ${narrow.ratio} at 480px`);
});

// ---------- responsive table strategy ----------

test("table strategy (browser): the intended scroll container absorbs the table width", async (t) => {
  const out = await run(t, {
    html: `<div class="table-scroll"><table><tr>${"<td>xxxxxxxxxx</td>".repeat(12)}</tr></table></div>`,
    scss: `.table-scroll{overflow-x:auto;max-width:100%}td{white-space:nowrap;padding:4px 10px}`,
    scrollers: [".table-scroll"],
  });
  if (!out) return;
  const c = respCheck(out);
  assert.equal(c.status, "pass", "native scroller — the page does not widen");
  const narrow = out.evidence.find((w) => w.width === 480);
  assert.equal(narrow.pageOverflow, 0);
  assert.ok(narrow.scrollers[0].scrollWidth > narrow.scrollers[0].clientWidth, "the scroller itself scrolls (intended)");
});

test("table strategy (browser): a table with no scroll strategy widens the whole page → FAIL", async (t) => {
  const out = await run(t, {
    html: `<table class="wide-table"><tr>${"<td>xxxxxxxxxx</td>".repeat(12)}</tr></table>`,
    scss: `.wide-table td{white-space:nowrap;padding:4px 10px}`,
  });
  if (!out) return;
  const c = respCheck(out);
  assert.equal(c.status, "fail");
  const narrow = out.evidence.find((w) => w.width === 480);
  assert.ok(narrow.pageOverflow > 0, "the table width caused page-level overflow");
});
