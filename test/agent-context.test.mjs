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
  assert.equal(manifest.schemaVersion, 1, "schema version present");
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

test("skill contract: primary skill no longer defaults to reading conventions.json", () => {
  const skill = readFileSync(join(HERE, "..", "skill", "SKILL.md"), "utf8");
  // The skill must steer the agent away from the machine-only conventions.json…
  assert.match(skill, /machine-only/, "conventions.json labelled machine-only");
  assert.match(skill, /Do \*\*NOT\*\* read it during normal generation/, "explicit do-not-read instruction");
  // …toward the design-scoped context, and relegate resolved.json + pilar docs to fallback.
  assert.match(skill, /agent-context\.md/, "agent-context.md is the primary convention input");
  assert.match(skill, /resolved\.json.*diagnostic|diagnostic\/ambiguity/, "resolved.json is a diagnostic source");
  assert.match(skill, /targeted fallback|targeted lookup/, "pilar docs are targeted fallback only");
});
