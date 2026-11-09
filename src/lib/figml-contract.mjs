// figml-contract — unified FIGML parsing contract (Phase 1 implementation).
//
// The audit (research/figml-audit/) found TWO independent XML parsers
//   - src/lib/figml-parse.mjs        (legacy transcript path, lossy on purpose)
//   - src/design/raw-graph.mjs       (design-intent path, "lossless")
// that classify nodes independently and BOTH drop `mainComponent.id` (the
// component→instance relationship). There was no shared vocabulary, no
// schema-version gate, a module-global id counter (`_idSeq`), and no
// diagnostics for unknown/unsupported fields.
//
// This module is the unifying layer that does NOT replace either parser:
//   - parseFigmlContract(xml, filename)   → full-fidelity ContractDoc (keeps every
//     element + attribute, mainComponent.id, schemaVersion, aggregated diagnostics)
//   - normalizeFromTranscript(t, doc)     → one minimal NormalizedDesign
//   - normalizeFromRawGraph(g, doc)       → the same minimal NormalizedDesign
//
// The minimal shape is identity/facts only (no visual interpretation): it exists so the
// two existing parsers can be proven equivalent on the fields that matter, and so
// downstream tooling has ONE stable projection. It is NOT SliceIR and NOT a new public
// command — just a library contract the existing pipelines can consume incrementally.
//
// Design content (names, text) is UNTRUSTED DATA here, never instructions.

import { XMLParser } from "fast-xml-parser";
import { createHash } from "node:crypto";

const PARSER = new XMLParser({
  preserveOrder: true,
  ignoreAttributes: false,
  attributeNamePrefix: "",
  parseTagValue: false,
  parseAttributeValue: false,
});

export const CONTRACT_VERSION = 1;

// Structural + metadata elements of the observed FIGML vocabulary. Everything else that
// carries no `type` attribute is "unknown".
const KNOWN_TAGS = new Set([
  "frame", "Frame", "Group", "Text", "Rectangle", "Vector", "Line",
  "children", "fills", "fill", "strokes", "stroke",
  "constraints", "fontName", "letterSpacing", "lineHeight",
  "overrides", "override", "overriddenFields", "overriddenField",
  "mainComponent", "componentProperties", "variantProperties", "textStyles",
]);

// Global attribute vocabulary observed in the field exports (observed-figml-schema.json).
// Anything else is an unknown-attribute diagnostic (value preserved verbatim).
const KNOWN_ATTRS = new Set([
  "id", "name", "x", "y", "width", "height", "type",
  "characters", "fontSize", "fontWeight", "fontName",
  "cornerRadius", "topLeftRadius", "topRightRadius", "bottomRightRadius", "bottomLeftRadius",
  "maskType", "expanded", "clipsContent", "visible", "opacity",
  "layoutMode", "layoutAlign", "layoutGrow", "layoutPositioning", "layoutWrap", "counterAxisSpacing",
  "layoutSizingHorizontal", "layoutSizingVertical",
  "paddingLeft", "paddingRight", "paddingTop", "paddingBottom",
  "horizontalPadding", "verticalPadding", "itemSpacing",
  "primaryAxisAlignItems", "counterAxisAlignItems",
  "primaryAxisSizingMode", "counterAxisSizingMode",
  "strokeWeight", "strokeAlign", "strokeJoin", "strokeCap", "stroke",
  "blendMode", "color",
  "value", "unit", "index", "required", "overriddenField",
  "family", "style", "hyperlink",
  "textAlignHorizontal", "textAlignVertical", "textAutoResize",
  // variantProperties / componentProperties (both casings observed)
  "Type", "Name", "Alphabet", "State", "Text_Only", "Checked", "Indeterminate", "icon", "Text",
]);

