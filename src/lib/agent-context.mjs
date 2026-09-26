// agent-context — design-scoped agent context builder.
//
// PR 1 (Agent Context Reduction). Produces the two per-design artifacts the generator reads
// instead of the full machine snapshot:
//   .sliceui/artifacts/<design>/context-manifest.json  — machine-readable manifest
//   .sliceui/artifacts/<design>/agent-context.md        — the agent-facing projection
//
// Pure and side-effect-free: every function takes already-loaded inputs (transcript,
// conventions, project-context, pilar) and returns data. No filesystem access, no repository
// scan — the context is built ENTIRELY from design artifacts + the `.sliceui` snapshot (audit
// principle: "context builder hanya boleh menggunakan design artifacts dan snapshot .sliceui").
//
// Source-of-truth policy (authority lives in the machine sources, never here):
//   transcript.json    = authoritative design facts
//   resolved.json      = derived implementation candidates
//   spec.md            = primary generation document
//   conventions.json   = machine-only conventions + verify ground truth
//   pilar-catalog.mjs  = authoritative pilar public API
//   context-manifest   = design-scoped projection of the above (this file builds it)

import { resolveTranscript } from "./resolve.mjs";
import { confidenceLevel } from "./resolution-policy.mjs";

export const CONTEXT_SCHEMA_VERSION = 2;
export const DEFAULT_CONTEXT_BUDGET = { maxCharacters: 30_000, maxEstimatedTokens: 7_500 };

// Roles a transcript node type maps to a capability CATEGORY (project-context.capabilities key).
// Roles without a category (button, text-input, status-label, icon) are inventory facts but
// select no capability.
const ROLE_TO_CAPABILITY = {
  select: "select",
  table: "table",
  checkbox: "checkbox",
  divider: "divider",
  pagination: "pagination",
};

/** "pilar (uii-table)" → "uii-table"; null for non-pilar library labels. */
function pilarSelector(library) {
  const m = /^pilar\s*\(\s*([^)]+)\s*\)$/i.exec(String(library ?? ""));
  return m ? m[1] : null;
}

// ---------- design inventory ----------

/** True when a node nests an `icon` child (a caret glyph marks a select/dropdown; a plain
 *  text input has no icon child — the search box's glyph is a text node, not an icon). */
function hasIconChild(node) {
  for (const c of node.children ?? []) {
    if (c?.type === "icon") return true;
    if (c && hasIconChild(c)) return true;
  }
  return false;
}

/**
 * Derive the design's role inventory from the transcript layout + resolved groups.
 * Deterministic; reads no repository; unknown roles are never guessed.
 * @param {Array} layout — transcript layout nodes
 * @param {Array} [resolvedGroups] — resolveTranscript() groups (kind: status/icon/button)
 * @returns {Array<{role, count, evidence: string[]}>} sorted by role
 */
export function buildDesignInventory(layout, resolvedGroups = []) {
  const roles = new Map();
  const add = (role, id) => {
    const e = roles.get(role) ?? { role, count: 0, evidence: [] };
    e.count += 1;
    if (id) e.evidence.push(id);
    roles.set(role, e);
  };

  const walk = (nodes) => {
    for (const n of nodes ?? []) {
      if (!n || typeof n !== "object") continue;
      if (n.type === "button") add("button", n.id);
      if (n.type === "input") add(hasIconChild(n) ? "select" : "text-input", n.id);
      if (n.type === "checkbox") add("checkbox", n.id);
      if (n.type === "divider") add("divider", n.id);
      if (n.table) add("table", n.id);
      // A pagination footer ("Menampilkan 1-10 dari N data") is the design fact for paging.
      if (n.type === "text" && /menampilkan|showing\b/i.test(n.text ?? "") && /data/i.test(n.text ?? "")) {
        add("pagination", n.id);
      }
      walk(n.children);
    }
  };
  walk(layout);

  // Resolved groups carry the semantic signals the raw node types don't (a status badge is a
  // group + icon + text; resolve already identified it).
  for (const g of resolvedGroups ?? []) {
    if (g?.kind === "status") add("status-label", g.id);
  }

  return [...roles.values()].sort((a, b) => a.role.localeCompare(b.role));
}

