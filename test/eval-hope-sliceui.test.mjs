import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { verifyComponent } from "../src/framework/angular/verify.mjs";

// Regression eval (REVIVED 2026-09-05): a HUMAN-WRITTEN reference vs a real SliceUI machine
// output, both for the SAME design ("ubah tagihan" bulk-filter screen), verified against the
// same ground truth. This is the closest the repo has to a rendered-correct oracle without a
// browser: it proves the verify gate SEPARATES correct human output from drifted machine output.
//
// Empirical finding that reshaped this test (was skipping forever on missing artifacts):
//   - HOPE reference-bulk-filter-table (hand-written)  → styleFidelity PASSES (title color #000 == design).
//   - SLICE edit-bill-end-date (real SliceUI v0.9-era output) → styleFidelity FAILS: .h1 color #555 vs design #000.
//   That A/B is exactly the defect WS4 (value-coverage ≥80%) exists to catch — now demonstrated on a
//   REAL artifact, not a synthetic fixture.
//   - BOTH are clean of the structural corruption signals (noHashedSelectors/iconColor/phantomWrapper):
//     these artifacts predate that hardening (v0.9), so the OLD premise "slice MUST trigger corruption"
//     is false here and was dropped — not asserted as corrupt.
//   - HOPE trips inventedUtility (mt-4/mt-0 = Bootstrap utilities not in the sliceui-result-11 codebase
//     vocabulary). That is the known golden-class over-flag, not corruption; documented, not asserted.

const HERE = dirname(fileURLToPath(import.meta.url));
const TESTING = join(HERE, "..", "testing");
const HOPE = join(TESTING, "hope-result", "reference-bulk-filter-table");
const SLICE = join(TESTING, "sliceui-result-11", "edit-bill-end-date");
const SLICEUI_DIR = join(TESTING, "sliceui-result-11", ".sliceui");

function readComponent(dir, name) {
  const read = (ext) => {
    const p = join(dir, `${name}.component.${ext}`);
    return existsSync(p) ? readFileSync(p, "utf8") : "";
  };
  return { scss: read("scss"), html: read("html"), ts: read("ts") };
}

function readJson(p) {
  try { return JSON.parse(readFileSync(p, "utf8")); } catch { return null; }
}

function loadGroundTruth() {
  const conventions = readJson(join(SLICEUI_DIR, "conventions.json"));
  const transcript = (() => {
    const tdir = join(SLICEUI_DIR, "transcript");
    if (!existsSync(tdir)) return null;
    const json = readdirSync(tdir).find((f) => f.endsWith(".transcript.json") && !f.endsWith(".meta.json"));
    return json ? readJson(join(tdir, json)) : null;
  })();
  const rawXml = (() => {
    const xdir = join(SLICEUI_DIR, "xml");
    if (!existsSync(xdir)) return null;
    const xml = readdirSync(xdir).find((f) => /\.(xml|figml)$/i.test(f));
    return xml ? readFileSync(join(xdir, xml), "utf8") : null;
  })();
  return { conventions, transcript, rawXml };
}

test("eval: human reference passes styleFidelity while the SliceUI slice fails it (real A/B on the same design)", (t) => {
  const gt = loadGroundTruth();
  if (!gt.conventions || !gt.transcript || !gt.rawXml) {
    t.skip("ground truth artifacts not present in testing/sliceui-result-11/.sliceui");
    return;
  }
  // HOPE: the hand-written component honors the design's title color (#000) → value-coverage passes.
  const hope = verifyComponent({ ...readComponent(HOPE, "reference-bulk-filter-table"), ...gt });
  const hopeFid = hope.checks.find((c) => c.name === "styleFidelity");
  assert.equal(hopeFid.status, "pass", `human reference must not drift from design values: ${JSON.stringify(hopeFid.detail)}`);

  // SLICE: the machine output drifted .h1 color to #555 → WS4's value-coverage catches it.
  const slice = verifyComponent({ ...readComponent(SLICE, "edit-bill-end-date"), ...gt });
  const sliceFid = slice.checks.find((c) => c.name === "styleFidelity");
  assert.equal(sliceFid.status, "fail", `machine slice's title-color drift must be caught: ${JSON.stringify(sliceFid.detail)}`);
  assert.match(sliceFid.detail, /color/i, "styleFidelity failure names the drifted property");
});

test("eval: neither artifact carries structural corruption signals (they predate hardening) — guards against verify over-flagging", (t) => {
  const gt = loadGroundTruth();
  if (!gt.conventions || !gt.transcript || !gt.rawXml) {
    t.skip("ground truth artifacts not present in testing/sliceui-result-11/.sliceui");
    return;
  }
  // Regression guard: verify's structural corruption checks (hashed selectors, invented icon color,
  // phantom wrapper) must NOT false-fire on a human-written reference OR a normal slice — those axes
  // are for genuinely corrupt output (leaked [_ngcontent-*], wrong fa-* color, wrapper the design lacks).
  for (const [label, comp] of [
    ["HOPE", readComponent(HOPE, "reference-bulk-filter-table")],
    ["SLICE", readComponent(SLICE, "edit-bill-end-date")],
  ]) {
    const r = verifyComponent({ ...comp, ...gt });
    const corrupt = r.checks.filter((c) =>
      ["noHashedSelectors", "iconColor", "phantomWrapper"].includes(c.name) && c.status === "fail",
    );
    assert.deepEqual(corrupt, [], `${label} must not trip structural corruption signals: ${JSON.stringify(corrupt)}`);
  }
});
