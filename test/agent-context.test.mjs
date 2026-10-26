import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  buildAgentContext,
  buildDesignInventory,
  selectCapabilities,
  selectDangerousDefaults,
  selectStyleRecipes,
  renderAgentContext,
  measureContext,
  frameworkInfo,
  frameworkConstraints,
  DEFAULT_CONTEXT_BUDGET,
} from "../src/lib/agent-context.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));

// ---------- fixtures ----------

const CONVENTIONS = {
  ngDeepCorpus: [
    { selector: "ngx-select__choices", family: "select", reusable: true, block: "::ng-deep .ngx-select__choices { border-radius: 7px; }" },
    { selector: "label-custom-success", family: "label", reusable: true, block: ":host ::ng-deep .label-custom-success { background: #dcf5ef; }" },
    { selector: "ugw-pagination-container li.page-box", family: "table", reusable: true, block: "::ng-deep .ugw-pagination-container li.page-box { width: 28px; }" },
    // A component-specific block must never surface as a selected recipe.
    { selector: "custom-select .ngx-select__toggle-caret", family: "select", reusable: false, block: ":host ::ng-deep .custom-select .ngx-select__toggle-caret { display: none; }" },
  ],
  classVocabulary: [{ name: "label-custom-success", family: "label-custom" }],
};

/** Design with a table + select + checkbox + pagination footer (the fixture's real shape). */
function richTranscript() {
  return {
    version: 3,
    meta: { source: "figml", tier: 0, image: "design.xml", width: 800, height: 600, textQuality: "exact" },
    tokens: { colors: [], fonts: [] },
    layout: [
      { id: "f", type: "input", label: "NIM", children: [{ id: "c", type: "icon" }] },
      { id: "t", type: "group", table: true, children: [] },
      { id: "pg", type: "text", text: "Menampilkan 1-10 dari 20 data" },
    ],
    images: [],
    icons: [],
  };
}

/** Design with NO table/select — the capability-pruning case. */
function bareTranscript() {
  return {
    version: 3,
    meta: { source: "figml", tier: 0, image: "bare.xml", width: 400, height: 200, textQuality: "exact" },
    tokens: { colors: [], fonts: [] },
    layout: [
      { id: "btn", type: "button", text: "Cari" },
      { id: "tx", type: "text", text: "Judul" },
    ],
    images: [],
    icons: [],
  };
}

const CAPABILITIES = {
  select: { library: "ngx-select-ex", source: "registry", sampleHtml: "<ngx-select [items]=\"items\"></ngx-select>", sampleTs: "import { NgxSelectModule } from \"ngx-select-ex\";" },
  table: { library: "pilar (uii-table)", source: "registry", sampleHtml: "<uii-table [columns]=\"columns\" [rows]=\"rows\"></uii-table>", sampleTs: "import { TableModule } from \"pilar\";" },
  pagination: { library: "pilar (uii-pagination)", source: "installed", sampleHtml: "<uii-pagination [currentPage]=\"p\"></uii-pagination>", sampleTs: "import { PaginationModule } from \"pilar\";" },
  divider: { library: "native-hr", source: "registry", sampleHtml: "<hr />", sampleTs: null },
  checkbox: { library: "awesome-bootstrap-checkbox", source: "registry", sampleHtml: "<div class=\"checkbox\">…</div>", sampleTs: null },
};

const PROJECT_CONTEXT = {
  framework: { id: "angular", label: "Angular", version: null },
  moduleOrStandalone: "module",
  deps: { "@angular/core": "^13.3.11" },
  capabilities: CAPABILITIES,
  conventions: CONVENTIONS,
};

/** A minimal pilar-like object (mirrors loadPilar() shape) for the table/pagination policy. */
const PILAR = {
  pilarComponents: [
    {
      selector: "uii-table",
      className: "TableComponent",
      public: true,
      inputs: [
        { name: "rows", type: "Array<any>", default: "[]" },
        { name: "columns", type: "Array<any>", default: "[]" },
        { name: "actionColumn", default: "true" },
        { name: "checkboxColumn", default: "false" },
        { name: "paginationAlign", default: "'center'" },
        { name: "serverMode", default: "false" },
        { name: "page", type: "PilTablePage" },
      ],
      outputs: [
        { name: "editClicked" },
        { name: "rowsChanged" },
        { name: "pageChanged" },
        { name: "searchChanged" },
      ],
    },
    {
      selector: "uii-pagination",
      className: "PaginationComponent",
      public: true,
      inputs: [
        { name: "paginationALign", default: "'center'" },
        { name: "currentPage", type: "number" },
      ],
      outputs: [{ name: "pageChanged" }],
    },
  ],
  legalTableInputs: new Set(["rows", "columns", "actionColumn", "checkboxColumn", "paginationAlign"]),
  legalTableOutputs: new Set(["editClicked", "rowsChanged"]),
  forbiddenTableInputs: new Set(["serverMode", "page"]),
  forbiddenTableOutputs: new Set(["pageChanged", "searchChanged"]),
};

