import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PILAR_VERSION,
  PILAR_COMPONENTS,
  PILAR_DIRECTIVES,
  PILAR_PIPES,
  PILAR_MODELS,
  PILAR_SERVICES,
  PILAR_MODULES,
  PILAR_ACTION_CONFIGS,
} from "../src/framework/angular/pilar-catalog.mjs";
import { PILAR_SHOWCASE } from "../src/framework/angular/pilar-showcase.mjs";
import { UII_ACTION_AUTH_ICON, UII_AUTHKEY_BY_ACTION, renderPilarReferenceMd, renderPilarShowcaseMd } from "../src/framework/angular/uii-profile.mjs";

// The checked-in pilar catalog is the single source of truth for the org's UI library. These
// tests assert (a) it is complete enough to be trusted, and (b) the derived truth tables
// (action→auth→icon) never drift from the catalog.

test("catalog has the full component inventory (public + internal tagged)", () => {
  assert.ok(PILAR_COMPONENTS.length >= 45, `expected ~47 components, got ${PILAR_COMPONENTS.length}`);

  const publicCount = PILAR_COMPONENTS.filter((c) => c.public).length;
  assert.ok(publicCount >= 30, `expected ≥30 public components, got ${publicCount}`);
  assert.ok(publicCount < PILAR_COMPONENTS.length, "internal components must be tagged non-public");

  // Every internal component is tagged `public: false` (never emitted by a consumer).
  const internalSelectors = PILAR_COMPONENTS.filter((c) => !c.public).map((c) => c.selector);
  for (const sel of ["uii-server-table", "uii-client-table", "uii-table-action", "uii-table-footer"]) {
    assert.ok(internalSelectors.includes(sel), `${sel} must be tagged internal`);
  }

  // Every public component carries its selector + typing so the agent can bind it correctly.
  for (const c of PILAR_COMPONENTS.filter((c) => c.public)) {
    assert.ok(c.selector, "selector required");
    assert.ok(Array.isArray(c.inputs) && Array.isArray(c.outputs), "inputs/outputs arrays required");
  }
});

test("catalog captures the full uii-table surface (inputs/outputs with types)", () => {
  const table = PILAR_COMPONENTS.find((c) => c.selector === "uii-table");
  assert.ok(table, "uii-table present");
  const inputNames = table.inputs.map((i) => i.name);
  // The inputs the agent binds in a slice must all be present with their real names.
  for (const b of ["rows", "columns", "actionColumn", "actionTitle", "checkboxColumn", "paginationOptions", "searchOptions", "limitOptions", "selectedLimit", "serverMode"]) {
    assert.ok(inputNames.includes(b), `uii-table input [${b}] present`);
  }
  const outputNames = table.outputs.map((o) => o.name);
  // The public uii-table exposes `selectedRow` (singular) on its @Output surface — its inner
  // client/server tables expose `selectedRows`, but the consumer binds the public wrapper.
  for (const o of ["editClicked", "deleteClicked", "detailClicked", "pageChanged", "selectedRow", "searchChanged"]) {
    assert.ok(outputNames.includes(o), `uii-table output (${o}) present`);
  }
});

test("catalog carries models, services, directives, pipes, modules (typing source of truth)", () => {
  const modelNames = PILAR_MODELS.map((m) => m.name);
  for (const m of ["TableColumn", "TableLimitOptions", "PilTablePage", "Toast", "ModalOptions", "Page", "Alert", "Paginate"]) {
    assert.ok(modelNames.includes(m), `model ${m} present`);
  }
  // Full typing: each model carries its source text (not just a name).
  assert.ok(PILAR_MODELS.every((m) => m.text), "every model has source text");

  const serviceNames = PILAR_SERVICES.map((s) => s.name);
  for (const s of ["ModalService", "ToastService", "TableService", "LoadingBarService", "ImageService", "AccordionService", "PilarTranslateService"]) {
    assert.ok(serviceNames.includes(s), `service ${s} present`);
  }

  assert.ok(PILAR_DIRECTIVES.some((d) => d.selector === "[uiiTooltip]"), "[uiiTooltip] directive present");
  assert.ok(PILAR_PIPES.some((p) => p.name === "pilarTranslate"), "pilarTranslate pipe present");
  assert.ok(PILAR_MODULES.some((m) => m.name === "TableModule"), "TableModule present");
});

