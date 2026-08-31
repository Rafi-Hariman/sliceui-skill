// resolve — deterministic idiom-resolution pass between transcribe and generate.
// Turns every styled leaf in the transcript into a `resolved[]` of EXACT candidates from the
// project corpus, so the agent never holds a raw hex/icon/class to invent. This is the
// council's "resolve-then-assemble": the wrong answer becomes unemittable, not merely catchable.
//
// Ground truth = XML + corpus (never conventions.md prose, never hope-result). When no idiom
// matches, emit a native-plain fallback — honest, never silent drop (prevents the toggle-caret
// gap where a real XML feature vanished).

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
  // A bare icon (caret/action) — resolve its color to the fa-* set.
  if (node.type === "icon" && node.bg) {
    return {
      id: node.id,
      kind: "icon",
      type: "icon",
      evidence: { color: node.bg },
      resolved: resolveIconByColor(node.bg, corpus),
      fallback: null,
    };
  }
  return null;
}

function resolveStatus(node, iconChild, corpus, vocab) {
  const iconColor = iconChild.bg;
  const faIcons = FA_ICON_COLORS[iconColor] ?? [];
  // The fa icon is decided by the XML icon color (single source of truth).
  const fa = faIcons[0] ?? null;
  // The label class is decided by CO-OCCURRENCE: a corpus selector "label-custom-<x> .fa-<y>"
  // where <y> is the fa we just resolved means that label belongs to this icon. Multiple
  // candidates (waiting/rejected/verify all pair with exclamation-circle) are ambiguous at
  // the color level — we surface ALL of them so the agent (or a later text-status pass) picks,
  // but NEVER guess a single one by bg-only fallback.
  const cooccur = corpus
    .filter((c) => /label-custom/.test(c.selector) && fa && c.selector.includes(fa))
    .map((c) => c.selector.match(/label-custom-[a-z0-9-]+/)?.[0])
    .filter(Boolean);

  const label = cooccur[0] ?? null;

  const resolved = [];
  if (label) resolved.push({ kind: "class", value: label });
  if (fa) resolved.push({ kind: "icon", value: fa });

  return {
    id: node.id,
    kind: "status",
    type: "status",
    evidence: { bg: node.bg, iconColor },
    resolved,
    // Co-occurrence ambiguity: when several labels pair with this icon, the color alone is
    // insufficient — surface the full candidate set + a note (the text status decides).
    candidates: cooccur.length > 1 ? cooccur : undefined,
    // OOV fallback: no label-custom-* pairs this icon → native-plain, never silent drop.
    fallback: label ? null : { kind: "native-plain", note: `no label-custom-* pairs ${iconColor} icon — use plain badge` },
  };
}

function resolveIconByColor(color, corpus) {
  const faIcons = FA_ICON_COLORS[color] ?? [];
  // A corpus fa-* selector styled to this exact color is the strongest signal.
  const exact = corpus.find((c) => /\.fa-/.test(c.selector) && c.block && c.block.includes(color));
  const fa = exact?.selector.match(/fa-[a-z0-9-]+/)?.[0] ?? faIcons[0] ?? null;
  return fa ? [{ kind: "icon", value: fa }] : [];
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

function walkNodes(nodes, fn) {
  for (const n of nodes ?? []) {
    if (!n || typeof n !== "object") continue;
    fn(n);
    if (n.children) walkNodes(n.children, fn);
  }
}
