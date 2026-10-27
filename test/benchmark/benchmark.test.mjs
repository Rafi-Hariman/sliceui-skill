// benchmark — schema, scoring/hard-caps, maturity transitions, leakage/duplicates, runner/report.
import { test } from "node:test";
import assert from "node:assert/strict";
import { validateEntry, ORIGIN } from "../../src/benchmark/schema.mjs";
import { scoreMember, CATEGORY_WEIGHTS, HARD_CAPS, categoryOf } from "../../src/benchmark/scoring.mjs";
import { familyMaturity } from "../../src/benchmark/maturity.mjs";
import { splitEntries, detectLeakage, hashId, SPLITS } from "../../src/benchmark/splits.mjs";
import { detectDuplicates, distributionReport, scoreVariance, fingerprint } from "../../src/benchmark/quality.mjs";
import { buildInventory } from "../../src/benchmark/inventory.mjs";
import { runBenchmark, aggregate, maturityMatrix } from "../../src/benchmark/runner.mjs";
import { engineeringReport, productClaimReport } from "../../src/benchmark/report.mjs";

const member = (over = {}) => ({
  id: "m1", origin: ORIGIN.ADVERSARIAL_FIXTURE, topologyFamilies: ["LINEAR"], sourceInput: "inline",
  suppliedViewports: [1440], semanticExpectations: ["x"], topologyExpectations: ["y"],
  requiredRuntimeStates: [], requiredProjectAdapter: "none", applicabilityRequirements: { perceptual: "NOT_APPLICABLE" },
  privacyClassification: "synthetic", ...over,
});

// ---------- schema ----------

test("schema: an incomplete entry is REJECTED (never silently dropped)", () => {
  const r = validateEntry({ id: "x" });
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.includes("topologyFamilies")), "missing families is an error");
});

test("schema: a complete entry validates", () => {
  assert.equal(validateEntry(member()).ok, true);
});

// ---------- scoring + hard caps ----------

const check = (category, family, status) => ({ category, family, status });

test("scoring: all-pass checks score 100 overall", () => {
  const s = scoreMember({ checks: [check("relationship", "sibling-ratio", "pass"), check("content", "exact-text", "pass")] });
  assert.equal(s.overall, 100);
  assert.deepEqual(s.criticalFailures, []);
});

test("scoring: a missing visible node caps structure to 70 (cannot be rescued)", () => {
  const checks = [check("content", "exact-text", "fail"), ...Array.from({ length: 9 }, () => check("content", "exact-text", "pass"))];
  const s = scoreMember({ checks });
  assert.equal(s.categories.structure, 70, "90% structural accuracy is capped to 70");
  assert.ok(s.criticalFailures.includes("missingVisibleNode"));
});

test("scoring: a major relationship defect caps relationships to 75", () => {
  const checks = [check("relationship", "sibling-ratio", "fail"), ...Array.from({ length: 9 }, () => check("relationship", "spacing", "pass"))];
  const s = scoreMember({ checks });
  assert.equal(s.categories.relationships, 75, "90% relationship accuracy is capped to 75");
  assert.ok(s.criticalFailures.includes("majorRelationshipDefect"));
});

test("scoring: a required runtime state absent caps runtime to 50", () => {
  const checks = [check("runtime", "pagination-visible", "fail"), ...Array.from({ length: 9 }, () => check("runtime", "pagination-visible", "pass"))];
  const s = scoreMember({ checks });
  assert.equal(s.categories.runtime, 50, "90% runtime accuracy is capped to 50");
  assert.ok(s.criticalFailures.includes("requiredStateAbsent"));
});

test("scoring: silent A1 override BLOCKS the overall score", () => {
  const s = scoreMember({ checks: [check("relationship", "sibling-ratio", "pass")], silentA1Override: 1 });
  assert.equal(s.blocked, "silent-a1-override");
  assert.equal(s.overall, null, "a blocked score is never a passing number");
});

test("scoring: an unexercised category is null (never inflated)", () => {
  const s = scoreMember({ checks: [check("relationship", "sibling-ratio", "pass")] });
  assert.equal(s.categories.visual, null);
  assert.equal(s.categories.runtime, null);
});

// ---------- maturity ----------

test("maturity: the ladder advances L0→L6 only through the gates", () => {
  const base = { intent: true, generation: true, staticVerification: true, browserVerification: true, projectRealAdapter: true, familyMean: 95, criticalIntentLoss: false, minRealDesignScore: 95, silentA1Override: 0, realDesignCount: 3 };
  assert.equal(familyMaturity({}), "L0");
  assert.equal(familyMaturity({ intent: true }), "L1");
  assert.equal(familyMaturity({ intent: true, generation: true }), "L2");
  assert.equal(familyMaturity({ intent: true, generation: true, staticVerification: true }), "L3");
  assert.equal(familyMaturity({ intent: true, generation: true, staticVerification: true, browserVerification: true }), "L4");
  assert.equal(familyMaturity({ ...base, familyMean: 80 }), "L5", "below the floor → L5, not L6");
  assert.equal(familyMaturity(base), "L6");
});

