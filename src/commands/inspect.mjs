// sliceui inspect — the ONE agent-facing design-context command.
//
// Replaces the transcribe → resolve → spec → referee → agent-context read-path with a single
// compact, validated view of the design. Reuses the existing input pipeline (transcribe for
// xml/image, parseFigml for XML) + resolve (dangerous ambiguity → mappings) + agent-context
// (design inventory → required capabilities), then emits a bounded markdown summary instead of
// dumping the full spec/transcript.
//
// Internally it persists the transcript + spec (the "compute richly, expose minimally" cache the
// downstream `check` gate reads as ground truth), but the DEFAULT output is the compact summary.
// `--json` gives a machine-readable projection.

import { readFileSync, existsSync } from "node:fs";
import { join, basename } from "node:path";
import { transcribe, persistTranscript } from "./transcribe.mjs";
import { resolveDesign, paginationEvidence } from "../lib/design-resolution.mjs";
import { buildSpec } from "./spec.mjs";
import {
  buildDesignInventory, ROLE_TO_CAPABILITY, hasIconChild, buildAgentContext,
  selectCapabilities, selectDangerousDefaults, frameworkConstraints,
} from "../lib/agent-context.mjs";
import { loadPilar } from "../lib/pilar-loader.mjs";
import { confidenceLevel } from "../lib/resolution-policy.mjs";
import { ingestDesign } from "../design/ingest.mjs";

/** Role → human label for the compact structure tree. Deterministic, no design heuristics beyond
 *  the facts the transcript already carries (table flag, heading font-size, select = input+icon). */
function roleLabel(n) {
  if (n.table) return "Table";
  if (n.type === "text") {
    const size = n.style?.size ?? 0;
    if (/menampilkan|showing\b/i.test(n.text ?? "") && /data/i.test(n.text ?? "")) return `Pagination "${n.text}"`;
    return size >= 18 ? `Heading "${n.text}"` : `Text "${n.text}"`;
  }
  if (n.type === "button") return `Button "${n.text ?? ""}"`;
  if (n.type === "input") return `${hasIconChild(n) ? "Select" : "Input"} "${n.text ?? n.label ?? ""}"`;
  if (n.type === "icon") return `Icon${n.description ? ` (${n.description})` : ""}`;
  if (n.type === "divider") return "Divider";
  if (n.type === "checkbox") return "Checkbox";
  if (n.type === "image") return "Image";
  const cap = (n.type?.[0] ?? "").toUpperCase() + (n.type ?? "").slice(1);
  return `${cap || "Node"}${n.text ? ` "${n.text}"` : ""}`;
}

/** The style/geometry facts worth surfacing for one node (the "critical" visual values). */
function visualFacts(n) {
  const facts = [];
  const s = n.style ?? {};
  if (s.size) facts.push(`font-size: ${s.size}px`);
  if (s.weight && s.weight !== 400) facts.push(`font-weight: ${s.weight}`);
  if (s.color) facts.push(`color: ${s.color}`);
  if (s.lineHeight) facts.push(`line-height: ${s.lineHeight}`);
  if (n.bg) facts.push(`background: ${n.bg}`);
  if (n.axis === "row") facts.push("display: flex; flex-direction: row");
  else if (n.axis === "column") facts.push("display: flex; flex-direction: column");
  if (n.gap) facts.push(`gap: ${n.gap}px`);
  if (n.padding) {
    // Focused remediation F: a FILL-width node with centered content has its horizontal padding
    // as RESULTING design geometry (the text is centered inside the layout-given width), not an
    // additional CSS `padding-left/right` to stack on top of the fill width. Surface it as
    // geometry-sensitive rather than an unconditional authored padding.
    const hGeometry = n.sizingH === "FILL" && (n.alignPrimary === "CENTER" || n.alignCounter === "CENTER");
    facts.push(hGeometry
      ? `padding (geometry-sensitive): ${n.padding.top}/${n.padding.right}/${n.padding.bottom}/${n.padding.left} — fill-width + centered, horizontal padding is design geometry, not unconditional CSS`
      : `padding: ${n.padding.top}/${n.padding.right}/${n.padding.bottom}/${n.padding.left}`);
  }
  if (n.radius) facts.push(`border-radius: ${n.radius}px`);
  if (n.cornerRadius) facts.push(`border-radius: ${n.cornerRadius.tl}/${n.cornerRadius.tr}/${n.cornerRadius.br}/${n.cornerRadius.bl}`);
  if (n.border) facts.push(n.border.width ? `border: ${n.border.width}px solid ${n.border.color}` : `border: 1px solid ${n.border.color}`);
  if (n.justify) facts.push(`justify-content: ${n.justify}`);
  return facts;
}

