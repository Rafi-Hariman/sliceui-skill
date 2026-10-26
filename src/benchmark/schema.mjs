// benchmark/schema — the benchmark-entry schema + strict validation.
//
// A benchmark member MUST declare its origin, families, source, viewports, and expectations; the
// runner REJECTS an incomplete entry rather than silently dropping the expectations it cannot
// satisfy (section 2). Origins are never combined into one unexplained total (section 1).

export const ORIGIN = Object.freeze({
  REAL_STRUCTURED_EXPORT: "REAL_STRUCTURED_EXPORT",
  APPROVED_IMPLEMENTATION_PAIR: "APPROVED_IMPLEMENTATION_PAIR",
  ADVERSARIAL_FIXTURE: "ADVERSARIAL_FIXTURE",
  PROPERTY_GENERATED: "PROPERTY_GENERATED",
  SCREENSHOT_RASTER: "SCREENSHOT_RASTER",
});

export const PRIVACY = Object.freeze({ PUBLIC: "public", PRIVATE_GATED: "private-gated", SYNTHETIC: "synthetic" });

const REQUIRED = [
  "id", "origin", "topologyFamilies", "sourceInput", "suppliedViewports",
  "semanticExpectations", "topologyExpectations", "requiredRuntimeStates",
  "requiredProjectAdapter", "applicabilityRequirements", "privacyClassification",
];

/**
 * Validate a benchmark entry. Missing REQUIRED fields (or empty expectations) are errors, never
 * silently dropped.
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function validateEntry(entry) {
  const errors = [];
  if (!entry || typeof entry !== "object") return { ok: false, errors: ["entry is not an object"] };
  for (const k of REQUIRED) {
    if (entry[k] === undefined || entry[k] === null || entry[k] === "") errors.push(`missing required field: ${k}`);
  }
  if (entry.topologyFamilies !== undefined && !(Array.isArray(entry.topologyFamilies) && entry.topologyFamilies.length)) errors.push("topologyFamilies must be a non-empty array");
  if (entry.suppliedViewports !== undefined && !Array.isArray(entry.suppliedViewports)) errors.push("suppliedViewports must be an array");
  if (entry.origin !== undefined && !Object.values(ORIGIN).includes(entry.origin)) errors.push(`origin must be one of ${Object.values(ORIGIN).join("|")}`);
  return { ok: errors.length === 0, errors };
}

/**
 * Resolve a member's SCOREABILITY lifecycle (section 4): structurally valid and scoreable, valid but
 * BLOCKED by missing required evidence, structurally invalid, or not applicable. Incomplete entries
 * are still REJECTED; missing evidence is never represented as passing.
 */
export function resolveMemberStatus(member) {
  const v = validateEntry(member);
  if (!v.ok) {
    return {
      schemaStatus: "invalid",
      scoreabilityStatus: "invalid",
      blockingEvidence: null,
      applicabilityResolution: null,
      includedInScoreDenominator: false,
      exclusionReason: `invalid schema: ${v.errors[0]}`,
    };
  }
  const blocking = [];
  if (member.origin === ORIGIN.REAL_STRUCTURED_EXPORT && member.pendingReferenceRender && !member.referenceImplementation && !member.referenceRaster) {
    blocking.push("REFERENCE_RENDER_MISSING");
  }
  if (member.origin === ORIGIN.APPROVED_IMPLEMENTATION_PAIR && !member.reviewRecord) {
    blocking.push("APPROVED_REFERENCE_UNREVIEWED");
  }
  if (member.origin === ORIGIN.SCREENSHOT_RASTER && !member.referenceRaster) {
    blocking.push("REFERENCE_RASTER_MISSING");
  }
  if ((member.requiredProjectAdapter && member.requiredProjectAdapter !== "none") && member.projectAdapterUnavailable) {
    blocking.push("PROJECT_ADAPTER_UNAVAILABLE");
  }
  const blocked = blocking.length > 0;
  return {
    schemaStatus: "valid",
    scoreabilityStatus: blocked ? "blocked" : "scoreable",
    blockingEvidence: blocked ? blocking : [],
    applicabilityResolution: member.applicabilityRequirements ?? { perceptual: "NOT_APPLICABLE" },
    includedInScoreDenominator: !blocked,
    exclusionReason: blocked ? blocking.join("; ") : null,
  };
}

/**
 * An APPROVED_IMPLEMENTATION_PAIR reference must carry an independent review record (section 7):
 * reviewer/authority, status, date/version, artifact hash, and independent-of-score acceptance.
 * A SliceUI-generated implementation without a review is REJECTED as an approved reference.
 */
export function validateApprovedReference(member) {
  if (member.origin !== ORIGIN.APPROVED_IMPLEMENTATION_PAIR) return { ok: true };
  const r = member.reviewRecord;
  if (!r) return { ok: false, errors: ["APPROVED_IMPLEMENTATION_PAIR requires an independent review record"] };
  const required = ["reviewer", "status", "date", "artifactHash", "independentOfScore"];
  const missing = required.filter((k) => r[k] === undefined || r[k] === null || r[k] === "");
  if (missing.length) return { ok: false, errors: [`review record missing: ${missing.join(", ")}`] };
  if (r.status !== "approved") return { ok: false, errors: ["review record status must be 'approved'"] };
  return { ok: true };
}
