// raw-graph — lossless, project-independent Raw Design Graph from FIGML XML.
//
// This is the DESIGN-SIDE ingestion that runs ALONGSIDE the legacy transcript path
// (`src/lib/figml-parse.mjs`). The legacy transcript is lossy on purpose — it drops layoutGrow,
// absolute bounds, layoutAlign/positioning, and flattens roles into coarse `type` strings so the
// resolve/verify/check gates stay simple. This module keeps EVERYTHING: every visible node, every
// FILL/HUG/FIXED marker, every layoutGrow, both local and absolute bounds, all layout alignment
// metadata, per-node provenance (XML path), and hidden nodes as evidence (not silently dropped).
//
// It is project-independent by contract: it knows FIGML/Figma geometry and nothing about Angular,
// Pilar, Bootstrap, or recipes. The Design Intent Graph (intent-graph.mjs) is compiled from this.
//
// preserveOrder shape (verified against the field export):
//   parsed[].frame            = [ <children>, <fills>, <constraints>, ... ]  (root frame's kids)
//   parsed[].frame[i][":@"]   = root frame attrs (id/name/layoutMode/padding/...)
//   a node element            = { "<Tag>": [ ...child elements... ], ":@": { ...attrs... } }
//   a <children> element      = { "children": [ ...content nodes... ] }      (transparent wrapper)
//   a <fills> element         = { "fills": [ { "fill": [], ":@": { color, ... } } ] }
//   a <strokes> element       = { "strokes": [ { "stroke": [], ":@": { color, visible, ... } } ] }
//   a <variantProperties>     = { "variantProperties": [], ":@": { Type|type, Name|name, required, ... } }

import { XMLParser } from "fast-xml-parser";

const PARSER = new XMLParser({
  preserveOrder: true,
  ignoreAttributes: false,
  attributeNamePrefix: "",
  parseTagValue: false,
  parseAttributeValue: false,
});

/** Parse a FIGML XML string into a lossless Raw Design Graph.
 * @param {string} xml
 * @param {string} filename
 * @returns {{ ok: true, graph: object } | { ok: false, reason: string, message: string }}
 */
export function buildRawGraph(xml, filename) {
  let parsed;
  try {
    parsed = PARSER.parse(xml);
  } catch (err) {
    return { ok: false, reason: "parse-error", message: String(err?.message ?? err) };
  }

  const root = findRootFrame(parsed);
  if (!root) return { ok: false, reason: "no-root", message: "No <frame> element found in XML" };

  const nodes = {};
  const rootIds = [];
  const evidenceIndex = {};
  const diagnostics = [];
  const seq = { n: 0 }; // per-build id counter — deterministic, never module-global

  // The root frame is a node itself (lossless: its own box + layout + padding survive, unlike the
  // legacy path which drops it and re-attaches its padding to the first child).
  const rootId = idOf(root.attrs.id, root.attrs.name, seq);
  nodes[rootId] = rawNode(root.attrs, "frame", null, { x: 0, y: 0 }, "frame", rootId, seq, root.frame);
  rootIds.push(rootId);
  evidenceIndex["frame"] = rootId;

  const walk = (elements, parentId, parentOrigin, parentPath, childCounter) => {
    for (const el of elements ?? []) {
      if (!el || typeof el !== "object") continue;
      const tag = nodeTag(el);
      const attrs = el[":@"] || {};
      const kids = Array.isArray(el[tag]) ? el[tag] : [];

      if (tag === "children") {
        // Transparent wrapper: recurse into its content without emitting a node.
        walk(kids, parentId, parentOrigin, parentPath, childCounter);
        continue;
      }
      if (isMetadataTag(tag)) continue; // fills/strokes/constraints/… are consumed by their parent

      const path = `${parentPath}/${tag}[${childCounter.n++}]`;
      const id = idOf(attrs.id, attrs.name, seq);
      nodes[id] = rawNode(attrs, tag, parentId, parentOrigin, path, id, seq, kids);
      evidenceIndex[path] = id;
      if (parentId) nodes[parentId].childIds.push(id);

      // The node's own absolute origin = parent's absolute origin + its local x/y.
      const origin = { x: parentOrigin.x + num(attrs.x), y: parentOrigin.y + num(attrs.y) };
      const innerCounter = { n: 0 };
      for (const k of kids) {
        if (k && k.children) walk(k.children, id, origin, path, innerCounter);
      }
    }
  };

  walk(root.frame, rootId, { x: 0, y: 0 }, "frame", { n: 0 });

  return { ok: true, graph: { version: "1", source: { kind: "figml", filename }, rootIds, nodes, evidenceIndex, diagnostics } };
}

// ---------- internals ----------

