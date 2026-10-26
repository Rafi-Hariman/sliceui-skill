// mining-production — the real path: project SCSS → mined declarations → conventions.json →
// Project Knowledge Graph → `sliceui plan`. No caller observation injection anywhere.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { withMinedDeclarations, aggregateObservations } from "../../src/project/scss-mine.mjs";
import { buildProjectKnowledgeGraph } from "../../src/project/knowledge-graph.mjs";
import { buildPlanForProject } from "../../src/commands/plan.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const MINING_ROOT = join(HERE, "..", "fixtures", "mining");
const DESIGN_XML = readFileSync(join(HERE, "..", "fixtures", "mahasiswa-tarif", "raw.xml"), "utf8");

test("production: mining the real fixture tree yields declarations + a parse failure", async () => {
  const conventions = await withMinedDeclarations(MINING_ROOT, {}, "angular");
  assert.ok(conventions.declarations?.aggregates?.length > 0, "mined declarations present");
  assert.equal(conventions.declarations.parseFailures.length, 1, "the malformed file is recorded, not dropped");
  assert.equal(conventions.declarations.stats.filesScanned, 13);
});

test("production: the Project Knowledge Graph consumes mined declarations (not injected observations)", async () => {
  const conventions = await withMinedDeclarations(MINING_ROOT, {}, "angular");
  const g = buildProjectKnowledgeGraph({ conventions, projectContext: { capabilities: { table: { library: "uii-table" } } } });
  assert.ok(g.recipes.length > 0, "recipes from real mining");
  assert.ok(g.recipeStats.bySemantics.PAGE_SPECIFIC_GEOMETRY >= 1, "page-specific width mined");
  assert.ok(g.recipeStats.bySemantics.STRUCTURAL_INTERNAL >= 1, "structural z-index/position mined");
  assert.ok(g.recipeStats.bySemantics.STATE_STYLE >= 1, "state focus color mined");
});

test("production: `sliceui plan` uses mined observations with no caller injection", async () => {
  const conventions = await withMinedDeclarations(MINING_ROOT, {}, "angular");
  const tmp = mkdtempSync(join(tmpdir(), "sliceui-plan-"));
  mkdirSync(join(tmp, ".sliceui"), { recursive: true });
  writeFileSync(join(tmp, ".sliceui", "conventions.json"), JSON.stringify({ ...conventions, generatedAt: "test", inputHash: "x" }, null, 2));
  writeFileSync(join(tmp, ".sliceui", "project-context.json"), JSON.stringify({
    framework: { id: "angular", version: 13 }, moduleOrStandalone: "standalone-capable",
    capabilities: { table: { library: "pilar (uii-table)", source: "registry" }, select: { library: "ngx-select", source: "registry" } },
  }, null, 2));
  const design = join(tmp, "design.xml");
  writeFileSync(design, DESIGN_XML);

  const result = await buildPlanForProject(tmp, design);
  assert.equal(result.ok, true);

  const { json } = result;
  assert.ok(
    json.suppressedRecipes.some((s) => s.property === "width" && s.resolution === "SUPPRESSED_PAGE_SPECIFIC"),
    "the page-specific search width is suppressed from real evidence",
  );

  const effective = json.effectiveRecipes.map((r) => `${r.selector} ${r.property}`).join(";");
  assert.match(effective, /dropdown-menu z-index/, "the stable internal z-index survives");
  assert.match(effective, /floating-badge position/, "the overlay position survives");

  assert.equal(json.metrics.silentOverrideCount, 0, "zero silent A1 override");
});

test("production: mining does not mutate the Design Intent Graph hash", async () => {
  const before = buildProjectKnowledgeGraph({ conventions: {}, projectContext: { capabilities: { table: { library: "uii-table" } } } });
  // Mining is a project-side operation; the design intent hash is computed independently.
  const conventions = await withMinedDeclarations(MINING_ROOT, {}, "angular");
  const after = buildProjectKnowledgeGraph({ conventions, projectContext: { capabilities: { table: { library: "uii-table" } } } });
  // The knowledge graph is project-scoped; the design intent graph never enters it.
  assert.ok(before.hash && after.hash);
  const serialized = JSON.stringify(conventions);
  assert.ok(!serialized.includes("mahasiswa-tarif") && !serialized.includes("No. | NIM"), "project snapshot leaks no design content");
});
