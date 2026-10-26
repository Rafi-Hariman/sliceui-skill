// resolve — deterministic idiom-resolution pass between transcribe and generate.
// Turns every styled leaf in the transcript into a `resolved[]` of EXACT candidates from the
// project corpus, so the agent never holds a raw hex/icon/class to invent. This is the
// council's "resolve-then-assemble": the wrong answer becomes unemittable, not merely catchable.
//
// Ground truth = XML + corpus (never conventions.md prose, never hope-result). When no idiom
// matches, emit a native-plain fallback — honest, never silent drop (prevents the toggle-caret
// gap where a real XML feature vanished).
//
// PR 4 — provenance + semantic safety. Every group now carries an explicit classification
// (implementation-recommendation / semantic-hypothesis / unresolved), an authority, a
// deterministic confidence, and traceable provenance (design + project + mapping), so a
// semantic guess can never render like a design fact. Typing vocabulary + budgets live in
// resolution-policy.mjs. `resolved[]` keeps its v1 shape — typing is ADDITIVE — so every
// existing consumer (skill instructions, api-contract, agent diagnostics) stays valid.

import {
  CONFIDENCE, RESOLUTION_BUDGET, behaviorBindingRecommendations,
} from "./resolution-policy.mjs";

/** Semantic map: badge color + icon color → the correct label-custom-* + fa-* combo.
 *  Derived from co-occurrence in the project corpus (label-custom-waiting pairs #fef2f2 bg +
 *  #f44444 icon → fa-exclamation-circle), NOT guesswork. */
const FA_ICON_COLORS = {
  "#f44444": ["fa-exclamation-circle", "fa-times-circle", "fa-minus"],
  "#f9933f": ["fa-exclamation-triangle", "fa-exclamation"],
  "#4fbbbb": ["fa-check-circle"],
  "#03337b": ["fa-search", "fa-pencil", "fa-eye"],
  "#004c88": ["fa-info-circle"], // banner info icon (Report #1 §6.4)
  "#3e82f3": ["fa-check-circle"], // "Aktif" badge glyph (Report #1 §6.6)
};

/** Figma web export names the painted shape inside an icon instance generically ("Vector"),
 *  while the FA glyph name sits on the INSTANCE wrapper one level up. These generic names carry
 *  no glyph signal and must not shadow an inherited icon-instance name. */
const GENERIC_ICON_NAME = /^(vector|icon|shape|group|frame|path|ellipse|rectangle|line|text|union|component|glyph|frame_?\d*|icon_(primary|secondary|white|default))$/i;

/** Which precedence rung produced an icon answer (mirrors ICON_PRECEDENCE tiers; the ladder
 *  lives in resolution-policy.mjs — these are the emission-side tags). */
const ICON_TIER = {
  VARIANT: "variantName",         // <variantProperties Name="sync"/> on the icon instance
  GLYPH: "glyphName",             // node/wrapper glyphName (the FA glyph name)
  INSTANCE: "description",        // node/wrapper description (Icon_Font_Awesome_…_caret-down)
};

/**
 * @param {object} transcript — parsed transcript (layout nodes)
 * @param {object} conventions — extractConventions() output (ngDeepCorpus, classVocabulary, componentAnatomy)
 * @param {object|null} [pilar] — loadPilar() output for public-API precedence (null on public installs)
 * @returns {{ leaves: Array, statusTable: Array, groups: Array }}
 */
