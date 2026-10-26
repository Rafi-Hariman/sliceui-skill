// benchmark/scoring — fidelity scoring with category weights and hard caps (doc 04 §10, section 6).
//
// Categories are scored from the VERIFICATION verdicts (Prompt C), never from source presence.
// Hard caps prevent a critical failure from being rescued by many low-value passes: a missing
// visible node, mutated designed content, a major relationship defect, an absent required runtime
// state, or a silent A1 override all cap the affected category (or block the overall score).
// Categories the member did not exercise are reported as `null`, and the overall is the weighted
// mean over EXERCISED categories only — never inflated by an unmeasured category.

export const CATEGORY_WEIGHTS = Object.freeze({
  structure: 20, relationships: 30, content: 15, visual: 20, runtime: 10, responsive: 5,
});

export const HARD_CAPS = Object.freeze({
  missingVisibleNode: { structure: 70 },
  mutatedContent: { content: 70 },
  majorRelationshipDefect: { relationships: 75 },
  requiredStateAbsent: { runtime: 50 },
  silentA1Override: { overall: "BLOCKED" },
});

export const RELEASE_THRESHOLDS = Object.freeze({ overall: 95, structure: 98, content: 98, relationships: 93, visual: 90, runtime: 95 });

/** Per-category raw-earned / raw-possible / decisive / score / unverifiable breakdown (section 3).
 *  A category with no decisive checks has `score: null` (never inflated); unverifiable checks are
 *  reported separately and are NOT part of the decisive denominator. */
export function categoryBreakdown(checks = []) {
  const byCategory = new Map();
  for (const c of checks) {
    const cat = categoryOf(c);
    if (!cat) continue;
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat).push(c);
  }
  const breakdown = {};
  for (const cat of Object.keys(CATEGORY_WEIGHTS)) {
    const cs = byCategory.get(cat) ?? [];
    const decisive = cs.filter((c) => c.status === "pass" || c.status === "fail");
    const earned = decisive.filter((c) => c.status === "pass").length;
    const possible = decisive.length;
    breakdown[cat] = {
      rawEarned: earned,
      rawPossible: possible,
      decisiveCount: decisive.length,
      unverifiableCount: cs.filter((c) => c.status === "unverifiable" || c.status === "unresolved").length,
      score: possible ? Math.round(100 * earned / possible) : null,
    };
  }
  return breakdown;
}

/** A check's benchmark category (maps the verifier's `category`/`family` onto the six fidelity axes).
 *  An exact-text node's presence is STRUCTURAL; a table's designed data is CONTENT. */
export function categoryOf(check) {
  if (check.category === "content") return check.family === "table-content" ? "content" : "structure";
  if (check.category === "runtime") return "runtime";
  if (check.category === "responsive") return "responsive";
  if (check.category === "style") return "visual";
  if (check.category === "relationship") return "relationships";
  return null;
}

/** Which critical failures a set of failed checks trigger. */
export function classifyFailures(checks = []) {
  const set = new Set();
  for (const c of checks) {
    if (c.status !== "fail") continue;
    if (c.family === "exact-text") set.add("missingVisibleNode");
    if (c.family === "table-content") set.add("mutatedContent");
    if (["sibling-ratio", "alignment", "anchor", "grid-track", "relative-size"].includes(c.family)) set.add("majorRelationshipDefect");
    if (c.family === "pagination-visible") set.add("requiredStateAbsent");
  }
  return [...set];
}

/**
 * Score one benchmark member from its verification checks.
 * @param {{ checks: Array, silentA1Override?: number }} input
 * @returns {{ categories: object, overall: number|null, criticalFailures: string[], blocked?: string }}
 */
export function scoreMember({ checks = [], silentA1Override = 0 } = {}) {
  const critical = classifyFailures(checks);

  const byCategory = new Map();
  for (const c of checks) {
    const cat = categoryOf(c);
    if (!cat) continue;
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat).push(c);
  }

  const categories = {};
  for (const cat of Object.keys(CATEGORY_WEIGHTS)) {
    const cs = byCategory.get(cat);
    if (!cs || !cs.length) { categories[cat] = null; continue; } // unexercised — not scored, not inflated
    // Unverifiable/unresolved checks are NOT decisive — exclude them from the denominator.
    const decisive = cs.filter((c) => c.status === "pass" || c.status === "fail");
    if (!decisive.length) { categories[cat] = null; continue; }
    categories[cat] = Math.round(100 * (decisive.filter((c) => c.status === "pass").length / decisive.length));
  }

  // Apply per-category caps.
  for (const f of critical) {
    for (const [cat, cap] of Object.entries(HARD_CAPS[f] ?? {})) {
      if (cap !== "BLOCKED" && categories[cat] != null) categories[cat] = Math.min(categories[cat], cap);
    }
  }

  // Weighted overall over EXERCISED categories only.
  let weighted = 0, weight = 0;
  for (const [cat, w] of Object.entries(CATEGORY_WEIGHTS)) {
    if (categories[cat] == null) continue;
    weighted += categories[cat] * w;
    weight += w;
  }
  const overall = weight ? Math.round(weighted / weight) : null;

  if (silentA1Override > 0) {
    // A silent A1 override makes the score INCOMPUTABLE — overall is null, never a passing number.
    return { categories, overall: null, criticalFailures: [...critical, "silentA1Override"], blocked: "silent-a1-override" };
  }
  return { categories, overall, criticalFailures: critical };
}
