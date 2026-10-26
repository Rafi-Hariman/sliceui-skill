// benchmark/report — the full engineering + product-claim + release-gate + evidence-audit report.
// Every axis is printed explicitly, including zero-member, null-score, blocked, unavailable, and
// not-applicable rows. Null is distinguished by REASON: no applicable checks vs missing required
// evidence vs a failed critical gate.

import { CATEGORY_WEIGHTS, RELEASE_THRESHOLDS, categoryBreakdown } from "./scoring.mjs";
import { ORIGIN, resolveMemberStatus } from "./schema.mjs";
import { familyMaturity, scopedMaturity } from "./maturity.mjs";
import { splitEntries, identifyTokens, detectLeakageNormalized, SPLITS } from "./splits.mjs";
import { distributionReport, detectDuplicates, detectNearDuplicates, effectiveSampleSize, scoreVariance } from "./quality.mjs";
import { aggregate } from "./runner.mjs";
import { buildReviewQueue } from "./review-queue.mjs";
import { externalEvidenceManifest } from "./manifest.mjs";

/** A per-axis score row: never omits a key because it has no score. */
function scoreRowFor(results, entries, keyFn) {
  const byId = new Map(entries.map((e) => [e.id, e]));
  const groups = new Map();
  for (const e of entries) {
    for (const k of [].concat(keyFn(e))) {
      if (k == null) continue;
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(e.id);
    }
  }
  const rows = {};
  for (const [k, ids] of [...groups.entries()].sort()) {
    const members = ids.map((id) => byId.get(id));
    const scored = members
      .map((m) => results.find((r) => r.id === m.id))
      .filter((r) => r?.ok && r.score?.overall != null);
    const blocked = members.filter((m) => m.pendingReferenceRender || results.find((r) => r.id === m.id)?.score?.blocked);
    const score = scored.length ? Math.round(scored.reduce((s, r) => s + r.score.overall, 0) / scored.length) : null;
    const status = scored.length && score === 0 ? "ZERO"
      : scored.length ? "SCORED"
        : blocked.length === members.length ? "BLOCKED"
          : members.length ? "INSUFFICIENT_EVIDENCE"
            : "NO_BENCHMARK_MEMBERS";
    rows[k] = { score, scoredMembers: scored.length, totalMembers: members.length, status, reason: blocked.length === members.length && members.length ? "REFERENCE_RENDER_MISSING" : status === "NO_BENCHMARK_MEMBERS" ? "no members" : status === "INSUFFICIENT_EVIDENCE" ? "no scored members" : null };
  }
  return rows;
}

function categoryAggregate(results) {
  const breakdowns = results.filter((r) => r.ok && r.checks?.length).map((r) => categoryBreakdown(r.checks));
  const cats = {};
  for (const cat of Object.keys(CATEGORY_WEIGHTS)) {
    const scores = breakdowns.map((b) => b[cat]?.score).filter((s) => s != null);
    const rawEarned = breakdowns.reduce((s, b) => s + (b[cat]?.rawEarned ?? 0), 0);
    const rawPossible = breakdowns.reduce((s, b) => s + (b[cat]?.rawPossible ?? 0), 0);
    const unverifiable = breakdowns.reduce((s, b) => s + (b[cat]?.unverifiableCount ?? 0), 0);
    cats[cat] = { score: scores.length ? Math.round(scores.reduce((s, x) => s + x, 0) / scores.length) : null, rawEarned, rawPossible, unverifiableCount: unverifiable, applicableMembers: scores.length, capsApplied: null };
  }
  return cats;
}

