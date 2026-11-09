// slice-ir — SliceIR: a versioned, normalized intermediate representation for FIGML designs.
//
// Phase 2 of the FIGML audit implementation. SliceIR is built FROM the Phase-1 contract
// (src/lib/figml-contract.mjs) — it does not re-parse XML. It projects the full-fidelity
// contract into a typed, provenance-bearing structure that the agent-facing transcript-v2
// renderer consumes. It is NOT a replacement for the legacy transcript, and it does NOT
// change the legacy transcript (that stays byte-stable). It is SliceIR *minimum*, not the
// full SliceIR vision from the audit recommendation.
//
// Representation rules (from the audit / Phase-2 spec):
//   - null = known-but-absent (never false/0/"" as a stand-in)
//   - rawAttrs preserved verbatim (unknown attributes/elements never dropped)
//   - every normalized field carries provenance
//   - inferred values are marked inferred (no pseudo-scientific numeric confidence)
//   - child order == source order
//   - deterministic per-build identity (no global counter)
//   - design content stays untrusted data

import { createHash } from "node:crypto";

export const SLICE_IR_VERSION = "sliceir/0.1";

// Diagnostic codes (uppercase — Phase 2 contract). severity ∈ info|warning|error.
const SEVERITY = {
  MISSING_CRITICAL_FIELD: "warning",
  UNKNOWN_ELEMENT: "info",
  UNKNOWN_ATTRIBUTE: "info",
  INFERRED_DEFAULT: "info",
  AMBIGUOUS_VALUE: "warning",
  UNSUPPORTED_FIELD: "info",
  MIXED_TEXT_STYLE: "warning",
  BROKEN_COMPONENT_REFERENCE: "warning",
  DUPLICATE_SOURCE_ID: "error",
  GENERATED_NODE_ID: "info",
  INVALID_NUMERIC_VALUE: "error",
  UNRESOLVED_CONSTRAINT: "warning",
};

// Contract (lowercase) → SliceIR (uppercase) diagnostic code mapping.
const CODE_MAP = {
  "missing-critical-field": "MISSING_CRITICAL_FIELD",
  "unknown-element": "UNKNOWN_ELEMENT",
  "unknown-attribute": "UNKNOWN_ATTRIBUTE",
  "inferred-default": "INFERRED_DEFAULT",
  "ambiguous-value": "AMBIGUOUS_VALUE",
  "unsupported-field": "UNSUPPORTED_FIELD",
};

const NUMERIC_ATTRS = new Set([
  "x", "y", "width", "height", "fontSize", "fontWeight", "cornerRadius",
  "topLeftRadius", "topRightRadius", "bottomRightRadius", "bottomLeftRadius",
  "itemSpacing", "counterAxisSpacing", "paddingLeft", "paddingRight", "paddingTop", "paddingBottom",
  "horizontalPadding", "verticalPadding", "minWidth", "maxWidth", "minHeight", "maxHeight",
  "strokeWeight", "opacity", "layoutGrow",
]);

const CONSTRAINT_VALUES = new Set(["MIN", "MAX", "CENTER", "SCALE", "STRETCH", "SPACE_BETWEEN", "AUTO", "FIXED", "HUG", "START", "END"]);

/**
 * Build a SliceIR document from a Phase-1 ContractDoc.
 * @param {object} contract — output of parseFigmlContract() (the `doc`, not the wrapper)
 * @returns {{ ok: true, ir: object } | { ok: false, reason: string, message: string }}
 */
