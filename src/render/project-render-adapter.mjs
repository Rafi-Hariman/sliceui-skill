// render/project-render-adapter — the ProjectRenderAdapter contract (doc 04 §8) + DOM evidence
// collection + an honest render-tier classification.
//
// Three tiers, NEVER conflated:
//   STATIC        — source presence / authored-rule facts only (never render fidelity)
//   SYNTHETIC     — the throwaway Angular mount (render-verify.mjs): fast feedback, NOT production
//   PROJECT-REAL  — the actual project NgModule/styles/libraries mounted (pilar-mount.mjs, gated)
//
// The adapter does not fake a project-real mount: if the private Pilar can't be mounted, the affected
// checks are reported gated/unverifiable, never silently substituted with a fake component and PASS.

export const RENDER_TIERS = Object.freeze({ STATIC: "static", SYNTHETIC: "synthetic", PROJECT_REAL: "project-real" });

/** A ProjectRenderAdapter: detect/prepare/build/mount/collect (doc 04 §8). Adapters may implement a
 *  subset — the tier reports what they actually loaded, not what they claim. */
export function makeAdapter({ id, detect, prepare, build, mount, collect, tier }) {
  return { id, detect, prepare, build, mount, collect, tier };
}

/** Classify a render result into a tier from WHAT it loaded (never from a label). */
export function classifyRender({ projectMounted = false, syntheticMounted = false, staticOnly = false }) {
  if (projectMounted) return RENDER_TIERS.PROJECT_REAL;
  if (syntheticMounted) return RENDER_TIERS.SYNTHETIC;
  if (staticOnly) return RENDER_TIERS.STATIC;
  return null;
}

/** The shape of browser-collected DOM evidence consumed by verification/verify.mjs. */
export function emptyDomEvidence() {
  return { rects: new Map(), computedStyles: new Map(), domTexts: [], domState: {} };
}

/**
 * Collect DOM evidence in the browser for the verification orchestrator. `map` binds design node ids
 * to DOM selectors (locator-only — never an expected value). Returns rects/computed-styles per mapped
 * node + all visible text + the pagination visibility state.
 *
 * @param {object} page — a Playwright page (already mounted)
 * @param {Record<string,string>} map — designNodeId → selector
 * @returns {Promise<{ rects: Map, computedStyles: Map, domTexts: string[], domState: object }>}
 */
export async function collectDomEvidence(page, map = {}) {
  const entries = Object.entries(map);
  return page.evaluate(({ entries }) => {
    const isVisible = (el) => {
      if (!el || el.hasAttribute?.("hidden")) return false;
      for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
        const cs = getComputedStyle(n);
        if (cs.display === "none" || cs.visibility === "hidden" || cs.visibility === "collapse") return false;
      }
      return true;
    };
    const rects = {};
    const computedStyles = {};
    for (const [nodeId, selector] of entries) {
      const els = Array.from(document.querySelectorAll(selector)).filter(isVisible);
      if (!els.length) continue;
      const el = els[0];
      const r = el.getBoundingClientRect();
      rects[nodeId] = { x: Math.round(r.x * 10) / 10, y: Math.round(r.y * 10) / 10, width: Math.round(r.width * 10) / 10, height: Math.round(r.height * 10) / 10 };
      const cs = getComputedStyle(el);
      // The placeholder pseudo-element's color is a DISTINCT semantic target from the input's own
      // foreground — read it separately so the two are never conflated.
      let placeholderColor = null;
      try { placeholderColor = getComputedStyle(el, "::placeholder").color ?? null; } catch { placeholderColor = null; }
      computedStyles[nodeId] = { color: cs.color, backgroundColor: cs.backgroundColor, borderColor: cs.borderColor, placeholderColor, fontSize: cs.fontSize, fontWeight: cs.fontWeight };
    }
    // All visible leaf text (exact-content oracle).
    const domTexts = Array.from(document.querySelectorAll("body *"))
      .filter((el) => isVisible(el) && el.children.length === 0 && (el.textContent || "").trim())
      .map((el) => (el.textContent || "").replace(/\s+/g, " ").trim());
    // Pagination visibility: the design footer ("Menampilkan … data") is present and visible.
    const paginationVisible = Array.from(document.querySelectorAll("*")).some((el) => isVisible(el) && /menampilkan|showing\b/i.test(el.textContent || "") && /data/i.test(el.textContent || ""));
    return { rects, computedStyles, domTexts, domState: { paginationVisible } };
  }, { entries });
}

