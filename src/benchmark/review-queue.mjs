// benchmark/review-queue — the false-positive / false-negative review queue (section 11).
//
// Every suspected FP/FN, unavailable-required-evidence, unresolved-correspondence, ambiguous-
// classification, or manually-suppressed finding lands here with its provenance — never silently
// discarded. An empty queue is reported explicitly.

/**
 * @param {Array} results — runBenchmark output
 * @param {Array} entries — the inventory
 * @returns {Array<{ memberId, findingType, verifier, evidence, provisionalClassification, reviewStatus, resolution, resolutionProvenance }>}
 */
export function buildReviewQueue(results = [], entries = []) {
  const byId = new Map(entries.map((e) => [e.id, e]));
  const queue = [];

  for (const r of results) {
    if (!r.ok) continue;
    const m = byId.get(r.id);

    if (m?.pendingReferenceRender || r.score?.blocked) {
      queue.push({
        memberId: r.id,
        findingType: "unavailable-required-evidence",
        verifier: "benchmark-runner",
        evidence: r.score?.blocked ?? "REFERENCE_RENDER_MISSING",
        provisionalClassification: "BLOCKED",
        reviewStatus: "open",
        resolution: null,
        resolutionProvenance: null,
      });
      continue;
    }

    if (m?.expectedVerdict === "fail" && r.score?.overall === 100) {
      queue.push({
        memberId: r.id, findingType: "suspected-false-negative", verifier: "benchmark-runner",
        evidence: "a known-bad fixture passed (100)", provisionalClassification: "false-negative",
        reviewStatus: "open", resolution: null, resolutionProvenance: null,
      });
    } else if (m?.expectedVerdict === "pass" && r.score?.overall != null && r.score.overall < 100) {
      queue.push({
        memberId: r.id, findingType: "suspected-false-positive", verifier: "benchmark-runner",
        evidence: `a known-good fixture scored ${r.score.overall}`, provisionalClassification: "false-positive",
        reviewStatus: "open", resolution: null, resolutionProvenance: null,
      });
    }
  }
  return queue;
}
