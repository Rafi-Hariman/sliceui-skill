// intent-graph — assemble, freeze, validate, and hash the immutable Design Intent Graph.
//
// The intent graph is COMPILED from the raw graph (lossless evidence) + topology + constraints.
// It is project-independent by construction: it holds semantic roles, topology families, relative
// (translation/scale-invariant) constraints, and exact visible content — nothing about Angular,
// Pilar, Bootstrap, or recipes. Once frozen, it cannot be mutated; project adaptation (Prompt B)
// happens against this frozen graph and every contradiction becomes an explicit merge conflict.
//
// `hash()` is stable across project-context changes (the graph never reads project context), which
// the metamorphic suite proves. Geometry-derived facts here are relative/normalized, so translating
// or scaling the whole design leaves topology + normalized relationships unchanged.

import { createHash } from "node:crypto";
import { deriveOrder } from "./constraints.mjs";

/**
 * @param {object} graph — buildRawGraph() output
 * @param {Map} classifications — compileVisibility() output
 * @param {{ regions: Array, topologies: Array, content: object }} compiled
 */
export function buildDesignIntentGraph(graph, classifications, compiled) {
  const nodes = graph.nodes ?? {};
  const topoByRegion = new Map((compiled.topologies ?? []).map((t) => [t.regionId, t]));

  // Semantic nodes (visible only) — id, parent, sourceType, role, layout mode.
  const intentNodes = [];
  for (const id of Object.keys(nodes)) {
    const c = classifications.get(id);
    if (c && !c.effectiveVisible) continue;
    const n = nodes[id];
    intentNodes.push({
      id,
      parentId: n.parentId,
      sourceType: n.sourceType,
      sourceName: n.sourceName,
      role: roleOf(n),
      layoutMode: n.layout?.mode ?? "NONE",
    });
  }

  // Edges — CONTAINS + ORDERED_BEFORE from the tree; the rest come from compiled constraints.
  const edges = [];
  for (const id of Object.keys(nodes)) {
    const n = nodes[id];
    if (classifications.get(id) && !classifications.get(id).effectiveVisible) continue;
    for (const childId of n.childIds ?? []) {
      if (!nodes[childId]) continue;
      if (classifications.get(childId) && !classifications.get(childId).effectiveVisible) continue;
      edges.push({ type: "CONTAINS", from: id, to: childId });
    }
    // ORDERED_BEFORE among visible siblings (the design's source order).
    const visibleSibs = (n.childIds ?? []).filter((cid) => {
      const cc = classifications.get(cid);
      return nodes[cid] && (!cc || cc.effectiveVisible);
    });
    for (let i = 1; i < visibleSibs.length; i++) {
      edges.push({ type: "ORDERED_BEFORE", from: visibleSibs[i - 1], to: visibleSibs[i] });
    }
  }

  // Constraint edges from the topology compilers.
  const constraints = [];
  for (const t of compiled.topologies ?? []) {
    for (const c of t.constraints ?? []) {
      constraints.push({ ...c, family: t.family, regionId: t.regionId });
      if (c.type === "SIBLING_RATIO" && c.childIds) {
        for (const cid of c.childIds) edges.push({ type: "SIBLING_RATIO", from: c.parentId, to: cid, ratios: c.value });
      }
      if (c.type === "ITEM_DISTANCE") {
        for (const d of c.items ?? []) edges.push({ type: "SPACED_BY", from: d.fromNodeId, to: d.toNodeId, expected: d.expected, axis: d.axis });
      }
      if (c.type === "ANCHOR" && c.nodeId) {
        edges.push({ type: "ANCHORED_TO", from: c.nodeId, to: c.anchorNodeId, ...c.value });
      }
      if (c.type === "REPEATS_TEMPLATE") {
        for (const nid of c.nodeIds ?? []) edges.push({ type: "REPEATS_TEMPLATE", from: t.rootNodeId, to: nid });
      }
    }
    // A LINEAR region's per-child alignment intents become verifiable ALIGNMENT constraints.
    for (const a of t.alignments ?? []) {
      constraints.push({
        type: "ALIGNMENT", childId: a.nodeId, parentId: t.rootNodeId,
        axis: t.direction === "HORIZONTAL" ? "x" : "y",
        value: a.value, confidence: a.confidence ?? 0.7, evidence: a.evidence ?? [],
      });
    }
  }
  constraints.push(...deriveGeometryConstraints(nodes, (id) => {
    const c = classifications.get(id);
    return !c || c.effectiveVisible;
  }));

  const regions = (compiled.regions ?? []).map((r) => ({
    id: r.id,
    rootNodeId: r.rootNodeId,
    family: topoByRegion.get(r.id)?.family ?? "FREEFORM",
    candidateRoles: r.candidateRoles,
  }));

  const content = compiled.content?.content ?? [];
  const tables = compiled.content?.tables ?? [];
  const pagination = compiled.content?.pagination ?? null;

  return {
    version: "1",
    source: { kind: graph.source?.kind ?? "figml", filename: graph.source?.filename ?? null },
    regions,
    nodes: intentNodes,
    edges,
    constraints,
    content,
    tables,
    states: pagination ? [{ kind: "PAGINATION_RUNTIME", ...pagination.runtime }] : [],
    responsive: { variants: [], designVerified: false },
    accessibility: {},
    diagnostics: [],
    hash: "",
  };
}

