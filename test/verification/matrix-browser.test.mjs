// matrix (browser, FULL PATH) — known-good / known-bad for the remaining relationship categories.
// Every pair runs: intent constraint → compileVerificationPlan → locator map → Angular mount →
// collectDomEvidence (getBoundingClientRect + computed style) → verifier verdict.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { fixtureReady, isSkip, mountAndVerify } from "./browser-harness.mjs";
import { ingestDesign } from "../../src/design/ingest.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const g = (intent) => ({ constraints: intent, tables: [], content: [], states: [] });

async function run(t, opts) {
  if (!fixtureReady()) { t.skip("mount fixture deps missing"); return null; }
  try { return await mountAndVerify(opts); }
  catch (err) { if (isSkip(err)) { t.skip("chromium unavailable"); return null; } throw err; }
}

// ---------- parent-child alignment ----------

const alignIntent = (expected) => g([{ type: "ALIGNMENT", childId: "c", parentId: "p", axis: "x", value: expected }]);

test("alignment (browser): END-aligned child touching the parent end edge passes", async (t) => {
  const out = await run(t, {
    html: `<div class="p"><div class="c"></div></div>`,
    scss: `.p{width:600px;height:80px;display:flex;justify-content:flex-end}.c{width:100px;height:40px}`,
    map: { p: ".p", c: ".c" }, intentGraph: alignIntent("END"),
  });
  if (!out) return;
  const check = out.result.checks.find((c) => c.family === "alignment");
  assert.equal(check.status, "pass", check.detail);
});

test("alignment (browser): expected END but rendered START fails from DOM geometry", async (t) => {
  const out = await run(t, {
    html: `<div class="p"><div class="c"></div></div>`,
    scss: `.p{width:600px;height:80px;display:flex;justify-content:flex-start}.c{width:100px;height:40px}`,
    map: { p: ".p", c: ".c" }, intentGraph: alignIntent("END"),
  });
  if (!out) return;
  const check = out.result.checks.find((c) => c.family === "alignment");
  assert.equal(check.status, "fail");
  assert.equal(check.actual, "START", "the verdict is measured, not authored");
});

test("alignment (browser): expected CENTER but visibly offset fails", async (t) => {
  const out = await run(t, {
    html: `<div class="p"><div class="c"></div></div>`,
    scss: `.p{width:600px;height:80px;display:flex;justify-content:flex-end;padding-right:120px}.c{width:100px;height:40px}`,
    map: { p: ".p", c: ".c" }, intentGraph: alignIntent("CENTER"),
  });
  if (!out) return;
  const check = out.result.checks.find((c) => c.family === "alignment");
  assert.equal(check.status, "fail", `offset from center — ${check.detail}`);
});

// ---------- relative size ----------

const RATIO = 301 / 969; // ≈ 0.311 (the designed search width / toolbar width)
const relIntent = () => g([{ type: "RELATIVE_SIZE", childId: "c", parentId: "p", axis: "x", value: 0.311, tolerance: 0.05 }]);

test("relative size (browser): child/parent ratio ≈ 301/969 passes with dimensions + delta reported", async (t) => {
  const out = await run(t, {
    html: `<div class="p"><div class="c"></div></div>`,
    scss: `.p{width:969px;height:80px}.c{width:301px;height:40px}`,
    map: { p: ".p", c: ".c" }, intentGraph: relIntent(),
  });
  if (!out) return;
  const check = out.result.checks.find((c) => c.family === "relative-size");
  assert.equal(check.status, "pass", check.detail);
  assert.ok(Math.abs(check.actual - RATIO) < 0.02, `actual ratio ${check.actual}`);
  const pw = out.evidence.rects.get("p").width, cw = out.evidence.rects.get("c").width;
  assert.ok(Math.abs(pw - 969) < 2 && Math.abs(cw - 301) < 2, `absolute dimensions reported (${cw}/${pw})`);
});

test("relative size (browser): a materially different ratio fails", async (t) => {
  const out = await run(t, {
    html: `<div class="p"><div class="c"></div></div>`,
    scss: `.p{width:969px;height:80px}.c{width:100px;height:40px}`,
    map: { p: ".p", c: ".c" }, intentGraph: relIntent(),
  });
  if (!out) return;
  const check = out.result.checks.find((c) => c.family === "relative-size");
  assert.equal(check.status, "fail");
  assert.ok(Math.abs(check.actual - RATIO) > 0.15, `measured ${check.actual} vs design ${RATIO.toFixed(3)}`);
});

// ---------- containment / overflow ----------

const containIntent = (escapeAllowed) => g([{ type: "CONTAINMENT", childId: "c", parentId: "p", escapeAllowed }]);

test("containment (browser): a critical child inside its parent passes", async (t) => {
  const out = await run(t, {
    html: `<div class="p"><div class="c"></div></div>`,
    scss: `.p{width:400px;height:200px;position:relative}.c{width:100px;height:50px}`,
    map: { p: ".p", c: ".c" }, intentGraph: containIntent(false),
  });
  if (!out) return;
  assert.equal(out.result.checks.find((c) => c.family === "containment").status, "pass");
});

test("containment (browser): a child escaping its intended parent fails", async (t) => {
  const out = await run(t, {
    html: `<div class="p"><div class="c"></div></div>`,
    scss: `.p{width:400px;height:200px;position:relative}.c{position:absolute;width:100px;height:50px;left:350px}`,
    map: { p: ".p", c: ".c" }, intentGraph: containIntent(false),
  });
  if (!out) return;
  const check = out.result.checks.find((c) => c.family === "containment");
  assert.equal(check.status, "fail", check.detail);
});

