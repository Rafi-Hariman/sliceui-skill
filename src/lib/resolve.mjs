// resolve — deterministic idiom-resolution pass between transcribe and generate.
// Turns every styled leaf in the transcript into a `resolved[]` of EXACT candidates from the
// project corpus, so the agent never holds a raw hex/icon/class to invent. This is the
// council's "resolve-then-assemble": the wrong answer becomes unemittable, not merely catchable.
//
// Ground truth = XML + corpus (never conventions.md prose, never hope-result). When no idiom
// matches, emit a native-plain fallback — honest, never silent drop (prevents the toggle-caret
// gap where a real XML feature vanished).

import { walkNodes } from "./walk-nodes.mjs";

/** Semantic map: badge color + icon color → the correct label-custom-* + fa-* combo.
 *  Derived from co-occurrence in the project corpus (label-custom-waiting pairs #fef2f2 bg +
 *  #f44444 icon → fa-exclamation-circle), NOT guesswork. */
const FA_ICON_COLORS = {
  "#f44444": ["fa-exclamation-circle", "fa-times-circle", "fa-minus"],
  "#f9933f": ["fa-exclamation-triangle", "fa-exclamation"],
  "#4fbbbb": ["fa-check-circle"],
  "#03337b": ["fa-search", "fa-pencil", "fa-eye"],
};

/**
 * @param {object} transcript — parsed transcript (layout nodes)
 * @param {object} conventions — extractConventions() output (ngDeepCorpus, classVocabulary, componentAnatomy)
 * @returns {{ leaves: Array<{id,type,evidence,resolved,fallback}>, statusTable: Array }}
 */
export function resolveTranscript(transcript, conventions = {}) {
  const corpus = conventions.ngDeepCorpus ?? [];
  const vocab = new Set((conventions.classVocabulary ?? []).map((c) => c.name));
  const leaves = [];
  const statusTable = [];

  walkNodes(transcript?.layout, (node) => {
    const r = resolveNode(node, corpus, vocab);
    if (r) leaves.push(r);
    if (r?.kind === "status") statusTable.push(r);
  });

  return { leaves, statusTable };
}

/** Resolve a single styled leaf. Returns null for non-styled structural nodes. */
function resolveNode(node, corpus, vocab) {
  // Status badge: a group/row with bg #fef2f2-like + an icon child with a semantic color.
  const iconChild = findIconChild(node);
  const bg = node.bg ?? "";
  if (iconChild && isBadgeBg(bg)) {
    return resolveStatus(node, iconChild, corpus, vocab);
  }
  // A bare icon (caret/action) — its Figma node name (description) is the strongest signal for
  // WHICH glyph it is (caret vs pencil vs search); color only disambiguates within a family.
  // Color-first wrongly resolved every #03337b glyph (caret, pencil, eye) to fa-search.
  if (node.type === "icon" && node.bg) {
    const desc = (node.description ?? "").toLowerCase();
    const fa = iconFromName(desc) ?? iconFromColor(node.bg, corpus);
    return {
      id: node.id,
      kind: "icon",
      type: "icon",
      evidence: { color: node.bg, name: desc },
      resolved: fa ? [{ kind: "icon", value: fa }] : [],
      fallback: fa ? null : { kind: "native-plain", note: "icon glyph not resolvable from name/color — use the project's icon set" },
    };
  }
  // Button: variant (from XML componentProperties/variantProperties) → project btn class.
  // A Figma `variant: "secondary"` must map to `btn-secondary` (the bulk outline button), not a
  // hand-rolled class — the project already names it.
  if (node.type === "button" && node.variant) {
    const variant = node.variant.toLowerCase();
    const preferred = `btn-${variant}`;
    const cls = vocab.has(preferred) ? preferred : null;
    return {
      id: node.id,
      kind: "button",
      type: "button",
      evidence: { variant: node.variant, text: node.text ?? "" },
      resolved: cls ? [{ kind: "class", value: cls }] : [],
      fallback: cls ? null : { kind: "native-plain", note: `no ${preferred} in project vocabulary — use .btn + inline style` },
    };
  }
  return null;
}

/** Map a Figma icon node name to the concrete FontAwesome glyph. The FIGML plugin names icons
 *  after the FontAwesome glyph ("Icon_Font_Awesome_Free_Solid_C_caret-down"); Figma web export
 *  may name them generically ("Vector"). Keyword match beats color because color is ambiguous
 *  (#03337b is search/pencil/eye alike). */
const NAME_GLYPH = [
  [/caret-down|caret_down/i, "fa-caret-down"],
  [/caret-up|caret_up/i, "fa-caret-up"],
  [/caret|chevron-down/i, "fa-caret-down"],
  [/chevron|angle-(down|up)/i, "fa-chevron-down"],
  [/pencil|edit/i, "fa-pencil"],
  [/search|magnif/i, "fa-search"],
  [/eye/i, "fa-eye"],
  [/trash|delete/i, "fa-trash"],
  [/plus/i, "fa-plus"],
  [/minus/i, "fa-minus"],
  [/check(?!-)/i, "fa-check"],
  [/check-circle|check_circle/i, "fa-check-circle"],
  [/times-circle|times_circle|close/i, "fa-times-circle"],
  [/exclamation-circle|exclamation_circle|alert/i, "fa-exclamation-circle"],
  [/exclamation-triangle|warning/i, "fa-exclamation-triangle"],
];
function iconFromName(desc) {
  if (!desc) return null;
  for (const [re, fa] of NAME_GLYPH) {
    if (re.test(desc)) return fa;
  }
  return null;
}