// Fields the legacy transcript path does not consume (audit: field-coverage "omitted-*").
// Emitted as `unsupported-field` diagnostics. Keyed `${tag}@${attr}` or bare `attr`.
const UNSUPPORTED_ATTRS = new Set([
  "constraints@horizontal", "constraints@vertical",
  "fontName@family", "fontName@style",
  "blendMode", "textAlignHorizontal", "textAlignVertical", "textAutoResize",
  "hyperlink", "maskType", "expanded", "clipsContent",
  "strokeJoin", "strokeCap", "strokeAlign",
  "layoutGrow", "layoutPositioning", "layoutAlign",
  "counterAxisSizingMode", "primaryAxisSizingMode", "layoutWrap", "counterAxisSpacing",
  "overriddenField@value", "overriddenField@index",
]);

/** Numeric attributes that can legally be empty-string in the export (ambiguous value). */
const NUMERIC_ATTRS = new Set(["cornerRadius", "fontWeight", "strokeWeight", "opacity"]);

const VISUAL_TYPES = new Set(["FRAME", "INSTANCE", "TEXT", "RECTANGLE", "LINE", "VECTOR", "GROUP"]);

/**
 * Parse FIGML XML into a full-fidelity ContractDoc. Never throws: malformed/unsafe XML is
 * rejected by fast-xml-parser and surfaced as `{ ok:false }`.
 * @param {string} xml
 * @param {string} filename
 * @returns {{ ok: true, doc: object } | { ok: false, reason: string, message: string }}
 */
export function parseFigmlContract(xml, filename) {
  let parsed;
  try {
    parsed = PARSER.parse(xml);
  } catch (err) {
    return { ok: false, reason: "parse-error", message: String(err?.message ?? err) };
  }

  const doc = {
    contractVersion: CONTRACT_VERSION,
    source: {
      kind: "figml",
      filename,
      schemaVersion: piVersion(parsed),
      checksum: sha256(xml),
    },
    nodes: [],
    childIndex: {}, // nodeId -> [child nodeIds] (document order)
    diagnostics: [],
    unknown: { elements: {}, attributes: {} },
    stats: { elements: 0, textChars: 0, maxDepth: 0 },
  };

  const ids = makeIdSeq();
  const diag = new DiagCollector();
  const root = findRootFrame(parsed);
  if (!root) return { ok: false, reason: "no-root", message: "No <frame> element found in XML" };

  const rootId = nodeIdFor(root.attrs.id, root.attrs.name, ids);
  makeNode(rootId, null, root.tag, root.attrs, root.kids, ids, diag, doc);

  doc.diagnostics = diag.toArray();
  doc.stats.textChars = textChars(doc);
  doc.stats.maxDepth = maxDepth(doc);
  return { ok: true, doc };
}

// ---------- internal walk ----------

/** Root frame element: the first entry whose value carries a <children> array. */
function findRootFrame(parsed) {
  if (!Array.isArray(parsed)) return null;
  for (const entry of parsed) {
    if (!entry || typeof entry !== "object") continue;
    for (const key of Object.keys(entry)) {
      if (key === "?xml" || key === "?figml") continue;
      const arr = entry[key];
      const item = Array.isArray(arr) ? arr[0] : arr;
      if (item && Array.isArray(item.children)) {
        // `item.children` = content nodes inside the root's <children> wrapper.
        return { tag: key, attrs: entry[":@"] ?? {}, kids: item.children };
      }
    }
  }
  return null;
}

function piVersion(parsed) {
  for (const entry of parsed ?? []) {
    if (entry && entry["?figml"]) return String(entry[":@"]?.version ?? "");
  }
  return null;
}

