// figml-parse — FIGML XML (Figma plugin export) → transcript schema.
// Deterministic, no API calls: the XML already carries structure (tree), exact text
// (characters), exact colors (fills), geometry (x/y/w/h), and semantics (component names
// like Button_FNC, Field, Icon_*). This is the PRIMARY input path — higher accuracy and
// instant, vs. the vision pipeline which only handles non-Figma sources.
//
// preserveOrder shape for FIGML:
//   parsed = [ {"?xml": ...}, {"?figml": ...}, {"frame": [ { children: [ childNode, ... ] } ] } ]
//   childNode = { "<Tag>": [ childNodesOfThatTag ], ":@": { ...all attributes incl x/y/width/height... } }

import { XMLParser } from "fast-xml-parser";
import { basename } from "node:path";
import { emptyTranscript, validateTranscript } from "./transcript-schema.mjs";

const PARSER = new XMLParser({
  preserveOrder: true,
  ignoreAttributes: false,
  attributeNamePrefix: "",
  parseTagValue: false,
  parseAttributeValue: false,
});

/**
 * Parse a FIGML XML string into a validated transcript.
 * @param {string} xml
 * @param {string} filename
 * @returns {{ ok: true, transcript: object } | { ok: false, reason: string, message: string }}
 */
export function parseFigml(xml, filename) {
  let rootChildren;
  try {
    rootChildren = findRootChildren(PARSER.parse(xml));
  } catch (err) {
    return { ok: false, reason: "parse-error", message: String(err?.message ?? err) };
  }
  if (!rootChildren) return { ok: false, reason: "no-root", message: "No <frame> element found in XML" };

  const width = rootDim(xml, "width");
  const height = rootDim(xml, "height");
  const layout = walkNodes(rootChildren, 0, 0);
  markTables(layout);

  const transcript = emptyTranscript({
    source: "figml",
    tier: 0,
    image: basename(filename),
    width,
    height,
    textQuality: "exact",
  });
  transcript.tokens = { colors: censusColors(xml), fonts: [], spacing: censusSpacing(xml) };
  transcript.layout = layout;

  const v = validateTranscript(transcript);
  if (!v.ok) {
    return { ok: false, reason: "invalid-schema", message: v.errors.join("; ").slice(0, 300) };
  }
  return { ok: true, transcript };
}

// ---------- internals ----------

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

/** Root frame's width/height (its attributes are lost by preserveOrder, so regex the raw XML). */
function rootDim(xml, attr) {
  const m = new RegExp(`<frame[^>]*\\b${attr}="([0-9.]+)"`).exec(xml);
  return m ? Math.round(Number(m[1])) : 0;
}

// Metadata wrappers to skip entirely (no visual contribution).
// NOTE: "strokes" is NOT here — a node's stroke is its border (distinct from fill), consumed
// like <fills> into the parent attrs so fill vs stroke stay separate (report §5.1/§7.3).
const SKIP_TAGS = new Set([
  "constraints", "fontName", "letterSpacing", "fill",
  "lineHeight", "overrides", "override", "overriddenFields", "overriddenField",
  "mainComponent", "componentProperties", "variantProperties", "textStyles",
]);
// Wrapper to skip AS A NODE but still traverse its children (e.g. <children>).
const TRANSPARENT_TAGS = new Set(["children"]);

/** Walk childNode[] — each is { Tag: [children], ":@": attrs }. */
function walkNodes(nodes, ox, oy) {
  const out = [];
  for (const node of nodes) {
    if (!node || typeof node !== "object") continue;
    const tag = Object.keys(node).find((k) => k !== ":@") ?? "";
    if (SKIP_TAGS.has(tag)) continue;
    if (TRANSPARENT_TAGS.has(tag)) {
      const kids = Array.isArray(node[tag]) ? node[tag] : [];
      out.push(...walkNodes(kids, ox, oy));
      continue;
    }
    const attrs = node[":@"] || {};
    const kids = Array.isArray(node[tag]) ? node[tag] : [];
    // A node's own fills (a child <fills> element) describe the node's box, not a child
    // node — consume it for colorOf() and don't recurse into it (or the nested <fill>).
    const childFills = kids.find((k) => k && k.fills);
    const effectiveAttrs = childFills ? { ...attrs, fills: childFills.fills } : attrs;
    const visualKids = childFills ? kids.filter((k) => k !== childFills) : kids;
    // A node's own strokes (<strokes><stroke/>) describe its BORDER, not a child node —
    // consume it like fills so borderOf() can read it without emitting a spurious node.
    const childStrokes = kids.find((k) => k && k.strokes);
    const effectiveAttrs2 = childStrokes ? { ...effectiveAttrs, strokes: childStrokes.strokes } : effectiveAttrs;
    const visualKids2 = childStrokes ? visualKids.filter((k) => k !== childStrokes) : visualKids;
    // A child <variantProperties Type="primary|secondary|…"/> is the component's variant —
    // a design fact the agent needs (button primary vs secondary), not a node to transcribe.
    // Consume it into the parent attrs and drop it from the child walk.
    const childVariant = kids.find((k) => k && k.variantProperties);
    const effectiveAttrs3 = childVariant ? { ...effectiveAttrs2, variantType: childVariant[":@"]?.Type ?? null } : effectiveAttrs2;
    const visualKids3 = childVariant ? visualKids2.filter((k) => k !== childVariant) : visualKids2;
    const mapped = mapNode(tag, effectiveAttrs3, visualKids3, ox, oy);
    if (mapped) out.push(mapped);
  }
  return out;
}

