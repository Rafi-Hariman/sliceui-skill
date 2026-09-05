import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readFileSync, existsSync } from "node:fs";
import { renderProbe } from "../src/framework/angular/render-probe.mjs";

// Render-probe (Option B) regression eval — SYNTHETIC, TRACKED fixture. It renders the generated
// HTML+CSS in headless Chromium and compares the RENDERED color/size/weight against the design
// transcript, closing the "verify hijau ≠ UI benar di localhost" gap at the cascade level (NOT an
// Angular mount — that is Option A). A/B on the same design:
//   - HOPE  sample-card (hand-correct)   → .h1 { color: #000000 } → renderFidelity PASSES.
//   - SLICE sample-card (machine drift)  → .h1 { color: #555555 } → renderFidelity FAILS (#555 vs #000).
// The fixture is self-authored (no customer data) and lives at a tracked path — never under a
// gitignored `.sliceui/` dir — so it runs in CI permanently.

const HERE = dirname(fileURLToPath(import.meta.url));
const FIX = join(HERE, "fixtures", "render-probe");
const HOPE = join(FIX, "hope");
const SLICE = join(FIX, "slice");

const NAME = "sample-card";

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

/** Drop Angular-only constructs a bare-page cascade can't resolve, so the rest (already valid CSS)
 *  can render: `:host { … }` (no host element in a plain doc) and `::ng-deep`-prefixed selectors
 *  (encapsulation piercing — out of scope for Option B). No Sass compiler needed. */
function scssToCss(scss) {
  return String(scss ?? "")
    .replace(/:host\s*(\([^)]*\))?\s*\{[^{}]*\}/g, "")
    .replace(/::ng-deep\s*[^{]*\{[^{}]*\}/g, "")
    .trim();
}

async function probe(dir) {
  const { scss, html } = readComponent(dir, NAME);
  const transcript = readJson(join(FIX, "transcript.json"));
  return renderProbe({ html, css: scssToCss(scss), transcript });
}

function isBrowserMissing(err) {
  const msg = String(err?.message ?? err ?? "");
  return /Executable doesn't exist|Cannot find package 'playwright'|npx playwright install|browserType\.launch/i.test(msg);
}

/** Run the probe, gracefully skipping when chromium isn't provisioned on this machine.
 *  CI installs chromium (see .github/workflows/ci.yml) so it always runs there. */
async function runProbe(t, dir) {
  try {
    return await probe(dir);
  } catch (err) {
    if (isBrowserMissing(err)) {
      t.skip(`chromium not installed — run \`npx playwright install chromium\`; render-probe not exercised (${err.message})`);
      return null;
    }
    throw err;
  }
}

test("render: human reference renders design values while the machine slice drifts (A/B on the same design)", async (t) => {
  // HOPE honors the design title color (#000) → rendered value matches.
  const hope = await runProbe(t, HOPE);
  if (hope === null) return;
  const hopeCheck = hope.checks.find((c) => c.name === "renderFidelity");
  assert.equal(hopeCheck.status, "pass", `human reference must render design values: ${JSON.stringify(hopeCheck.detail)}`);

  // SLICE drifted .h1 to #555 → the render probe catches it.
  const slice = await runProbe(t, SLICE);
  if (slice === null) return;
  const sliceCheck = slice.checks.find((c) => c.name === "renderFidelity");
  assert.equal(sliceCheck.status, "fail", `machine slice's title-color drift must be caught at render: ${JSON.stringify(sliceCheck.detail)}`);
  assert.match(sliceCheck.detail, /color/i, "renderFidelity failure names the drifted property");
});

test("render: probe gathers title + divider facts (not a silent no-op)", async (t) => {
  const hope = await runProbe(t, HOPE);
  if (hope === null) return;
  // Title contributes color/size/weight (3 text facts) and the <hr> contributes the divider fact.
  assert.ok(hope.facts.length >= 3, `expected ≥3 render facts, got ${hope.facts.length}: ${JSON.stringify(hope.facts)}`);
  assert.ok(hope.facts.some((f) => f.kind === "text"), "must render text facts");
  assert.ok(hope.facts.some((f) => f.kind === "divider"), "must render the divider fact");
});