/** Build one ContractNode (pushes itself first, then recurses in document order). */
function makeNode(nodeId, parentId, tag, attrs, kids, ids, diag, doc) {
  doc.stats.elements++;
  const type = attrs.type ?? classifyByTag(tag);
  const typeUpper = String(type).toUpperCase();

  const node = {
    nodeId,
    figmaId: attrs.id ?? null,
    parent: parentId,
    tag,
    name: attrs.name ?? null,
    type,
    rawAttrs: { ...attrs }, // EVERY attribute preserved verbatim (unknown ones too)
  };
  doc.nodes.push(node);

  // --- unknown-element detection (before any classification default) ---
  const isKnownTag = KNOWN_TAGS.has(tag) || attrs.type != null;
  if (!isKnownTag) {
    doc.unknown.elements[tag] = (doc.unknown.elements[tag] ?? 0) + 1;
    diag.push("unknown-element", tag, nodeId);
  }

  // --- identity diagnostics ---
  if (attrs.id == null && VISUAL_TYPES.has(typeUpper)) diag.push("missing-critical-field", `${tag}@id`, nodeId);
  if (attrs.width == null && VISUAL_TYPES.has(typeUpper)) diag.push("missing-critical-field", `${tag}@width`, nodeId);
  if (attrs.height == null && VISUAL_TYPES.has(typeUpper)) diag.push("missing-critical-field", `${tag}@height`, nodeId);

  // --- attribute diagnostics ---
  for (const [k, v] of Object.entries(attrs)) {
    if (!KNOWN_ATTRS.has(k)) {
      doc.unknown.attributes[`${tag}@${k}`] = (doc.unknown.attributes[`${tag}@${k}`] ?? 0) + 1;
      diag.push("unknown-attribute", `${tag}@${k}`, nodeId);
    }
    if (NUMERIC_ATTRS.has(k) && v === "") diag.push("ambiguous-value", `${tag}@${k}`, nodeId);
    if (UNSUPPORTED_ATTRS.has(k) || UNSUPPORTED_ATTRS.has(`${tag}@${k}`)) diag.push("unsupported-field", `${tag}@${k}`, nodeId);
  }

  // --- inferred-default: padding fallback (h/v padding without side-specific) ---
  if ((attrs.horizontalPadding != null || attrs.verticalPadding != null) &&
      (attrs.paddingLeft == null || attrs.paddingRight == null || attrs.paddingTop == null || attrs.paddingBottom == null)) {
    diag.push("inferred-default", `${tag}@padding`, nodeId);
  }

  // --- box / visual facts (full fidelity, no interpretation) ---
  if (attrs.x != null || attrs.width != null) {
    node.box = { x: num(attrs.x), y: num(attrs.y), w: num(attrs.width), h: num(attrs.height) };
  }
  if (attrs.opacity != null) node.opacity = Number(attrs.opacity);

  // --- content ---
  if (typeUpper === "TEXT") {
    node.text = attrs.characters ?? "";
    if ((attrs.characters ?? "") === "") diag.push("missing-critical-field", "Text@characters", nodeId);
  }

  // --- child metadata wrappers (consumed into the node, not emitted as child nodes) ---
  const visualChildren = [];
  for (const k of kids ?? []) {
    if (!k || typeof k !== "object") continue;
    const childTag = Object.keys(k).find((key) => key !== ":@") ?? "";
    if (childTag === "#text") continue;
    const childAttrs = k[":@"] ?? {};
    switch (childTag) {
      case "children":
        for (const c of Array.isArray(k.children) ? k.children : []) visualChildren.push(c);
        break;
      case "fills": node.fills = collectFills(k); break;
      case "strokes": node.strokes = collectStrokes(k); break;
      case "mainComponent":
        node.mainComponentId = childAttrs.id ?? null;
        if (node.mainComponentId) node.mainComponentNodeId = sanitizeId(node.mainComponentId);
        break;
      case "variantProperties": node.variant = { ...childAttrs }; break;
      case "componentProperties": node.componentProperties = collectComponentProperties(k); break;
      case "constraints": node.constraints = { ...childAttrs }; break;
      case "fontName": node.font = { ...childAttrs }; break;
      case "lineHeight":
        node.lineHeight = { ...childAttrs };
        if (childAttrs.unit === "AUTO") diag.push("inferred-default", "Text@lineHeight", nodeId);
        break;
      case "letterSpacing":
        node.letterSpacing = { ...childAttrs };
        if (String(childAttrs.value ?? "") === "0") diag.push("inferred-default", "Text@letterSpacing", nodeId);
        break;
      case "overrides": case "override": case "overriddenFields": case "overriddenField":
        node.overrides = (node.overrides ?? []).concat(flattenOverrides(k, childTag));
        break;
      case "textStyles": node.textStyles = { ...childAttrs }; break;
      default:
        // A visual child node (Frame/Text/Vector/Line/Rectangle/instance/unknown) — recurse.
        visualChildren.push(k);
    }
  }

  // --- recurse visual children in document order ---
  if (visualChildren.length) {
    node.children = [];
    for (const c of visualChildren) {
      if (!c || typeof c !== "object") continue;
      const cTag = Object.keys(c).find((key) => key !== ":@") ?? "";
      if (cTag === "#text") continue;
      const cAttrs = c[":@"] ?? {};
      const cId = nodeIdFor(cAttrs.id, cAttrs.name, ids);
      node.children.push(cId);
      makeNode(cId, nodeId, cTag, cAttrs, Array.isArray(c[cTag]) ? c[cTag] : [], ids, diag, doc);
    }
    doc.childIndex[nodeId] = node.children;
  }

  return node;
}