function resolveStatus(node, iconChild, corpus, vocab) {
  const iconColor = iconChild.bg;
  // Badge icon semantics come from the DESIGN color (single source of truth): #f44444 ⇒ the
  // exclamation-circle FAMILY. Corpus-exact color matching (iconFromColor) is for bare action
  // icons, NOT badges — a corpus that colors a different glyph #f44444 (times-circle for a
  // rejected label) must not hijack a red badge's family. Name wins when present (caret vs edit).
  const fa = iconFromName((iconChild.description ?? "").toLowerCase())
    ?? (FA_ICON_COLORS[iconColor] ?? [])[0]
    ?? null;
  // The label class is decided by the badge's STATUS TEXT first — "Dibatalkan" ⇒ label-custom-cancel,
  // "Belum bayar" ⇒ label-custom-warning, "Lunas" ⇒ label-custom-success — because color alone is
  // ambiguous (exclamation-circle pairs warning/rejected/new-student alike). Only when the text
  // yields no label do we fall back to color co-occurrence.
  const statusText = badgeText(node);
  const label = labelFromStatusText(statusText, vocab)
    ?? labelFromCooccurrence(corpus, fa)
    ?? null;

  const resolved = [];
  if (label) resolved.push({ kind: "class", value: label });
  if (fa) resolved.push({ kind: "icon", value: fa });

  return {
    id: node.id,
    kind: "status",
    type: "status",
    evidence: { bg: node.bg, iconColor, statusText },
    resolved,
    // Co-occurrence ambiguity: when several labels pair with this icon and no text decided it,
    // surface ALL of them so the agent picks from the real status text — never a bg-only guess.
    candidates: label ? undefined : labelFromCooccurrenceCandidates(corpus, fa),
    // OOV fallback: no label-custom-* matches → native-plain, never silent drop.
    fallback: label ? null : { kind: "native-plain", note: `no label-custom-* matches status "${statusText ?? iconColor}" — use plain badge` },
  };
}

/** First text child of a badge node — the human status ("Dibatalkan", "Belum bayar"). */
function badgeText(node) {
  for (const c of node.children ?? []) {
    if (c.type === "text" && (c.text ?? "").trim()) return c.text.trim();
    if (c.children) {
      const deep = badgeText(c);
      if (deep) return deep;
    }
  }
  return null;
}

/** Deterministic status-text → label-custom class, only when that label exists in the project. */
const STATUS_LABELS = [
  [/dibatalkan|dibatalkan/i, "label-custom-cancel"],
  [/batal|reject|ditolak/i, "label-custom-rejected"],
  [/belum bayar|belum bayar|waiting|menunggu/i, "label-custom-warning"],
  [/lunas|sukses|success|selesai|aktif|active/i, "label-custom-success"],
  [/belum|baru|new/i, "label-custom-new-student"],
];
function labelFromStatusText(text, vocab) {
  if (!text) return null;
  const known = new Set(vocab ?? []);
  for (const [re, cls] of STATUS_LABELS) {
    if (re.test(text) && known.has(cls)) return cls;
  }
  // Last resort within STATUS_LABELS order is skipped; try generic: does the text match a
  // label-custom-<word> present in vocab (e.g. "resign" ⇒ label-custom-resign)?
  const word = /^[a-z]+$/i.test(text) ? text.toLowerCase() : null;
  if (word && known.has(`label-custom-${word}`)) return `label-custom-${word}`;
  return null;
}
function labelFromCooccurrence(corpus, fa) {
  const all = labelFromCooccurrenceCandidates(corpus, fa);
  return all[0] ?? null;
}
function labelFromCooccurrenceCandidates(corpus, fa) {
  if (!fa) return [];
  return corpus
    .filter((c) => /label-custom/.test(c.selector) && c.selector.includes(fa))
    .map((c) => c.selector.match(/label-custom-[a-z0-9-]+/)?.[0])
    .filter(Boolean);
}

function iconFromColor(color, corpus) {
  const faIcons = FA_ICON_COLORS[color] ?? [];
  // A corpus fa-* selector styled to this exact color is the strongest signal.
  const exact = corpus.find((c) => /\.fa-/.test(c.selector) && c.block && c.block.includes(color));
  return exact?.selector.match(/fa-[a-z0-9-]+/)?.[0] ?? faIcons[0] ?? null;
}

// ---------- helpers ----------

function isBadgeBg(bg) {
  // Exact badge backgrounds seen in the corpus/design — NOT generic #ffffff or pastel.
  // (Badge = small pill with a tinted bg + a colored icon, not a white card.)
  const b = bg.toLowerCase();
  return b === "#fef2f2" || b === "#fef7ec" || b === "#dcf5ef" || b === "#f6cacb";
}

function findIconChild(node) {
  for (const c of node.children ?? []) {
    if (c.type === "icon" && c.bg) return c;
    if (c.children) {
      const deep = findIconChild(c);
      if (deep) return deep;
    }
  }
  return null;
}
