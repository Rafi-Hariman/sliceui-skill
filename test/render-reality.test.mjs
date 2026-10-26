// render-reality probes — the three browser-truth capabilities (render-reality remediation).
//
//   A. effective inter-item spacing: the design `gap` is a target RENDERED relationship; the gap
//      fact measures next.top − previous.bottom, so gap-stacked-on-framework-margin FAILS even
//      though the computed `gap` property matches the design.
//   B. runtime visibility: a design-evidenced visible state (the pagination footer) must actually
//      render after mount — "design requires visible state + rendered absent" is a defect no
//      static check can prove.
//   C. computed cascade: with the project's real loaded CSS injected into the mount, the
//      border-color/radius facts measure the COMPUTED winner — an authored override that loses
//      the cascade FAILS; a production-proven recipe (here `!important`) that wins PASSES; and a
//      plain override that already wins is NOT failed merely for lacking `!important`.
//
// Browser-backed tests skip gracefully when chromium / the mount fixture are unavailable (CI
// provisions both). Pure-fact tests always run.

import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readFileSync, existsSync } from "node:fs";
import { renderVerify } from "../src/framework/angular/render-verify.mjs";
import { collectGeometryFacts } from "../src/framework/angular/render-geometry.mjs";
import { paginationEvidence } from "../src/lib/design-resolution.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const MOUNT_FIX = join(HERE, "fixtures", "angular-mount");
const SPACING = join(HERE, "fixtures", "render-geometry", "spacing");
const VISIBILITY = join(HERE, "fixtures", "render-geometry", "visibility");
const CASCADE = join(HERE, "fixtures", "render-geometry", "cascade");

