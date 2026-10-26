// implementation-plan — the compact Implementation Plan (doc 03 §10-§12): the single agent-facing
// per-design contract. It merges the immutable Design Intent Graph (A1 design) with the Project
// Knowledge Graph (mechanism), via the declaration-level recipe merger, so:
//   - explicit design geometry always wins (zero silent A1 override),
//   - page-specific project geometry is excluded,
//   - only the capabilities/recipes the design actually uses appear (context precision ≥ 90%).
//
// Pure — no fs.

import { mergeDeclarations } from "./recipe-merger.mjs";

const ROLE_TO_CAPABILITY = {
  TABLE: "table",
  FIELD: "select",
  SELECT: "select",
};

/**
 * @param {{ intentGraph: object, designGeometry: Record<string,object>, projectKnowledge: object,
 *           resolved?: object }} inputs
 * @returns {{ markdown: string, json: object }}
 */
export function buildImplementationPlan({ intentGraph, designGeometry = {}, projectKnowledge = {}, resolved = null }) {
  const nodesById = new Map((intentGraph.nodes ?? []).map((n) => [n.id, n]));

  // 1. Design summary.
  const fams = {};
  for (const r of intentGraph.regions ?? []) fams[r.family] = (fams[r.family] ?? 0) + 1;
  const topology = Object.entries(fams).sort((a, b) => b[1] - a[1]).map(([f, n]) => `${f} ×${n}`).join(", ");
  const designSummary = {
    topology,
    regionCount: (intentGraph.regions ?? []).length,
    contentCount: (intentGraph.content ?? []).length,
    tableCount: (intentGraph.tables ?? []).length,
  };

  // 2. Structure — top-level regions (family + role), bounded.
  const structure = (intentGraph.regions ?? []).slice(0, 30).map((r) => {
    const n = nodesById.get(r.rootNodeId);
    return { nodeId: r.rootNodeId, name: n?.sourceName ?? r.rootNodeId, role: n?.role ?? "CONTAINER", family: r.family };
  });

  // 3. Layout constraints — the relative/normalized constraints (bounded).
  const layoutConstraints = (intentGraph.constraints ?? []).slice(0, 40);

  // 4. Exact visible content.
  const exactContent = {
    count: (intentGraph.content ?? []).length,
    tables: (intentGraph.tables ?? []).map((t) => ({
      tableNodeId: t.tableNodeId,
      headers: t.headers.map((h) => h.value),
      designedVisibleRows: t.designedVisibleRows.length,
    })),
  };

  // 5. Component mappings — only capabilities the design actually uses.
  const usedCapabilities = new Set();
  for (const n of intentGraph.nodes ?? []) {
    const cat = ROLE_TO_CAPABILITY[n.role];
    if (cat) usedCapabilities.add(cat);
  }
  const componentMappings = (projectKnowledge.capabilities ?? [])
    .filter((c) => usedCapabilities.has(c.category))
    .map((c) => ({ category: c.category, implementation: c.implementation, source: c.source }));

  // 6. Effective recipes — merged declarations (design-wins, page-specific suppressed).
  const merged = mergeDeclarations(projectKnowledge.recipes ?? [], designGeometry);
  const effectiveRecipes = merged.effective.map((d) => ({
    selector: d.selector, property: d.property, value: d.value, semantics: d.semantics,
  }));
  const suppressedRecipes = merged.suppressed.map((d) => ({
    selector: d.selector, property: d.property, value: d.value, resolution: d.resolution,
    designValue: d.designValue ?? null,
  }));

  // 7. Runtime state.
  const runtimeState = intentGraph.states ?? [];

  // 8. Responsive plan (design-verified vs inferred).
  const responsivePlan = intentGraph.responsive ?? { variants: [], designVerified: false };

  // 9. Forbidden inventions.
  const forbiddenInventions = projectKnowledge.businessBoundary?.forbiddenInventions ?? [];

  // 10. Verification obligations (filled by Prompt C; listed as obligations here).
  const verificationPlan = {
    semantic: exactContent.count > 0,
    relationship: layoutConstraints.length > 0,
    style: effectiveRecipes.length > 0,
    runtime: runtimeState.length > 0,
  };

  const json = {
    designSummary,
    structure,
    layoutConstraints,
    exactContent,
    componentMappings,
    effectiveRecipes,
    suppressedRecipes,
    conflicts: merged.conflicts,
    runtimeState,
    responsivePlan,
    forbiddenInventions,
    verificationPlan,
    metrics: {
      recipeCount: (projectKnowledge.recipes ?? []).length,
      effectiveRecipeCount: effectiveRecipes.length,
      suppressedCount: suppressedRecipes.length,
      silentOverrideCount: merged.silentOverrideCount,
    },
  };

  return { markdown: renderPlan(json), json };
}

