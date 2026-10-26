// browser-harness — the FULL verification path in one call, for the browser-backed matrix:
//
//     Design Intent constraint → compileVerificationPlan → locator map (semantic DOM targets)
//     → Angular mount (NgModule + build + global stylesheet + component styles + ViewEncapsulation)
//     → collectDomEvidence / collectResponsiveEvidence → verifier verdict
//
// The mount reuses the angular-mount fixture: a REPRESENTATIVE Angular project (owning AppModule,
// esbuild bundle, emulated encapsulation, injectable global stylesheet) — not Bill/Pilar production.

import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { collectDomEvidence, collectResponsiveEvidence } from "../../src/render/project-render-adapter.mjs";
import { verifyIntent } from "../../src/verification/verify.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
export const MOUNT_FIX = join(HERE, "..", "fixtures", "angular-mount");
const SHELL_FILES = ["main.ts", "app.module.ts", "child.component.ts"];

export function fixtureReady() { return existsSync(join(MOUNT_FIX, "node_modules", "@angular", "core")); }
export function isSkip(err) { return /Executable doesn't exist|npx playwright install|browserType\.launch|Cannot find package 'playwright'/.test(String(err?.message ?? err ?? "")); }

/** Mount the component and keep the page alive for `fn(page)`; always tears down. */
export async function withMountedPage(opts, fn) {
  const { html, scss, globalCss = "", viewport = { width: 900, height: 700 } } = opts;
  const sass = await import("sass");
  const css = sass.compileString(scss, { style: "compressed" }).css;
  const dir = mkdtempSync(join(tmpdir(), "sliceui-verify-"));
  const component = `import { Component } from "@angular/core";
@Component({ selector: "app-under-test", template: \`${escapeTpl(html)}\`, styles: [\`${escapeTpl(css)}\`] })
export class UnderTestComponent {}`;
  writeFileSync(join(dir, "under-test.component.ts"), component);
  for (const f of SHELL_FILES) writeFileSync(join(dir, f), readFileSync(join(MOUNT_FIX, "src", f), "utf8"));
  const out = join(dir, "bundle.js");
  const esbuild = await import("esbuild");
  await esbuild.build({ entryPoints: [join(dir, "main.ts")], bundle: true, outfile: out, format: "iife", platform: "browser", target: "es2018", nodePaths: [join(MOUNT_FIX, "node_modules")], logLevel: "silent" });
  const pw = await import("playwright");
  const browser = await pw.chromium.launch();
  try {
    const page = await browser.newPage({ viewport });
    const global = globalCss ? `<style>${String(globalCss).replace(/<\/style/gi, "<\\/style")}</style>` : "";
    await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>*,*::before,*::after{animation:none!important;transition:none!important}</style>${global}</head><body><app-under-test></app-under-test></body></html>`);
    await page.addScriptTag({ path: out });
    await page.waitForFunction(() => {
      const h = document.querySelector("app-under-test");
      return h && Array.from(h.attributes).some((a) => a.name.startsWith("_nghost")) && h.querySelectorAll("*").length > 0;
    }, null, { timeout: 15000 });
    try { await page.evaluate(() => document.fonts?.ready); } catch {}
    await page.waitForTimeout(100);
    return await fn(page);
  } finally {
    await browser.close().catch(() => {});
    rmSync(dir, { recursive: true, force: true });
  }
}

/** Collect single-viewport DOM evidence for a locator map. */
export async function collect(page, map) {
  const evidence = await collectDomEvidence(page, map);
  return {
    rects: new Map(Object.entries(evidence.rects)),
    computedStyles: new Map(Object.entries(evidence.computedStyles)),
    domTexts: evidence.domTexts,
    domState: evidence.domState,
  };
}

/** FULL PATH (single viewport): intent → plan → mount → evidence → verifyIntent verdict. */
export async function mountAndVerify(opts) {
  const { html, scss, map, intentGraph, globalCss = "", focusSelector = null, styleChecks = [], viewport } = opts;
  return withMountedPage({ html, scss, globalCss, viewport }, async (page) => {
    if (focusSelector) await page.focus(focusSelector).catch(() => {});
    const evidence = await collect(page, map);
    const result = verifyIntent({ intentGraph, ...evidence, styleChecks });
    return { result, evidence };
  });
}

/** Mount + collect only (adapter-tier assertions). */
export async function mountAndCollect(opts) {
  const { html, scss, map, globalCss = "", viewport } = opts;
  return withMountedPage({ html, scss, globalCss, viewport }, (page) => collect(page, map));
}

/**
 * FULL PATH (multi-viewport responsive): responsive safety requirement → plan → semantic target
 * mapping (controls/critical/fill/scrollers bound to intent node ids + selectors) → mount at each
 * width → responsive evidence → verifyIntent verdict.
 */
export async function mountAndVerifyResponsive(opts) {
  const { html, scss, map, intentGraph, globalCss = "", viewports, controls = [], critical = [], fill = [], scrollers = [], region = null } = opts;
  return withMountedPage({ html, scss, globalCss, viewport: { ...viewports[0], height: 700 } }, async (page) => {
    const widths = await collectResponsiveEvidence(page, { viewports, controls, critical, fill, scrollers, region });
    const result = verifyIntent({ intentGraph, rects: new Map(), computedStyles: new Map(), domTexts: [], domState: { widths } });
    return { result, evidence: widths };
  });
}

function escapeTpl(s) {
  return String(s).replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${");
}
