// knowledge-graph — the Project Knowledge Graph (doc 03 §1), SEPARATE from the Design Intent Graph.
//
// Holds framework contract, capabilities, property-level recipe declarations, responsive system, and
// the business-behavior boundary. It CANNOT mutate the Design Intent Graph; the merger
// (recipe-merger.mjs) is the only place the two meet, and every contradiction there is explicit.
//
// The recipes here are DECLARATION-level (not whole `::ng-deep` blocks): each declaration carries a
// semantics + portability, so page-specific geometry is excluded from the reusable default context.

import { createHash } from "node:crypto";
import { mineRecipeDeclarations } from "./recipe-semantics.mjs";
import { declarationsFromAggregates, declarationsStats } from "./scss-mine.mjs";
import { FORBIDDEN_INVENTIONS, defaultActionHandler } from "./business-boundary.mjs";

/**
 * @param {{ conventions?: object, projectContext?: object, pilar?: object|null }} inputs
 * @returns {object} Project Knowledge Graph (framework/capabilities/recipes/responsiveSystem/businessBoundary/provenance/hash)
 */
export function buildProjectKnowledgeGraph({ conventions = {}, projectContext = {}, pilar = null } = {}) {
  // Production path: real mined declarations (from init/detect). Test path: block observations.
  const recipes = (conventions.declarations?.aggregates?.length)
    ? declarationsFromAggregates(conventions.declarations.aggregates)
    : mineRecipeDeclarations(conventions.ngDeepCorpus ?? []);
  const capabilities = Object.entries(projectContext.capabilities ?? {}).map(([category, cap]) => ({
    id: category,
    category,
    implementation: cap?.library ?? null,
    source: cap?.source ?? "registry",
    private: Boolean(cap?.private),
    confidence: cap?.library ? 0.9 : 0.2,
    sourceReferences: cap?.sampleHtml ? ["project-context.sampleHtml"] : [],
  }));

  const framework = {
    id: projectContext.framework?.id ?? "unknown",
    version: projectContext.framework?.version ?? null,
    moduleOrStandalone: projectContext.moduleOrStandalone ?? null,
  };

  const responsiveSystem = projectContext.responsive ?? projectContext.breakpoints ?? null;

  const businessBoundary = {
    forbiddenInventions: FORBIDDEN_INVENTIONS.map((f) => f.label),
    defaultActionHandler: defaultActionHandler(),
  };

  const provenance = {
    conventions: "conventions.json.ngDeepCorpus",
    projectContext: "project-context.json",
    pilar: pilar ? "pilar-catalog.mjs" : null,
  };

  const graph = {
    version: "1",
    framework,
    capabilities,
    recipes,
    recipeStats: declarationsStats(recipes),
    responsiveSystem,
    businessBoundary,
    provenance,
    hash: "",
  };
  graph.hash = hashGraph(graph);
  return graph;
}

function hashGraph(graph) {
  const { hash: _h, ...rest } = graph;
  return createHash("sha256").update(stableStringify(rest)).digest("hex");
}

function stableStringify(value) {
  const seen = new WeakSet();
  const walk = (v) => {
    if (v === null || typeof v !== "object") return JSON.stringify(v) ?? "null";
    if (seen.has(v)) return '"<circular>"';
    seen.add(v);
    if (Array.isArray(v)) return `[${v.map(walk).join(",")}]`;
    return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${walk(v[k])}`).join(",")}}`;
  };
  return walk(value);
}