export function resolveTranscript(transcript, conventions = {}, pilar = null) {
  const corpus = conventions.ngDeepCorpus ?? [];
  const vocab = new Set((conventions.classVocabulary ?? []).map((c) => c.name));
  const leaves = [];
  const statusTable = [];

  // DFS threading the nearest meaningful icon-instance name down to styled leaves. Real FIGML
  // web export nests the FA glyph name on an INSTANCE wrapper while the painted, color-bearing
  // leaf is its inner `Vector` child (generic name) — so the leaf must inherit the wrapper's name.
  // glyphName threads the same way: an empty-TEXT glyph under a named wrapper inherits it.
  // variantName threads too, but ONLY across icon nodes: a Figma variant on an icon instance is
  // the glyph itself ("sync", "check-circle"), while a variant on a FIELD ("dropdown", "Active")
  // is a component variant, not a glyph — inheriting that onto a nested caret would corrupt it.
  const walk = (nodes, inheritedName, inheritedGlyph, inheritedVariant) => {
    for (const node of nodes ?? []) {
      if (!node || typeof node !== "object") continue;
      // Visibility before resolution (focused/final remediation §4): a hidden design layer is
      // debug evidence, not an implementation choice — skip it (and its subtree) so it never
      // surfaces as an unresolved actionable mapping. It stays in the transcript as evidence.
      if (node.hidden) continue;
      const own = meaningfulIconName(node.description);
      const eff = own ?? inheritedName;
      // A generic glyphName ("glyph", "Vector") carries no FA signal — the inherited wrapper
      // name is the real glyph identity, so it wins over a generic own name.
      const effGlyph = meaningfulIconName(node.glyphName) ?? inheritedGlyph;
      const effVariant = (node.type === "icon" ? meaningfulIconName(node.variantName) : null) ?? inheritedVariant;
      const r = resolveNode(node, corpus, vocab, eff, effGlyph, effVariant, pilar);
      if (r) leaves.push(r);
      if (r?.kind === "status") statusTable.push(r);
      walk(node.children, eff, effGlyph, effVariant);
    }
  };
  walk(transcript?.layout, null, null, null);

  // PR 4 §13 — public-API precedence: behavior bindings (component input vs behavioral CSS)
  // resolved from structural design evidence + machine-verified capability. Lives alongside the
  // styled-leaf groups, not inside them — a behavior binding is a different kind of decision.
  const behaviorBindings = behaviorBindingRecommendations(transcript, pilar);

  return { leaves, statusTable, groups: groupLeaves(leaves), behaviorBindings };
}

/** Dedup identical leaves (a 10-row table repeats the same status/icon 10×; the 2026-09-10 run
 *  produced a 1,659-line resolved.json for ~10 unique facts). A group keeps the representative
 *  leaf + a count + every member id, so the agent reads ONE fact and knows it applies N times.
 *  `leaves` stays full for callers that address individual ids. Typing fields are part of the
 *  dedup key — two leaves resolving the same evidence through different policies stay separate. */
function groupLeaves(leaves) {
  const byKey = new Map();
  for (const leaf of leaves) {
    const key = JSON.stringify([leaf.kind, leaf.evidence, leaf.resolved, leaf.fallback,
      leaf.classification, leaf.confidence, leaf.fallbackUsed,
      leaf.candidates, leaf.rejected, leaf.provenance?.mapping]);
    if (!byKey.has(key)) byKey.set(key, { ...leaf, count: 1, ids: [leaf.id] });
    else {
      const g = byKey.get(key);
      g.count++;
      g.ids.push(leaf.id);
    }
  }
  return [...byKey.values()];
}

/** A non-generic icon description (the FA glyph name an INSTANCE wrapper carries), else null. */
function meaningfulIconName(desc) {
  const s = String(desc ?? "").trim();
  return s && !GENERIC_ICON_NAME.test(s) ? s : null;
}

// ---------- provenance helpers (PR 4) ----------
// Every entry points at WHERE the fact came from — a transcript path (design side) or a
// conventions/pilar locator (project side). Bounded to RESOLUTION_BUDGET.maxEvidence.

function designEvidence(nodeId, property, value) {
  return { type: "design-fact", nodeId, property, value: str(value) };
}

function projectEvidence(kind, locator, extra = {}) {
  return { type: kind, source: locator, ...extra };
}

/** Deterministic-mapping provenance (the rule that produced this value, not a source file). */
function mappingEvidence(rule, detail = null) {
  return { rule, ...(detail !== null ? { detail } : {}) };
}

function str(v) {
  return v == null ? null : String(v).slice(0, 120);
}

