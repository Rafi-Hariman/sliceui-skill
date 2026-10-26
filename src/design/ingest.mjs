// ingest — the single design-side entry point: FIGML XML → Raw Design Graph → compiled Design
// Intent Graph. Runs ALONGSIDE the legacy transcript path; `inspect` calls this for FIGML inputs
// to surface the design-intent facts the legacy path cannot (topology, layout constraints, exact
// content, runtime state, uncertainty).

import { buildRawGraph } from "./raw-graph.mjs";
import { compileVisibility } from "./visibility.mjs";
import { decomposeRegions } from "./regions.mjs";
import { compileTopologies } from "./topology.mjs";
import { extractExactContent } from "./content.mjs";
import { buildDesignIntentGraph, validate, hash, freeze } from "./intent-graph.mjs";

/**
 * @param {string} xml
 * @param {string} filename
 * @returns {{ ok: true, rawGraph, classifications, regions, topologies, content, intentGraph } | { ok: false, reason: string, message: string }}
 */
export function ingestDesign(xml, filename) {
  const raw = buildRawGraph(xml, filename);
  if (!raw.ok) return raw;

  const rawGraph = raw.graph;
  const { classifications, diagnostics: visDiags } = compileVisibility(rawGraph);
  const { regions } = decomposeRegions(rawGraph, classifications);
  const topologies = compileTopologies(regions, rawGraph, classifications);
  const content = extractExactContent(rawGraph, classifications, topologies);

  const intentGraph = buildDesignIntentGraph(rawGraph, classifications, { regions, topologies, content });
  const diags = validate(intentGraph);
  intentGraph.diagnostics = [...diags, ...visDiags];
  intentGraph.hash = hash(intentGraph);
  freeze(intentGraph);

  return { ok: true, rawGraph, classifications, regions, topologies, content, intentGraph };
}
