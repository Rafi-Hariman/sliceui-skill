// render-geometry (PR 6B) — evidence-backed rendered geometry facts + comparison.
//
// PR 6A measured root padding, divider thickness, and text color/size/weight. PR 6B extends the
// MEASUREMENT only (mount/network/failure/package contracts stay in render-verify.mjs): it derives
// additional geometry facts from the transcript — the ONLY expected-geometry oracle (never
// spec.md/resolved.json/agent-context/sample defaults) — collects the browser box model in ONE
// bounded evaluate pass, and compares with centralized tolerances.
//
// Semantic mapping (design frame → CSS box), explicit per fact via `box`:
//   - `border-box` — the design frame IS the rendered box (control height, table frame). Compared
//     against getBoundingClientRect (border-box), so border+padding are included naturally.
//   - `structural` — a relationship/derived value (accidental overflow).
// Canvas x/y is NEVER copied into internal layout expectations; a fluid/unconstrained dimension is
// not compared.
//
// SCOPE (honest). PR 6B: control-height (input, button) · line-height · table-box · root padding ·
// divider · text color/size/weight.
// PR 6C adds, whenever the design fact exists in the transcript:
//   flex/structural gap · border width/color · uniform + per-corner radius · letter-spacing ·
//   role font-size/font-weight · font family · table frame · unintended horizontal overflow.
// Facts whose design node cannot be identified by text/role bind through a fixture-scoped,
// LOCATOR-ONLY selector map (selector-map.mjs) — the map names an element, never a value.
//
// EXPLICITLY UNSUPPORTED — no design fact exists, so measuring would be a fake oracle. These are
// declared, not deferred (§20/§24/§25):
//   table row height · table cell padding   (figml-parse emits no row/cell node type — a Figma
//                                            table arrives as group → row groups → text nodes,
//                                            so padding cannot be separated from line-height)
//   border style                            (the parser does not emit stroke style)
//   alignment other than `space-between`    (justifyContentOf maps only that value)
//   expected-scroll / valid-truncation      (no design fact expresses either intent)
// A `pass` here always means a real measured value matched within tolerance.

import { walkNodes } from "../../lib/walk-nodes.mjs";

/** Centralized tolerances (px) — no scattered magic numbers (§13/§15). Each family's bound is
 *  derived from three-run browser variance plus a bounded subpixel allowance; none is loosened to
 *  hide a material mismatch. */
export const GEOMETRY_TOLERANCE = Object.freeze({
  box: 2,        // control / table / frame box height (border-box)
  line: 1,       // line-height — typography is tighter
  overflow: 1,   // accidental overflow allowance (defect direction only)
  gap: 1,        // flex/structural gap between siblings
  border: 1,     // border width
  radius: 1,     // corner radius
  fontSize: 1,   // font-size
  letter: 0.5,   // letter-spacing — subpixel by nature
  weight: 0,     // font-weight — a discrete enum value; exact match only
});

/** Bounded category vocabulary (extends the PR 6A/6B set, §32). */
export const GEOMETRY_CATEGORY = Object.freeze({
  SPACING: "spacing",
  CONTROL_HEIGHT: "control-height",
  BUTTON: "button-geometry",
  TYPOGRAPHY: "typography",
  TABLE: "table-density",
  BORDER: "border",
  OVERFLOW: "overflow",
  PAGINATION: "pagination",
  ALIGNMENT: "alignment",
  RADIUS: "radius",
  FONT: "font",
});

const px = (v) => (Number.isFinite(Number(v)) ? Number(v) : null);

/** Unique per-fact key (stable diagnostic `id` + the design node it came from). A family such as
 *  `font-size-body` contributes one fact per design text node, so `id` alone is not unique. */
export const factKey = (f) => (f.designNodeId ? `${f.id}::${f.designNodeId}` : f.id);

/**
 * Derive comparable geometry facts from a transcript (design facts only).
 * @param {object} transcript
 * @param {Map<string,{selector:string,required:boolean}>} [mapIndex] — a fixture's locator-only
 *   map, used ONLY to bind a design node to a rendered element. It never supplies an expected value.
 * @returns {Array} facts: { id, family, category, box, required, trust, expected, tolerance, unit, mapping, designNodeId, remediation }
 */
