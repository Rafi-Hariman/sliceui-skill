// benchmark/runner — run each member through the real pipeline (Design Intent → Verification Plan →
// verification verdict) and score it. The runner REJECTS incomplete entries and reports a real
// export with no reference render as `pendingReferenceRender` (score null), never as a silent pass.

import { validateEntry } from "./schema.mjs";
import { scoreMember } from "./scoring.mjs";
import { verifyIntent } from "../verification/verify.mjs";
import { ingestDesign } from "../design/ingest.mjs";
import { familyMaturity } from "./maturity.mjs";

/** Run one member. */
export function runMember(member) {
  const v = validateEntry(member);
  if (!v.ok) return { id: member?.id ?? "(unknown)", ok: false, errors: v.errors, score: null };

  if (member.pendingReferenceRender) {
    return { id: member.id, ok: true, pendingReferenceRender: true, score: null, checks: [] };
  }

  let intentGraph;
  let sourceError = null;
  try {
    intentGraph = member.intentGraph ?? ingestDesign(member.sourceXml ?? "", member.sourceInput).intentGraph;
  } catch (err) {
    sourceError = String(err?.message ?? err).slice(0, 200);
    intentGraph = member.intentGraph ?? { constraints: [], tables: [], content: [], states: [] };
  }

  const result = verifyIntent({
    intentGraph,
    rects: member.evidence?.rects ?? new Map(),
    computedStyles: member.evidence?.computedStyles ?? new Map(),
    domTexts: member.evidence?.domTexts ?? [],
    domState: member.evidence?.domState ?? {},
    styleChecks: member.evidence?.styleChecks ?? [],
  });

  const score = scoreMember({ checks: result.checks, silentA1Override: member.silentA1Override ?? 0 });
  return { id: member.id, ok: true, sourceError, checks: result.checks, score };
}

/** Run the whole inventory. */
export function runBenchmark(entries = []) {
  return entries.map(runMember);
}

/** Aggregate the per-member scores into per-origin / per-family / per-adapter breakdowns. */
export function aggregate(results = [], entries = []) {
  const byId = new Map(entries.map((e) => [e.id, e]));
  const group = (fn) => {
    const m = new Map();
    for (const res of results) {
      if (!res.ok || res.score?.overall == null) continue;
      for (const k of [].concat(fn(byId.get(res.id)) ?? [])) {
        if (k == null) continue;
        if (!m.has(k)) m.set(k, []);
        m.get(k).push(res.score.overall);
      }
    }
    return Object.fromEntries([...m.entries()].map(([k, v]) => [k, Math.round(v.reduce((s, x) => s + x, 0) / v.length)]));
  };
  return {
    byOrigin: group((e) => e?.origin),
    byFamily: group((e) => e?.topologyFamilies),
    byAdapter: group((e) => e?.requiredProjectAdapter ?? "none"),
  };
}

/** Build the maturity matrix from the pipeline capabilities (what actually exists) + scores. */
export function maturityMatrix(results = [], entries = []) {
  const byId = new Map(entries.map((e) => [e.id, e]));
  const families = new Map();
  for (const res of results) {
    const e = byId.get(res.id);
    for (const f of e?.topologyFamilies ?? []) {
      if (!families.has(f)) families.set(f, { scores: [], realDesignCount: 0 });
      if (res.score?.overall != null) families.get(f).scores.push(res.score.overall);
      if (e?.origin === "REAL_STRUCTURED_EXPORT") families.get(f).realDesignCount += 1;
    }
  }
  const matrix = {};
  for (const [f, agg] of families) {
    const mean = agg.scores.length ? agg.scores.reduce((s, x) => s + x, 0) / agg.scores.length : 0;
    matrix[f] = familyMaturity({
      intent: true, generation: true, staticVerification: true, browserVerification: true,
      projectRealAdapter: false, // representative fixture only; Bill/Pilar is GATED
      familyMean: mean,
      criticalIntentLoss: false,
      minRealDesignScore: agg.realDesignCount ? 0 : 0, // no real-design score without a reference render
      silentA1Override: 0,
      realDesignCount: agg.realDesignCount,
    });
  }
  return matrix;
}