/** Design category names the design actually needs, derived from the role inventory. */
function requiredCapabilities(inventory) {
  const cats = new Set();
  for (const r of inventory) {
    const cat = ROLE_TO_CAPABILITY[r.role];
    if (cat) cats.add(cat);
  }
  return [...cats].sort();
}

function fidelityLabel(meta = {}) {
  if (meta.source === "figml") return "exact";
  if (meta.textQuality === "exact") return "exact";
  if (meta.textQuality === "unreadable") return "degraded (unreadable text)";
  if (meta.textQuality === "ocr") return "approximate (OCR)";
  if (meta.textQuality === "vision" || meta.textQuality === "vision+ocr") return "vision";
  return meta.textQuality ?? "unknown";
}

function sourceLabel(meta = {}) {
  switch (meta.source) {
    case "figml": return `FIGML (tier ${meta.tier ?? 0})`;
    case "gemini-vision": return `Gemini vision (tier ${meta.tier ?? 1})`;
    case "static": return `static extraction (tier ${meta.tier ?? 2})`;
    default: return meta.source ?? "unknown";
  }
}

/** Walk the semantic tree. Hidden design layers are skipped (debug evidence, not implementation).
 *  A table is rendered COMPACTLY (headers + representative row + row count) rather than as an
 *  opaque leaf or a full dump of every cell — the agent gets the unique visible evidence it needs
 *  without `spec.md` (final remediation §3). */
function walkStructure(nodes, depth, out) {
  for (const n of nodes ?? []) {
    if (!n || typeof n !== "object") continue;
    if (n.hidden) continue;
    if (n.table) {
      renderTableStructure(n, depth, out);
      continue;
    }
    out.push({ depth, label: roleLabel(n) });
    if (n.children?.length) walkStructure(n.children, depth + 1, out);
  }
}

/** Compact table view: the header row's columns, a representative data row, and the row count. */
function renderTableStructure(table, depth, out) {
  out.push({ depth, label: "Table" });
  const kids = (table.children ?? []).filter((c) => c && !c.hidden);
  const groups = kids.filter((c) => c.type === "group");
  const header = groups[0];
  const dataRows = groups.slice(1);
  if (header) {
    const headers = rowCells(header);
    if (headers.length) out.push({ depth: depth + 1, label: `columns: ${headers.join(" | ")}` });
  }
  if (dataRows.length) {
    out.push({ depth: depth + 1, label: `rows (${dataRows.length}): ${rowCells(dataRows[0]).join(" | ")}` });
  }
}

/** The visible cells of a row/group: text cells verbatim, status badges by their status text,
 *  icons by glyph/description. Deterministic and bounded — never a full subtree dump. */
function rowCells(row) {
  const cells = [];
  for (const c of row.children ?? []) {
    if (!c || c.hidden) continue;
    if (c.type === "text" && (c.text ?? "").trim()) cells.push(c.text.trim());
    else if (c.type === "icon") cells.push(`icon(${c.glyphName ?? c.description ?? "?"})`);
    else if (c.type === "group") {
      const txt = firstText(c);
      cells.push(txt ? `[${txt}]` : "…");
    } else if (c.type === "checkbox") cells.push("checkbox");
  }
  return cells.slice(0, 12);
}