/** Resolve a single styled leaf. Returns null for non-styled structural nodes. */
function resolveNode(node, corpus, vocab, inheritedName = null, inheritedGlyph = null, inheritedVariant = null, pilar = null) {
  // Status badge: a group/row with bg #fef2f2-like + an icon child with a semantic color.
  const iconChild = findIconChild(node);
  const bg = node.bg ?? "";
  if (iconChild && isBadgeBg(bg)) {
    return resolveStatus(node, iconChild, corpus, vocab);
  }
  // An icon GLYPH exported as TEXT: the FIGML plugin renders FontAwesome glyphs as font text
  // whose characters come through empty — only the node/wrapper NAME ("Icon_..._T_toggle-on")
  // and the style color survive. The report (2026-09-10 §1) showed these as `"" {15px w900 …}`.
  // Treat such a leaf as an icon so it resolves from its glyphName instead of being skipped.
  const isTextGlyph = node.type === "text" && (node.glyphName ?? inheritedGlyph) && !(node.text ?? "").trim();
  if (isTextGlyph) {
    return resolveIconLeaf(
      { ...node, type: "icon", bg: node.style?.color ?? node.bg },
      corpus,
      node.glyphName ?? inheritedGlyph,
      ICON_TIER.GLYPH,
    );
  }
  // A bare icon (caret/action) — its Figma node name (description) is the strongest signal for
  // WHICH glyph it is (caret vs pencil vs search); color only disambiguates within a family.
  // Color-first wrongly resolved every #03337b glyph (caret, pencil, eye) to fa-search.
  // The name may sit on the INSTANCE wrapper (real FIGML nests FA name above a generic "Vector"
  // leaf); use the leaf's own meaningful name, else the inherited one from `resolveTranscript`.
  // A Figma VARIANT name on the icon instance is often the glyph itself (F8: "sync") — prefer it
  // over the generic node name when both exist.
  if (node.type === "icon" && node.bg) {
    const variant = meaningfulIconName(node.variantName ?? inheritedVariant);
    const glyph = meaningfulIconName(node.glyphName) ?? inheritedGlyph;
    const desc = meaningfulIconName(node.description) ?? inheritedName;
    const signal = variant ?? glyph ?? desc;
    const tier = variant ? ICON_TIER.VARIANT : glyph ? ICON_TIER.GLYPH : desc ? ICON_TIER.INSTANCE : null;
    return resolveIconLeaf(node, corpus, signal, tier);
  }
  return resolveButtons(node, vocab);
}

/** Shared icon-leaf resolution (VECTOR/INSTANCE icons and glyph-as-text leaves).
 *  `glyphSignal` is the glyph name — the node's own or the one inherited from a named wrapper;
 *  `tier` says which precedence rung supplied it (null = color-only). The ladder: metadata
 *  (variant/glyph/instance name) → corpus exact color → color family → unresolved. A button
 *  label is never a rung — text inference cannot beat icon metadata (PR 4 §14). */