/** Derive RELATIVE_SIZE (a FIXED child's fraction of its parent) and CONTAINMENT (an absolutely-
 *  positioned child vs its host) constraints from raw bounds. Bounded: relative-size caps at 12 so a
 *  pathological design cannot explode the constraint set. */
function deriveGeometryConstraints(nodes, isVisible) {
  const out = [];
  let relCount = 0;
  for (const [id, n] of Object.entries(nodes ?? {})) {
    if (!isVisible(id) || !n.parentId) continue;
    const parent = nodes[n.parentId];
    if (!parent) continue;
    if (n.layout?.horizontalSizing === "FIXED" && n.bounds?.w > 0 && parent.bounds?.w > 0 && relCount < 12) {
      relCount += 1;
      out.push({
        type: "RELATIVE_SIZE", childId: id, parentId: n.parentId, axis: "x",
        value: Math.round((n.bounds.w / parent.bounds.w) * 1000) / 1000,
        confidence: 0.8, evidence: [{ nodeId: id, property: "bounds.w", value: n.bounds.w }],
      });
    }
    if (n.layout?.layoutPositioning === "ABSOLUTE") {
      // Escape is legitimate exactly when the host does NOT clip its content.
      out.push({
        type: "CONTAINMENT", childId: id, parentId: n.parentId,
        escapeAllowed: parent.layout?.clipsContent !== true,
        confidence: 0.7, evidence: [{ nodeId: id, property: "layoutPositioning", value: "ABSOLUTE" }],
      });
    }
  }
  return out;
}

/** Lightweight semantic role from source type + name (no project vocabulary). */
function roleOf(node) {
  const tag = String(node.sourceType ?? "").toLowerCase();
  const name = String(node.sourceName ?? "").toLowerCase();
  if (/text/i.test(tag)) return "TEXT";
  if (/button|btn/i.test(name) || /button/i.test(tag)) return "BUTTON";
  if (/field|input|select|dropdown|search|pencarian/i.test(name)) return "FIELD";
  if (/table|datatable|datagrid/i.test(name)) return "TABLE";
  if (/information|alert|info/i.test(name)) return "CARD";
  if (/toolbar/i.test(name)) return "TOOLBAR";
  if (/pagination/i.test(name)) return "PAGINATION";
  if (/icon|vector/i.test(name) || /icon|vector/i.test(tag)) return "ICON";
  if (/rectangle/i.test(tag)) return "DIVIDER";
  return "CONTAINER";
}

// ---------- freeze / hash ----------

/** Deep-freeze the intent graph (and its nested structures) so project adaptation cannot mutate it. */
export function freeze(graph) {
  const walk = (v, seen) => {
    if (v === null || typeof v !== "object") return v;
    if (seen.has(v)) return v;
    seen.add(v);
    Object.freeze(v);
    for (const k of Object.keys(v)) walk(v[k], seen);
    return v;
  };
  return walk(graph, new Set());
}

/** Deterministic sha256 of the intent graph's semantic content (diagnostics + hash excluded). */
export function hash(graph) {
  const { diagnostics, hash: _hash, ...rest } = graph;
  const canonical = stableStringify(rest);
  return createHash("sha256").update(canonical).digest("hex");
}

/** Canonical JSON with recursively sorted object keys (deterministic, order-invariant). */
export function stableStringify(value) {
  const seen = new WeakSet();
  const walk = (v) => {
    if (v === null || typeof v !== "object") return JSON.stringify(v) ?? "null";
    if (seen.has(v)) return '"<circular>"';
    seen.add(v);
    if (Array.isArray(v)) return `[${v.map(walk).join(",")}]`;
    const keys = Object.keys(v).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${walk(v[k])}`).join(",")}}`;
  };
  return walk(value);
}

/** Validate the intent graph; returns an array of diagnostics (empty = valid). */
export function validate(graph) {
  const diags = [];
  if (!graph || typeof graph !== "object") return [{ code: "SUI-INTENT-INVALID", message: "intent graph is not an object" }];
  if (!Array.isArray(graph.nodes)) diags.push({ code: "SUI-INTENT-NO-NODES", message: "nodes must be an array" });
  if (!Array.isArray(graph.regions)) diags.push({ code: "SUI-INTENT-NO-REGIONS", message: "regions must be an array" });
  if (!Array.isArray(graph.edges)) diags.push({ code: "SUI-INTENT-NO-EDGES", message: "edges must be an array" });
  if (!Array.isArray(graph.constraints)) diags.push({ code: "SUI-INTENT-NO-CONSTRAINTS", message: "constraints must be an array" });
  return diags;
}
