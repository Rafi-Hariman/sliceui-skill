// mahasiswa-tarif-intent — the real field export through the full design-intent pipeline.
//
// This is the ONE regression the pack's "Pengelolaan kelas" page stands in for: a real FIGML export
// with a filter row, a search, an 8-column table, and a pagination footer. Every assertion is
// derived from the fixture's evidence — no text, id, or dimension is hardcoded into the compiler.
// (The pack's page itself — filter rows 1:1:1 / 1:1, 10 rows, total 30 — is not in this repo; its
// topology cases are covered by the synthetic fixtures in topology.test.mjs.)

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { ingestDesign } from "../../src/design/ingest.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const XML = readFileSync(join(HERE, "..", "fixtures", "mahasiswa-tarif", "raw.xml"), "utf8");

function ingested() {
  const r = ingestDesign(XML, "mahasiswa-tarif.xml");
  assert.equal(r.ok, true);
  return r;
}

test("mahasiswa-tarif: the filter row is LINEAR with a 1:1:1:1 sibling ratio", () => {
  const { topologies } = ingested();
  const row = topologies.find((t) => t.rootNodeId === "16601_46210");
  assert.equal(row.family, "LINEAR");
  const ratio = row.constraints.find((c) => c.type === "SIBLING_RATIO");
  assert.deepEqual(ratio.value, [1, 1, 1, 1], "3 fields + action are equal FILL widths");
});

test("mahasiswa-tarif: the table is REPEATED with 8 headers and 5 designed-visible rows", () => {
  const { topologies, intentGraph } = ingested();
  const table = topologies.find((t) => t.rootNodeId === "16601_46224");
  assert.equal(table.family, "REPEATED");

  const t = intentGraph.tables.find((x) => x.tableNodeId === "16601_46224");
  assert.ok(t, "the table intent is extracted");
  assert.deepEqual(t.headers.map((h) => h.value), ["No.", "NIM", "Nama", "Fakultas", "Program studi", "Skema", "Nominal akhir (Rp)", "Status"]);
  assert.equal(t.designedVisibleRows.length, 5, "five designed-visible rows (not mocks)");
});

test("mahasiswa-tarif: exact designed rows use the reserved synthetic values, never replaced", () => {
  const { intentGraph } = ingested();
  const t = intentGraph.tables.find((x) => x.tableNodeId === "16601_46224");
  const names = t.designedVisibleRows.map((r) => r.cells[2].value);
  assert.deepEqual(names, ["Mahasiswa Contoh A", "Mahasiswa Contoh B", "Mahasiswa Contoh C", "Mahasiswa Contoh D", "Mahasiswa Contoh E"]);
});

test("mahasiswa-tarif: the pagination footer compiles to runtime state total 215 / page 5", () => {
  const { intentGraph } = ingested();
  const state = intentGraph.states.find((s) => s.kind === "PAGINATION_RUNTIME");
  assert.ok(state, "pagination runtime state present");
  assert.equal(state.total, 215);
  assert.equal(state.pageSize, 5);
  assert.equal(state.visibleStart, 1);
  assert.equal(state.visibleEnd, 5);
});

test("mahasiswa-tarif: the design's visible content is retained (evidence retention)", () => {
  const { intentGraph } = ingested();
  const title = intentGraph.content.find((c) => c.value.includes("Tambah mahasiswa tarif"));
  assert.ok(title, "the page title survives");
  assert.equal(title.authority, "A1_DESIGN");
  assert.equal(title.exact, true);
});