// ---------- capability selection ----------

/** Slice-legal input set for a pilar component's category, or null when no policy exists. */
function legalInputsFor(category, pilar) {
  if (category === "table" && pilar?.legalTableInputs) return pilar.legalTableInputs;
  return null; // other categories surface the full catalog inputs (small, benign)
}

function legalOutputsFor(category, pilar) {
  if (category === "table" && pilar?.legalTableOutputs) return pilar.legalTableOutputs;
  return null;
}

function forbiddenInputsFor(category, pilar) {
  return category === "table" ? pilar?.forbiddenTableInputs ?? new Set() : new Set();
}

function forbiddenOutputsFor(category, pilar) {
  return category === "table" ? pilar?.forbiddenTableOutputs ?? new Set() : new Set();
}

/**
 * Select capabilities for the design's roles. Only roles with a matching snapshot category are
 * selected; a role with no category (button/text-input/status-label/icon) is omitted. Unknown
 * or un-resolvable capabilities are recorded as `unresolved` — never guessed.
 */
export function selectCapabilities(inventory, capabilities = {}, pilar = null) {
  const out = [];
  for (const role of inventory) {
    const category = ROLE_TO_CAPABILITY[role.role];
    if (!category) continue;
    const cap = capabilities[category];
    if (!cap || !cap.library) {
      out.push({ role: category, status: "unresolved", reason: "No verified project capability in snapshot" });
      continue;
    }
    out.push(buildCapabilityEntry(category, cap, role, pilar));
  }
  return out;
}

function buildCapabilityEntry(category, cap, role, pilar) {
  const entry = {
    role: category,
    library: cap.library,
    source: cap.source ?? "registry",
    evidence: role.evidence.slice(0, 8),
  };

  const selector = pilarSelector(cap.library);
  const component = selector && pilar?.pilarComponents ? pilar.pilarComponents.find((c) => c.selector === selector) : null;

  if (component) {
    const legalIn = legalInputsFor(category, pilar);
    const legalOut = legalOutputsFor(category, pilar);
    const forbIn = forbiddenInputsFor(category, pilar);
    const forbOut = forbiddenOutputsFor(category, pilar);

    // Exact, case-sensitive names from the catalog (e.g. paginationAlign vs paginationALign).
    entry.selector = component.selector;
    entry.inputs = component.inputs
      .filter((i) => !legalIn || legalIn.has(i.name))
      .map((i) => ({ name: i.name, type: i.type ?? null, default: i.default != null ? i.default : null }));
    entry.outputs = component.outputs
      .filter((o) => !legalOut || legalOut.has(o.name))
      .map((o) => o.name);
    entry.forbiddenInputs = component.inputs.map((i) => i.name).filter((n) => forbIn.has(n));
    entry.forbiddenOutputs = component.outputs.map((o) => o.name).filter((n) => forbOut.has(n));
    entry.defaults = (entry.inputs ?? []).filter((i) => i.default != null);
    // The registry sample is the minimal wiring reference (curated, never repo-scanned for UII).
    entry.wiringExample = cap.sampleHtml ?? null;
    entry.tsExample = cap.sampleTs ?? null;
  } else {
    // Non-pilar capability: no machine catalog. The curated registry sample is the wiring
    // reference; the API is not enumerated (would be guesswork).
    entry.selector = null;
    entry.wiringExample = cap.sampleHtml ?? null;
    entry.tsExample = cap.sampleTs ?? null;
  }

  return entry;
}

// ---------- dangerous defaults ----------

/**
 * Relevant dangerous defaults for the selected capabilities, from the machine sources
 * (catalog defaults + slice policy) plus framework constraints. Only defaults for capabilities
 * the design actually uses.
 * @param {Array} constraints — frameworkConstraints(projectContext) output
 */
