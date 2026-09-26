// render-verify (PR 6) — opt-in rendered visual-fidelity gate.
//
// Static verify proves the generated SCSS *text* agrees with the design; it cannot see what the
// browser actually renders (cascade, encapsulation, template bindings, real geometry). This module
// closes that gap: it compiles the component's real `.scss` (Dart Sass), esbuild-bundles a
// throwaway Angular 13 component (identical encapsulation pipeline to external files), boots it in
// a headless Chromium (Playwright), and measures rendered style + geometry facts against the
// transcript — the SAME authored-rule/design facts static verify judges.
//
// Render mode is EXPLICIT and OPT-IN (the CLI's `--render` flag); static verify stays the default.
// A render failure is NEVER green: build/mount/runtime/browser failures are distinguished from
// visual mismatch, and every one is non-green with a distinct primary state + stable diagnostic.
//
// Correctness invariants:
//   - oracle = transcript.json literal/structural facts (+ raw XML geometry), never spec.md /
//     resolved.json / agent-context (those are generator hints, not ground truth).
//   - deterministic: fixed viewport, animations/transitions disabled, `document.fonts.ready`,
//     bounded timeouts, no network (setContent + inline bundle).
//   - isolation: renders in a `mkdtemp` under /tmp; never writes the real target project.
//
// Reuses the mount-shell pattern from render-mount.mjs (syntheticComponent + SHELL_FILES) and the
// fact normalizers from verify.mjs. Geometry facts are a bounded superset of render-mount's style
// facts — see collectGeometryFacts.

