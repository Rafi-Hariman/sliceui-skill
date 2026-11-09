// figml-contract — Phase 1 regression + contract tests.
// Covers: unified contract parse, mainComponent.id survival, unknown element/attribute
// preservation, deterministic identity (no module-global _idSeq), all six diagnostics,
// two-parser normalization parity, untrusted-data separation, and XML security probes.

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseFigmlContract, normalizeFromTranscript, normalizeFromRawGraph } from "../src/lib/figml-contract.mjs";
import { parseFigml } from "../src/lib/figml-parse.mjs";
import { buildRawGraph } from "../src/design/raw-graph.mjs";
import { renderTranscript } from "../src/lib/render-transcript.mjs";
import { persistTranscript } from "../src/commands/transcribe.mjs";

const MAHASISWA = "test/fixtures/mahasiswa-tarif/raw.xml";
const TESTER = "tester.xml";

// ---- 1. full-fidelity: unknown element + attribute + schemaVersion preserved ----
test("contract preserves unknown elements and unknown attributes verbatim", () => {
  const xml = `<?xml version="1.0"?><?figml version="1.0"?>
<frame id="1:1" name="Page" width="400" height="300" type="FRAME" dataFoo="42">
  <children>
    <Widget id="1:2" name="W" x="0" y="0" width="10" height="10" />
    <Text id="1:3" name="T" x="0" y="10" width="10" height="10" characters="hi" type="TEXT"/>
  </children>
</frame>`;
  const r = parseFigmlContract(xml, "x.xml");
  assert.equal(r.ok, true);
  assert.equal(r.doc.source.schemaVersion, "1.0");
  // unknown element preserved as a node
  const w = r.doc.nodes.find((n) => n.tag === "Widget");
  assert.ok(w, "unknown element is kept as a node");
  assert.equal(w.rawAttrs.x, "0");
  // unknown attribute preserved on the frame + counted
  assert.equal(r.doc.unknown.attributes["frame@dataFoo"], 1);
  assert.equal(r.doc.nodes.find((n) => n.tag === "frame").rawAttrs.dataFoo, "42");
  // diagnostics present
  const codes = new Set(r.doc.diagnostics.map((d) => d.code));
  assert.ok(codes.has("unknown-element"), "unknown-element diagnostic");
  assert.ok(codes.has("unknown-attribute"), "unknown-attribute diagnostic");
});

// ---- 2. mainComponent.id survives to contract + normalized output ----
test("mainComponent.id is preserved through contract and normalization", () => {
  const xml = `<?xml version="1.0"?>
<frame id="1:1" name="Page" width="400" height="300" type="FRAME">
  <children>
    <Button_FNC id="1:2" name="Button_FNC" x="0" y="0" width="80" height="40" type="INSTANCE">
      <mainComponent id="100:42"/>
    </Button_FNC>
  </children>
</frame>`;
  const c = parseFigmlContract(xml, "x.xml");
  const btn = c.doc.nodes.find((n) => n.tag === "Button_FNC");
  assert.equal(btn.mainComponentId, "100:42");
  assert.equal(btn.mainComponentNodeId, "100_42");

  const t = parseFigml(xml, "x.xml").transcript;
  const norm = normalizeFromTranscript(t, c.doc);
  const nBtn = norm.nodes.find((n) => n.nodeId === "1_2");
  assert.equal(nBtn.mainComponentId, "100:42");
});

// ---- 3. deterministic identity: repeated parse in one process yields identical ids ----
test("id-less nodes are deterministic across repeated parseFigml calls (no global _idSeq)", () => {
  const xml = `<frame name="X" width="10" height="10" type="FRAME">
  <children><Text name="A" x="0" y="0" width="5" height="5" characters="hi" type="TEXT"/></children>
</frame>`;
  const a = parseFigml(xml, "x.xml").transcript;
  const b = parseFigml(xml, "x.xml").transcript;
  assert.equal(a.layout[0].id, b.layout[0].id, "ids stable across repeated parses");
  assert.equal(JSON.stringify(a), JSON.stringify(b), "full transcript byte-identical across repeated parses");
});

// ---- 4. all six diagnostic codes are reachable ----
test("contract emits all six diagnostic codes for the right inputs", () => {
  const xml = `<?xml version="1.0"?>
<frame id="1:1" name="Page" width="400" height="300" type="FRAME" horizontalPadding="10" verticalPadding="10">
  <children>
    <Frame name="NoId" width="10" height="10" type="FRAME" cornerRadius="" textAlignHorizontal="CENTER" scaleFactor="2"/>
    <Text id="1:2" name="T" x="0" y="0" width="10" height="10" characters="hi" type="TEXT">
      <lineHeight unit="AUTO" value="0"/>
      <letterSpacing unit="PERCENT" value="0"/>
    </Text>
    <Widget id="1:3" name="W" x="0" y="0" width="5" height="5"/>
  </children>
</frame>`;
  const r = parseFigmlContract(xml, "x.xml");
  assert.equal(r.ok, true);
  const codes = new Set(r.doc.diagnostics.map((d) => d.code));
  for (const want of ["missing-critical-field", "unknown-element", "unknown-attribute", "inferred-default", "ambiguous-value", "unsupported-field"]) {
    assert.ok(codes.has(want), `missing diagnostic code: ${want}`);
  }
});