function resolveIconLeaf(node, corpus, glyphSignal, tier = ICON_TIER.INSTANCE) {
  {
    const ownDesc = meaningfulIconName(node.description ?? glyphSignal);
    const name = String(ownDesc ?? glyphSignal ?? "").toLowerCase();
    const fa = iconFromName(name);

    // Name/metadata evidence resolved a glyph → single confident answer (HIGH: deterministic
    // alias mapping — "sync" → FA4 fa-refresh, caret-down → fa-caret-down).
    if (fa) {
      return {
        id: node.id,
        kind: "icon",
        type: "icon",
        evidence: { color: node.bg, name },
        resolved: [{ kind: "icon", value: fa }],
        classification: "implementation-recommendation",
        authority: "hint",
        confidence: CONFIDENCE.HIGH.score,
        fallbackUsed: false,
        provenance: {
          design: [designEvidence(node.id, tier, glyphSignal ?? name)],
          project: [projectEvidence("alias-registry", "resolve.NAME_GLYPH", { fa4Pinned: true })],
          mapping: mappingEvidence("icon-alias-registry"),
        },
        fallback: null,
      };
    }

    // No name evidence → fall back to color. A corpus fa-* styled to this exact color beats the
    // ambiguous color default (H1: exact > guess).
    const exact = corpus.find((c) => /\.fa-/.test(c.selector) && c.block && c.block.includes(node.bg));
    if (exact) {
      const exactFa = exact.selector.match(/fa-[a-z0-9-]+/)?.[0];
      return {
        id: node.id,
        kind: "icon",
        type: "icon",
        evidence: { color: node.bg, name },
        resolved: exactFa ? [{ kind: "icon", value: exactFa }] : [],
        classification: exactFa ? "semantic-hypothesis" : "unresolved",
        authority: exactFa ? "hint" : "fallback",
        confidence: exactFa ? CONFIDENCE.MEDIUM.score : CONFIDENCE.NONE.score,
        fallbackUsed: false,
        provenance: {
          design: [designEvidence(node.id, "bg", node.bg)],
          project: [projectEvidence("corpus", "conventions.json.ngDeepCorpus", { selector: exact.selector })],
          mapping: mappingEvidence("corpus-exact-color"),
        },
        fallback: exactFa ? null : { kind: "native-plain", note: `icon color ${node.bg} matches corpus selector ${exact.selector} but no fa-* glyph name is extractable — infer from the action context; never a confident guess` },
      };
    }

    const family = FA_ICON_COLORS[node.bg] ?? [];
    if (family.length === 1) {
      return {
        id: node.id,
        kind: "icon",
        type: "icon",
        evidence: { color: node.bg, name },
        resolved: [{ kind: "icon", value: family[0] }],
        classification: "semantic-hypothesis",
        authority: "hint",
        confidence: CONFIDENCE.MEDIUM.score,
        fallbackUsed: false,
        provenance: {
          design: [designEvidence(node.id, "bg", node.bg)],
          project: [projectEvidence("color-map", "resolve.FA_ICON_COLORS")],
          mapping: mappingEvidence("color-family-single"),
        },
        fallback: null,
      };
    }
    if (family.length > 1) {
      // Ambiguous color + no glyph name anywhere: DO NOT confidently emit the color-default first
      // item (e.g. fa-search for #03337b). Surface the whole family + a note so the agent picks by
      // the XML action context — honest over false confidence (H1).
      const bounded = family.slice(0, RESOLUTION_BUDGET.maxCandidates);
      return {
        id: node.id,
        kind: "icon",
        type: "icon",
        evidence: { color: node.bg, name },
        resolved: bounded.map((v) => ({ kind: "icon", value: v })),
        classification: "semantic-hypothesis",
        authority: "hint",
        confidence: CONFIDENCE.LOW.score,
        fallbackUsed: false,
        candidates: bounded,
        provenance: {
          design: [designEvidence(node.id, "bg", node.bg)],
          project: [projectEvidence("color-map", "resolve.FA_ICON_COLORS")],
          mapping: mappingEvidence("color-family-ambiguous"),
        },
        fallback: { kind: "native-plain", note: `icon color ${node.bg} is ambiguous (${family.join("/")}) with no glyph name in the XML — pick by the action context, not color alone` },
      };
    }
    return {
      id: node.id,
      kind: "icon",
      type: "icon",
      evidence: { color: node.bg, name },
      resolved: [],
      classification: "unresolved",
      authority: "fallback",
      confidence: CONFIDENCE.NONE.score,
      fallbackUsed: true,
      provenance: {
        design: [designEvidence(node.id, "bg", node.bg)],
        project: [],
        mapping: mappingEvidence("no-evidence"),
      },
      fallback: { kind: "native-plain", note: `icon glyph not resolvable from name (${name || "none"}) / color (${node.bg}) — infer from the action context; never a confident guess` },
    };
  }
}