function collectFills(fillsEl) {
  const out = [];
  for (const f of Array.isArray(fillsEl?.fills) ? fillsEl.fills : []) {
    const a = f && (f[":@"] || f);
    if (a) out.push({ ...a });
  }
  return out;
}

function collectStrokes(strokesEl) {
  const out = [];
  for (const s of Array.isArray(strokesEl?.strokes) ? strokesEl.strokes : []) {
    const a = s && (s[":@"] || s);
    if (a) out.push({ ...a });
  }
  return out;
}

function collectComponentProperties(propsEl) {
  const props = {};
  for (const p of Array.isArray(propsEl?.componentProperties) ? propsEl.componentProperties : []) {
    if (!p || typeof p !== "object") continue;
    const tag = Object.keys(p).find((key) => key !== ":@") ?? "";
    if (!tag || tag === "#text") continue;
    const a = p[":@"] ?? {};
    props[tag] = (props[tag] ?? []).concat([{ ...a }]);
  }
  return props;
}

function flattenOverrides(el, tag) {
  const out = [];
  const push = (a) => { if (a) out.push({ overriddenField: a.overriddenField ?? null, value: a.value ?? null, index: a.index ?? null }); };
  if (tag === "override" || tag === "overriddenField") push(el[":@"]);
  const inner = tag === "overrides" ? el.overrides : tag === "override" ? el.override : el.overriddenFields;
  for (const o of Array.isArray(inner) ? inner : []) {
    if (!o || typeof o !== "object") continue;
    for (const sub of [o.override, o.overriddenField, o.overriddenFields]) {
      const arr = Array.isArray(sub) ? sub : (sub ? [sub] : []);
      for (const s of arr) if (s && s[":@"]) push(s[":@"]);
    }
  }
  return out;
}

// ---------- identity (deterministic, per-parse — no module global) ----------

function makeIdSeq() {
  let n = 0;
  return (id, name) => {
    if (id) return sanitizeId(id);
    const base = sanitizeId(name) || "node";
    return `${base}_${++n}`;
  };
}
function nodeIdFor(id, name, ids) {
  return ids(id, name);
}
function sanitizeId(v) {
  return String(v ?? "").replace(/[^a-zA-Z0-9_-]/g, "_");
}

// ---------- classification ----------