export function selectDangerousDefaults(inventory, capabilities = [], pilar = null, constraints = []) {
  const defaults = [];
  const table = capabilities.find((c) => c.role === "table" && c.selector);

  if (table) {
    // Catalog defaults that change what the component renders unless bound explicitly.
    const bind = (name, msg) => {
      const d = table.inputs?.find((i) => i.name === name);
      if (d && d.default != null) defaults.push({ text: msg, source: "pilar-catalog default" });
    };
    bind("actionColumn", "`actionColumn` defaults to `true` — bind it explicitly (every row then needs `auth`).");
    bind("searchOptions", "`searchOptions` defaults to `true` — set `[searchOptions]=\"false\"` for a filter-area (page) search.");
    bind("paginationAlign", "`paginationAlign` defaults to `'center'` — bind `[paginationAlign]=\"'right'\"` for a right-aligned footer.");
    bind("limitOptions", "`limitOptions` defaults to `true`.");
    bind("paginationOptions", "`paginationOptions` defaults to `true`.");
    defaults.push({ text: "Use `[paginationAlign]` (lowercase) on `uii-table` but `[paginationALign]` (capital L) on a standalone `uii-pagination` — different inputs.", source: "pilar-catalog" });
    if (table.forbiddenInputs?.length) {
      defaults.push({ text: `Never emit server-mode/state inputs: [${table.forbiddenInputs.join("], [")}].`, source: "uii-slice-policy" });
    }
    if (table.forbiddenOutputs?.length) {
      defaults.push({ text: `Never emit server-mode outputs: (${table.forbiddenOutputs.join("), (")}).`, source: "uii-slice-policy" });
    }
  }

  const select = capabilities.find((c) => c.role === "select");
  if (select) {
    defaults.push({ text: "Every `<ngx-select>` must carry `[(ngModel)]` + `(select)` (matching TS state + handler) — a select without them is a dead filter.", source: "skill/SKILL.md" });
  }

  // Framework constraints are always relevant for the target framework.
  for (const c of constraints ?? []) defaults.push({ text: c.text, source: c.source });

  return defaults;
}

// ---------- framework constraints ----------

/** Framework + syntax constraints from the snapshot (never from a guess). */
export function frameworkInfo(projectContext = {}) {
  const fw = projectContext.framework ?? {};
  const name = fw.id ?? "angular";
  const version = fw.version ?? projectContext.deps?.["@angular/core"] ?? null;
  const standalone = projectContext.moduleOrStandalone === "standalone-capable";
  const templateSyntax = name === "angular" ? (standalone ? "standalone" : "structural-directives") : "n/a";
  return { name, version, standalone, templateSyntax };
}

/** Angular syntax constraints, keyed to the detected module/standalone model. */
export function frameworkConstraints(projectContext = {}) {
  const info = frameworkInfo(projectContext);
  if (info.name !== "angular") return [];
  const c = [];
  if (!info.standalone) {
    c.push({ text: "NgModule component model — register the component in the owning NgModule `declarations`.", source: "project-context.moduleOrStandalone" });
  }
  c.push({ text: "Use `*ngIf` / `*ngFor` only — NOT `@if`/`@for` (v17+), NOT `inject()` (v14+), NOT standalone (v14+).", source: "skill/SKILL.md Framework Rules" });
  c.push({ text: "Constructor dependency injection: `constructor(private svc: FooService) {}`.", source: "skill/SKILL.md Framework Rules" });
  c.push({ text: "SCSS with `:host`; reuse the project's tokens / CSS custom props.", source: "skill/SKILL.md Framework Rules" });
  return c;
}

// ---------- implementation hints (PR 4) ----------

/**
 * Select the resolved mappings worth the agent's attention — BOUNDED and authority-labelled.
 * The full typed groups live in resolved.json (diagnostic); this projection carries only:
 *   - behavior bindings (public API beats behavioral CSS — always material), and
 *   - status/idiom hints at exactly the two attention grades: non-high confidence (the agent
 *     must treat them as suggestions, not facts) and anything fallback/unresolved (conservative
 *     handling required). High-confidence idioms are already inline in spec.md — repeating them
 *     here would duplicate, not inform. Never candidates lists or provenance arrays.
 * @param {Array} groups — resolveTranscript().groups
 * @param {Array} behaviorBindings — resolveTranscript().behaviorBindings
 * @returns {Array} bounded hint entries
 */
