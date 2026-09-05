import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readFileSync, existsSync } from "node:fs";
import { renderMount } from "../src/framework/angular/render-mount.mjs";

// Render-mount (Option A) regression eval — SYNTHETIC, TRACKED fixtures. It compiles the real
// .scss (Dart Sass), esbuild-bundles a throwaway Angular 13 component, boots it with
// platformBrowserDynamic, and probes the MOUNTED DOM — proving the things Option B can't:
//   - emulated view-encapsulation (_nghost-*/_ngcontent-* hashes present)
//   - :host { display: block } actually computes block
//   - {{label}} interpolation renders the bound value
//   - :host ::ng-deep .child-internal pierces into the child component
//   - the real-SCSS-compiled .h1 color still honors the A/B drift axis (#000 pass vs #555 fail).
// A/B on the same design: HOPE .h1 #000000 → renderMount PASS; SLICE .h1 #555555 → FAIL.

const HERE = dirname(fileURLToPath(import.meta.url));
const MOUNT_FIX = join(HERE, "fixtures", "angular-mount");
const FIX = join(HERE, "fixtures", "render-mount");
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

function fixtureReady() {
  return existsSync(join(MOUNT_FIX, "node_modules", "@angular", "core"));
}

function isSkip(err) {
  const msg = String(err?.message ?? err ?? "");
  return /Executable doesn't exist|npx playwright install|browserType\.launch|Cannot find package 'playwright'/.test(msg);
}

async function runMount(t, dir) {
  if (!fixtureReady()) {
    t.skip("angular-mount fixture deps missing — run `cd test/fixtures/angular-mount && npm ci`; render-mount not exercised");
    return null;
  }
  try {
    const { scss, html, ts } = readComponent(dir, NAME);
    const transcript = readJson(join(FIX, "transcript.json"));
    return await renderMount({ html, scss, ts, transcript, fixtureDir: MOUNT_FIX });
  } catch (err) {
    if (isSkip(err)) {
      t.skip(`chromium not installed — run \`npx playwright install chromium\`; render-mount not exercised (${err.message})`);
      return null;
    }
    throw err;
  }
}

test("mount: human reference renders design values + encapsulation while the machine slice drifts (A/B)", async (t) => {
  // HOPE — correct title color, encapsulation active, binding + piercing all work.
  const hope = await runMount(t, HOPE);
  if (hope === null) return;
  const hopeCheck = hope.checks.find((c) => c.name === "renderMount");
  assert.equal(hopeCheck.status, "pass", `human reference must render design values: ${JSON.stringify(hopeCheck.detail)}`);

  assert.equal(hope.signals.hostNghost, true, "host must carry a _nghost hash (emulated encapsulation)");
  assert.equal(hope.signals.childNgcontent, true, "template descendants must carry _ngcontent hashes");
  assert.equal(hope.signals.hostDisplay, "block", ":host { display:block } must compute block");
  assert.equal(hope.signals.binding, "Simpan count: 3", "{{label}} interpolation must render the bound value");
  assert.equal(hope.signals.piercing, "rgb(14, 165, 233)", ":host ::ng-deep must pierce into the child component");

  // SLICE — drifted .h1 to #555 → the mount probe catches it.
  const slice = await runMount(t, SLICE);
  if (slice === null) return;
  const sliceCheck = slice.checks.find((c) => c.name === "renderMount");
  assert.equal(sliceCheck.status, "fail", `machine slice's title-color drift must be caught at mount: ${JSON.stringify(sliceCheck.detail)}`);
  assert.match(sliceCheck.detail, /color/i, "renderMount failure names the drifted property");
});

test("mount: probe gathers title + divider facts (not a silent no-op)", async (t) => {
  const hope = await runMount(t, HOPE);
  if (hope === null) return;
  assert.ok(hope.facts.length >= 3, `expected ≥3 render facts, got ${hope.facts.length}: ${JSON.stringify(hope.facts)}`);
  assert.ok(hope.facts.some((f) => f.kind === "text"), "must render text facts");
  assert.ok(hope.facts.some((f) => f.kind === "divider"), "must render the divider fact");
});