export function collectGeometryFacts(transcript, mapIndex = null) {
  const facts = [];
  if (!transcript?.layout?.length) return facts;

  // --- root padding (PR 6A fact, owned here now) ---
  const root = transcript.layout.find((n) => n?.padding && Object.values(n.padding).some((v) => v > 0));
  if (root) {
    facts.push({
      id: "SUI-RENDER-GEOMETRY-001", family: "root-padding", category: GEOMETRY_CATEGORY.SPACING,
      box: "border-box", required: true, trust: "literal-design",
      expected: ["top", "right", "bottom", "left"].map((k) => px(root.padding[k]) ?? 0),
      tolerance: GEOMETRY_TOLERANCE.box, unit: "px", designNodeId: root.id,
      mapping: { kind: "root-padding" },
      remediation: "match the design frame's explicit padding",
    });
  }

  // --- control heights: a design frame with h > 0 is a literal control box ---
  const seenInput = { done: false };
  walkNodes(transcript.layout, (n) => {
    if (!n || typeof n !== "object") return;
    const h = px(n.h);
    if (h == null || h <= 0) return;
    if (n.type === "input" && !seenInput.done) {
      seenInput.done = true; // one representative input (bounded sampling)
      // DOC-001: a literal input-height design fact mapped to the VISIBLE control border box is
      // REQUIRED (the design frame is the rendered control box, per the plan §16) — an
      // outside-tolerance mismatch blocks, and a missing/ambiguous mapping is non-green.
      facts.push({
        id: "SUI-RENDER-GEOMETRY-002", family: "control-height", category: GEOMETRY_CATEGORY.CONTROL_HEIGHT,
        box: "border-box", required: true, trust: "literal-design", expected: h,
        tolerance: GEOMETRY_TOLERANCE.box, unit: "px", designNodeId: n.id,
        mapping: { kind: "control", role: "input" },
        remediation: `set the rendered input height to ${h}px`,
      });
    }
    if (n.type === "button" && (n.text ?? "").trim()) {
      // A button's design-frame `h` is NOT reliably a literal CSS border-box: a correct
      // implementation legitimately reaches it via font + padding (or is fluid). Compared as an
      // OPTIONAL fact → surfaced as a leading-indicator warning, never a false blocking fail (§9).
      facts.push({
        id: "SUI-RENDER-GEOMETRY-003", family: "button-height", category: GEOMETRY_CATEGORY.BUTTON,
        box: "border-box", required: false, trust: "literal-design", expected: h,
        tolerance: GEOMETRY_TOLERANCE.box, unit: "px", designNodeId: n.id,
        mapping: { kind: "button-text", text: (n.text ?? "").trim() },
        remediation: `set the rendered button height to ${h}px`,
      });
    }
  });

  // --- line-height (typography): only when the design declares one; bounded to distinct values ---
  const seenLine = new Set();
  walkNodes(transcript.layout, (n) => {
    if (!n || n.type !== "text" || !(n.text ?? "").trim()) return;
    const lh = px(n.style?.lineHeight);
    if (lh == null || lh <= 0) return;
    const key = `${(n.text ?? "").trim()}|${lh}`;
    if (seenLine.has(key)) return;
    seenLine.add(key);
    facts.push({
      id: "SUI-RENDER-GEOMETRY-005", family: "line-height", category: GEOMETRY_CATEGORY.TYPOGRAPHY,
      box: "border-box", required: true, trust: "literal-design", expected: lh,
      tolerance: GEOMETRY_TOLERANCE.line, unit: "px", designNodeId: n.id,
      mapping: { kind: "text", text: (n.text ?? "").trim() },
      remediation: `set the line-height to ${lh}px`,
    });
  });

  // --- divider line thickness (a distinctive divider carries h=1) — PR 6A fact, owned here ---
  let divider = null;
  (function findDivider(nodes) {
    for (const n of nodes ?? []) {
      if (divider) return;
      if (!n || typeof n !== "object") continue;
      if (n.type === "divider" && px(n.h) > 0) { divider = n; return; }
      if (n.children) findDivider(n.children);
    }
  })(transcript.layout);
  if (divider) {
    facts.push({
      id: "SUI-RENDER-GEOMETRY-004", family: "divider-height", category: GEOMETRY_CATEGORY.BORDER,
      box: "border-box", required: true, trust: "literal-design", expected: px(divider.h),
      tolerance: 1, unit: "px", designNodeId: divider.id,
      mapping: { kind: "divider" },
      remediation: `set the divider line thickness to ${px(divider.h)}px`,
    });
  }

  // --- table frame height (optional — only when a table-marked node carries an explicit h) ---
  walkNodes(transcript.layout, (n) => {
    if (!n || !n.table || !(n.children ?? []).length) return;
    const h = px(n.h);
    if (h == null || h <= 0) return;
    facts.push({
      id: "SUI-RENDER-GEOMETRY-008", family: "table-box", category: GEOMETRY_CATEGORY.TABLE,
      box: "border-box", required: false, trust: "literal-design", expected: h,
      tolerance: GEOMETRY_TOLERANCE.box, unit: "px", designNodeId: n.id,
      mapping: { kind: "control", role: "table" },
      remediation: "match the design's table frame height",
    });
  });

  // --- overflow (§24/§7, defect side): the page container must not overflow unexpectedly. This is
  //     a STRUCTURAL fact — the expected value is "no unintended overflow" (0), not a design number.
  //     Both axes are checked: a table or toolbar may legitimately scroll (§24 r2), and
  //     `overflow: hidden` is not itself an error (§24 r3) — only a MEASURED overflow delta fails. ---
  const overflowRoot = transcript.layout.find((n) => n?.padding && Object.values(n.padding).some((v) => v > 0));
  if (overflowRoot) {
    for (const [axis, id, fam, rem] of [
      ["x", "SUI-RENDER-OVERFLOW-001", "overflow-x", "remove the unintended horizontal overflow — the container scrolls beyond its box"],
      ["y", "SUI-RENDER-OVERFLOW-002", "overflow-y", "remove the unintended vertical overflow — the container scrolls beyond its box"],
    ]) {
      facts.push({
        id, family: fam, category: GEOMETRY_CATEGORY.OVERFLOW,
        box: "structural", required: true, trust: "literal-design", expected: 0,
        tolerance: GEOMETRY_TOLERANCE.overflow, unit: "px", designNodeId: overflowRoot.id,
        mapping: { kind: "overflow", axis },
        remediation: rem,
      });
    }
  }

  // --- PR 6C families (see the module footer for the honest-disposition table) ---
  facts.push(...collectStructuralFacts(transcript, mapIndex));
  facts.push(...collectTypographyRoleFacts(transcript));
  return facts;
}

