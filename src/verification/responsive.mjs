// verification/responsive — responsive-safety verification across multiple viewport widths.
//
// The evidence is measured in the browser at each width: document-level overflow, control overlap,
// critical-content clipping, FILL tracking, and intended scroller dimensions. Intended scrollers
// (an `overflow-x:auto` table/carousel container) are REPORTED, never failed — only DOCUMENT-level
// overflow is a defect. Fidelity semantics are preserved: a width with a supplied design is
// DESIGN_VERIFIED; an unsupplied width is RESPONSIVE_INFERRED, and an inferred PASS never increases
// design-fidelity coverage (responsive safety is reported separately from visual fidelity).

export const RESPONSIVE_SEMANTICS = Object.freeze({ DESIGN_VERIFIED: "DESIGN_VERIFIED", RESPONSIVE_INFERRED: "RESPONSIVE_INFERRED" });

/**
 * @param {object} check — the compiled responsive-safety check ({ tolerance, designViewports })
 * @param {object} domState — `{ widths: [{ width, pageOverflow, overlaps, clipped, fill, scrollers, documentWidths }] }`
 *   (multi-width browser evidence) or the legacy `{ overflow, overlap }` single-width summary.
 */
export function verifyResponsiveSafety(check, domState = {}) {
  const tol = check.tolerance ?? 1;
  const widths = normalizeWidths(domState);
  const designViewports = check.designViewports ?? [];
  const findings = [];

  for (const w of widths) {
    if ((w.pageOverflow ?? 0) > tol) {
      findings.push({ width: w.width, kind: "page-overflow", detail: `the document scrolls ${w.pageOverflow}px beyond the viewport (scrollWidth ${w.documentWidths?.scrollWidth} vs clientWidth ${w.documentWidths?.clientWidth})`, evidence: w });
    }
    for (const o of w.overlaps ?? []) {
      if ((o.area ?? 0) > tol * tol) {
        findings.push({ width: w.width, kind: "overlap", detail: `controls ${o.a} and ${o.b} overlap by ${o.area}px²`, evidence: o });
      }
    }
    for (const c of w.clipped ?? []) {
      if ((c.outsideBy ?? 0) > tol) {
        findings.push({ width: w.width, kind: "clipping", detail: `critical element ${c.nodeId} is ${c.outsideBy}px outside the usable region`, evidence: c });
      }
    }
    for (const f of w.fill ?? []) {
      if (f.ratio != null && Math.abs(f.ratio - 1) > 0.05) {
        findings.push({ width: w.width, kind: "fill", detail: `FILL node ${f.nodeId} rendered ${f.width}px inside a ${f.parentWidth}px parent (ratio ${f.ratio}) — it does not track its parent`, evidence: f });
      }
    }
  }

  const semanticsPerWidth = widths.map((w) => ({
    width: w.width,
    semantics: designViewports.includes(w.width) ? RESPONSIVE_SEMANTICS.DESIGN_VERIFIED : RESPONSIVE_SEMANTICS.RESPONSIVE_INFERRED,
  }));

  return {
    status: findings.length ? "fail" : widths.length ? "pass" : "unverifiable",
    semanticsPerWidth,
    expected: { pageOverflow: 0, overlapArea: 0, clipping: 0, fillTracksParent: true },
    actual: { findings, intendedScrollers: widths.flatMap((w) => (w.scrollers ?? []).map((s) => ({ width: w.width, ...s }))) },
    countsTowardDesignFidelity: false,
    detail: findings.length
      ? findings.map((f) => `[${f.width ?? "?"}px ${f.kind}] ${f.detail}`).join("; ")
      : (widths.length ? `no overflow/overlap/clipping at ${widths.map((w) => w.width).join(", ")}px (intended scrollers absorb their own width)` : "no responsive evidence supplied"),
  };
}

/** Legacy single-width `{overflow, overlap}` evidence becomes one width entry. */
function normalizeWidths(domState) {
  if (Array.isArray(domState.widths) && domState.widths.length) return domState.widths;
  if (domState.overflow != null || domState.overlap != null) {
    return [{
      width: null,
      pageOverflow: Number(domState.overflow ?? 0),
      overlaps: Number(domState.overlap ?? 0) > 0 ? [{ a: "(legacy)", b: "(legacy)", area: Number(domState.overlap) }] : [],
      clipped: [], fill: [], scrollers: [],
    }];
  }
  return [];
}

/**
 * What a responsive verdict contributes to DESIGN fidelity: only DESIGN_VERIFIED widths count, and
 * responsive safety never counts as visual fidelity — an inferred PASS must not upgrade coverage as
 * if a mobile design had been supplied.
 */
export function responsiveFidelityImpact(verdict) {
  const verified = (verdict?.semanticsPerWidth ?? []).filter((w) => w.semantics === RESPONSIVE_SEMANTICS.DESIGN_VERIFIED).length;
  const inferred = (verdict?.semanticsPerWidth ?? []).length - verified;
  return { designVerifiedWidths: verified, inferredWidths: inferred, designFidelityContribution: verdict?.countsTowardDesignFidelity ? verified : 0 };
}
