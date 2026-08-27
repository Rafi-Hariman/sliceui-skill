import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { detectProject } from "../src/commands/detect.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIX = join(HERE, "fixtures");

test("detects Angular 13 module project", () => {
  const ctx = detectProject(join(FIX, "angular13"));
  assert.equal(ctx.detected, true);
  assert.equal(ctx.framework.id, "angular");
  assert.equal(ctx.framework.versionMajor, 13);
  assert.equal(ctx.prefix, "app");
  assert.equal(ctx.styleExt, "scss");
  assert.equal(ctx.moduleOrStandalone, "module");
  assert.equal(ctx.uiLibrary, "angular-material");
  assert.equal(ctx.routing, true);
  assert.equal(ctx.componentDir, "src/app");
  // tokens detected
  assert.ok(ctx.tokens.scssVars.includes("$primary") || ctx.tokens.scssVars.includes("primary"));
  assert.ok(ctx.tokens.cssVars.includes("--color-bg") || ctx.tokens.cssVars.includes("color-bg"));
  // sample components found with selector parsed
  assert.ok(ctx.sampleComponents.length >= 2);
  assert.ok(ctx.sampleComponents.some((s) => s.selector === "app-hero"));
});

test("handles a monorepo by picking the first project + warning", () => {
  const ctx = detectProject(join(FIX, "monorepo"));
  assert.equal(ctx.detected, true);
  assert.equal(ctx.framework.id, "angular");
  assert.equal(ctx.prefix, "one");
  assert.ok(ctx.detectionWarnings.some((w) => w.includes("Monorepo")));
});

test("handles no-package gracefully", () => {
  const ctx = detectProject(join(FIX, "no-package"));
  assert.equal(ctx.detected, false);
  assert.equal(ctx.framework.id, "unknown");
  assert.ok(ctx.detectionWarnings.length > 0);
});