/** Bounded per-family cap: a pathological design cannot explode the check set (§33). */
export const MAX_FACTS_PER_FAMILY = 8;

/**
 * PR 6C structural facts. These bind a DESIGN NODE to a rendered element through the fixture's
 * locator map — the transcript alone cannot identify, say, the third pagination item's element.
 *
 * A structural fact is emitted ONLY when its design fact exists AND the map binds it. An unbound
 * node contributes nothing (rather than a guessed locator): measuring a guessed element would be a
 * fake oracle. The map supplies the locator; the expected value always comes from the transcript.
 */
function collectStructuralFacts(transcript, mapIndex) {
  const facts = [];
  const budget = new Map(); // family → emitted count
  const take = (family) => {
    const n = budget.get(family) ?? 0;
    if (n >= MAX_FACTS_PER_FAMILY) return false;
    budget.set(family, n + 1);
    return true;
  };
  const bound = (n) => mapIndex?.get?.(n.id) ?? null;
  const mappedNodes = []; // design nodes with a locator — the OVF-001 objective-overflow targets

  walkNodes(transcript.layout, (n) => {
    if (!n || typeof n !== "object" || n.hidden) return;
    if (bound(n)) mappedNodes.push(n);

    // --- flex/structural gap (§16): the design's declared itemSpacing between a frame's children ---
    const gap = px(n.gap);
    if (gap != null && gap > 0 && take("gap")) {
      const b = bound(n);
      if (b) {
        facts.push({
          id: "SUI-RENDER-GAP-001", family: "gap", category: GEOMETRY_CATEGORY.SPACING,
          box: "structural", required: true, trust: "literal-design", expected: gap,
          tolerance: GEOMETRY_TOLERANCE.gap, unit: "px", designNodeId: n.id,
          // The axis decides WHICH computed gap is the design's item spacing (§16): a row lays
          // items out horizontally, so its item gap is `column-gap`; a column uses `row-gap`. The
          // `gap: a b` shorthand sets them independently, so picking the wrong one would compare a
          // real value against the wrong design fact.
          mapping: { kind: "mapped", selector: b.selector, measure: "gap", axis: n.axis ?? "row" },
          remediation: `set the container gap to ${gap}px`,
        });
      }
    }

    // --- border (§26/§13): the design's stroke on a box is a UNIFORM border fact, so all four
    //     sides must match (BOR-001). Style is NOT emitted by the transcript parser, so only width
    //     and color are compared (see the disposition table). ---
    const bw = px(n.border?.width);
    if (bw != null && bw > 0 && take("border")) {
      const b = bound(n);
      if (b) {
        facts.push({
          id: "SUI-RENDER-BORDER-001", family: "border-width", category: GEOMETRY_CATEGORY.BORDER,
          box: "border-box", required: true, trust: "literal-design", expected: [bw, bw, bw, bw],
          tolerance: GEOMETRY_TOLERANCE.border, unit: "px", designNodeId: n.id,
          mapping: { kind: "mapped", selector: b.selector, measure: "borderWidth" },
          remediation: `set the border width to ${bw}px on all four sides`,
        });
      }
    }
    if (n.border?.color && take("borderColor")) {
      const b = bound(n);
      if (b) {
        facts.push({
          id: "SUI-RENDER-BORDER-002", family: "border-color", category: GEOMETRY_CATEGORY.BORDER,
          box: "border-box", required: true, trust: "literal-design",
          expected: [normHex(n.border.color), normHex(n.border.color), normHex(n.border.color), normHex(n.border.color)],
          tolerance: null, unit: null, designNodeId: n.id,
          mapping: { kind: "mapped", selector: b.selector, measure: "borderColor" },
          remediation: `set the border color to ${normHex(n.border.color)} on all four sides`,
        });
      }
    }

    // --- radius (§27): uniform `radius`, or the asymmetric `cornerRadius{tl,tr,br,bl}` ---
    const r = px(n.radius);
    if (r != null && r >= 0 && take("radius")) {
      const b = bound(n);
      if (b) {
        facts.push({
          id: "SUI-RENDER-RADIUS-001", family: "radius", category: GEOMETRY_CATEGORY.RADIUS,
          box: "border-box", required: true, trust: "literal-design",
          expected: [r, r, r, r], tolerance: GEOMETRY_TOLERANCE.radius, unit: "px",
          designNodeId: n.id,
          mapping: { kind: "mapped", selector: b.selector, measure: "radius" },
          remediation: `set border-radius to ${r}px`,
        });
      }
    } else if (n.cornerRadius && take("cornerRadius")) {
      const b = bound(n);
      const c = n.cornerRadius;
      if (b) {
        facts.push({
          id: "SUI-RENDER-RADIUS-002", family: "corner-radius", category: GEOMETRY_CATEGORY.RADIUS,
          box: "border-box", required: true, trust: "literal-design",
          expected: [px(c.tl) ?? 0, px(c.tr) ?? 0, px(c.br) ?? 0, px(c.bl) ?? 0],
          tolerance: GEOMETRY_TOLERANCE.radius, unit: "px", designNodeId: n.id,
          mapping: { kind: "mapped", selector: b.selector, measure: "radius" },
          remediation: "match the design's per-corner radii",
        });
      }
    }

    // --- table footer frame (§21) and pagination container (§22): container frame height only.
    //     Row/cell density has no design fact — see the disposition table. ---
    if (n.table && take("table-frame")) {
      const b = bound(n);
      if (b) {
        facts.push({
          id: "SUI-RENDER-TABLE-001", family: "table-frame", category: GEOMETRY_CATEGORY.TABLE,
          box: "border-box", required: false, trust: "literal-design", expected: px(n.h),
          tolerance: GEOMETRY_TOLERANCE.box, unit: "px", designNodeId: n.id,
          mapping: { kind: "mapped", selector: b.selector, measure: "height" },
          remediation: "match the design's table frame height",
        });
      }
    }
  });

  // --- OVF-001: objective overflow defects on mapped required elements. Each locator-bound design
  //     node is a REQUIRED element at a specific place, so its own scroll overflow (clipping) and
  //     its position within the viewport are both objective, evidence-backed defects. A `null`
  //     measure (element missing/hidden) already resolves to non-green via the mapping contract.
  //     `overflow: hidden` alone never fails — only a MEASURED delta beyond tolerance does (§24 r3).
  for (const n of mappedNodes) {
    if (!n || n.hidden) continue;
    if (take("element-overflow")) {
      facts.push({
        id: "SUI-RENDER-OVERFLOW-003", family: "element-overflow", category: GEOMETRY_CATEGORY.OVERFLOW,
        box: "structural", required: true, trust: "literal-design", expected: 0,
        tolerance: GEOMETRY_TOLERANCE.overflow, unit: "px", designNodeId: n.id,
        mapping: { kind: "mapped", selector: bound(n).selector, measure: "contentOverflow" },
        remediation: "remove the clipped content — the required element scrolls beyond its own box",
      });
    }
    if (take("off-viewport")) {
      facts.push({
        id: "SUI-RENDER-OVERFLOW-004", family: "off-viewport", category: GEOMETRY_CATEGORY.OVERFLOW,
        box: "structural", required: true, trust: "literal-design", expected: 0,
        tolerance: GEOMETRY_TOLERANCE.overflow, unit: "px", designNodeId: n.id,
        mapping: { kind: "mapped", selector: bound(n).selector, measure: "offViewport" },
        remediation: "keep the required element inside the viewport — it is positioned outside",
      });
    }
  }
  return facts;
}

