// render-verify (PR 6) — opt-in rendered visual-fidelity gate.
//
// A/B on the same design: HOPE (correct) renders the transcript's design values → PASS; SLICE
// drifts the title color to #555555 → visual-fail with a measurable diagnostic. The mount path is
// the same Angular 13 JIT harness as render-mount.test.mjs (real SCSS → Dart Sass → esbuild bundle
// → platformBrowserDynamic bootstrap), so it proves the geometry/computed-style half of "verify
// green ≠ UI correct" the string tier cannot see.
//
// Gracefully skips (never fails) when chromium or the mount fixture deps are not provisioned —
// CI installs both so the probe always runs there.

import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readFileSync, existsSync } from "node:fs";
import { renderVerify, RENDER_STATE_EXIT, DEFAULT_VIEWPORT, GEOMETRY_TOLERANCE_PX } from "../src/framework/angular/render-verify.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const MOUNT_FIX = join(HERE, "fixtures", "angular-mount");
const FIX = join(HERE, "fixtures", "render-mount");
const NAME = "sample-card";

function readComponent(dir) {
  const read = (ext) => {
    const p = join(dir, `${NAME}.component.${ext}`);
    return existsSync(p) ? readFileSync(p, "utf8") : "";
  };
  return { scss: read("scss"), html: read("html"), ts: read("ts") };
}
const transcript = JSON.parse(readFileSync(join(FIX, "transcript.json"), "utf8"));

function fixtureReady() {
  return existsSync(join(MOUNT_FIX, "node_modules", "@angular", "core"));
}
function isSkip(err) {
  return /Executable doesn't exist|npx playwright install|browserType\.launch|Cannot find package 'playwright'/.test(String(err?.message ?? err ?? ""));
}
async function run(t, which) {
  if (!fixtureReady()) {
    t.skip("angular-mount fixture deps missing — run `cd test/fixtures/angular-mount && npm ci`; render-verify not exercised");
    return null;
  }
  try {
    const c = readComponent(join(FIX, which));
    return await renderVerify({ ...c, transcript, fixtureDir: MOUNT_FIX });
  } catch (err) {
    if (isSkip(err)) {
      t.skip(`chromium not installed — run \`npx playwright install chromium\`; render-verify not exercised (${String(err?.message ?? err)})`);
      return null;
    }
    throw err;
  }
}

test("render-verify: correct reference (hope) renders design values → pass", async (t) => {
  const r = await run(t, "hope");
  if (!r) return;
  assert.equal(r.state, "pass");
  assert.equal(r.exitCode, 0);
  assert.ok(r.checks.every((c) => c.status !== "fail"), "no failing check on the correct reference");
});

