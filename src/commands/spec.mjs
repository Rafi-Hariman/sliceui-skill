// sliceui spec — emit ONE zero-ambiguity document the agent renders in a single pass.
// The 3-pass generate (inventory → layout → styling) made the LLM re-derive, by guessing, what
// transcribe + resolve already computed — the single biggest time sink in a slice (2026-09-10
// council: "make the LLM a renderer over a complete spec, not an oracle recovering from bad
// input"). This file merges the three inputs the agent used to juggle into one:
//
//   elements      — every transcript node, with its resolved idiom INLINE (no cross-referencing)
//   copy verbatim — the reusable ::ng-deep corpus blocks (styling, the only thing the LLM invents)
//   layout rules  — the geometry tokens + the N-field+button flex recipe
//
// Read .sliceui/artifacts/<name>/spec.md before generating; generate FROM it in one pass.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, basename } from "node:path";
import { parseFigml } from "../lib/figml-parse.mjs";
import { resolveTranscript } from "../lib/resolve.mjs";
import { loadPilar } from "../lib/pilar-loader.mjs";
import { buildAgentContext } from "../lib/agent-context.mjs";

/** Walk the layout tree, yielding every node in document order. */
function walkNodes(nodes, out = []) {
  for (const n of nodes ?? []) {
    if (!n || typeof n !== "object") continue;
    out.push(n);
    if (n.children) walkNodes(n.children, out);
  }
  return out;
}

/** Compact single-line summary of a node's visible facts (mirrors renderTranscript, minus noise).
 *  Geometry `[x,y w×h]` is INLINE — the 2026-09-11 session (F9) showed that dropping it made the
 *  agent render a divider full-width and mis-inset the title (2 of 3 user bugs). Position is a
 *  design fact, not noise. */
function summarize(n) {
  const parts = [];
  if (n.x !== undefined && n.w !== undefined) parts.push(`[${n.x},${n.y ?? 0} ${n.w}×${n.h ?? 0}]`);
  if (n.text) parts.push(`"${n.text}"`);
  if (n.description && n.type === "icon") parts.push(`(${n.description})`);
  if (n.glyphName && n.type !== "text") parts.push(`glyph:${n.glyphName}`);
  if (n.bg) parts.push(`bg:${n.bg}`);
  if (n.axis) parts.push(n.axis);
  if (n.table) parts.push("[TABLE]");
  if (n.hidden) parts.push("[HIDDEN]");
  if (n.style?.size) parts.push(`${n.style.size}px`);
  if (n.style?.weight && n.style.weight !== 400) parts.push(`w${n.style.weight}`);
  if (n.style?.color) parts.push(n.style.color);
  if (n.radius) parts.push(`r:${n.radius}`);
  if (n.padding) parts.push(`pad:${n.padding.top}/${n.padding.right}/${n.padding.bottom}/${n.padding.left}`);
  if (n.gap) parts.push(`gap:${n.gap}`);
  if (n.justify) parts.push(`justify:${n.justify}`);
  if (n.border) parts.push(`border:${n.border.width ? `${n.border.width}x` : ""}${n.border.color}`);
  return parts.join(" ");
}

/** Render a resolved idiom (or the honest fallback) for one element line. */
function renderIdiom(leaf) {
  if (!leaf) return "";
  if (leaf.resolved?.length) {
    return leaf.resolved.map((x) => x.value).join(" + ");
  }
  if (leaf.candidates?.length) {
    return `CANDIDATES: ${leaf.candidates.join(" / ")} — pick by action/status context`;
  }
  if (leaf.fallback) {
    return `FALLBACK: ${leaf.fallback.kind} — ${leaf.fallback.note}`;
  }
  return "";
}

