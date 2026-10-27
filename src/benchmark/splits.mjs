// benchmark/splits — development / validation / holdout splitting + leakage detection (section 4).
//
// Compiler heuristics and recipe rules may be tuned on the DEVELOPMENT set only. Validation measures
// iteration quality. Holdout scores are computed by the runner but must never influence a
// fixture-specific rule. Leakage detection checks that no generic rule source embeds a holdout
// member's identifier, filename, selector, copy text, dimension, or project path.

/** Deterministic split key for a member id (stable across runs, independent of array order). */
export function hashId(id) {
  let h = 0;
  for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
}

export const SPLITS = Object.freeze({ DEVELOPMENT: "development", VALIDATION: "validation", HOLDOUT: "holdout" });

/** Assign each member to development / validation / holdout by a deterministic id hash. */
export function splitEntries(entries = [], { devRatio = 0.7, valRatio = 0.15 } = {}) {
  const sorted = [...entries].sort((a, b) => String(a.id).localeCompare(String(b.id)));
  // Size-independent bucket: `% 100` keeps a member's dev/val/holdout assignment stable as the
  // corpus grows (a member must not silently migrate splits when another member is added).
  return sorted.map((e) => {
    const bucket = hashId(e.id) % 100;
    const split = bucket < 100 * devRatio ? SPLITS.DEVELOPMENT
      : bucket < 100 * (devRatio + valRatio) ? SPLITS.VALIDATION
        : SPLITS.HOLDOUT;
    return { ...e, split };
  });
}

/** Identifying tokens a holdout member's identity (what a rule must NOT embed). */
export function identifyTokens(member) {
  const tokens = new Set([member.id]);
  if (member.sourceInput) tokens.add(member.sourceInput);
  for (const t of [...(member.selectorTokens ?? []), ...(member.copyTextTokens ?? []), ...(member.dimensionTokens ?? []), ...(member.projectPathTokens ?? [])]) {
    if (t) tokens.add(String(t));
  }
  return [...tokens];
}

/** Report every holdout token that appears verbatim in a rule/recipe source (leakage). */
export function detectLeakage(holdoutMembers = [], ruleSources = []) {
  const findings = [];
  for (const m of holdoutMembers) {
    for (const tok of identifyTokens(m)) {
      for (const src of ruleSources) {
        if (tok && String(src).includes(tok)) findings.push({ memberId: m.id, token: tok });
      }
    }
  }
  return findings;
}

/** Case/whitespace/path normalization for normalized leakage checks (section 5). */
export function normalizeToken(t) {
  return String(t ?? "")
    .replace(/\\/g, "/")
    .replace(/[_\-\s]+/g, " ")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** A dimension token normalized for rounded/reformatted matching (e.g. "0.50px" → "0.5px"). */
export function normalizeDimension(t) {
  const s = String(t ?? "").trim().toLowerCase();
  const m = /^(-?\d+(?:\.\d+)?)(px|%|rem|em|vw|vh)?$/.exec(s);
  if (!m) return normalizeToken(s);
  return `${parseFloat(parseFloat(m[1]).toFixed(4))}${m[2] ?? ""}`;
}

/** Normalized leakage: a rule source embedding a holdout token even after case/whitespace/path or
 *  dimension renormalization. Static-only — procedural holdout blindness is not implemented, so
 *  holdout integrity is PARTIALLY enforced, never proven. */
export function detectLeakageNormalized(holdoutMembers = [], ruleSources = []) {
  const findings = [];
  const norm = (t) => /^-?\d+(\.\d+)?(px|%|rem|em|vw|vh)?$/.test(String(t ?? "").trim().toLowerCase()) ? normalizeDimension(t) : normalizeToken(t);
  for (const m of holdoutMembers) {
    for (const tok of identifyTokens(m)) {
      const n = norm(tok);
      for (const src of ruleSources) {
        if (n && normalizeToken(src).includes(n)) findings.push({ memberId: m.id, token: tok, normalized: n });
      }
    }
  }
  return findings;
}