export function selectImplementationHints(groups = [], behaviorBindings = []) {
  const out = [];
  for (const b of behaviorBindings) {
    out.push({
      kind: "behavior-binding",
      property: b.property,
      value: b.value,
      expression: b.implementation?.expression ?? null,
      authority: b.authority,
      confidence: confidenceLevel(b.confidence ?? 0),
      note: `public API supersedes behavioral CSS — ${b.rejected?.[0]?.value ?? "css override"} rejected`,
    });
  }
  for (const g of groups) {
    const level = confidenceLevel(g.confidence ?? 0);
    const needsAttention = level !== "high" || g.fallbackUsed || g.classification === "unresolved";
    if (!needsAttention) continue;
    const ambiguousTaxonomy = g.kind === "status" && (g.candidates?.length ?? 0) > 1 && !(g.resolved ?? []).some((x) => x.kind === "class");
    const value = (g.resolved ?? []).map((x) => x.value).join(" + ") || "(unresolved)";
    out.push({
      kind: g.kind,
      property: g.kind,
      value: ambiguousTaxonomy ? "(ambiguous — no class selected)" : value,
      authority: g.authority ?? "hint",
      confidence: level,
      note: ambiguousTaxonomy
        ? `multiple taxonomy candidates (${g.candidates.length}) — do NOT guess; pick from the design's status text`
        : (g.fallback?.note
          ?? (g.candidates?.length ? `ambiguous (${g.candidates.length} candidates) — pick from the design evidence` : `non-exact mapping — treat as suggestion, not design fact`)),
    });
  }
  return out.slice(0, 8);
}

/** The corpus families whose blocks may be pruned by the design (mirrors spec's familiesInPlay). */
const PRUNABLE_FAMILIES = new Set(["select", "table"]);

/**
 * Select reusable `::ng-deep` recipes for the design. A recipe is a REFERENCE (selector +
 * family + provenance), never a full block copy — the verbatim blocks live in spec.md's
 * "Copy verbatim" section, so this projection does not duplicate them.
 */
export function selectStyleRecipes(inventory, conventions = {}) {
  const corpus = conventions.ngDeepCorpus ?? [];
  const inPlay = new Set();
  if (inventory.some((r) => r.role === "select")) inPlay.add("select");
  if (inventory.some((r) => r.role === "table")) inPlay.add("table");

  const recipes = [];
  for (const c of corpus) {
    if (!c?.reusable) continue;
    if (c.family && PRUNABLE_FAMILIES.has(c.family) && !inPlay.has(c.family)) continue;
    recipes.push({
      id: c.selector,
      family: c.family ?? null,
      selector: c.selector,
      source: "conventions.json.ngDeepCorpus",
      reason: c.family ? `${c.family} family used by design` : "family-agnostic reusable idiom",
      locked: true,
    });
  }
  return recipes;
}

// ---------- manifest + render ----------

/** Assemble the machine-readable manifest. */
export function buildContextManifest({ design, generatedAt, sources, framework, inventory, capabilities, dangerousDefaults, styleRecipes, implementationHints, constraints, metrics }) {
  return {
    schemaVersion: CONTEXT_SCHEMA_VERSION,
    design,
    generatedAt,
    sources,
    framework,
    designInventory: inventory.map((r) => ({ role: r.role, count: r.count, evidence: r.evidence })),
    capabilities,
    dangerousDefaults,
    styleRecipes,
    implementationHints,
    constraints,
    metrics,
  };
}