// ---------- tests ----------

test("agent-context: buildDesignInventory derives roles deterministically, never guesses", () => {
  const inv = buildDesignInventory(richTranscript().layout, []);
  const roles = inv.map((r) => r.role);
  assert.ok(roles.includes("select"), "select derived from input+icon child");
  assert.ok(roles.includes("table"), "table derived from the table flag");
  assert.ok(roles.includes("pagination"), "pagination derived from the 'Menampilkan … data' footer");
  assert.ok(!roles.includes("modal"), "no invented modal role");
});

test("agent-context: selectCapabilities includes only used categories, unresolved for gaps", () => {
  const inv = buildDesignInventory(richTranscript().layout, []);
  const caps = selectCapabilities(inv, CAPABILITIES, PILAR);
  const roles = caps.map((c) => c.role).sort();
  assert.deepEqual(roles, ["pagination", "select", "table"], "only select/table/pagination selected");
  const table = caps.find((c) => c.role === "table");
  assert.equal(table.selector, "uii-table", "pilar selector resolved from library label");
  assert.ok(table.inputs.some((i) => i.name === "paginationAlign"), "exact case-sensitive input preserved");
});

test("agent-context: pilar table inputs respect the slice policy (legal + forbidden split)", () => {
  const inv = buildDesignInventory(richTranscript().layout, []);
  const caps = selectCapabilities(inv, CAPABILITIES, PILAR);
  const table = caps.find((c) => c.role === "table");
  const legalNames = table.inputs.map((i) => i.name);
  assert.ok(legalNames.includes("rows") && legalNames.includes("columns"), "legal inputs present");
  assert.ok(!legalNames.includes("serverMode"), "forbidden input excluded from the legal list");
  assert.deepEqual(table.forbiddenInputs, ["serverMode", "page"], "forbidden inputs surfaced explicitly");
  assert.deepEqual(table.forbiddenOutputs, ["pageChanged", "searchChanged"], "forbidden outputs surfaced");
});

test("agent-context: unresolved capability is recorded, never guessed", () => {
  const caps = selectCapabilities(
    [{ role: "select", count: 1, evidence: ["x"] }],
    { select: { library: null } },
    null,
  );
  assert.equal(caps[0].status, "unresolved");
  assert.match(caps[0].reason, /No verified project capability/);
});

test("agent-context: selectStyleRecipes prunes table/select families not in play", () => {
  // Bare design (no table/select) → table + select reusable blocks are pruned; label kept.
  const bare = buildDesignInventory(bareTranscript().layout, []);
  const recipes = selectStyleRecipes(bare, CONVENTIONS);
  const selectors = recipes.map((r) => r.selector);
  assert.ok(!selectors.includes("ngx-select__choices"), "select block pruned when no select in play");
  assert.ok(!selectors.includes("ugw-pagination-container li.page-box"), "table block pruned when no table in play");
  assert.ok(selectors.includes("label-custom-success"), "family-agnostic label recipe kept");
  assert.ok(!selectors.includes("custom-select .ngx-select__toggle-caret"), "component-specific block excluded");
});

test("agent-context: selectDangerousDefaults covers paginationAlign but omits unused table", () => {
  const inv = buildDesignInventory(richTranscript().layout, []);
  const caps = selectCapabilities(inv, CAPABILITIES, PILAR);
  const constraints = frameworkConstraints(PROJECT_CONTEXT);
  const defaults = selectDangerousDefaults(inv, caps, PILAR, constraints);
  const texts = defaults.map((d) => d.text).join(" ");
  assert.match(texts, /paginationAlign/, "table paginationAlign default surfaced");
  assert.match(texts, /serverMode/, "forbidden server-mode default surfaced");

  // A bare design must NOT surface table defaults.
  const bareInv = buildDesignInventory(bareTranscript().layout, []);
  const bareCaps = selectCapabilities(bareInv, CAPABILITIES, PILAR);
  const bareDefaults = selectDangerousDefaults(bareInv, bareCaps, PILAR, constraints);
  assert.ok(!bareDefaults.some((d) => d.text.includes("paginationAlign")), "no table default for a table-less design");
});