function firstText(node) {
  for (const c of node.children ?? []) {
    if (c?.type === "text" && (c.text ?? "").trim()) return c.text.trim();
    const deep = firstText(c);
    if (deep) return deep;
  }
  return null;
}

/** Bounded critical visual facts, in document order, skipping hidden nodes and the table subtree
 *  (its per-cell facts are repetitive; the table's own box facts are still captured). */
function collectFacts(nodes, out = [], cap = 40) {
  for (const n of nodes ?? []) {
    if (!n || typeof n !== "object") continue;
    if (n.hidden) continue;
    if (out.length >= cap) return out;
    const facts = visualFacts(n);
    if (facts.length) out.push({ label: roleLabel(n), facts });
    if (n.table) continue;
    if (n.children?.length) collectFacts(n.children, out, cap);
  }
  return out;
}

/** Render the resolved mappings (dangerous-ambiguity only — resolve never maps basic visual facts). */
function mappingEntries(groups = [], cap = 20) {
  return groups.slice(0, cap).map((g) => {
    const value = (g.resolved ?? []).length
      ? g.resolved.map((x) => x.value).join(" + ")
      : (g.candidates?.length ? `CANDIDATES: ${g.candidates.join(" / ")}` : (g.fallback ? `FALLBACK: ${g.fallback.kind}` : "(unresolved)"));
    return {
      kind: g.kind,
      value,
      authority: g.authority ?? "hint",
      confidence: confidenceLevel(g.confidence ?? 0),
    };
  });
}

// ---------- design-intent sections (Prompt A) ----------
// These surface the compiled Design Intent Graph — topology, relative layout constraints, exact
// visible content, runtime state, and uncertainty — facts the legacy transcript path cannot hold.
// All pure (no fs); rendered only when an intentGraph is supplied (FIGML inputs).

function nodeName(nodesById, id) {
  const n = nodesById.get(id);
  return n ? (n.sourceName ?? n.role ?? n.sourceType) : id;
}

function topologySummary(intentGraph) {
  const fams = {};
  for (const r of intentGraph.regions ?? []) fams[r.family] = (fams[r.family] ?? 0) + 1;
  const histogram = Object.entries(fams).sort((a, b) => b[1] - a[1]).map(([f, n]) => `${f} ×${n}`);
  const nodesById = new Map((intentGraph.nodes ?? []).map((n) => [n.id, n]));
  const notable = (intentGraph.regions ?? [])
    .filter((r) => ["REPEATED", "GRID", "OVERLAY"].includes(r.family))
    .slice(0, 12)
    .map((r) => {
      const name = nodeName(nodesById, r.rootNodeId);
      const repeats = intentGraph.constraints?.find((c) => c.regionId === r.id && c.type === "REPEATS_TEMPLATE");
      const grid = intentGraph.constraints?.find((c) => c.regionId === r.id && c.type === "GRID_TRACKS");
      const detail = r.family === "REPEATED" && repeats
        ? ` — ${repeats.nodeIds?.length ?? 0} stacked rows`
        : r.family === "GRID" && grid?.value
          ? ` — ${grid.value.columns}×${grid.value.rows} grid`
          : "";
      return `${r.family}: ${name}${detail}`;
    });
  return { histogram, notable };
}

function layoutConstraintSummary(intentGraph) {
  const out = [];
  for (const c of intentGraph.constraints ?? []) {
    if (c.type === "SIBLING_RATIO") out.push({ type: "sibling-ratio", node: c.parentId, value: c.value });
    else if (c.type === "ITEM_DISTANCE") for (const d of c.items ?? []) out.push({ type: "spacing", from: d.fromNodeId, to: d.toNodeId, expected: d.expected });
    else if (c.type === "GRID_TRACKS") out.push({ type: "grid", value: c.value });
    else if (c.type === "ANCHOR") out.push({ type: "anchor", node: c.nodeId, value: c.value });
  }
  return out.slice(0, 24);
}