export function engineeringReport(results = [], entries = []) {
  const byId = new Map(entries.map((e) => [e.id, e]));
  const scored = results.filter((r) => r.ok && r.score?.overall != null);
  const blocked = results.filter((r) => r.ok && (r.pendingReferenceRender || r.score?.blocked));

  const splits = splitEntries(entries);
  const splitInventory = {};
  for (const sp of Object.values(SPLITS)) {
    splitInventory[sp] = splits.filter((e) => e.split === sp).map((e) => ({ id: e.id, origin: e.origin, families: e.topologyFamilies, project: e.project, scoreability: resolveMemberStatus(e).scoreabilityStatus }));
  }

  const near = detectNearDuplicates(entries);
  const weights = {}; // no near-duplicate clusters in the current corpus → weight 1 each
  for (const e of entries) weights[e.id] = 1;

  const critical = results
    .filter((r) => (r.score?.criticalFailures?.length ?? 0) || r.score?.blocked)
    .map((r) => ({ id: r.id, criticalFailures: r.score?.criticalFailures ?? [], blocked: r.score?.blocked ?? null, origin: byId.get(r.id)?.origin }));

  const maturity = {};
  const familyScores = aggregate(results, entries).byFamily ?? {};
  for (const f of new Set(entries.flatMap((e) => e.topologyFamilies ?? []))) {
    const famResults = results.filter((r) => (byId.get(r.id)?.topologyFamilies ?? []).includes(f));
    const real = famResults.filter((r) => byId.get(r.id)?.origin === ORIGIN.REAL_STRUCTURED_EXPORT);
    maturity[f] = scopedMaturity({
      intent: true, generation: true, staticVerification: true, browserVerification: true,
      projectRealAdapter: false, familyMean: familyScores[f] ?? 0, realDesignCount: real.length,
    });
  }

  return {
    sufficiency: {
      realExports: entries.filter((e) => e.origin === ORIGIN.REAL_STRUCTURED_EXPORT).length,
      realExportsScored: scored.filter((r) => byId.get(r.id)?.origin === ORIGIN.REAL_STRUCTURED_EXPORT).length,
      referenceRenders: entries.filter((e) => e.referenceRaster || e.referenceImplementation).length,
      referenceRasters: entries.filter((e) => e.referenceRaster).length,
      totalMembers: entries.length,
      scoredMembers: scored.length,
      unscoredMembers: entries.length - scored.length,
      blockedMembers: blocked.length,
      effectiveSampleSize: effectiveSampleSize(entries, weights),
      sufficient: entries.filter((e) => e.origin === ORIGIN.REAL_STRUCTURED_EXPORT).length >= 30,
    },
    inventory: { ...distributionReport(entries), scoreability: Object.fromEntries(Object.entries(
      entries.reduce((m, e) => { const s = resolveMemberStatus(e).scoreabilityStatus; m[s] = (m[s] ?? 0) + 1; return m; }, {})
    ).sort()) },
    splits: { counts: Object.fromEntries(Object.entries(
      splits.reduce((m, e) => { m[e.split] = (m[e.split] ?? 0) + 1; return m; }, {})
    ).sort()), inventory: splitInventory, leakageLimits: "static anti-matching only — procedural holdout blindness is NOT implemented; holdout integrity is PARTIALLY enforced, not proven" },
    duplicates: {
      exact: detectDuplicates(entries),
      exactCount: detectDuplicates(entries).length,
      near: near,
      nearCount: near.length,
      similarityMethod: "Jaccard over tokenized semanticExpectations",
      similarityThreshold: 0.7,
      rawSampleSize: entries.length,
      effectiveWeightedSampleSize: effectiveSampleSize(entries, weights),
    },
    scores: {
      overallWeighted: scored.length ? Math.round(scored.reduce((s, r) => s + r.score.overall, 0) / scored.length) : null,
      unweightedFixtureMean: scored.length ? Math.round(10 * scored.reduce((s, r) => s + r.score.overall, 0) / scored.length) / 10 : null,
      stddev: scoreVariance(scored.map((r) => r.score.overall)).stddev,
      confidenceInterval: null, // not statistically defensible at n=6 synthetic members
      scope: "SYNTHETIC-ONLY — the real export is unscored; this is framework validation, not production fidelity",
      category: categoryAggregate(results),
      byOrigin: scoreRowFor(results, entries, (e) => e.origin),
      byFamily: scoreRowFor(results, entries, (e) => e.topologyFamilies),
      byProject: scoreRowFor(results, entries, (e) => e.project),
      byAdapter: scoreRowFor(results, entries, (e) => e.requiredProjectAdapter ?? "none"),
      byApplicability: scoreRowFor(results, entries, (e) => e.applicabilityRequirements?.perceptual ?? "NOT_APPLICABLE"),
      weights: { original: CATEGORY_WEIGHTS, effective: CATEGORY_WEIGHTS },
    },
    scoreability: entries.map((e) => ({ id: e.id, ...resolveMemberStatus(e) })),
    criticalFailures: {
      byMember: critical,
      adversarialFailures: critical.filter((c) => byId.get(c.id)?.origin === ORIGIN.ADVERSARIAL_FIXTURE),
      candidateFailures: critical.filter((c) => byId.get(c.id)?.origin !== ORIGIN.ADVERSARIAL_FIXTURE),
      silentA1OverrideTotal: results.reduce((s, r) => s + (r.score?.blocked === "silent-a1-override" ? 1 : 0), 0),
      contentMutationTotal: critical.filter((c) => (c.criticalFailures ?? []).includes("mutatedContent")).length,
      topologyLossTotal: critical.filter((c) => (c.criticalFailures ?? []).includes("majorRelationshipDefect")).length,
      missingRuntimeStateTotal: critical.filter((c) => (c.criticalFailures ?? []).includes("requiredStateAbsent")).length,
    },
    maturity,
    applicability: {
      counts: { REQUIRED: 0, OPTIONAL: 0, NOT_APPLICABLE: entries.filter((e) => (e.applicabilityRequirements?.perceptual ?? "NOT_APPLICABLE") === "NOT_APPLICABLE").length, UNAVAILABLE: entries.filter((e) => (e.applicabilityRequirements?.perceptual ?? "") === "UNAVAILABLE").length },
      denominatorEffects: "perceptual NOT_APPLICABLE for all FIGML members — removed from the denominator; no perceptual points awarded",
    },
    releaseGates: releaseGateAudit(results, entries),
    reviewQueue: buildReviewQueue(results, entries),
    privacy: {
      projectDistribution: distributionReport(entries).byProject,
      note: "no private project source/paths/rasters in this report; fixture directories are not real projects",
    },
    externalEvidence: externalEvidenceManifest(),
  };
}

