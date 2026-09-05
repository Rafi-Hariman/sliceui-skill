import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readFileSync, existsSync } from "node:fs";
import { verifyComponent } from "../src/framework/angular/verify.mjs";

// Regression eval (REVIVED 2026-09-05, SYNTHETIC fixture): a HUMAN-WRITTEN reference vs a
// machine slice of the SAME design, verified against the SAME ground truth. This is the closest
// the repo has to a rendered-correct oracle without a browser: it proves the verify gate
// SEPARATES correct human output (title #000 == design) from drifted machine output (#555).
//
// The fixture is synthetic + tracked (test/fixtures/eval-hope/) — no real customer data — so this
// test runs in CI permanently (the earlier version skipped forever on untracked testing/ artifacts
// and an obsolete premise). It exercises exactly the defect WS4 (styleFidelity value-coverage)
// exists to catch, on a small controlled pair:
//   - HOPE  sample-card (hand-correct)   → .h1 { color: #000000 } → styleFidelity PASSES.
//   - SLICE sample-card (machine drift)  → .h1 { color: #555555 } → styleFidelity FAILS (#555 vs #000).
// Both are structurally clean (no [_ngcontent-*], no wrong fa-* color, no phantom wrapper), so the
// corruption axis is kept as an over-flag guard — NOT asserted-as-corrupt.

const HERE = dirname(fileURLToPath(import.meta.url));
const FIX = join(HERE, "fixtures", "eval-hope");
const HOPE = join(FIX, "hope");
const SLICE = join(FIX, "slice");
const GT = join(FIX, "ground-truth");

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
  const conventions = readJson(join(GT, "conventions.json"));
  const transcript = readJson(join(GT, "transcript.json"));
  const rawXml = readFileSync(join(GT, "raw.xml"), "utf8");
  return { conventions, transcript, rawXml };
}

const NAME = "sample-card"; // component basename used by both hope and slice

test("eval: human reference passes styleFidelity while the machine slice fails it (A/B on the same design)", (t) => {
  const gt = loadGroundTruth();
  if (!gt.conventions || !gt.transcript || !gt.rawXml) {
    t.skip("eval-hope fixture not present in test/fixtures/eval-hope/ground-truth");
    return;
  }
  // HOPE honors the design title color (#000) → value-coverage passes.
  const hope = verifyComponent({ ...readComponent(HOPE, NAME), ...gt });
  const hopeFid = hope.checks.find((c) => c.name === "styleFidelity");
  assert.equal(hopeFid.status, "pass", `human reference must not drift from design values: ${JSON.stringify(hopeFid.detail)}`);

  // SLICE drifted .h1 to #555 → WS4's value-coverage catches it.
  const slice = verifyComponent({ ...readComponent(SLICE, NAME), ...gt });
  const sliceFid = slice.checks.find((c) => c.name === "styleFidelity");
  assert.equal(sliceFid.status, "fail", `machine slice's title-color drift must be caught: ${JSON.stringify(sliceFid.detail)}`);
  assert.match(sliceFid.detail, /color/i, "styleFidelity failure names the drifted property");
});

test("eval: neither hope nor slice trips structural corruption signals (over-flag guard)", (t) => {
  const gt = loadGroundTruth();
  if (!gt.conventions || !gt.transcript || !gt.rawXml) {
    t.skip("eval-hope fixture not present in test/fixtures/eval-hope/ground-truth");
    return;
  }
  for (const [label, dir] of [["HOPE", HOPE], ["SLICE", SLICE]]) {
    const r = verifyComponent({ ...readComponent(dir, NAME), ...gt });
    const corrupt = r.checks.filter((c) =>
      ["noHashedSelectors", "iconColor", "phantomWrapper"].includes(c.name) && c.status === "fail",
    );
    assert.deepEqual(corrupt, [], `${label} must not trip structural corruption signals: ${JSON.stringify(corrupt)}`);
  }
});
