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

/** A tolerated geometry delta in px. Chosen for cross-run/browser subpixel variance; documented in
 *  verify-gate-trust.md §2.3. Position/size and font-size/line-height share this small bound. */
export const GEOMETRY_TOLERANCE_PX = 2;

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

/** Reuse the exact authored-rule facts static verify judges, plus the geometry facts PR 6 adds.
 *  Preserve each fact's own `kind` ("text"/"divider") — the rendered reader dispatches on it. */
function collectDesignFacts(scss, html, transcript) {
  const { comparable } = collectStyleFacts(scss, html, transcript);
  const styleFacts = comparable.map((f) => ({ ...f }));
  const geometryFacts = collectGeometryFacts(transcript);
  return { styleFacts, geometryFacts };
}

/**
 * Geometry facts (bounded, evidence-backed) — a superset of the style facts static verify already
 * checks. Derived ONLY from transcript literal/structural facts (node w/h/padding/radius/border +
 * text), never from spec.md or resolver hints. Mapping is text/role-based and deterministic;
 * ambiguous or absent mapping skips that fact (never a silent first-pick).
 */
function collectGeometryFacts(transcript) {
  const facts = [];
  // Root padding: the outermost node that declares padding (the page container).
  const root = transcript.layout.find((n) => n?.padding && Object.values(n.padding).some((v) => v > 0));
  if (root) {
    facts.push({
      id: "SUI-RENDER-GEOMETRY-001", kind: "root-padding", category: "spacing",
      selector: ".content", where: "root", prop: "padding",
      design: ["top", "right", "bottom", "left"].map((k) => Number(root.padding[k] ?? 0) || 0),
      designNodeId: root.id, tolerance: GEOMETRY_TOLERANCE_PX, unit: "px",
      trust: "literal-design", remediation: "match the design frame's explicit padding",
    });
  }
  // NOTE (PR 6 §18): button/control frame w/h in the transcript are DESIGN FRAME dimensions, not
  // literal CSS width/height — a correct implementation reaches them via font+padding (or is
  // deliberately fluid). Comparing getBoundingClientRect().width/height against node.w/node.h
  // false-fails the correct reference (the "canvas position → internal layout" anti-pattern). Only
  // facts the output MUST honor literally are compared here: root padding and divider height.
  // Divider height (distinctive divider carries h=1).
  let divider = null;
  (function findDivider(nodes) {
    for (const n of nodes ?? []) {
      if (divider) return;
      if (!n || typeof n !== "object") continue;
      if (n.type === "divider" && Number(n.h) > 0) { divider = n; return; }
      if (n.children) findDivider(n.children);
    }
  })(transcript.layout);
  if (divider) {
    facts.push({
      id: "SUI-RENDER-GEOMETRY-004", kind: "divider-height", category: "border",
      selector: "hr", where: "divider", prop: "height", design: Number(divider.h),
      designNodeId: divider.id, tolerance: 1, unit: "px",
      trust: "literal-design", remediation: `set the divider line thickness to ${Number(divider.h)}px`,
    });
  }
  return facts;
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

/** Read geometry facts from the mounted DOM (bounding box + computed styles). */
async function measureGeometryFacts(page, facts) {
  const checks = [];
  for (const fact of facts) {
    let actual = null;
    if (fact.kind === "root-padding") {
      const sides = await page.evaluate((sel) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        const cs = getComputedStyle(el);
        const num = (v) => (v.endsWith("px") ? Number(parseFloat(v)) : null);
        return [cs.paddingTop, cs.paddingRight, cs.paddingBottom, cs.paddingLeft].map(num);
      }, fact.selector);
      actual = sides;
    } else if (fact.kind === "divider-height") {
      // The design's `h` for a divider is the LINE thickness, not the hr's total box height
      // (which includes UA margin). Measure border-top width (the visible rule).
      actual = await page.evaluate(() => {
        const hr = document.querySelector("hr");
        if (!hr) return null;
        const w = getComputedStyle(hr).borderTopWidth;
        return w.endsWith("px") ? Number(parseFloat(w)) : null;
      });
    } else {
      // control-height / button-width: map by visible text.
      actual = await page.evaluate(
        ({ text, prop }) => {
          const btns = Array.from(document.querySelectorAll("button, a, .btn")).filter(
            (el) => (el.textContent || "").trim().includes(text),
          );
          if (!btns.length) return null;
          const r = btns[0].getBoundingClientRect();
          return prop === "height" ? r.height : r.width;
        },
        { text: fact.text, prop: fact.prop },
      );
    }

    const ok = fact.kind === "root-padding"
      ? (actual ?? []).every((v, i) => v !== null && Math.abs(v - fact.design[i]) <= fact.tolerance)
      : actual !== null && Math.abs(actual - fact.design) <= fact.tolerance;

    checks.push({
      name: "renderGeometry", id: fact.id, category: fact.category,
      status: actual == null ? "skip" : (ok ? "pass" : "fail"),
      trust: fact.trust,
      detail: actual == null
        ? `${fact.where} ${fact.prop}: element not mapped (skipped — no silent first-pick)`
        : (ok ? `${fact.where} ${fact.prop} matches (${formatNum(actual)})`
           : `${fact.where} ${fact.prop}: actual ${formatNum(actual)}, design ${fact.kind === "root-padding" ? fact.design.join("/") : fact.design} (tolerance ±${fact.tolerance}${fact.unit})`),
      designNodeId: fact.designNodeId, selector: fact.selector ?? fact.text ?? null,
      expected: fact.design, actual, delta: fact.kind === "root-padding" ? null : (actual == null ? null : Math.round((actual - fact.design) * 10) / 10),
      tolerance: fact.tolerance, unit: fact.unit,
      remediation: ok || actual == null ? null : fact.remediation,
    });
  }
  return checks;
}

function formatNum(v) {
  if (Array.isArray(v)) return v.map((x) => x == null ? "?" : x).join("/");
  return v == null ? "?" : (Math.round(v * 10) / 10);
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
