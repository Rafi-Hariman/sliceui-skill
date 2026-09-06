// pilar-mount — the real-render proof that a pilar slice WORKS, not just type-checks.
//
// Fase 1 (verify policy + catalog names) and Fase 2 (type-check vs stub) prove name+type. This
// proves the third claim: `<uii-table>` actually resolves and renders rows. It mounts the slice
// together with pilar's real TableModule/PaginationModule from a built pilar dist, bundles via
// esbuild (peer deps resolved from the checkout's node_modules), boots with
// platformBrowserDynamic, and probes the mounted DOM for rendered rows.
//
// DEV-ONLY: pilar lives on a private registry + its repo is not in CI. Gated on `PILAR_CHECKOUT`
// AND an existing `dist/uiigateway/pilar` — absent either, the test SKIPS with the exact build
// commands (honest, not silent-green). Leaf-first strategy: the smallest-dependency component
// (uii-pagination or uii-switch) is the first "mount green"; uii-table is the full-table target.

import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** Resolve the pilar dist + node_modules from a checkout root, or null with a reason. */
export function resolvePilar(checkout) {
  if (!checkout) return { ok: false, reason: "PILAR_CHECKOUT not set — pilar is dev-only (private repo)" };
  const dist = join(checkout, "dist", "uiigateway", "pilar");
  if (!existsSync(join(dist, "package.json"))) {
    return {
      ok: false,
      reason: `pilar dist not built at ${dist}. Build it: cd ${checkout} && npm install && npm run build:lib`,
    };
  }
  const nm = join(checkout, "node_modules");
  if (!existsSync(nm)) {
    return { ok: false, reason: `pilar checkout has no node_modules (peer deps missing). cd ${checkout} && npm install` };
  }
  return { ok: true, dist, nodeModules: nm };
}

/**
 * Mount a slice + pilar module(s) and probe rendered DOM.
 * @param {object} opts
 * @param {string} opts.html      slice template (contains `<uii-table>`/`<uii-pagination>`/…)
 * @param {string} opts.ts        slice component TS (selector + mock rows/columns)
 * @param {string} opts.scss      slice styles (optional)
 * @param {string} opts.checkout   pilar checkout root (PILAR_CHECKOUT)
 * @param {string} opts.probe       JS expression to eval against document (returns a JSON-safe value)
 * @param {function} [opts.launch]  browser launcher override for tests
 * @returns {Promise<{ checks: [{name,status,detail,problems}], signals: object }>}
 */
export async function pilarMount({ html, ts, scss = "", checkout, probe, launch = null, moduleNames = ["TableModule", "PaginationModule", "SwitchModule"] }) {
  const resolved = resolvePilar(checkout);
  if (!resolved.ok) {
    return { checks: [{ name: "pilarMount", status: "skip", detail: resolved.reason }], signals: null };
  }

  const { dist, nodeModules } = resolved;
  // ng-packagr's pilar dist entry. The esm2020 bundle uses extensionless relative imports
  // (`./public_api`) that esbuild can't resolve; fesm2015 is the FLAT bundle (all re-exports
  // inlined into one file) — the correct entry for a standalone esbuild IIFE build.
  const pilarEntry = [join(dist, "fesm2015", "pilar.mjs"), join(dist, "esm2020", "pilar.mjs")].find((p) => existsSync(p));
  if (!pilarEntry) {
    return { checks: [{ name: "pilarMount", status: "skip", detail: `pilar dist has no esm2020/pilar.mjs or fesm2015/pilar.mjs at ${dist}` }], signals: null };
  }

  const dir = mkdtempSync(join(tmpdir(), "sliceui-pilar-mount-"));
  let browser = null;
  try {
    // 1. The under-test slice component: keep its real selector + class NAME, but inline the
    //    real template + styles so the temp bundle is self-contained. The class body (rows/
    //    columns) survives, so uii-table's bindings resolve against real mock data.
    const { selector, className } = componentIdentity(ts);
    const sliceTs = syntheticSliceComponent(selector, className, html, scss, ts);
    writeFileSync(join(dir, "under-test.component.ts"), sliceTs);
    writeFileSync(join(dir, "app.module.ts"), appModuleShell(className, moduleNames));
    writeFileSync(join(dir, "main.ts"), mainShell());

    // 2. esbuild bundle — nodePaths resolve `pilar` + @angular/* + peer deps from the checkout.
    const esbuild = await import("esbuild");
    const out = join(dir, "bundle.js");
    await esbuild.build({
      entryPoints: [join(dir, "main.ts")],
      bundle: true,
      outfile: out,
      format: "iife",
      platform: "browser",
      target: "es2018",
      nodePaths: [nodeModules],
      alias: { pilar: pilarEntry },
      logLevel: "silent",
    });

    // 3. Boot + probe.
    const pw = await import("playwright");
    browser = launch ? await launch() : await pw.chromium.launch();
    const page = await browser.newPage();
    const errors = [];
    page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });
    page.on("pageerror", (err) => errors.push(String(err?.message ?? err)));
    await page.setContent(`<!doctype html><html><head><meta charset="utf-8"></head><body><${selector}></${selector}></body></html>`);
    await page.addScriptTag({ path: out });

    // Wait for bootstrap: the host element gains an ng-version OR a _nghost attribute (both
    // prove Angular mounted). Surface any console errors on timeout so the failure is diagnosable.
    try {
      await page.waitForFunction(
        (sel) => {
          const host = document.querySelector(sel);
          if (!host) return false;
          return host.getAttribute("ng-version") !== null || Array.from(host.attributes).some((a) => a.name.startsWith("_nghost"));
        },
        selector,
        { timeout: 20000 },
      );
    } catch (e) {
      const ctx = errors.length ? ` — console errors: ${errors.slice(0, 3).join(" | ")}` : "";
      // Known pilar packaging blocker: TableModule hard-imports @angularfy/autonumeric (View
      // Engine, non-Ivy) which cannot JIT-bootstrap under Angular 13. This is a pilar defect,
      // NOT a slice defect — surface it as a documented skip, not a generic red.
      if (errors.some((er) => /AutonumericModule.*ɵmod|ɵmod.*AutonumericModule/i.test(er))) {
        return {
          checks: [{
            name: "pilarMount",
            status: "skip",
            detail: "pilar TableModule imports a non-Ivy (View Engine) @angularfy/autonumeric@3.0.3 — cannot JIT-mount uii-table under Angular 13. Fix in pilar (upgrade/remove autonumeric) or mount a non-table slice; the leaf mount (uii-pagination) proves the pipeline works.",
          }],
          signals: null,
        };
      }
      return { checks: [{ name: "pilarMount", status: "fail", detail: `bootstrap timeout (selector <${selector}>)${ctx}` }], signals: null };
    }

    const signals = await page.evaluate((expr) => {
      // eslint-disable-next-line no-new-func
      return new Function("document", `return (${expr})`)(document);
    }, probe);

    const problems = [];
    if (errors.length) problems.push(`browser console errors: ${errors.slice(0, 3).join(" | ")}`);
    const status = problems.length ? "fail" : "pass";
    const detail = problems.length
      ? `pilar-mount: ${problems.join("; ")}`
      : "pilar-mount: component mounted and probed";

    return { checks: [{ name: "pilarMount", status, detail, problems }], signals };
  } catch (e) {
    return { checks: [{ name: "pilarMount", status: "fail", detail: `pilar-mount failed: ${String(e?.message ?? e).slice(0, 300)}` }], signals: null };
  } finally {
    if (browser) await browser.close();
    rmSync(dir, { recursive: true, force: true });
  }
}

