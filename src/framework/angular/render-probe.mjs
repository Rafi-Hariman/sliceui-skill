// render-probe (Option B) — the browser-level half of "verify hijau ≠ UI benar di localhost".
//
// `checkStyleFidelity` proves the generated SCSS *text* agrees with the design values. This
// probe goes one step further: it renders the component's HTML + CSS in a headless Chromium
// (Playwright), reads `getComputedStyle`, and compares the RENDERED color/size/weight against
// the SAME authored-rule facts the verify gate judges. It deliberately does NOT mount Angular —
// no bindings, no component encapsulation, no `::ng-deep` — so it proves the CSS cascade half
// of "correct on screen" cheaply, and defers the Angular-mount half to Option A.
//
// Correctness invariant: it reuses `collectStyleFacts` from verify.mjs so the probe and the
// gate can never disagree on WHAT to judge (the same authored-rule guard: reused classes like
// `.btn` are skipped, never flagged). Real SCSS features (`$vars`, nesting, `::ng-deep`,
// `:host`) are OUT OF SCOPE here — callers must pass cascade-valid CSS (see the fixture's
// scssToCss helper in test/render-probe-sliceui.test.mjs).

import { collectStyleFacts, parseCssColor, pxNum, weightNum } from "./verify.mjs";

/**
 * Render `html` + `css` headlessly and compare computed styles to the transcript's design facts.
 *
 * @param {object} opts
 * @param {string} opts.html   generated component template (plain HTML)
 * @param {string} opts.css    generated styles (cascade-valid CSS; Angular-only bits already stripped)
 * @param {object} opts.transcript  design transcript (`.sliceui` ground truth)
 * @param {function} [opts.launch]  optional browser launcher override for tests; defaults to `playwright.chromium.launch()`
 * @returns {Promise<{ checks: [{ name, status, detail, problems }], facts: object[] }>}
 */
export async function renderProbe({ html = "", css = "", transcript, launch = null }) {
  const { comparable } = collectStyleFacts(css, html, transcript);

  if (!comparable.length) {
    return {
      checks: [
        {
          name: "renderFidelity",
          status: "skip",
          detail: "no authored-rule design facts to render (slice reuses project classes)",
        },
      ],
      facts: [],
    };
  }

  const doc = `<!doctype html><html><head><meta charset="utf-8"><style>${escapeStyle(css)}</style></head><body>${html}</body></html>`;

  let browser = null;
  try {
    const pw = await import("playwright");
    browser = launch ? await launch() : await pw.chromium.launch();
    const page = await browser.newPage();
    await page.setContent(doc);

    const problems = [];
    const facts = [];
    for (const fact of comparable) {
      const actual = await readFact(page, fact);
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
      ? `cascade-only render (no Angular mount, no ::ng-deep): ${problems.length}/${total} fact(s) drift (${pct}% match): ${problems.slice(0, 6).join("; ")}`
      : `cascade-only render (no Angular mount, no ::ng-deep): ${total}/${total} fact(s) match`;

    return { checks: [{ name: "renderFidelity", status, detail, problems }], facts };
  } finally {
    if (browser) await browser.close();
  }
}

/** Escape a raw-CSS injection so it cannot terminate the host `<style>` element (mirrors render-verify). */
function escapeStyle(css) {
  return String(css ?? "").replace(/<\/style/gi, "<\\/style");
}

/** Read the RENDERED value for one fact (normalized to the same shape as its `design`). */
async function readFact(page, fact) {
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
      // smallest element (fewest descendants) — the innermost node carrying exactly this text
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