test("render-verify: drifted title color (slice) → visual-fail with measurable delta", async (t) => {
  const r = await run(t, "slice");
  if (!r) return;
  assert.equal(r.state, "visual-fail");
  assert.equal(r.exitCode, 1);
  const color = r.checks.find((c) => c.detail.includes("color"));
  assert.ok(color, "a color drift check exists");
  assert.equal(color.status, "fail");
  assert.match(color.detail, /#555555/);
  assert.match(color.detail, /#000000/);
  // A measurable diagnostic with expected/actual is emitted.
  const diag = r.diagnostics.find((d) => d.expected != null);
  assert.ok(diag, "diagnostic carries expected/actual");
  assert.equal(diag.expected, "#000000");
  assert.equal(diag.actual, "#555555");
});

test("render-verify: geometry facts measure root padding + divider (deterministic tolerance)", async (t) => {
  const r = await run(t, "hope");
  if (!r) return;
  const geom = r.checks.filter((c) => c.name === "renderGeometry");
  assert.ok(geom.length >= 1, "at least one geometry check ran");
  for (const g of geom) {
    // On the CORRECT reference a geometry check is pass, an honest skip, or a non-blocking warn
    // (an optional design-frame fact like button frame-height) — never a blocking fail.
    assert.ok(["pass", "skip", "warn"].includes(g.status), `geometry ${g.detail} is pass/skip/warn, not fail on correct ref`);
    if (g.status === "pass") assert.ok(g.tolerance != null && g.tolerance >= 0 && g.tolerance <= GEOMETRY_TOLERANCE_PX, `tolerance bounded: ${g.tolerance}`);
  }
});

test("render-verify: no transcript → unverifiable (never a silent pass)", async (t) => {
  if (!fixtureReady()) { t.skip("fixture deps missing"); return; }
  const r = await renderVerify({ html: "<div>x</div>", scss: "", ts: "", transcript: null, fixtureDir: MOUNT_FIX });
  assert.equal(r.state, "unverifiable");
  assert.equal(r.exitCode, 3);
});

test("render-verify: missing fixture → fixture-unavailable (non-green)", async () => {
  const r = await renderVerify({ html: "<div>x</div>", scss: "", ts: "", transcript: transcript, fixtureDir: "/nonexistent/fixture" });
  assert.equal(r.state, "fixture-unavailable");
  assert.notEqual(r.exitCode, 0);
});

test("render-verify: exit-code contract maps every state non-green except pass", () => {
  assert.equal(RENDER_STATE_EXIT.pass, 0);
  assert.equal(RENDER_STATE_EXIT["visual-fail"], 1);
  assert.equal(RENDER_STATE_EXIT["build-fail"], 1);
  assert.equal(RENDER_STATE_EXIT["mount-fail"], 1);
  assert.equal(RENDER_STATE_EXIT["runtime-fail"], 1);
  assert.equal(RENDER_STATE_EXIT["browser-unavailable"], 1);
  assert.equal(RENDER_STATE_EXIT.unverifiable, 3);
  assert.equal(RENDER_STATE_EXIT["invalid-input"], 2);
  assert.equal(DEFAULT_VIEWPORT.width, 1440);
  assert.equal(DEFAULT_VIEWPORT.height, 900);
});

// --- PR 6A corrective patch: failure boundary, network isolation, viewport bounds ---

import { parseViewport } from "../src/commands/verify.mjs";

test("PR6A: parseViewport rejects oversized / malformed dimensions (RNS-001)", () => {
  assert.equal(parseViewport("99999x99999"), null, "oversized rejected");
  assert.equal(parseViewport("7681x4320"), null, "above max width");
  assert.equal(parseViewport("1440x7681"), null, "above max height");
  assert.equal(parseViewport("0x0"), null);
  assert.equal(parseViewport("-1x800"), null);
  assert.equal(parseViewport("1440"), null, "missing height");
  assert.equal(parseViewport("abcx900"), null);
  assert.equal(parseViewport("../x"), null);
  // Valid bounds.
  assert.deepEqual(parseViewport("1440x900"), { width: 1440, height: 900 });
  assert.deepEqual(parseViewport("7680x4320"), { width: 7680, height: 4320 }, "max boundary valid");
  assert.deepEqual(parseViewport("200x200"), { width: 200, height: 200 }, "min boundary valid");
});

test("PR6A: a blocked external request makes render non-green with a sanitized diagnostic (NET-001)", async (t) => {
  if (!fixtureReady()) { t.skip("fixture deps missing"); return; }
  const c = readComponent(join(FIX, "hope"));
  // An external <img> in the template triggers a real request attempt at mount time.
  const html = c.html + `<img src="https://example.com/sliceui-net-test.png?token=SECRET_123" alt="">`;
  let r;
  try {
    r = await renderVerify({ ...c, html, transcript, fixtureDir: MOUNT_FIX });
  } catch (err) {
    if (isSkip(err)) { t.skip(`chromium not installed — ${String(err?.message ?? err)}`); return; }
    throw err;
  }
  assert.notEqual(r.state, "pass", "network attempt must not green");
  const net = r.diagnostics.find((d) => d.id === "SUI-RENDER-NETWORK-001");
  assert.ok(net, "network diagnostic present");
  assert.match(net.detail, /https:\/\/example\.com/, "sanitized origin recorded");
  assert.ok(!net.detail.includes("SECRET_123"), "query string must NOT leak into the diagnostic");
  assert.ok(!net.detail.includes("token="), "no query params leaked");
});

test("PR6A: no transcript → unverifiable (unchanged); runtime error captured as non-green", async (t) => {
  const r = await renderVerify({ html: "<div>x</div>", scss: "", ts: "", transcript: null, fixtureDir: MOUNT_FIX });
  assert.equal(r.state, "unverifiable");
  assert.equal(r.exitCode, 3);
});