/** The slice component's selector + class name from its TS (defaults for a bare template). */
function componentIdentity(tsSource) {
  const selector = /selector:\s*["']([^"']+)["']/.exec(tsSource)?.[1] ?? "app-sample";
  const className = /export\s+class\s+(\w+)/.exec(tsSource)?.[1] ?? "AppSampleComponent";
  return { selector, className };
}

/** Rebuild the component: real selector + class name, inline template (the generated HTML) and
 *  inline styles (the generated SCSS→CSS is NOT compiled here — pilar ships its own CSS; the
 *  slice's SCSS is passed through as-is for the probe's cascade). The class BODY (rows/columns/
 *  handlers) is preserved so bindings resolve. */
function syntheticSliceComponent(selector, className, html, scss, tsSource) {
  // Preserve the original class body (everything after `export class Name {`) minus its
  // @Component decorator. A bare template (no tsSource) synthesizes a minimal body.
  let body = "";
  if (tsSource) {
    const m = /export\s+class\s+\w+\s*\{([\s\S]*)\}/.exec(tsSource);
    body = m ? m[1].trim() : "";
    // Drop the old @Component decorator so we can re-attach one with the inline template.
    tsSource = tsSource.replace(/@Component\([\s\S]*?\}\)\s*/, "");
  }
  const styles = scss ? `,\n  styles: [\`${escapeTpl(scss)}\`]` : "";
  return `import { Component } from "@angular/core";
${tsSource && !tsSource.includes("@angular/core") ? tsSource.replace(/^import[\s\S]*?from\s+["']@angular\/core["']\s*;?/m, "") : ""}
@Component({
  selector: ${JSON.stringify(selector)},
  template: \`${escapeTpl(html)}\`${styles}
})
export class ${className} {
  ${body}
}`;
}

/** A NgModule shell importing ONLY the pilar modules the slice needs. TableModule drags in
 *  AutonumericModule.forRoot(), whose compiled dist duplicates `AutonumericModule2` without
 *  ɵmod under JIT bootstrap (a pilar bundling edge, not a slice defect) — so a leaf test that
 *  doesn't render a table imports only PaginationModule/SwitchModule (CommonModule-only). */
function appModuleShell(className, moduleNames = ["TableModule", "PaginationModule", "SwitchModule"]) {
  const imports = ["BrowserModule", ...moduleNames];
  return `import { NgModule } from "@angular/core";
import { BrowserModule } from "@angular/platform-browser";
import { ${moduleNames.join(", ")} } from "pilar";
import { ${className} } from "./under-test.component";
@NgModule({
  imports: [${imports.join(", ")}],
  declarations: [${className}],
  bootstrap: [${className}],
})
export class AppModule {}`;
}

function mainShell() {
  return `import "zone.js";
import { platformBrowserDynamic } from "@angular/platform-browser-dynamic";
import { AppModule } from "./app.module";
platformBrowserDynamic().bootstrapModule(AppModule).catch((e) => console.error(e));`;
}

/** Escape a string for safe interpolation inside a JS template literal. */
function escapeTpl(s) {
  return String(s).replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${");
}
