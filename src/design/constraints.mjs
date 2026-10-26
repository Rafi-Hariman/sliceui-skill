// constraints — shared constraint compilers over a Raw Design Graph.
//
// Every derived fact is a `DerivedIntent<T>` = { value, confidence, derivation, evidence,
// alternatives, verificationRequired }. `derivation` is EXPLICIT (FIGML metadata) | GEOMETRY
// (measured from bounds) | PATTERN (repeated structure) | INFERRED (weak heuristic).
//
// ALL geometry-derived facts use RELATIVE, translation/scale-invariant measurements (edge gaps,
// size ratios, normalized axes) — never absolute x/y. This is what makes the metamorphic
// translation/scale tests hold: move or scale the whole design and the constraints are unchanged.
//
// Pure — no project knowledge, no fs.

export const DERIVATIONS = Object.freeze(["EXPLICIT", "GEOMETRY", "PATTERN", "INFERRED"]);
export const SIZING = Object.freeze(["FILL", "HUG", "FIXED", "MIN_CONTENT", "MAX_CONTENT", "UNKNOWN"]);
export const ALIGNMENT = Object.freeze(["START", "CENTER", "END", "STRETCH", "SPACE_BETWEEN", "UNKNOWN"]);

/** Wrap a value into a DerivedIntent. */
export function derive(value, { derivation = "GEOMETRY", confidence = 0.5, evidence = [], alternatives = [], verificationRequired = false } = {}) {
  return { value, confidence, derivation, evidence, alternatives, verificationRequired };
}

/** Scale-aware tolerance: max(2px, dimension * 0.005). */
export function tolerance(dim) {
  return Math.max(2, dim * 0.005);
}

export function near(a, b, tol) {
  return Math.abs(a - b) <= tol;
}

// ---------- sizing ----------

/**
 * Derive horizontal + vertical sizing for a node against its parent.
 * Evidence precedence: explicit metadata > layoutGrow > parent AL relationship > geometry.
 */
export function deriveSizing(node, parent) {
  const horizontal = sizingAxis(node, "horizontalSizing", "primarySizingMode", "w", node, parent);
  const vertical = sizingAxis(node, "verticalSizing", "counterSizingMode", "h", node, parent);
  return { horizontal, vertical };
}

function sizingAxis(node, explicitKey, modeKey, dimKey, _n, parent) {
  const explicit = node.layout?.[explicitKey];
  if (explicit) {
    return derive(explicit, {
      derivation: "EXPLICIT",
      confidence: 0.95,
      evidence: [ev(node.id, `layout.${explicitKey}`, explicit)],
    });
  }
  if (node.layout?.grow) {
    return derive("FILL", {
      derivation: "GEOMETRY",
      confidence: 0.85,
      evidence: [ev(node.id, "layout.grow", node.layout.grow)],
      alternatives: [derive("HUG", { derivation: "INFERRED", confidence: 0.3 })],
    });
  }
  // Geometry: fill when the node's main-axis extent matches the parent's (within tolerance).
  if (parent) {
    const childDim = dimKey === "w" ? node.absoluteBounds.w : node.absoluteBounds.h;
    const parentDim = dimKey === "w" ? parent.absoluteBounds.w : parent.absoluteBounds.h;
    if (parentDim > 0 && childDim > 0 && near(childDim, parentDim, tolerance(parentDim))) {
      return derive("FILL", {
        derivation: "GEOMETRY",
        confidence: 0.6,
        evidence: [ev(node.id, "geometry", `${dimKey}:${childDim}~=${parentDim}`)],
      });
    }
  }
  return derive("UNKNOWN", { derivation: "INFERRED", confidence: 0.2, evidence: [] });
}

// ---------- alignment ----------

