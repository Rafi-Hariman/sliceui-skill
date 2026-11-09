// FIGML empirical schema analyzer — READ-ONLY research script.
// Parses every XML fixture in the repo with fast-xml-parser (same library the
// production parser uses, same safe flags: preserveOrder, no attr value coercion,
// no DTD/external entity resolution) and inventories tags/attributes/types.
// SYNTHETIC files are labeled by the caller and tracked separately.
import { XMLParser } from "fast-xml-parser";
import { readFileSync, writeFileSync } from "node:fs";

const PARSER = new XMLParser({
  preserveOrder: true,
  ignoreAttributes: false,
  attributeNamePrefix: "",
  parseTagValue: false,
  parseAttributeValue: false,
});

function classifyValue(v) {
  if (v === undefined) return "absent";
  const s = String(v);
  if (/^-?\d+$/.test(s)) return "integer";
  if (/^-?\d*\.\d+$/.test(s)) return "decimal";
  if (/^(true|false)$/i.test(s)) return "boolean";
  if (s === "") return "empty-string";
  if (/^#[0-9a-fA-F]{6}$/.test(s)) return "hex-color-6";
  if (/^#[0-9a-fA-F]{8}$/.test(s)) return "hex-color-8";
  if (/^[0-9]+:[0-9]+$/.test(s)) return "figma-node-id";
  return "string";
}

function analyze(files) {
  const elements = {};
  const rootElements = [];
  const diagnostics = [];
  const fileStats = [];
  let totalElements = 0, totalTextChars = 0, maxDepth = 0, totalAttrs = 0;

  for (const { path, synthetic } of files) {
    let xml;
    try { xml = readFileSync(path, "utf8"); }
    catch (e) { diagnostics.push(`${path}: read-error ${e.message}`); continue; }
    const stat = { path, synthetic: Boolean(synthetic), bytes: Buffer.byteLength(xml), elements: 0, textNodes: 0, maxDepth: 0, hasXmlDecl: false, hasFigmlPI: false, hasDoctype: false, hasEntity: false };
    if (xml.includes("<?xml ")) stat.hasXmlDecl = true;
    if (xml.includes("<?figml")) stat.hasFigmlPI = true;
    if (/<!DOCTYPE/i.test(xml)) { stat.hasDoctype = true; diagnostics.push(`${path}: contains DOCTYPE`); }
    if (/<!ENTITY/i.test(xml)) { stat.hasEntity = true; diagnostics.push(`${path}: contains ENTITY`); }

    let parsed;
    try { parsed = PARSER.parse(xml); }
    catch (e) { diagnostics.push(`${path}: parse-error ${e.message}`); fileStats.push(stat); continue; }

    const seenText = { chars: 0 };
    let isRoot = true;
    const walk = (nodes, depth, parentTag) => {
      stat.maxDepth = Math.max(stat.maxDepth, depth);
      maxDepth = Math.max(maxDepth, depth);
      for (const node of nodes) {
        if (!node || typeof node !== "object") continue;
        const keys = Object.keys(node);
        for (const key of keys) {
          if (key === ":@") continue;
          if (key === "#text") {
            stat.textNodes++; seenText.chars += String(node[key]).length;
            continue;
          }
          const attrs = node[":@"] ?? {};
          let el = elements[key];
          if (!el) { el = elements[key] = { count: 0, syntheticCount: 0, parentElements: new Set(), childElements: new Set(), attributes: {} }; }
          el.count++; totalElements++;
          if (synthetic) el.syntheticCount++;
          if (parentTag) el.parentElements.add(parentTag);
          if (isRoot && !parentTag) { rootElements.push({ file: path, tag: key }); }
          isRoot = false;
          stat.elements++;
          for (const [a, v] of Object.entries(attrs)) {
            totalAttrs++;
            let at = el.attributes[a];
            if (!at) at = el.attributes[a] = { count: 0, observedTypes: new Set(), examples: [] , files: new Set()};
            at.count++;
            at.observedTypes.add(classifyValue(v));
            at.files.add(path.split("/").slice(-2).join("/"));
            const sv = String(v);
            if (at.examples.length < 5 && !at.examples.includes(sv) && sv.length <= 40) at.examples.push(sv);
          }
          // attribute ORDER observation on first N nodes of each tag (check scene order later)
          const arr = Array.isArray(node[key]) ? node[key] : [];
          walk(arr, depth + 1, key);
        }
      }
    };
    walk(parsed, 1, null);
    stat.textChars = seenText.chars;
    totalTextChars += seenText.chars;
    fileStats.push(stat);
  }

  // serialize sets
  for (const [name, el] of Object.entries(elements)) {
    el.parentElements = [...el.parentElements].sort();
    el.childElements = []; // filled below via a second pass? keep simple: derive from walk again
  }
  // second pass to collect child tags
  for (const { path } of files) {
    let xml; try { xml = readFileSync(path, "utf8"); } catch { continue; }
    let parsed; try { parsed = PARSER.parse(xml); } catch { continue; }
    const walk = (nodes, parentTag) => {
      for (const node of nodes) {
        if (!node || typeof node !== "object") continue;
        for (const key of Object.keys(node)) {
          if (key === ":@" || key === "#text") continue;
          if (parentTag && elements[parentTag]) elements[parentTag].childElements.push(key);
          const arr = Array.isArray(node[key]) ? node[key] : [];
          walk(arr, key);
        }
      }
    };
    walk(parsed, null);
  }
  for (const el of Object.values(elements)) {
    el.childElements = [...new Set(el.childElements)].sort();
    for (const at of Object.values(el.attributes)) {
      at.observedTypes = [...at.observedTypes];
      at.files = [...at.files];
    }
  }

  return {
    format: "figml-observed",
    analyzer: "fast-xml-parser 5.11.1 preserveOrder (same config as production src/lib/figml-parse.mjs:15-21)",
    analyzedFiles: files.map((f) => f.path),
    rootElements,
    elements,
    totals: { totalElements, totalAttributes: totalAttrs, totalTextChars, maxDepth, files: fileStats.length },
    fileStats,
    diagnostics,
  };
}

const files = process.argv.slice(2).map((p) => ({ path: p, synthetic: false }));
const result = analyze(files);
writeFileSync("research/figml-audit/observed-figml-schema.json", JSON.stringify(result, null, 2) + "\n");
// console summary
console.log(`files=${result.totals.files} elements=${result.totals.totalElements} attrs=${result.totals.totalAttributes} maxDepth=${result.totals.maxDepth}`);
for (const [tag, el] of Object.entries(result.elements).sort((a, b) => b[1].count - a[1].count)) {
  const attrs = Object.keys(el.attributes).length;
  console.log(`  ${tag}: count=${el.count} (synthetic=${el.syntheticCount}) attrs=${attrs} parents=[${el.parentElements.slice(0, 4).join(",")}]`);
}
for (const d of result.diagnostics) console.log("  DIAG:", d);
