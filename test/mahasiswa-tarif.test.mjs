// mahasiswa-tarif — the real field export that drove the 2026-09-24 fixes.
//
// `figml-export (6).xml` is a genuine FIGML export of the "Tambah mahasiswa tarif" page. It is
// the ground truth for three defects the earlier synthetic fixtures could only approximate:
//   1. report §4.1 — the page <frame> carries its own 20px padding on all four sides, which the
//      parser dropped (only its children were walked), so the generator substituted `5px`.
//   2. report §4.5 — a field's required-ness lives on <variantProperties Type="…" required="…"/>,
//      nowhere else, so the generator reconstructed the design's hidden asterisk.
//   3. report §4.2 — the "Get data" icon's glyph is <variantProperties Name="sync"/> on a
//      colorless INSTANCE wrapper; its colored Vector child must inherit that name to resolve,
//      else it falls to native-plain (and a wrong fa-sync-alt — FA5 — on a font-awesome@4.7 project).
//
// This test loads the raw export once and proves the whole chain: parse → resolve → verify.
// FIX-001: the fixture's mock student table uses deterministic SYNTHETIC values (no real names,
// NIMs, or amounts) — see the structural checks below, which assert the sanitized shape without
// ever embedding a former private value.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseFigml } from "../src/lib/figml-parse.mjs";
import { resolveTranscript } from "../src/lib/resolve.mjs";
import { verifyComponent } from "../src/framework/angular/verify.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const RAW_XML = readFileSync(join(HERE, "fixtures", "mahasiswa-tarif", "raw.xml"), "utf8");

function walk(nodes, fn) {
  for (const n of nodes ?? []) {
    if (!n || typeof n !== "object") continue;
    fn(n);
    walk(n.children, fn);
  }
}

function parse() {
  const r = parseFigml(RAW_XML, "mahasiswa-tarif.xml");
  assert.equal(r.ok, true, r.message ?? "parse failed");
  return r.transcript;
}

// ---------- parse: root padding (§4.1) ----------

test("mahasiswa-tarif: the page frame's own 20px padding reaches the transcript", () => {
  const transcript = parse();
  assert.deepEqual(
    transcript.layout[0].padding,
    { top: 20, right: 20, bottom: 20, left: 20 },
    "root <frame> paddingTop/Right/Bottom/Left=20 must attach to the root content node",
  );
});

// ---------- parse: required flag (§4.5) ----------

test("mahasiswa-tarif: a field's required flag is read from <variantProperties>", () => {
  const transcript = parse();
  const inputs = [];
  walk(transcript.layout, (n) => { if (n.type === "input") inputs.push(n); });

  assert.equal(inputs.length, 4, "the page has four input fields (3 filters + search)");
  const byLabel = new Map(inputs.map((n) => [n.label, n.required]));
  assert.equal(byLabel.get("Tahun akademik semester masuk"), true, "required year → true");
  assert.equal(byLabel.get("Program studi"), false, "optional prodi → false");
  assert.equal(byLabel.get("NIM"), false, "optional NIM → false");
});

// ---------- resolve: icon glyph (§4.2) ----------

test("mahasiswa-tarif: the 'Get data' icon resolves to fa-refresh, not native-plain", () => {
  const transcript = parse();
  const r = resolveTranscript(transcript, { ngDeepCorpus: [], classVocabulary: [] });

  // The sync icon instance wraps a generic "Vector" child; the child must inherit variantName=sync.
  const syncLeaf = r.leaves.find((l) => l.id === "I16601_46214_708_13980_7_5286");
  assert.ok(syncLeaf, "the sync icon's Vector leaf is resolved");
  assert.deepEqual(
    (syncLeaf.resolved ?? []).map((x) => x.value),
    ["fa-refresh"],
    "variantName=sync must resolve to the FA4 glyph fa-refresh",
  );
});

test("mahasiswa-tarif: a field's variantName does NOT leak onto its nested caret icon", () => {
  // The dropdown fields carry variantName="dropdown" / "Active" — a component variant, not a
  // glyph. Inheriting it onto the caret-down icon would corrupt the caret into a bogus glyph.
  const transcript = parse();
  const r = resolveTranscript(transcript, { ngDeepCorpus: [], classVocabulary: [] });
  for (const leaf of r.leaves) {
    if ((leaf.resolved ?? []).some((x) => x.value === "fa-caret-down")) {
      assert.deepEqual(
        leaf.resolved.map((x) => x.value),
        ["fa-caret-down"],
        `caret icon ${leaf.id} must stay fa-caret-down`,
      );
    }
  }
});

