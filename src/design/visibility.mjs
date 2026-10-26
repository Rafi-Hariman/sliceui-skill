// visibility — compile effective visibility + classification for a Raw Design Graph.
//
// `effective visible = own visible AND opacity > 0 AND all ancestors visible AND not fully clipped`.
// Only VISIBLE (and TRANSPARENT, a flagged-but-visible partial-opacity state) reaches semantic
// compilation; HIDDEN_* / CLIPPED nodes stay in the raw graph as evidence but are excluded from the
// implementation decision surface.
//
// Pure — returns a map + diagnostics, never mutates the raw graph (it stays lossless evidence).

export const VISIBILITY = Object.freeze([
  "VISIBLE", "HIDDEN_EXPLICIT", "HIDDEN_BY_ANCESTOR", "TRANSPARENT", "CLIPPED", "UNCERTAIN",
]);

/** @param {object} graph — buildRawGraph() output
 *  @returns {{ classifications: Map<string, {effectiveVisible:boolean, class:string, reason?:string}>, diagnostics: Array }}
 */
export function compileVisibility(graph) {
  const nodes = graph.nodes ?? {};
  const classifications = new Map();
  const diagnostics = [];

  const visit = (nodeId, ancestorVisible, clipBounds) => {
    const node = nodes[nodeId];
    if (!node) return;

    const own = node.visibility ?? {};
    const ownVisible = own.ownVisible !== false;
    const opacity = Number.isFinite(own.opacity) ? own.opacity : 1;
    const effective = ownVisible && ancestorVisible && opacity > 0 && !fullyClipped(node, clipBounds);

    let cls;
    let reason = own.reason;
    if (own.reason) cls = "HIDDEN_EXPLICIT";
    else if (opacity === 0) { cls = "HIDDEN_EXPLICIT"; reason = "opacity=0"; }
    else if (!ancestorVisible) { cls = "HIDDEN_BY_ANCESTOR"; reason = "hidden by ancestor"; }
    else if (fullyClipped(node, clipBounds)) { cls = "CLIPPED"; reason = "fully clipped by a clipsContent ancestor"; }
    else if (opacity > 0 && opacity < 1) { cls = "TRANSPARENT"; reason = `opacity ${opacity}`; }
    else cls = "VISIBLE";

    if (!ownVisible) {
      // ownVisible false always HIDDEN_EXPLICIT (regardless of ancestor)
      classifications.set(nodeId, { effectiveVisible: false, class: "HIDDEN_EXPLICIT", reason: own.reason ?? "hidden" });
    } else {
      classifications.set(nodeId, { effectiveVisible: effective, class: cls, reason });
    }

    // Thread clip bounds down: a clipsContent node clips its own subtree.
    const childClip = node.layout?.clipsContent
      ? node.absoluteBounds
      : clipBounds;
    for (const childId of node.childIds ?? []) {
      visit(childId, effective, childClip);
    }
  };

  for (const rootId of graph.rootIds ?? []) {
    visit(rootId, true, null);
  }

  return { classifications, diagnostics };
}

/** A node is fully clipped when a clipsContent ancestor's bounds do not contain it at all. */
function fullyClipped(node, clipBounds) {
  if (!clipBounds) return false;
  const b = node.absoluteBounds;
  if (!b) return false;
  const outsideX = b.x + b.w <= clipBounds.x || b.x >= clipBounds.x + clipBounds.w;
  const outsideY = b.y + b.h <= clipBounds.y || b.y >= clipBounds.y + clipBounds.h;
  return outsideX || outsideY;
}