import { mkdtempSync, writeFileSync, readFileSync, rmSync, mkdirSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { componentMeta } from "../../lib/ts-ast.mjs";
import { collectStyleFacts, parseCssColor, pxNum, weightNum } from "./verify.mjs";
import { collectGeometryFacts, collectRenderedGeometry, compareGeometry, GEOMETRY_TOLERANCE } from "./render-geometry.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
// The dev-only Angular 13 mount fixture (ships with the repo; excluded from the npm `files`).
// `src/framework/angular/` → repo root is three levels up.
const DEFAULT_FIXTURE = join(HERE, "..", "..", "..", "test", "fixtures", "angular-mount");
const SHELL_FILES = ["main.ts", "app.module.ts", "child.component.ts"];

/** Primary render states → exit codes (preserves the PR 5 0/1/2/3 contract; all non-pass render
 *  failures exit 1 with a DISTINCT state, except unverifiable(3) and invalid-input(2)). */
export const RENDER_STATE_EXIT = Object.freeze({
  pass: 0,
  "visual-fail": 1,
  "build-fail": 1,
  "mount-fail": 1,
  "runtime-fail": 1,
  "browser-unavailable": 1,
  "fixture-unavailable": 3,
  unverifiable: 3,
  "invalid-input": 2,
});

/** Default viewport: a documented desktop frame (override with `--viewport` only when the design
 *  carries no explicit frame). */
export const DEFAULT_VIEWPORT = { width: 1440, height: 900 };

/** Deterministic environment injected before measurement: kill animations/transitions so geometry
 *  is stable across runs; reset scroll. */
const DETERMINISTIC_CSS = `
  *, *::before, *::after { animation: none !important; transition: none !important; }
`;

/** Back-compat re-export: the box-size tolerance bound, now centralized per family in
 *  render-geometry.mjs (GEOMETRY_TOLERANCE). Documented in verify-gate-trust.md §2.3. */
export const GEOMETRY_TOLERANCE_PX = GEOMETRY_TOLERANCE.box;

/**
 * @param {object} opts
 * @param {string} opts.html   generated component template
 * @param {string} opts.scss   generated component SCSS
 * @param {string} opts.ts     generated component TS (for the @Component selector)
 * @param {object} opts.transcript  design transcript (ground truth)
 * @param {string} [opts.fixtureDir]  absolute path to the angular-mount fixture
 * @param {{width:number,height:number}} [opts.viewport]
 * @param {string|null} [opts.screenshotPath]  write a PNG here when set (supporting evidence)
 * @param {function} [opts.launch]  browser launcher override for tests
 * @returns {Promise<{ state, exitCode, checks: Array, diagnostics: Array, artifacts: object, metrics: object }>}
 */
export async function renderVerify({
  html = "", scss = "", ts = "", transcript = null, fixtureDir = DEFAULT_FIXTURE,
  viewport = DEFAULT_VIEWPORT, screenshotPath = null, launch = null,
} = {}) {
  const t0 = performance.now();
  // Static-fast-path: no design facts to compare → unverifiable (never a silent pass).
  if (!transcript?.layout?.length) {
    return result("unverifiable", [{ name: "renderVerify", status: "skip", detail: "no transcript design facts to render against" }], [], {}, {});
  }

  if (!existsSync(join(fixtureDir, "node_modules", "@angular", "core"))) {
    return result("fixture-unavailable", [], [{
      id: "SUI-RENDER-SETUP-001", category: "render-setup", severity: "error", status: "fail",
      detail: "Angular mount fixture is not provisioned — run `cd test/fixtures/angular-mount && npm ci` (render mode is dev-only)",
      trust: "independent", remediation: "provision the mount fixture before using --render",
    }], {}, {});
  }

  const { styleFacts, geometryFacts } = collectDesignFacts(scss, html, transcript);
  if (!styleFacts.length && !geometryFacts.length) {
    return result("unverifiable", [{ name: "renderVerify", status: "skip", detail: "no authored-rule or geometry design facts to render (slice reuses project classes)" }], [], {}, {});
  }

  const selector = componentMeta(ts)?.selector ?? "app-sample-card";
  const dir = mkdtempSync(join(tmpdir(), "sliceui-render-verify-"));
  let browser = null;
  // PR 6A — a SINGLE phase-aware error boundary covers the whole render lifecycle, so no
  // render-stage exception escapes as an uncaught crash. `phase` tracks where we are; the catch
  // maps it to a deterministic non-green state + a bounded SUI-RENDER-* diagnostic. Cleanup is
  // unconditional in `finally`.
  let phase = "validate";
  try {
    // 1. Compile real SCSS → CSS (Dart Sass).
    phase = "build";
    const sass = await import("sass");
    const css = sass.compileString(scss, { style: "compressed" }).css;

    // 2. Assemble the throwaway bundle.
    writeFileSync(join(dir, "under-test.component.ts"), syntheticComponent(selector, html, css));
    for (const f of SHELL_FILES) writeFileSync(join(dir, f), readFileSync(join(fixtureDir, "src", f), "utf8"));
    const out = join(dir, "bundle.js");
    const esbuild = await import("esbuild");
    await esbuild.build({
      entryPoints: [join(dir, "main.ts")], bundle: true, outfile: out, format: "iife",
      platform: "browser", target: "es2018", nodePaths: [join(fixtureDir, "node_modules")], logLevel: "silent",
    });

    // 3. Launch a deterministic browser.
    phase = "browser-launch";
    const pw = await import("playwright");
    browser = launch ? await launch() : await pw.chromium.launch();

    // 3b. ACTIVE network isolation: abort any external request before it leaves the browser.
    //     Allow only self-contained local schemes; everything else is blocked + recorded.
    const blockedRequests = [];
    const context = await browser.newContext({ viewport });
    await context.route("**", (route) => {
      const url = route.request().url();
      if (/^(data|blob|about):/.test(url)) return route.continue();
      blockedRequests.push(sanitizeRequest(url, route.request().resourceType()));
      return route.abort("blockedbyclient");
    });
    const page = await context.newPage();

    // Runtime errors (uncaught exceptions) are captured, not swallowed.
    const runtimeErrors = [];
    page.on("pageerror", (e) => runtimeErrors.push(String(e?.message ?? e).slice(0, 200)));
    page.on("console", (m) => { if (m.type() === "error") runtimeErrors.push(String(m.text()).slice(0, 200)); });

    // Inject the deterministic CSS BEFORE any content so animations/transitions never run at all.
    phase = "content-load";
    await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>${DETERMINISTIC_CSS}</style></head><body><${selector}></${selector}></body></html>`);
    phase = "script-injection";
    await page.addScriptTag({ path: out });

    // 4. Wait for mount: host gets a _nghost hash AND the first visible content renders (both
    //    prove bootstrap). Bounded timeout; a timeout is mount-fail, never a silent partial render.
    phase = "mount";
    await page.waitForFunction(
      (sel) => {
        const h = document.querySelector(sel);
        if (!h) return false;
        const hasNghost = Array.from(h.attributes).some((a) => a.name.startsWith("_nghost"));
        return hasNghost && h.querySelectorAll("*").length > 0;
      },
      selector, { timeout: 15000 },
    );

    // 5. Deterministic settle: wait fonts, then give Angular one macrotask tick to finish the
    //    first change-detection pass before measuring. Bounded, never indefinite.
    phase = "font-readiness";
    try { await page.evaluate(() => document.fonts?.ready); } catch {}
    await page.waitForTimeout(100);

    // 6. Measure.
    phase = "measure";
    const styleResults = await measureStyleFacts(page, styleFacts);
    const geometryResults = await measureGeometryFacts(page, geometryFacts);

    // 7. Screenshot (supporting evidence, never the sole oracle). A capture failure is a
    //    screenshot-fail — the artifact contract was not fulfilled, never a silent pass.
    phase = "screenshot";
    const artifacts = {};
    if (screenshotPath) {
      mkdirSync(dirname(screenshotPath), { recursive: true });
      await page.screenshot({ path: screenshotPath, fullPage: false });
      artifacts.screenshot = screenshotPath;
    }

    const checks = [...styleResults, ...geometryResults];
    // No false green: if geometry facts exist but NONE is required, the render gate has nothing
    // blocking to prove — an optional-only result is `unverifiable`, never a `pass`. Mirrors the
    // exit-3 contract for skipped required checks. Checked before the fail aggregation so a
    // required mismatch still wins as `visual-fail`.
    const requiredGeom = geometryFacts.filter((f) => f.required).length;
    if (geometryFacts.length && !requiredGeom) {
      return result("unverifiable", checks, [{
        id: "SUI-RENDER-GEOMETRY-000", category: "ground-truth", severity: "error", status: "skip",
        detail: `${geometryFacts.length} geometry fact(s) exist but none is required — no blocking geometry check to prove`,
        trust: "independent",
        remediation: "add a required geometry fact (root padding, control height, line-height, or divider) or treat this render as unverifiable",
      }], artifacts, { totalMs: Math.round(performance.now() - t0), runtimeErrors: runtimeErrors.length, blockedRequests: blockedRequests.length });
    }
    const fails = checks.filter((c) => c.status === "fail");
    // An external request attempt or a captured runtime error invalidates the rendered evidence:
    // the environment is no longer self-contained. These are non-green, never trusted geometry.
    const diagnostics = fails.map((c) => ({
      id: c.id, category: c.category, severity: "error", status: "fail",
      designNodeId: c.designNodeId ?? null, selector: c.selector ?? null,
      expected: c.expected ?? null, actual: c.actual ?? null, delta: c.delta ?? null,
      tolerance: c.tolerance ?? null, unit: c.unit ?? "px", trust: c.trust, remediation: c.remediation,
    }));
    let state = fails.length ? "visual-fail" : "pass";
    if (blockedRequests.length) {
      diagnostics.push({
        id: "SUI-RENDER-NETWORK-001", category: "render-setup", severity: "error", status: "fail",
        phase: "network-policy", detail: `external network request(s) blocked: ${blockedRequests[0]}`,
        trust: "independent", remediation: "remove external resource references — rendered verification is offline/local-only",
      });
      state = "runtime-fail";
    }
    if (runtimeErrors.length) {
      diagnostics.push(renderDiag("SUI-RENDER-RUNTIME-002", "runtime",
        `uncaught runtime error(s): ${runtimeErrors[0]}`));
      if (!fails.length && !blockedRequests.length) state = "runtime-fail";
    }
    return result(state, checks, diagnostics, artifacts, { totalMs: Math.round(performance.now() - t0), runtimeErrors: runtimeErrors.length, blockedRequests: blockedRequests.length });
  } catch (err) {
    // The single deterministic boundary: every render-stage exception maps to a non-green state.
    const msg = String(err?.message ?? err).slice(0, 200);
    if (phase === "build") {
      return result("build-fail", [], [phaseDiag("SUI-RENDER-BUILD-001", phase, `build failed: ${msg}`)], {}, {});
    }
    if (phase === "browser-launch") {
      return result("browser-unavailable", [], [phaseDiag("SUI-RENDER-RUNTIME-001", phase, `headless chromium launch failed: ${msg}`)], {}, {});
    }
    if (phase === "mount") {
      return result("mount-fail", [], [phaseDiag("SUI-RENDER-MOUNT-001", phase, `component "${selector}" did not mount (${msg})`)], {}, {});
    }
    if (phase === "screenshot") {
      return result("visual-fail", [], [phaseDiag("SUI-RENDER-SHOT-001", phase, `screenshot capture failed: ${msg}`)], {}, {});
    }
    return result("runtime-fail", [], [phaseDiag("SUI-RENDER-RUNTIME-003", phase, `render failed (${phase}): ${msg}`)], {}, {});
  } finally {
    if (browser) await browser.close().catch(() => {});
    rmSync(dir, { recursive: true, force: true });
  }
}

/** Sanitize a request URL to { scheme, host, type } — never the full URL, query, headers, or body. */
function sanitizeRequest(url, resourceType) {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.host} (${resourceType ?? "resource"})`;
  } catch {
    return `(unparseable url, ${resourceType ?? "resource"})`;
  }
}

/** A phase-tagged diagnostic (bounded; no raw stack). */
function phaseDiag(id, phase, detail) {
  return { id, category: "render-setup", severity: "error", status: "fail", phase, detail, trust: "independent", remediation: detail };
}

function result(state, checks, diagnostics, artifacts, metrics) {
  return { state, exitCode: RENDER_STATE_EXIT[state] ?? 1, checks, diagnostics, artifacts, metrics };
}

function renderDiag(id, category, detail, remediation) {
  return { id, category, severity: "error", status: "fail", detail, trust: "independent", remediation: remediation ?? detail };
}

/** Reuse the exact authored-rule facts static verify judges (PR 6A), plus the geometry facts from
 *  render-geometry.mjs (PR 6B — control/button height, line-height, table box, root padding).
 *  Preserve each style fact's own `kind` ("text"/"divider") — the rendered reader dispatches on it. */
function collectDesignFacts(scss, html, transcript) {
  const { comparable } = collectStyleFacts(scss, html, transcript);
  const styleFacts = comparable.map((f) => ({ ...f }));
  const geometryFacts = collectGeometryFacts(transcript);
  return { styleFacts, geometryFacts };
}

/** Read the rendered value for a style fact (same normalization as render-mount.mjs). */
async function measureStyleFacts(page, facts) {
  const checks = [];
  for (const fact of facts) {
    const actual = await readRenderedStyle(page, fact);
    const ok = String(actual).toLowerCase() === String(fact.design).toLowerCase();
    checks.push({
      name: "renderStyle", id: `SUI-RENDER-STYLE-${fact.prop === "color" ? "001" : fact.prop === "font-size" ? "002" : "003"}`,
      category: "typography", status: ok ? "pass" : "fail", trust: "literal-design",
      detail: ok ? `${fact.where} ${fact.prop} matches (${actual})` : `${fact.where} ${fact.prop}: actual ${actual}, design ${fact.design}`,
      designNodeId: fact.where, expected: fact.design, actual, delta: null, tolerance: null, unit: null,
      remediation: ok ? null : `set ${fact.prop} to ${fact.design}`,
    });
  }
  return checks;
}

async function readRenderedStyle(page, fact) {
  if (fact.kind === "divider") {
    const raw = await page.evaluate(() => { const hr = document.querySelector("hr"); return hr ? getComputedStyle(hr).borderTopColor : null; });
    return raw == null ? "missing" : parseCssColor(raw);
  }
  const raw = await page.evaluate(
    ({ text, className }) => {
      const matches = Array.from(document.querySelectorAll("*")).filter(
        (el) => (el.textContent || "").trim() === text && el.classList.contains(className),
      );
      if (!matches.length) return null;
      matches.sort((a, b) => a.children.length - b.children.length);
      const cs = getComputedStyle(matches[0]);
      return { color: cs.color, fontSize: cs.fontSize, fontWeight: cs.fontWeight };
    },
    { text: fact.text, className: fact.className },
  );
  if (raw == null) return "missing";
  switch (fact.prop) {
    case "color": return parseCssColor(raw.color);
    case "font-size": return pxNum(raw.fontSize);
    case "font-weight": return weightNum(raw.fontWeight);
    default: return null;
  }
}

/** Measure geometry facts (PR 6B): one bounded DOM collection pass, then compare via the
 *  render-geometry module. A required unmapped/ambiguous fact is non-green; optional skips. */
async function measureGeometryFacts(page, facts) {
  if (!facts.length) return [];
  const rendered = await collectRenderedGeometry(page, facts);
  return compareGeometry(facts, rendered);
}

/** Generate the throwaway component (real template/styles + a synthetic class body). */
function syntheticComponent(selector, html, css) {
  return `import { Component } from "@angular/core";

@Component({
  selector: ${JSON.stringify(selector)},
  template: \`${escapeTpl(html)}\`,
  styles: [\`${escapeTpl(css)}\`],
})
export class UnderTestComponent {
  label = "Simpan count: 3";
  onSave(): void {}
}
`;
}

function escapeTpl(s) {
  return String(s).replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${");
}
