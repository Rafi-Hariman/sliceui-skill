// design-geometry — extract the design's EXPLICIT geometry facts from the Raw Design Graph, as the
// A1 truth the recipe merger compares project declarations against. Only facts the design states
// explicitly (a FIXED/HUG dimension, a radius, a visible fill color) are extracted — a FILL node's
// width is parent-determined, not a design target, so it is not an A1 width.
//
// Pure — no project knowledge.

/**
 * @param {object} rawGraph — buildRawGraph() output
 * @param {Map} [classifications] — compileVisibility() output
 * @param {object} [intentGraph] — buildDesignIntentGraph() output (for node→capability roles)
 * @returns {Record<string, { width?: number, height?: number, radius?: number, color?: string, capability?: string }>}
 */
export function extractDesignGeometry(rawGraph, classifications, intentGraph = null) {
  const capability = nodeCapabilities(intentGraph, rawGraph);
  const nodes = {};
  for (const [id, n] of Object.entries(rawGraph.nodes ?? {})) {
    const c = classifications?.get(id);
    if (c && !c.effectiveVisible) continue;
    const g = {};
    const sizingH = n.layout?.horizontalSizing;
    const sizingV = n.layout?.verticalSizing;
    if ((sizingH === "FIXED" || sizingH === "HUG") && n.bounds?.w > 0) g.width = n.bounds.w;
    if ((sizingV === "FIXED" || sizingV === "HUG") && n.bounds?.h > 0) g.height = n.bounds.h;
    if (typeof n.visual?.radius === "number") g.radius = n.visual.radius;
    // Foreground `color` only from TEXT nodes — a frame/instance's fill is a background, which must
    // not be compared against a recipe's `color` (foreground) declaration.
    const fill = (n.visual?.fills ?? []).find((f) => f.visible);
    if (fill?.color && n.sourceType === "Text") g.color = fill.color;
    if (Object.keys(g).length) nodes[id] = { ...g, capability: capability.get(id) ?? "container" };
  }
  return nodes;
}

/** A node → capability family map (table/form/button/icon), so the merger can match a recipe
 *  (`.form-control`, family form) to the DESIGN NODE it targets, never to an unrelated table. */
function nodeCapabilities(intentGraph, rawGraph) {
  const cap = new Map();
  for (const t of intentGraph?.tables ?? []) cap.set(t.tableNodeId, "table");
  for (const n of intentGraph?.nodes ?? []) {
    if (n.role === "FIELD" || n.role === "SELECT") cap.set(n.id, "form");
    else if (n.role === "BUTTON") cap.set(n.id, "button");
    else if (n.role === "ICON") cap.set(n.id, "icon");
    else if (n.role === "TABLE") cap.set(n.id, "table");
  }
  for (const [id, n] of Object.entries(rawGraph?.nodes ?? {})) {
    if (cap.has(id)) continue;
    const name = String(n.sourceName ?? "").toLowerCase();
    const type = String(n.sourceType ?? "").toLowerCase();
    if (/table|datatable|grid/i.test(name)) cap.set(id, "table");
    else if (/field|input|select|dropdown|search|pencarian/i.test(name)) cap.set(id, "form");
    else if (/button|btn/i.test(name)) cap.set(id, "button");
    else if (/icon|vector/i.test(name) || /icon|vector/i.test(type)) cap.set(id, "icon");
  }
  return cap;
}

/** The design geometry key a recipe declaration's property competes with (null = no A1 competition).
 *  `color` is deliberately NOT merged at the property level: a recipe's `color` (foreground) cannot
 *  be reliably matched to the design's fill/text color without element-level (browser) evidence —
 *  that resolution is Prompt C's job. */
export function designGeometryKey(property) {
  const p = String(property ?? "").toLowerCase();
  if (/^(width|min-width|max-width|inline-size)$/.test(p)) return "width";
  if (/^(height|min-height|max-height|block-size)$/.test(p)) return "height";
  if (/radius$/.test(p)) return "radius";
  return null;
}

/** Compare a recipe value against a design value for the same property (numeric for length/radius). */
export function valuesDiffer(recipeValue, designValue, property) {
  const p = String(property ?? "").toLowerCase();
  const r = num(recipeValue);
  const d = num(designValue);
  if (r != null && d != null) return r !== d;
  return String(recipeValue).trim() !== String(designValue).trim();
}

function num(v) {
  const m = /-?\d+(?:\.\d+)?/.exec(String(v ?? ""));
  return m ? Number(m[0]) : null;
}