export function buildSliceIR(contract) {
  if (!contract || !Array.isArray(contract.nodes)) {
    return { ok: false, reason: "invalid-contract", message: "contract.nodes is missing" };
  }
  const nodes = {};
  const ir = {
    schemaVersion: SLICE_IR_VERSION,
    source: {
      format: "figml",
      detectedVersion: contract.source?.schemaVersion ?? null,
      checksum: contract.source?.checksum ?? "",
      filename: contract.source?.filename ?? "",
    },
    stats: { nodeCount: 0, maxDepth: 0, componentCount: 0, instanceCount: 0, diagnosticCount: 0 },
    rootIds: [],
    nodes,
    indexes: { childrenByParent: {}, components: {}, instancesByComponent: {}, nodesByType: {}, nodesByName: {} },
    diagnostics: [],
  };

  const ctx = { ir, contract, paths: new Map(), siblingCounters: new Map(), sourceIdSeen: new Map() };

  // Pass 1: build every node in document order (parents precede children), computing paths.
  for (const cnode of contract.nodes) {
    const node = nodeFromContract(cnode, ctx);
    nodes[node.id] = node;
    if (cnode.parent == null) ir.rootIds.push(node.id);
  }

  // Pass 2: indexes + stats.
  let maxDepth = 0;
  for (const cnode of contract.nodes) {
    const node = nodes[cnode.nodeId];
    const parentKey = cnode.parent ?? "";
    if (cnode.parent != null) {
      (ir.indexes.childrenByParent[cnode.parent] = ir.indexes.childrenByParent[cnode.parent] ?? []).push(cnode.nodeId);
    }
    const type = node.type ?? "UNKNOWN";
    (ir.indexes.nodesByType[type] = ir.indexes.nodesByType[type] ?? []).push(cnode.nodeId);
    if (node.name != null) {
      (ir.indexes.nodesByName[node.name] = ir.indexes.nodesByName[node.name] ?? []).push(cnode.nodeId);
    }
    if (node.component?.mainComponentId) {
      const cid = node.component.mainComponentId;
      (ir.indexes.instancesByComponent[cid] = ir.indexes.instancesByComponent[cid] ?? []).push(cnode.nodeId);
      ir.indexes.components[cid] = ir.indexes.components[cid] ?? { componentId: cid, name: node.component.mainComponentName ?? null, instanceIds: [] };
      ir.indexes.components[cid].instanceIds.push(cnode.nodeId);
    }
    if (node.type === "INSTANCE") ir.stats.instanceCount++;
    maxDepth = Math.max(maxDepth, ctx.paths.get(cnode.nodeId)?.split("/").length ?? 1);
  }
  ir.stats.nodeCount = Object.keys(nodes).length;
  ir.stats.maxDepth = maxDepth;
  ir.stats.componentCount = Object.keys(ir.indexes.components).length;

  // Pass 3: subtree hashes, post-order (children before parents).
  for (const cnode of [...contract.nodes].reverse()) {
    const node = nodes[cnode.nodeId];
    node.subtreeHash = subtreeHash(node, nodes);
  }

  // Diagnostics: translated contract diagnostics + node-level Phase-2 diagnostics.
  ir.diagnostics = translateDiagnostics(contract.diagnostics ?? [], nodes, ctx);

  ir.stats.diagnosticCount = ir.diagnostics.length;
  return { ok: true, ir };
}

// ---------- node projection ----------

function nodeFromContract(cnode, ctx) {
  const attrs = cnode.rawAttrs ?? {};
  const prov = {};
  const nodeDiags = [];
  const nodeId = cnode.nodeId;

  // identity / source
  if (cnode.figmaId == null) nodeDiags.push(diag("GENERATED_NODE_ID", "info", nodeId, null, "id", "Node has no source id; an id was generated from its name.", { reason: "generated-from-name" }));
  else {
    const prev = ctx.sourceIdSeen.get(cnode.figmaId);
    if (prev != null) nodeDiags.push(diag("DUPLICATE_SOURCE_ID", "error", nodeId, null, "id", "Duplicate source id detected.", { duplicateOf: prev }));
    else ctx.sourceIdSeen.set(cnode.figmaId, nodeId);
  }
  recordProv(prov, "id", "figml", "id", attrs.id ?? null, attrs.id != null);

  // numeric validation
  for (const k of Object.keys(attrs)) {
    if (NUMERIC_ATTRS.has(k) && attrs[k] != null && attrs[k] !== "" && Number.isNaN(Number(attrs[k]))) {
      nodeDiags.push(diag("INVALID_NUMERIC_VALUE", "error", nodeId, null, k, "Numeric attribute has a non-numeric value.", null));
    }
  }

  // geometry (local + computed absolute)
  const geometry = buildGeometry(attrs, ctx, cnode.parent, prov);
  // layout
  const layout = buildLayout(attrs, cnode, prov);
  // typography
  const typography = buildTypography(attrs, cnode, prov, nodeDiags, nodeId);
  // appearance + state
  const appearance = buildAppearance(cnode, attrs, prov);
  const state = buildState(attrs, cnode, prov);
  // component
  const component = buildComponent(cnode, prov);
  if (component && component.mainComponentId) {
    // nothing extra; reference is recorded in indexes
  }
  // constraints
  const constraints = buildConstraints(cnode, prov, nodeDiags, nodeId);

  return {
    id: nodeId,
    sourceId: cnode.figmaId ?? null,
    parentId: cnode.parent ?? null,
    childIds: [...(cnode.children ?? [])],
    path: pathFor(cnode, ctx),
    type: cnode.type ?? "UNKNOWN",
    name: cnode.name ?? null,
    geometry,
    layout,
    typography,
    appearance,
    component,
    constraints,
    state,
    rawAttrs: { ...attrs },
    provenance: prov,
    diagnostics: nodeDiags,
    subtreeHash: "", // filled in pass 3
  };
}