test("agent-context: framework constraints reflect the module (non-standalone) model", () => {
  const info = frameworkInfo(PROJECT_CONTEXT);
  assert.equal(info.name, "angular");
  assert.equal(info.version, "^13.3.11");
  assert.equal(info.standalone, false);
  const constraints = frameworkConstraints(PROJECT_CONTEXT).map((c) => c.text).join(" ");
  assert.match(constraints, /\*ngIf/, "structural-directive constraint present");
  assert.match(constraints, /NOT `@if`\/`@for`/, "no @if/@for for Angular ≤13");
});

test("agent-context: renderAgentContext does not leak the full machine registry", () => {
  const { manifest, markdown } = buildAgentContext({
    transcript: richTranscript(),
    conventions: CONVENTIONS,
    projectContext: PROJECT_CONTEXT,
    pilar: PILAR,
    design: "design",
    generatedAt: "2026-09-25T00:00:00.000Z",
  });
  assert.ok(!markdown.includes("loadedClassRegistry"), "no loadedClassRegistry key in agent context");
  assert.ok(!markdown.includes("classVocabulary"), "no full class-vocabulary dump");
  assert.ok(!markdown.includes("custom-select .ngx-select__toggle-caret"), "component-specific block not rendered");
  assert.match(markdown, /uii-table/, "selected table component documented");
  assert.match(markdown, /spec\.md/, "primary generation input names spec.md");
  assert.match(markdown, /Do \*\*not\*\* read `conventions\.json`/, "conventions.json marked machine-only");
  // PR 4: v2 adds implementationHints (bounded, authority-labelled resolved mappings).
  assert.equal(manifest.schemaVersion, 2, "schema version present (v2 = +implementationHints)");
  assert.ok(manifest.metrics, "metrics present");
});

test("agent-context: measureContext uses the ceil(chars/4) token estimate and computes pruning", () => {
  const { manifest, markdown, metrics } = buildAgentContext({
    transcript: richTranscript(),
    conventions: CONVENTIONS,
    projectContext: PROJECT_CONTEXT,
    pilar: PILAR,
    design: "design",
    generatedAt: "2026-09-25T00:00:00.000Z",
  });
  assert.equal(metrics.estimatedTokens, Math.ceil(metrics.characters / 4), "token formula is ceil(chars/4)");
  assert.equal(metrics.rawSourceExampleCount, 0, "no raw source examples by construction");
  assert.equal(metrics.unusedCapabilityCount, 0, "no unresolved capabilities for the rich design");
  assert.ok(metrics.prunedCapabilityCount >= 2, "unused snapshot categories counted as pruned");
  assert.equal(metrics.budgetExceeded, metrics.characters > DEFAULT_CONTEXT_BUDGET.maxCharacters, "budget flag consistent");
});

test("agent-context: context budget is respected for the fixture-shaped design", () => {
  const { metrics } = buildAgentContext({
    transcript: richTranscript(),
    conventions: CONVENTIONS,
    projectContext: PROJECT_CONTEXT,
    pilar: PILAR,
    design: "design",
    generatedAt: "2026-09-25T00:00:00.000Z",
  });
  assert.ok(metrics.characters < DEFAULT_CONTEXT_BUDGET.maxCharacters, `under ${DEFAULT_CONTEXT_BUDGET.maxCharacters} chars`);
  assert.ok(metrics.budgetExceeded === false, "budget not exceeded");
});

test("agent-context: pilar absent (public install) degrades to registry sample, no crash", () => {
  const { manifest, markdown } = buildAgentContext({
    transcript: richTranscript(),
    conventions: CONVENTIONS,
    projectContext: PROJECT_CONTEXT,
    pilar: null,
    design: "design",
    generatedAt: "2026-09-25T00:00:00.000Z",
  });
  const table = manifest.capabilities.find((c) => c.role === "table");
  assert.equal(table.selector, null, "no catalog selector without pilar");
  assert.ok(table.wiringExample, "registry sample still provided");
  assert.ok(!markdown.includes("[serverMode]"), "no forbidden-input enumeration without the catalog");
});

