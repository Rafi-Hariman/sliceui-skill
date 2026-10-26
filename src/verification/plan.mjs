// verification/plan — compile a VerificationPlan from the Design Intent Graph (Prompt A).
//
// Every high-importance intent constraint becomes a check carrying its EXPECTED value + the design
// node ids the browser geometry will resolve against. This is the STATIC compilation step: the plan
// is pure (no browser), and the actual measurement happens later against DOM geometry (relationship),
// computed styles (style), or text/state (content/runtime). A static PASS is never a render PASS —
// it only compiles what the browser must prove.

import { tolerance } from "../design/constraints.mjs";

/**
 * @param {object} intentGraph — buildDesignIntentGraph() output
 * @returns {{ relationship: Array, semantic: Array, style: Array, runtime: Array, responsive: Array }}
 */
export function compileVerificationPlan(intentGraph) {
  const plan = { relationship: [], semantic: [], style: [], runtime: [], responsive: [] };

  for (const c of intentGraph.constraints ?? []) {
    if (c.type === "SIBLING_RATIO") {
      plan.relationship.push({
        id: `SUI-REL-RATIO-${c.regionId ?? "x"}`,
        category: "sibling-ratio",
        parentId: c.parentId, childIds: c.childIds, axis: c.axis,
        expected: c.value, tolerance: c.tolerance ?? 0.1, confidence: c.confidence ?? 0,
        evidence: c.evidence ?? [],
        remediation: "apply equivalent fill/grow to all siblings — do not use padding as the width mechanism",
      });
    } else if (c.type === "ITEM_DISTANCE") {
      for (const d of c.items ?? []) {
        plan.relationship.push({
          id: `SUI-REL-SPACING-${d.fromNodeId}`,
          category: "item-distance",
          fromNodeId: d.fromNodeId, toNodeId: d.toNodeId, axis: d.axis,
          expected: d.expected, tolerance: 1, confidence: 0.8,
          remediation: "set the rendered distance between adjacent children (reuse framework spacing, add only the delta)",
        });
      }
    } else if (c.type === "GRID_TRACKS" && c.value) {
      plan.relationship.push({
        id: `SUI-REL-GRID-${c.regionId ?? "x"}`,
        category: "grid-track",
        regionId: c.regionId, nodeIds: (c.cells ?? []).map((x) => x.id),
        expected: { columns: c.value.columns, rows: c.value.rows },
        tolerance: 1, confidence: 0.6,
        remediation: "match the design's grid track count (columns × rows)",
      });
    } else if (c.type === "ANCHOR" && c.value) {
      plan.relationship.push({
        id: `SUI-REL-ANCHOR-${c.nodeId}`,
        category: "anchor",
        nodeId: c.nodeId, anchorNodeId: c.anchorNodeId,
        expected: c.value, tolerance: 2, confidence: 0.7,
        remediation: "anchor the floating element to the designed edge/corner",
      });
    } else if (c.type === "ALIGNMENT") {
      plan.relationship.push({
        id: `SUI-REL-ALIGN-${c.childId}`,
        category: "alignment",
        childId: c.childId, parentId: c.parentId, axis: c.axis ?? "x",
        expected: c.value, tolerance: 2, confidence: c.confidence ?? 0.7,
        evidence: c.evidence ?? [],
        remediation: "align the element to the design's parent edge/center",
      });
    } else if (c.type === "RELATIVE_SIZE") {
      plan.relationship.push({
        id: `SUI-REL-RELSIZE-${c.childId}`,
        category: "relative-size",
        childId: c.childId, parentId: c.parentId, axis: c.axis ?? "x",
        expected: c.value, tolerance: c.tolerance ?? 0.05, confidence: c.confidence ?? 0.8,
        evidence: c.evidence ?? [],
        remediation: "make the child the designed fraction of its parent",
      });
    } else if (c.type === "CONTAINMENT") {
      plan.relationship.push({
        id: `SUI-REL-CONTAIN-${c.childId}`,
        category: "containment",
        childId: c.childId, parentId: c.parentId,
        expected: true, tolerance: 1, confidence: c.confidence ?? 0.7,
        escapeAllowed: c.escapeAllowed === true,
        evidence: c.evidence ?? [],
        remediation: "keep the child inside its intended container unless escape is explicit",
      });
    }
  }

  // Semantic exact-content checks (tables: headers + designed visible rows are A1 immutable).
  for (const t of intentGraph.tables ?? []) {
    plan.semantic.push({
      id: `SUI-SEM-TABLE-${t.tableNodeId}`,
      category: "table-content",
      tableNodeId: t.tableNodeId,
      headers: t.headers.map((h) => h.value),
      designedRows: t.designedVisibleRows.map((r) => r.cells.map((c) => c.value)),
      remediation: "render the designed-visible rows exactly — never replace them with representative mock data",
    });
  }
  for (const ev of intentGraph.content ?? []) {
    if (ev.kind === "TEXT" && ev.value.trim()) {
      plan.semantic.push({
        id: `SUI-SEM-TEXT-${ev.nodeId}`,
        category: "exact-text",
        nodeId: ev.nodeId,
        expected: ev.value,
        remediation: "render the exact designed text",
      });
    }
  }

  // Runtime-state checks (pagination visibility).
  for (const s of intentGraph.states ?? []) {
    if (s.kind === "PAGINATION_RUNTIME") {
      plan.runtime.push({
        id: "SUI-RUN-PAGINATION",
        category: "pagination-visible",
        expected: { total: s.total, pageSize: s.pageSize, visible: true },
        remediation: "the runtime/mock state must render the designed pagination (total vs page size)",
      });
    }
  }

  // Responsive safety: no avoidable overflow/overlap/clipping/FILL-loss — always planned. A width
  // with a SUPPLIED design variant is DESIGN_VERIFIED; every other width is RESPONSIVE_INFERRED
  // (safety-only, never a design-fidelity comparison).
  plan.responsive.push({
    id: "SUI-RESP-SAFETY",
    category: "responsive-safety",
    expected: { pageOverflow: 0, overlapArea: 0, clipping: 0, fillTracksParent: true },
    tolerance: 1,
    designViewports: (intentGraph.responsive?.variants ?? []).map((v) => v.width).filter((w) => Number.isFinite(w)),
    remediation: "no avoidable page overflow / overlap / clipped critical content / lost FILL tracking at the probed viewports",
  });

  return plan;
}

/** Re-exported so relationship verifiers and the plan share one tolerance source. */
export { tolerance };
