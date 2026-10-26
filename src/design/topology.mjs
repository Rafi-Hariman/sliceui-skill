// topology — topology classifier plugin interface + resolver + production compilers.
//
// Four production families in Prompt A (LINEAR, GRID, REPEATED, OVERLAY); the rest are honest
// stubs (`supports → 0`). Each compiler is a plain object implementing:
//   { id, family, supports(region, ctx) -> number, compile(region, ctx) -> result }
// Multiple compilers may score a region; the resolver picks the highest score, breaking ties by
// family specificity (REPEATED > GRID > OVERLAY > LINEAR) — a repeated list beats a plain row.
//
// REPEATED is detected GEOMETRICALLY (a vertical stack of full-width, flush/evenly-spaced items),
// NOT by content signature — a form's filter row of 3 structurally-identical fields is a LINEAR row,
// while a table's header + data rows are a vertical stack. This mirrors the existing table detector
// (`isTableRows`) and keeps distinct-but-identical form fields from being misread as a list.
//
// Pure — no project knowledge.

import { derive, deriveSizing, deriveAlignment, deriveSiblingRatios, deriveItemDistances, deriveOrder, deriveAnchor, deriveGridTracks, tolerance, near } from "./constraints.mjs";

export const TOPOLOGY_FAMILIES = Object.freeze([
  "LINEAR", "GRID", "REPEATED", "OVERLAY", "SCROLL", "STICKY", "STATE_VARIANT", "RESPONSIVE_VARIANT", "DATA_VISUALIZATION", "FREEFORM",
]);

const TIE_PRIORITY = ["REPEATED", "GRID", "OVERLAY", "LINEAR"];

// ---------- shared context helpers ----------

function makeContext(graph, classifications) {
  return { graph, classifications, nodes: graph.nodes ?? {} };
}

function visibleChildren(node, ctx) {
  return (node.childIds ?? [])
    .map((id) => ctx.nodes[id])
    .filter((c) => c && isVisible(c.id, ctx));
}

function isVisible(id, ctx) {
  const c = ctx.classifications?.get(id);
  return !c || c.effectiveVisible;
}

/** Children with real area (exclude zero-size guides like the table's divider line). */
function areaChildren(node, ctx) {
  return visibleChildren(node, ctx).filter((c) => c.absoluteBounds.w > 0 && c.absoluteBounds.h > 0);
}

function signatureOf(node, ctx) {
  return (node.childIds ?? [])
    .map((id) => ctx.nodes[id])
    .filter((c) => c && isVisible(c.id, ctx))
    .map((c) => c.sourceType)
    .join(",");
}

function childrenOnSameAxis(children, axis) {
  if (children.length < 2) return false;
  const tol = tolerance(Math.max(...children.map((c) => (axis === "x" ? c.absoluteBounds.h : c.absoluteBounds.w))));
  const coord = axis === "x" ? (b) => b.y + b.h / 2 : (b) => b.x + b.w / 2;
  const first = coord(children[0].absoluteBounds);
  return children.every((c) => near(coord(c.absoluteBounds), first, tol));
}

/** A repeated stack: ≥3 children with the SAME height, same x, same width, stacked with consistent
 *  (flush/even) y gaps. The height-uniformity requirement is what separates a repeated list/table
 *  (uniform rows) from a vertical page layout (title/card/form/table sections of varying height). */
function isRepeatedStack(children) {
  if (children.length < 3) return false;
  const byHeight = new Map();
  for (const c of children) {
    const h = Math.round(c.absoluteBounds.h);
    (byHeight.get(h) ?? byHeight.set(h, []).get(h)).push(c);
  }
  for (const group of byHeight.values()) {
    if (group.length < 3) continue;
    if (verticallyStacked(group)) return true;
  }
  return false;
}

function verticallyStacked(children) {
  if (children.length < 2) return false;
  const sorted = [...children].sort((a, b) => a.absoluteBounds.y - b.absoluteBounds.y);
  const first = sorted[0].absoluteBounds;
  const tolX = tolerance(first.w);
  let prevBottom = first.y + first.h;
  const gaps = [];
  for (let i = 1; i < sorted.length; i++) {
    const b = sorted[i].absoluteBounds;
    if (!near(b.x, first.x, tolX) || !near(b.w, first.w, tolX)) return false;
    gaps.push(b.y - prevBottom);
    prevBottom = b.y + b.h;
  }
  const g0 = gaps[0];
  const tol = Math.max(2, Math.abs(g0) * 0.25);
  return gaps.every((g) => near(g, g0, tol));
}