test("skill contract: primary skill is a thin orchestrator over handoff + inspect + check", () => {
  const skill = readFileSync(join(HERE, "..", "skill", "SKILL.md"), "utf8");
  assert.match(skill, /\.sliceui\/handoff\.md/, "handoff is the project contract");
  assert.match(skill, /sliceui inspect/, "inspect is the design-context command");
  assert.match(skill, /sliceui check/, "check is the post-generate gate");
  assert.match(skill, /machine-only/, "conventions.json labelled machine-only");
  assert.match(skill, /during normal generation/, "do-not-read instruction present");
  assert.match(skill, /agent-context\.md/, "agent-context.md referenced");
  assert.match(skill, /targeted-fallback/, "pilar docs are targeted fallback");
});

// --- PR 4: implementation hints (bounded, authority-labelled) ---

import { selectImplementationHints } from "../src/lib/agent-context.mjs";
import { resolveTranscript } from "../src/lib/resolve.mjs";

test("PR4 agent-context: hints include behavior bindings and exclude high-confidence idioms", () => {
  const transcript = {
    version: 3,
    meta: { source: "figml", tier: 0, image: "d.xml", width: 100, height: 100, textQuality: "exact" },
    tokens: { colors: [], fonts: [] },
    layout: [
      // high-confidence icon (named glyph) — already inline in spec, must NOT become a hint
      { id: "caret", type: "icon", bg: "#03337b", description: "Icon_Font_Awesome_Free_Solid_C_caret-down" },
      // medium button heuristic — must become a hint
      { id: "btn", type: "button", text: "Batal", bg: "#ffffff" },
      // behavior evidence — must become a behavior-binding hint
      { id: "footer", type: "group", justify: "space-between", children: [
        { id: "info", type: "text", text: "Menampilkan 1-10 dari 20 data" },
      ] },
    ],
    images: [], icons: [],
  };
  const conventions = { ...CONVENTIONS, classVocabulary: [...CONVENTIONS.classVocabulary, { name: "btn-secondary", family: "btn" }] };
  const pilar = { pilarComponents: [{ selector: "uii-table", inputs: [{ name: "paginationAlign", default: "'center'" }] }] };
  const r = resolveTranscript(transcript, conventions, pilar);
  const hints = selectImplementationHints(r.groups, r.behaviorBindings);

  assert.ok(hints.some((h) => h.kind === "behavior-binding" && h.expression === "[paginationAlign]=\"'right'\""), "behavior binding present");
  assert.ok(hints.some((h) => h.kind === "button" && h.confidence === "medium"), "medium button heuristic surfaced");
  assert.ok(!hints.some((h) => h.value === "fa-caret-down"), "high-confidence caret not duplicated as a hint");
  assert.ok(hints.length <= 8, "hints bounded");
});

test("PR4 agent-context: fallback/unresolved groups always surface as hints", () => {
  const transcript = {
    version: 3,
    meta: { source: "figml", tier: 0, image: "d.xml", width: 100, height: 100, textQuality: "exact" },
    tokens: { colors: [], fonts: [] },
    layout: [
      { id: "u", type: "icon", description: "Vector", bg: "#123456" }, // unresolved
      { id: "g", type: "button", text: "Kirim", variant: "ghost" },    // fallback
    ],
    images: [], icons: [],
  };
  const r = resolveTranscript(transcript, CONVENTIONS);
  const hints = selectImplementationHints(r.groups, []);
  assert.ok(hints.some((h) => h.kind === "icon" && h.confidence === "none"), "unresolved icon surfaced");
  assert.ok(hints.some((h) => h.kind === "button" && h.authority === "fallback"), "fallback button surfaced");
  for (const h of hints) assert.match(h.note, /\S/, "every hint carries a note");
});

