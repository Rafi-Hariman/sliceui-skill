import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { verifyComponent } from "../src/lib/verify.mjs";

// Regression eval: the HUMAN-WRITTEN reference (hope-result) must pass verify; the actual
// SliceUI output (slicui-result) must FAIL — the gap IS the corruption map. This pins the
// council's conclusion that hope is a regression target, not a validator.

const HERE = dirname(fileURLToPath(import.meta.url));
const TESTING = join(HERE, "..", "testing");
const HOPE = join(TESTING, "hope-result", "history-agreement");
const SLICE = join(TESTING, "slicui-result", "history-agreement");
const SLICEUI_DIR = join(TESTING, "slicui-result", ".sliceui");

function readComponent(dir) {
  const read = (ext) => {
    const p = join(dir, `history-agreement.component.${ext}`);
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

test("eval: hope-result passes verify (regression target green)", (t) => {
  const gt = loadGroundTruth();
  if (!gt.conventions || !gt.transcript || !gt.rawXml) {
    t.skip("ground truth artifacts not present in testing/slicui-result/.sliceui");
    return;
  }
  const { scss, html, ts } = readComponent(HOPE);
  const r = verifyComponent({ scss, html, ts, ...gt });
  // hope is 98% — it may carry a single minor warn/fail (dropped toggle-caret), but NOT the
  // four corruption signals: hashed selectors, invented icon color, phantom wrapper.
  const bad = r.checks.filter((c) =>
    ["noHashedSelectors", "iconColor", "phantomWrapper"].includes(c.name) && c.status === "fail",
  );
  assert.deepEqual(bad, [], `hope must not carry corruption signals, got: ${JSON.stringify(bad)}`);
});

test("eval: slicui-result fails verify (the corruption is caught)", (t) => {
  const gt = loadGroundTruth();
  if (!gt.conventions || !gt.transcript || !gt.rawXml) {
    t.skip("ground truth artifacts not present in testing/slicui-result/.sliceui");
    return;
  }
  const { scss, html, ts } = readComponent(SLICE);
  const r = verifyComponent({ scss, html, ts, ...gt });
  // At least one corruption signal must fire.
  const corruption = r.checks.filter((c) =>
    ["noHashedSelectors", "iconColor", "phantomWrapper"].includes(c.name) && c.status === "fail",
  );
  assert.ok(corruption.length > 0, "slicui-result must trigger corruption checks");
});