/** Button resolution: a Figma variant, or a bg-mapped primary/secondary. */
function resolveButtons(node, vocab) {
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
      classification: cls ? "implementation-recommendation" : "unresolved",
      authority: cls ? "hint" : "fallback",
      confidence: cls ? CONFIDENCE.STRONG.score : CONFIDENCE.NONE.score,
      fallbackUsed: !cls,
      provenance: {
        design: [designEvidence(node.id, "variant", node.variant)],
        project: cls
          ? [projectEvidence("vocabulary", "conventions.json.classVocabulary", { name: cls })]
          : [],
        mapping: mappingEvidence("variant-class-mapping", cls ? "verified" : "absent"),
      },
      fallback: cls ? null : { kind: "native-plain", note: `no ${preferred} in project vocabulary — use .btn + inline style` },
    };
  }
  // Button with NO Figma variant (real FIGML export carries `bg` + text color, not a variant):
  // white/transparent fill + colored text → the outline/secondary action; any solid fill → primary.
  if (node.type === "button" && node.bg) {
    const bg = String(node.bg).toLowerCase();
    const isOutline = bg === "#ffffff" || bg === "#fff" || bg === "";
    const preferred = isOutline ? "btn-secondary" : "btn-primary";
    const cls = vocab.has(preferred) ? preferred : null;
    return {
      id: node.id,
      kind: "button",
      type: "button",
      evidence: { bg: node.bg, text: node.text ?? "" },
      resolved: cls ? [{ kind: "class", value: cls }] : [],
      classification: cls ? "semantic-hypothesis" : "unresolved",
      authority: cls ? "hint" : "fallback",
      confidence: cls ? CONFIDENCE.MEDIUM.score : CONFIDENCE.NONE.score,
      fallbackUsed: !cls,
      provenance: {
        design: [designEvidence(node.id, "bg", node.bg)],
        project: cls
          ? [projectEvidence("vocabulary", "conventions.json.classVocabulary", { name: cls })]
          : [],
        mapping: mappingEvidence("bg-class-heuristic", cls ? "verified" : "absent"),
      },
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
  [/toggle-on|toggle_on/i, "fa-toggle-on"],
  [/toggle-off|toggle_off/i, "fa-toggle-off"],
  // Bare "toggle" before the generic chevron rule — a toggle switch is not a chevron.
  [/toggle|switch/i, "fa-toggle-on"],
  [/pencil|edit/i, "fa-pencil"],
  [/search|magnif/i, "fa-search"],
  // `fa-sync-alt` is FontAwesome 5+; this org's projects pin `font-awesome@^4.7.0`, where the
  // class does not exist and renders an empty box. `fa-refresh` is the FA4 name of the same
  // glyph. Verified 2026-09-24 against the field project's package.json (report §4.2).
  [/sync|refresh|reload/i, "fa-refresh"],
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
  // exclamation-circle FAMILY. A corpus that colors a different glyph #f44444 (times-circle for
  // a rejected label) must not hijack a red badge's family. Name wins when present (caret vs edit).
  const fa = iconFromName((iconChild.description ?? "").toLowerCase())
    ?? (FA_ICON_COLORS[iconColor] ?? [])[0]
    ?? null;
  // The label class is decided by the badge's STATUS TEXT first — "Dibatalkan" ⇒ label-custom-cancel,
  // "Belum bayar" ⇒ label-custom-warning, "Lunas" ⇒ label-custom-success — because color alone is
  // ambiguous (exclamation-circle pairs warning/rejected/new-student alike). Only when the text
  // yields no label do we fall back to color co-occurrence.
  const statusText = badgeText(node);
  const textLabel = labelFromStatusText(statusText, vocab);
  const cooccurrence = labelFromCooccurrenceCandidates(corpus, fa);

  // TAX-001 — ambiguity is surfaced, never collapsed. The winning label is the status TEXT when
  // it matches the documented table; otherwise, exactly one co-occurrence candidate is the only
  // defensible pick. MULTIPLE co-occurrence candidates have no deterministic semantic winner
  // (array/corpus order is not evidence) → emit the bounded candidate list with no selection and
  // an explicit diagnostic, instead of silently taking the first.
  const labelBy = textLabel ? "status-text-table" : "corpus-cooccurrence";
  const label = textLabel ?? (cooccurrence.length === 1 ? cooccurrence[0] : null);
  const ambiguous = !textLabel && cooccurrence.length > 1;
  const candidates = ambiguous
    ? stableUnique(cooccurrence).slice(0, RESOLUTION_BUDGET.maxCandidates)
    : undefined;

  const resolved = [];
  if (label) resolved.push({ kind: "class", value: label });
  if (fa) resolved.push({ kind: "icon", value: fa });

  // Typing (PR 4): a status mapping is a RECOMMENDED PROJECT IDIOM, never a design fact.
  // Text-table match (documented status→class mapping + the class verified present) is STRONG;
  // corpus co-occurrence (icon pairs this label somewhere in the project) is MEDIUM; multiple
  // equal co-occurrence candidates with no text winner is AMBIGUOUS (0.50). Color alone can
  // never reach any of these — isBadgeBg only classifies the shape, it picks nothing.
  const labelConfidence = textLabel
    ? CONFIDENCE.STRONG.score
    : cooccurrence.length === 1
      ? CONFIDENCE.MEDIUM.score
      : ambiguous
        ? CONFIDENCE.LOW.score
        : CONFIDENCE.NONE.score;

  return {
    id: node.id,
    kind: "status",
    type: "status",
    evidence: { bg: node.bg, iconColor, statusText },
    resolved,
    classification: label ? "implementation-recommendation" : ambiguous ? "semantic-hypothesis" : "unresolved",
    authority: label ? "hint" : ambiguous ? "hint" : "fallback",
    confidence: labelConfidence,
    fallbackUsed: !label && !ambiguous,
    // Ambiguous co-occurrence stays a bounded candidate list — the agent picks from the real
    // status text, never a bg-only guess.
    candidates,
    provenance: {
      design: [
        designEvidence(node.id, "bg", node.bg),
        designEvidence(node.id, "children.icon.bg", iconColor),
        ...(statusText ? [designEvidence(node.id, "children.text", statusText)] : []),
      ].slice(0, RESOLUTION_BUDGET.maxEvidence),
      project: label
        ? [projectEvidence(
            labelBy === "status-text-table" ? "vocabulary" : "corpus",
            labelBy === "status-text-table" ? "conventions.json.classVocabulary + resolve.STATUS_LABELS" : "conventions.json.ngDeepCorpus",
            labelBy === "status-text-table" ? { name: label } : { selector: `${label} + ${fa ?? "?"}` },
          )]
        : ambiguous
          ? [projectEvidence("corpus", "conventions.json.ngDeepCorpus", { candidateCount: cooccurrence.length })]
          : [],
      mapping: mappingEvidence(
        label ? labelBy : ambiguous ? "corpus-cooccurrence-ambiguous" : "absent",
        label ? (labelBy === "status-text-table" ? "verified" : "cooccurrence") : null,
      ),
    },
    // Ambiguous taxonomy — no single winner, so no class is selected and no conservative fallback
    // is invented; the diagnostic tells the agent to disambiguate from the design's status text.
    diagnostics: ambiguous
      ? [{
          code: "SUI-RESOLVE-STATUS-AMBIGUOUS",
          nodeId: node.id,
          statusText: statusText ?? null,
          iconColor,
          candidateCount: cooccurrence.length,
          selected: null,
          handling: "multiple project taxonomy candidates have equivalent evidence — pick from the design's status text, never guess",
        }]
      : undefined,
    // OOV fallback (zero candidates): no label-custom-* matches → native-plain, never silent drop.
    fallback: label || ambiguous
      ? null
      : { kind: "native-plain", note: `no label-custom-* matches status "${statusText ?? iconColor}" — use plain badge` },
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
function labelFromCooccurrenceCandidates(corpus, fa) {
  if (!fa) return [];
  return corpus
    .filter((c) => /label-custom/.test(c.selector) && c.selector.includes(fa))
    .map((c) => c.selector.match(/label-custom-[a-z0-9-]+/)?.[0])
    .filter(Boolean);
}

/** Dedup candidates in first-seen (corpus) order — a stable, deterministic presentation order
 *  that is NOT a semantic winner selector. Order is presentation only; a multi-candidate set
 *  stays ambiguous regardless of how it is sorted. */
function stableUnique(values) {
  const seen = new Set();
  const out = [];
  for (const v of values ?? []) {
    if (v && !seen.has(v)) { seen.add(v); out.push(v); }
  }
  return out;
}

// ---------- helpers ----------

function isBadgeBg(bg) {
  // Exact badge backgrounds seen in the corpus/design — NOT generic #ffffff or pastel.
  // (Badge = small pill with a tinted bg + a colored icon, not a white card.)
  // #eef6ff = the "Aktif" badge (Report #1 §6.6) — included so it resolves to label-custom-*.
  const b = bg.toLowerCase();
  return b === "#fef2f2" || b === "#fef7ec" || b === "#dcf5ef" || b === "#f6cacb" || b === "#eef6ff";
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