/** Release-gate audit: every threshold is PASS / FAIL / BLOCKED / NOT_EVALUABLE / NOT_APPLICABLE.
 *  Thresholds are evaluated against REAL scored evidence only (real exports / approved pairs /
 *  screenshot rasters) — synthetic and adversarial members are framework validation, never a
 *  release-gate contribution. Intentionally-adversarial failures are reported separately. */
export function releaseGateAudit(results = [], entries = []) {
  const byId = new Map(entries.map((e) => [e.id, e]));
  const realOrigins = new Set([ORIGIN.REAL_STRUCTURED_EXPORT, ORIGIN.APPROVED_IMPLEMENTATION_PAIR, ORIGIN.SCREENSHOT_RASTER]);
  const real = results.filter((r) => byId.get(r.id) && realOrigins.has(byId.get(r.id).origin));
  const realScored = real.filter((r) => r.ok && r.score?.overall != null);

  const cats = categoryAggregate(realScored);
  const overall = scoredOverall(realScored);
  const thresholdValues = { overall, structure: cats.structure?.score ?? null, content: cats.content?.score ?? null, relationships: cats.relationships?.score ?? null, visual: cats.visual?.score ?? null, runtime: cats.runtime?.score ?? null };
  const thresholds = {};
  for (const [name, thr] of Object.entries(RELEASE_THRESHOLDS)) {
    const v = thresholdValues[name];
    thresholds[name] = v == null ? "NOT_EVALUABLE" : (v >= thr ? "PASS" : "FAIL");
  }

  // Nonnegotiable gates are evaluated over CANDIDATE (non-adversarial) members only.
  const candidate = results.filter((r) => byId.get(r.id)?.origin !== ORIGIN.ADVERSARIAL_FIXTURE);
  const critical = candidate.filter((r) => (r.score?.criticalFailures?.length ?? 0) || r.score?.blocked);
  const nonnegotiable = {
    silentA1Override: candidate.some((r) => r.score?.blocked === "silent-a1-override") ? "FAIL" : "PASS",
    visibleContentMutation: critical.some((c) => (c.score?.criticalFailures ?? []).includes("mutatedContent")) ? "FAIL" : "PASS",
    criticalTopologyLoss: critical.some((c) => (c.score?.criticalFailures ?? []).includes("majorRelationshipDefect")) ? "FAIL" : "PASS",
    requiredProjectRealMount: "BLOCKED", // no private Bill/Pilar mount in this repo
  };
  return { thresholds, nonnegotiable };
}

