// Project Knowledge Graph — separate from the Design Intent Graph; declaration-level recipes.
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildProjectKnowledgeGraph } from "../../src/project/knowledge-graph.mjs";

const CONVENTIONS = {
  ngDeepCorpus: [
    { selector: ".form-control", family: "form", block: ".form-control { width: 384px; border-radius: 6px }", observations: { width: { count: 1, variance: true }, "border-radius": { count: 5 } } },
    { selector: ".dropdown-menu", family: "select", block: ".dropdown-menu { z-index: 1000 }", observations: { "z-index": { count: 5 } } },
  ],
  classVocabulary: [],
  componentAnatomy: {},
  naming: {},
};
const PROJECT_CONTEXT = {
  framework: { id: "angular", version: 13 },
  moduleOrStandalone: "standalone-capable",
  capabilities: {
    table: { library: "pilar (uii-table)", source: "registry" },
    select: { library: "ngx-select", source: "registry" },
  },
};

test("knowledge-graph: holds framework, capabilities, declaration-level recipes, boundary", () => {
  const g = buildProjectKnowledgeGraph({ conventions: CONVENTIONS, projectContext: PROJECT_CONTEXT });
  assert.equal(g.framework.id, "angular");
  assert.equal(g.framework.version, 13);
  assert.equal(g.capabilities.length, 2);
  assert.equal(g.recipes.length, 3, "two blocks → three declarations");
  assert.ok(g.businessBoundary.forbiddenInventions.length > 0);
  assert.ok(g.hash, "hash present");
});

test("knowledge-graph: recipes are declaration-level, not whole blocks", () => {
  const g = buildProjectKnowledgeGraph({ conventions: CONVENTIONS, projectContext: PROJECT_CONTEXT });
  const props = g.recipes.map((r) => r.property).sort();
  assert.deepEqual(props, ["border-radius", "width", "z-index"]);
  // The width declaration carries its page-specific semantics.
  const width = g.recipes.find((r) => r.property === "width");
  assert.equal(width.semantics, "PAGE_SPECIFIC_GEOMETRY");
});

test("knowledge-graph: hash is deterministic and project-scoped", () => {
  const g1 = buildProjectKnowledgeGraph({ conventions: CONVENTIONS, projectContext: PROJECT_CONTEXT });
  const g2 = buildProjectKnowledgeGraph({ conventions: CONVENTIONS, projectContext: PROJECT_CONTEXT });
  assert.equal(g1.hash, g2.hash);
  assert.match(g1.hash, /^[0-9a-f]{64}$/);
});

test("knowledge-graph: project context cannot contain design facts", () => {
  const g = buildProjectKnowledgeGraph({ conventions: CONVENTIONS, projectContext: PROJECT_CONTEXT });
  const serialized = JSON.stringify(g);
  for (const forbidden of ["mahasiswa", "Filter", "Table", "width: 260", "design intent"]) {
    assert.ok(!serialized.includes(forbidden), `project graph must not contain design content: ${forbidden}`);
  }
});
