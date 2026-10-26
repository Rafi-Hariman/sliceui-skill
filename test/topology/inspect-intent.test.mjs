// inspect — the five design-intent sections render when an intent graph is supplied (FIGML).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { buildInspect } from "../../src/commands/inspect.mjs";
import { ingestDesign } from "../../src/design/ingest.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const XML = readFileSync(join(HERE, "..", "fixtures", "mahasiswa-tarif", "raw.xml"), "utf8");
const { intentGraph } = ingestDesign(XML, "mahasiswa-tarif.xml");

function transcript() {
  return {
    version: 3,
    meta: { source: "figml", tier: 0, image: "mahasiswa-tarif.xml", textQuality: "exact" },
    tokens: { colors: [], fonts: [] },
    layout: [],
    images: [],
    icons: [],
  };
}

test("inspect: the five design-intent sections render when an intent graph is supplied", () => {
  const { markdown, json } = buildInspect(transcript(), { intentGraph });
  for (const section of ["## Topology", "## Layout constraints", "## Exact visible content", "## Runtime state", "## Uncertainty"]) {
    assert.ok(markdown.includes(section), `renders ${section}`);
  }
  assert.ok(json.intent.topology.histogram.length > 0, "topology histogram present");
  assert.ok(Array.isArray(json.intent.layoutConstraints), "layout constraints present");
  assert.ok(json.intent.exactContent.textCount > 0, "exact content count present");
  assert.ok(json.intent.runtimeState.length > 0, "runtime state present");
});

test("inspect: no design-intent sections are emitted without an intent graph", () => {
  const { markdown, json } = buildInspect(transcript(), {});
  assert.ok(!markdown.includes("## Topology"), "no topology section");
  assert.equal(json.intent, null, "intent projection is null");
});