function pathFor(cnode, ctx) {
  const parentPath = cnode.parent != null ? ctx.paths.get(cnode.parent) ?? "" : "";
  const key = cnode.parent ?? " root";
  const n = ctx.siblingCounters.get(key) ?? 0;
  ctx.siblingCounters.set(key, n + 1);
  const p = parentPath ? `${parentPath}/${cnode.tag}[${n}]` : cnode.tag;
  ctx.paths.set(cnode.nodeId, p);
  return p;
}

// ---------- typed field builders ----------

function buildGeometry(attrs, ctx, parentId, prov) {
  if (attrs.x == null && attrs.width == null) return null;
  const x = parseNum(attrs.x), y = parseNum(attrs.y), w = parseNum(attrs.width), h = parseNum(attrs.height);
  for (const [k, attr] of [["x", "x"], ["y", "y"], ["width", "width"], ["height", "height"]]) {
    recordProv(prov, `geometry.${k}`, "figml", attr, attrs[attr] ?? null, attrs[attr] != null);
  }
  const geo = { x, y, width: w, height: h, absolute: { x, y } };
  // absolute = parent absolute origin + local x/y (computed, not a raw attribute)
  const parentAbs = parentAbsolute(ctx, parentId);
  geo.absolute = { x: parentAbs.x + x, y: parentAbs.y + y };
  recordInferred(prov, "geometry.absolute", "computed-from-parent-origin", "high");
  return geo;
}

function parentAbsolute(ctx, parentId) {
  if (parentId == null) return { x: 0, y: 0 };
  // resolve through already-built nodes (parents precede children in document order)
  const parent = ctx.ir.nodes[parentId];
  if (!parent) return { x: 0, y: 0 };
  return parent.geometry?.absolute ?? { x: 0, y: 0 };
}

function buildLayout(attrs, cnode, prov) {
  const has = [
    "layoutMode", "layoutWrap", "primaryAxisAlignItems", "counterAxisAlignItems",
    "layoutSizingHorizontal", "layoutSizingVertical", "layoutPositioning", "itemSpacing",
    "counterAxisSpacing", "paddingLeft", "paddingRight", "paddingTop", "paddingBottom",
    "horizontalPadding", "verticalPadding", "minWidth", "maxWidth", "minHeight", "maxHeight", "clipsContent",
  ].some((k) => attrs[k] != null);
  if (!has) return null;

  const l = {};
  for (const [key, attr] of [
    ["mode", "layoutMode"], ["wrap", "layoutWrap"],
    ["primaryAxisAlign", "primaryAxisAlignItems"], ["counterAxisAlign", "counterAxisAlignItems"],
    ["sizingHorizontal", "layoutSizingHorizontal"], ["sizingVertical", "layoutSizingVertical"],
    ["positioning", "layoutPositioning"], ["itemSpacing", "itemSpacing"], ["counterAxisSpacing", "counterAxisSpacing"],
    ["minWidth", "minWidth"], ["maxWidth", "maxWidth"], ["minHeight", "minHeight"], ["maxHeight", "maxHeight"],
    ["clipping", "clipsContent"],
  ]) {
    const raw = attrs[attr];
    if (raw != null) {
      l[key] = NUMERIC_ATTRS.has(attr) ? parseNum(raw) : String(raw);
      recordProv(prov, `layout.${key}`, "figml", attr, raw, true);
    } else {
      l[key] = null;
    }
  }

  // padding: side-specific, else fall back to horizontal/vertical axis padding (inferred).
  const pad = paddingOf(attrs, prov);
  l.padding = pad.value;
  return l;
}

