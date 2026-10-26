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

test("monorepo with a library project targets the LIBRARY, not the host app", async () => {
  // 2026-09-10 §2.6: detection pointed at the host app (src/app) while the library lived in
  // projects/<domain>/src/lib — slices would have been written into the wrong tree, silently.
  const ctx = await detectProject(join(FIX, "monorepo-lib"));
  assert.equal(ctx.detected, true);
  assert.equal(ctx.componentDir, "projects/uiigateway/bill/src/lib", "componentDir = the library's sourceRoot");
  assert.equal(ctx.componentDirSource, "angularJsonLibrary");
  assert.equal(ctx.provenance.componentDir, "angularJsonLibrary");
  assert.equal(ctx.prefix, "bill", "prefix comes from the library project");
  assert.ok(
    ctx.detectionWarnings.some((w) => w.includes("LIBRARY") && w.includes("uiigateway-app")),
    "warning names the skipped host app",
  );
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
  assert.equal(ctx.conventions.componentAnatomy.mockRowsFloor, null, "no universal mock-row floor (policy-driven, §13)");
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

test("design tokens mined for non-Angular projects (Tailwind v4 @theme in a .css)", async () => {
  // 2026-09-19: detectProject only mined tokens when stylePaths was non-empty (Angular-only).
  // A Vue + Tailwind v4 project declares tokens as CSS custom props inside @theme in a plain
  // .css — the extractor handles that, but it was never called for non-Angular projects.
  const ctx = await detectProject(join(FIX, "vue-tailwind"));
  assert.equal(ctx.framework.id, "vue-sfc", "Vue detected");
  assert.ok(
    ctx.designTokens.cssProps.some((t) => t.name === "--color-brand-500" && t.value === "#465fff"),
    "--color-brand-500 mined from @theme (the root-cause regression)",
  );
  assert.ok(
    ctx.designTokens.cssProps.some((t) => t.name === "--breakpoint-sm" && t.value === "640px"),
    "non-color @theme tokens (breakpoints) mined too",
  );
});

test("conventions mined for Vue — :deep() corpus + SFC anatomy, not Angular idiom", async () => {
  // 2026-09-21: Vue got its own conventions miner (framework/vue-sfc/conventions.mjs). It emits
  // Vue-native facts (deepCorpus, SFC anatomy) — never the Angular ::ng-deep shape.
  const ctx = await detectProject(join(FIX, "vue-tailwind"));
  assert.equal(ctx.framework.id, "vue-sfc");
  // :deep() corpus from <style scoped>: the fixture's `.card :deep(.inner)` yields one entry.
  assert.equal(ctx.conventions.deepCorpus.length, 1, "Vue :deep() corpus captured");
  assert.equal(ctx.conventions.deepCorpus[0].selector, ".inner", "deep target .inner");
  assert.equal(ctx.conventions.deepCorpus[0].reusable, false, ".inner is project-specific, not a library internal");
  // SFC anatomy.
  assert.equal(ctx.conventions.componentAnatomy.scriptSetup, true, "script setup detected");
  assert.equal(ctx.conventions.componentAnatomy.styleScoped, true, "style scoped detected");
  assert.equal(ctx.conventions.componentAnatomy.tailwind, true, "Tailwind detected");
  // Tailwind utilities are NOT a reusable-class vocabulary → empty on purpose.
  assert.deepEqual(ctx.conventions.classVocabulary, [], "Tailwind utilities are not a class vocabulary");
  // No @click handlers in the fixture → no event-handler naming.
  assert.equal(ctx.conventions.naming.eventNaming, null, "no @event handlers to name");
  // The per-category "no library detected" warnings collapse to ONE summary line for non-Angular.
  const noLibWarnings = ctx.detectionWarnings.filter((w) => /no library detected/i.test(w));
  assert.equal(noLibWarnings.length, 0, "no per-category 'no library' noise for non-Angular");
  assert.ok(
    ctx.detectionWarnings.some((w) => /expected for a non-Angular project/i.test(w)),
    "one honest summary line instead of 13 warnings",
  );
});

// ---------- detect freshness (P0-3) ----------

import { hashInputs } from "../src/commands/detect.mjs";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";

test("detect: hashInputs is stable for unchanged config and changes when a config changes", () => {
  const root = mkdtempSync(join(tmpdir(), "sliceui-hash-"));
  try {
    writeFileSync(join(root, "package.json"), JSON.stringify({ name: "x", dependencies: { pilar: "1.0.0" } }));
    writeFileSync(join(root, "angular.json"), "{}");
    writeFileSync(join(root, "tsconfig.json"), "{}");

    const a = hashInputs(root);
    const b = hashInputs(root);
    assert.equal(a, b, "stable across identical reads");

    // A changed dependency must change the fingerprint (that is what invalidates the cached
    // project-context and forces a re-scan).
    writeFileSync(join(root, "package.json"), JSON.stringify({ name: "x", dependencies: { pilar: "2.0.0" } }));
    assert.notEqual(hashInputs(root), a, "a changed config file changes the hash");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
