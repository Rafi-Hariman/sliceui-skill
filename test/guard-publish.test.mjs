// Publish guard tests — the package embeds private pilar source in its catalogs; publishing
// outside npm.uii.ac.id must be refused by prepublishOnly, while the org registry is allowed.

import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(HERE, "..", "scripts", "guard-publish.mjs");

/** Run the guard with a controlled env (no inherited NPM_CONFIG_REGISTRY / .npmrc leakage). */
function run(argv = [], env = {}) {
  try {
    const out = execFileSync(process.execPath, [SCRIPT, ...argv], {
      env: { ...process.env, NPM_CONFIG_REGISTRY: "", ...env },
      stdio: "pipe",
    });
    return { code: 0, out: out.toString() };
  } catch (e) {
    return { code: e.status ?? 1, out: (e.stdout?.toString() ?? "") + (e.stderr?.toString() ?? "") };
  }
}

test("guard: refuses publish to public npmjs when catalogs are embedded", () => {
  const r = run(["--registry", "https://registry.npmjs.org/"]);
  assert.equal(r.code, 1, "must exit non-zero");
  assert.match(r.out, /REFUSING.*npm\.uii\.ac\.id/);
});

test("guard: allows publish to the org registry (npm.uii.ac.id)", () => {
  const r = run(["--registry", "https://npm.uii.ac.id/"]);
  assert.equal(r.code, 0, "org registry is allowed");
  assert.match(r.out, /✅/);
});

test("guard: --registry= form and NPM_CONFIG_REGISTRY env are honored", () => {
  assert.equal(run(["--registry=https://registry.npmjs.org/"]).code, 1);
  assert.equal(run([], { NPM_CONFIG_REGISTRY: "https://npm.uii.ac.id/" }).code, 0);
  // default (no flag/env) → npmjs → refused
  assert.equal(run().code, 1);
});