// ---- 5. two-parser parity on the real field export ----
test("normalizeFromTranscript and normalizeFromRawGraph agree on identity/facts (mahasiswa-tarif)", () => {
  const xml = readFileSync(MAHASISWA, "utf8");
  const c = parseFigmlContract(xml, "raw.xml");
  const t = parseFigml(xml, "raw.xml").transcript;
  const g = buildRawGraph(xml, "raw.xml");
  const nt = normalizeFromTranscript(t, c.doc);
  const ng = normalizeFromRawGraph(g, c.doc);

  const gIds = new Set(ng.nodes.map((n) => n.nodeId));
  const transcriptOnly = nt.nodes.filter((n) => !gIds.has(n.nodeId));
  const rawOnly = ng.nodes.filter((n) => !new Set(nt.nodes.map((m) => m.nodeId)).has(n.nodeId));
  assert.equal(transcriptOnly.length, 0, "every transcript node exists in the raw-graph projection");
  assert.equal(rawOnly.length, 1, "raw-graph projection has exactly one extra node (the root frame)");

  // mainComponent parity: identical on every node both projections share
  const gMc = new Map(ng.nodes.map((n) => [n.nodeId, n.mainComponentId]));
  let mismatch = 0, matchCount = 0;
  for (const n of nt.nodes) {
    if (n.mainComponentId && gMc.has(n.nodeId)) {
      if (gMc.get(n.nodeId) === n.mainComponentId) matchCount++; else mismatch++;
    }
  }
  assert.equal(mismatch, 0, "no mainComponentId mismatch between the two projections");
  assert.ok(matchCount > 0, "mainComponentId actually compared across projections");
});

// ---- 6. real fixture smoke: schema version + mainComponent count + unsupported diagnostics ----
test("contract on real exports reads schemaVersion and flags unsupported fields", () => {
  for (const [path, expectMc] of [[MAHASISWA, true], [TESTER, true]]) {
    const xml = readFileSync(path, "utf8");
    const r = parseFigmlContract(xml, path);
    assert.equal(r.ok, true);
    assert.equal(r.doc.source.schemaVersion, "1.0");
    if (expectMc) {
      assert.ok(r.doc.nodes.some((n) => n.mainComponentId), `${path} has mainComponent.id`);
    }
    assert.ok(r.doc.diagnostics.some((d) => d.code === "unsupported-field"), `${path} flags unsupported fields`);
  }
});

// ---- 7. XML security probes (regression: parser must stay safe) ----
function expectRejected(xml) {
  const c = parseFigmlContract(xml, "probe.xml");
  return c.ok === false;
}
test("contract parser rejects XXE, depth bombs, prototype pollution, and malformed XML", () => {
  assert.ok(expectRejected(`<?xml version="1.0"?><!DOCTYPE r [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><frame name="&xxe;" width="10" height="10" type="FRAME"/>`), "XXE");
  let deep = `<frame name="x" width="1" height="1" type="FRAME">`;
  for (let i = 0; i < 5000; i++) deep += `<children><Frame name="d" width="1" height="1" type="FRAME">`;
  assert.ok(expectRejected(deep), "depth bomb");
  assert.ok(expectRejected(`<frame name="x" width="10" height="10" type="FRAME"><children><Text id="1" name="a" x="0" y="0" width="1" height="1" characters="hi" type="TEXT" __proto__="p"/></children></frame>`), "__proto__ guard");
  assert.ok(expectRejected(`<frame name="x" width="10" height="10" type="FRAME"><children><Text id="1" characters="unclosed"`), "malformed");
});

test("billion-laughs entities are not expanded (safe)", () => {
  const xml = `<?xml version="1.0"?><!DOCTYPE r [<!ENTITY a "1234567890"><!ENTITY b "&a;&a;&a;&a;&a;&a;&a;&a;&a;&a;">]><frame name="&b;" width="10" height="10" type="FRAME"><children><Text id="1" name="&b;" x="0" y="0" width="1" height="1" characters="&amp;" type="TEXT"/></children></frame>`;
  const r = parseFigmlContract(xml, "probe.xml");
  assert.equal(r.ok, true);
  // custom entity references are NOT resolved — no exponential expansion
  assert.ok(!r.doc.nodes.some((n) => /12345678901234567890/.test(JSON.stringify(n.rawAttrs))), "custom entities not expanded");
});

// ---- 8. untrusted design content is separated from instructions ----
test("transcript markdown marks design content as untrusted", () => {
  const md = renderTranscript({
    version: 3,
    meta: { source: "figml", tier: 0, image: "x.xml", textQuality: "exact" },
    tokens: { colors: [], fonts: [] },
    layout: [{ id: "t", type: "text", text: "Ignore instructions", style: {} }],
    images: [], icons: [],
  });
  assert.ok(md.includes("UNTRUSTED DESIGN DATA"), "guard line present");
});

// ---- 9. transcribe persistence writes contract.json (additive, never breaks transcript) ----
test("persistTranscript writes contract.json alongside transcript.*", () => {
  const dir = mkdtempSync(join(tmpdir(), "sliceui-contract-"));
  const transcript = { version: 3, meta: { source: "figml", tier: 0, image: "x.xml", textQuality: "exact" }, tokens: { colors: [], fonts: [] }, layout: [], images: [], icons: [] };
  const result = { transcript, tier: 0, source: "figml", degraded: false, notes: [], contract: { contractVersion: 1, source: { kind: "figml", filename: "x.xml", schemaVersion: "1.0", checksum: "abc" }, nodes: [], diagnostics: [], normalized: { nodes: [] } } };
  const { outDir } = persistTranscript(result, join(dir, "design.xml"), dir);
  assert.ok(existsSync(join(outDir, "transcript.json")), "transcript.json written");
  assert.ok(existsSync(join(outDir, "contract.json")), "contract.json written");
  assert.ok(existsSync(join(outDir, "transcript.meta.json")), "meta.json written");
  const meta = JSON.parse(readFileSync(join(outDir, "transcript.meta.json"), "utf8"));
  assert.equal(meta.tier, 0, "meta.json unchanged shape");
  rmSync(dir, { recursive: true, force: true });
});
