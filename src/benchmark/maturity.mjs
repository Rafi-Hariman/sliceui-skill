// benchmark/maturity — topology-family maturity L0–L6 with the production gate (section 7).
//
// L0 Unsupported → L1 intent compiled → L2 generation path → L3 static verified → L4 browser-backed
// verified → L5 project-real adapter passes → L6 benchmark floor (mean ≥ 92, no critical loss, min
// real-design score in floor, silent A1 override zero, at least one real design).
//
// Synthetic-only evidence can NEVER reach L6, and an UNAVAILABLE required project adapter (Bill/Pilar)
// caps a family at L4 — the private mount must exist AND pass before L5/L6 is claimable.

export const FAMILY_FLOOR = 92;

/**
 * @param {{ intent?: boolean, generation?: boolean, staticVerification?: boolean, browserVerification?: boolean,
 *           projectRealAdapter?: boolean, familyMean?: number, criticalIntentLoss?: boolean,
 *           minRealDesignScore?: number, silentA1Override?: number, realDesignCount?: number }} caps
 * @returns {"L0"|"L1"|"L2"|"L3"|"L4"|"L5"|"L6"}
 */
export function familyMaturity(caps = {}) {
  const {
    intent = false, generation = false, staticVerification = false, browserVerification = false,
    projectRealAdapter = false, familyMean = 0, criticalIntentLoss = false,
    minRealDesignScore = 0, silentA1Override = 0, realDesignCount = 0,
  } = caps;

  if (!intent) return "L0";
  if (!generation) return "L1";
  if (!staticVerification) return "L2";
  if (!browserVerification) return "L3";
  if (!projectRealAdapter) return "L4";
  // L5 = project-real render verified. L6 additionally needs the benchmark floor + real designs.
  const clean = familyMean >= FAMILY_FLOOR
    && !criticalIntentLoss
    && silentA1Override === 0
    && minRealDesignScore >= FAMILY_FLOOR
    && realDesignCount >= 1;
  return clean ? "L6" : "L5";
}

/** The level-number of a maturity label (for ordering/comparison). */
export function maturityRank(level) {
  return Number(String(level).replace("L", "")) || 0;
}

/** Scoped maturity (section 13): ONE value is wrong when evidence applies to different adapter
 *  scopes. Compiler maturity (no project-real), the representative Angular fixture (mechanics
 *  only), the target project (Bill/Pilar), and benchmark qualification are reported separately. */
export function scopedMaturity(caps = {}) {
  const compiler = familyMaturity({ ...caps, projectRealAdapter: false });
  const target = caps.projectRealAdapter ? familyMaturity(caps) : "GATED_BELOW_L5";
  return {
    compilerMaturity: compiler,
    representativeAngularScope: "MECHANICS_PROVEN", // a generic Angular mount is not the target project
    targetProjectScope: target,
    benchmarkQualification: familyMaturity(caps) === "L6" ? "L6" : "NOT_L6",
  };
}
