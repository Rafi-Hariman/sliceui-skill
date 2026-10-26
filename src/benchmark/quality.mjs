// benchmark/quality — duplicate detection, near-duplicate weighting, distribution reporting, and
// score variance (section 8). The benchmark must not inflate its size with trivial transforms of
// the same design, nor let generated-by-SliceUI references count as approved evidence.

/** A member's design fingerprint (topology + semantic content). */
export function fingerprint(member) {
  return JSON.stringify({
    families: [...(member.topologyFamilies ?? [])].sort(),
    semantic: member.semanticExpectations ?? [],
  });
}

/** Exact duplicates (identical fingerprint) — must be flagged, never silently double-counted. */
export function detectDuplicates(entries = []) {
  const seen = new Map();
  const dupes = [];
  for (const e of entries) {
    const fp = fingerprint(e);
    if (seen.has(fp)) dupes.push({ id: e.id, duplicateOf: seen.get(fp) });
    else seen.set(fp, e.id);
  }
  return dupes;
}

/** Near-duplicate weighting: members sharing the same family set but distinct content weigh 0.5. */
export function nearDuplicateWeight(member, entries = []) {
  const fam = JSON.stringify([...(member.topologyFamilies ?? [])].sort());
  const siblings = entries.filter((e) => e.id !== member.id && JSON.stringify([...(e.topologyFamilies ?? [])].sort()) === fam);
  // A member with many same-family siblings is more likely a transform — down-weight it.
  return siblings.length >= 3 ? 0.5 : 1.0;
}

/** Distribution report across the axes the claim must be broken down by (section 5). */
export function distributionReport(entries = []) {
  const by = (fn) => {
    const m = new Map();
    for (const e of entries) for (const k of [].concat(fn(e))) { if (k) m.set(k, (m.get(k) ?? 0) + 1); }
    return Object.fromEntries([...m.entries()].sort());
  };
  return {
    byOrigin: by((e) => e.origin),
    byTopology: by((e) => e.topologyFamilies),
    byProject: by((e) => e.project ?? "generic"),
    byViewport: by((e) => e.suppliedViewports?.map((v) => `w${v.width ?? v}`) ?? ["unspecified"]),
    byApplicability: by((e) => e.applicabilityRequirements?.perceptual ?? "figml-not-applicable"),
  };
}

/** Mean / standard-deviation of a set of numeric scores (where variance is computable). */
export function scoreVariance(scores = []) {
  const nums = scores.filter((s) => typeof s === "number" && Number.isFinite(s));
  if (!nums.length) return { n: 0, mean: null, stddev: null };
  const mean = nums.reduce((s, v) => s + v, 0) / nums.length;
  const variance = nums.reduce((s, v) => s + (v - mean) ** 2, 0) / nums.length;
  return { n: nums.length, mean: Math.round(mean * 10) / 10, stddev: Math.round(Math.sqrt(variance) * 10) / 10 };
}

/** Generated-by-SliceUI sources are NOT approved references unless explicitly reviewed. */
export function isUnreviewedGenerated(member) {
  return member.privacyClassification === "generated" && member.approvedReference !== true;
}

/** Jaccard similarity of two members' tokenized semantic expectations (near-duplicate method). */
export function similarity(a, b) {
  const tokens = (m) => new Set(String(m.semanticExpectations ?? "").toLowerCase().split(/\W+/).filter(Boolean));
  const ta = tokens(a), tb = tokens(b);
  if (!ta.size && !tb.size) return 0;
  const inter = [...ta].filter((x) => tb.has(x)).length;
  const union = ta.size + tb.size - inter;
  return union ? inter / union : 0;
}

/** Near-duplicate clusters: same family set + Jaccard similarity above the threshold (but NOT
 *  identical — exact duplicates are reported separately). */
export function detectNearDuplicates(entries = [], { threshold = 0.7 } = {}) {
  const clusters = [];
  const seen = new Set();
  for (const a of entries) {
    if (seen.has(a.id)) continue;
    const fam = JSON.stringify([...(a.topologyFamilies ?? [])].sort());
    const group = entries.filter((b) => b.id !== a.id && JSON.stringify([...(b.topologyFamilies ?? [])].sort()) === fam);
    const near = group.filter((b) => {
      const s = similarity(a, b);
      return s > 0 && s < 1 && s >= threshold;
    });
    if (near.length) {
      clusters.push({ baseId: a.id, members: [a.id, ...near.map((b) => b.id)], similarity: Math.round(100 * Math.max(...near.map((b) => similarity(a, b)))) / 100 });
      for (const id of [a.id, ...near.map((b) => b.id)]) seen.add(id);
    }
  }
  return clusters;
}

/** Effective weighted sample size (raw size reduced by near-duplicate down-weighting). */
export function effectiveSampleSize(entries = [], weights = {}) {
  return Math.round((entries.reduce((s, e) => s + (weights[e.id] ?? 1), 0)) * 10) / 10;
}