/** The root <frame> element: { frame: [...kids], ":@": {...attrs} }. */
function findRootFrame(parsed) {
  if (!Array.isArray(parsed)) return null;
  for (const entry of parsed) {
    if (!entry || typeof entry !== "object") continue;
    for (const key of Object.keys(entry)) {
      if (key === "?xml" || key === "?figml") continue;
      if (Array.isArray(entry[key])) return { frame: entry[key], attrs: entry[":@"] ?? {} };
    }
  }
  return null;
}

function nodeTag(el) {
  return Object.keys(el).find((k) => k !== ":@") ?? "";
}

/** Metadata wrapper child elements that describe their PARENT, not a node themselves. */
function isMetadataTag(tag) {
  return [
    "constraints", "fontName", "letterSpacing", "fill", "lineHeight", "overrides", "override",
    "overriddenFields", "overriddenField", "mainComponent", "componentProperties", "textStyles",
    "variantProperties", "fills", "strokes", "stroke",
  ].includes(tag);
}

/** Build one RawDesignNode from FIGML attributes + its child metadata wrappers. */
function rawNode(attrs, tag, parentId, parentOrigin, path, id, seq, kids = []) {
  const x = num(attrs.x);
  const y = num(attrs.y);
  const w = num(attrs.width);
  const h = num(attrs.height);

  const fillsEl = kids.find((k) => k && k.fills);
  const strokesEl = kids.find((k) => k && k.strokes);
  const variantEl = kids.find((k) => k && k.variantProperties);

  return {
    id,
    parentId,
    childIds: [],
    sourceType: tag,
    sourceName: attrs.name ?? tag,
    visibility: visibilityOf(attrs, kids),
    bounds: { x, y, w, h },
    absoluteBounds: { x: parentOrigin.x + x, y: parentOrigin.y + y, w, h },
    layout: layoutOf(attrs),
    visual: visualOf(attrs, fillsEl, strokesEl),
    content: contentOf(attrs, tag),
    component: componentOf(attrs, variantEl),
    provenance: [{ path, source: "figml" }],
  };
}

function visibilityOf(attrs, kids) {
  const opacity = attrs.opacity != null ? Number(attrs.opacity) : 1;
  const v = attrs.visible;
  const explicitHidden = v != null && (String(v).toLowerCase() === "false" || String(v) === "0");
  const zeroOpacity = Number(attrs.opacity) === 0;
  const overriddenHidden = overrideHidesNode(kids);
  const ownVisible = !explicitHidden && !zeroOpacity && !overriddenHidden;
  const reason = explicitHidden ? "visible=false" : zeroOpacity ? "opacity=0" : overriddenHidden ? "override visible=false" : undefined;
  return { ownVisible, effectiveVisible: ownVisible, opacity, reason };
}

/** Layout facts — the metadata the legacy transcript drops (layoutGrow/layoutAlign/positioning). */
function layoutOf(attrs) {
  const l = {};
  l.mode = attrs.layoutMode === "HORIZONTAL" ? "HORIZONTAL" : attrs.layoutMode === "VERTICAL" ? "VERTICAL" : "NONE";
  if (attrs.layoutSizingHorizontal) l.horizontalSizing = normalizeSizing(attrs.layoutSizingHorizontal);
  if (attrs.layoutSizingVertical) l.verticalSizing = normalizeSizing(attrs.layoutSizingVertical);
  if (attrs.layoutGrow != null) l.grow = num(attrs.layoutGrow) || null;
  if (attrs.layoutAlign) l.layoutAlign = attrs.layoutAlign;
  if (attrs.layoutPositioning) l.layoutPositioning = attrs.layoutPositioning;
  if (attrs.primaryAxisAlignItems) l.primaryAlignment = normalizeAlign(attrs.primaryAxisAlignItems);
  if (attrs.counterAxisAlignItems) l.counterAlignment = normalizeAlign(attrs.counterAxisAlignItems);
  if (attrs.primaryAxisSizingMode) l.primarySizingMode = normalizeSizing(attrs.primaryAxisSizingMode);
  if (attrs.counterAxisSizingMode) l.counterSizingMode = normalizeSizing(attrs.counterAxisSizingMode);
  if (attrs.itemSpacing != null) l.itemSpacing = num(attrs.itemSpacing) || null;
  const pad = paddingOf(attrs);
  if (pad) l.padding = pad;
  if (attrs.clipsContent === "true") l.clipsContent = true;
  return l;
}

function normalizeSizing(v) {
  const s = String(v).toUpperCase();
  return ["FILL", "HUG", "FIXED", "MIN_CONTENT", "MAX_CONTENT", "AUTO", "UNKNOWN"].includes(s) ? s : String(v);
}

function normalizeAlign(v) {
  const s = String(v).toUpperCase();
  const map = { MIN: "START", MAX: "END", CENTER: "CENTER", SPACE_BETWEEN: "SPACE_BETWEEN", STRETCH: "STRETCH" };
  return map[s] ?? s;
}