function exactContentSummary(intentGraph) {
  const tables = (intentGraph.tables ?? []).map((t) => ({
    headers: t.headers.map((h) => h.value),
    rowCount: t.designedVisibleRows.length,
    representative: t.designedVisibleRows[0]?.cells.map((c) => c.value) ?? [],
  }));
  return { textCount: (intentGraph.content ?? []).length, tables };
}

function runtimeStateSummary(intentGraph) {
  return intentGraph.states ?? [];
}

function uncertaintySummary(intentGraph) {
  const facts = [];
  for (const c of intentGraph.constraints ?? []) {
    if (c.confidence != null && c.confidence < 0.5) {
      facts.push({ type: c.type, confidence: c.confidence, verificationRequired: c.verificationRequired ?? false });
    }
  }
  return facts.slice(0, 12);
}

/**
 * Build the compact inspect view (markdown + machine-readable projection) from a transcript.
 * Pure — no fs, no repository scan.
 */
export function buildInspect(transcript, { conventions = {}, projectContext = {}, pilar = null, intentGraph = null } = {}) {
  const design = resolveDesignSafe(transcript, conventions, pilar);
  const inventory = buildDesignInventory(transcript?.layout ?? [], design.groups);
  const capabilities = requiredCapabilities(inventory);
  const name = basename(transcript?.meta?.image ?? "design").replace(/\.[^.]+$/, "");
  const meta = transcript?.meta ?? {};
  const structure = [];
  walkStructure(transcript?.layout ?? [], 0, structure);
  const facts = collectFacts(transcript?.layout ?? []);
  const mappings = mappingEntries(design.groups);
  const recipes = (design.recipes ?? []).map((r) => ({ selector: r.selector, family: r.family, state: r.state, block: r.block ?? "" }));
  const conflicts = design.conflicts ?? [];
  // Behavioral facts / dangerous defaults — only for the capabilities in play (Workstream E).
  const capabilitiesFull = selectCapabilities(inventory, projectContext?.capabilities ?? {}, pilar);
  const dangerousDefaults = selectDangerousDefaults(inventory, capabilitiesFull, pilar, frameworkConstraints(projectContext));
  // Compile the design's pagination footer into the runtime state it implies (render-reality B):
  // the agent must generate mock state that actually renders the designed pagination.
  const pagination = paginationEvidence(transcript);
  if (pagination) {
    dangerousDefaults.push({
      text: `Pagination is visible in the design ("${pagination.text}") — the mock/runtime state must render it: total ${pagination.total} at page size ${pagination.pageSize} (a state beyond a single page).`,
      source: "design pagination evidence",
    });
  }

  const json = {
    design: name,
    fidelity: fidelityLabel(meta),
    source: meta.source ?? "unknown",
    tier: meta.tier ?? null,
    structure,
    capabilities,
    visualFacts: facts,
    mappings,
    recipes,
    conflicts,
    dangerousDefaults: dangerousDefaults.map((d) => ({ text: d.text, source: d.source })),
    features: design.features ?? {},
    intent: intentGraph
      ? {
          topology: topologySummary(intentGraph),
          layoutConstraints: layoutConstraintSummary(intentGraph),
          exactContent: exactContentSummary(intentGraph),
          runtimeState: runtimeStateSummary(intentGraph),
          uncertainty: uncertaintySummary(intentGraph),
        }
      : null,
  };

  const markdown = renderInspectMarkdown(json);
  return { markdown, json };
}

function resolveDesignSafe(transcript, conventions, pilar) {
  try {
    return resolveDesign(transcript, conventions, pilar);
  } catch {
    return { features: {}, groups: [], behaviorBindings: [], recipes: [], conflicts: [] };
  }
}