/** Render the agent-facing markdown projection (the primary generation context). */
export function renderAgentContext(manifest) {
  const fw = manifest.framework ?? {};
  const L = [];
  L.push(`# Agent Context: ${manifest.design}`);
  L.push("");
  L.push("Compact, design-scoped context. Read this first; it prunes the full machine snapshot to");
  L.push("what this design actually uses. `spec.md` is the primary generation document.");
  L.push("");

  L.push("## Framework");
  L.push("");
  L.push(`- ${fw.name ?? "?"}${fw.version ? ` ${fw.version}` : ""}${fw.standalone ? " (standalone)" : ""}`);
  for (const c of manifest.constraints ?? []) L.push(`- ${c.text}`);

  L.push("");
  L.push("## Design Inventory");
  L.push("");
  if (!(manifest.designInventory ?? []).length) L.push("_(none detected)_");
  for (const r of manifest.designInventory ?? []) L.push(`- ${r.role}${r.count > 1 ? ` (×${r.count})` : ""}`);

  if ((manifest.capabilities ?? []).length) {
    L.push("");
    L.push("## Verified Component APIs");
    L.push("");
    for (const c of manifest.capabilities) {
      if (c.status === "unresolved") {
        L.push(`### ${c.role}`);
        L.push("");
        L.push(`_(unresolved — ${c.reason})_`);
        L.push("");
        continue;
      }
      L.push(`### \`${c.selector ?? c.library}\``);
      L.push("");
      if (c.selector) {
        if ((c.inputs ?? []).length) {
          L.push("**Inputs:**");
          L.push("");
          L.push("```");
          for (const i of c.inputs) L.push(`  [${i.name}]${i.default != null ? `  (default ${i.default})` : ""}`);
          L.push("```");
        }
        if ((c.outputs ?? []).length) {
          L.push("**Outputs:**");
          L.push("");
          L.push("```");
          for (const o of c.outputs) L.push(`  (${o})`);
          L.push("```");
        }
      } else {
        L.push(`Library: \`${c.library}\` (source: ${c.source}). Wiring per the sample below.`);
        L.push("");
      }
      if (c.wiringExample) {
        L.push("**Wiring example:**");
        L.push("");
        L.push("```html");
        L.push(c.wiringExample);
        L.push("```");
      }
      if (c.tsExample) {
        L.push("```ts");
        L.push(c.tsExample);
        L.push("```");
      }
      L.push(`_Source: ${c.source}._`);
      L.push("");
    }
  }

  if ((manifest.dangerousDefaults ?? []).length) {
    L.push("## Dangerous Defaults");
    L.push("");
    for (const d of manifest.dangerousDefaults) L.push(`- ${d.text} _(source: ${d.source})_`);
    L.push("");
  }

  if ((manifest.implementationHints ?? []).length) {
    L.push("## Implementation Hints (non-authoritative)");
    L.push("");
    L.push("Project-aware suggestions, NOT design facts. Hints at `medium`/`low` confidence or on");
    L.push("fallback are suggestions only — verify against the transcript before emitting; never");
    L.push("treat one as fact. Unresolved items must not be guessed.");
    L.push("");
    for (const h of manifest.implementationHints) {
      L.push(`- \`${h.kind}\` → ${h.value} _(authority: ${h.authority}, confidence: ${h.confidence})_ — ${h.note}`);
    }
    L.push("");
  }

  if ((manifest.styleRecipes ?? []).length) {
    L.push("## Relevant Style Recipes");
    L.push("");
    L.push("Reusable `::ng-deep` blocks in play for this design (verbatim in `spec.md` → Copy verbatim):");
    L.push("");
    for (const r of manifest.styleRecipes) L.push(`- \`${r.selector}\`${r.family ? ` (family: ${r.family})` : ""}`);
    L.push("");
  }

  L.push("## Primary Generation Input");
  L.push("");
  L.push("- Read `spec.md` (the one-pass render document).");
  L.push("- Read `transcript.md` only to inspect literal design details the spec does not show.");
  L.push("- Read `resolved.json` only to diagnose idiom ambiguity.");
  L.push("- Do **not** read `conventions.json` during normal generation (machine-only).");
  L.push("- Do **not** read the full `pilar-reference.md` / `pilar-showcase.md` — grep a specific component only if this file lacks it.");
  L.push("");

  L.push("## Provenance");
  L.push("");
  for (const [k, v] of Object.entries(manifest.sources ?? {})) L.push(`- ${k}: \`${v}\``);
  L.push("");

  L.push("## Metrics");
  L.push("");
  const m = manifest.metrics ?? {};
  L.push(`- characters: ${m.characters ?? 0}`);
  L.push(`- estimated tokens: ${m.estimatedTokens ?? 0}`);
  L.push(`- capabilities selected: ${m.capabilityCount ?? 0}`);
  L.push(`- style recipes selected: ${m.styleRecipeCount ?? 0}`);
  L.push(`- budget exceeded: ${m.budgetExceeded ? "yes" : "no"}`);

  return L.join("\n") + "\n";
}

