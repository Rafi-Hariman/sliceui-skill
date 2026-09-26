// diagnostics — stable compiler-like diagnostic metadata for verify checks (PR 5).
//
// verify.mjs returns one record per check. Until PR 5 each record was a bare
// { name, status, detail } with no stable ID, category, severity, or trust source — so the agent
// could not cite a diagnostic programmatically, and a shared-assumption check (comparing output to
// the SAME corpus the generator copied) looked identical to an independent design-fidelity check.
//
// This module owns the check inventory metadata (id / category / trust type / severity) and the
// small pure helpers to decorate a check result. It is additive: the underlying check functions
// keep their { name, status, detail, ... } shape; verifyComponent attaches the extra fields.

/** The four evidence trust types (PR 5 §6/§27). */
export const TRUST = Object.freeze({
  // A. Independent design evidence — raw XML / transcript facts, geometry, visible text.
  LITERAL_DESIGN: "literal-design",
  // B. Verified project capability — exact catalog selector/input/output, framework version.
  VERIFIED_CAPABILITY: "verified-capability",
  // C. Shared project convention — classVocabulary, ngDeepCorpus, loadedClassRegistry, recipes.
  SHARED_ASSUMPTION: "shared-assumption",
  // D. Generated-implementation structural facts (the subject, not ground truth).
  INDEPENDENT: "independent",
});

/** Diagnostic categories — bounded, one per check family (PR 5 §12). */
export const CATEGORY = Object.freeze({
  GROUND_TRUTH: "ground-truth",
  TARGET: "target",
  FRAMEWORK_SYNTAX: "framework-syntax",
  COMPONENT_API: "component-api",
  TEMPLATE_STRUCTURE: "template-structure",
  DESIGN_FIDELITY: "design-fidelity",
  LAYOUT: "layout",
  STYLE: "style",
  SHARED_CONVENTION: "shared-convention",
  MODULE_WIRING: "module-wiring",
  AUTH_WIRING: "auth-wiring",
});

/** Severity policy (PR 5 §13). */
export const SEVERITY = Object.freeze({
  ERROR: "error",     // blocking correctness / unverifiable trust failure
  WARNING: "warning", // material risk, verification can still complete
  INFO: "info",       // non-blocking recommendation / completed pass
});

/** Stable ID prefix for verify checks. */
const PREFIX = "SUI-VERIFY";

/**
 * The check inventory: stable ID, category, and trust source for every verify check.
 * A check NOT listed here falls back to a derived entry (id from name, category "style",
 * trust "independent") — never omitted, never guessed as blocking.
 */
