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
// SCOPE (honest): this module implements the families that have BOTH a deterministic DOM mapping
// available from transcript facts alone AND a real measured comparison:
//   control-height (input, button) · line-height · table-box · overflow
// Families without a transcript-derivable DOM target (radius, flex gap, relative alignment,
// pagination geometry, table cell padding) are documented as PR 6C scope — measuring them would
// require either a fixture-provided selector map or production-source test IDs, which PR 6B does
// not add. A `pass` here always means a real measured value matched within tolerance.

import { walkNodes } from "../../lib/walk-nodes.mjs";

/** Centralized tolerances (px) — no scattered magic numbers (§13). */
export const GEOMETRY_TOLERANCE = Object.freeze({
  box: 2,        // control / table box height (border-box)
  line: 1,       // line-height — typography is tighter
  overflow: 1,   // accidental horizontal overflow allowance
});

/** Bounded category vocabulary (extends the PR 6A set). */
export const GEOMETRY_CATEGORY = Object.freeze({
  SPACING: "spacing",
  CONTROL_HEIGHT: "control-height",
  BUTTON: "button-geometry",
  TYPOGRAPHY: "typography",
  TABLE: "table-density",
  BORDER: "border",
  OVERFLOW: "overflow",
});

const px = (v) => (Number.isFinite(Number(v)) ? Number(v) : null);

/**
 * Derive comparable geometry facts from a transcript (design facts only).
 * @returns {Array} facts: { id, family, category, box, required, trust, expected, tolerance, unit, mapping, designNodeId, remediation }
 */
export function collectGeometryFacts(transcript) {
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

  return facts;
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
  const spec = facts.map((f) => ({ id: f.id, family: f.family, mapping: f.mapping }));
  // Playwright allows ONE serializable argument → wrap the spec + limit in an object.
  return page.evaluate(({ specs, MAX }) => {
    const out = [];
    const h = (el) => (el ? Math.round(el.getBoundingClientRect().height * 100) / 100 : null);
    const num = (v) => (v && String(v).endsWith("px") ? Math.round(parseFloat(v) * 100) / 100 : null);

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
      factId: id, status,
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
          out.push(resolve(s.id, el ? [el] : [], (e) => {
            const cs = getComputedStyle(e);
            return [cs.paddingTop, cs.paddingRight, cs.paddingBottom, cs.paddingLeft].map(num);
          }));
        } else if (s.mapping.kind === "control" && s.mapping.role === "input") {
          const els = Array.from(document.querySelectorAll("input:not([type=hidden]), select, textarea"));
          out.push(resolve(s.id, els, (e) => h(e)));
        } else if (s.mapping.kind === "control" && s.mapping.role === "table") {
          const els = Array.from(document.querySelectorAll("table, uii-table, ngx-datatable, mat-table"));
          out.push(resolve(s.id, els, (e) => h(e)));
        } else if (s.mapping.kind === "button-text") {
          const els = Array.from(document.querySelectorAll("button, a, .btn")).filter((el) => (el.textContent || "").trim().includes(s.mapping.text));
          out.push(resolve(s.id, els, (e) => h(e)));
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
          out.push(resolve(s.id, picked, (e) => num(getComputedStyle(e).lineHeight)));
        } else if (s.mapping.kind === "divider") {
          const els = Array.from(document.querySelectorAll("hr"));
          out.push(resolve(s.id, els, (e) => num(getComputedStyle(e).borderTopWidth)));
        } else if (s.mapping.kind === "overflow") {
          const el = document.querySelector(".content") || document.body.firstElementChild;
          out.push(resolve(s.id, el ? [el] : [], (e) => Math.round((e.scrollWidth - e.clientWidth) * 100) / 100));
        } else {
          out.push(result(s.id, "missing", null, []));
        }
      } catch { out.push(result(s.id, "missing", null, [])); }
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
    const r = rendered.find((x) => x.factId === fact.id);
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
      const ok = Array.isArray(actual) && actual.length === fact.expected.length && actual.every((v, i) => v != null && Math.abs(v - fact.expected[i]) <= fact.tolerance);
      status = ok ? "pass" : outside;
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
    const detail = mapStatus === "ambiguous"
      ? `${fact.family}: ${mappingNote}`
      : mapStatus === "missing"
        ? `${fact.family}: ${mappingNote}${fact.required ? "" : " (optional — skipped)"}`
        : status === "pass"
          ? `${fact.family} matches (${fmt(actual ?? fact.expected)})`
          : `${fact.family}: actual ${fmt(actual)}, design ${fmt(fact.expected)} (tolerance ±${fact.tolerance}${fact.unit}${status === "warn" ? " — optional design-frame fact, verify manually" : ""})`;

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