function mapNode(tag, attrs, kids, ox, oy) {
  let type = attrs.type || classifyByTag(tag);
  if (["BOOLEAN", "VARIANT", "INSTANCE_SWAP"].includes(type)) return null;
  // FIGML exports a bare group container as `type="GROUP"` (e.g. a `<Group>` wrapping a nested
  // table). It is a structural frame, NOT a node to drop — falling through to `default` here
  // would silently discard the whole subtree (report §6.1: the "Rincian komponen" table vanished).
  if (type === "GROUP") type = "FRAME";

  const x = ox + num(attrs.x);
  const y = oy + num(attrs.y);
  const w = num(attrs.width);
  const h = num(attrs.height);
  const name = attrs.name || tag;
  const color = colorOf(attrs);

  // Shared box properties (per-corner radius, border/stroke, flex distribution) — computed
  // once so every box type (rectangle/frame/instance) surfaces them consistently.
  const radius = num(attrs.cornerRadius) || undefined; // uniform radius (back-compat)
  const corners = perCornerRadius(attrs);              // { tl,tr,br,bl } only when asymmetric
  const border = borderOf(attrs);                      // { color, width? } — fill vs stroke distinct
  const justify = justifyContentOf(attrs);             // "space-between" | null

  const base = {
    id: idOf(attrs.id, name),
    x: Math.round(x),
    y: Math.round(y),
    w: Math.round(w),
    h: Math.round(h),
    // A node hidden in the design is SURFACED, not dropped: `hidden:true` carries the design
    // state (required asterisk, hidden section, auth-only action icon) so the agent never
    // renders it visible. (report §6.2/§7.1)
    ...(isHidden(attrs) ? { hidden: true } : {}),
  };

  switch (type) {
    case "TEXT": {
      const style = {
        size: num(attrs.fontSize) || undefined,
        weight: attrs.fontWeight ? Number(attrs.fontWeight) : undefined,
        color: color ?? undefined,
        family: fontFamily(attrs),
      };
      const lineHeight = childNumAttr(kids, "lineHeight");
      const letterSpacing = childNumAttr(kids, "letterSpacing");
      if (lineHeight) style.lineHeight = lineHeight;
      if (letterSpacing) style.letterSpacing = letterSpacing;
      return { ...base, type: "text", text: attrs.characters ?? "", style };
    }

    case "RECTANGLE":
      return {
        ...base,
        type: w > 1 && h > 1 ? "image" : "divider",
        radius,
        ...(corners ? { cornerRadius: corners } : {}),
        bg: colorOf(attrs) ?? undefined,
        ...(border ? { border } : {}),
      };

    case "LINE":
      // A LINE carries its visible color as a STROKE, not a fill — surface the stroke color as
      // `bg` so divider-color fidelity (dividerColorOf reads n.bg) doesn't drop it (report §5.1:
      // "border #e0e5ed padahal stroke asli #bdbdbd").
      return { ...base, type: "divider", bg: border?.color ?? color ?? undefined };

    case "VECTOR":
      // Carry the vector's fill color — a status/action icon's color is the design effect
      // that was being lost (defect #3: red #f44444 / pink #f6cacb badge icons dropped).
      return { ...base, type: "icon", description: name, bg: color ?? undefined };

    case "FRAME": {
      const axis = attrs.layoutMode === "HORIZONTAL" ? "row" : attrs.layoutMode === "VERTICAL" ? "column" : undefined;
      const node = {
        ...base,
        type: "group",
        axis,
        radius,
        ...(corners ? { cornerRadius: corners } : {}),
        ...(paddingOf(attrs) ? { padding: paddingOf(attrs) } : {}),
        // gap is literal spacing only in PACKED auto-layout; SPACE_BETWEEN is a flex
        // distribution — emit `justify` instead of a bogus `gap:497` (report §5.2/§7.4).
        ...(justify ? { justify } : num(attrs.itemSpacing) ? { gap: num(attrs.itemSpacing) } : {}),
        bg: colorOf(attrs) ?? undefined,
        ...(border ? { border } : {}),
      };
      const childNodes = walkNodes(kids, x, y);
      if (childNodes.length) node.children = childNodes;
      return node;
    }

    case "INSTANCE": {
      const cls = classifyInstance(name);
      const axis = attrs.layoutMode === "HORIZONTAL" ? "row" : attrs.layoutMode === "VERTICAL" ? "column" : undefined;
      const node = {
        ...base,
        type: cls.type,
        axis,
        radius,
        ...(corners ? { cornerRadius: corners } : {}),
        ...(paddingOf(attrs) ? { padding: paddingOf(attrs) } : {}),
        ...(justify ? { justify } : num(attrs.itemSpacing) ? { gap: num(attrs.itemSpacing) } : {}),
        bg: colorOf(attrs) ?? undefined,
        ...(border ? { border } : {}),
      };
      const childNodes = walkNodes(kids, x, y);
      const label = childNodes.length ? firstText(childNodes) : "";
      if (cls.type === "button" && label) node.text = label;
      if (cls.type === "input") node.label = label;
      if (cls.type === "icon") node.description = name;
      if (cls.table) node.table = true;
      if (attrs.variantType) node.variant = attrs.variantType;
      if (childNodes.length) node.children = childNodes;
      return node;
    }

    default:
      return null;
  }
}

