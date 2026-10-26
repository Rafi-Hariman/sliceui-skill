// sliceui plan — the compact Implementation Plan: Design Intent Graph ⊕ Project Knowledge Graph,
// merged declaration-level so explicit design geometry always wins and page-specific project
// geometry is excluded. The ONE normal per-design agent contract (Prompt B).

import { readFileSync, existsSync } from "node:fs";
import { join, basename } from "node:path";
import { ingestDesign } from "../design/ingest.mjs";
import { buildProjectKnowledgeGraph } from "../project/knowledge-graph.mjs";
import { extractDesignGeometry } from "../planning/design-geometry.mjs";
import { buildImplementationPlan } from "../planning/implementation-plan.mjs";
import { loadPilar } from "../lib/pilar-loader.mjs";

export async function main(argv) {
  const json = argv.includes("--json");
  const args = argv.filter((a) => a !== "--json");
  const input = args[0];
  if (!input) {
    console.error("usage: sliceui plan <xml|figml> [--json]");
    return 2;
  }
  const abs = input.startsWith("/") ? input : join(process.cwd(), input);
  if (!/\.(xml|figml)$/i.test(abs)) {
    console.error("plan: design-intent planning requires a FIGML XML input");
    return 2;
  }

  const result = await buildPlanForProject(process.cwd(), abs);
  if (!result.ok) {
    console.error(`plan: ${result.reason}${result.message ? ` — ${result.message}` : ""}`);
    return 3;
  }
  process.stdout.write(json ? JSON.stringify(result.json, null, 2) + "\n" : result.markdown);
  return 0;
}

/**
 * Build the Implementation Plan for a design against a project snapshot — the production path.
 * Reads `.sliceui/conventions.json` + `.sliceui/project-context.json` from `root` (the real mined
 * declaration observations live in conventions.json via `init`/`detect`). No caller injection.
 */
export async function buildPlanForProject(root, abs) {
  const rawXml = readFileSync(abs, "utf8");
  const ingested = ingestDesign(rawXml, basename(abs));
  if (!ingested.ok) return ingested;

  const conventions = readJson(join(root, ".sliceui", "conventions.json"));
  const projectContext = readJson(join(root, ".sliceui", "project-context.json"));
  const pilar = await loadPilar().catch(() => null);

  const projectKnowledge = buildProjectKnowledgeGraph({ conventions, projectContext, pilar });
  const designGeometry = extractDesignGeometry(ingested.rawGraph, ingested.classifications, ingested.intentGraph);
  const { markdown, json } = buildImplementationPlan({
    intentGraph: ingested.intentGraph,
    designGeometry,
    projectKnowledge,
  });
  return { ok: true, markdown, json, projectKnowledge, ingested };
}

function readJson(p) {
  if (!existsSync(p)) return {};
  try { return JSON.parse(readFileSync(p, "utf8")); } catch { return {}; }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main(process.argv.slice(2)).then((code) => process.exit(code ?? 0));
}