function paddingOf(attrs, prov) {
  const hasSide = ["paddingTop", "paddingRight", "paddingBottom", "paddingLeft"].some((k) => attrs[k] != null);
  if (hasSide) {
    const p = {
      top: parseNum(attrs.paddingTop),
      right: parseNum(attrs.paddingRight),
      bottom: parseNum(attrs.paddingBottom),
      left: parseNum(attrs.paddingLeft),
    };
    for (const [k, attr] of [["top", "paddingTop"], ["right", "paddingRight"], ["bottom", "paddingBottom"], ["left", "paddingLeft"]]) {
      recordProv(prov, `layout.padding.${k}`, "figml", attr, attrs[attr] ?? null, attrs[attr] != null);
    }
    return { value: p, inferred: false };
  }
  if (attrs.horizontalPadding != null || attrs.verticalPadding != null) {
    const h = parseNum(attrs.horizontalPadding), v = parseNum(attrs.verticalPadding);
    const p = { top: v, right: h, bottom: v, left: h };
    recordInferred(prov, "layout.padding", "axis-padding-expanded-to-sides", "high");
    return { value: p, inferred: true };
  }
  return { value: null, inferred: false };
}

function buildTypography(attrs, cnode, prov, nodeDiags, nodeId) {
  const isText = String(cnode.type ?? "").toUpperCase() === "TEXT";
  if (!isText) return null;
  const t = {};
  if (attrs.characters != null) {
    t.text = String(attrs.characters);
    recordProv(prov, "typography.text", "figml", "characters", attrs.characters, true);
  } else {
    t.text = null;
  }
  t.fontFamily = cnode.font?.family ?? null;
  t.fontStyle = cnode.font?.style ?? null;
  if (cnode.font) {
    recordProv(prov, "typography.fontFamily", "figml", "fontName@family", cnode.font.family ?? null, true);
    recordProv(prov, "typography.fontStyle", "figml", "fontName@style", cnode.font.style ?? null, true);
  }
  // mixed-font sentinel → MIXED_TEXT_STYLE diagnostic
  const fontName = attrs.fontName;
  if (fontName === "Symbol(figma.mixed)" || cnode.font?.family === "Symbol(figma.mixed)") {
    t.mixed = true;
    nodeDiags.push(diag("MIXED_TEXT_STYLE", "warning", nodeId, null, "typography.fontFamily", "Text node uses mixed font styles; individual runs are not resolved.", { sentinel: "Symbol(figma.mixed)" }));
  } else {
    t.mixed = false;
  }

  for (const [key, attr] of [
    ["fontWeight", "fontWeight"], ["fontSize", "fontSize"],
    ["textAlignHorizontal", "textAlignHorizontal"], ["textAlignVertical", "textAlignVertical"],
    ["textDecoration", "textDecoration"], ["textCase", "textCase"],
  ]) {
    const raw = attrs[attr];
    t[key] = raw != null ? (NUMERIC_ATTRS.has(attr) ? parseNum(raw) : String(raw)) : null;
    if (raw != null) recordProv(prov, `typography.${key}`, "figml", attr, raw, true);
  }

  t.lineHeight = cnode.lineHeight ? { unit: cnode.lineHeight.unit ?? null, value: cnode.lineHeight.value != null ? parseNum(cnode.lineHeight.value) : null } : null;
  t.letterSpacing = cnode.letterSpacing ? { unit: cnode.letterSpacing.unit ?? null, value: cnode.letterSpacing.value != null ? parseNum(cnode.letterSpacing.value) : null } : null;
  if (cnode.lineHeight) recordProv(prov, "typography.lineHeight", "figml", "lineHeight", JSON.stringify(cnode.lineHeight), true);
  if (cnode.letterSpacing) recordProv(prov, "typography.letterSpacing", "figml", "letterSpacing", JSON.stringify(cnode.letterSpacing), true);

  return t;
}