test("maturity: synthetic-only evidence can NEVER reach L6", () => {
  const synthetic = { intent: true, generation: true, staticVerification: true, browserVerification: true, projectRealAdapter: true, familyMean: 100, minRealDesignScore: 100, silentA1Override: 0, realDesignCount: 0 };
  assert.equal(familyMaturity(synthetic), "L5");
});

test("maturity: a GATED private adapter caps a family at L4 (Bill/Pilar)", () => {
  const gated = { intent: true, generation: true, staticVerification: true, browserVerification: true, projectRealAdapter: false, familyMean: 100, realDesignCount: 10 };
  assert.equal(familyMaturity(gated), "L4", "no project-real mount → never L5/L6");
});

// ---------- splits + leakage ----------

test("splits: splitEntries is deterministic and stable as the corpus grows", () => {
  const small = [member({ id: "a" }), member({ id: "b" })];
  const grown = [...small, member({ id: "c" }), member({ id: "d" })];
  const smallSplits = Object.fromEntries(splitEntries(small).map((e) => [e.id, e.split]));
  const grownSplits = Object.fromEntries(splitEntries(grown).map((e) => [e.id, e.split]));
  // Determinism: same input twice → same output.
  assert.deepEqual(splitEntries(grown).map((e) => e.split), splitEntries(grown).map((e) => e.split), "deterministic");
  // Every assigned split is a valid bucket.
  for (const sp of Object.values(grownSplits)) assert.ok(Object.values(SPLITS).includes(sp), `valid split ${sp}`);
  // A member keeps its split when the corpus grows (size-independent bucket).
  for (const id of ["a", "b"]) {
    assert.equal(grownSplits[id], smallSplits[id], `"${id}" split is stable across corpus growth`);
  }
});

test("splits: detectLeakage flags a rule source embedding a holdout token", () => {
  const holdout = [member({ id: "holdout-member", copyTextTokens: ["Mahasiswa Contoh A"] })];
  const findings = detectLeakage(holdout, ["// generic rule: Mahasiswa Contoh A is special-cased"]);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].token, "Mahasiswa Contoh A");
});

// ---------- quality ----------

test("quality: exact duplicates are detected; near-duplicate weighting exists", () => {
  const a = member({ id: "a" }), b = member({ id: "b", topologyFamilies: ["LINEAR"], semanticExpectations: ["x"] });
  const dupes = detectDuplicates([a, { ...a, id: "a-copy" }]);
  assert.equal(dupes.length, 1);
  assert.equal(fingerprint(a), fingerprint(b), "same fingerprint");
});

test("quality: distributionReport + scoreVariance compute", () => {
  const d = distributionReport([member()]);
  assert.equal(d.byOrigin[ORIGIN.ADVERSARIAL_FIXTURE], 1);
  assert.equal(d.byTopology.LINEAR, 1);
  const v = scoreVariance([80, 90, 100]);
  assert.equal(v.n, 3);
  assert.ok(v.stddev > 0);
});

// ---------- runner + report ----------

test("runner: the seeded inventory runs; the real export is pending (not a silent pass)", () => {
  const entries = buildInventory();
  const results = runBenchmark(entries);
  const real = results.find((r) => r.id === "mahasiswa-tarif");
  assert.equal(real.pendingReferenceRender, true);
  assert.equal(real.score, null, "a real export with no reference render scores null, never a fake pass");

  const good = results.find((r) => r.id === "adv-ratio-good");
  const bad = results.find((r) => r.id === "adv-ratio-bad");
  assert.equal(good.score.overall, 100, "known-good scores high (falsification: no over-failing)");
  assert.ok(bad.score.overall < 100, "known-bad scores low");
  assert.ok(bad.score.criticalFailures.includes("majorRelationshipDefect"), "the correct critical failure is classified");
});

test("report: the corpus is reported INSUFFICIENT and the claim is constrained", () => {
  const entries = buildInventory();
  const results = runBenchmark(entries);
  const report = engineeringReport(results, entries);
  assert.equal(report.sufficiency.sufficient, false, "1 real export is not a 30–50 screen corpus");
  assert.equal(report.sufficiency.realExports, 1);
  const claim = productClaimReport(report);
  assert.equal(claim.productionSupportedFamilies.length, 0, "no family reaches L6");
  assert.match(claim.claim, /NO PRODUCTION CLAIM/);
  // Maturity caps at L4 (no project-real adapter).
  for (const level of Object.values(report.maturity)) assert.notEqual(level, "L6");
});
