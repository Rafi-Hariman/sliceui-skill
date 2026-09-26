// resolution-policy — the shared vocabulary for typed resolution (PR 4).
//
// Every resolved.json group is classified by WHERE its value came from, so semantic hypotheses
// can never masquerade as design facts (the audit §12 finding: `label-custom-active` from
// corpus co-occurrence rendered identically to a literal design fact). This module owns the
// enums, the deterministic confidence tiers, and the artifact budgets — resolve/spec/
// agent-context all import from here so the vocabulary never drifts between producer and
// renderers. Pure data + pure functions; no fs.
//
// AUTHORITY MODEL (conceptual order, strongest first):
//   1 framework/build constraints → 2 verified public component API → 3 explicit design/XML
//   properties → 4 structural design relationships → 5 verified project tokens/utilities →
//   6 approved reusable visual style corpus → 7 semantic inference → 8 conservative fallback.
// resolve EMITS only the derived tiers (hint/fallback/unresolved): literal design facts stay
// in transcript.json — a resolved value is always a mapping FROM design evidence, never the
// evidence itself. The full enum is kept so evidence/provenance typing and future entries
// share one vocabulary.

/** What kind of statement a resolved entry makes about its value. */
export const CLASSIFICATIONS = Object.freeze([
  // The value implements a design fact through a documented, deterministic mapping
  // (Figma variant → btn-*, glyph metadata "sync" → FA4 fa-refresh, SPACE_BETWEEN footer →
  // [paginationAlign]="'right'"). Still a recommendation — the mapping, not the design, chose it.
  "implementation-recommendation",
  // The value is inferred from co-occurrence or color/structure semantics (icon color family,
  // corpus label pairing, search-context role). Honest but refutable.
  "semantic-hypothesis",
  // No sufficient evidence — deliberately not guessed; the fallback object carries the
  // conservative implementation.
  "unresolved",
]);

/** How much the agent may trust a resolved entry. */
export const AUTHORITIES = Object.freeze([
  "authoritative", // literal/normalized design fact with deterministic source (transcript's job)
  "verified",      // exact project capability/token verified by a machine source
  "hint",          // semantic or implementation recommendation — non-authoritative
  "fallback",      // conservative implementation because no verified mapping exists
  "unresolved",    // insufficient evidence (emitted together with authority:fallback + note)
]);

/**
 * Confidence tiers. Deterministic by rule — same inputs ⇒ same score; multiple candidates
 * cap at LOW; fallback is NONE; missing provenance can never score EXACT/HIGH (the score is
 * assigned per mapping tier below, never computed by a model).
 */
export const CONFIDENCE = Object.freeze({
  // Exact literal fact or exact case-sensitive public API (reserved — not emitted by resolve).
  EXACT: { level: "exact", score: 1.0 },
  // Deterministic metadata alias mapping (glyph/variant/name → FA class via the alias table).
  HIGH: { level: "high", score: 0.95 },
  // Strong structural relationship + verified capability (SPACE_BETWEEN footer + catalog input),
  // or status text matching the documented table + the class verified present.
  STRONG: { level: "high", score: 0.85 },
  // Name/color semantic match with supporting evidence, or single-candidate co-occurrence.
  MEDIUM: { level: "medium", score: 0.7 },
  // Ambiguous candidates — evidence exists but cannot pick.
  LOW: { level: "low", score: 0.5 },
  // Unresolved / fallback.
  NONE: { level: "none", score: 0.0 },
});

/** Named level for a numeric score (renderers print the word, not the number). */
export function confidenceLevel(score) {
  if (score >= CONFIDENCE.EXACT.score) return CONFIDENCE.EXACT.level;
  if (score >= CONFIDENCE.STRONG.score) return CONFIDENCE.STRONG.level;
  if (score >= CONFIDENCE.MEDIUM.score) return CONFIDENCE.MEDIUM.level;
  if (score >= CONFIDENCE.LOW.score) return CONFIDENCE.LOW.level;
  return CONFIDENCE.NONE.level;
}

/** Artifact budgets — provenance must not recreate the context bloat PR 1 removed. */
export const RESOLUTION_BUDGET = Object.freeze({
  maxCandidates: 3,   // per resolved property; beyond that keep the count + top 3
  maxRejected: 3,     // material rejections only
  maxEvidence: 5,     // provenance entries per side (design/project)
  resolvedJsonMaxGrowth: 3, // × baseline size on a real fixture (§22)
});

/** resolved.json artifact schema version (schema 1 = the untyped groups[] shape). */
export const RESOLVED_SCHEMA_VERSION = 2;

/**
 * The icon precedence ladder, expressed over the signals the transcript ACTUALLY carries
 * (figml-parse skips componentProperties/mainComponent as nodes — their surviving facts are
 * variantName/glyphName/description). Text/label inference is deliberately NOT a rung: a
 * button label must never beat icon metadata (PR 4 §14).
 */
