// Implementation Plan — compact contract; excludes unrelated capabilities/corpus; preserves rows.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { ingestDesign } from "../../src/design/ingest.mjs";
import { buildProjectKnowledgeGraph } from "../../src/project/knowledge-graph.mjs";
import { extractDesignGeometry } from "../../src/planning/design-geometry.mjs";
import { buildImplementationPlan } from "../../src/planning/implementation-plan.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const XML = readFileSync(join(HERE, "..", "fixtures", "mahasiswa-tarif", "raw.xml"), "utf8");

function build(projectContext = {}) {
  const ingested = ingestDesign(XML, "mahasiswa-tarif.xml");
  const projectKnowledge = buildProjectKnowledgeGraph({
    conventions: { ngDeepCorpus: [] },
    projectContext,
  });
  const designGeometry = extractDesignGeometry(ingested.rawGraph, ingested.classifications, ingested.intentGraph);
  return buildImplementationPlan({ intentGraph: ingested.intentGraph, designGeometry, projectKnowledge });
}

test("implementation-plan: excludes unrelated capabilities (table in, select out)", () => {
  const { json } = build({
    capabilities: {
      table: { library: "pilar (uii-table)", source: "registry" },
      select: { library: "ngx-select", source: "registry" },
      checkbox: { library: "uii-checkbox", source: "registry" },
    },
  });
  const cats = json.componentMappings.map((c) => c.category);
  assert.ok(cats.includes("table"), "the design's table capability is mapped");
  assert.ok(!cats.includes("checkbox"), "an unused capability is excluded");
});

test("implementation-plan: designed-visible rows remain unchanged", () => {
  const { json, markdown } = build();
  const table = json.exactContent.tables[0];
  assert.equal(table.designedVisibleRows, 5, "the 5 designed rows are never replaced by mocks");
  assert.deepEqual(table.headers, ["No.", "NIM", "Nama", "Fakultas", "Program studi", "Skema", "Nominal akhir (Rp)", "Status"]);
  assert.ok(markdown.includes("immutable"), "the plan states the rows are immutable");
});

test("implementation-plan: the compact plan is far smaller than the raw corpus", () => {
  const { json } = build({
    capabilities: { table: { library: "pilar (uii-table)" }, select: { library: "ngx-select" }, checkbox: {}, modal: {} },
  });
  // Context precision: the plan carries only capabilities in play + bounded structure.
  assert.ok(json.componentMappings.length <= 2, "only the table/select capabilities are mapped");
  assert.ok(json.structure.length <= 30, "structure is bounded");
  assert.ok(JSON.stringify(json).length < 20000, "the plan stays compact");
});

test("implementation-plan: effective recipes reflect the merger (zero silent override)", () => {
  const ingested = ingestDesign(XML, "mahasiswa-tarif.xml");
  const projectKnowledge = buildProjectKnowledgeGraph({
    conventions: {
      ngDeepCorpus: [
        { selector: ".gateway-table", family: "table", block: ".gateway-table { border-radius: 8px }", observations: { "border-radius": { count: 5 } } },
      ],
    },
    projectContext: {},
  });
  const designGeometry = extractDesignGeometry(ingested.rawGraph, ingested.classifications, ingested.intentGraph);
  const { json } = buildImplementationPlan({ intentGraph: ingested.intentGraph, designGeometry, projectKnowledge });
  assert.equal(json.metrics.silentOverrideCount, 0);
  assert.ok(Array.isArray(json.effectiveRecipes), "effective recipes present");
  assert.ok(Array.isArray(json.suppressedRecipes), "suppressed recipes present");
});
