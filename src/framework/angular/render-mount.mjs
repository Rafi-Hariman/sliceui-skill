// render-mount (Option A) — the Angular-mount half of "verify hijau ≠ UI benar di localhost".
//
// Option B (render-probe.mjs) renders generated HTML+CSS in a bare page; it deliberately does
// NOT mount Angular, so it cannot see: (1) real SCSS compilation, (2) emulated view-encapsulation
// (`_nghost-*`/`_ngcontent-*` hashes, `:host` scoping), (3) `::ng-deep` piercing into a child
// component, or (4) template bindings (`{{ }}`). This probe closes those by compiling the
// component's real `.scss` with Dart Sass, generating a throwaway component with inline
// template+styles (identical encapsulation pipeline as external files), esbuild-bundling it with
// a tiny mount shell, and booting it via `platformBrowserDynamic().bootstrapModule`.
//
// Correctness invariant: it reuses `collectStyleFacts` + the color/length/weight normalizers from
// verify.mjs, so the mount probe and the verify gate judge the SAME authored-rule facts (reused
// classes like `.btn` are skipped, never flagged).
//
// Boundary (v1, documented not silent): the class body is synthetic — the harness reads the real
// `.html` (→ inline template) and real `.scss` (→ compiled inline styles) and the real selector,
// but ships its own `label` field + `onSave()` so the `{{label}}`/`(click)` bindings have a known
// target. The `.ts` class body itself is not mounted (future refinement). Cross-file `@use`/`@import`
// of project token partials is out of scope (fixture uses literal values).

import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { componentMeta } from "../../lib/ts-ast.mjs";
import { collectStyleFacts, parseCssColor, pxNum, weightNum } from "./verify.mjs";

// Static mount-shell files copied from the fixture into the per-run temp dir. `under-test.component.ts`
// is synthesized fresh (the real template/styles + selector); these four are boilerplate.
const SHELL_FILES = ["main.ts", "app.module.ts", "child.component.ts"];

/**
 * Compile + bundle + boot the component in a headless browser and probe its rendered output.
 *
 * @param {object} opts
 * @param {string} opts.html   generated component template (real Angular template)
 * @param {string} opts.scss   generated component styles (real SCSS, compiled via Dart Sass)
 * @param {string} opts.ts     generated component TS (used for its @Component selector)
 * @param {object} opts.transcript  design transcript (ground truth for style facts)
 * @param {string} opts.fixtureDir  absolute path to the angular-mount fixture (has src/ + node_modules/)
 * @param {function} [opts.launch]  optional browser launcher override for tests
 * @returns {Promise<{ checks: [{ name, status, detail, problems }], facts: object[], signals: object }>}
 */