function renderPlan(j) {
  const L = [];
  L.push("# Implementation Plan");
  L.push("");
  L.push(`- Topology: ${j.designSummary.topology}`);
  L.push(`- Content: ${j.designSummary.contentCount} exact visible nodes, ${j.designSummary.tableCount} table(s)`);
  L.push("");

  L.push("## Exact structure");
  L.push("");
  for (const s of j.structure) L.push(`- ${s.role ?? "?"} \`${s.name}\` (${s.family})`);
  L.push("");

  L.push("## Exact visible content");
  L.push("");
  L.push(`- ${j.exactContent.count} visible text/icon nodes (A1 design, exact).`);
  for (const t of j.exactContent.tables) {
    L.push(`- table columns: ${t.headers.join(" | ")}`);
    L.push(`- ${t.designedVisibleRows} designed-visible rows (immutable — never replaced by mocks).`);
  }
  L.push("");

  L.push("## Layout constraints");
  L.push("");
  if (!j.layoutConstraints.length) L.push("_(none)_");
  for (const c of j.layoutConstraints) {
    if (c.type === "SIBLING_RATIO") L.push(`- sibling ratio ${JSON.stringify(c.value)} (parent ${c.parentId})`);
    else if (c.type === "ITEM_DISTANCE") for (const d of c.items ?? []) L.push(`- spacing ${d.expected}px between ${d.fromNodeId} → ${d.toNodeId}`);
    else if (c.type === "GRID_TRACKS") L.push(`- grid ${c.value.columns}×${c.value.rows}`);
    else if (c.type === "ANCHOR") L.push(`- anchor ${JSON.stringify(c.value)}`);
  }
  L.push("");

  L.push("## Project mappings");
  L.push("");
  if (!j.componentMappings.length) L.push("_(none — plain elements only)_");
  for (const m of j.componentMappings) L.push(`- ${m.category} → \`${m.implementation}\``);
  L.push("");

  L.push("## Effective recipes (design-wins, page-specific suppressed)");
  L.push("");
  if (!j.effectiveRecipes.length) L.push("_(none)_");
  for (const r of j.effectiveRecipes) L.push(`- \`${r.selector}\` ${r.property}: ${r.value} (${r.semantics})`);
  if (j.suppressedRecipes.length) {
    L.push("");
    L.push("Suppressed (never applied):");
    for (const s of j.suppressedRecipes) L.push(`- \`${s.selector}\` ${s.property}: ${s.value} → ${s.resolution}${s.designValue != null ? ` (design ${s.designValue})` : ""}`);
  }
  L.push("");

  L.push("## Runtime state");
  L.push("");
  if (!j.runtimeState.length) L.push("_(none)_");
  for (const s of j.runtimeState) L.push(`- ${s.kind}: visible ${s.visibleStart}-${s.visibleEnd} of ${s.total} (page size ${s.pageSize})`);
  L.push("");

  L.push("## Forbidden inventions");
  L.push("");
  for (const f of j.forbiddenInventions) L.push(`- ${f}`);
  L.push("");

  L.push("## Verification obligations");
  L.push("");
  L.push(`- semantic exact-content: ${j.verificationPlan.semantic ? "required" : "n/a"}`);
  L.push(`- relationship/topology: ${j.verificationPlan.relationship ? "required" : "n/a"}`);
  L.push(`- computed style: ${j.verificationPlan.style ? "required" : "n/a"}`);
  L.push(`- runtime state: ${j.verificationPlan.runtime ? "required" : "n/a"}`);

  return L.join("\n") + "\n";
}