// ---------- LINEAR ----------

const linearCompiler = {
  id: "linear",
  family: "LINEAR",
  supports(region, ctx) {
    const node = ctx.nodes[region.rootNodeId];
    if (!node) return 0;
    if (node.layout?.mode === "HORIZONTAL" || node.layout?.mode === "VERTICAL") {
      const kids = areaChildren(node, ctx);
      // A genuine 2D arrangement (multiple rows AND columns) is GRID, not LINEAR, even under an
      // auto-layout mode. A centered sibling's small offset stays one row.
      if (kids.length >= 2 && deriveGridTracks(kids)) return 0.2;
      return 0.8;
    }
    const kids = areaChildren(node, ctx);
    if (childrenOnSameAxis(kids, "x") || childrenOnSameAxis(kids, "y")) return 0.4;
    return 0;
  },
  compile(region, ctx) {
    const node = ctx.nodes[region.rootNodeId];
    const kids = areaChildren(node, ctx);
    const axis = node.layout?.mode === "HORIZONTAL" ? "x" : "y";
    const direction = node.layout?.mode === "HORIZONTAL" ? "HORIZONTAL" : "VERTICAL";
    const constraints = [];
    const sizing = kids.map((c) => ({ nodeId: c.id, ...deriveSizing(c, node) }));
    const alignments = kids.map((c) => ({ nodeId: c.id, ...deriveAlignment(c, node, axis, c.layout?.primaryAlignment ?? c.layout?.counterAlignment) }));
    const ratio = deriveSiblingRatios(kids, axis);
    if (ratio) constraints.push({ type: "SIBLING_RATIO", parentId: node.id, childIds: kids.map((k) => k.id), axis, ...ratio });
    const distances = deriveItemDistances(kids, axis);
    if (distances.length) constraints.push({ type: "ITEM_DISTANCE", items: distances });
    constraints.push({ type: "ORDER", childIds: deriveOrder(kids) });
    return {
      family: "LINEAR",
      direction,
      confidence: 0.8,
      sizing,
      alignments,
      constraints,
      evidence: [{ nodeId: node.id, signal: `layout.mode=${node.layout?.mode}` }],
      diagnostics: [],
    };
  },
};

// ---------- GRID ----------

const gridCompiler = {
  id: "grid",
  family: "GRID",
  supports(region, ctx) {
    const node = ctx.nodes[region.rootNodeId];
    if (!node) return 0;
    const kids = areaChildren(node, ctx);
    if (kids.length < 2 || isRepeatedStack(kids)) return 0;
    return deriveGridTracks(kids) ? 0.7 : 0;
  },
  compile(region, ctx) {
    const node = ctx.nodes[region.rootNodeId];
    const kids = areaChildren(node, ctx);
    const tracks = deriveGridTracks(kids);
    return {
      family: "GRID",
      confidence: 0.7,
      tracks: tracks?.value,
      constraints: [{ type: "GRID_TRACKS", ...tracks }],
      evidence: [{ nodeId: node.id, signal: "2D-grid" }],
      diagnostics: [],
    };
  },
};

// ---------- REPEATED ----------

const repeatedCompiler = {
  id: "repeated",
  family: "REPEATED",
  supports(region, ctx) {
    const node = ctx.nodes[region.rootNodeId];
    if (!node) return 0;
    const kids = areaChildren(node, ctx);
    if (kids.length < 3) return 0;
    return isRepeatedStack(kids) ? 0.85 : 0;
  },
  compile(region, ctx) {
    const node = ctx.nodes[region.rootNodeId];
    const kids = areaChildren(node, ctx);
    const template = dominantSignature(kids, ctx);
    return {
      family: "REPEATED",
      confidence: 0.85,
      templateSignature: template,
      repeatedNodeIds: kids.map((k) => k.id),
      repeatedCount: kids.length,
      constraints: [{ type: "REPEATS_TEMPLATE", templateSignature: template, nodeIds: kids.map((k) => k.id) }],
      evidence: [{ nodeId: node.id, signal: `vertical-stack x${kids.length}` }],
      diagnostics: [],
    };
  },
};