/** Render the five design-intent sections (only when `j.intent` is present — FIGML inputs). */
function renderIntentSections(j, L) {
  const intent = j.intent;
  if (!intent) return;

  L.push("## Topology");
  L.push("");
  if (intent.topology?.histogram?.length) L.push(`- ${intent.topology.histogram.join(", ")}`);
  for (const n of intent.topology?.notable ?? []) L.push(`- ${n}`);
  L.push("");

  L.push("## Layout constraints");
  L.push("");
  if (!(intent.layoutConstraints ?? []).length) L.push("_(none)_");
  for (const c of intent.layoutConstraints ?? []) {
    if (c.type === "sibling-ratio") L.push(`- sibling ratio ${JSON.stringify(c.value)} (parent ${c.node})`);
    else if (c.type === "spacing") L.push(`- spacing ${c.expected}px between ${c.from} → ${c.to}`);
    else if (c.type === "grid") L.push(`- grid ${c.value.columns}×${c.value.rows}`);
    else if (c.type === "anchor") L.push(`- anchor ${JSON.stringify(c.value)} (node ${c.node})`);
  }
  L.push("");

  L.push("## Exact visible content");
  L.push("");
  L.push(`- ${intent.exactContent?.textCount ?? 0} visible text/icon nodes (A1 design, exact)`);
  for (const t of intent.exactContent?.tables ?? []) {
    L.push(`- table columns: ${t.headers.join(" | ")}`);
    L.push(`- ${t.rowCount} designed-visible rows; representative: ${t.representative.join(" | ")}`);
  }
  L.push("");

  L.push("## Runtime state");
  L.push("");
  if (!(intent.runtimeState ?? []).length) L.push("_(none — no pagination/state evidence)_");
  for (const s of intent.runtimeState ?? []) {
    L.push(`- pagination: visible ${s.visibleStart}-${s.visibleEnd} of ${s.total} (page size ${s.pageSize})`);
  }
  L.push("");

  L.push("## Uncertainty");
  L.push("");
  if (!(intent.uncertainty ?? []).length) L.push("_(none — all constraints high confidence)_");
  for (const u of intent.uncertainty ?? []) {
    L.push(`- ${u.type} confidence ${u.confidence}${u.verificationRequired ? " (render verification required)" : ""}`);
  }
  L.push("");
}

function renderInspectMarkdown(j) {
  const L = [];
  L.push(`# Inspect — ${j.design}`);
  L.push("");
  L.push(`- Design: ${j.design}`);
  L.push(`- Fidelity: ${j.fidelity}`);
  L.push(`- Source: ${j.source}${j.tier != null ? ` (tier ${j.tier})` : ""}`);
  L.push("");

  L.push("## Structure");
  L.push("");
  L.push("```");
  for (const s of j.structure) L.push(`${"  ".repeat(s.depth)}${s.label}`);
  L.push("```");
  L.push("");

  L.push("## Required capabilities");
  L.push("");
  if (!j.capabilities.length) L.push("_(none — plain elements only)_");
  for (const c of j.capabilities) L.push(`- ${c}`);
  L.push("");

  L.push("## Critical visual facts");
  L.push("");
  if (!j.visualFacts.length) L.push("_(none — no explicit style/geometry facts)_");
  for (const f of j.visualFacts) {
    L.push(`${f.label}`);
    for (const fact of f.facts) L.push(`- ${fact}`);
    L.push("");
  }

  L.push("## Mappings (project → resolved idiom)");
  L.push("");
  if (!j.mappings.length) L.push("_(none — no styled leaves requiring resolution)_");
  for (const m of j.mappings) {
    L.push(`- \`${m.kind}\` → ${m.value}  _(authority ${m.authority}, ${m.confidence})_`);
  }
  L.push("");

  L.push("## Recipes (project → design, by state)");
  L.push("");
  if (!j.recipes.length) L.push("_(none selected for this design)_");
  for (const r of j.recipes) {
    L.push(`- [${r.state}] \`${r.selector}\`${r.family ? ` (${r.family})` : ""}`);
    if (r.state === "required" && (r.block ?? "").trim()) {
      L.push("```scss");
      L.push(r.block.trim());
      L.push("```");
    }
  }
  L.push("");

  L.push("## Conflicts (design vs project — design wins)");
  L.push("");
  if (!j.conflicts.length) L.push("_(none)_");
  for (const c of j.conflicts) {
    L.push(`- ${c.property} (${c.family}) — design ${c.design}px vs \`${c.selector}\` ${c.recipe}px → ${c.resolution}`);
  }
  L.push("");

  L.push("## Dangerous defaults (behavioral facts)");
  L.push("");
  if (!(j.dangerousDefaults ?? []).length) L.push("_(none)_");
  for (const d of j.dangerousDefaults ?? []) {
    L.push(`- ${d.text} _(source: ${d.source})_`);
  }
  L.push("");

  renderIntentSections(j, L);

  L.push("## Next");
  L.push("");
  L.push("- Read `.sliceui/handoff.md` (project contract) first.");
  L.push("- Implement from this output + the targeted project source references your capabilities name.");
  L.push("- Run `sliceui check <targetDir> <design>` and fix evidence-backed failures.");
  return L.join("\n");
}