function classifyInstance(name) {
  const n = name || "";
  if (/Button|_btn|Btn/i.test(n)) return { type: "button" };
  if (/^Field|_field|^search|Input|Select|Dropdown|Combobox/i.test(n)) return { type: "input" };
  if (/Icon_|Icon$/i.test(n)) return { type: "icon" };
  // Must precede the "card" check — "Checkbox" contains "Box", which would otherwise
  // classify a checkbox as a card (defect #6: Checkbox_FNC rendered as a bare card#).
  if (/Checkbox|_checkbox/i.test(n)) return { type: "checkbox" };
  if (/Information|Alert|Card|Box|Panel/i.test(n)) return { type: "card" };
  if (/\b(Table|Datatable|DataGrid|Grid)\b/i.test(n)) return { type: "group", table: true };
  return { type: "group" };
}

function classifyByTag(tag) {
  const t = tag || "";
  if (/Text/i.test(t)) return "TEXT";
  if (/Rectangle/i.test(t)) return "RECTANGLE";
  if (/Line/i.test(t)) return "LINE";
  if (/Vector|Icon/i.test(t)) return "VECTOR";
  if (/Frame|Group/i.test(t)) return "FRAME";
  return "INSTANCE";
}

// A node's fill color (first visible fill), lowercased.
// FIGML nests fills as a child element: { fills: [ { fill: [...], ":@" : { color } } ] }.
// Some exports also put a flat fills array on the node attrs — accept both shapes.
function colorOf(attrsOrNode) {
  const src = attrsOrNode || {};
  const fills = src.fills;
  let arr;
  if (Array.isArray(fills)) {
    arr = fills;
  } else if (fills && Array.isArray(fills.fills)) {
    arr = fills.fills;
  } else if (fills && typeof fills === "object") {
    arr = [fills];
  } else {
    arr = [];
  }
  for (const f of arr) {
    const fat = f && (f[":@"] || f);
    if (fat && fat.color && fat.visible !== "false") return String(fat.color).toLowerCase();
  }
  return null;
}

/** A node hidden in the design (visible=false / opacity 0). Tolerates the encodings FIGML
 *  exports actually use: "false"/"FALSE"/"0", or opacity="0". Surfaced as `hidden:true`. */
function isHidden(attrs) {
  const v = attrs.visible;
  if (v != null && (String(v).toLowerCase() === "false" || String(v) === "0")) return true;
  if (attrs.opacity != null && Number(attrs.opacity) === 0) return true;
  return false;
}

