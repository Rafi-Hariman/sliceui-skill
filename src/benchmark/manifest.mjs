// benchmark/manifest — the machine-readable EXTERNAL evidence manifest (section 16).
//
// A requirements record of what must be supplied OUTSIDE this repository before any release claim.
// This is NOT synthetic benchmark data — it records what is missing.

export function externalEvidenceManifest() {
  return [
    {
      evidenceType: "REAL_STRUCTURED_EXPORT",
      minimumNeeded: 30,
      topologyTargets: ["SCROLL", "STICKY", "STATE_VARIANT", "RESPONSIVE_VARIANT", "DATA_VISUALIZATION", "FREEFORM", "COMPOSITE"],
      projectTargets: ["bill/pilar"],
      requiredMetadata: ["FIGML/XML source", "reference render (or browser mount)"],
      privacyRequirements: "public or org-private, no confidential content in public report",
      acceptanceChecks: ["scored >= family floor (92)", "no critical intent loss"],
      currentStatus: "INSUFFICIENT (1 of 30, unscored)",
    },
    {
      evidenceType: "APPROVED_IMPLEMENTATION_PAIR",
      minimumNeeded: 5,
      topologyTargets: ["LINEAR", "REPEATED", "GRID", "OVERLAY"],
      projectTargets: ["bill/pilar"],
      requiredMetadata: ["independent review record (reviewer/status/date/hash/independent-of-score)"],
      privacyRequirements: "org-private",
      acceptanceChecks: ["reference renders to a matched design"],
      currentStatus: "NONE",
    },
    {
      evidenceType: "REFERENCE_RASTER",
      minimumNeeded: 5,
      topologyTargets: ["LINEAR", "GRID", "COMPOSITE"],
      projectTargets: ["bill/pilar"],
      requiredMetadata: ["raster image", "region masks"],
      privacyRequirements: "org-private",
      acceptanceChecks: ["perceptual comparison (SSIM/edge/color delta)"],
      currentStatus: "NONE",
    },
    {
      evidenceType: "SCREENSHOT_RASTER",
      minimumNeeded: 5,
      topologyTargets: ["COMPOSITE", "FREEFORM"],
      projectTargets: ["any"],
      requiredMetadata: ["screenshot + design screenshot"],
      privacyRequirements: "public-safe or org-private",
      acceptanceChecks: ["perceptual comparison REQUIRED"],
      currentStatus: "NONE",
    },
    {
      evidenceType: "PROJECT_REAL_MOUNT",
      minimumNeeded: 1,
      topologyTargets: ["LINEAR", "REPEATED", "GRID", "OVERLAY"],
      projectTargets: ["bill/pilar"],
      requiredMetadata: ["owning NgModule", "global styles", "component libraries", "private adapter mount"],
      privacyRequirements: "org-private, gated (PILAR_CHECKOUT)",
      acceptanceChecks: ["project-real render verified (L5)"],
      currentStatus: "GATED/UNAVAILABLE",
    },
  ];
}