function fixtureReady() { return existsSync(join(MOUNT_FIX, "node_modules", "@angular", "core")); }
function isSkip(err) { return /Executable doesn't exist|npx playwright install|browserType\.launch|Cannot find package 'playwright'/.test(String(err?.message ?? err ?? "")); }

async function run(t, opts) {
  if (!fixtureReady()) { t.skip("mount fixture deps missing — run `cd test/fixtures/angular-mount && npm ci`"); return null; }
  try { return await renderVerify({ fixtureDir: MOUNT_FIX, ...opts }); }
  catch (err) {
    if (isSkip(err)) { t.skip(`chromium not installed — run \`npx playwright install chromium\` (${String(err?.message ?? err)})`); return null; }
    throw err;
  }
}

function readFixture(dir, stem) {
  const read = (ext) => { const p = join(dir, `${stem}.component.${ext}`); return existsSync(p) ? readFileSync(p, "utf8") : ""; };
  return { scss: read("scss"), html: read("html"), ts: read("ts") };
}

// ---------- pure: pagination evidence + visible-state fact scoping ----------

const visTranscript = JSON.parse(readFileSync(join(VISIBILITY, "transcript.json"), "utf8"));

test("paginationEvidence compiles the design footer into total/pageSize runtime state", () => {
  const pg = paginationEvidence(visTranscript);
  assert.equal(pg.total, 30, "total from 'dari 30'");
  assert.equal(pg.pageSize, 10, "page size from '1-10'");
  assert.equal(pg.visibleStart, 1);
  assert.equal(pg.visibleEnd, 10);
  assert.equal(paginationEvidence({ layout: [{ id: "x", type: "text", text: "Halo" }] }), null, "no pagination evidence → null");
});

test("visible-state fact is scoped to footers the component's OWN template renders", () => {
  const own = collectGeometryFacts(visTranscript, null, "<div>Menampilkan 1-10 dari 30 data</div>");
  const fact = own.find((f) => f.family === "visible-state");
  assert.ok(fact, "own-template footer emits the visible-state fact");
  assert.equal(fact.required, true, "design-required state is blocking");
  assert.equal(fact.expected, true);
  assert.match(fact.remediation, /30/, "remediation explains the designed state (design evidence, not a generic threshold)");

  const library = collectGeometryFacts(visTranscript, null, "<div><uii-table [rows]=\"rows\"></uii-table></div>");
  assert.equal(library.filter((f) => f.family === "visible-state").length, 0, "a library-internal footer cannot render in the synthetic mount — honestly skipped, never falsely failed");
});

test("a design without pagination evidence emits no visible-state fact (no forced state)", () => {
  const facts = collectGeometryFacts({ layout: [{ id: "root", type: "group", padding: { top: 10, right: 10, bottom: 10, left: 10 } }] }, null, "<div>ok</div>");
  assert.equal(facts.filter((f) => f.family === "visible-state").length, 0);
});

// ---------- A. effective spacing (browser) ----------

const spacingTranscript = JSON.parse(readFileSync(join(SPACING, "transcript.json"), "utf8"));
const spacingMap = JSON.parse(readFileSync(join(SPACING, "spacing.map.json"), "utf8"));

test("spacing (browser): effective rendered distance — known-good passes", async (t) => {
  const r = await run(t, { ...readFixture(join(SPACING, "known-good"), "spacing"), transcript: spacingTranscript, selectorMap: spacingMap });
  if (!r) return;
  assert.equal(r.state, "pass", `known-good passes; failures: ${r.checks.filter((c) => c.status === "fail").map((c) => c.detail).join(" | ")}`);
  const gap = r.checks.find((c) => c.family === "gap");
  assert.equal(gap.status, "pass");
  assert.equal(gap.actual, 10, "rendered inter-row distance = design gap");
});

test("spacing (browser): design gap stacked on a child margin fails on the EFFECTIVE distance", async (t) => {
  // The defect fixture sets `gap: 10px` (the computed gap property MATCHES the design) but adds a
  // framework-style child margin — the rendered distance is 25px. The old computed-gap oracle
  // passed this; the effective-distance oracle catches it.
  const r = await run(t, { ...readFixture(join(SPACING, "defect"), "spacing"), transcript: spacingTranscript, selectorMap: spacingMap });
  if (!r) return;
  assert.equal(r.state, "visual-fail", "stacked spacing is a visual failure");
  const gap = r.checks.find((c) => c.family === "gap");
  assert.equal(gap.status, "fail");
  assert.equal(gap.actual, 25, "measured 10px gap + 15px child margin");
  assert.equal(gap.expected, 10);
  assert.equal(gap.delta, 15);
});

// ---------- B. runtime visibility (browser) ----------

test("visibility (browser): designed pagination state renders → pass", async (t) => {
  const r = await run(t, { ...readFixture(join(VISIBILITY, "known-good"), "visibility"), transcript: visTranscript });
  if (!r) return;
  assert.equal(r.state, "pass", `known-good passes; failures: ${r.checks.filter((c) => c.status === "fail").map((c) => c.detail).join(" | ")}`);
  const vis = r.checks.find((c) => c.family === "visible-state");
  assert.equal(vis.status, "pass", "the designed pagination footer actually rendered");
});

test("visibility (browser): runtime state that prevents the designed pagination → FAIL", async (t) => {
  // The defect binds the footer on `rows.length > pageSize` with mock rows = one page — the exact
  // field defect: the source contains the footer, but the state prevents it from rendering.
  const r = await run(t, { ...readFixture(join(VISIBILITY, "defect"), "visibility"), transcript: visTranscript });
  if (!r) return;
  assert.equal(r.state, "visual-fail", "missing designed visible state is a visual failure");
  const vis = r.checks.find((c) => c.family === "visible-state");
  assert.equal(vis.status, "fail");
  assert.equal(vis.mapping, "missing", "the footer did not render");
  assert.match(vis.remediation, /Menampilkan 1-10 dari 30 data/, "remediation names the designed state");
});

// ---------- C. computed cascade (browser) ----------

const cascTranscript = JSON.parse(readFileSync(join(CASCADE, "transcript.json"), "utf8"));
const cascMap = JSON.parse(readFileSync(join(CASCADE, "cascade.map.json"), "utf8"));
const libraryCss = readFileSync(join(CASCADE, "library.css"), "utf8");

test("cascade (browser): an authored override that LOSES the cascade is caught by computed style", async (t) => {
  const r = await run(t, { ...readFixture(join(CASCADE, "defect"), "cascade"), transcript: cascTranscript, selectorMap: cascMap, competingCss: libraryCss });
  if (!r) return;
  assert.equal(r.state, "visual-fail", "source presence is not proof of effect");
  const bc = r.checks.find((c) => c.family === "border-color");
  assert.equal(bc.status, "fail", "the authored override lost — the computed color is the library's");
  assert.equal(bc.actual[0], "#ff0000", "computed winner is the competing library rule");
  assert.equal(bc.expected[0], "#4fbbbb", "the design value was authored but did not win");
  const radius = r.checks.find((c) => c.family === "radius");
  assert.equal(radius.status, "fail", "radius likewise lost the cascade");
});

test("cascade (browser): a production-proven recipe that wins the cascade PASSES", async (t) => {
  const r = await run(t, { ...readFixture(join(CASCADE, "known-good"), "cascade"), transcript: cascTranscript, selectorMap: cascMap, competingCss: libraryCss });
  if (!r) return;
  assert.equal(r.state, "pass", `known-good passes; failures: ${r.checks.filter((c) => c.status === "fail").map((c) => c.detail).join(" | ")}`);
  const bc = r.checks.find((c) => c.family === "border-color");
  assert.equal(bc.status, "pass", "computed value matches the design — the recipe won");
});

test("cascade (browser): a plain override that already wins is NOT failed for lacking !important", async (t) => {
  // No competing CSS: the component's plain (non-!important) rule is the only one. The verdict is
  // the COMPUTED value — there is no universal `!important` requirement.
  const r = await run(t, { ...readFixture(join(CASCADE, "defect"), "cascade"), transcript: cascTranscript, selectorMap: cascMap });
  if (!r) return;
  assert.equal(r.state, "pass", "no competing rule → the plain override wins → pass");
  const bc = r.checks.find((c) => c.family === "border-color");
  assert.equal(bc.status, "pass");
  assert.equal(bc.actual[0], "#4fbbbb");
});