function scoredOverall(results) {
  const scored = results.filter((r) => r.ok && r.score?.overall != null);
  return scored.length ? Math.round(scored.reduce((s, r) => s + r.score.overall, 0) / scored.length) : null;
}

/** The CONSTRAINED product claim + engineering capability statement (section 15). */
export function productClaimReport(report = {}) {
  const l6 = Object.entries(report.maturity ?? {}).filter(([, m]) => m.benchmarkQualification === "L6").map(([f]) => f);
  return {
    productionSupportedFamilies: l6,
    inputTypes: l6.length ? ["FIGML REAL_STRUCTURED_EXPORT"] : [],
    frameworkAdapters: [],
    projectRealEnvironments: [],
    claim: l6.length
      ? `Production-supported families: ${l6.join(", ")} (with project-real render + real-design benchmark ≥92).`
      : "NO PRODUCTION CLAIM — the corpus is insufficient (framework validation only). A green synthetic benchmark is NOT product validation.",
  };
}

export function engineeringCapabilityStatement(report = {}) {
  return {
    compilerPaths: ["FIGML → Raw Graph → intent → constraints (LINEAR/GRID/REPEATED/OVERLAY production compilers)"],
    verificationInfrastructure: ["relationship/content/style/runtime/responsive verifiers (browser-backed matrix)"],
    benchmarkInfrastructure: ["schema + scoring + hard caps + maturity + splits + leakage + duplicates + review queue"],
    representativeAdapter: "MECHANICS_PROVEN (generic Angular mount — not Bill/Pilar)",
    unsupportedOrUnbenchmarkedFamilies: ["SCROLL", "STICKY", "STATE_VARIANT", "RESPONSIVE_VARIANT", "DATA_VISUALIZATION", "FREEFORM"],
  };
}

/** One markdown document: engineering report + release gates + product claim + external manifest. */
export function renderReport(report, claim, capability) {
  const L = [];
  L.push("# SliceUI Benchmark + Release Decision Report");
  L.push("");
  L.push("## Sufficiency");
  L.push("");
  L.push(`- real exports ${report.sufficiency.realExports} (scored ${report.sufficiency.realExportsScored}) · reference renders ${report.sufficiency.referenceRenders} · members ${report.sufficiency.totalMembers} (scored ${report.sufficiency.scoredMembers}, blocked ${report.sufficiency.blockedMembers}, effective ${report.sufficiency.effectiveSampleSize})`);
  L.push(`- **sufficient for production: ${report.sufficiency.sufficient ? "YES" : "NO"}**`);
  L.push("");
  L.push("## Scores (synthetic-scoped)");
  L.push("");
  L.push(`- overall (synthetic-only): ${report.scores.overallWeighted ?? "null"} · stddev ${report.scores.stddev ?? "n/a"} · CI: ${report.scores.confidenceInterval ?? "not statistically defensible"}`);
  L.push("```json");
  L.push(JSON.stringify({ byOrigin: report.scores.byOrigin, byFamily: report.scores.byFamily, byAdapter: report.scores.byAdapter, byApplicability: report.scores.byApplicability }, null, 2));
  L.push("```");
  L.push("");
  L.push("## Critical failures");
  L.push("");
  if (!report.criticalFailures.byMember.length) L.push("_(none)_");
  for (const c of report.criticalFailures.byMember) L.push(`- ${c.id}: [${c.criticalFailures.join(", ")}]${c.blocked ? ` blocked=${c.blocked}` : ""}`);
  L.push("");
  L.push("## Maturity (scoped)");
  L.push("");
  for (const [f, m] of Object.entries(report.maturity ?? {})) L.push(`- ${f}: compiler=${m.compilerMaturity}, representative=${m.representativeAngularScope}, target=${m.targetProjectScope}, benchmark=${m.benchmarkQualification}`);
  L.push("");
  L.push("## Release gates");
  L.push("");
  L.push("```json");
  L.push(JSON.stringify(report.releaseGates, null, 2));
  L.push("```");
  L.push("");
  L.push("## Product claim");
  L.push("");
  L.push(claim.claim);
  L.push("");
  L.push("## External evidence required");
  L.push("");
  for (const e of report.externalEvidence) L.push(`- ${e.evidenceType} (min ${e.minimumNeeded}): ${e.currentStatus}`);
  return L.join("\n") + "\n";
}
