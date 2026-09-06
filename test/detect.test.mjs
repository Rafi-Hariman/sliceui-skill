import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { detectProject } from "../src/commands/detect.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIX = join(HERE, "fixtures");

test("detects Angular 13 module project", async () => {
  const ctx = await detectProject(join(FIX, "angular13"));
  assert.equal(ctx.detected, true);
  assert.equal(ctx.framework.id, "angular");
  assert.equal(ctx.framework.versionMajor, 13);
  assert.equal(ctx.prefix, "app");
  assert.equal(ctx.styleExt, "scss");
  assert.equal(ctx.moduleOrStandalone, "module");
  assert.equal(ctx.uiLibrary, "angular-material");
  assert.equal(ctx.routing, true);
  assert.equal(ctx.componentDir, "src/app");
  // capabilities map present (no library usage in fixture → select null)
  assert.ok(ctx.capabilities, "capabilities present");
  assert.equal(ctx.capabilities.select.library, null);
  // sample components found with selector parsed
  assert.ok(ctx.sampleComponents.length >= 2);
  assert.ok(ctx.sampleComponents.some((s) => s.selector === "app-hero"));
});

test("handles a monorepo by picking the first project + warning", async () => {
  const ctx = await detectProject(join(FIX, "monorepo"));
  assert.equal(ctx.detected, true);
  assert.equal(ctx.framework.id, "angular");
  assert.equal(ctx.prefix, "one");
  assert.ok(ctx.detectionWarnings.some((w) => w.includes("Monorepo")));
});

test("handles no-package gracefully", async () => {
  const ctx = await detectProject(join(FIX, "no-package"));
  assert.equal(ctx.detected, false);
  assert.equal(ctx.framework.id, "unknown");
  assert.ok(ctx.detectionWarnings.length > 0);
});

test("project-context v4: provenance, tokens, conventions, module structure, staleness", async () => {
  const ctx = await detectProject(join(FIX, "angular13"));
  assert.equal(ctx.version, 4);
  // provenance present for key claims
  assert.equal(ctx.provenance.prefix, "sourceCode", "prefix derived from source, not config");
  assert.ok(ctx.provenance.styleExt, "styleExt provenance present");
  // design tokens mined from _tokens.scss (SCSS vars + CSS custom props)
  assert.ok(ctx.designTokens.scss.some((t) => t.name === "$primary" && t.value === "#22c55e"), "$primary mined");
  assert.ok(ctx.designTokens.cssProps.some((t) => t.name === "--color-bg"), "--color-bg mined");
  // conventions present (extractConventions wired into detect)
  assert.ok(ctx.conventions, "conventions present");
  assert.ok(Array.isArray(ctx.conventions.classVocabulary), "classVocabulary array");
  assert.ok(Array.isArray(ctx.conventions.ngDeepCorpus), "ngDeepCorpus array");
  assert.equal(ctx.conventions.componentAnatomy.mockRowsFloor, 15, "default mockRowsFloor 15");
  assert.equal(ctx.conventions.naming.prefix, "app", "naming prefix from detect");
  // module structure + staleness
  assert.equal(ctx.appModulePath, "src/app/app.module.ts");
  assert.ok(ctx.moduleStructure.pattern, "moduleStructure pattern present");
  assert.ok(ctx.generatedAt, "generatedAt present");
  assert.ok(ctx.inputHash, "inputHash present");
});

test("non-silent null: capability with no library carries a note + warning", async () => {
  const ctx = await detectProject(join(FIX, "angular13"));
  // fixture has no modal/toast/etc → those are null and must carry a note
  const nullCaps = Object.entries(ctx.capabilities).filter(([, c]) => c.library === null);
  assert.ok(nullCaps.length > 0, "some capability is null");
  for (const [, cap] of nullCaps) {
    assert.ok(cap.note && cap.note.includes("native HTML"), `null capability has a note: ${cap.note}`);
  }
  assert.ok(ctx.detectionWarnings.some((w) => w.includes("native HTML")), "warning emitted for null capability");
});

test("prefix: feature components beat the root selector (ugw-root vs app-*)", async () => {
  // The root component is the app shell (ugw-root); sliceui generates feature components,
  // which use app-*. Majority among features must win, not the root selector.
  const ctx = await detectProject(join(FIX, "angular13-rootprefix"));
  assert.equal(ctx.prefix, "app", "feature prefix wins over root selector");
  assert.equal(ctx.provenance.prefix, "sourceCode");
  assert.ok(ctx.prefixNote.includes("ugw"), "note explains the root/feature split");
  assert.ok(ctx.prefixAlternates.some((a) => a.prefix === "app"), "app in alternates");
});