/** Per-corner radius `{ tl, tr, br, bl }` — emitted ONLY when asymmetric. Symmetric corners are
 *  covered by the uniform `radius` (cornerRadius), so a symmetric node carries no `cornerRadius`
 *  field (no transcript bloat). Absent per-corner attrs default to the uniform radius. */
function perCornerRadius(attrs) {
  const u = num(attrs.cornerRadius);
  const hasCorner = ["topLeftRadius", "topRightRadius", "bottomRightRadius", "bottomLeftRadius"].some((k) => attrs[k] != null);
  if (!u && !hasCorner) return null;
  const tl = attrs.topLeftRadius != null ? num(attrs.topLeftRadius) : u;
  const tr = attrs.topRightRadius != null ? num(attrs.topRightRadius) : u;
  const br = attrs.bottomRightRadius != null ? num(attrs.bottomRightRadius) : u;
  const bl = attrs.bottomLeftRadius != null ? num(attrs.bottomLeftRadius) : u;
  if (tl === tr && tr === br && br === bl) return null; // symmetric → uniform radius covers it
  return { tl, tr, br, bl };
}

/** A node's stroke/border color (distinct from its fill `bg`). Reads a child <strokes><stroke/>,
 *  or a flat stroke attribute. `strokeWeight` lives on the NODE (FIGML puts it on the shape, not
 *  inside <stroke>); a `visible="false"` stroke is skipped (an invisible stroke is not a border). */
function borderOf(attrs) {
  if (attrs.stroke) {
    const color = String(attrs.stroke).toLowerCase();
    const w = num(attrs.strokeWeight);
    return w > 0 ? { color, width: w } : { color };
  }
  const strokes = attrs.strokes;
  let arr;
  if (Array.isArray(strokes)) arr = strokes;
  else if (strokes && Array.isArray(strokes.strokes)) arr = strokes.strokes;
  else if (strokes && typeof strokes === "object") arr = [strokes];
  else arr = [];
  const w = num(attrs.strokeWeight); // node-level, not stroke-level
  for (const s of arr) {
    const sat = s && (s[":@"] || s);
    if (!sat || !sat.color) continue;
    if (sat.visible != null && String(sat.visible).toLowerCase() === "false") continue; // invisible stroke
    const color = String(sat.color).toLowerCase();
    return w > 0 ? { color, width: w } : { color };
  }
  return null;
}

/** SPACE_BETWEEN auto-layout → "space-between" (a flex distribution, NOT a literal gap). Only
 *  this value matters for the gap-artifact fix; other alignment modes stay on `gap`. */
function justifyContentOf(attrs) {
  const v = attrs.primaryAxisAlignItems ?? attrs.justifyContent ?? attrs.justify;
  if (!v) return null;
  return String(v).replace(/[_\s-]/g, "").toLowerCase() === "spacebetween" ? "space-between" : null;
}

/** Detect a table: a group whose children are ≥3 full-width rows, flush-stacked vertically.
 *  Marks the container `table: true` so the generator maps it to capabilities.table
 *  (e.g. pilar's uii-table) instead of raw divs. FIGML exports tables as generic frame
 *  groups (not INSTANCE nodes), so the name-based classifyInstance can't catch them.
 *  Rows are `group` (FRAME) OR `image` (a full-width RECTANGLE header/footer band) — the
 *  nested-table case (report §6.1, design-6) where a header rectangle tops a stack of row
 *  frames, so a group-only filter would miss it. */
function markTables(nodes) {
  for (const node of nodes) {
    if (node.children?.length) markTables(node.children);
    if (node.type !== "group" || !node.children?.length) continue;
    if (!(node.w > 0 && node.h > 0)) continue; // skip zero-size layout-grid metadata
    const rows = node.children.filter((c) => c.type === "group" || c.type === "image");
    if (isTableRows(rows)) node.table = true;
  }
}

function isTableRows(rows) {
  if (rows.length < 3) return false;
  const x = rows[0].x, w = rows[0].w;
  let prevBottom = null;
  for (const r of rows) {
    if (!(r.w > 0 && r.h > 0)) return false; // zero-size rows are grid guides, not table rows
    if (Math.abs(r.x - x) > 2 || Math.abs(r.w - w) > 2) return false;
    if (prevBottom !== null && Math.abs(r.y - prevBottom) > 2) return false; // rows are flush (no gap)
    prevBottom = r.y + r.h;
  }
  return true;
}