export function buildSpec(transcript, conventions = {}) {
  const { groups } = resolveTranscript(transcript, conventions);

  // id → resolved leaf, so every element carries its idiom inline.
  const idiomByNode = new Map();
  for (const g of groups) {
    for (const id of g.ids ?? [g.id]) idiomByNode.set(id, g);
  }

  const L = [];
  const stem = basename(transcript?.meta?.image ?? "design").replace(/\.[^.]+$/, "");
  L.push(`# Spec — ${stem}`);
  L.push("");
  L.push("Render this into component code in ONE pass. Every element already carries its resolved");
  L.push("idiom inline — do not re-derive or guess. The transcript owns appearance; the idioms own");
  L.push("class/icon names. Emit ONLY the strings shown; anything else is a mistake.");
  L.push("");

  // --- elements ---
  L.push("## Elements (in document order)");
  L.push("");
  L.push("```");
  for (const n of walkNodes(transcript?.layout)) {
    const idiom = renderIdiom(idiomByNode.get(n.id));
    const summary = summarize(n);
    const idiomStr = idiom ? `  →  ${idiom}` : "";
    L.push(`${n.type}#${n.id}${summary ? ` ${summary}` : ""}${idiomStr}`);
  }
  L.push("```");
  L.push("");

  // --- unique resolved idioms (the deduped facts) ---
  L.push("## Resolved idioms (unique facts)");
  L.push("");
  for (const g of groups) {
    const idiom = renderIdiom(g);
    const evidence = Object.entries(g.evidence ?? {})
      .map(([k, v]) => `${k}=${v}`)
      .join(", ");
    const times = g.count > 1 ? `  (applies to ${g.count} elements: ${g.ids.join(", ")})` : "";
    L.push(`- \`${g.kind}\` ${evidence} → **${idiom}**${times}`);
  }
  L.push("");

  // --- copy verbatim (pruned to the design's own capabilities) ---
  // P0-4: the corpus holds every reusable ::ng-deep block the project has ever needed, across all
  // families. A slice of a bare table must not carry the select-family blocks (and vice versa) —
  // that is the raw-source bloat the plan targets.
  //
  // Conservative on purpose: only the two families derivable UNIQUELY from the transcript node
  // types (`input` → select, table flag → table) are pruned. A block with no family, or a family
  // this pass can't prove unused (label/status, form, layout), is KEPT — never drop what can't be
  // shown unused.
  const PRUNABLE_FAMILIES = new Set(["select", "table"]);
  const inPlay = familiesInPlay(transcript?.layout);
  const reusable = (conventions.ngDeepCorpus ?? [])
    .filter((c) => c.reusable)
    .filter((c) => !c.family || !PRUNABLE_FAMILIES.has(c.family) || inPlay.has(c.family));
  L.push("## Copy verbatim (reusable ::ng-deep corpus)");
  L.push("");
  if (!reusable.length) {
    L.push("_(none — thin corpus; use the transcript's exact colors/radius/spacing + framework defaults.)_");
  }
  for (const c of reusable) {
    L.push(`### \`${c.selector}\``);
    L.push("```scss");
    L.push(c.block ?? "");
    L.push("```");
    L.push("");
  }

  // --- layout rules ---
  L.push("## Layout rules");
  L.push("");
  L.push("- `r:N` → `border-radius: Npx`; `r:tl/tr/br/bl` → per-corner radius.");
  L.push("- `border:Wx#hex` → `border: Wpx solid #hex` (a stroke is a border, NOT `bg`).");
  L.push("- `pad:t/r/b/l` → padding; `gap:N` → real gap.");
  L.push("- `justify:space-between` → flex `justify-content: space-between` (never a literal wide gap).");
  L.push("- `[HIDDEN]` → do NOT render visible; reproduce the state (auth flag / conditional).");
  L.push("- Filter row with N fields + a button: `display:flex; align-items:flex-end; gap:<gap>px`, each field `flex:1 1 0`, button `flex:0 0 auto`.");
  L.push("- 3 items → `col-md-4` each; 4 items → `col-md-3` each; grid spans must total ≤ 12.");

  // --- layout verdicts (the geometry facts the agent used to get wrong) ---
  const verdicts = layoutVerdicts(transcript?.layout);
  if (verdicts.length) {
    L.push("");
    L.push("## Layout verdicts (read these — they are the geometry the renderer must reproduce)");
    L.push("");
    for (const v of verdicts) L.push(`- ${v}`);
  }

  return L.join("\n");
}

/** Which corpus families are actually IN PLAY for this design, from the transcript alone (the
 *  spec runs before any code exists, so it cannot look at generated HTML the way verify's
 *  relevantCorpus does). A transcript `input` node → the `select` family; a table-marked group →
 *  the `table` family. Families not derivable from the transcript (`layout`, `form`) are left
 *  unclaimed — blocks there are kept by the caller's "no family ⇒ keep" rule. */
export function familiesInPlay(layout) {
  const set = new Set();
  const walk = (nodes) => {
    for (const n of nodes ?? []) {
      if (!n || typeof n !== "object") continue;
      if (n.type === "input") set.add("select");
      if (n.table) set.add("table");
      if (n.children) walk(n.children);
    }
  };
  walk(layout);
  return set;
}

/** Compute explicit geometry verdicts for the patterns the agent has repeatedly gotten wrong:
 *  divider inset (a divider narrower than its container is INSET, not full-width) and a centered
 *  footer action bar (two buttons symmetric about the container center). These were the source of
 *  2 of the 3 user bugs in 2026-09-11 (F9). */