// ---------- metrics ----------

/**
 * Measure the rendered context. `estimatedTokens = ceil(chars/4)` — an ESTIMATE, not actual
 * model tokens. `unusedCapabilityCount` counts unresolved/unevidenced entries (0 by
 * construction); `prunedCapabilityCount` counts snapshot categories the design did not use.
 */
export function measureContext(manifest, markdown, snapshotCapabilityCount = 0) {
  const characters = [...String(markdown ?? "")].length;
  const estimatedTokens = Math.ceil(characters / 4);
  const capabilityCount = (manifest.capabilities ?? []).length;
  const unusedCapabilityCount = (manifest.capabilities ?? []).filter((c) => c.status === "unresolved" || !(c.evidence ?? []).length).length;
  const rawSourceExampleCount = (manifest.capabilities ?? []).filter((c) => c.source === "local").length;
  const prunedCapabilityCount = Math.max(0, snapshotCapabilityCount - capabilityCount);
  const budgetExceeded = characters > DEFAULT_CONTEXT_BUDGET.maxCharacters;
  return {
    characters,
    estimatedTokens,
    capabilityCount,
    styleRecipeCount: (manifest.styleRecipes ?? []).length,
    dangerousDefaultCount: (manifest.dangerousDefaults ?? []).length,
    unusedCapabilityCount,
    rawSourceExampleCount,
    prunedCapabilityCount,
    budgetExceeded,
  };
}

// ---------- orchestrator ----------

/**
 * Build the full context package (manifest + markdown) from already-loaded inputs.
 * Pure — no fs. `pilar` is `loadPilar()` output (null in a public install → pilar-specific
 * capability/API/defaults degrade gracefully to the registry sample).
 * @returns {{ manifest: object, markdown: string, metrics: object }}
 */
export function buildAgentContext({ transcript, conventions = {}, projectContext = {}, pilar = null, design = "design", generatedAt = null }) {
  const resolved = resolveGroupsOf(transcript, conventions, pilar);
  const resolvedGroups = resolved.groups;
  const inventory = buildDesignInventory(transcript?.layout ?? [], resolvedGroups);
  const capabilities = selectCapabilities(inventory, projectContext.capabilities ?? {}, pilar);
  const framework = frameworkInfo(projectContext);
  const constraints = frameworkConstraints(projectContext);
  const dangerousDefaults = selectDangerousDefaults(inventory, capabilities, pilar, constraints);
  const styleRecipes = selectStyleRecipes(inventory, conventions);
  const implementationHints = selectImplementationHints(resolvedGroups, resolved.behaviorBindings ?? []);

  const sources = {
    spec: "spec.md",
    transcript: "transcript.json",
    resolved: "resolved.json",
    conventions: "../../conventions.json",
    projectContext: "../../project-context.json",
    componentCatalog: "pilar-catalog",
  };

  const manifest = buildContextManifest({
    design,
    generatedAt: generatedAt ?? new Date().toISOString(),
    sources,
    framework,
    inventory,
    capabilities,
    dangerousDefaults,
    styleRecipes,
    implementationHints,
    constraints,
    metrics: {},
  });

  const markdown = renderAgentContext(manifest);
  const metrics = measureContext(manifest, markdown, Object.keys(projectContext.capabilities ?? {}).length);
  manifest.metrics = metrics;

  return { manifest, markdown, metrics };
}

/** Resolve styled leaves (reusing the same in-memory resolver as `spec`/`resolve`) for the
 *  semantic inventory signals (status-label) + the bounded implementation hints. */
function resolveGroupsOf(transcript, conventions, pilar = null) {
  try {
    return resolveTranscript(transcript, conventions, pilar);
  } catch {
    return { groups: [], behaviorBindings: [] };
  }
}