/** Parent-relative alignment on an axis (X = horizontal, Y = vertical), from edges or explicit metadata. */
export function deriveAlignment(child, parent, axis, explicitValue) {
  if (explicitValue) {
    return derive(explicitValue, {
      derivation: "EXPLICIT",
      confidence: 0.9,
      evidence: [ev(child.id, "layout.alignment", explicitValue)],
    });
  }
  const c = child.absoluteBounds;
  const p = parent?.absoluteBounds;
  if (!p || !c) return derive("UNKNOWN", { derivation: "INFERRED", confidence: 0.1 });

  const tol = tolerance(axis === "x" ? p.w : p.h);
  if (axis === "x") {
    const leftGap = c.x - p.x;
    const rightGap = (p.x + p.w) - (c.x + c.w);
    const stretch = near(c.w, p.w, tol);
    if (stretch) return derive("STRETCH", { derivation: "GEOMETRY", confidence: 0.8, evidence: [ev(child.id, "edgeGap", `l:${r1(leftGap)} r:${r1(rightGap)}`)]});
    if (near(leftGap, rightGap, tol)) return derive("CENTER", { derivation: "GEOMETRY", confidence: 0.7, evidence: [ev(child.id, "edgeGap", `l~r:${r1(leftGap)}`)]});
    if (near(rightGap, 0, tol)) return derive("END", { derivation: "GEOMETRY", confidence: 0.75, evidence: [ev(child.id, "edgeGap", `r:${r1(rightGap)}`)]});
    if (near(leftGap, 0, tol)) return derive("START", { derivation: "GEOMETRY", confidence: 0.75, evidence: [ev(child.id, "edgeGap", `l:${r1(leftGap)}`)]});
  } else {
    const topGap = c.y - p.y;
    const bottomGap = (p.y + p.h) - (c.y + c.h);
    const stretch = near(c.h, p.h, tol);
    if (stretch) return derive("STRETCH", { derivation: "GEOMETRY", confidence: 0.8, evidence: [ev(child.id, "edgeGap", `t:${r1(topGap)} b:${r1(bottomGap)}`)]});
    if (near(topGap, bottomGap, tol)) return derive("CENTER", { derivation: "GEOMETRY", confidence: 0.7, evidence: [ev(child.id, "edgeGap", `t~b:${r1(topGap)}`)]});
    if (near(bottomGap, 0, tol)) return derive("END", { derivation: "GEOMETRY", confidence: 0.75, evidence: [ev(child.id, "edgeGap", `b:${r1(bottomGap)}`)]});
    if (near(topGap, 0, tol)) return derive("START", { derivation: "GEOMETRY", confidence: 0.75, evidence: [ev(child.id, "edgeGap", `t:${r1(topGap)}`)]});
  }
  return derive("UNKNOWN", { derivation: "INFERRED", confidence: 0.1 });
}

// ---------- sibling ratio ----------

/** Main-axis sibling ratio for a set of same-axis siblings. Normalized so the smallest is 1. */
export function deriveSiblingRatios(children, axis) {
  const dims = children.map((c) => (axis === "x" ? c.absoluteBounds.w : c.absoluteBounds.h));
  if (dims.length < 2 || dims.some((d) => d <= 0)) return null;
  const min = Math.min(...dims);
  const tol = tolerance(axis === "x" ? Math.max(...dims) : Math.max(...dims));
  const ratios = dims.map((d) => {
    const r = d / min;
    // Rationalize to the nearest simple ratio within tolerance.
    return rationalize(r);
  });
  return derive(ratios, {
    derivation: "GEOMETRY",
    confidence: dims.every((d) => near(d, min, tol)) ? 0.85 : 0.6,
    evidence: children.map((c, i) => ev(c.id, "mainSize", `${r1(dims[i])}`)),
  });
}

function rationalize(r) {
  const candidates = [1, 2, 3, 4, 5, 6, 1.5, 2.5, 0.5, 0.333, 0.25];
  let best = candidates[0];
  let bestErr = Infinity;
  for (const c of candidates) {
    const err = Math.abs(r - c);
    if (err < bestErr) { bestErr = err; best = c; }
  }
  return best;
}

// ---------- item distance (spacing) ----------

/** Rendered-distance relationship between consecutive siblings on an axis. */
export function deriveItemDistances(children, axis) {
  const out = [];
  for (let i = 1; i < children.length; i++) {
    const prev = children[i - 1].absoluteBounds;
    const next = children[i].absoluteBounds;
    const dist = axis === "x" ? next.x - (prev.x + prev.w) : next.y - (prev.y + prev.h);
    out.push({
      fromNodeId: children[i - 1].id,
      toNodeId: children[i].id,
      axis,
      expected: r1(dist),
      source: "GEOMETRY_DERIVED",
    });
  }
  return out;
}

// ---------- relative size ----------

export function deriveRelativeSize(child, parent, axis) {
  if (!parent?.absoluteBounds || !child?.absoluteBounds) return null;
  const c = axis === "x" ? child.absoluteBounds.w : child.absoluteBounds.h;
  const p = axis === "x" ? parent.absoluteBounds.w : parent.absoluteBounds.h;
  if (p <= 0) return null;
  return derive(r1(c / p), {
    derivation: "GEOMETRY",
    confidence: 0.8,
    evidence: [ev(child.id, "relativeSize", `${r1(c)}/${r1(p)}`)],
  });
}

// ---------- order / containment ----------

export function deriveOrder(children) {
  return children.map((c) => c.id);
}