function classifyByTag(tag) {
  const t = tag || "";
  if (/Text/i.test(t)) return "TEXT";
  if (/Rectangle/i.test(t)) return "RECTANGLE";
  if (/Line/i.test(t)) return "LINE";
  if (/Vector|Icon/i.test(t)) return "VECTOR";
  if (/Frame|Group/i.test(t)) return "FRAME";
  return "INSTANCE";
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function textChars(doc) {
  let n = 0;
  for (const node of doc.nodes) n += String(node.text ?? "").length;
  return n;
}
function maxDepth(doc) {
  let max = 0;
  const depth = new Map();
  for (const node of doc.nodes) {
    const d = node.parent == null ? 1 : (depth.get(node.parent) ?? 0) + 1;
    depth.set(node.nodeId, d);
    max = Math.max(max, d);
  }
  return max;
}

// ---------- diagnostics ----------

/** Aggregate diagnostics: same (code, scope) counted once with up to 5 example paths. */
class DiagCollector {
  constructor() { this.map = new Map(); }
  push(code, scope, example) {
    const key = `${code} ${scope}`;
    let d = this.map.get(key);
    if (!d) { d = { code, scope, count: 0, examples: [] }; this.map.set(key, d); }
    d.count++;
    if (d.examples.length < 5 && !d.examples.includes(example)) d.examples.push(example);
  }
  toArray() {
    return [...this.map.values()]
      .map((d) => ({ code: d.code, scope: d.scope, count: d.count, examples: d.examples }))
      .sort((a, b) => `${a.code}${a.scope}`.localeCompare(`${b.code}${b.scope}`));
  }
}

// ---------- minimal NormalizedDesign (single shape from BOTH existing parsers) ----------

function emptyNormalized(doc, provenance) {
  return {
    contractVersion: CONTRACT_VERSION,
    source: doc?.source ?? { kind: "figml", filename: "", schemaVersion: null, checksum: null },
    nodes: [],
    diagnostics: doc?.diagnostics ?? [],
    provenance,
  };
}

function contractIndex(doc) {
  const m = new Map();
  for (const n of doc?.nodes ?? []) m.set(n.nodeId, n);
  return m;
}

/**
 * Normalize the LEGACY transcript into the minimal shape.
 * @param {object} transcript — output of parseFigml()
 * @param {object} doc — ContractDoc from parseFigmlContract()
 */
export function normalizeFromTranscript(transcript, doc) {
  const out = emptyNormalized(doc, "transcript");
  const idx = contractIndex(doc);
  const walk = (nodes, parent) => {
    for (const n of nodes ?? []) {
      const c = idx.get(n.id);
      out.nodes.push({
        nodeId: n.id,
        figmaId: c?.figmaId ?? n.id,
        parent,
        name: c?.name ?? n.id,
        mainComponentId: c?.mainComponentId ?? null,
        text: typeof n.text === "string" ? n.text : null,
        box: (n.x !== undefined) ? { x: n.x, y: n.y, w: n.w, h: n.h } : null,
      });
      if (n.children) walk(n.children, n.id);
    }
  };
  walk(transcript.layout, null);
  return out;
}

/**
 * Normalize the Raw Design Graph (design/raw-graph.mjs) into the SAME minimal shape.
 * @param {object} rawGraph — output of buildRawGraph()
 * @param {object} doc — ContractDoc from parseFigmlContract()
 */
export function normalizeFromRawGraph(rawGraph, doc) {
  const out = emptyNormalized(doc, "raw-graph");
  const idx = contractIndex(doc);
  const g = rawGraph?.graph ?? rawGraph;
  for (const node of Object.values(g?.nodes ?? {})) {
    const c = idx.get(node.id);
    out.nodes.push({
      nodeId: node.id,
      figmaId: c?.figmaId ?? node.id,
      parent: node.parentId ?? null,
      name: node.sourceName ?? c?.name ?? node.id,
      mainComponentId: c?.mainComponentId ?? null,
      text: node.content?.kind === "TEXT" ? node.content.value : null,
      box: node.absoluteBounds ? { x: Math.round(node.absoluteBounds.x), y: Math.round(node.absoluteBounds.y), w: Math.round(node.absoluteBounds.w), h: Math.round(node.absoluteBounds.h) } : null,
    });
  }
  return out;
}

function sha256(s) {
  return createHash("sha256").update(s).digest("hex");
}