function firstText(nodes) {
  for (const n of nodes) {
    if (n.type === "text" && n.text) return n.text;
    if (n.children) {
      const t = firstText(n.children);
      if (t) return t;
    }
  }
  return "";
}

function fontFamily(attrs) {
  const fn = attrs.fontName;
  if (fn && typeof fn === "object") return (fn[":@"] && fn[":@"].family) || fn.family;
  if (typeof fn === "string") return fn;
  return undefined;
}

/** Frame/instance box padding (top/right/bottom/left); null when no padding is set. */
function paddingOf(attrs) {
  const top = num(attrs.paddingTop) || num(attrs.verticalPadding);
  const right = num(attrs.paddingRight) || num(attrs.horizontalPadding);
  const bottom = num(attrs.paddingBottom) || num(attrs.verticalPadding);
  const left = num(attrs.paddingLeft) || num(attrs.horizontalPadding);
  if (!top && !right && !bottom && !left) return null;
  return { top, right, bottom, left };
}

/** Read a numeric child-element attribute (e.g. <lineHeight unit="PIXELS" value="24"/>).
 *  Returns undefined for AUTO lineHeight or a zero letterSpacing — those are defaults
 *  with no visual meaning, so we don't surface them. */
function childNumAttr(kids, tag) {
  for (const k of kids ?? []) {
    if (!k || !k[tag]) continue;
    const a = k[":@"] || {};
    const val = num(a.value);
    if (tag === "letterSpacing") return val !== 0 ? val : undefined;
    if (tag === "lineHeight") return a.unit === "AUTO" ? undefined : val || undefined;
  }
  return undefined;
}

/** Most-common positive value of a numeric series (for the spacing census).
 *  Ties break toward the smaller value — a smaller "base" is the more useful design-system unit. */
function mode(arr) {
  if (!arr.length) return undefined;
  const counts = new Map();
  for (const v of arr) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0][0];
}

/** Census padding + itemSpacing values from the raw XML → a spacing scale the agent can reuse. */
function censusSpacing(xml) {
  const pads = [];
  for (const m of xml.matchAll(/(?:paddingLeft|paddingRight|paddingTop|paddingBottom)="([0-9.]+)"/g)) {
    const v = Number(m[1]);
    if (v > 0) pads.push(v);
  }
  const gaps = [];
  for (const m of xml.matchAll(/itemSpacing="([0-9.]+)"/g)) {
    const v = Number(m[1]);
    if (v > 0) gaps.push(v);
  }
  return { base: mode(pads), gap: mode(gaps) };
}

/** Count fill colors across the raw XML. */
function censusColors(xml) {
  const counts = new Map();
  for (const m of xml.matchAll(/color="#([0-9a-fA-F]{6})"/g)) {
    const hex = "#" + m[1].toLowerCase();
    counts.set(hex, (counts.get(hex) ?? 0) + 1);
  }
  const total = [...counts.values()].reduce((s, n) => s + n, 0) || 1;
  const sorted = [...counts.entries()]
    .map(([hex, count]) => ({ hex, count, share: Math.round((count / total) * 1000) / 1000 }))
    .sort((a, b) => b.count - a.count);
  const lightest = [...sorted].sort((a, b) => luminance(b.hex) - luminance(a.hex))[0];
  const darkest = [...sorted].sort((a, b) => luminance(a.hex) - luminance(b.hex))[0];
  const accent = [...sorted].sort((a, b) => saturation(b.hex) - saturation(a.hex))[0];
  return sorted.slice(0, 12).map((c) => ({
    ...c,
    role: c.hex === lightest.hex ? "background" : c.hex === darkest.hex ? "text" : c.hex === accent.hex ? "accent" : "surface",
  }));
}

function hexChannel(hex, idx) {
  return parseInt(hex.slice(1 + idx * 2, 3 + idx * 2), 16);
}
function luminance(hex) {
  const r = hexChannel(hex, 0), g = hexChannel(hex, 1), b = hexChannel(hex, 2);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function saturation(hex) {
  const r = hexChannel(hex, 0) / 255, g = hexChannel(hex, 1) / 255, b = hexChannel(hex, 2) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  return mx === 0 ? 0 : (mx - mn) / mx;
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

let _idSeq = 0;
function idOf(id, name) {
  if (id) return String(id).replace(/[^a-zA-Z0-9_-]/g, "_");
  const base = String(name).replace(/[^a-zA-Z0-9_-]/g, "_") || "node";
  return `${base}_${++_idSeq}`;
}