export function deriveContainment(child, parent) {
  if (!child?.absoluteBounds || !parent?.absoluteBounds) return null;
  const c = child.absoluteBounds;
  const p = parent.absoluteBounds;
  const inside = c.x >= p.x - 1 && c.y >= p.y - 1 && (c.x + c.w) <= (p.x + p.w) + 1 && (c.y + c.h) <= (p.y + p.h) + 1;
  return derive(inside, { derivation: "GEOMETRY", confidence: 0.9, evidence: [ev(child.id, "contained", inside)] });
}

// ---------- overlay anchor ----------

/** Anchor edge/corner of an absolutely-positioned child against its parent. */
export function deriveAnchor(child, parent) {
  const c = child?.absoluteBounds;
  const p = parent?.absoluteBounds;
  if (!c || !p) return null;
  const tol = tolerance(Math.max(p.w, p.h));
  const rightGap = (p.x + p.w) - (c.x + c.w);
  const leftGap = c.x - p.x;
  const bottomGap = (p.y + p.h) - (c.y + c.h);
  const topGap = c.y - p.y;

  const horizontal = near(rightGap, 0, tol) && !near(leftGap, 0, tol) ? "END"
    : near(leftGap, 0, tol) && !near(rightGap, 0, tol) ? "START"
      : near(leftGap, rightGap, tol) ? "CENTER" : "START";
  const vertical = near(bottomGap, 0, tol) && !near(topGap, 0, tol) ? "END"
    : near(topGap, 0, tol) && !near(bottomGap, 0, tol) ? "START"
      : near(topGap, bottomGap, tol) ? "CENTER" : "START";

  return derive({ horizontal, vertical, offsetX: r1(leftGap), offsetY: r1(topGap) }, {
    derivation: "GEOMETRY",
    confidence: 0.7,
    evidence: [ev(child.id, "anchor", `${horizontal}/${vertical} off ${r1(leftGap)},${r1(topGap)}`)],
  });
}

// ---------- grid tracks ----------

/** Cluster child centers into rows/columns → track definitions (columns/rows/counts). Row/column
 *  clustering tolerance is half the median child extent — wide enough to absorb a centered sibling's
 *  small offset, but not a genuine second row/column (which is a full extent apart). */
export function deriveGridTracks(children) {
  if (children.length < 2) return null;
  const hs = children.map((c) => c.absoluteBounds.h).sort((a, b) => a - b);
  const ws = children.map((c) => c.absoluteBounds.w).sort((a, b) => a - b);
  const rowTol = Math.max(4, hs[Math.floor(hs.length / 2)] * 0.5);
  const colTol = Math.max(4, ws[Math.floor(ws.length / 2)] * 0.5);
  const cx = children.map((c) => c.absoluteBounds.x + c.absoluteBounds.w / 2);
  const cy = children.map((c) => c.absoluteBounds.y + c.absoluteBounds.h / 2);
  const ys = cluster1d(cy, rowTol);
  const xs = cluster1d(cx, colTol);
  if (ys.length < 2 || xs.length < 2) return null; // not a 2D grid
  return derive({
    columns: xs.length,
    rows: ys.length,
    cells: children.map((c) => ({
      id: c.id,
      col: xs.findIndex((v) => v === clusterOf(c.absoluteBounds.x + c.absoluteBounds.w / 2, xs, colTol)),
      row: ys.findIndex((v) => v === clusterOf(c.absoluteBounds.y + c.absoluteBounds.h / 2, ys, rowTol)),
    })),
  }, { derivation: "GEOMETRY", confidence: 0.6, evidence: children.map((c) => ev(c.id, "gridCell", `${c.absoluteBounds.x},${c.absoluteBounds.y}`)) });
}

function cluster1d(values, tol) {
  const sorted = [...values].sort((a, b) => a - b);
  const clusters = [];
  let cur = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    if (Math.abs(sorted[i] - cur[cur.length - 1]) <= tol) cur.push(sorted[i]);
    else { clusters.push(cur.reduce((s, v) => s + v, 0) / cur.length); cur = [sorted[i]]; }
  }
  clusters.push(cur.reduce((s, v) => s + v, 0) / cur.length);
  return clusters;
}

function clusterOf(v, clusters, tol) {
  for (const c of clusters) if (Math.abs(v - c) <= tol) return c;
  return clusters[0];
}

// ---------- helpers ----------

function ev(nodeId, property, value) {
  return { nodeId, property, value: value == null ? null : String(value).slice(0, 80) };
}

function r1(v) {
  return Math.round(v * 10) / 10;
}
