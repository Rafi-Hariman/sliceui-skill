// verification/style — computed-style verification with semantic style-target mapping.
//
// A design visual value is compared against the rendered COMPUTED style of the SAME semantic target
// (foreground vs foreground, background vs background, border vs border). Source CSS presence is
// never proof of effect. If the semantic correspondence is not provable, the property is UNRESOLVED
// and stays out of blocking scoring — never fabricated into a conflict (Prompt B closure item).

import { semanticTargetFor, isComparable, computedPropertyFor, SEMANTIC_TARGET } from "./semantic-style.mjs";

/** Canonicalize a color for comparison: hex lowercased; `rgb(a)` converted to hex (alpha 0 → null,
 *  matching render-geometry's transparent-is-absent rule). */
const normColor = (v) => {
  const s = String(v ?? "").trim().toLowerCase();
  if (s.startsWith("#")) return s;
  const m = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+))?\s*\)$/.exec(s);
  if (!m) return s;
  if (m[4] != null && Number(m[4]) === 0) return null;
  const hx = (n) => Math.round(Number(n)).toString(16).padStart(2, "0");
  return `#${hx(m[1])}${hx(m[2])}${hx(m[3])}`;
};

/**
 * @param {object} check — { nodeId, property, expected, node?: {role,sourceType,sourceName,selector} }
 * @param {Map<string, object>} computedStyles — nodeId → { color, backgroundColor, borderColor, … }
 * @returns {{ status:"pass"|"fail"|"unresolved"|"unverifiable", target, expected, actual, detail }}
 */
export function verifyStyle(check, computedStyles) {
  const node = check.node ?? {};
  const target = semanticTargetFor(node, check.property);
  if (!target) {
    return { status: "unresolved", target: null, expected: check.expected, actual: null, detail: `no semantic target for property "${check.property}" — not compared` };
  }
  const cssProp = computedPropertyFor(target);
  const style = computedStyles?.get(check.nodeId);
  const raw = style?.[cssProp];
  if (raw == null) {
    return { status: "unverifiable", target, expected: check.expected, actual: null, detail: `computed ${cssProp} not measurable for ${check.nodeId}` };
  }
  const actual = normColor(raw);
  const ok = actual === normColor(check.expected);
  return {
    status: ok ? "pass" : "fail", target, expected: normColor(check.expected), actual,
    detail: ok ? `${target} matches (${actual})` : `${target}: actual ${actual}, design ${normColor(check.expected)}`,
  };
}

/** Compare two computed/design values only when they resolve to the same semantic target. */
export function comparableValues(aNode, aProperty, bNode, bProperty) {
  const a = semanticTargetFor(aNode, aProperty);
  const b = semanticTargetFor(bNode, bProperty);
  return isComparable(a, b) ? a : null;
}

export { semanticTargetFor, isComparable, computedPropertyFor, SEMANTIC_TARGET };
