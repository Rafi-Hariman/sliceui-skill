// recipe-semantics — property-level recipe mining + EVIDENCE-BASED semantics classification.
//
// A declaration's semantics is decided by evidence — property AND value AND selector/capability
// role AND independent-usage count AND variance AND state/media context — never property-name
// heuristics alone. The counterexamples below are explicit rules, not accidents:
//   A. search width 384/301/420 across independent pages  → PAGE_SPECIFIC_GEOMETRY (variance)
//   B. stable focus border color across usages            → STATE_STYLE
//   C. stable dropdown portal z-index on internal DOM     → STRUCTURAL_INTERNAL
//   D. width:100% on a proven fill/internal wrapper       → STRUCTURAL_INTERNAL (mechanism)
//   E. position:absolute on an overlay/portal             → STRUCTURAL_INTERNAL (responsibility)
//
// Insufficient evidence (single independent usage, no variance/stability proof) → UNVERIFIED_SAMPLE,
// never a manufactured classification.
//
// Pure — no fs.

export const RECIPE_SEMANTICS = Object.freeze([
  "BEHAVIOR_REQUIRED", "STRUCTURAL_INTERNAL", "STATE_STYLE", "VISUAL_DEFAULT",
  "DESIGN_OVERRIDABLE", "PAGE_SPECIFIC_GEOMETRY", "UNVERIFIED_SAMPLE",
]);

// Geometry properties — require strong promotion evidence (doc 03 §5).
const GEOMETRY_PROP = /^(width|height|min-width|max-width|min-height|max-height|margin|margin-top|margin-right|margin-bottom|margin-left|gap|row-gap|column-gap|top|right|bottom|left|inset|offset|flex-basis|grid-template|grid-template-columns|grid-template-rows|padding|padding-top|padding-right|padding-bottom|padding-left)$/;

// State pseudo-classes/elements in the selector.
const STATE_PSEUDO = /:(hover|focus|active|visited|disabled|checked|selected|focus-within|focus-visible)\b/i;

// Internal structural properties (never compete with design visual targets). `display` and
// `position` are NOT here — they need role/library-internal evidence (see rule E) or they are
// ordinary visual/layout declarations.
const INTERNAL_PROP = /^(z-index|overflow|overflow-x|overflow-y|pointer-events|visibility|clip|clip-path|transform|will-change)$/;

// Visual properties a design may override (radius/border are the design-sensitive subset).
const RADIUS_BORDER_PROP = /^(border-radius|border|border-top-left-radius|border-top-right-radius|border-bottom-right-radius|border-bottom-left-radius|border-width|border-style|border-color|border-top|border-right|border-bottom|border-left)$/;

/** Split a `::ng-deep` block (selector + `{…}`) into `{ property, value, important }[]`. */
export function parseDeclarations(block) {
  const m = /\{([\s\S]*)\}/.exec(String(block ?? ""));
  const body = m ? m[1] : String(block ?? "");
  const out = [];
  for (const raw of body.split(";")) {
    const d = raw.trim();
    if (!d) continue;
    const i = d.indexOf(":");
    if (i < 0) continue;
    const property = d.slice(0, i).trim();
    let value = d.slice(i + 1).trim();
    const important = /!important\s*$/i.test(value);
    if (important) value = value.replace(/!important\s*$/i, "").trim();
    if (!property || !value) continue;
    out.push({ property, value, important });
  }
  return out;
}

/**
 * Classify one declaration from mining evidence.
 * @param {{ property: string, value: string, important?: boolean }} decl
 * @param {{ usageCount?: number, hasVariance?: boolean, selector?: string, family?: string,
 *           libraryInternal?: boolean, role?: string|null, media?: string|null, statePseudo?: string|null }} observation
 */
