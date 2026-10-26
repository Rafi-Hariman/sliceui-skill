// benchmark closure — scoreability lifecycle, approved-reference provenance, scoped maturity,
// normalized leakage, near-duplicate analysis, review queue, external manifest, release-gate audit.
import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveMemberStatus, validateApprovedReference, ORIGIN } from "../../src/benchmark/schema.mjs";
import { categoryBreakdown } from "../../src/benchmark/scoring.mjs";
import { scopedMaturity, familyMaturity } from "../../src/benchmark/maturity.mjs";
import { detectLeakageNormalized, splitEntries, SPLITS } from "../../src/benchmark/splits.mjs";
import { detectNearDuplicates, effectiveSampleSize, similarity } from "../../src/benchmark/quality.mjs";
import { buildReviewQueue } from "../../src/benchmark/review-queue.mjs";
import { externalEvidenceManifest } from "../../src/benchmark/manifest.mjs";
import { buildInventory } from "../../src/benchmark/inventory.mjs";
import { runBenchmark } from "../../src/benchmark/runner.mjs";
import { engineeringReport, releaseGateAudit } from "../../src/benchmark/report.mjs";

const member = (over = {}) => ({
  id: "m", origin: ORIGIN.ADVERSARIAL_FIXTURE, topologyFamilies: ["LINEAR"], sourceInput: "inline",
  suppliedViewports: [1440], semanticExpectations: ["x"], topologyExpectations: ["y"],
  requiredRuntimeStates: [], requiredProjectAdapter: "none", applicabilityRequirements: { perceptual: "NOT_APPLICABLE" },
  privacyClassification: "synthetic", ...over,
});

// ---------- scoreability lifecycle ----------

test("lifecycle: a real export without a reference render is BLOCKED, not passing", () => {
  const s = resolveMemberStatus(member({ id: "real", origin: ORIGIN.REAL_STRUCTURED_EXPORT, pendingReferenceRender: true }));
  assert.equal(s.schemaStatus, "valid");
  assert.equal(s.scoreabilityStatus, "blocked");
  assert.ok(s.blockingEvidence.includes("REFERENCE_RENDER_MISSING"));
  assert.equal(s.includedInScoreDenominator, false);
});

test("lifecycle: an adversarial fixture is scoreable", () => {
  const s = resolveMemberStatus(member({ id: "adv" }));
  assert.equal(s.scoreabilityStatus, "scoreable");
  assert.equal(s.includedInScoreDenominator, true);
});

test("lifecycle: an invalid entry stays rejected (schemaStatus invalid)", () => {
  const s = resolveMemberStatus({ id: "broken" });
  assert.equal(s.schemaStatus, "invalid");
  assert.equal(s.scoreabilityStatus, "invalid");
});

test("lifecycle: an approved implementation pair needs an independent review record", () => {
  const unreviewed = resolveMemberStatus(member({ id: "pair", origin: ORIGIN.APPROVED_IMPLEMENTATION_PAIR }));
  assert.ok(unreviewed.blockingEvidence.includes("APPROVED_REFERENCE_UNREVIEWED"));
  const reviewed = validateApprovedReference(member({ id: "pair", origin: ORIGIN.APPROVED_IMPLEMENTATION_PAIR, reviewRecord: { reviewer: "eng", status: "approved", date: "2026-10-26", artifactHash: "abc123", independentOfScore: true } }));
  assert.equal(reviewed.ok, true);
  const bad = validateApprovedReference(member({ id: "pair", origin: ORIGIN.APPROVED_IMPLEMENTATION_PAIR, reviewRecord: { status: "pending" } }));
  assert.equal(bad.ok, false, "a non-approved review is rejected");
});

// ---------- category breakdown ----------

test("categoryBreakdown: raw earned/possible + score + unverifiable are separated", () => {
  const b = categoryBreakdown([
    { category: "content", family: "exact-text", status: "pass" },
    { category: "content", family: "exact-text", status: "fail" },
    { category: "content", family: "exact-text", status: "unverifiable" },
  ]);
  assert.equal(b.structure.rawEarned, 1);
  assert.equal(b.structure.rawPossible, 2);
  assert.equal(b.structure.score, 50);
  assert.equal(b.structure.unverifiableCount, 1);
  assert.equal(b.content.score, null, "no content checks → null, not zero");
});

// ---------- scoped maturity ----------

test("scopedMaturity: compiler L4, target GATED, benchmark NOT_L6 (synthetic cannot reach L6)", () => {
  const m = scopedMaturity({ intent: true, generation: true, staticVerification: true, browserVerification: true, projectRealAdapter: false, familyMean: 100, realDesignCount: 0 });
  assert.equal(m.compilerMaturity, "L4");
  assert.equal(m.targetProjectScope, "GATED_BELOW_L5");
  assert.equal(m.benchmarkQualification, "NOT_L6");
  assert.equal(m.representativeAngularScope, "MECHANICS_PROVEN");
});

// ---------- normalized leakage ----------

test("leakage: normalized matching catches case/dimension/path variants", () => {
  const holdout = [member({ id: "holdout", copyTextTokens: ["Mahasiswa Contoh A"], dimensionTokens: ["0.50px"] })];
  const findings = detectLeakageNormalized(holdout, ["// mahasiswa_Contoh_A is special-cased", "width: 0.5px"]);
  assert.ok(findings.length >= 2, "normalized text + rounded dimension both flagged");
});

// ---------- near-duplicate ----------

test("duplicates: near-duplicate clusters + effective sample size are reported", () => {
  const base = member({ id: "a", semanticExpectations: ["a table with five rows and eight columns"] });
  const similar = member({ id: "b", semanticExpectations: ["a table with five rows and seven columns"] });
  assert.ok(similarity(base, similar) > 0.7, "Jaccard similarity above threshold");
  const clusters = detectNearDuplicates([base, similar]);
  assert.ok(clusters.length >= 1, "near-duplicate cluster detected");
  assert.equal(effectiveSampleSize([base, similar], { a: 1, b: 1 }), 2);
});

// ---------- review queue + manifest ----------

test("review queue: the blocked real export is queued; correct known-bad failures are NOT false-negatives", () => {
  const entries = buildInventory();
  const results = runBenchmark(entries);
  const q = buildReviewQueue(results, entries);
  assert.ok(q.some((e) => e.memberId === "mahasiswa-tarif" && e.findingType === "unavailable-required-evidence"));
  assert.ok(!q.some((e) => e.memberId === "adv-ratio-bad"), "a known-bad that correctly fails is a true positive, not a FN");
  assert.ok(!q.some((e) => e.memberId === "adv-ratio-good"), "a known-good that passes is not a FP");
});

test("external manifest: records the missing evidence, not synthetic data", () => {
  const m = externalEvidenceManifest();
  assert.ok(m.length >= 4);
  assert.ok(m.some((e) => e.evidenceType === "PROJECT_REAL_MOUNT" && e.currentStatus === "GATED/UNAVAILABLE"));
  assert.ok(m.every((e) => e.minimumNeeded > 0 && e.topologyTargets?.length));
});

// ---------- release gates ----------

test("release gates: thresholds NOT_EVALUABLE (no real scored evidence); project mount BLOCKED", () => {
  const entries = buildInventory();
  const results = runBenchmark(entries);
  const gates = releaseGateAudit(results, entries);
  assert.equal(gates.thresholds.overall, "NOT_EVALUABLE");
  assert.equal(gates.thresholds.structure, "NOT_EVALUABLE");
  assert.equal(gates.nonnegotiable.silentA1Override, "PASS");
  assert.equal(gates.nonnegotiable.requiredProjectRealMount, "BLOCKED");
});
