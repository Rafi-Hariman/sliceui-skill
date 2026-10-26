// regions — decompose a Raw Design Graph into nested candidate regions before topology
// classification. A "region" is a visible container node: an auto-layout frame, a visually
// filled/bordered container, a container of absolutely-positioned children, or a repeated cluster.
//
// Pure — no project knowledge. Produces RawDesignRegion[] with parent/child links; the topology
// classifier (topology.mjs) scores each region root against its families.

/**
 * @param {object} graph — buildRawGraph() output
 * @param {Map} classifications — compileVisibility() output
 * @returns {{ regions: Array, byRootId: Map<string, object> }}
 */
export function decomposeRegions(graph, classifications) {
  const nodes = graph.nodes ?? {};
  const regions = [];
  const byRootId = new Map();

  const isVisible = (id) => {
    const c = classifications?.get(id);
    return !c || c.effectiveVisible;
  };

  const build = (nodeId) => {
    const node = nodes[nodeId];
    if (!node) return null;
    if (!isVisible(nodeId)) return null;

    // Region root: a container (has visible children) that is an auto-layout frame, a visual
    // container, an overlay container, or a repeated cluster.
    const visibleChildren = (node.childIds ?? []).filter((id) => isVisible(id) && nodes[id]);
    if (!visibleChildren.length) return null;
    if (!isRegionRoot(node, nodes)) return null;

    const memberNodeIds = [];
    const childRegionIds = [];
    const collect = (childId) => {
      const child = nodes[childId];
      if (!child || !isVisible(childId)) return;
      if (isRegionRoot(child, nodes) && (child.childIds ?? []).some((id) => isVisible(id) && nodes[id])) {
        const childRegion = build(childId);
        if (childRegion) childRegionIds.push(childRegion.id);
        else memberNodeIds.push(childId);
      } else {
        memberNodeIds.push(childId);
        for (const gc of child.childIds ?? []) collect(gc);
      }
    };
    for (const cid of visibleChildren) collect(cid);

    const region = {
      id: `region:${nodeId}`,
      rootNodeId: nodeId,
      memberNodeIds,
      childRegionIds,
      candidateRoles: candidateRoles(node, nodes),
      candidateTopologies: [],
    };
    regions.push(region);
    byRootId.set(nodeId, region);
    return region;
  };

  for (const rootId of graph.rootIds ?? []) {
    // The root frame is a region; also descend into it in case it is a thin page wrapper.
    const rootRegion = build(rootId);
    if (!rootRegion) {
      // Root has no visible children or isn't a region root — still descend into its children.
      for (const cid of nodes[rootId]?.childIds ?? []) build(cid);
    }
  }

  return { regions, byRootId };
}

/** A node is a region root when it is a container with layout/visual/repetition signal. */
function isRegionRoot(node, nodes) {
  if (node.layout?.mode !== "NONE") return true; // auto-layout frame
  if ((node.visual?.fills ?? []).some((f) => f.visible)) return true; // filled container
  if ((node.visual?.strokes ?? []).some((s) => s.visible)) return true; // bordered container
  if (hasAbsoluteChildren(node, nodes)) return true; // overlay container
  if (isRepeatedCluster(node, nodes)) return true; // repeated rows/items
  return false;
}

function hasAbsoluteChildren(node, nodes) {
  return (node.childIds ?? []).some((id) => nodes[id]?.layout?.layoutPositioning === "ABSOLUTE");
}

/** ≥2 structurally similar visible children → a repeated cluster (rows/cards/list items). */
function isRepeatedCluster(node, nodes) {
  const kids = (node.childIds ?? []).map((id) => nodes[id]).filter(Boolean);
  const structs = kids.filter((k) => k.layout?.mode === "NONE" && (k.childIds ?? []).length >= 1);
  if (structs.length < 2) return false;
  const first = signatureOf(structs[0], nodes);
  if (!first) return false;
  return structs.filter((k) => signatureOf(k, nodes) === first).length >= 2;
}

/** A coarse structural signature (visible child source types, in order) for repetition detection. */
function signatureOf(node, nodes) {
  const types = (node.childIds ?? [])
    .map((id) => nodes[id])
    .filter(Boolean)
    .map((c) => c.sourceType)
    .join(",");
  return types || null;
}

/** Lightweight role candidates from source type + geometry (no project vocabulary). */
function candidateRoles(node, nodes) {
  const roles = [];
  const tag = String(node.sourceType ?? "").toLowerCase();
  const name = String(node.sourceName ?? "").toLowerCase();
  if (/text/i.test(tag)) roles.push("TEXT");
  else if (/button|btn/i.test(name) || /button/i.test(tag)) roles.push("BUTTON");
  else if (/field|input|select|dropdown|search|pencarian/i.test(name)) roles.push("FIELD");
  else if (/table|datatable|datagrid|grid/i.test(name)) roles.push("TABLE");
  else if (/information|alert|info/i.test(name)) roles.push("CARD");
  else if (/toolbar|search/i.test(name)) roles.push("TOOLBAR");
  else if (/pagination|footer/i.test(name)) roles.push("PAGINATION");
  return roles;
}