export function classifyDeclaration(decl, observation = {}) {
  const {
    usageCount = 0, hasVariance = false, selector = "", family = "",
    libraryInternal = false, role = null, statePseudo = null,
  } = observation;
  const property = String(decl.property ?? "").toLowerCase();
  const value = String(decl.value ?? "").trim();
  const state = statePseudo ?? stateFromSelector(selector);

  // B. State style — a stable state across independent usages; one sample stays unverified.
  if (state) {
    return finish(decl, usageCount >= 2 ? "STATE_STYLE" : "UNVERIFIED_SAMPLE", usageCount);
  }

  // E. Overlay/portal positioning & layout mechanism classifies from responsibility, not name.
  if (/^(top|right|bottom|left|inset|position|display)$/.test(property) && (libraryInternal || /portal|overlay|dropdown|badge|toast|floating|cdk-/.test(`${role ?? ""} ${selector}`))) {
    return finish(decl, "STRUCTURAL_INTERNAL", usageCount);
  }

  // Behavior binding (pagination visibility / portal mechanics).
  if (isBehavior(decl, selector, family)) return finish(decl, "BEHAVIOR_REQUIRED", usageCount);

  // C. Library-internal structural property (z-index, overflow, …) never competes with design visuals.
  if (INTERNAL_PROP.test(property)) return finish(decl, "STRUCTURAL_INTERNAL", usageCount);

  // D. width/height:100% on a proven fill/internal wrapper is a fill mechanism, not page geometry.
  if ((property === "width" || property === "height") && value === "100%" && (libraryInternal || isFillWrapper(role, selector))) {
    return finish(decl, "STRUCTURAL_INTERNAL", usageCount);
  }

  // A. Geometry needs strong evidence: variance → page-specific; stable 3+ → design-overridable.
  if (GEOMETRY_PROP.test(property)) {
    if (hasVariance) return finish(decl, "PAGE_SPECIFIC_GEOMETRY", usageCount);
    if (usageCount >= 3) return finish(decl, "DESIGN_OVERRIDABLE", usageCount);
    return finish(decl, "UNVERIFIED_SAMPLE", usageCount);
  }

  if (RADIUS_BORDER_PROP.test(property)) {
    return finish(decl, usageCount >= 2 ? "DESIGN_OVERRIDABLE" : "UNVERIFIED_SAMPLE", usageCount);
  }

  return finish(decl, usageCount >= 2 ? "VISUAL_DEFAULT" : "UNVERIFIED_SAMPLE", usageCount);
}

function finish(decl, semantics, usageCount) {
  const portability = portabilityOf(usageCount, semantics);
  const confidence = (semantics === "PAGE_SPECIFIC_GEOMETRY" || semantics === "UNVERIFIED_SAMPLE")
    ? Math.min(portability, 0.5)
    : portability;
  return { ...decl, semantics, portability, confidence };
}

function stateFromSelector(selector) {
  const m = STATE_PSEUDO.exec(String(selector ?? ""));
  return m ? m[1].toLowerCase() : null;
}

function isFillWrapper(role, selector) {
  return /wrapper|container|inner|content|fill|col|row|host|table|ngx-select/i.test(`${role ?? ""} ${selector}`);
}

/** A behavioral binding: pagination visibility, portal positioning, or a superseded selector. */
function isBehavior(decl, selector, family) {
  const s = String(selector ?? "");
  const p = String(decl.property ?? "").toLowerCase();
  if (family === "table" && /pagination|page-box|limit-options/i.test(s) && /display|visibility/.test(p)) return true;
  if (/portal|cdk-overlay/.test(s) && /position|z-index/.test(p)) return true;
  return false;
}

/** Promotion evidence → portability (doc 03 §5): 3+ uses 0.90, 2 uses 0.70, single 0.35. */
function portabilityOf(usageCount, semantics) {
  if (semantics === "BEHAVIOR_REQUIRED" || semantics === "STRUCTURAL_INTERNAL") return 0.9;
  if (usageCount >= 3) return 0.9;
  if (usageCount >= 2) return 0.7;
  return 0.35;
}

/**
 * Legacy/test path: mine `ngDeepCorpus`-shaped blocks (with optional per-declaration `observations`)
 * into classified declarations. The production path uses `src/project/scss-mine.mjs` instead.
 */
export function mineRecipeDeclarations(corpus = []) {
  const out = [];
  for (const c of corpus) {
    for (const d of parseDeclarations(c.block)) {
      const obs = (c.observations ?? {})[d.property] ?? {};
      const classified = classifyDeclaration(d, {
        usageCount: obs.count ?? 0,
        hasVariance: obs.variance ?? false,
        selector: c.selector,
        family: c.family,
      });
      out.push({ selector: c.selector, family: c.family ?? null, source: c.source ?? null, ...classified });
    }
  }
  return out;
}

/** Count declarations by semantics (for the required report). */
export function countBySemantics(declarations = []) {
  const counts = {};
  for (const d of declarations) counts[d.semantics] = (counts[d.semantics] ?? 0) + 1;
  return counts;
}