export async function renderMount({ html = "", scss = "", ts = "", transcript, fixtureDir, launch = null }) {
  const { comparable } = collectStyleFacts(scss, html, transcript);

  if (!comparable.length) {
    return {
      checks: [
        {
          name: "renderMount",
          status: "skip",
          detail: "no authored-rule design facts to render (slice reuses project classes)",
        },
      ],
      facts: [],
      signals: null,
    };
  }

  const selector = componentMeta(ts)?.selector ?? "app-sample-card";

  // 1. Compile real SCSS → CSS. Dart Sass passes `:host`/`::ng-deep` through verbatim; Angular's
  //    JIT then applies emulated encapsulation to this string exactly as it would to an external file.
  const sass = await import("sass");
  const css = sass.compileString(scss, { style: "compressed" }).css;

  // 2. Assemble a throwaway bundle in an isolated temp dir (repo idiom: mkdtemp + rm in finally).
  const dir = mkdtempSync(join(tmpdir(), "sliceui-render-mount-"));
  let browser = null;
  try {
    writeFileSync(join(dir, "under-test.component.ts"), syntheticComponent(selector, html, css));
    for (const f of SHELL_FILES) {
      writeFileSync(join(dir, f), readFileSync(join(fixtureDir, "src", f), "utf8"));
    }

    // 3. esbuild: bundle main.ts → browser IIFE, resolving @angular/* + zone.js from the fixture.
    const esbuild = await import("esbuild");
    const out = join(dir, "bundle.js");
    await esbuild.build({
      entryPoints: [join(dir, "main.ts")],
      bundle: true,
      outfile: out,
      format: "iife",
      platform: "browser",
      target: "es2018",
      nodePaths: [join(fixtureDir, "node_modules")],
      logLevel: "silent",
    });

    // 4. Boot + probe.
    const pw = await import("playwright");
    browser = launch ? await launch() : await pw.chromium.launch();
    const page = await browser.newPage();
    await page.setContent(`<!doctype html><html><head><meta charset="utf-8"></head><body><${selector}></${selector}></body></html>`);
    await page.addScriptTag({ path: out });

    // Wait for bootstrap: host gets a _nghost hash AND the title renders (both prove mount).
    await page.waitForFunction(
      (sel) => {
        const host = document.querySelector(sel);
        if (!host) return false;
        const hasNghost = Array.from(host.attributes).some((a) => a.name.startsWith("_nghost"));
        return hasNghost && host.querySelector("h1.h1") !== null;
      },
      selector,
      { timeout: 15000 },
    );

    const signals = await page.evaluate((sel) => {
      const host = document.querySelector(sel);
      const hostAttrs = Array.from(host.attributes).map((a) => a.name);
      const hostNghost = hostAttrs.some((a) => a.startsWith("_nghost"));
      const childNgcontent = Array.from(host.querySelectorAll("*")).some((el) =>
        Array.from(el.attributes).some((a) => a.name.startsWith("_ngcontent")),
      );
      const bound = host.querySelector(".bound");
      const child = host.querySelector(".child-internal");
      return {
        hostNghost,
        childNgcontent,
        hostDisplay: getComputedStyle(host).display,
        binding: bound ? (bound.textContent || "").trim() : null,
        piercing: child ? getComputedStyle(child).color : null,
      };
    }, selector);

    // 5. Read the same authored-rule facts from the MOUNTED DOM.
    const problems = [];
    const facts = [];
    for (const fact of comparable) {
      const actual = await readRenderedFact(page, fact);
      facts.push({ ...fact, actual });
      if (String(actual).toLowerCase() !== String(fact.design).toLowerCase()) {
        problems.push(`${fact.where} ${fact.prop}: actual ${actual}, design ${fact.design}`);
      }
    }

    const total = comparable.length;
    const matched = total - problems.length;
    const pct = Math.round((matched / total) * 100);
    const status = problems.length ? "fail" : "pass";
    const detail = problems.length
      ? `angular-mount render: ${problems.length}/${total} fact(s) drift (${pct}% match): ${problems.slice(0, 6).join("; ")}`
      : `angular-mount render: ${total}/${total} fact(s) match (encapsulation: ${signals.hostNghost && signals.childNgcontent ? "active" : "missing"})`;

    return { checks: [{ name: "renderMount", status, detail, problems }], facts, signals };
  } finally {
    if (browser) await browser.close();
    rmSync(dir, { recursive: true, force: true });
  }
}

/** Generate the throwaway component source: inline template+styles (real generated output) + a
 *  synthetic class body (known `label` + `onSave`) so the template's bindings resolve deterministically. */
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

/** Escape a string for safe interpolation inside a JS template literal (backslash, backtick, ${). */
function escapeTpl(s) {
  return String(s).replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${");
}

/** Read the RENDERED value for one fact from the mounted DOM (same normalization as verify.mjs). */
async function readRenderedFact(page, fact) {
  if (fact.kind === "divider") {
    const raw = await page.evaluate(() => {
      const hr = document.querySelector("hr");
      return hr ? getComputedStyle(hr).borderTopColor : null;
    });
    if (raw == null) return "missing";
    return parseCssColor(raw);
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
    case "color":
      return parseCssColor(raw.color);
    case "font-size":
      return pxNum(raw.fontSize);
    case "font-weight":
      return weightNum(raw.fontWeight);
    default:
      return null;
  }
}