export const CHECK_META = Object.freeze({
  scssCompiles: { id: `${PREFIX}-SYNTAX-001`, category: CATEGORY.FRAMEWORK_SYNTAX, trust: TRUST.INDEPENDENT },
  scssCoverage: { id: `${PREFIX}-STYLE-001`, category: CATEGORY.STYLE, trust: TRUST.SHARED_ASSUMPTION },
  textCoverage: { id: `${PREFIX}-FIDELITY-001`, category: CATEGORY.DESIGN_FIDELITY, trust: TRUST.LITERAL_DESIGN },
  tableBindings: { id: `${PREFIX}-API-001`, category: CATEGORY.COMPONENT_API, trust: TRUST.VERIFIED_CAPABILITY },
  pilarBindings: { id: `${PREFIX}-API-002`, category: CATEGORY.COMPONENT_API, trust: TRUST.VERIFIED_CAPABILITY },
  deadCode: { id: `${PREFIX}-SYNTAX-002`, category: CATEGORY.FRAMEWORK_SYNTAX, trust: TRUST.INDEPENDENT },
  classVocabulary: { id: `${PREFIX}-CONVENTION-001`, category: CATEGORY.SHARED_CONVENTION, trust: TRUST.SHARED_ASSUMPTION },
  anatomy: { id: `${PREFIX}-CONVENTION-002`, category: CATEGORY.SHARED_CONVENTION, trust: TRUST.SHARED_ASSUMPTION },
  mockRowCount: { id: `${PREFIX}-CONVENTION-003`, category: CATEGORY.SHARED_CONVENTION, trust: TRUST.SHARED_ASSUMPTION },
  noHashedSelectors: { id: `${PREFIX}-SYNTAX-003`, category: CATEGORY.FRAMEWORK_SYNTAX, trust: TRUST.INDEPENDENT },
  noBareNgDeep: { id: `${PREFIX}-STYLE-002`, category: CATEGORY.STYLE, trust: TRUST.SHARED_ASSUMPTION },
  alignmentViaDeepCss: { id: `${PREFIX}-API-003`, category: CATEGORY.COMPONENT_API, trust: TRUST.VERIFIED_CAPABILITY },
  requiredMarker: { id: `${PREFIX}-FIDELITY-002`, category: CATEGORY.DESIGN_FIDELITY, trust: TRUST.LITERAL_DESIGN },
  containerPadding: { id: `${PREFIX}-FIDELITY-003`, category: CATEGORY.DESIGN_FIDELITY, trust: TRUST.LITERAL_DESIGN },
  inventedLayout: { id: `${PREFIX}-LAYOUT-001`, category: CATEGORY.LAYOUT, trust: TRUST.LITERAL_DESIGN },
  iconColor: { id: `${PREFIX}-FIDELITY-004`, category: CATEGORY.DESIGN_FIDELITY, trust: TRUST.LITERAL_DESIGN },
  phantomWrapper: { id: `${PREFIX}-STRUCTURE-001`, category: CATEGORY.TEMPLATE_STRUCTURE, trust: TRUST.LITERAL_DESIGN },
  modalWrapper: { id: `${PREFIX}-STRUCTURE-002`, category: CATEGORY.TEMPLATE_STRUCTURE, trust: TRUST.LITERAL_DESIGN },
  ngxSelectBinding: { id: `${PREFIX}-API-004`, category: CATEGORY.COMPONENT_API, trust: TRUST.VERIFIED_CAPABILITY },
  rowAuth: { id: `${PREFIX}-AUTH-001`, category: CATEGORY.AUTH_WIRING, trust: TRUST.VERIFIED_CAPABILITY },
  filterRowButton: { id: `${PREFIX}-FIDELITY-005`, category: CATEGORY.DESIGN_FIDELITY, trust: TRUST.LITERAL_DESIGN },
  buttonOrder: { id: `${PREFIX}-FIDELITY-006`, category: CATEGORY.DESIGN_FIDELITY, trust: TRUST.LITERAL_DESIGN },
  tableOptions: { id: `${PREFIX}-API-005`, category: CATEGORY.COMPONENT_API, trust: TRUST.LITERAL_DESIGN },
  gridColumns: { id: `${PREFIX}-LAYOUT-002`, category: CATEGORY.LAYOUT, trust: TRUST.INDEPENDENT },
  noTranslation: { id: `${PREFIX}-SYNTAX-004`, category: CATEGORY.FRAMEWORK_SYNTAX, trust: TRUST.INDEPENDENT },
  inventedUtility: { id: `${PREFIX}-CONVENTION-004`, category: CATEGORY.SHARED_CONVENTION, trust: TRUST.SHARED_ASSUMPTION },
  styleFidelity: { id: `${PREFIX}-FIDELITY-007`, category: CATEGORY.DESIGN_FIDELITY, trust: TRUST.LITERAL_DESIGN },
  libraryTable: { id: `${PREFIX}-API-006`, category: CATEGORY.COMPONENT_API, trust: TRUST.VERIFIED_CAPABILITY },
  loadedClass: { id: `${PREFIX}-CONVENTION-005`, category: CATEGORY.SHARED_CONVENTION, trust: TRUST.SHARED_ASSUMPTION },
  pilarInjection: { id: `${PREFIX}-API-007`, category: CATEGORY.COMPONENT_API, trust: TRUST.VERIFIED_CAPABILITY },
  declaredInModule: { id: `${PREFIX}-MODULE-001`, category: CATEGORY.MODULE_WIRING, trust: TRUST.INDEPENDENT },
  frameworkSyntax: { id: `${PREFIX}-SYNTAX-005`, category: CATEGORY.FRAMEWORK_SYNTAX, trust: TRUST.VERIFIED_CAPABILITY },
});

/** Severity for a check status (PR 5 §13): fail → error, warn → warning, pass/skip → info. A
 *  required skip escalates to unverifiable at the COMMAND level, not the check level. */
export function severityFor(status) {
  if (status === "fail") return SEVERITY.ERROR;
  if (status === "warn") return SEVERITY.WARNING;
  return SEVERITY.INFO;
}

/** Decorate a check result with its stable metadata (additive — the original fields remain). */
export function decorateCheck(check) {
  const meta = CHECK_META[check?.name] ?? {
    id: `${PREFIX}-GENERIC-${String(check?.name ?? "unknown").toUpperCase()}`,
    category: CATEGORY.STYLE,
    trust: TRUST.INDEPENDENT,
  };
  return {
    ...check,
    id: meta.id,
    category: meta.category,
    trust: meta.trust,
    severity: severityFor(check?.status),
  };
}

/** Compute the command's primary state from the decorated check set (PR 5 §7). */
export function primaryState(checks, hasGroundTruth) {
  if (checks.some((c) => c.status === "fail")) return "fail";
  if (!hasGroundTruth) return "unverifiable";
  return "pass";
}