function layoutVerdicts(layout) {
  const out = [];
  const walk = (nodes, parentX = 0, parentW = 0) => {
    for (const n of nodes ?? []) {
      const x = n.x ?? 0, w = n.w ?? 0, y = n.y ?? 0, h = n.h ?? 0;
      if (n.type === "divider" && parentW > 0 && w > 0 && w < parentW - 1) {
        const inset = Math.round(Math.max(x - parentX, (parentX + parentW) - (x + w)));
        out.push(`divider#${n.id}: INSET ${inset}px (x=${x}, w=${w}, parent ${parentX}–${parentX + parentW}) → \`margin: 0 ${inset}px\`, NOT full-width`);
      }
      if (n.type === "group" && parentW > 0 && n.children?.length === 2 && n.children.every((c) => c.type === "button")) {
        const [a, b] = n.children;
        const centerOfPair = (a.x + a.w / 2 + b.x + b.w / 2) / 2;
        const parentCenter = parentX + parentW / 2;
        if (Math.abs(centerOfPair - parentCenter) < 4) {
          out.push(`group#${n.id}: footer action bar CENTERED (pair symmetric about ${Math.round(parentCenter)}) → \`justify-content: center\``);
        }
      }
      if (n.children) walk(n.children, x, w);
    }
  };
  walk(layout);
  return out;
}

export async function main(argv) {
  const path = argv[0];
  if (!path) {
    console.error("usage: sliceui spec <transcript|xml>");
    return 2;
  }
  const abs = path.startsWith("/") ? path : join(process.cwd(), path);

  let transcript;
  if (/\.(xml|figml)$/i.test(abs)) {
    const xml = readFileSync(abs, "utf8");
    const r = parseFigml(xml, basename(abs));
    if (!r.ok) { console.error("parse failed:", r.reason, r.message); return 3; }
    transcript = r.transcript;
  } else {
    transcript = JSON.parse(readFileSync(abs, "utf8"));
  }

  const conventions = readConventions(process.cwd());
  const spec = buildSpec(transcript, conventions);

  const stem = basename(abs).replace(/\.(xml|figml|json)$/i, "");
  const outDir = join(process.cwd(), ".sliceui", "artifacts", stem);
  mkdirSync(outDir, { recursive: true });
  const out = join(outDir, `spec.md`);
  writeFileSync(out, spec);

  // PR 1 — design-scoped agent context. Built only from the design artifacts + `.sliceui`
  // snapshot (no repository read). A failure here must not break `spec.md`; it degrades to a
  // diagnostic and leaves the primary artifact valid.
  let ctxNote = "";
  try {
    const pilar = await loadPilar();
    const projectContext = readProjectContext(process.cwd());
    const { manifest, markdown, metrics } = buildAgentContext({
      transcript,
      conventions,
      projectContext,
      pilar,
      design: stem,
    });
    writeFileSync(join(outDir, "context-manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
    writeFileSync(join(outDir, "agent-context.md"), markdown);
    ctxNote = `\nAgent context\n` +
      `  characters             : ${metrics.characters}\n` +
      `  estimated tokens       : ${metrics.estimatedTokens}\n` +
      `  capabilities selected  : ${metrics.capabilityCount}\n` +
      `  style recipes selected : ${metrics.styleRecipeCount}\n` +
      `  unused capabilities    : ${metrics.unusedCapabilityCount}\n` +
      `  raw source examples    : ${metrics.rawSourceExampleCount}\n` +
      `  budget exceeded        : ${metrics.budgetExceeded ? "yes" : "no"}`;
  } catch (err) {
    ctxNote = `\n⚠ agent context not written: ${err?.message ?? err}`;
  }

  console.log(`SliceUI spec → ${out}`);
  console.log(`  ${(spec.match(/\n/g) ?? []).length + 1} lines — one pass to render, no cross-referencing.`);
  console.log(ctxNote);
  return 0;
}

function readConventions(cwdDir) {
  const p = join(cwdDir, ".sliceui", "conventions.json");
  if (existsSync(p)) { try { return JSON.parse(readFileSync(p, "utf8")); } catch {} }
  return {};
}

function readProjectContext(cwdDir) {
  const p = join(cwdDir, ".sliceui", "project-context.json");
  if (existsSync(p)) { try { return JSON.parse(readFileSync(p, "utf8")); } catch {} }
  return {};
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main(process.argv.slice(2)).then((code) => process.exit(code ?? 0));
}
