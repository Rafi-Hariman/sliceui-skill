// verification/semantic-style — semantic style-target mapping (Prompt B closure item, Prompt C use).
//
// A visual property must be compared against the RENDER target that means the same thing: a
// foreground text color is not a background, a border color is not an icon fill. This maps a design
// node + a property to a semantic target, and the style verifier only compares two values when both
// resolve to the SAME target. If the correspondence is not provable, the value is UNRESOLVED —
// never fabricated into a conflict, and kept out of blocking fidelity scoring.

export const SEMANTIC_TARGET = Object.freeze({
  FOREGROUND: "foreground-text",
  PLACEHOLDER: "placeholder",
  BACKGROUND: "background",
  BORDER: "border",
  ICON: "icon-fill",
  STATE: "state-color",
  INHERITED: "inherited",
});

/**
 * Resolve the semantic target of a planned visual property for a design node.
 * @param {{ role?: string, sourceType?: string, sourceName?: string, selector?: string }} node
 * @param {string} property — CSS property (`color`, `background-color`, `border-color`, …)
 * @returns {string|null} a SEMANTIC_TARGET value, or null when unresolvable.
 */
export function semanticTargetFor(node = {}, property) {
  const prop = String(property ?? "").toLowerCase();
  const role = String(node.role ?? node.sourceType ?? "").toLowerCase();
  const name = String(node.sourceName ?? "").toLowerCase();
  const selector = String(node.selector ?? "");

  // State: hover/focus/active/selected color is a distinct semantic target.
  if (/:(hover|focus|active|visited|selected|focus-within|focus-visible)\b/i.test(selector) || /_(active|selected|disabled)$/i.test(name)) {
    return SEMANTIC_TARGET.STATE;
  }
  if (/background|^bg$/.test(prop)) return SEMANTIC_TARGET.BACKGROUND;
  if (/border/.test(prop)) return SEMANTIC_TARGET.BORDER;
  if (prop === "color" || prop === "fill" || prop === "stroke") {
    if (role === "icon" || /icon|vector|glyph/i.test(name)) return SEMANTIC_TARGET.ICON;
    if (/placeholder|hint|helper/i.test(role) || /placeholder/i.test(name)) return SEMANTIC_TARGET.PLACEHOLDER;
    return SEMANTIC_TARGET.FOREGROUND;
  }
  if (/inherit/.test(prop)) return SEMANTIC_TARGET.INHERITED;
  return null; // unresolvable — do not compare
}

/** Two values are comparable only when they resolve to the same semantic target. */
export function isComparable(aTarget, bTarget) {
  return Boolean(aTarget) && aTarget === bTarget;
}

/** The computed-style property to read for a semantic target (the browser side of the mapping). */
export function computedPropertyFor(target) {
  switch (target) {
    case SEMANTIC_TARGET.FOREGROUND: return "color";
    case SEMANTIC_TARGET.PLACEHOLDER: return "placeholderColor"; // the ::placeholder pseudo-element — distinct from the input's own color
    case SEMANTIC_TARGET.STATE: return "color";
    case SEMANTIC_TARGET.BACKGROUND: return "backgroundColor";
    case SEMANTIC_TARGET.BORDER: return "borderColor";
    case SEMANTIC_TARGET.ICON: return "color"; // icon glyphs paint via color/fill
    default: return null;
  }
}
