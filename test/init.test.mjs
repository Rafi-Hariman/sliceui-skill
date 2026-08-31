import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { initProject } from "../src/commands/init.mjs";

// A minimal project: real package.json + one template carrying a well + a label-custom class,
// so the referee codebase-head has something to validate against (no stale claim → no red).
function scaffold() {
  const dir = mkdtempSync(join(tmpdir(), "sliceui-init-"));
  writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "x", version: "1.0.0", dependencies: { "@angular/core": "^13" } }));
  mkdirSync(join(dir, "src", "app"), { recursive: true });
  writeFileSync(join(dir, "src", "app", "a.html"), '<div class="well"><span class="label-custom-success">ok</span></div>');
  writeFileSync(join(dir, "src", "app", "a.scss"), ":host ::ng-deep .label-custom-success { background: #dcf5ef; }");
  return dir;
}

test("init runs the referee codebase-head without crashing and returns warnings", () => {
  const dir = scaffold();
  const r = initProject(dir);
  rmSync(dir, { recursive: true, force: true });
  assert.equal(r.ok, true);
  // The referee head is chained in; even a clean project returns a warnings array (env template + detection notes),
  // and a clean project must NOT add a referee red-count warning.
  assert.ok(Array.isArray(r.warnings), "warnings is an array");
  assert.ok(!r.warnings.some((w) => w.includes("referee:")), "clean project surfaces no referee red-count");
});

test("init is idempotent and does not crash on a re-run (referee head runs twice)", () => {
  const dir = scaffold();
  initProject(dir);
  const r2 = initProject(dir); // re-run on the same dir
  rmSync(dir, { recursive: true, force: true });
  assert.equal(r2.ok, true);
});