/**
 * PR 6C typography roles (§29). Maps by the design node's own text (the PR 6B text mapping — no
 * locator needed) and compares the authored typography facts the design actually declares.
 *
 * Roles come from the design node's `type`, never from the rendered HTML tag name (§29).
 */
// Role comes from the design node's own `type` — its documented semantic classification — never
// from the rendered HTML tag name (§29). Only these node types ARE text-bearing; a `text` node
// carries no further role signal in the transcript (there is no heading/label/helper distinction),
// so it maps to the honest, always-true `body` role rather than a guessed one.
const ROLE_BY_TYPE = {
  button: "button", input: "label", checkbox: "label", text: "body",
};

function collectTypographyRoleFacts(transcript) {
  const facts = [];
  const budget = new Map();
  const take = (family) => {
    const n = budget.get(family) ?? 0;
    if (n >= MAX_FACTS_PER_FAMILY) return false;
    budget.set(family, n + 1);
    return true;
  };

  walkNodes(transcript.layout, (n) => {
    if (!n || typeof n !== "object" || n.hidden || n.type !== "text") return;
    const text = (n.text ?? "").trim();
    if (!text) return;
    const st = n.style ?? {};

    // --- font-family (§28): the ONLY evidence of which font the design uses. Compared as the
    //     leading family of the computed stack, so a generic fallback alone never passes. ---
    if (st.family && take("font-family")) {
      facts.push({
        id: "SUI-RENDER-FONT-001", family: "font-family", category: GEOMETRY_CATEGORY.FONT,
        box: "typography-style", required: true, trust: "literal-design",
        expected: String(st.family).split(",")[0].replace(/["']/g, "").trim().toLowerCase(),
        tolerance: null, unit: null, designNodeId: n.id,
        mapping: { kind: "text", text },
        remediation: `load and apply the design font "${st.family}"`,
      });
    }

    // --- letter-spacing (§29) — subpixel by nature, so it carries its own tighter tolerance ---
    const ls = px(st.letterSpacing);
    if (ls != null && take("letter-spacing")) {
      facts.push({
        id: "SUI-RENDER-TYPO-001", family: "letter-spacing", category: GEOMETRY_CATEGORY.TYPOGRAPHY,
        box: "typography-style", required: true, trust: "literal-design", expected: ls,
        tolerance: GEOMETRY_TOLERANCE.letter, unit: "px", designNodeId: n.id,
        mapping: { kind: "text", text },
        remediation: `set letter-spacing to ${ls}px`,
      });
    }

    // --- role typography (§29): size + weight per design role. `lineHeight` is owned by the PR 6B
    //     fact above, so it is deliberately NOT duplicated here (one diagnostic per authored fact). ---
    const role = ROLE_BY_TYPE[n.type] ?? "body";
    const size = px(st.size);
    if (size != null && take(`size:${role}`)) {
      facts.push({
        id: "SUI-RENDER-TYPO-002", family: `font-size-${role}`, category: GEOMETRY_CATEGORY.TYPOGRAPHY,
        box: "typography-style", required: true, trust: "literal-design", expected: size,
        tolerance: GEOMETRY_TOLERANCE.fontSize, unit: "px", designNodeId: n.id,
        mapping: { kind: "text", text },
        remediation: `set the ${role} font-size to ${size}px`,
      });
    }
    const weight = px(st.weight);
    if (weight != null && take(`weight:${role}`)) {
      facts.push({
        id: "SUI-RENDER-TYPO-003", family: `font-weight-${role}`, category: GEOMETRY_CATEGORY.TYPOGRAPHY,
        box: "typography-style", required: true, trust: "literal-design", expected: weight,
        tolerance: GEOMETRY_TOLERANCE.weight, unit: null, designNodeId: n.id,
        mapping: { kind: "text", text },
        remediation: `set the ${role} font-weight to ${weight}`,
      });
    }
  });
  return facts;
}

/** Lowercase a design color for exact comparison (the design emits lowercase hex). */
function normHex(v) {
  return String(v ?? "").trim().toLowerCase();
}

/** Bounded candidate-summary limit (never dump the whole match set into diagnostics). */
export const MAX_CANDIDATES = 5;

/**
 * Collect the browser box model for every mapped fact in ONE bounded evaluate pass.
 *
 * MAPPING CONTRACT (PR 6B corrective — MAP-001): every fact resolves to exactly one of
 *   `unique`    — exactly one VISIBLE candidate → measured
 *   `missing`   — zero visible candidates
 *   `ambiguous` — more than one visible candidate → NEVER first-picked
 * Non-rendered elements (display:none / visibility:hidden|collapse / `hidden` / a zero-box
 * ancestor-hidden node) are filtered out BEFORE counting, so a hidden duplicate cannot create
 * false ambiguity. A nested parent/child text duplicate is refined by ONE documented semantic
 * rule (see the `text` branch) — never by DOM order.
 * @returns {Promise<Array<{factId, status, actual, candidates, candidateSummaries}>>}
 */
export async function collectRenderedGeometry(page, facts) {
  // Address each fact by a UNIQUE key (stable id + design node), not by the diagnostic id alone: a
  // family like `font-size-body` legitimately contributes one fact per design text node, and they
  // must not all resolve to the first match. `id` stays the stable diagnostic ID (§32).
  const spec = facts.map((f) => ({ key: factKey(f), family: f.family, mapping: f.mapping }));
  // Playwright allows ONE serializable argument → wrap the spec + limit in an object.
  return page.evaluate(({ specs, MAX }) => {
    const out = [];
    const h = (el) => (el ? Math.round(el.getBoundingClientRect().height * 100) / 100 : null);
    // Computed colors come back as `rgb(r, g, b)`; the design emits `#rrggbb`. Normalizing the
    // ACTUAL to the design's canonical form is what makes the comparison exact — comparing the two
    // raw strings would fail on every correct element.
    // BOR-001: a fully transparent computed color is NOT an opaque color — it renders nothing, so
    // it must not compare equal to an opaque design value. Alpha 0 returns null (unmeasured).
    const toHex = (v) => {
      const s = String(v ?? "").trim().toLowerCase();
      if (s.startsWith("#")) return s;
      const m = s.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+))?\s*\)/);
      if (!m) return s;
      if (m[4] != null && Number(m[4]) === 0) return null;
      const hx = (n) => Math.round(Number(n)).toString(16).padStart(2, "0");
      return `#${hx(m[1])}${hx(m[2])}${hx(m[3])}`;
    };
    // Parses px values AND unitless numbers (font-weight renders "700" with no unit). Returns null
    // for a non-numeric computed value (e.g. lineHeight:"normal"), which is an honest non-measure.
    const num = (v) => {
      if (v == null) return null;
      const s = String(v).trim();
      if (!/^-?\d*\.?\d+(px)?$/.test(s)) return null;
      return Math.round(parseFloat(s) * 100) / 100;
    };

    // A rendered, visible element: not hidden by itself or an ancestor.
    const isVisible = (el) => {
      if (!el || el.hasAttribute?.("hidden")) return false;
      for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
        const cs = getComputedStyle(n);
        if (cs.display === "none" || cs.visibility === "hidden" || cs.visibility === "collapse") return false;
      }
      return true;
    };
    // Bounded, non-sensitive candidate summary for ambiguity diagnostics (never text bodies).
    const summarize = (el) => ({ tag: el.tagName.toLowerCase(), role: el.getAttribute?.("role") ?? (el.tagName === "BUTTON" ? "button" : null) });
    const result = (id, status, actual, els) => ({
      key: id, status,
      actual: status === "unique" ? actual : null,
      candidates: els ? els.length : 0,
      candidateSummaries: els ? els.slice(0, MAX).map(summarize) : [],
    });
    // Resolve a candidate set → unique (measure) / missing / ambiguous.
    const resolve = (id, els, measure) => {
      const visible = els.filter(isVisible);
      if (visible.length === 0) return result(id, "missing", null, []);
      if (visible.length > 1) return result(id, "ambiguous", null, visible);
      return result(id, "unique", measure(visible[0]), visible);
    };

    for (const s of specs) {
      try {
        if (s.mapping.kind === "root-padding") {
          const el = document.querySelector(".content") || document.body.firstElementChild;
          out.push(resolve(s.key, el ? [el] : [], (e) => {
            const cs = getComputedStyle(e);
            return [cs.paddingTop, cs.paddingRight, cs.paddingBottom, cs.paddingLeft].map(num);
          }));
        } else if (s.mapping.kind === "control" && s.mapping.role === "input") {
          const els = Array.from(document.querySelectorAll("input:not([type=hidden]), select, textarea"));
          out.push(resolve(s.key, els, (e) => h(e)));
        } else if (s.mapping.kind === "control" && s.mapping.role === "table") {
          const els = Array.from(document.querySelectorAll("table, uii-table, ngx-datatable, mat-table"));
          out.push(resolve(s.key, els, (e) => h(e)));
        } else if (s.mapping.kind === "button-text") {
          const els = Array.from(document.querySelectorAll("button, a, .btn")).filter((el) => (el.textContent || "").trim().includes(s.mapping.text));
          out.push(resolve(s.key, els, (e) => h(e)));
        } else if (s.mapping.kind === "text") {
          // Nested-duplicate refinement (documented): prefer elements whose OWN visible text (no
          // element children) exactly equals the target — that excludes aggregate parents — then,
          // if several own-text leaves match, prefer those carrying an authored class (a styled
          // semantic target) over bare wrappers; if that still leaves >1, report ambiguity rather
          // than pick. This rule is semantic, deterministic, and DOM-order-independent.
          const ownText = (el) => Array.from(el.childNodes).filter((n) => n.nodeType === 3).map((n) => n.textContent).join("").trim();
          const all = Array.from(document.querySelectorAll("*")).filter((el) => (el.textContent || "").trim() === s.mapping.text);
          const leaves = all.filter((el) => el.children.length === 0 || ownText(el) === s.mapping.text);
          const refined = leaves.length > 1 ? leaves.filter((el) => el.classList && el.classList.length > 0) : leaves;
          const picked = refined.length >= 1 ? refined : leaves;
          // The text mapping serves several PR 6C typography families, so it dispatches on the
          // FACT's family (the element is the same; the measured property differs).
          const fam = s.family;
          out.push(resolve(s.key, picked, (e) => {
            const cs = getComputedStyle(e);
            if (fam === "font-family") return String(cs.fontFamily || "").split(",")[0].replace(/["']/g, "").trim().toLowerCase();
            if (fam === "letter-spacing") return num(cs.letterSpacing);
            if (String(fam).startsWith("font-size-")) return num(cs.fontSize);
            if (String(fam).startsWith("font-weight-")) return num(cs.fontWeight);
            return num(cs.lineHeight);
          }));
        } else if (s.mapping.kind === "divider") {
          const els = Array.from(document.querySelectorAll("hr"));
          out.push(resolve(s.key, els, (e) => num(getComputedStyle(e).borderTopWidth)));
        } else if (s.mapping.kind === "overflow") {
          const el = document.querySelector(".content") || document.body.firstElementChild;
          out.push(resolve(s.key, el ? [el] : [], (e) => {
            const d = s.mapping.axis === "y" ? e.scrollHeight - e.clientHeight : e.scrollWidth - e.clientWidth;
            return Math.round(d * 100) / 100;
          }));
        } else if (s.mapping.kind === "mapped") {
          // PR 6C: a locator-map-bound design node. The map supplies ONLY the selector; the expected
          // value still comes from the transcript. Missing/ambiguous still resolve non-green when
          // the fact is required — the map does not bypass the PR 6B ambiguity contract (§10 r10).
          const els = Array.from(document.querySelectorAll(s.mapping.selector));
          const m = s.mapping.measure;
          out.push(resolve(s.key, els, (e) => {
            const cs = getComputedStyle(e);
            if (m === "gap") return (s.mapping.axis === "column" ? num(cs.rowGap) : num(cs.columnGap)) ?? num(cs.gap);
            if (m === "borderWidth") return ["Top", "Right", "Bottom", "Left"].map((side) => num(cs[`border${side}Width`]));
            if (m === "borderColor") {
              // BOR-001 (§15): a computed color is only meaningful where the border has POSITIVE
              // width. A browser returns `rgb(0, 0, 0)` (or the authored color) even on a
              // zero-width side, so comparing color without gating on presence would let an absent
              // border pass on color. A side with no rendered width measures as null → non-green.
              return ["Top", "Right", "Bottom", "Left"].map((side) => {
                const w = num(cs[`border${side}Width`]);
                if (!(w > 0)) return null;
                return toHex(cs[`border${side}Color`]);
              });
            }
            if (m === "radius") {
              const ci = (k) => cs[k] === "50%" ? null : num(cs[k]);
              return [ci("borderTopLeftRadius"), ci("borderTopRightRadius"), ci("borderBottomRightRadius"), ci("borderBottomLeftRadius")];
            }
            if (m === "fontFamily") return String(cs.fontFamily || "").split(",")[0].replace(/["']/g, "").trim().toLowerCase();
            if (m === "letterSpacing") return num(cs.letterSpacing);
            if (m === "fontSize") return num(cs.fontSize);
            if (m === "fontWeight") return num(cs.fontWeight);
            if (m === "contentOverflow") {
              // Objective clipping: does the element's CONTENT overflow its own box? Measured in
              // both axes; the larger axis is the one that must not exceed tolerance. An element
              // whose content fits reports 0.
              const dx = Math.max(0, e.scrollWidth - e.clientWidth);
              const dy = Math.max(0, e.scrollHeight - e.clientHeight);
              return Math.round(Math.max(dx, dy) * 100) / 100;
            }
            if (m === "offViewport") {
              // Objective off-viewport: how far the element's box extends outside the viewport.
              // 0 when fully inside; >0 is the worst out-of-bounds distance on any edge.
              const r = e.getBoundingClientRect();
              const vw = window.innerWidth, vh = window.innerHeight;
              const outLeft = Math.max(0, -r.left);
              const outRight = Math.max(0, r.right - vw);
              const outTop = Math.max(0, -r.top);
              const outBottom = Math.max(0, r.bottom - vh);
              return Math.round(Math.max(outLeft, outRight, outTop, outBottom) * 100) / 100;
            }
            return h(e); // default: box height
          }));
        } else {
          out.push(result(s.key, "missing", null, []));
        }
      } catch { out.push(result(s.key, "missing", null, [])); }
    }
    return out;
  }, { specs: spec, MAX: MAX_CANDIDATES });
}

/**
 * Compare collected rendered geometry against expected facts → checks + diagnostics.
 * A REQUIRED fact that cannot be mapped, or whose measured value is outside tolerance, is a
 * non-green `fail`. An OPTIONAL fact that cannot be mapped skips honestly. A `pass` always means a
 * real measured value matched within tolerance (no presence-based fake passes).
 */
export function compareGeometry(facts, rendered) {
  const checks = [];
  for (const fact of facts) {
    // Match on the fact key; accept the older `factId` shape so a caller/test passing a bare id
    // (the PR 6B contract) still resolves.
    const r = rendered.find((x) => (x.key ?? x.factId) === factKey(fact))
      ?? rendered.find((x) => (x.key ?? x.factId) === fact.id);
    // Mapping status is explicit (unique | missing | ambiguous) — never inferred from a first-pick.
    const mapStatus = r?.status ?? "missing";
    const found = mapStatus === "unique";
    let status = "fail", actual = null, delta = null;

    // Required facts block (fail); optional facts that mismatch surface as a warning, never a
    // blocking fail — a design frame that is not a literal CSS box must not false-fail (§9).
    const outside = fact.required ? "fail" : "warn";

    if (mapStatus === "missing") {
      // A required fact with no visible candidate is non-green; optional skips honestly.
      status = fact.required ? "fail" : "skip";
    } else if (mapStatus === "ambiguous") {
      // A required fact mapping to >1 visible candidate is NEVER first-picked → non-green.
      status = fact.required ? "fail" : "warn";
    } else if (Array.isArray(fact.expected)) {
      actual = r.actual;
      // A radius array may legitimately contain `null` for a `50%` elliptical corner, which cannot
      // be expressed in px — that corner is inconclusive, not a pass. Exact-match families
      // (tolerance null) compare by equality; numeric families compare within tolerance.
      const match = (v, i) => {
        if (v == null) return false;
        // BOR-001 (§13): a required border with a POSITIVE expected width that renders at zero is
        // ABSENT, not "approximately correct" — the ±1px numeric tolerance must not swallow a
        // missing border (design 1px vs actual 0px would otherwise compare as within tolerance).
        // Presence is decided BEFORE the numeric comparison, so a 0px side always fails.
        if (fact.family === "border-width" && fact.expected[i] > 0 && !(v > 0)) return false;
        if (fact.tolerance == null) return String(v) === String(fact.expected[i]);
        return Math.abs(v - fact.expected[i]) <= fact.tolerance;
      };
      const ok = Array.isArray(actual) && actual.length === fact.expected.length && actual.every((v, i) => match(v, i));
      status = ok ? "pass" : outside;
    } else if (fact.tolerance == null) {
      // Exact-match family (border color, font family): a deterministic string comparison, never a
      // pixel tolerance. A missing value is non-green for a required fact.
      actual = r.actual;
      if (actual == null) status = fact.required ? "fail" : "skip";
      else status = String(actual) === String(fact.expected) ? "pass" : outside;
    } else {
      actual = r.actual;
      delta = actual == null ? null : Math.round((actual - fact.expected) * 100) / 100;
      status = delta == null ? (fact.required ? "fail" : "skip") : (Math.abs(delta) <= fact.tolerance ? "pass" : outside);
    }

    // Mapping failures are labelled as MAPPING problems (missing/ambiguous), never as a geometry
    // mismatch — the value was never measured.
    const mappingNote = mapStatus === "ambiguous"
      ? `maps to ${r.candidates} visible candidate(s) — no element selected automatically; add a more specific locator`
      : mapStatus === "missing"
        ? "no visible element matched the design fact"
        : null;
    // BOR-001 (§17): name the sides that are ABSENT so the diagnostic distinguishes a missing
    // border from a wrong-width border. Bounded to the four side names.
    const SIDES = ["top", "right", "bottom", "left"];
    const absentBorderSides = (status === "fail" && fact.family === "border-width" && Array.isArray(actual))
      ? SIDES.filter((_, i) => fact.expected[i] > 0 && !(actual[i] > 0))
      : [];
    const presenceNote = absentBorderSides.length
      ? ` — the design requires a visible border on the ${absentBorderSides.join("/")} side(s), but the rendered width is 0px (absent, not merely out of tolerance)`
      : "";
    const detail = mapStatus === "ambiguous"
      ? `${fact.family}: ${mappingNote}`
      : mapStatus === "missing"
        ? `${fact.family}: ${mappingNote}${fact.required ? "" : " (optional — skipped)"}`
        : status === "pass"
          ? `${fact.family} matches (${fmt(actual ?? fact.expected)})`
          // An exact-match family (tolerance null) reports equality, not a pixel bound — printing
          // "±null" would misstate the contract.
          : `${fact.family}: actual ${fmt(actual)}, design ${fmt(fact.expected)} (${fact.tolerance == null ? "exact match" : `tolerance ±${fact.tolerance}${fact.unit ?? ""}`}${status === "warn" ? " — optional design-frame fact, verify manually" : ""})${presenceNote}`;

    checks.push({
      name: "renderGeometry", id: fact.id, category: fact.category, family: fact.family,
      status, trust: fact.trust, required: fact.required, mapping: mapStatus,
      candidateCount: r?.candidates ?? 0, candidates: r?.candidateSummaries ?? [],
      detail, designNodeId: fact.designNodeId, expected: fact.expected, actual,
      delta: delta ?? null, tolerance: fact.tolerance, unit: fact.unit,
      remediation: status === "fail" || status === "warn" ? fact.remediation : null,
    });
  }
  return checks;
}

function fmt(v) {
  if (Array.isArray(v)) return v.map((x) => (x == null ? "?" : x)).join("/");
  return v == null ? "?" : v;
}