export const ICON_PRECEDENCE = Object.freeze([
  { tier: "variantProperties", source: "transcript.layout.variantName", confidence: CONFIDENCE.HIGH },
  { tier: "glyphName", source: "transcript.layout.glyphName", confidence: CONFIDENCE.HIGH },
  { tier: "instanceName", source: "transcript.layout.description", confidence: CONFIDENCE.HIGH },
  { tier: "corpusExactColor", source: "conventions.ngDeepCorpus", confidence: CONFIDENCE.MEDIUM },
  { tier: "colorFamily", source: "resolve.FA_ICON_COLORS", confidence: CONFIDENCE.MEDIUM },
  { tier: "unresolved", source: null, confidence: CONFIDENCE.NONE },
]);

/**
 * PUBLIC-API PRECEDENCE (PR 4 §13 — required). When a verified public component input
 * controls a BEHAVIOR (where the pagination renders, whether the table shows its own search),
 * the component-API recommendation wins and the behavioral-::ng-deep alternative is recorded
 * as rejected with its reason. ::ng-deep stays the right tool for VISUAL detail no public
 * input controls (open-state borders, hover color, radius, internal icon sizing) — the split
 * is behavior vs visual, never "no ::ng-deep".
 *
 * This function derives behavior recommendations from the TRANSCRIPT alone (the same
 * space-between + footer evidence verify's checkTableOptions reads from the raw XML — the
 * parser keeps only "space-between" in node.justify) and verifies the input name against the
 * pilar catalog when pilar is loaded. Pure; no fs.
 *
 * @param {object} transcript — parsed transcript (layout walked for structural evidence)
 * @param {object|null} pilar — loadPilar() output; null (public install) ⇒ recommendations
 *   degrade to authority "hint" with catalog verification absent, never silently dropped.
 * @returns {Array} typed behavior-binding entries (empty when no evidence in the design)
 */
export function behaviorBindingRecommendations(transcript, pilar = null) {
  const out = [];
  // Pagination alignment: a footer frame that distributes its children (space-between) with
  // a pagination region at the frame's right edge ⇒ bind [paginationAlign]="'right'". Mirrors
  // paginationAlignRightEvidenced's parsed signal (verify.mjs) so resolve and verify agree.
  const footer = findDistributedPaginationFooter(transcript?.layout);
  if (footer) {
    const comp = pilar?.pilarComponents?.find((c) => c.selector === "uii-table");
    const input = comp?.inputs?.find((i) => i.name === "paginationAlign");
    const verified = Boolean(input);
    out.push({
      kind: "behavior",
      id: footer.nodeId,
      property: "paginationAlignment",
      classification: "implementation-recommendation",
      // AUT-001 — the top-level entry is an implementation RECOMMENDATION (the value `'right'`
      // is structurally inferred from the space-between footer), so its authority is always
      // `hint`. The VERIFIED fact — that `uii-table.paginationAlign` exists — is represented in
      // `evidence[]` below, where `authority: "verified"` labels the capability, not the pick.
      authority: "hint",
      confidence: verified ? CONFIDENCE.STRONG.score : CONFIDENCE.MEDIUM.score,
      fallbackUsed: false,
      value: "right",
      implementation: {
        category: "component-api",
        component: "uii-table",
        binding: "paginationAlign",
        expression: "[paginationAlign]=\"'right'\"",
      },
      evidence: [
        { type: "structural-design-fact", nodeId: footer.nodeId, property: "justify", value: "space-between" },
        ...(verified ? [{ type: "project-capability", source: "pilar-catalog", component: "uii-table", api: "paginationAlign", authority: "verified", default: input.default ?? null }] : []),
      ],
      rejected: [
        { value: "::ng-deep .table-footer / .ugw-pagination-container alignment override", reason: "public component input `uii-table.paginationAlign` controls this behavior — behavioral ::ng-deep alignment is rejected (never aligned reliably; 2026-09-24 report §4.4)" },
      ],
      provenance: {
        design: [{ type: "structural-design-fact", nodeId: footer.nodeId, property: "justify", value: "space-between" }],
        project: verified
          ? [{ type: "project-capability", source: "pilar-catalog", api: "paginationAlign", authority: "verified" }]
          : [{ type: "project-capability", source: "pilar-catalog", note: "catalog unavailable — binding name not machine-verified" }],
        mapping: { rule: "public-api-precedence" },
      },
    });
  }
  return out;
}

const PAGINATION_HINT = /paginat|Menampilkan\s+\d+\s*-\s*\d+\s+(?:dari|of)\s+\d+\s+data/i;

/** A footer frame that (a) distributes its children and (b) mentions the pagination region —
 *  the parsed-transcript half of verify's paginationAlignRightEvidenced signal. */
function findDistributedPaginationFooter(nodes, parentDistributed = false) {
  for (const n of nodes ?? []) {
    if (!n || typeof n !== "object") continue;
    const distributed = n.justify === "space-between" || parentDistributed;
    const content = `${n.glyphName ?? ""} ${n.description ?? ""} ${n.text ?? ""}`;
    if (distributed && PAGINATION_HINT.test(content)) {
      return { nodeId: n.id };
    }
    const deep = findDistributedPaginationFooter(n.children, distributed);
    if (deep) return deep;
  }
  return null;
}
