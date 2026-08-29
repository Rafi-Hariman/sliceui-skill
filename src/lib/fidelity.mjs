// fidelity — measure how much of a FIGML design's visual data survives XML → transcript.
// Layer 1 of the fidelity benchmark: a deterministic, CI-able attribute-coverage score
// (the "did the parser drop it?" question), NOT a pixel-diff (that needs a browser +
// a ground-truth render of the design — a separate, heavier layer).
//
// Method: parse the raw XML (ground truth) and the transcript in parallel, match nodes by
// their FIGML id (transform ":"/" ;" → "_" exactly as idOf does), and for each node check
// which visual attributes made it through. Nodes that are *supposed* to be dropped
// (hidden layers, BOOLEAN/VARIANT/INSTANCE_SWAP, metadata wrappers) are excluded from the
// denominator so intentional pruning never counts against fidelity.

import { XMLParser } from "fast-xml-parser";
import { parseFigml } from "./figml-parse.mjs";

const PARSER = new XMLParser({
  preserveOrder: true,
  ignoreAttributes: false,
  attributeNamePrefix: "",
  parseTagValue: false,
  parseAttributeValue: false,
});

// Same skip/drop sets as figml-parse.mjs — a node in these lists is intentionally not transcribed.
const SKIP_TAGS = new Set([
  "strokes", "constraints", "fontName", "letterSpacing", "fill",
  "lineHeight", "overrides", "override", "overriddenFields", "overriddenField",
  "mainComponent", "componentProperties", "variantProperties", "textStyles",
]);
const DROP_TYPES = new Set(["BOOLEAN", "VARIANT", "INSTANCE_SWAP"]);

/** Visual attribute kinds we score, per node category. */
const ATTRS = {
  text: ["text", "fontSize", "fontWeight", "color", "lineHeight", "letterSpacing"],
  box: ["bg", "axis", "radius", "padding", "gap"], // frame/instance
  shape: ["bg", "radius"], // rectangle/line
};

/**
 * Score visual-attribute preservation.
 * @param {string} xml
 * @param {string} filename
 * @returns {{ score: number, total: number, preserved: number, byAttr: Record<string,{expected:number,preserved:number}>, droppedNodes: number }}
 */
export function computeFidelity(xml, filename) {
  const ground = extractGroundTruth(xml);
  const transcript = parseFigml(xml, filename);
  const tNodes = transcript.ok ? indexTranscript(transcript.transcript.layout) : {};

  const byAttr = {};
  let total = 0;
  let preserved = 0;
  let droppedNodes = 0;

  const seen = new Set();
  for (const [id, gt] of Object.entries(ground)) {
    const node = tNodes[id];
    if (!node) {
      droppedNodes++; // hidden/dropped node — excluded from the denominator
      continue;
    }
    for (const attr of gt.attrs) {
      total++;
      byAttr[attr] = byAttr[attr] ?? { expected: 0, preserved: 0 };
      byAttr[attr].expected++;
      if (preservedFor(node, attr)) {
        preserved++;
        byAttr[attr].preserved++;
      }
    }
  }

  return {
    score: total ? Math.round((preserved / total) * 1000) / 1000 : 0,
    total,
    preserved,
    droppedNodes,
    byAttr,
  };
}

// ---------- ground truth (raw XML) ----------

/** Walk the preserveOrder tree, returning id → { attrs: string[] } for visual nodes. */
function extractGroundTruth(xml) {
  const parsed = PARSER.parse(xml);
  const rootChildren = findRootChildren(parsed);
  const out = {};
  const walk = (nodes) => {
    for (const node of nodes ?? []) {
      if (!node || typeof node !== "object") continue;
      const tag = Object.keys(node).find((k) => k !== ":@") ?? "";
      if (SKIP_TAGS.has(tag)) continue;
      if (tag === "children") {
        walk(Array.isArray(node.children) ? node.children : []);
        continue;
      }
      const attrs = node[":@"] || {};
      if (attrs.visible === "false") continue;
      const type = attrs.type || classifyByTag(tag);
      if (DROP_TYPES.has(type)) continue;

      const id = normalizeId(attrs.id);
      const kids = Array.isArray(node[tag]) ? node[tag] : [];
      const visualAttrs = attrsForRaw(type, tag, attrs, kids);
      if (id && visualAttrs.length) out[id] = { attrs: visualAttrs };
      walk(kids);
    }
  };
  walk(rootChildren);
  return out;
}