function buildAppearance(cnode, attrs, prov) {
  const a = {};
  a.fills = cnode.fills ?? null;
  a.strokes = cnode.strokes ?? null;
  if (cnode.fills) recordProv(prov, "appearance.fills", "figml", "fills", JSON.stringify(cnode.fills), true);
  if (cnode.strokes) recordProv(prov, "appearance.strokes", "figml", "strokes", JSON.stringify(cnode.strokes), true);
  a.cornerRadius = attrs.cornerRadius != null && attrs.cornerRadius !== "" ? parseNum(attrs.cornerRadius) : null;
  if (attrs.cornerRadius != null) recordProv(prov, "appearance.cornerRadius", "figml", "cornerRadius", attrs.cornerRadius, attrs.cornerRadius !== "");
  const perCorner = perCornerRadius(attrs, prov);
  a.cornerRadiusPerCorner = perCorner;
  a.effects = attrs.effects ?? null;
  // effects not observed in fixtures → keep raw, mark provenance as preserved-raw only if present
  if (attrs.effects != null) recordProv(prov, "appearance.effects", "figml", "effects", attrs.effects, true);
  if (!a.fills && !a.strokes && a.cornerRadius == null && !perCorner && a.effects == null) return null;
  return a;
}

function perCornerRadius(attrs, prov) {
  const keys = ["topLeftRadius", "topRightRadius", "bottomRightRadius", "bottomLeftRadius"];
  if (!keys.some((k) => attrs[k] != null)) return null;
  const out = { topLeft: null, topRight: null, bottomRight: null, bottomLeft: null };
  for (const [k, attr] of [["topLeft", "topLeftRadius"], ["topRight", "topRightRadius"], ["bottomRight", "bottomRightRadius"], ["bottomLeft", "bottomLeftRadius"]]) {
    out[k] = attrs[attr] != null ? parseNum(attrs[attr]) : null;
    if (attrs[attr] != null) recordProv(prov, `appearance.cornerRadiusPerCorner.${k}`, "figml", attr, attrs[attr], true);
  }
  return out;
}

function buildState(attrs, cnode, prov) {
  const s = {};
  s.opacity = attrs.opacity != null ? parseNum(attrs.opacity) : null;
  s.visible = attrs.visible != null ? !(String(attrs.visible).toLowerCase() === "false" || String(attrs.visible) === "0") : null;
  s.required = requiredOf(cnode);
  if (attrs.opacity != null) recordProv(prov, "state.opacity", "figml", "opacity", attrs.opacity, true);
  if (attrs.visible != null) recordProv(prov, "state.visible", "figml", "visible", attrs.visible, true);
  if (s.required != null) recordProv(prov, "state.required", "figml", "variantProperties@required", String(s.required), true);
  if (s.opacity == null && s.visible == null && s.required == null) return null;
  return s;
}

function requiredOf(cnode) {
  const v = cnode.variant?.required;
  if (v !== undefined && v !== null) return v === true || String(v).toLowerCase() === "true";
  // componentProperties may carry a `required` property
  const reqProp = cnode.componentProperties?.required;
  if (reqProp) {
    const first = Array.isArray(reqProp) ? reqProp[0] : reqProp;
    if (first && (first.value !== undefined || first.required !== undefined)) {
      const rv = first.required ?? first.value;
      if (rv !== undefined && rv !== null) return rv === true || String(rv).toLowerCase() === "true";
    }
  }
  return null;
}

function buildComponent(cnode, prov) {
  const isInstance = String(cnode.type ?? "").toUpperCase() === "INSTANCE";
  if (!isInstance && cnode.mainComponentId == null) return null;
  const c = {};
  c.mainComponentId = cnode.mainComponentId ?? null;
  c.mainComponentName = null; // component definitions are external in FIGML exports (needs-fixture)
  c.variantType = cnode.variant?.Type ?? cnode.variant?.type ?? null;
  c.variantName = cnode.variant?.Name ?? cnode.variant?.name ?? null;
  c.properties = cnode.componentProperties ?? null;
  c.overrides = cnode.overrides?.length ? cnode.overrides : null;
  if (cnode.mainComponentId) recordProv(prov, "component.mainComponentId", "figml", "mainComponent@id", cnode.mainComponentId, true);
  if (c.variantType != null) recordProv(prov, "component.variantType", "figml", "variantProperties@Type", c.variantType, true);
  if (c.variantName != null) recordProv(prov, "component.variantName", "figml", "variantProperties@Name", c.variantName, true);
  if (c.properties) recordProv(prov, "component.properties", "figml", "componentProperties", JSON.stringify(c.properties), true);
  if (c.overrides) recordProv(prov, "component.overrides", "figml", "overrides", JSON.stringify(c.overrides), true);
  return c;
}