/**
 * Collect responsive-safety evidence at multiple viewport widths: document-level overflow,
 * control overlap (pairwise rect intersection), critical-content clipping, FILL tracking, and
 * intended-scroller dimensions. Intended scrollers are REPORTED (their internal overflow is the
 * design's scroll strategy, not a defect) — only DOCUMENT-level overflow fails.
 *
 * @param {object} page — a Playwright page (already mounted)
 * @param {{ viewports: Array<{width:number,height?:number}>, controls?: string[], critical?: Array<{nodeId?:string,selector:string}>, fill?: Array<{nodeId?:string,selector:string}>, scrollers?: string[], region?: string|null }} spec
 */
export async function collectResponsiveEvidence(page, spec) {
  const { viewports = [], controls = [], critical = [], fill = [], scrollers = [], region = null } = spec;
  const out = [];
  for (const vp of viewports) {
    await page.setViewportSize({ width: vp.width, height: vp.height ?? 700 });
    await page.waitForTimeout(60);
    const m = await page.evaluate(({ controls, critical, fill, scrollers, region }) => {
      const de = document.documentElement;
      const isVisible = (el) => {
        for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
          const cs = getComputedStyle(n);
          if (cs.display === "none" || cs.visibility === "hidden") return false;
        }
        return true;
      };
      const round = (v) => Math.round(v * 10) / 10;
      // Document-level overflow (the defect signal) + the two widths that produced it.
      const pageOverflow = Math.max(0, round(de.scrollWidth - de.clientWidth));
      // Intended scrollers: reported dimensions, never failed.
      const scrollerInfo = scrollers.map((sel) => {
        const el = document.querySelector(sel);
        return el ? { selector: sel, scrollWidth: el.scrollWidth, clientWidth: el.clientWidth } : { selector: sel, scrollWidth: null, clientWidth: null };
      });
      // Control overlap: pairwise intersection of visible control elements.
      const els = controls.flatMap((sel) => Array.from(document.querySelectorAll(sel)).filter(isVisible).map((el) => ({ key: sel, r: el.getBoundingClientRect() })));
      const overlaps = [];
      for (let i = 0; i < els.length; i++) {
        for (let j = i + 1; j < els.length; j++) {
          const a = els[i].r, b = els[j].r;
          const x = Math.min(a.right, b.right) - Math.max(a.left, b.left);
          const y = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
          if (x > 1 && y > 1) overlaps.push({ a: els[i].key, b: els[j].key, area: Math.round(x * y) });
        }
      }
      // Critical clipping: how far outside the usable region (or viewport) the element sits.
      const clipped = [];
      for (const c of critical) {
        const el = document.querySelector(c.selector);
        if (!el) continue;
        const r = el.getBoundingClientRect();
        const host = region ? document.querySelector(region) : null;
        const b = host ? host.getBoundingClientRect() : { left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight };
        const outsideBy = round(Math.max(0, b.left - r.left, r.right - b.right, b.top - r.top, r.bottom - b.bottom));
        if (outsideBy > 0) clipped.push({ nodeId: c.nodeId ?? c.selector, outsideBy, bounds: { left: round(r.left), top: round(r.top), right: round(r.right), bottom: round(r.bottom) } });
      }
      // FILL tracking: the element's width vs its parent's at THIS width.
      const fillInfo = fill.map((f) => {
        const el = document.querySelector(f.selector);
        if (!el || !el.parentElement) return null;
        const w = el.getBoundingClientRect().width;
        const pw = el.parentElement.getBoundingClientRect().width;
        return { nodeId: f.nodeId ?? f.selector, width: round(w), parentWidth: round(pw), ratio: pw > 0 ? round(w / pw) : null };
      }).filter(Boolean);
      return {
        pageOverflow,
        documentWidths: { scrollWidth: de.scrollWidth, clientWidth: de.clientWidth },
        scrollers: scrollerInfo, overlaps, clipped, fill: fillInfo,
      };
    }, { controls, critical, fill, scrollers, region });
    out.push({ width: vp.width, ...m });
  }
  return out;
}