test("containment (browser): an explicitly escaping overlay topology is NOT failed", async (t) => {
  const out = await run(t, {
    html: `<div class="p"><div class="c"></div></div>`,
    scss: `.p{width:400px;height:200px;position:relative}.c{position:absolute;width:100px;height:50px;left:380px}`,
    map: { p: ".p", c: ".c" }, intentGraph: containIntent(true),
  });
  if (!out) return;
  const check = out.result.checks.find((c) => c.family === "containment");
  assert.equal(check.status, "pass", "designed escape is not a containment defect");
});

// ---------- grid tracks ----------

const GRID_HTML = `<div class="grid">${["a", "b", "c", "d", "e", "f"].map((k) => `<div class="cell ${k}">${k}</div>`).join("")}</div>`;
const gridIntent = (cols, rows) => g([{
  type: "GRID_TRACKS", regionId: "rg",
  nodeIds: ["a", "b", "c", "d", "e", "f"], cells: ["a", "b", "c", "d", "e", "f"].map((id) => ({ id })),
  value: { columns: cols, rows: rows }, tolerance: 1,
}]);
const gridMap = Object.fromEntries(["a", "b", "c", "d", "e", "f"].map((k) => [k, `.cell.${k}`]));

test("grid (browser): 3×2 CSS grid tracks match intent", async (t) => {
  const out = await run(t, {
    html: GRID_HTML,
    scss: `.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;width:900px}.cell{height:100px}`,
    map: gridMap, intentGraph: gridIntent(3, 2),
  });
  if (!out) return;
  const check = out.result.checks.find((c) => c.family === "grid-track");
  assert.equal(check.status, "pass", check.detail);
});

test("grid (browser): a 2-column render fails a 3-column intent", async (t) => {
  const out = await run(t, {
    html: GRID_HTML,
    scss: `.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:20px;width:900px}.cell{height:100px}`,
    map: gridMap, intentGraph: gridIntent(3, 2),
  });
  if (!out) return;
  const check = out.result.checks.find((c) => c.family === "grid-track");
  assert.equal(check.status, "fail");
  assert.deepEqual(check.actual, { columns: 2, rows: 3 }, "the rendered track count is measured");
});

// ---------- overlay anchor ----------

const anchorIntent = () => g([{ type: "ANCHOR", nodeId: "badge", anchorNodeId: "card", value: { horizontal: "END", vertical: "START" }, tolerance: 2 }]);

test("anchor (browser): a top-right badge stays anchored (getBoundingClientRect deltas)", async (t) => {
  const out = await run(t, {
    html: `<div class="card"><div class="badge"></div></div>`,
    scss: `.card{width:300px;height:200px;position:relative}.badge{position:absolute;top:0;right:0;width:40px;height:40px}`,
    map: { card: ".card", badge: ".badge" }, intentGraph: anchorIntent(),
  });
  if (!out) return;
  const check = out.result.checks.find((c) => c.family === "anchor");
  assert.equal(check.status, "pass", check.detail);
});

test("anchor (browser): the wrong corner fails", async (t) => {
  const out = await run(t, {
    html: `<div class="card"><div class="badge"></div></div>`,
    scss: `.card{width:300px;height:200px;position:relative}.badge{position:absolute;top:0;left:0;width:40px;height:40px}`,
    map: { card: ".card", badge: ".badge" }, intentGraph: anchorIntent(),
  });
  if (!out) return;
  const check = out.result.checks.find((c) => c.family === "anchor");
  assert.equal(check.status, "fail");
  assert.equal(check.actual.horizontal, "START", "measured against the intended parent");
});

// ---------- exact visible repeated content (DESIGNED_VISIBLE vs RUNTIME_SYNTHETIC) ----------

const XML = readFileSync(join(HERE, "..", "fixtures", "mahasiswa-tarif", "raw.xml"), "utf8");
const realTable = ingestDesign(XML, "mahasiswa-tarif.xml").intentGraph.tables[0];

function tableHtml(rows) {
  const th = realTable.headers.map((h) => `<th>${h.value}</th>`).join("");
  const tr = rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("");
  return `<table><thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table>`;
}
const designedRows = realTable.designedVisibleRows.map((r) => r.cells.map((c) => c.value));
const syntheticRows = designedRows.map((_, i) => [`Representative ${i + 1}`, "00000000", "Synthetic Name", "Synthetic Faculty", "Synthetic Prodi", "Synthetic Skema", "0.000.000", "Aktif"]);
const tableIntent = () => ({ constraints: [], tables: [{ tableNodeId: "tbl", headers: realTable.headers, designedVisibleRows: realTable.designedVisibleRows }], content: [], states: [] });

test("repeated content (browser): designed-visible data renders exactly → pass", async (t) => {
  const out = await run(t, {
    html: tableHtml(designedRows),
    scss: `table{border-collapse:collapse}td,th{padding:2px 6px}`,
    map: {}, intentGraph: tableIntent(),
  });
  if (!out) return;
  const check = out.result.checks.find((c) => c.family === "table-content");
  assert.equal(check.status, "pass", check.detail);
  assert.equal(out.result.state, "pass");
});

test("repeated content (browser): designed values replaced by representative synthetic data → fail", async (t) => {
  const out = await run(t, {
    html: tableHtml(syntheticRows),
    scss: `table{border-collapse:collapse}td,th{padding:2px 6px}`,
    map: {}, intentGraph: tableIntent(),
  });
  if (!out) return;
  assert.equal(out.result.state, "fail");
  const check = out.result.checks.find((c) => c.family === "table-content");
  assert.equal(check.status, "fail");
  assert.ok(check.actual.missingCells.includes("Mahasiswa Contoh A"), "the DESIGNED_VISIBLE value was replaced by RUNTIME_SYNTHETIC data");
});