// ---------- verify: tableOptions (paginationAlign evidence) ----------

const CONVENTIONS = { ngDeepCorpus: [], classVocabulary: [], componentAnatomy: { tableTag: "uii-table", pagination: true, mockRowsFloor: 15 } };
const GOOD_TS = "export class A {}";

test("mahasiswa-tarif: the SPACE_BETWEEN footer demands [paginationAlign]='right'", () => {
  const transcript = parse();
  const without = verifyComponent({
    scss: ".content { padding: 20px; }",
    html: `<uii-table [rows]="rows" [columns]="columns" [searchOptions]="true" [paginationOptions]="true"></uii-table>`,
    ts: GOOD_TS, conventions: CONVENTIONS, transcript, rawXml: RAW_XML,
  }).checks.find((c) => c.name === "tableOptions");
  assert.equal(without.status, "fail", "missing paginationAlign must fail against the real footer");

  const withRight = verifyComponent({
    scss: ".content { padding: 20px; }",
    html: `<uii-table [rows]="rows" [columns]="columns" [searchOptions]="true" [paginationOptions]="true" [paginationAlign]="'right'"></uii-table>`,
    ts: GOOD_TS, conventions: CONVENTIONS, transcript, rawXml: RAW_XML,
  }).checks.find((c) => c.name === "tableOptions");
  assert.equal(withRight.status, "pass", "[paginationAlign]='right' must pass");
});

// ---------- verify: containerPadding (§4.1) ----------

test("mahasiswa-tarif: containerPadding catches the 5px fallback and accepts 20px", () => {
  const transcript = parse();
  const html = `<div class="content"><h1 class="h1">Tambah mahasiswa tarif</h1></div>`;
  const buggy = verifyComponent({
    scss: `.content { padding: 5px 20px 20px 20px; }`, html, ts: GOOD_TS,
    conventions: CONVENTIONS, transcript, rawXml: RAW_XML,
  }).checks.find((c) => c.name === "containerPadding");
  assert.equal(buggy.status, "warn", `the 5px fallback must warn — ${buggy.detail}`);

  const fixed = verifyComponent({
    scss: `.content { padding: 20px; }`, html, ts: GOOD_TS,
    conventions: CONVENTIONS, transcript, rawXml: RAW_XML,
  }).checks.find((c) => c.name === "containerPadding");
  assert.equal(fixed.status, "pass", `padding: 20px must pass — ${fixed.detail}`);
});

// ---------- FIX-001: fixture privacy (synthetic mock data) ----------

test("FIX-001: the mock student table uses reserved synthetic values, never real data", () => {
  // Positive markers prove the fixture is the sanitized version; structural invariants prove the
  // five-row mock table is intact. No former private literal is embedded here.
  assert.match(RAW_XML, /Mahasiswa Contoh [A-E]/, "synthetic person names present");
  assert.match(RAW_XML, /Fakultas Contoh/, "synthetic faculty labels present");
  assert.match(RAW_XML, /Program Studi Contoh/, "synthetic program labels present");
  assert.match(RAW_XML, /Skema Contoh/, "synthetic scheme labels present");

  const chars = [...RAW_XML.matchAll(/characters="([^"]*)"/g)].map((m) => m[1]);
  // Five mock rows survived: five synthetic person cells, in a stable order.
  const names = chars.filter((t) => /^Mahasiswa Contoh [A-E]$/.test(t));
  assert.equal(names.length, 5, "five synthetic student rows preserved");

  // Every standalone 8-digit cell is one of the reserved synthetic identifiers — a real-looking
  // student id could not slip back in without tripping this bounded, non-reconstructing guard.
  const idCells = chars.filter((t) => /^\d{8}$/.test(t));
  assert.equal(idCells.length, 5, "exactly five identifier cells remain");
  const reserved = new Set(["00000001", "00000002", "00000003", "00000004", "00000005"]);
  assert.ok(idCells.every((t) => reserved.has(t)), "every identifier is a reserved synthetic id");

  // Financial cells preserve the dotted-thousands format without a real amount.
  const amountCells = chars.filter((t) => /^\d{1,2}\.\d{3}\.\d{3}$/.test(t));
  assert.equal(amountCells.length, 5, "five financial cells remain");
  assert.ok(amountCells.every((t) => ["10.000.000", "11.000.000", "12.000.000", "15.000.000"].includes(t)),
    "every amount is a reserved synthetic amount");
});
