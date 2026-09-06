import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync, mkdirSync, readFileSync, existsSync } from "node:fs";
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

test("init runs the referee codebase-head without crashing and returns warnings", async () => {
  const dir = scaffold();
  const r = await initProject(dir);
  rmSync(dir, { recursive: true, force: true });
  assert.equal(r.ok, true);
  // The referee head is chained in; even a clean project returns a warnings array (env template + detection notes),
  // and a clean project must NOT add a referee red-count warning.
  assert.ok(Array.isArray(r.warnings), "warnings is an array");
  assert.ok(!r.warnings.some((w) => w.includes("referee:")), "clean project surfaces no referee red-count");
});

test("init --framework forces the target framework (Jalur B)", async () => {
  const dir = scaffold(); // scaffold has @angular/core, but we force react
  const r = await initProject(dir, { frameworkId: "react-tsx" });
  const ctx = JSON.parse(readFileSync(join(dir, ".sliceui", "project-context.json"), "utf8"));
  rmSync(dir, { recursive: true, force: true });
  assert.equal(r.ok, true);
  assert.equal(r.framework.id, "react-tsx", "framework forced to react-tsx");
  assert.equal(ctx.framework.id, "react-tsx", "project-context carries forced framework");
});

test("init --profile generic overrides a UII fingerprint (Jalur B)", async () => {
  const dir = mkdtempSync(join(tmpdir(), "sliceui-init-"));
  writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "uii-gateway-portal", version: "1.0.0", dependencies: { "@angular/core": "^13" } }));
  mkdirSync(join(dir, "src", "app"), { recursive: true });
  writeFileSync(join(dir, "src", "app", "a.html"), "<div>hi</div>");

  const r = await initProject(dir, { profile: "generic" });
  const ctx = JSON.parse(readFileSync(join(dir, ".sliceui", "project-context.json"), "utf8"));
  const hasUiiProfile = existsSync(join(dir, ".sliceui", "uii-profile.md"));
  rmSync(dir, { recursive: true, force: true });

  assert.equal(r.profile, "generic", "init result profile is generic (override wins over uii-named folder)");
  assert.equal(ctx.profile, "generic", "project-context profile generic despite uii folder name");
  assert.equal(ctx.isUii, false);
  assert.ok(!hasUiiProfile, "uii-profile not written for overridden generic");
});

test("init writes loadedClassRegistry into conventions.json (verify gate wiring)", async () => {
  const dir = scaffold();
  await initProject(dir);
  const convPath = join(dir, ".sliceui", "conventions.json");
  assert.ok(existsSync(convPath), "conventions.json written");
  const conv = JSON.parse(readFileSync(convPath, "utf8"));
  // The loaded-class registry that detect computed must reach the file the verify gate reads —
  // checkLoadedClass was built but never wired because conventions.json never carried it.
  assert.ok(conv.loadedClassRegistry, "conventions.json carries loadedClassRegistry");
  assert.ok(Array.isArray(conv.loadedClassRegistry.classes), "registry has a classes array");
  assert.ok(conv.loadedClassRegistry.source, "registry has a source");
  rmSync(dir, { recursive: true, force: true });
});

test("init is idempotent and does not crash on a re-run (referee head runs twice)", async () => {
  const dir = scaffold();
  await initProject(dir);
  const r2 = await initProject(dir); // re-run on the same dir
  rmSync(dir, { recursive: true, force: true });
  assert.equal(r2.ok, true);
});