/** Which visual attributes does this raw node carry (that the transcript should preserve)? */
function attrsForRaw(type, tag, attrs, kids) {
  const present = [];
  if (type === "TEXT") {
    if (attrs.characters != null) present.push("text");
    if (num(attrs.fontSize)) present.push("fontSize");
    if (attrs.fontWeight) present.push("fontWeight");
    if (hasFill(attrs)) present.push("color");
    if (childLineHeight(kids) > 0) present.push("lineHeight");
    if (childLetterSpacing(kids) !== 0) present.push("letterSpacing");
    return present;
  }
  if (type === "FRAME" || type === "INSTANCE") {
    if (hasFill(attrs)) present.push("bg");
    if (attrs.layoutMode) present.push("axis");
    if (num(attrs.cornerRadius)) present.push("radius");
    if (hasPadding(attrs)) present.push("padding");
    if (num(attrs.itemSpacing)) present.push("gap");
    return present;
  }
  if (type === "RECTANGLE" || type === "LINE") {
    if (hasFill(attrs)) present.push("bg");
    if (num(attrs.cornerRadius)) present.push("radius");
    return present;
  }
  return present;
}

// ---------- transcript ----------

/** Index transcript nodes by id (recursive). */
function indexTranscript(nodes, out = {}) {
  for (const n of nodes ?? []) {
    if (n && n.id) out[n.id] = n;
    if (n?.children) indexTranscript(n.children, out);
  }
  return out;
}

/** Did this transcript node preserve the given raw attribute? */
function preservedFor(node, attr) {
  switch (attr) {
    case "text": return Boolean(node.text);
    case "fontSize": return Boolean(node.style?.size);
    case "fontWeight": return Boolean(node.style?.weight);
    case "color": return Boolean(node.style?.color);
    case "lineHeight": return Boolean(node.style?.lineHeight);
    case "letterSpacing": return Boolean(node.style?.letterSpacing);
    case "bg": return Boolean(node.bg);
    case "axis": return Boolean(node.axis);
    case "radius": return Boolean(node.radius);
    case "padding": return Boolean(node.padding);
    case "gap": return Boolean(node.gap);
    default: return false;
  }
}

// ---------- helpers ----------

function findRootChildren(parsed) {
  if (!Array.isArray(parsed)) return null;
  for (const entry of parsed) {
    if (!entry || typeof entry !== "object") continue;
    for (const key of Object.keys(entry)) {
      if (key === "?xml" || key === "?figml") continue;
      const arr = entry[key];
      const item = Array.isArray(arr) ? arr[0] : arr;
      if (item && Array.isArray(item.children)) return item.children;
    }
  }
  return null;
}

/** "17214:15840" → "17214_15840" (mirrors idOf's sanitizer). */
function normalizeId(id) {
  return id ? String(id).replace(/[^a-zA-Z0-9_-]/g, "_") : null;
}

function classifyByTag(tag) {
  const t = tag || "";
  if (/Text/i.test(t)) return "TEXT";
  if (/Rectangle/i.test(t)) return "RECTANGLE";
  if (/Line/i.test(t)) return "LINE";
  if (/Vector|Icon/i.test(t)) return "VECTOR";
  if (/Frame/i.test(t)) return "FRAME";
  return "INSTANCE";
}

function hasFill(attrs) {
  return colorOf(attrs) != null;
}

function colorOf(attrsOrNode) {
  const src = attrsOrNode || {};
  const fills = src.fills;
  let arr;
  if (Array.isArray(fills)) arr = fills;
  else if (fills && Array.isArray(fills.fills)) arr = fills.fills;
  else if (fills && typeof fills === "object") arr = [fills];
  else arr = [];
  for (const f of arr) {
    const fat = f && (f[":@"] || f);
    if (fat && fat.color && fat.visible !== "false") return fat.color;
  }
  return null;
}

function hasPadding(attrs) {
  return ["paddingTop", "paddingRight", "paddingBottom", "paddingLeft", "horizontalPadding", "verticalPadding"]
    .some((k) => num(attrs[k]) > 0);
}

/** Read a numeric child-element attr: <lineHeight unit="PIXELS" value="20"/> etc. */
function childAttr(kids, tag, key) {
  for (const k of kids ?? []) {
    if (!k || !k[tag]) continue;
    const a = k[":@"] || {};
    if (a[key] !== undefined) return num(a[key]);
  }
  return null;
}

/** lineHeight in px (0 = AUTO, not a real visual value). */
function childLineHeight(kids) {
  for (const k of kids ?? []) {
    if (!k || !k.lineHeight) continue;
    const a = k[":@"] || {};
    if (a.unit === "AUTO") return 0;
    return num(a.value);
  }
  return 0;
}

/** letterSpacing (0 = default, not a real visual value). */
function childLetterSpacing(kids) {
  return childAttr(kids, "letterSpacing", "value") ?? 0;
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
