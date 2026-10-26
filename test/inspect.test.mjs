import { test } from "node:test";
import assert from "node:assert/strict";
import { buildInspect } from "../src/commands/inspect.mjs";

function transcript() {
  return {
    version: 3,
    meta: { source: "figml", tier: 0, image: "student-list.xml", width: 1440, height: 900, textQuality: "exact" },
    tokens: { colors: [], fonts: [] },
    layout: [
      { id: "h", type: "text", text: "Daftar Mahasiswa", style: { size: 20, weight: 600, color: "#222222" } },
      { id: "filter", type: "group", axis: "row", gap: 16, children: [
        { id: "sel", type: "input", label: "Program Studi", children: [{ id: "caret", type: "icon", description: "caret-down" }] },
        { id: "btn", type: "button", text: "Cari" },
      ] },
      { id: "tbl", type: "group", table: true, children: [
        { id: "hdr", type: "group", children: [{ id: "h1", type: "text", text: "Nama" }, { id: "h2", type: "text", text: "NIM" }] },
        { id: "r1", type: "group", children: [{ id: "c1", type: "text", text: "alice" }, { id: "c2", type: "text", text: "123" }] },
        { id: "r2", type: "group", children: [{ id: "c3", type: "text", text: "bob" }, { id: "c4", type: "text", text: "456" }] },
      ] },
      { id: "pg", type: "text", text: "Menampilkan 1-10 dari 20 data" },
    ],
    images: [],
    icons: [],
  };
}

test("inspect: header carries design, fidelity, and source", () => {
  const { markdown } = buildInspect(transcript());
  assert.ok(markdown.includes("# Inspect — student-list"), "design name");
  assert.ok(markdown.includes("- Fidelity: exact"), "figml fidelity is exact");
  assert.ok(markdown.includes("- Source: figml"), "source label");
});

test("inspect: structure tree exposes table headers + representative row, not an opaque leaf", () => {
  const { markdown, json } = buildInspect(transcript());
  assert.ok(markdown.includes('Heading "Daftar Mahasiswa"'), "heading label");
  assert.ok(markdown.includes('Select "Program Studi"'), "select = input + icon child");
  assert.ok(markdown.includes('Button "Cari"'), "button label");
  assert.ok(markdown.includes("Table"), "table flag labelled Table");
  assert.ok(markdown.includes('Pagination "Menampilkan 1-10 dari 20 data"'), "pagination text");
  // Table descendants are exposed compactly: headers + a representative row + count.
  assert.ok(markdown.includes("columns: Nama | NIM"), "table columns exposed");
  assert.ok(markdown.includes("rows (2): alice | 123"), "representative row + count exposed");
  assert.ok(!markdown.includes("bob"), "repetitive rows are not all dumped (only the representative row)");
  assert.ok(json.structure.some((s) => s.label === "Table" && s.depth === 0), "json structure carries table node");
});

test("inspect: required capabilities derive from the design inventory", () => {
  const { markdown, json } = buildInspect(transcript());
  assert.ok(markdown.includes("- select"), "select capability");
  assert.ok(markdown.includes("- table"), "table capability");
  assert.ok(markdown.includes("- pagination"), "pagination capability");
  assert.deepEqual(json.capabilities, ["pagination", "select", "table"], "json capabilities sorted + deduped");
});

test("inspect: critical visual facts surface the authored values", () => {
  const { markdown } = buildInspect(transcript());
  assert.ok(markdown.includes("font-size: 20px"), "heading font-size");
  assert.ok(markdown.includes("font-weight: 600"), "heading weight");
  assert.ok(markdown.includes("color: #222222"), "heading color");
  assert.ok(markdown.includes("gap: 16px"), "filter gap");
  assert.ok(markdown.includes("display: flex; flex-direction: row"), "filter axis");
});

test("inspect: degraded/static input is labelled honestly", () => {
  const t = transcript();
  t.meta = { source: "static", tier: 2, image: "x.png", textQuality: "unreadable" };
  const { markdown, json } = buildInspect(t);
  assert.ok(markdown.includes("Fidelity: degraded (unreadable text)"), "degraded fidelity");
  assert.equal(json.fidelity, "degraded (unreadable text)");
});

test("inspect: json projection is machine-readable and complete", () => {
  const { json } = buildInspect(transcript());
  assert.equal(json.design, "student-list");
  assert.ok(Array.isArray(json.structure), "structure array");
  assert.ok(Array.isArray(json.capabilities), "capabilities array");
  assert.ok(Array.isArray(json.visualFacts), "visualFacts array");
  assert.ok(Array.isArray(json.mappings), "mappings array");
  assert.ok(json.structure[0].depth === 0 && typeof json.structure[0].label === "string", "structure entries have depth + label");
});