function visualOf(attrs, fillsEl, strokesEl) {
  const v = {};
  const fills = collectFills(fillsEl);
  if (fills.length) v.fills = fills;
  const strokes = collectStrokes(attrs, strokesEl);
  if (strokes.length) v.strokes = strokes;
  const radius = attrs.cornerRadius != null && attrs.cornerRadius !== "" ? num(attrs.cornerRadius) : undefined;
  if (radius !== undefined) v.radius = radius;
  const corners = perCornerRadius(attrs);
  if (corners) v.cornerRadius = corners;
  return v;
}

/** All fills (not just the first visible) — lossless color evidence. */
function collectFills(fillsEl) {
  const out = [];
  const arr = fillsEl?.fills;
  for (const f of Array.isArray(arr) ? arr : []) {
    const fat = f && (f[":@"] || f);
    if (fat && fat.color) out.push({ color: String(fat.color).toLowerCase(), visible: fat.visible !== "false", blendMode: fat.blendMode ?? null });
  }
  return out;
}

function collectStrokes(attrs, strokesEl) {
  const out = [];
  const w = num(attrs.strokeWeight);
  if (attrs.stroke) out.push({ color: String(attrs.stroke).toLowerCase(), visible: true, weight: w });
  const arr = strokesEl?.strokes;
  for (const s of Array.isArray(arr) ? arr : []) {
    const sat = s && (s[":@"] || s);
    if (sat && sat.color) out.push({ color: String(sat.color).toLowerCase(), visible: sat.visible !== "false", weight: w });
  }
  return out;
}

function contentOf(attrs, tag) {
  const upper = String(tag).toUpperCase();
  if (upper === "TEXT") return { kind: "TEXT", value: attrs.characters ?? "" };
  if (upper === "VECTOR" || /icon/i.test(attrs.name ?? "")) return { kind: "ICON", glyphName: attrs.name ?? undefined };
  return null;
}

/** A component/variant facts from the node + its <variantProperties> child. The XML uses BOTH
 *  casings (`Type`/`type`, `Name`/`name`) depending on the exporting plugin — read both losslessly. */
function componentOf(attrs, variantEl) {
  const c = {};
  if (attrs.name) c.name = attrs.name;
  const va = variantEl?.[":@"] ?? {};
  const variantType = va.Type ?? va.type ?? null;
  const variantName = va.Name ?? va.name ?? null;
  if (variantType) c.variantType = variantType;
  if (variantName) c.variantName = variantName;
  if (va.required !== undefined && va.required !== null) {
    c.required = va.required === true || String(va.required).toLowerCase() === "true";
  }
  return Object.keys(c).length ? c : null;
}

/** Hidden-by-override: a child `<overrides>/<override overriddenField="visible" value="false">`. */
function overrideHidesNode(kids) {
  for (const k of kids ?? []) {
    if (!k || typeof k !== "object") continue;
    if (k.override) {
      const ovs = Array.isArray(k.override) ? k.override : [k.override];
      for (const o of ovs) if (overrideHides(o)) return true;
    }
    if (k.overrides) {
      const list = Array.isArray(k.overrides) ? k.overrides : [k.overrides];
      for (const o of list) if (overrideHides(o)) return true;
    }
  }
  return false;
}

function overrideHides(o) {
  const a = (o && o[":@"]) ?? o ?? {};
  return String(a.overriddenField ?? "").toLowerCase() === "visible" && String(a.value ?? "").toLowerCase() === "false";
}

// ---------- shared geometry helpers ----------

function paddingOf(attrs) {
  const top = num(attrs.paddingTop) || num(attrs.verticalPadding);
  const right = num(attrs.paddingRight) || num(attrs.horizontalPadding);
  const bottom = num(attrs.paddingBottom) || num(attrs.verticalPadding);
  const left = num(attrs.paddingLeft) || num(attrs.horizontalPadding);
  if (!top && !right && !bottom && !left) return null;
  return { top, right, bottom, left };
}

function perCornerRadius(attrs) {
  const u = num(attrs.cornerRadius);
  const has = ["topLeftRadius", "topRightRadius", "bottomRightRadius", "bottomLeftRadius"].some((k) => attrs[k] != null);
  if (!u && !has) return null;
  const tl = attrs.topLeftRadius != null ? num(attrs.topLeftRadius) : u;
  const tr = attrs.topRightRadius != null ? num(attrs.topRightRadius) : u;
  const br = attrs.bottomRightRadius != null ? num(attrs.bottomRightRadius) : u;
  const bl = attrs.bottomLeftRadius != null ? num(attrs.bottomLeftRadius) : u;
  if (tl === tr && tr === br && br === bl) return null;
  return { tl, tr, br, bl };
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function idOf(id, name, seq) {
  if (id) return String(id).replace(/[^a-zA-Z0-9_-]/g, "_");
  const base = String(name ?? "node").replace(/[^a-zA-Z0-9_-]/g, "_") || "node";
  return `${base}_${++seq.n}`;
}