export async function main(argv) {
  const json = argv.includes("--json");
  const forceStatic = argv.includes("--static");
  const args = argv.filter((a) => a !== "--json" && a !== "--static");
  const input = args[0];
  if (!input) {
    console.error("usage: sliceui inspect <xml|figml|image|transcript.json> [--json] [--static]");
    return 2;
  }
  const abs = input.startsWith("/") ? input : join(process.cwd(), input);

  // --- input → transcript (reuse transcribe: XML is instant + exact, image tiers down) ---
  let transcript;
  let intentGraph = null;
  if (/\.(xml|figml)$/i.test(abs)) {
    const result = await transcribe(abs, process.cwd(), { forceStatic });
    if (!result.ok) { console.error(`inspect: ${result.reason}${result.message ? ` — ${result.message}` : ""}`); return 3; }
    transcript = result.transcript;
    persistTranscript(result, abs, process.cwd());
    // Compile the lossless Design Intent Graph (topology + constraints + exact content) alongside
    // the legacy transcript, so the summary can surface design-intent facts. Non-fatal on failure.
    try {
      const ingested = ingestDesign(readFileSync(abs, "utf8"), basename(abs));
      if (ingested.ok) intentGraph = ingested.intentGraph;
    } catch { /* intent graph is additive; a failure must not fail inspect */ }
  } else if (/\.json$/i.test(abs)) {
    transcript = JSON.parse(readFileSync(abs, "utf8"));
  } else {
    const result = await transcribe(abs, process.cwd(), { forceStatic });
    if (!result.ok) { console.error(JSON.stringify(result, null, 2)); return 3; }
    transcript = result.transcript;
    persistTranscript(result, abs, process.cwd());
  }

  const conventions = readJson(join(process.cwd(), ".sliceui", "conventions.json"));
  const projectContext = readJson(join(process.cwd(), ".sliceui", "project-context.json"));
  const pilar = await loadPilar().catch(() => null);

  // Persist the full render doc + design-scoped context (the internal cache `check`/the agent
  // read for full detail) — reuse spec's builders, never a re-scan.
  try {
    const name = basename(transcript?.meta?.image ?? basename(abs)).replace(/\.[^.]+$/, "");
    const { mkdirSync, writeFileSync } = await import("node:fs");
    const outDir = join(process.cwd(), ".sliceui", "artifacts", name);
    mkdirSync(outDir, { recursive: true });
    writeFileSync(join(outDir, "spec.md"), buildSpec(transcript, conventions, pilar));
    const { manifest, markdown } = buildAgentContext({ transcript, conventions, projectContext, pilar, design: name });
    writeFileSync(join(outDir, "context-manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
    writeFileSync(join(outDir, "agent-context.md"), markdown);
  } catch { /* spec/context are additive cache — a failure must not fail inspect's summary */ }

  const { markdown, json: projection } = buildInspect(transcript, { conventions, projectContext, pilar, intentGraph });
  process.stdout.write(json ? JSON.stringify(projection, null, 2) + "\n" : markdown);
  return 0;
}

function readJson(p) {
  if (!existsSync(p)) return {};
  try { return JSON.parse(readFileSync(p, "utf8")); } catch { return {}; }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main(process.argv.slice(2)).then((code) => process.exit(code ?? 0));
}
