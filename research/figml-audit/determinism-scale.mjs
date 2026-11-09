// Determinism + scale test for parseFigml — READ-ONLY, no files written to .sliceui.
// SYNTHETIC XML is generated from OBSERVED structure only (no claim of FIGML provenance).
import { parseFigml } from "../../src/lib/figml-parse.mjs";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { performance } from "node:perf_hooks";

const shasum = (s) => createHash("sha256").update(s).digest("hex");

// ---- build synthetic XML matching observed schema (mahasiswa-tarif shape) ----
function syntheticFrame(depth, width) {
  const children = [];
  const n = width;
  for (let i = 0; i < n; i++) {
    const cid = 90000 + i;
    const hasKids = depth > 0;
    const kids = hasKids
      ? `<children>${syntheticFrame(depth - 1, 2)}</children>`
      : `<children><Text id="${cid}:t" name="Item_${i}" x="12" y="${i * 40}" width="200" height="20" characters="Label ${i}" type="TEXT" fontSize="14" fontWeight="400"><fills><fill color="#000000"/></fills></Text></children>`;
    children.push(`<Frame id="${cid}" name="Row_${i}" x="0" y="${i * 44}" width="${1000}" height="44" layoutMode="HORIZONTAL" layoutSizingHorizontal="FILL" primaryAxisAlignItems="CENTER" itemSpacing="10" type="FRAME">${kids}</Frame>`);
  }
  return children.join("");
}

function syntheticXml(totalLeafTarget) {
  // binary-ish tree: root frame with N direct frame children, each with 2 text children
  const rows = totalLeafTarget / 2;
  const inner = syntheticFrame(0, rows);
  return `<?xml version="1.0" encoding="UTF-8"?><?figml version="1.0"?><frame id="1:1" name="Root" width="1280" height="2000" layoutMode="VERTICAL" paddingLeft="20" paddingRight="20" paddingTop="20" paddingBottom="20" primaryAxisSizingMode="FIXED" itemSpacing="10" type="FRAME"><children>${inner}</children></frame>`;
}

function runParse(xml, filename) {
  const t0 = performance.now();
  const r = parseFigml(xml, filename);
  const ms = performance.now() - t0;
  if (!r.ok) return { ok: false, ms, reason: r.reason, message: r.message };
  const json = JSON.stringify(r.transcript);
  let nodeCount = 0;
  const walk = (nodes) => { for (const n of nodes) { nodeCount++; if (n.children) walk(n.children); } };
  walk(r.transcript.layout);
  return { ok: true, ms, nodeCount, transcriptBytes: Buffer.byteLength(json), jsonHash: shasum(json) };
}

const results = { determinism: {}, scale: [] };

// ---- 1. Determinism: same real XML 3x ----
for (const [label, path] of [
  ["mahasiswa-tarif", "test/fixtures/mahasiswa-tarif/raw.xml"],
  ["tester", "tester.xml"],
]) {
  const xml = readFileSync(path, "utf8");
  const runs = [];
  for (let i = 0; i < 3; i++) {
    const r = runParse(xml, path);
    runs.push(r);
  }
  const hashes = [...new Set(runs.map((r) => r.jsonHash))];
  results.determinism[label] = {
    inputBytes: Buffer.byteLength(xml),
    runs: runs.map((r) => ({ ms: Math.round(r.ms * 100) / 100, nodeCount: r.nodeCount, transcriptBytes: r.transcriptBytes, hash: r.jsonHash.slice(0, 16) })),
    byteIdentical: hashes.length === 1,
  };
}

// ---- 2. Scale: synthetic 100 / 1000 / 5000 / 10000 leaf text nodes ----
for (const target of [100, 1000, 5000, 10000]) {
  const xml = syntheticXml(target);
  const mb = process.memoryUsage().heapUsed / 1048576;
  const t0 = performance.now();
  const r = parseFigml(xml, "SYNTHETIC-not-figml.xml");
  const ms = performance.now() - t0;
  const after = process.memoryUsage().heapUsed / 1048576;
  if (!r.ok) {
    results.scale.push({ target, ok: false, ms: Math.round(ms), reason: r.reason, message: String(r.message).slice(0, 120) });
    break;
  }
  const json = JSON.stringify(r.transcript);
  results.scale.push({
    target,
    ok: true,
    ms: Math.round(ms),
    nodeCount: r.nodeCount,
    inputBytes: Buffer.byteLength(xml),
    transcriptBytes: Buffer.byteLength(json),
    transcriptLines: json.split("\n").length,
    heapMB: Math.round(after * 10) / 10,
    compressionRatio: Math.round((Buffer.byteLength(xml) / Buffer.byteLength(json)) * 100) / 100,
  });
}

console.log(JSON.stringify(results, null, 2));