function buildConstraints(cnode, prov, nodeDiags, nodeId) {
  if (!cnode.constraints) return null;
  const c = { horizontal: cnode.constraints.horizontal ?? null, vertical: cnode.constraints.vertical ?? null };
  for (const axis of ["horizontal", "vertical"]) {
    const v = c[axis];
    if (v != null) {
      recordProv(prov, `constraints.${axis}`, "figml", `constraints@${axis}`, v, true);
      if (!CONSTRAINT_VALUES.has(String(v).toUpperCase())) {
        nodeDiags.push(diag("UNRESOLVED_CONSTRAINT", "warning", nodeId, null, `constraints.${axis}`, "Constraint value is not a recognized Figma constraint.", null));
      }
    }
  }
  return c;
}

// ---------- helpers ----------

function parseNum(v) {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function recordProv(prov, key, source, attribute, rawValue, normalized) {
  prov[key] = { source, attribute, rawValue, normalized };
}
function recordInferred(prov, key, reason, confidence) {
  prov[key] = { source: "inferred", reason, confidence };
}

function diag(code, severity, nodeId, path, property, message, evidence) {
  return { code, severity, nodeId, path, property, message, evidence };
}

function subtreeHash(node, nodes) {
  const childHashes = node.childIds.map((cid) => nodes[cid]?.subtreeHash ?? "");
  const obj = {
    id: node.id, sourceId: node.sourceId, type: node.type, name: node.name,
    geometry: node.geometry, layout: node.layout, typography: node.typography,
    appearance: node.appearance, component: node.component, constraints: node.constraints,
    state: node.state, rawAttrs: node.rawAttrs, children: childHashes,
  };
  return createHash("sha256").update(canonical(obj)).digest("hex");
}

/** Deterministic stringify (recursively sorted object keys). */
function canonical(v) {
  if (Array.isArray(v)) return "[" + v.map(canonical).join(",") + "]";
  if (v && typeof v === "object") {
    const keys = Object.keys(v).sort();
    return "{" + keys.map((k) => JSON.stringify(k) + ":" + canonical(v[k])).join(",") + "}";
  }
  return JSON.stringify(v ?? null);
}

function translateDiagnostics(contractDiags, nodes, ctx) {
  const out = [];
  for (const d of contractDiags ?? []) {
    const code = CODE_MAP[d.code];
    if (!code) continue;
    out.push({
      code,
      severity: SEVERITY[code] ?? "info",
      nodeId: null,
      path: null,
      property: d.scope ?? null,
      message: staticMessage(code, d.scope),
      evidence: { count: d.count, examples: (d.examples ?? []).slice(0, 5) },
    });
  }
  // node-level diagnostics (Phase 2 codes discovered during projection)
  for (const node of Object.values(nodes)) {
    for (const d of node.diagnostics ?? []) {
      out.push(d);
    }
    // BROKEN_COMPONENT_REFERENCE: instance without mainComponent.id
    if (node.type === "INSTANCE" && node.component?.mainComponentId == null) {
      out.push(diag("BROKEN_COMPONENT_REFERENCE", "warning", node.id, node.path, "component.mainComponentId", "Component instance is missing its mainComponent.id.", null));
    }
  }
  return out;
}

function staticMessage(code, scope) {
  switch (code) {
    case "MISSING_CRITICAL_FIELD": return `A critical field (${scope ?? "?"}) is missing.`;
    case "UNKNOWN_ELEMENT": return "An unknown element was preserved in rawAttrs.";
    case "UNKNOWN_ATTRIBUTE": return "An unknown attribute was preserved in rawAttrs.";
    case "INFERRED_DEFAULT": return "A default was inferred where the source did not provide a value.";
    case "AMBIGUOUS_VALUE": return "A value is present but ambiguous.";
    case "UNSUPPORTED_FIELD": return "A field is not yet carried into the legacy transcript.";
    default: return "";
  }
}