function dominantSignature(kids, ctx) {
  const counts = new Map();
  for (const k of kids) {
    const s = signatureOf(k, ctx);
    if (s) counts.set(s, (counts.get(s) ?? 0) + 1);
  }
  let best = null;
  let bestN = 0;
  for (const [s, n] of counts) if (n > bestN) { bestN = n; best = s; }
  return best;
}

// ---------- OVERLAY ----------

const overlayCompiler = {
  id: "overlay",
  family: "OVERLAY",
  supports(region, ctx) {
    const node = ctx.nodes[region.rootNodeId];
    if (!node) return 0;
    if (node.layout?.layoutPositioning === "ABSOLUTE") return 0.9;
    if ((node.childIds ?? []).some((id) => ctx.nodes[id]?.layout?.layoutPositioning === "ABSOLUTE")) return 0.7;
    return 0;
  },
  compile(region, ctx) {
    const node = ctx.nodes[region.rootNodeId];
    const parent = node.parentId ? ctx.nodes[node.parentId] : null;
    const anchors = [];
    if (node.layout?.layoutPositioning === "ABSOLUTE" && parent) {
      anchors.push({ nodeId: node.id, anchorNodeId: parent.id, ...deriveAnchor(node, parent) });
    }
    for (const id of node.childIds ?? []) {
      const c = ctx.nodes[id];
      if (c?.layout?.layoutPositioning === "ABSOLUTE") anchors.push({ nodeId: c.id, anchorNodeId: node.id, ...deriveAnchor(c, node) });
    }
    return {
      family: "OVERLAY",
      confidence: 0.7,
      anchors,
      constraints: anchors.map((a) => ({ type: "ANCHOR", ...a })),
      evidence: [{ nodeId: node.id, signal: "absolute-positioning" }],
      diagnostics: [],
    };
  },
};

// ---------- stubs ----------

function stub(family) {
  return {
    id: family.toLowerCase(),
    family,
    supports: () => 0,
    compile: (region) => ({ family, confidence: 0, constraints: [], evidence: [], diagnostics: [{ code: "SUI-TOPOLOGY-UNSUPPORTED", family, nodeId: region.rootNodeId, message: `${family} is not a production compiler in this phase` }] }),
  };
}

export const COMPILERS = Object.freeze([
  repeatedCompiler, gridCompiler, overlayCompiler, linearCompiler,
  stub("SCROLL"), stub("STICKY"), stub("STATE_VARIANT"), stub("RESPONSIVE_VARIANT"), stub("DATA_VISUALIZATION"), stub("FREEFORM"),
]);

// ---------- resolver ----------

export function classifyRegion(region, ctx) {
  let best = null;
  let bestScore = -1;
  for (const compiler of COMPILERS) {
    const score = compiler.supports(region, ctx);
    if (score <= 0) continue;
    const priority = TIE_PRIORITY.indexOf(compiler.family);
    if (score > bestScore || (score === bestScore && best && priority < TIE_PRIORITY.indexOf(best.family))) {
      bestScore = score;
      best = compiler;
    }
  }
  return best ? { family: best.family, score: bestScore, compiler: best } : null;
}

/** Compile every region to its best family. Returns an array of TopologyCompileResult. */
export function compileTopologies(regions, graph, classifications) {
  const ctx = makeContext(graph, classifications);
  const results = [];
  for (const region of regions) {
    const picked = classifyRegion(region, ctx);
    if (!picked) {
      results.push({ regionId: region.id, rootNodeId: region.rootNodeId, family: "FREEFORM", confidence: 0, constraints: [], evidence: [], diagnostics: [{ code: "SUI-TOPOLOGY-UNCLASSIFIED", nodeId: region.rootNodeId, message: "no topology family scored" }] });
      continue;
    }
    const compiled = picked.compiler.compile(region, ctx);
    results.push({ regionId: region.id, rootNodeId: region.rootNodeId, family: picked.family, score: picked.score, ...compiled });
  }
  return results;
}
