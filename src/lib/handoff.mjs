// handoff — the canonical project-facing contract for the coding agent.
//
// Phase 1 of the remediation: `.sliceui/handoff.md` becomes the ONE file the agent reads to
// learn WHAT this project is + HOW it writes, replacing the multi-artifact read path
// (project-context.json + conventions.json + context/*.md) on the happy path.
//
// "Rich internally, minimal externally": the handoff references real source paths instead of
// mirroring code, and it does NOT dump the full class vocabulary or `::ng-deep` corpus — those
// stay in conventions.md (the authoritative copy source) and are referenced, never inlined.
//
// Pure + side-effect-free: takes `splitProjectContext(projectContext)` + `conventions`, returns
// a markdown string. No filesystem access, no repository scan.

import { frameworkConstraints } from "./agent-context.mjs";

/** Cap design tokens at a bounded list — a handoff is a contract, not an archive. */
const MAX_TOKENS = 20;

/** Compact `scss`/`cssProps`/`mixins` → `{name, value}` list, capped. */
function renderTokens(tokens = {}) {
  const out = [];
  for (const t of tokens.scss ?? []) out.push({ name: t.name, value: t.value });
  for (const t of tokens.cssProps ?? []) out.push({ name: t.name, value: t.value });
  for (const m of tokens.mixins ?? []) out.push({ name: m.name ?? m, value: "mixin" });
  return out.slice(0, MAX_TOKENS);
}

/**
 * Render the compact project handoff.
 * @param {object} projectContext — `splitProjectContext(detectProject())`.projectContext
 * @param {string|null} generatedAt — ISO timestamp or null
 * @returns {string} markdown
 *
 * Note: `conventions` is intentionally NOT an input. The handoff is the ROUTER — it references
 * `.sliceui/conventions.md` for the reusable-class/corpus facts rather than inlining them, so
 * the agent reads the corpus only when a design actually needs it.
 */
export function renderHandoffMd(projectContext = {}, generatedAt = null) {
  const fw = projectContext.framework ?? {};
  const L = [];

  L.push("# SliceUI Project Handoff");
  L.push("");

  // --- framework ---
  L.push("## Framework");
  L.push("");
  L.push(`${fw.label ?? fw.id ?? "Unknown"}${fw.version ? ` ${fw.version}` : ""}`);
  if (projectContext.moduleOrStandalone === "module") L.push("NgModule architecture");
  else if (projectContext.moduleOrStandalone === "standalone-capable") L.push("standalone-capable");
  if (projectContext.styleExt) L.push(projectContext.styleExt === "scss" ? "SCSS" : projectContext.styleExt);
  L.push("");

  // --- component convention (only facts we actually know; Angular-only fields stay gated) ---
  const isAngular = fw.id === "angular";
  L.push("## Component convention");
  L.push("");
  if (projectContext.componentDir) L.push(`- componentDir: \`${projectContext.componentDir}\` — the write target`);
  if (isAngular && projectContext.styleExt) L.push(`- split TS / HTML / ${projectContext.styleExt.toUpperCase()}`);
  if (projectContext.prefix) L.push(`- selector prefix: \`${projectContext.prefix}\``);
  L.push("");

  // --- UI capabilities (resolved only; a null capability is a design-scoped concern, not a
  //     project fact — the handoff never lists the 13 categories with "none") ---
  const caps = Object.entries(projectContext.capabilities ?? {}).filter(([, c]) => c?.library);
  L.push("## UI capabilities");
  L.push("");
  if (!caps.length) {
    L.push("_(none detected — use native HTML and flag it in the output)_");
    L.push("");
  }
  for (const [cat, c] of caps) {
    L.push(`### ${cat}`);
    L.push(`Implementation: ${c.library}`);
    const ref = c.samplePath ?? c.libSourcePath ?? c.sampleScssPath;
    if (ref) L.push(`Reference: \`${ref}\``);
    L.push("");
  }

  // --- styling (tokens bounded; corpus referenced, never inlined) ---
  L.push("## Styling");
  L.push("");
  const tokens = renderTokens(projectContext.designTokens);
  if (tokens.length) {
    L.push("Design tokens (bounded):");
    L.push("");
    for (const t of tokens) L.push(`- \`${t.name}\`: ${t.value}`);
    L.push("");
  } else {
    L.push("Design tokens: _(none detected — use the design's exact values)_");
    L.push("");
  }
  // The corpus pointer is Angular-shaped; a `::ng-deep` reference in a non-Angular handoff is a
  // framework-foreign idiom (the exact leak the /sliceui-handoff skill forbids). Non-Angular
  // convention mining is not built, so there is no corpus to point at — omit honestly.
  if (isAngular) {
    L.push("- Reusable classes + `::ng-deep` corpus: read `.sliceui/conventions.md` (copy verbatim only the blocks in play for the design).");
    L.push("");
  }

  // --- framework constraints (canonical source, never re-worded here) ---
  const constraints = frameworkConstraints(projectContext);
  L.push("## Framework constraints");
  L.push("");
  if (constraints.length) {
    for (const c of constraints) L.push(`- ${c.text}`);
  } else if (isAngular) {
    L.push("_(none)_");
  } else {
    L.push(`- ${fw.label ?? fw.id} syntax only — deep convention mining is Angular-first; read a real component for local idiom.`);
  }
  L.push("");

  // --- project references (pointers only, golden marked READ FIRST) ---
  const refs = (projectContext.sampleComponents ?? []).map((s) => ({
    path: s.path,
    golden: !!s.golden,
    selector: s.selector,
  }));
  L.push("## Project references");
  L.push("");
  if (!refs.length) L.push("_(none — no sample or golden components detected)_");
  for (const r of refs) {
    L.push(`- \`${r.path}\`${r.golden ? " — **GOLDEN reference; read FIRST**" : ""}${r.selector ? ` (selector \`${r.selector}\`)` : ""}`);
  }
  L.push("");

  if (generatedAt) L.push(`_Generated ${generatedAt} by \`sliceui init\`._`);
  return L.join("\n");
}