test("action→auth→icon tables are derived from the catalog (never drift)", () => {
  // UII_ACTION_AUTH_ICON (agent-facing) and UII_AUTHKEY_BY_ACTION (verify's normalizeFigmaAction)
  // are built from PILAR_ACTION_CONFIGS, so they must agree with the source for every canonical type.
  for (const c of PILAR_ACTION_CONFIGS) {
    const authRow = UII_ACTION_AUTH_ICON.find((r) => r.action === c.type);
    assert.ok(authRow, `UII_ACTION_AUTH_ICON has ${c.type}`);
    assert.equal(authRow.authKey, c.authKey, `${c.type} → ${c.authKey}`);
    assert.equal(UII_AUTHKEY_BY_ACTION[c.type], c.authKey, `UII_AUTHKEY_BY_ACTION[${c.type}] === ${c.authKey}`);
  }
  // The extra sliceui-side Figma aliases survive.
  assert.equal(UII_AUTHKEY_BY_ACTION.edit, "canUpdate");
  assert.equal(UII_AUTHKEY_BY_ACTION.verifivation, "canVerify");
  assert.equal(UII_AUTHKEY_BY_ACTION.activate, "canActivate");
});

test("renderPilarReferenceMd renders the full agent-facing reference (components + typing)", () => {
  const md = renderPilarReferenceMd();
  assert.match(md, new RegExp(`pilar reference \\(v${PILAR_VERSION}\\)`), "version header");
  assert.match(md, /## Components/, "components section");
  assert.match(md, /### `<uii-table>`/, "uii-table documented");
  assert.match(md, /## Models & types/, "models section");
  assert.match(md, /## Services/, "services section");
  assert.match(md, /## Feature modules/, "modules section");
  assert.match(md, /action → authKey → icon|authKey \(set true\)/, "action truth table");
  // Internal building blocks are flagged so the agent never emits them directly.
  assert.match(md, /Internal building blocks \(do NOT emit directly\)/, "internal flagged");
  // Exact typing is present (not just a name).
  assert.match(md, /TableLimitOptions = boolean \| Array/, "TableLimitOptions type inline");
});

test("pilar showcase catalog covers every doc-* with real working examples", () => {
  // Exactly the 24 doc-* showcases. get-started/installation/under-development are
  // scaffolding pages with zero pilar examples — deliberately filtered by the extractor.
  assert.equal(PILAR_SHOWCASE.length, 24, `expected exactly 24 doc-* showcase entries, got ${PILAR_SHOWCASE.length}`);
  assert.ok(PILAR_SHOWCASE.every((e) => e.id.startsWith("doc-")), "no non-doc-* scaffolding entries");

  const ids = PILAR_SHOWCASE.map((e) => e.id);
  for (const id of ["doc-table", "doc-button", "doc-accordion", "doc-modal", "doc-tooltip", "doc-dropdown"]) {
    assert.ok(ids.includes(id), `showcase has ${id}`);
  }

  // The doc-* entries (excluding get-started/installation/under-development) each carry sections
  // with real markup — this is the "full code playbook" the user asked for.
  const docEntries = PILAR_SHOWCASE.filter((e) => e.id.startsWith("doc-"));
  assert.equal(docEntries.length, 24, "24 doc-* showcases");

  const sections = PILAR_SHOWCASE.flatMap((e) => e.sections);
  assert.ok(sections.length >= 100, `expected ≥100 sections, got ${sections.length}`);

  // Every section carries its markup (only `pilar-font`/`grid-system` use inline strings, still non-empty).
  const withHtml = sections.filter((s) => s.html && s.html.trim().length > 0);
  assert.ok(withHtml.length >= 100, `expected ≥100 sections with markup, got ${withHtml.length}`);

  // The table showcase must include the server-mode + action + checkbox examples.
  const table = PILAR_SHOWCASE.find((e) => e.id === "doc-table");
  const tableAnchors = table.sections.map((s) => s.anchor);
  for (const a of ["table-with-action", "table-with-checkbox", "table-server-mode", "table-with-input", "table-with-select"]) {
    assert.ok(tableAnchors.includes(a), `doc-table has ${a}`);
  }
});

test("renderPilarShowcaseMd renders the full agent-facing showcase (index + examples)", () => {
  const md = renderPilarShowcaseMd();
  assert.match(md, /# pilar showcase \(working examples\)/, "header");
  assert.match(md, /## Index/, "index");
  assert.match(md, /\[Table\]\(#doc-table\) — 15 examples/, "table in index");
  assert.match(md, /## Table/, "table section");
  // A real working example's markup is present (uii-table usage).
  assert.match(md, /<uii-table/, "uii-table markup in examples");
});