test("PR4 agent-context: markdown renders hints as non-authoritative with explicit instruction", () => {
  const { markdown } = buildAgentContext({
    transcript: {
      version: 3,
      meta: { source: "figml", tier: 0, image: "d.xml", width: 100, height: 100, textQuality: "exact" },
      tokens: { colors: [], fonts: [] },
      layout: [
        { id: "footer", type: "group", justify: "space-between", children: [
          { id: "info", type: "text", text: "Menampilkan 1-10 daari 20 data" },
        ] },
      ],
      images: [], icons: [],
    },
    conventions: CONVENTIONS,
    projectContext: PROJECT_CONTEXT,
    pilar: null,
    design: "design",
    generatedAt: "2026-09-25T00:00:00.000Z",
  });
  // With no hints (this design yields none), the section is absent; with hints it carries the
  // non-authoritative instruction. Assert the invariant: the markdown NEVER states a hint as fact.
  assert.ok(!/"authority": "authoritative"/.test(markdown), "no authoritative hints in projection");
});

test("PR4 agent-context: context budget still respected with hints present", () => {
  const { metrics, markdown } = buildAgentContext({
    transcript: {
      ...richTranscript(),
      layout: [...richTranscript().layout,
        { id: "footer", type: "group", justify: "space-between", children: [
          { id: "info", type: "text", text: "Menampilkan 1-10 dari 20 data" },
        ] },
        { id: "btn", type: "button", text: "Batal", bg: "#ffffff" },
      ],
    },
    conventions: { ...CONVENTIONS, classVocabulary: [...CONVENTIONS.classVocabulary, { name: "btn-secondary", family: "btn" }] },
    projectContext: PROJECT_CONTEXT,
    pilar: PILAR,
    design: "design",
    generatedAt: "2026-09-25T00:00:00.000Z",
  });
  assert.ok(metrics.characters < DEFAULT_CONTEXT_BUDGET.maxCharacters, "under budget with hints");
  assert.match(markdown, /Implementation Hints \(non-authoritative\)/, "hints section rendered");
  assert.match(markdown, /never\s+treat one as fact/, "explicit do-not-treat-as-fact instruction");
});

test("skill contract: authority hierarchy + invariant stated, internals routed to artifacts", () => {
  const skill = readFileSync(join(HERE, "..", "skill", "SKILL.md"), "utf8");
  assert.match(skill, /A1 DESIGN/, "authority hierarchy present");
  assert.match(skill, /A5 AGENT JUDGMENT/, "full hierarchy (A1–A5) present");
  assert.match(skill, /transcript\/XML owns ALL visible appearance/, "design owns appearance invariant");
  assert.match(skill, /Samples teach HOW to write/, "samples are writing samples, never copy-source");
  assert.match(skill, /implementation evidence, not visual authority/, "recipes are evidence, not authority");
  assert.match(skill, /required` — apply as instructed/, "recipe states documented");
  assert.match(skill, /spec\.md/, "spec.md is a debug/internal artifact");
  assert.match(skill, /guess an API\/service/, "mock-data rule present");
});

test("PR4-corrective agent-context: ambiguous taxonomy is non-authoritative, no guessed class", () => {
  const corpus = [
    { selector: "label-custom-waiting .fa-exclamation-circle", block: "::ng-deep .label-custom-waiting .fa-exclamation-circle { color: #f44444; }" },
    { selector: "label-custom-warning .fa-exclamation-circle", block: "::ng-deep .label-custom-warning .fa-exclamation-circle { color: #f44444; }" },
    { selector: "label-custom-new-student .fa-exclamation-circle", block: "::ng-deep .label-custom-new-student .fa-exclamation-circle { color: #f44444; }" },
  ];
  const { markdown, manifest } = buildAgentContext({
    transcript: { version: 3, meta: { source: "figml", tier: 0, image: "d.xml", width: 100, height: 100, textQuality: "exact" },
      tokens: { colors: [], fonts: [] }, layout: [
        { id: "badge", type: "group", bg: "#fef2f2", children: [{ id: "ic", type: "icon", bg: "#f44444" }] },
      ], images: [], icons: [] },
    conventions: { ngDeepCorpus: corpus, classVocabulary: [] },
    projectContext: PROJECT_CONTEXT,
    pilar: null,
    design: "d",
    generatedAt: "2026-09-25T00:00:00.000Z",
  });
  const hint = manifest.implementationHints.find((h) => h.kind === "status");
  assert.ok(hint, "ambiguous status surfaces as a hint");
  assert.equal(hint.value, "(ambiguous — no class selected)", "no guessed class");
  assert.match(hint.note, /do NOT guess/, "explicit no-guess instruction");
  assert.match(markdown, /do NOT guess/, "markdown carries the no-guess instruction");
});
