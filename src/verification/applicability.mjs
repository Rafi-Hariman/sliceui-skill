// verification/applicability — WHICH verification layers apply to a design, decided from its source.
//
//   REQUIRED        the layer is in the blocking denominator (must be proven to pass)
//   OPTIONAL        measured when evidence exists; a miss warns, never blocks
//   NOT_APPLICABLE  the design source CANNOT have this oracle — the layer is REMOVED from the
//                   denominator (distinct from SKIP/UNVERIFIABLE, which stay in it as unproven)
//   UNAVAILABLE     the layer applies but its enabler is missing (e.g. gated private mount)
//
// The authoritative layers for a FIGML-only design are: semantic content, topology relationships,
// DOM geometry, computed style, runtime state (plus responsive safety). Perceptual comparison needs
// a RASTER oracle: a FIGML export carries geometry/colors, not pixels — DOM geometry is geometry
// verification, NOT perceptual verification, and is never reported as such.

export const APPLICABILITY = Object.freeze({
  REQUIRED: "required",
  OPTIONAL: "optional",
  NOT_APPLICABLE: "not-applicable",
  UNAVAILABLE: "unavailable",
});

export const VERIFICATION_LAYERS = Object.freeze([
  "semantic-content", "topology-relationships", "dom-geometry", "computed-style",
  "runtime-state", "responsive-safety", "perceptual",
]);

/** Perceptual applicability from the design source. */
export function perceptualApplicability({ sourceKind = "figml", hasReferenceImage = false } = {}) {
  const kind = String(sourceKind ?? "").toLowerCase();
  if (kind === "figml" || kind === "figma-json") {
    return hasReferenceImage ? APPLICABILITY.REQUIRED : APPLICABILITY.NOT_APPLICABLE; // raster backstop only when supplied
  }
  if (["screenshot", "image", "raster", "png", "jpg"].includes(kind)) return APPLICABILITY.REQUIRED;
  return APPLICABILITY.UNAVAILABLE; // unknown source — never silently required
}

/** Applicability of every layer for a design source. */
export function layerApplicability({ sourceKind = "figml", hasReferenceImage = false, privateMountAvailable = null } = {}) {
  const out = {};
  for (const layer of VERIFICATION_LAYERS) {
    if (layer === "perceptual") {
      out[layer] = perceptualApplicability({ sourceKind, hasReferenceImage });
    } else {
      out[layer] = APPLICABILITY.REQUIRED;
    }
  }
  // A gated private mount makes project-real computed-style/geometry UNAVAILABLE (not N/A): the
  // oracle exists in principle; the enabler is missing. Synthetic evidence still measures.
  if (privateMountAvailable === false) {
    out["project-real"] = APPLICABILITY.UNAVAILABLE;
  }
  return out;
}

/**
 * The blocking denominator: layers that MUST be proven. NOT_APPLICABLE layers are REMOVED;
 * UNAVAILABLE and OPTIONAL stay in the denominator (an unproven applicable layer is never a pass).
 * SKIP/UNVERIFIABLE verdicts on a layer do NOT remove it — only applicability can.
 */
export function blockingDenominator(applicabilityMap = {}) {
  return Object.entries(applicabilityMap)
    .filter(([, a]) => a === APPLICABILITY.REQUIRED || a === APPLICABILITY.OPTIONAL || a === APPLICABILITY.UNAVAILABLE)
    .map(([layer]) => layer);
}

/** A verdict is honest only when every denominator layer is proven or explicitly unproven-not-passed. */
export function denominatorSatisfied(denominator = [], verdicts = {}) {
  return denominator.every((layer) => verdicts[layer] === "pass" || verdicts[layer] === "fail" || verdicts[layer] === "unverifiable");
}

/** Adapter maturity is recorded PER TARGET: a representative fixture proves mechanics only and can
 *  never upgrade production maturity while the actual private mount remains GATED. */
export function adapterMaturity({ representativeProven = false, productionMounted = false } = {}) {
  return {
    representativeAngularFixture: representativeProven ? "mechanics-proven" : "unproven",
    actualBillPilarTarget: productionMounted ? "mounted" : "GATED/UNAVAILABLE",
  };
}

/** Release readiness is CAPPED while a REQUIRED private adapter is unavailable: no project-real
 *  PASS, no L5/L6 family maturity, no release-ready status — regardless of measured scores. */
export function releaseReadiness({ privateMountAvailable = false, projectRealPass = false, familyMean = 0 } = {}) {
  if (!privateMountAvailable) {
    return { projectRealPass: false, familyMaturity: "GATED", releaseReady: false, reason: "required private adapter UNAVAILABLE — project-real verification gated" };
  }
  const matured = projectRealPass && familyMean >= 92;
  return {
    projectRealPass,
    familyMaturity: matured ? "L6" : projectRealPass ? "L5" : "L0-L4",
    releaseReady: matured,
  };
}
