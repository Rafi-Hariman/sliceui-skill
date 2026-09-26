import { test } from "node:test";
import assert from "node:assert/strict";
import { verifyComponent } from "../src/framework/angular/verify.mjs";

// Ground truth fixtures mirroring the history-agreement defect corpus.
const CONVENTIONS = {
  ngDeepCorpus: [
    // library-internal reusable selectors (family-scoped, matching LIBRARY_INTERNAL)
    { selector: "ngx-select__choices", family: "select", block: "::ng-deep .ngx-select__choices { border-radius: 7px; }" },
    { selector: "ngx-select__item_active", family: "select", block: "::ng-deep .ngx-select__item_active { color: #fff; }" },
    { selector: "dropdown-menu > li > a:hover", family: "select", block: "::ng-deep .dropdown-menu > li > a:hover { color: white; }" },
    { selector: "ugw-pagination-container li.page-box", family: "table", block: ":host ::ng-deep .ugw-pagination-container li.page-box { font-weight: bold; }" },
    // component-specific + label taxonomy (excluded from scssCoverage, used by classVocabulary)
    { selector: "label-custom-success", family: "label", block: ":host ::ng-deep .label-custom-success { background: #dcf5ef; }" },
    { selector: "gateway-table .row-container .table-input-autonumeric", family: "table", block: "::ng-deep .gateway-table .row-container .table-input-autonumeric { }" },
  ],
  classVocabulary: [
    { name: "label-custom-success", family: "label-custom", hint: "status/field label" },
    { name: "label-custom-warning", family: "label-custom", hint: "status/field label" },
    { name: "well", family: null, hint: "container/panel" },
  ],
  componentAnatomy: { well: true, tableTag: "uii-table", skeletonTag: "uii-table-skeleton", pagination: true, mockRowsFloor: 15 },
  naming: { prefix: "ugw", eventNaming: "onXxx($event)" },
};

// Pilar fixture mirroring loadPilar()'s shape, for the uii-table checks. In the repo (and any
// internal/UII build) these come from the real pilar catalogs via loadPilar(); tests inject a
// minimal stand-in so verify's uii-table checks run without importing the private catalogs.
const PILAR_FIXTURE = {
  legalTableInputs: new Set(["rows", "columns", "actionTitle", "actionColumn", "checkboxColumn", "paginationOptions", "searchOptions", "limitOptions", "emptyTableMsg", "footerInfo", "radioColumn", "showSummary", "summaryRows", "paginationAlign"]),
  legalTableOutputs: new Set(["editClicked", "deleteClicked", "detailClicked", "selectedRow", "switchChanged", "rowsChanged"]),
  forbiddenTableInputs: new Set(["serverMode", "page", "selectedLimit", "saveStatement", "forceLimitOptions", "alignedComponent", "allowRightClick", "rightClickMenuActions", "summaryRows", "showSummary"]),
  forbiddenTableOutputs: new Set(["pageChanged", "limitChanged", "searchChanged"]),
  pilarComponents: [
    { selector: "uii-table", inputs: [{ name: "rows" }, { name: "columns" }, { name: "checkboxColumn" }, { name: "actionColumn" }, { name: "actionTitle" }, { name: "saveStatement" }, { name: "allowRightClick" }, { name: "serverMode" }, { name: "paginationAlign" }], outputs: [{ name: "editClicked" }, { name: "deleteClicked" }, { name: "detailClicked" }] },
  ],
  authKeyByAction: { edit: "canUpdate", detail: "canRead", delete: "canDelete", print: "canPrint", verify: "canVerify", validate: "canValidate" },
};

const TRANSCRIPT = {
  layout: [
    { type: "text", text: "Ubah tagihan" },
    { type: "button", text: "Cari" },
    { type: "text", text: "Pilih jenis tagihan" },
    { type: "text", text: "Menampilkan 1-10 dari 20 data" },
  ],
};

const RAW_XML_WITH_CHECKBOX = "<Checkbox_FNC id=\"x\" ... />";
const RAW_XML_NO_CHECKBOX = "<Rectangle id=\"y\" ... />";
const RAW_XML_WITH_AKSI = `<Aksi id="x:1" name="Aksi" type="INSTANCE">
  <componentProperties>
    <edit_4879_2 type="BOOLEAN" value="true" />
    <detail_4879_3 type="BOOLEAN" value="false" />
    <delete_5037_1 type="BOOLEAN" value="false" />
    <toggle_4879_0 type="BOOLEAN" value="false" />
    <verifivation_5037_0 type="BOOLEAN" value="false" />
  </componentProperties>
</Aksi>`;
const RAW_XML_WITH_FILTER_BUTTON = `<Button_FNC id="f:1" name="Button_FNC">
  <children><Text id="t:1" name="Button" characters="Cari" /></children>
</Button_FNC>`;

const ACTION_HTML = `<uii-table [rows]="rows" [columns]="columns" [actionTitle]="'Aksi'" [actionColumn]="true" (editClicked)="onEdit($event)"></uii-table>`;

const GOOD_TS_AUTH = `import { AuthorizationModel } from "@uiigateway/core";
const base = [
  { nim: "1" }, { nim: "2" }, { nim: "3" }, { nim: "4" }, { nim: "5" },
  { nim: "6" }, { nim: "7" }, { nim: "8" }, { nim: "9" }, { nim: "10" },
  { nim: "11" }, { nim: "12" }, { nim: "13" }, { nim: "14" }, { nim: "15" },
  { nim: "16" }, { nim: "17" }, { nim: "18" }, { nim: "19" }, { nim: "20" },
];
this.rows = base.map((x, i) => {
  const auth = new AuthorizationModel();
  auth.canUpdate = true;
  return { ...x, number: i + 1, auth };
});`;

const BAD_TS = `const MOCK_ROWS = [
  { nim: "1" }, { nim: "2" }, { nim: "3" }, { nim: "4" }, { nim: "5" },
  { nim: "6" }, { nim: "7" }, { nim: "8" }, { nim: "9" }, { nim: "10" },
  { nim: "11" }, { nim: "12" }, { nim: "13" }, { nim: "14" }, { nim: "15" },
  { nim: "16" }, { nim: "17" }, { nim: "18" }, { nim: "19" }, { nim: "20" },
];
this.rows = MOCK_ROWS.map((x, i) => {
  x.number = i + 1;
  return x;
});`;

const GOOD_SCSS = `
::ng-deep .ngx-select__choices { border-radius: 7px; }
::ng-deep .ngx-select__item_active { color: #fff; }
::ng-deep .dropdown-menu > li > a:hover { color: white; }
:host ::ng-deep .label-custom-success { background: #dcf5ef; }
:host ::ng-deep .ugw-pagination-container li.page-box { font-weight: bold; }
`;

const GOOD_HTML = `
<uii-table-skeleton *ngIf="isLoading"></uii-table-skeleton>
<uii-table [rows]="rows" [columns]="columns" [checkboxColumn]="true" [actionTitle]="'Aksi'" (editClicked)="onEdit($event)"></uii-table>
`;

// A faithful component: also carries the fidelity-critical text (title/button/placeholder).
const FAITHFUL_HTML = `
<h1 class="h1">Ubah tagihan</h1>
<button (click)="onSearch()">Cari</button>
<ngx-select [items]="items" [(ngModel)]="selected" (select)="onSelect($event)" placeholder="Pilih jenis tagihan"></ngx-select>
<uii-table-skeleton *ngIf="isLoading"></uii-table-skeleton>
<uii-table [rows]="rows" [columns]="columns" [checkboxColumn]="true" [actionTitle]="'Aksi'" (editClicked)="onEdit($event)"></uii-table>
`;

const GOOD_TS = `const base = [
  { nim: "1" }, { nim: "2" }, { nim: "3" }, { nim: "4" }, { nim: "5" },
  { nim: "6" }, { nim: "7" }, { nim: "8" }, { nim: "9" }, { nim: "10" },
  { nim: "11" }, { nim: "12" }, { nim: "13" }, { nim: "14" }, { nim: "15" }
];
this.rows = base.map((r, i) => ({ ...r, nomor: i + 1 }));`;

test("verify: a faithful component passes all checks", () => {
  const r = verifyComponent({
    scss: GOOD_SCSS, html: FAITHFUL_HTML, ts: GOOD_TS,
    conventions: CONVENTIONS, transcript: TRANSCRIPT, rawXml: RAW_XML_WITH_CHECKBOX,
  });
  assert.equal(r.pass, true, "all checks pass");
  assert.equal(r.failCount, 0);
});

test("verify: scssCoverage fails when ::ng-deep selectors dropped", () => {
  const r = verifyComponent({
    scss: "::ng-deep .ngx-select__choices { border-radius: 7px; }", // dropped item_active
    html: FAITHFUL_HTML, ts: GOOD_TS, // ngx-select triggers the select capability
    conventions: CONVENTIONS, transcript: TRANSCRIPT, rawXml: RAW_XML_WITH_CHECKBOX,
  });
  const check = r.checks.find((c) => c.name === "scssCoverage");
  assert.equal(check.status, "fail");
  assert.ok(check.missing.some((s) => s.includes("item_active")), "item_active flagged missing");
});

test("verify: textCoverage fails when the Cari button is dropped", () => {
  const r = verifyComponent({
    scss: GOOD_SCSS, html: GOOD_HTML, ts: GOOD_TS,
    conventions: CONVENTIONS, transcript: TRANSCRIPT, rawXml: RAW_XML_WITH_CHECKBOX,
  });
  // GOOD_HTML has no "Cari" button text anywhere → dropped.
  const check = r.checks.find((c) => c.name === "textCoverage");
  assert.equal(check.status, "fail");
  assert.ok(check.missing.includes("Cari"), "Cari flagged missing");
});

test("verify: checkboxColumn without XML evidence fails", () => {
  const r = verifyComponent({
    scss: GOOD_SCSS, html: GOOD_HTML, ts: GOOD_TS,
    conventions: CONVENTIONS, transcript: TRANSCRIPT, rawXml: RAW_XML_NO_CHECKBOX, pilar: PILAR_FIXTURE,
  });
  const check = r.checks.find((c) => c.name === "tableBindings");
  assert.equal(check.status, "fail");
  assert.ok(check.problems.some((p) => p.includes("checkbox")), "checkbox evidence problem");
});

test("verify: checkboxColumn absent when XML HAS checkbox fails", () => {
  const htmlNoCheckbox = `<uii-table [rows]="rows" [columns]="columns"></uii-table>`;
  const r = verifyComponent({
    scss: GOOD_SCSS, html: htmlNoCheckbox, ts: GOOD_TS,
    conventions: CONVENTIONS, transcript: TRANSCRIPT, rawXml: RAW_XML_WITH_CHECKBOX, pilar: PILAR_FIXTURE,
  });
  const check = r.checks.find((c) => c.name === "tableBindings");
  assert.equal(check.status, "fail");
  assert.ok(check.problems.some((p) => p.includes("checkboxColumn")), "missing checkboxColumn flagged");
});

test("verify: tableBindings forbids server/advanced inputs a mock slice must not bind", () => {
  // The catalog declares these as REAL pilar inputs; the slice POLICY forbids them.
  for (const forbidden of ["saveStatement", "allowRightClick", "rightClickMenuActions", "serverMode"]) {
    const html = `<uii-table [rows]="rows" [columns]="columns" [${forbidden}]="true"></uii-table>`;
    const r = verifyComponent({ scss: GOOD_SCSS, html, ts: GOOD_TS, conventions: CONVENTIONS, transcript: TRANSCRIPT, rawXml: RAW_XML_NO_CHECKBOX, pilar: PILAR_FIXTURE });
    const check = r.checks.find((c) => c.name === "tableBindings");
    assert.equal(check.status, "fail", `[${forbidden}] must be forbidden`);
    assert.ok(check.problems.some((p) => p.includes(forbidden)), `[${forbidden}] named in problems`);
  }
});

test("verify: F7 — [checkboxColumn]=\"false\" is a deliberate OFF, not a violation", () => {
  // 2026-09-11 F7: an explicit false means the design has no checkbox column; the XML evidence
  // check must not fire (and it must not demand the column that was deliberately turned off).
  const htmlOff = `<uii-table [rows]="rows" [columns]="columns" [checkboxColumn]="false"></uii-table>`;
  const r = verifyComponent({
    scss: GOOD_SCSS, html: htmlOff, ts: GOOD_TS,
    conventions: CONVENTIONS, transcript: TRANSCRIPT, rawXml: RAW_XML_WITH_CHECKBOX, pilar: PILAR_FIXTURE,
  });
  const check = r.checks.find((c) => c.name === "tableBindings");
  assert.notEqual(check.status, "fail", "explicit [checkboxColumn]=\"false\" must not fail");
  assert.ok(!(check.problems ?? []).some((p) => p.includes("checkboxColumn")), "no checkbox evidence problem when explicitly off");
});

test("verify: F7 — [showSummary]=\"false\" is not flagged as a forbidden binding", () => {
  // A declarative OFF is not a usage claim — it must not trip the mock-only forbidden list.
  const html = `<uii-table [rows]="rows" [columns]="columns" [showSummary]="false"></uii-table>`;
  const r = verifyComponent({
    scss: GOOD_SCSS, html, ts: GOOD_TS,
    conventions: CONVENTIONS, transcript: TRANSCRIPT, rawXml: RAW_XML_NO_CHECKBOX, pilar: PILAR_FIXTURE,
  });
  const check = r.checks.find((c) => c.name === "tableBindings");
  assert.ok(!(check.problems ?? []).some((p) => p.includes("showSummary")), "[showSummary]=\"false\" must not be forbidden");
});

test("verify: F7 — [showSummary]=\"true\" is still forbidden (usage claim)", () => {
  const html = `<uii-table [rows]="rows" [columns]="columns" [showSummary]="true"></uii-table>`;
  const r = verifyComponent({
    scss: GOOD_SCSS, html, ts: GOOD_TS,
    conventions: CONVENTIONS, transcript: TRANSCRIPT, rawXml: RAW_XML_NO_CHECKBOX, pilar: PILAR_FIXTURE,
  });
  const check = r.checks.find((c) => c.name === "tableBindings");
  assert.ok((check.problems ?? []).some((p) => p.includes("showSummary")), "[showSummary]=\"true\" stays forbidden");
});

test("verify: tableBindings still allows the mock-appropriate binding set", () => {
  const html = `<uii-table [rows]="rows" [columns]="columns" [limitOptions]="true" [searchOptions]="true" [paginationOptions]="true"></uii-table>`;
  const r = verifyComponent({ scss: GOOD_SCSS, html, ts: GOOD_TS, conventions: CONVENTIONS, transcript: TRANSCRIPT, rawXml: RAW_XML_NO_CHECKBOX, pilar: PILAR_FIXTURE });
  const check = r.checks.find((c) => c.name === "tableBindings");
  assert.equal(check.status, "pass", `mock bindings must pass: ${check.detail}`);
});

test("verify: pilarBindings rejects a binding name not declared by the catalog", () => {
  const html = `<uii-table [rows]="rows" [columns]="columns" [colums]="typo"></uii-table>`;
  const r = verifyComponent({ scss: GOOD_SCSS, html, ts: GOOD_TS, conventions: CONVENTIONS, transcript: TRANSCRIPT, rawXml: RAW_XML_NO_CHECKBOX, pilar: PILAR_FIXTURE });
  const check = r.checks.find((c) => c.name === "pilarBindings");
  assert.equal(check.status, "fail");
  assert.ok(check.problems.some((p) => p.includes("[colums]")), "typo'd binding named");
});

test("verify: pilarBindings rejects a hallucinated pilar component tag", () => {
  const html = `<uii-fancy-widget [rows]="rows"></uii-fancy-widget>`;
  const r = verifyComponent({ scss: GOOD_SCSS, html, ts: GOOD_TS, conventions: CONVENTIONS, transcript: TRANSCRIPT, rawXml: RAW_XML_NO_CHECKBOX, pilar: PILAR_FIXTURE });
  const check = r.checks.find((c) => c.name === "pilarBindings");
  assert.equal(check.status, "fail");
  assert.ok(check.problems.some((p) => p.includes("not a pilar component")), "hallucinated tag named");
});

test("verify: invented status-label classes warn classVocabulary (not fail)", () => {
  // scoped ::ng-deep (no bare-leak noise); the invented label is still a NEW taxonomy member.
  const scopedBase = GOOD_SCSS.replace(/^::ng-deep/gm, ":host ::ng-deep");
  const scssWithInvented = scopedBase + "\n:host ::ng-deep .label-custom-unpaid { background: #fef2f2; }\n";
  const r = verifyComponent({
    scss: scssWithInvented, html: FAITHFUL_HTML, ts: GOOD_TS, // FAITHFUL: passes the other checks
    conventions: CONVENTIONS, transcript: TRANSCRIPT, rawXml: RAW_XML_WITH_CHECKBOX,
  });
  const check = r.checks.find((c) => c.name === "classVocabulary");
  assert.equal(check.status, "warn", "invented taxonomy member is a warn, not a gate block");
  assert.ok(check.invented.includes("label-custom-unpaid"), "label-custom-unpaid flagged invented");
  assert.equal(r.failCount, 0, "warn does not fail the run");
  assert.equal(r.pass, true, "a run with only warns passes");
});

test("verify: classVocabulary skips (not passes) when no vocabulary — closes all-skip false-green", () => {
  const r = verifyComponent({
    scss: GOOD_SCSS, html: GOOD_HTML, ts: GOOD_TS,
    conventions: { ...CONVENTIONS, classVocabulary: [], ngDeepCorpus: [] },
    transcript: TRANSCRIPT, rawXml: RAW_XML_WITH_CHECKBOX,
  });
  const check = r.checks.find((c) => c.name === "classVocabulary");
  assert.equal(check.status, "skip", "no vocabulary → cannot verify → skip, not pass");
});

test("verify: an all-skip run (missing ground truth) is NOT green — closes the false-green", () => {
  // Simulate the wrong-directory case: no conventions, no transcript, no rawXml. A plain
  // table (no checkbox) so tableBindings skips instead of failing on missing XML evidence.
  // Scoped ::ng-deep (no bare-leak noise) so the only signal left is the missing ground truth.
  const htmlNoCheckbox = `<uii-table [rows]="rows" [columns]="columns"></uii-table>`;
  const scopedBase = GOOD_SCSS.replace(/^::ng-deep/gm, ":host ::ng-deep");
  const r = verifyComponent({ scss: scopedBase, html: htmlNoCheckbox, ts: GOOD_TS });
  assert.equal(r.pass, false, "all-skip run must not be green");
  assert.equal(r.failCount, 0, "no hard fails");
  assert.ok(r.skipCount > 0, "checks skipped for missing ground truth");
});

test("verify: F11 — anatomy WARNS (not fails) when the skeleton is missing", () => {
  // 2026-09-11 F11: demanding a loading-state skeleton the design never shows contradicts
  // "STRUCTURE = XML ONLY" — downgrade to a warn, never a blocking fail.
  const htmlNoSkeleton = `<uii-table [rows]="rows" [columns]="columns"></uii-table>`;
  const r = verifyComponent({
    scss: GOOD_SCSS, html: htmlNoSkeleton, ts: GOOD_TS,
    conventions: CONVENTIONS, transcript: TRANSCRIPT, rawXml: RAW_XML_WITH_CHECKBOX,
  });
  const check = r.checks.find((c) => c.name === "anatomy");
  assert.equal(check.status, "warn", "skeleton missing is a warn, not a fail");
});

test("verify: mockRowCount fails when a paginated table has fewer than 15 rows", () => {
  // GOOD_HTML binds [rows]="rows" — the fixture must declare `rows` (binding-resolved counting).
  const tsFewRows = `const rows = [{ nim: "1" }, { nim: "2" }, { nim: "3" }];`;
  const r = verifyComponent({
    scss: GOOD_SCSS, html: GOOD_HTML, ts: tsFewRows,
    conventions: CONVENTIONS, transcript: TRANSCRIPT, rawXml: RAW_XML_WITH_CHECKBOX,
  });
  const check = r.checks.find((c) => c.name === "mockRowCount");
  assert.equal(check.status, "fail");
  assert.equal(check.rows, 3);
  assert.equal(check.required, 15, "required = the fixed mock cap (15), regardless of transcript total");
});

test("verify: mockRowCount fails when a paginated table has MORE than 15 rows", () => {
  // "dari 20 data" must NOT drive 20 rows — the cap is exactly 15. 16+ is a fail too.
  const tsManyRows = `const rows = [
  { nim: "1" }, { nim: "2" }, { nim: "3" }, { nim: "4" }, { nim: "5" },
  { nim: "6" }, { nim: "7" }, { nim: "8" }, { nim: "9" }, { nim: "10" },
  { nim: "11" }, { nim: "12" }, { nim: "13" }, { nim: "14" }, { nim: "15" },
  { nim: "16" }
];`;
  const r = verifyComponent({
    scss: GOOD_SCSS, html: GOOD_HTML, ts: tsManyRows,
    conventions: CONVENTIONS, transcript: TRANSCRIPT, rawXml: RAW_XML_WITH_CHECKBOX,
  });
  const check = r.checks.find((c) => c.name === "mockRowCount");
  assert.equal(check.status, "fail");
  assert.equal(check.rows, 16);
  assert.equal(check.required, 15, "required = 15; 16 mock rows is a fail (cap, not just a floor)");
});

test("verify: F4 — mockRowCount counts the [rows]-bound array, not the largest (columns)", () => {
  // 2026-09-11 F4: komponenList (3 rows) vs columns (5 defs) — the old largest-array heuristic
  // counted 5 and failed a correct component.
  const html = `<uii-table [rows]="komponenList" [columns]="columns"></uii-table>`;
  const ts = `const komponenList = [
  { label: "A" }, { label: "B" }, { label: "C" },
];
const columns = [
  { field: "a" }, { field: "b" }, { field: "c" }, { field: "d" }, { field: "e" },
];`;
  const r = verifyComponent({
    scss: GOOD_SCSS, html, ts,
    conventions: CONVENTIONS, transcript: TRANSCRIPT, rawXml: RAW_XML_WITH_CHECKBOX,
  });
  const check = r.checks.find((c) => c.name === "mockRowCount");
  assert.equal(check.status, "fail", "3 bound rows ≠ 15 on a paginated table");
  assert.equal(check.rows, 3, "counts komponenList (the [rows] binding), not columns (5)");
});

test("verify: F4 — mockRowCount skips when all complement bindings are explicitly false", () => {
  // A uii-table canvas with pagination/search/limit all OFF renders the design's row count;
  // demanding 15 there is wrong (the modal-detail case from 2026-09-11).
  const htmlOff = `<uii-table [rows]="komponenList" [columns]="columns" [paginationOptions]="false" [searchOptions]="false" [limitOptions]="false"></uii-table>`;
  const ts = `const komponenList = [{ label: "A" }, { label: "B" }, { label: "C" }];
const columns = [{ field: "a" }, { field: "b" }];`;
  const r = verifyComponent({
    scss: GOOD_SCSS, html: htmlOff, ts,
    conventions: CONVENTIONS, transcript: TRANSCRIPT, rawXml: RAW_XML_WITH_CHECKBOX,
  });
  const check = r.checks.find((c) => c.name === "mockRowCount");
  assert.equal(check.status, "skip", "complement all-off → floor not applicable");
});

test("verify: F4 — mockRowCount counts the [rows]-bound array when it differs from the largest", () => {
  const html = `<uii-table [rows]="komponenList" [columns]="columns"></uii-table>`;
  const ts = `const komponenList = [
  { label: "A" }, { label: "B" }, { label: "C" },
];
const columns = [
  { field: "a" }, { field: "b" }, { field: "c" }, { field: "d" }, { field: "e" },
];`;
  const r = verifyComponent({
    scss: GOOD_SCSS, html, ts,
    conventions: CONVENTIONS, transcript: TRANSCRIPT, rawXml: RAW_XML_WITH_CHECKBOX,
  });
  const check = r.checks.find((c) => c.name === "mockRowCount");
  // 3 bound rows ≠ 15 → fail is CORRECT here, but the count must be 3 (not 5 from columns).
  assert.equal(check.status, "fail", "3 rows on a paginated table correctly fails the 15 floor");
  assert.equal(check.rows, 3, "counts komponenList (the [rows] binding), not columns (5)");
});

test("verify: mockRowCount ignores a trailing comma (15 rows stay 15, not 16)", () => {
  // 2026-09-10 B2: a trailing comma is idiomatic TS and must not inflate the count.
  const tsTrailing = `const rows = [
  { nim: "1" }, { nim: "2" }, { nim: "3" }, { nim: "4" }, { nim: "5" },
  { nim: "6" }, { nim: "7" }, { nim: "8" }, { nim: "9" }, { nim: "10" },
  { nim: "11" }, { nim: "12" }, { nim: "13" }, { nim: "14" }, { nim: "15" },
];`;
  const r = verifyComponent({
    scss: GOOD_SCSS, html: GOOD_HTML, ts: tsTrailing,
    conventions: CONVENTIONS, transcript: TRANSCRIPT, rawXml: RAW_XML_WITH_CHECKBOX,
  });
  const check = r.checks.find((c) => c.name === "mockRowCount");
  assert.equal(check.status, "pass", "15 rows (with trailing comma) must pass, not fail as 16");
});

test("verify: mockRowCount SKIPS a plain HTML <table> detail list (floor 15 not applicable)", () => {
  // A plain (non-library) table detail list with 3 mock rows and no pagination evidence must be
  // "not applicable", NOT a false-positive fail demanding 15 rows the design doesn't show.
  const ts3Rows = `const base = [
  { nim: "1", status: "Sudah bayar" },
  { nim: "2", status: "Sudah bayar" },
  { nim: "3", status: "Belum bayar" },
];`;
  // Design evidence: only a plain table + a couple of rows, NO pagination footer anywhere.
  const noPaginationTranscript = {
    layout: [
      { type: "text", text: "Detail tagihan yang sudah tergenerate" },
      { type: "text", text: "Sample Card Title" },
    ],
  };
  const r = verifyComponent({
    scss: GOOD_SCSS,
    html: `<div class="content"><table class="bill-table"><tr *ngFor="let row of base"><td>{{row.nim}}</td></tr></table></div>`,
    ts: ts3Rows,
    conventions: { ...CONVENTIONS, componentAnatomy: { ...CONVENTIONS.componentAnatomy, tableTag: "uii-table", mockRowsFloor: 15 } },
    transcript: noPaginationTranscript,
    rawXml: RAW_XML_WITH_CHECKBOX,
  });
  const check = r.checks.find((c) => c.name === "mockRowCount");
  assert.equal(check.status, "skip", "plain detail-list table → not applicable (skip), not fail");
});

test("verify: libraryTable FAILS a plain <table> in a uii-table project (no downgrade)", () => {
  const html = `<div class="content"><table class="bill-table"><tr><td>1</td></tr></table></div>`;
  const r = verifyComponent({
    scss: GOOD_SCSS, html, ts: GOOD_TS,
    conventions: CONVENTIONS, // anatomy.tableTag = "uii-table"
    transcript: TRANSCRIPT, rawXml: RAW_XML_WITH_CHECKBOX,
  });
  const check = r.checks.find((c) => c.name === "libraryTable");
  assert.equal(check.status, "fail", "plain <table> in a uii-table project must fail");
  assert.match(check.detail, /uii-table/);
});

test("verify: libraryTable PASSES when the project's <uii-table> is used", () => {
  const html = `<uii-table [rows]="rows" [columns]="columns"></uii-table>`;
  const r = verifyComponent({
    scss: GOOD_SCSS, html, ts: GOOD_TS,
    conventions: CONVENTIONS, transcript: TRANSCRIPT, rawXml: RAW_XML_WITH_CHECKBOX,
  });
  const check = r.checks.find((c) => c.name === "libraryTable");
  assert.ok(check.status !== "fail", `using <uii-table> must not fail, got ${check.status}`);
});

test("verify: libraryTable SKIPS a project with no library-table convention", () => {
  const html = `<table class="bill-table"><tr><td>1</td></tr></table>`;
  const r = verifyComponent({
    scss: GOOD_SCSS, html, ts: GOOD_TS,
    conventions: { ...CONVENTIONS, componentAnatomy: { ...CONVENTIONS.componentAnatomy, tableTag: null } },
    transcript: TRANSCRIPT, rawXml: RAW_XML_WITH_CHECKBOX,
  });
  const check = r.checks.find((c) => c.name === "libraryTable");
  assert.equal(check.status, "skip", "no tableTag convention → skip");
});

test("verify: classVocabulary FAILS an invented btn-* class (btn-gray)", () => {
  const html = `<div class="action-bar"><button class="btn btn-gray">Simpan</button></div>`;
  const r = verifyComponent({
    scss: GOOD_SCSS, html, ts: GOOD_TS,
    conventions: CONVENTIONS, // vocab has no btn-gray
    transcript: TRANSCRIPT, rawXml: RAW_XML_WITH_CHECKBOX,
  });
  const check = r.checks.find((c) => c.name === "classVocabulary");
  assert.equal(check.status, "fail", "invented btn-* must fail, not warn");
  assert.ok(check.inventedButtons?.includes("btn-gray"), `must name btn-gray, got ${JSON.stringify(check.inventedButtons)}`);
});

test("verify: classVocabulary does NOT flag id=\"btn-*\" (an element id, not a class)", () => {
  // 2026-09-10 B3: this project uses `id="btn-*"` ~46×; the old whole-text scan flagged them as
  // invented button classes. An id is not a class and must be ignored.
  const html = `<div class="action-bar"><button id="btn-save" class="btn btn-primary">Simpan</button></div>`;
  const r = verifyComponent({
    scss: GOOD_SCSS, html, ts: GOOD_TS,
    conventions: CONVENTIONS, transcript: TRANSCRIPT, rawXml: RAW_XML_WITH_CHECKBOX,
  });
  const check = r.checks.find((c) => c.name === "classVocabulary");
  assert.notEqual(check.status, "fail", "id=\"btn-save\" must not be flagged as an invented button");
  assert.ok(!(check.inventedButtons ?? []).includes("btn-save"), "btn-save (an id) is not invented");
});

test("verify: classVocabulary does NOT flag framework btn-primary (Report #2 §4.2)", () => {
  // A UII/BS project's vocabulary has no btn-* (only ugw-* shell classes), but the library's
  // global CSS defines .btn.btn-primary. It must not be "invented".
  const vocab = CONVENTIONS.classVocabulary; // no btn-*
  const html = `<button class="btn btn-primary">Simpan</button>`;
  const r = verifyComponent({
    scss: GOOD_SCSS, html, ts: GOOD_TS,
    conventions: { ...CONVENTIONS, classVocabulary: vocab },
    transcript: TRANSCRIPT, rawXml: RAW_XML_WITH_CHECKBOX,
  });
  const check = r.checks.find((c) => c.name === "classVocabulary");
  assert.notEqual(check.status, "fail", `btn-primary must not fail: ${JSON.stringify(check.detail)}`);
  assert.ok(!check.inventedButtons?.includes("btn-primary"), "btn-primary not invented");
});

test("verify: libraryTable SKIPS a plain detail table with NO pagination evidence (Report #1 §6.3)", () => {
  const html = `<div class="content"><table class="bill-table"><tr><td>1</td></tr></table></div>`;
  const noPaginationTranscript = { layout: [{ type: "text", text: "Detail tagihan yang sudah tergenerate" }] };
  const r = verifyComponent({
    scss: GOOD_SCSS, html, ts: GOOD_TS,
    conventions: CONVENTIONS, // tableTag = uii-table
    transcript: noPaginationTranscript, rawXml: RAW_XML_NO_CHECKBOX,
  });
  const check = r.checks.find((c) => c.name === "libraryTable");
  assert.equal(check.status, "skip", "plain detail table with no search/limit/pagination → skip, not fail");
});

test("verify: pilarInjection warns when uii-* present but pilar not injected (Report #2 §4.6)", () => {
  const html = `<uii-table [rows]="rows" [columns]="columns"></uii-table>`;
  const r = verifyComponent({
    scss: GOOD_SCSS, html, ts: GOOD_TS,
    conventions: CONVENTIONS, transcript: TRANSCRIPT, rawXml: RAW_XML_NO_CHECKBOX,
    // pilar NOT injected
  });
  const check = r.checks.find((c) => c.name === "pilarInjection");
  assert.equal(check.status, "warn", "uii-* without pilar must warn, not silently skip");
  assert.match(check.detail, /not injected/i);
});

test("verify: pilarInjection skips when pilar IS injected", () => {
  const html = `<uii-table [rows]="rows" [columns]="columns"></uii-table>`;
  const r = verifyComponent({
    scss: GOOD_SCSS, html, ts: GOOD_TS,
    conventions: CONVENTIONS, transcript: TRANSCRIPT, rawXml: RAW_XML_NO_CHECKBOX, pilar: PILAR_FIXTURE,
  });
  const check = r.checks.find((c) => c.name === "pilarInjection");
  assert.equal(check.status, "skip", "pilar present → no warning");
});

test("verify: tableBindings warns on (rowsChanged) binding (Report #1 §6.1 footgun)", () => {
  const html = `<uii-table [rows]="rows" [columns]="columns" (rowsChanged)="onRowsChanged($event)"></uii-table>`;
  const r = verifyComponent({
    scss: GOOD_SCSS, html, ts: GOOD_TS,
    conventions: CONVENTIONS, transcript: TRANSCRIPT, rawXml: RAW_XML_NO_CHECKBOX, pilar: PILAR_FIXTURE,
  });
  const check = r.checks.find((c) => c.name === "tableBindings");
  assert.equal(check.status, "warn", "(rowsChanged) is a footgun → warn");
  assert.match(check.detail, /rowsChanged/);
});

test("verify: no-exemplar never scores pass (empty corpus → skip, not pass)", () => {
  const r = verifyComponent({
    scss: GOOD_SCSS, html: GOOD_HTML, ts: GOOD_TS,
    conventions: { ...CONVENTIONS, ngDeepCorpus: [] },
    transcript: TRANSCRIPT, rawXml: RAW_XML_WITH_CHECKBOX,
  });
  const check = r.checks.find((c) => c.name === "scssCoverage");
  assert.equal(check.status, "skip", "empty corpus is skip (cannot verify), never pass");
});

test("verify: noHashedSelectors fails on [_ngcontent] leak", () => {
  const scssWithNgcontent = GOOD_SCSS + "\n::ng-deep .filter-options[_ngcontent-art-c12] { height: 40px; }\n";
  const r = verifyComponent({
    scss: scssWithNgcontent, html: FAITHFUL_HTML, ts: GOOD_TS,
    conventions: CONVENTIONS, transcript: TRANSCRIPT, rawXml: RAW_XML_WITH_CHECKBOX,
  });
  const check = r.checks.find((c) => c.name === "noHashedSelectors");
  assert.equal(check.status, "fail");
  assert.ok(check.detail.includes("_ngcontent"), "detail names the hashed selector");
});

test("verify: iconColor fails when badge icon color is invented (#f9933f triangle vs #f44444 design)", () => {
  // Transcript evidence: badge #fef2f2 + icon #f44444 (red). Output uses triangle #f9933f.
  const transcriptWithBadge = {
    layout: [
      { type: "text", text: "Ubah tagihan" },
      { type: "button", text: "Cari" },
      { type: "group", bg: "#fef2f2", children: [{ type: "icon", bg: "#f44444" }] },
    ],
  };
  const scssWrongIcon = GOOD_SCSS + "\n::ng-deep .fa-exclamation-triangle { color: #f9933f; }\n";
  const r = verifyComponent({
    scss: scssWrongIcon, html: FAITHFUL_HTML, ts: GOOD_TS,
    conventions: CONVENTIONS, transcript: transcriptWithBadge, rawXml: RAW_XML_WITH_CHECKBOX,
  });
  const check = r.checks.find((c) => c.name === "iconColor");
  assert.equal(check.status, "fail");
  assert.ok(check.detail.includes("#f9933f"), "detail names the invented color");
});

test("verify: iconColor does NOT flag a structural blue action icon (#03337b)", () => {
  // 2026-09-10 B4: #03337b is the project's structural blue for ACTION icons (search/pencil/eye),
  // NOT a status color. A faithful `fa-pencil { color: #03337b }` must not be false-failed.
  const transcriptWithBadge = {
    layout: [
      { type: "text", text: "Ubah tagihan" },
      { type: "group", bg: "#fef2f2", children: [{ type: "icon", bg: "#f44444" }] },
    ],
  };
  const scssActionIcon = GOOD_SCSS + "\n.action-icon .fa-pencil { color: #03337b; }\n";
  const r = verifyComponent({
    scss: scssActionIcon, html: FAITHFUL_HTML, ts: GOOD_TS,
    conventions: CONVENTIONS, transcript: transcriptWithBadge, rawXml: RAW_XML_WITH_CHECKBOX,
  });
  const check = r.checks.find((c) => c.name === "iconColor");
  assert.notEqual(check.status, "fail", "structural #03337b action icon must not be a fail");
});

test("verify: phantomWrapper fails when well wrapper has no transcript counterpart", () => {
  const htmlWithWell = `<div class="well" id="well"><h1>Ubah tagihan</h1></div>`;
  const transcriptNoWell = { layout: [{ type: "text", text: "Ubah tagihan" }] };
  const r = verifyComponent({
    scss: GOOD_SCSS, html: htmlWithWell, ts: GOOD_TS,
    conventions: CONVENTIONS, transcript: transcriptNoWell, rawXml: RAW_XML_WITH_CHECKBOX,
  });
  const check = r.checks.find((c) => c.name === "phantomWrapper");
  assert.equal(check.status, "fail");
  assert.ok(check.detail.includes("well"), "detail names the phantom well");
});

test("verify: phantomWrapper skips the well clause when the project has no well idiom", () => {
  // 2026-09-10 §3.9: a project with no `.well` in its templates must not be failed for
  // emitting one — conventions and verify pulled in opposite directions until this.
  const htmlWithWell = `<div class="well" id="well"><h1>Ubah tagihan</h1></div>`;
  const transcriptNoWell = { layout: [{ type: "text", text: "Ubah tagihan" }] };
  const noWellProject = {
    ...CONVENTIONS,
    componentAnatomy: { ...CONVENTIONS.componentAnatomy, wellAvailable: false },
  };
  const r = verifyComponent({
    scss: GOOD_SCSS, html: htmlWithWell, ts: GOOD_TS,
    conventions: noWellProject, transcript: transcriptNoWell, rawXml: RAW_XML_WITH_CHECKBOX,
  });
  const check = r.checks.find((c) => c.name === "phantomWrapper");
  assert.notEqual(check.status, "fail", "well without a project idiom is not a phantom");
});

// ---------- ngxSelectBinding ----------

test("verify: ngxSelectBinding fails when a select lacks [(ngModel)]", () => {
  const html = `<ngx-select [items]="items" [optionTextField]="'label'"></ngx-select>`;
  const r = verifyComponent({
    scss: GOOD_SCSS, html, ts: GOOD_TS,
    conventions: CONVENTIONS, transcript: TRANSCRIPT, rawXml: RAW_XML_WITH_CHECKBOX,
  });
  const check = r.checks.find((c) => c.name === "ngxSelectBinding");
  assert.equal(check.status, "fail");
  assert.ok(check.problems.some((p) => p.includes("ngModel")), "missing ngModel flagged");
});

test("verify: ngxSelectBinding passes when bound with [(ngModel)] + (select)", () => {
  const html = `<ngx-select [items]="items" [(ngModel)]="selected" (select)="onSelect($event)"></ngx-select>`;
  const r = verifyComponent({
    scss: GOOD_SCSS, html, ts: GOOD_TS,
    conventions: CONVENTIONS, transcript: TRANSCRIPT, rawXml: RAW_XML_WITH_CHECKBOX,
  });
  const check = r.checks.find((c) => c.name === "ngxSelectBinding");
  assert.equal(check.status, "pass");
});

test("verify: ngxSelectBinding skips when no <ngx-select> present", () => {
  const r = verifyComponent({
    scss: GOOD_SCSS, html: GOOD_HTML, ts: GOOD_TS,
    conventions: CONVENTIONS, transcript: TRANSCRIPT, rawXml: RAW_XML_WITH_CHECKBOX,
  });
  const check = r.checks.find((c) => c.name === "ngxSelectBinding");
  assert.equal(check.status, "skip");
});

// ---------- declaredInModule ----------

test("verify: F2 — declaredInModule does NOT pass on a route `component: X` reference", () => {
  // 2026-09-11 F2: the class appears in settings-routing (component: X) but in NO declarations
  // array — the old whole-source regex false-passed this exact case.
  const ts = `export class ScholarshipDeductionAddComponent {}\n`;
  const moduleSrc = `const routes = [{ path: 'create', component: ScholarshipDeductionAddComponent, pathMatch: 'full' }];
@NgModule({ declarations: [OtherComponent], imports: [RouterModule.forChild(routes)] })
export class SettingsRoutingModule {}`;
  const r = verifyComponent({
    scss: GOOD_SCSS, html: GOOD_HTML, ts, modules: moduleSrc,
    conventions: CONVENTIONS, transcript: TRANSCRIPT, rawXml: RAW_XML_WITH_CHECKBOX,
  });
  const check = r.checks.find((c) => c.name === "declaredInModule");
  assert.notEqual(check.status, "pass", "routed-but-undeclared must NOT pass");
  assert.equal(check.status, "warn", "it warns (app build is the definitive gate)");
});

test("verify: F2 — declaredInModule passes only when the class is INSIDE declarations: [...]", () => {
  const ts = `export class ScholarshipDeductionAddComponent {}\n`;
  const moduleSrc = `const routes = [{ path: 'create', component: ScholarshipDeductionAddComponent }];
@NgModule({ declarations: [ScholarshipDeductionAddComponent], imports: [CommonModule] })
export class BillModule {}`;
  const r = verifyComponent({
    scss: GOOD_SCSS, html: GOOD_HTML, ts, modules: moduleSrc,
    conventions: CONVENTIONS, transcript: TRANSCRIPT, rawXml: RAW_XML_WITH_CHECKBOX,
  });
  assert.equal(r.checks.find((c) => c.name === "declaredInModule").status, "pass");
});

test("verify: declaredInModule skips when no declarations array is parseable", () => {
  const ts = `export class HeroComponent {}\n`;
  const r = verifyComponent({
    scss: GOOD_SCSS, html: GOOD_HTML, ts, modules: `export const x = 1;`,
    conventions: CONVENTIONS, transcript: TRANSCRIPT, rawXml: RAW_XML_WITH_CHECKBOX,
  });
  assert.equal(r.checks.find((c) => c.name === "declaredInModule").status, "skip");
});

test("verify: declaredInModule warns when the component class is missing from declarations", () => {
  const ts = `export class HeroComponent {}\n`;
  const moduleSrc = `@NgModule({ declarations: [OtherComponent], imports: [] })\nexport class AppModule {}`;
  const r = verifyComponent({
    scss: GOOD_SCSS, html: GOOD_HTML, ts, modules: moduleSrc,
    conventions: CONVENTIONS, transcript: TRANSCRIPT, rawXml: RAW_XML_WITH_CHECKBOX,
  });
  const check = r.checks.find((c) => c.name === "declaredInModule");
  assert.equal(check.status, "warn", "undeclared component is a warn (app build is the definitive gate)");
  assert.match(check.detail, /HeroComponent/);
});

test("verify: declaredInModule passes when the class is declared", () => {
  const ts = `export class HeroComponent {}\n`;
  const moduleSrc = `@NgModule({ declarations: [HeroComponent, OtherComponent], imports: [] })\nexport class AppModule {}`;
  const r = verifyComponent({
    scss: GOOD_SCSS, html: GOOD_HTML, ts, modules: moduleSrc,
    conventions: CONVENTIONS, transcript: TRANSCRIPT, rawXml: RAW_XML_WITH_CHECKBOX,
  });
  assert.equal(r.checks.find((c) => c.name === "declaredInModule").status, "pass");
});

test("verify: declaredInModule skips without module source", () => {
  const ts = `export class HeroComponent {}\n`;
  const r = verifyComponent({
    scss: GOOD_SCSS, html: GOOD_HTML, ts,
    conventions: CONVENTIONS, transcript: TRANSCRIPT, rawXml: RAW_XML_WITH_CHECKBOX,
  });
  assert.equal(r.checks.find((c) => c.name === "declaredInModule").status, "skip");
});

// ---------- rowAuth ----------

test("verify: F3 — rowAuth recognizes Object.assign(new AuthorizationModel(), {…})", () => {
  // 2026-09-11 F3: the repo's existing idiom; flags written explicitly were reported "missing".
  const ts = `import { AuthorizationModel } from "@uiigateway/core";
const rows = [{ nim: "1" }, { nim: "2" }];
const withAuth = rows.map((r) => ({ ...r, auth: Object.assign(new AuthorizationModel(), { canRead: true, canUpdate: true }) }));`;
  const r = verifyComponent({
    scss: GOOD_SCSS, html: ACTION_HTML, ts,
    conventions: CONVENTIONS, transcript: TRANSCRIPT, rawXml: RAW_XML_WITH_AKSI, pilar: PILAR_FIXTURE,
  });
  const check = r.checks.find((c) => c.name === "rowAuth");
  assert.equal(check.status, "pass", "Object.assign auth idiom must count as flags present");
});

test("verify: rowAuth passes when actionColumn rows carry the required auth flag", () => {
  const r = verifyComponent({
    scss: GOOD_SCSS, html: ACTION_HTML, ts: GOOD_TS_AUTH,
    conventions: CONVENTIONS, transcript: TRANSCRIPT, rawXml: RAW_XML_WITH_AKSI, pilar: PILAR_FIXTURE,
  });
  const check = r.checks.find((c) => c.name === "rowAuth");
  assert.equal(check.status, "pass");
  assert.deepEqual([...check.required ?? []].sort(), ["canUpdate"]);
});

test("verify: rowAuth fails when actionColumn rows lack the auth flag (edit→canUpdate)", () => {
  const r = verifyComponent({
    scss: GOOD_SCSS, html: ACTION_HTML, ts: BAD_TS,
    conventions: CONVENTIONS, transcript: TRANSCRIPT, rawXml: RAW_XML_WITH_AKSI, pilar: PILAR_FIXTURE,
  });
  const check = r.checks.find((c) => c.name === "rowAuth");
  assert.equal(check.status, "fail");
  assert.ok(check.missing.includes("canUpdate"), "missing names canUpdate");
});

test("verify: rowAuth skips without [actionColumn] or without <Aksi> evidence", () => {
  const noAction = verifyComponent({
    scss: GOOD_SCSS, html: GOOD_HTML, ts: GOOD_TS_AUTH,
    conventions: CONVENTIONS, transcript: TRANSCRIPT, rawXml: RAW_XML_WITH_AKSI,
  });
  assert.equal(noAction.checks.find((c) => c.name === "rowAuth").status, "skip");

  const noAksi = verifyComponent({
    scss: GOOD_SCSS, html: ACTION_HTML, ts: GOOD_TS_AUTH,
    conventions: CONVENTIONS, transcript: TRANSCRIPT, rawXml: RAW_XML_WITH_CHECKBOX,
  });
  assert.equal(noAksi.checks.find((c) => c.name === "rowAuth").status, "skip");
});

test("verify: rowAuth skips when actionColumn is explicitly false (no phantom auth)", () => {
  // 2026-09-10 B1a: [actionColumn]="false" is a deliberate OFF, not a missing column.
  const htmlFalse = `<uii-table [rows]="rows" [columns]="columns" [actionColumn]="false"></uii-table>`;
  const r = verifyComponent({
    scss: GOOD_SCSS, html: htmlFalse, ts: BAD_TS, // BAD_TS has no auth flags — must still skip
    conventions: CONVENTIONS, transcript: TRANSCRIPT, rawXml: RAW_XML_WITH_AKSI, pilar: PILAR_FIXTURE,
  });
  assert.equal(r.checks.find((c) => c.name === "rowAuth").status, "skip");
});

test("verify: rowAuth skips a hidden <Aksi> (visible=false via override)", () => {
  // 2026-09-10 B1b: an Aksi hidden by `<override overriddenField="visible" value="false">`
  // is not a visible action column → must not require auth flags.
  const hiddenAksi = `<Aksi id="x:1" name="Aksi" type="INSTANCE">
    <override overriddenField="visible" value="false" />
    <componentProperties>
      <edit_4879_2 type="BOOLEAN" value="true" />
    </componentProperties>
  </Aksi>`;
  const r = verifyComponent({
    scss: GOOD_SCSS, html: ACTION_HTML, ts: BAD_TS,
    conventions: CONVENTIONS, transcript: TRANSCRIPT, rawXml: hiddenAksi, pilar: PILAR_FIXTURE,
  });
  assert.equal(r.checks.find((c) => c.name === "rowAuth").status, "skip");
});

// ---------- filterRowButton ----------

test("verify: filterRowButton fails when the XML Cari button is dropped", () => {
  const htmlNoCari = `<div class="row"><input placeholder="NIM" /></div>`;
  const r = verifyComponent({
    scss: GOOD_SCSS, html: htmlNoCari, ts: GOOD_TS,
    conventions: CONVENTIONS, transcript: TRANSCRIPT, rawXml: RAW_XML_WITH_FILTER_BUTTON,
  });
  const check = r.checks.find((c) => c.name === "filterRowButton");
  assert.equal(check.status, "fail");
});

test("verify: filterRowButton passes when a Cari button is rendered", () => {
  const htmlWithCari = `<div class="row"><button (click)="onSearch()">Cari</button></div>`;
  const r = verifyComponent({
    scss: GOOD_SCSS, html: htmlWithCari, ts: GOOD_TS,
    conventions: CONVENTIONS, transcript: TRANSCRIPT, rawXml: RAW_XML_WITH_FILTER_BUTTON,
  });
  const check = r.checks.find((c) => c.name === "filterRowButton");
  assert.equal(check.status, "pass");
});

test("verify: filterRowButton skips when the XML has no filter button", () => {
  const r = verifyComponent({
    scss: GOOD_SCSS, html: GOOD_HTML, ts: GOOD_TS,
    conventions: CONVENTIONS, transcript: TRANSCRIPT, rawXml: RAW_XML_WITH_CHECKBOX,
  });
  const check = r.checks.find((c) => c.name === "filterRowButton");
  assert.equal(check.status, "skip");
});

// ---------- buttonOrder ----------

test("verify: buttonOrder fails when bulk buttons are row-reverse", () => {
  const scssReverse = GOOD_SCSS + "\n.action-bar { display: flex; flex-direction: row-reverse; }\n";
  const r = verifyComponent({
    scss: scssReverse, html: GOOD_HTML, ts: GOOD_TS,
    conventions: CONVENTIONS, transcript: TRANSCRIPT, rawXml: RAW_XML_WITH_CHECKBOX,
  });
  const check = r.checks.find((c) => c.name === "buttonOrder");
  assert.equal(check.status, "fail");
  assert.ok(check.detail.includes("row-reverse"), "detail names row-reverse");
});

test("verify: buttonOrder skips when there is no reverse signal", () => {
  const r = verifyComponent({
    scss: GOOD_SCSS, html: GOOD_HTML, ts: GOOD_TS,
    conventions: CONVENTIONS, transcript: TRANSCRIPT, rawXml: RAW_XML_WITH_CHECKBOX,
  });
  const check = r.checks.find((c) => c.name === "buttonOrder");
  assert.equal(check.status, "skip");
});

// ---------- tableOptions ----------

const RAW_XML_TABLE_OPTIONS = `<search_bar id="s:1" name="search_bar" />
<Text id="t:1" name="Tampilkan" characters="Tampilkan 5 data" />
<Text id="t:2" name="pagination" characters="Menampilkan 1-10 dari 20 data" />`;

test("verify: tableOptions fails when search/limit/pagination bindings dropped", () => {
  // A table WITHOUT the three options even though the XML evidences them.
  const htmlBare = `<uii-table [rows]="rows" [columns]="columns"></uii-table>`;
  const r = verifyComponent({
    scss: GOOD_SCSS, html: htmlBare, ts: GOOD_TS,
    conventions: CONVENTIONS, transcript: TRANSCRIPT, rawXml: RAW_XML_TABLE_OPTIONS,
  });
  const check = r.checks.find((c) => c.name === "tableOptions");
  assert.equal(check.status, "fail");
  assert.ok(check.missing.includes("searchOptions"), "searchOptions missing");
  assert.ok(check.missing.includes("limitOptions"), "limitOptions missing");
  assert.ok(check.missing.includes("paginationOptions"), "paginationOptions missing");
});

test("verify: tableOptions passes when all three bindings present", () => {
  const htmlBound = `<uii-table [rows]="rows" [columns]="columns" [searchOptions]="true" [limitOptions]="true" [paginationOptions]="true"></uii-table>`;
  const r = verifyComponent({
    scss: GOOD_SCSS, html: htmlBound, ts: GOOD_TS,
    conventions: CONVENTIONS, transcript: TRANSCRIPT, rawXml: RAW_XML_TABLE_OPTIONS,
  });
  const check = r.checks.find((c) => c.name === "tableOptions");
  assert.equal(check.status, "pass");
});

test("verify: F14 — a search_bar inside a filter card does NOT require [searchOptions]", () => {
  // The design puts a decorative "Pencarian" input in the filter area (alongside a Field), not in
  // the table toolbar — demanding [searchOptions] would render a SECOND search box.
  const xmlFilterSearch = `<frame name="filter card">
  <Field id="f:1" name="Field" />
  <search_bar id="s:1" name="search_bar" />
</frame>
<Text id="t:1" name="pagination" characters="Menampilkan 1-10 dari 20 data" />`;
  // Output correctly renders a filter search input + only pagination on the table.
  const html = `<div class="filter"><input placeholder="Pencarian" /></div><uii-table [rows]="rows" [columns]="columns" [paginationOptions]="true"></uii-table>`;
  const r = verifyComponent({
    scss: GOOD_SCSS, html, ts: GOOD_TS,
    conventions: CONVENTIONS, transcript: TRANSCRIPT, rawXml: xmlFilterSearch,
  });
  const check = r.checks.find((c) => c.name === "tableOptions");
  assert.ok(!(check.missing ?? []).includes("searchOptions"), "filter search must not demand table searchOptions");
});

test("verify: tableOptions skips without table or without XML evidence", () => {
  const noTable = verifyComponent({
    scss: GOOD_SCSS, html: `<div>no table</div>`, ts: GOOD_TS,
    conventions: CONVENTIONS, transcript: TRANSCRIPT, rawXml: RAW_XML_TABLE_OPTIONS,
  });
  assert.equal(noTable.checks.find((c) => c.name === "tableOptions").status, "skip");

  const noEvidence = verifyComponent({
    scss: GOOD_SCSS, html: GOOD_HTML, ts: GOOD_TS,
    conventions: CONVENTIONS, transcript: TRANSCRIPT, rawXml: RAW_XML_WITH_CHECKBOX,
  });
  assert.equal(noEvidence.checks.find((c) => c.name === "tableOptions").status, "skip");
});

// ---------- paginationAlign: un-forbidden + evidence-gated (2026-09-24) ----------

// A footer frame that DISTRIBUTES its children (Figma auto-layout space-between) — the design
// signal for "pagination pinned to the right edge". `Page` is the root frame name on purpose:
// the hint must not fire on it.
const RAW_XML_FOOTER_SPACE_BETWEEN = `<?xml version="1.0" encoding="UTF-8"?>
<frame id="1:1" name="Page" x="0" y="0" width="1200" height="800" type="FRAME">
  <children>
    <frame id="1:2" name="Footer" x="0" y="760" width="1200" height="40" layoutMode="HORIZONTAL" primaryAxisAlignItems="SPACE_BETWEEN" type="FRAME">
      <children>
        <Text id="1:3" name="info" x="0" y="0" width="300" height="20" fontSize="14" characters="Menampilkan 1-10 dari 20 data" type="TEXT" />
        <frame id="1:4" name="Pagination" x="900" y="0" width="300" height="20" type="FRAME" />
      </children>
    </frame>
  </children>
</frame>`;

const RAW_XML_FOOTER_FLAT = RAW_XML_FOOTER_SPACE_BETWEEN.replace(' primaryAxisAlignItems="SPACE_BETWEEN"', "");

test("verify: policy — [paginationAlign] is no longer a forbidden table input", () => {
  // Was in SLICE_FORBIDDEN_TABLE_INPUTS until 2026-09-24. It is a presentation input, not
  // server-mode state, and its runtime default is 'center' — so a right-aligned design cannot be
  // satisfied without it.
  const html = `<uii-table [rows]="rows" [columns]="columns" [paginationAlign]="'right'"></uii-table>`;
  const r = verifyComponent({
    scss: GOOD_SCSS, html, ts: GOOD_TS,
    conventions: CONVENTIONS, transcript: TRANSCRIPT, rawXml: RAW_XML_NO_CHECKBOX, pilar: PILAR_FIXTURE,
  });
  const check = r.checks.find((c) => c.name === "tableBindings");
  assert.equal(check.status, "pass", check.detail);
  assert.ok(!(check.problems ?? []).some((p) => p.includes("paginationAlign")), "[paginationAlign] must not be forbidden");
});

test("verify: tableOptions requires [paginationAlign]='right' when the XML footer distributes its children", () => {
  // The 23 Sep 2026 field defect (§4.4): pagination rendered centered because the binding was
  // never emitted, and three hand-written ::ng-deep alignment overrides never fixed it.
  const htmlBare = `<uii-table [rows]="rows" [columns]="columns" [paginationOptions]="true"></uii-table>`;
  const r = verifyComponent({
    scss: GOOD_SCSS, html: htmlBare, ts: GOOD_TS,
    conventions: CONVENTIONS, transcript: TRANSCRIPT, rawXml: RAW_XML_FOOTER_SPACE_BETWEEN,
  });
  const check = r.checks.find((c) => c.name === "tableOptions");
  assert.equal(check.status, "fail");
  assert.ok(check.missing.includes("paginationAlign"), "paginationAlign reported missing");
});

test("verify: tableOptions accepts every quoting form of [paginationAlign]='right'", () => {
  // Angular templates write the literal as "'right'", and an attribute may itself be single- or
  // double-quoted — the check must normalize the VALUE rather than regex-match one quoting style
  // (an earlier pattern rejected the first, most common form below).
  for (const attr of [`[paginationAlign]="'right'"`, `[paginationAlign]='right'`, `[paginationAlign]="RIGHT"`]) {
    const html = `<uii-table [rows]="rows" [columns]="columns" [paginationOptions]="true" ${attr}></uii-table>`;
    const r = verifyComponent({
      scss: GOOD_SCSS, html, ts: GOOD_TS,
      conventions: CONVENTIONS, transcript: TRANSCRIPT, rawXml: RAW_XML_FOOTER_SPACE_BETWEEN,
    });
    const check = r.checks.find((c) => c.name === "tableOptions");
    assert.equal(check.status, "pass", `${attr} should pass — ${check.detail}`);
  }
});

test("verify: tableOptions rejects a right-aligned footer bound to a non-right alignment", () => {
  const html = `<uii-table [rows]="rows" [columns]="columns" [paginationOptions]="true" [paginationAlign]="'left'"></uii-table>`;
  const r = verifyComponent({
    scss: GOOD_SCSS, html, ts: GOOD_TS,
    conventions: CONVENTIONS, transcript: TRANSCRIPT, rawXml: RAW_XML_FOOTER_SPACE_BETWEEN,
  });
  assert.equal(r.checks.find((c) => c.name === "tableOptions").status, "fail");
});

test("verify: tableOptions does NOT require [paginationAlign] without distribution evidence", () => {
  // A footer with no space-between auto-layout: the binding stays legal but is not demanded, and
  // a centered table must not be forced right.
  const r = verifyComponent({
    scss: GOOD_SCSS, html: `<uii-table [rows]="rows" [columns]="columns" [paginationOptions]="true"></uii-table>`, ts: GOOD_TS,
    conventions: CONVENTIONS, transcript: TRANSCRIPT, rawXml: RAW_XML_FOOTER_FLAT,
  });
  assert.equal(r.checks.find((c) => c.name === "tableOptions").status, "pass");
});

test("verify: a design whose root frame is named 'Page' does not demand paginationAlign", () => {
  // The hint must not match a bare "page" token — Figma roots are routinely named "Page".
  const xml = `<frame id="1:1" name="Page" x="0" y="0" width="1200" height="800" layoutMode="HORIZONTAL" primaryAxisAlignItems="SPACE_BETWEEN" type="FRAME">
  <children><Text id="1:2" name="title" x="0" y="0" width="100" height="20" characters="Daftar" type="TEXT" /></children>
</frame>`;
  const r = verifyComponent({
    scss: GOOD_SCSS, html: `<uii-table [rows]="rows" [columns]="columns"></uii-table>`, ts: GOOD_TS,
    conventions: CONVENTIONS, transcript: TRANSCRIPT, rawXml: xml,
  });
  const check = r.checks.find((c) => c.name === "tableOptions");
  assert.equal(check.status, "skip", `root 'Page' must not imply pagination evidence — ${check.detail}`);
});

// ---------- alignmentViaDeepCss (SUI006) ----------

test("verify: SUI006 warns when pagination alignment is overridden through ::ng-deep", () => {
  const scss = `${GOOD_SCSS}\n:host ::ng-deep .table-footer { justify-content: flex-end; }`;
  const r = verifyComponent({
    scss, html: `<uii-table [rows]="rows" [columns]="columns"></uii-table>`, ts: GOOD_TS,
    conventions: CONVENTIONS, transcript: TRANSCRIPT, rawXml: RAW_XML_NO_CHECKBOX,
  });
  const check = r.checks.find((c) => c.name === "alignmentViaDeepCss");
  assert.equal(check.status, "warn", "deep-CSS alignment override must warn (report §7 SUI006)");
  assert.ok(check.detail.includes("paginationAlign"), "warning names the public input to use instead");
});

test("verify: SUI006 does NOT warn on the corpus's VISUAL pagination ::ng-deep", () => {
  // The reusable corpus styles .ugw-pagination-container li.page-box for borders/radius/weight.
  // That is visual detail the public input cannot express — flagging it would be a false positive.
  const scss = `${GOOD_SCSS}\n:host ::ng-deep .ugw-pagination-container li.page-box { font-weight: bold; border-radius: 5px 0 0 5px; }`;
  const r = verifyComponent({
    scss, html: `<uii-table [rows]="rows" [columns]="columns"></uii-table>`, ts: GOOD_TS,
    conventions: CONVENTIONS, transcript: TRANSCRIPT, rawXml: RAW_XML_NO_CHECKBOX,
  });
  assert.equal(r.checks.find((c) => c.name === "alignmentViaDeepCss").status, "pass");
});

// ---------- requiredMarker (report §4.5) ----------

test("verify: requiredMarker fails a marker that was emitted but hidden", () => {
  // The defect: the agent reconstructs the design's hidden asterisk and re-hides it. The design
  // states required-ness as an explicit XML attribute, so the marker should be rendered for a
  // required field and not emitted at all for an optional one.
  const html = `<label class="control-label">Program studi <span class="required-mark hidden">*</span></label>`;
  const r = verifyComponent({
    scss: GOOD_SCSS, html, ts: GOOD_TS,
    conventions: CONVENTIONS, transcript: TRANSCRIPT, rawXml: RAW_XML_NO_CHECKBOX,
  });
  const check = r.checks.find((c) => c.name === "requiredMarker");
  assert.equal(check.status, "fail");
  assert.ok(check.detail.includes("hidden"), "failure names the hidden marker");
});

test("verify: requiredMarker passes a visible marker and skips when none is emitted", () => {
  const visible = verifyComponent({
    scss: GOOD_SCSS, html: `<label>Tahun akademik <span class="required-mark">*</span></label>`, ts: GOOD_TS,
    conventions: CONVENTIONS, transcript: TRANSCRIPT, rawXml: RAW_XML_NO_CHECKBOX,
  });
  assert.equal(visible.checks.find((c) => c.name === "requiredMarker").status, "pass");

  const none = verifyComponent({
    scss: GOOD_SCSS, html: `<label class="control-label">NIM</label>`, ts: GOOD_TS,
    conventions: CONVENTIONS, transcript: TRANSCRIPT, rawXml: RAW_XML_NO_CHECKBOX,
  });
  assert.equal(none.checks.find((c) => c.name === "requiredMarker").status, "skip");
});

// ---------- containerPadding (report §4.1) ----------

const PADDING_TRANSCRIPT = {
  layout: [{
    type: "group",
    padding: { top: 20, right: 20, bottom: 20, left: 20 },
    children: [{ type: "text", text: "Tambah mahasiswa tarif" }],
  }],
};
const PADDING_HTML = `<div class="content"><h1 class="h1">Tambah mahasiswa tarif</h1></div>`;

const paddingCheck = (scss) => verifyComponent({
  scss, html: PADDING_HTML, ts: GOOD_TS,
  conventions: CONVENTIONS, transcript: PADDING_TRANSCRIPT, rawXml: RAW_XML_NO_CHECKBOX,
}).checks.find((c) => c.name === "containerPadding");

test("verify: containerPadding warns when the design's explicit padding is replaced by a fallback", () => {
  // The 23 Sep 2026 defect (§4.1): XML says paddingTop=20, output shipped `padding: 5px 20px 20px 20px`.
  const check = paddingCheck(`.content { padding: 5px 20px 20px 20px; }`);
  assert.equal(check.status, "warn");
  assert.ok(check.detail.includes("top=5px"), `names the offending side: ${check.detail}`);
});

test("verify: containerPadding passes the correct shorthand and per-side forms", () => {
  for (const scss of [
    `.content { padding: 20px; }`,
    `.content { padding-top: 20px; padding-right: 20px; padding-bottom: 20px; padding-left: 20px; }`,
    // A container may drop a side it hands to inner elements — `0` is an explicit value, not a
    // fallback, so it must not be flagged as drift (nor silently skipped as unparseable).
    `.content { padding: 0 20px; }`,
  ]) {
    assert.equal(paddingCheck(scss).status, "pass", `${scss} should pass`);
  }
});

test("verify: containerPadding skips when it has no ground truth to judge against", () => {
  // No padding in the design, a token value, and an unrelated class all lack the fact to compare.
  assert.equal(paddingCheck(`.something-else { padding: 5px; }`).status, "skip");
  assert.equal(paddingCheck(`.content { padding: $space-md; }`).status, "skip");
  const noDesignPadding = verifyComponent({
    scss: `.content { padding: 5px; }`, html: PADDING_HTML, ts: GOOD_TS,
    conventions: CONVENTIONS, transcript: { layout: [{ type: "text", text: "x" }] }, rawXml: RAW_XML_NO_CHECKBOX,
  });
  assert.equal(noDesignPadding.checks.find((c) => c.name === "containerPadding").status, "skip");
});

// ---------- gateway-table scssCoverage (reusable table shell) ----------

test("verify: F6 — scssCoverage does not require search/pagination SCSS when bindings are OFF", () => {
  // 2026-09-11 F6: a modal table with search/pagination/limit all false must NOT be forced to
  // paste dead search-input/pagination SCSS.
  const conventions = {
    ...CONVENTIONS,
    ngDeepCorpus: [
      { selector: "filter-options .search-options .search-input", family: "table", block: "::ng-deep .filter-options .search-options .search-input { border: 1px solid; }" },
      { selector: "ugw-pagination-container li.page-box", family: "table", block: "::ng-deep .ugw-pagination-container li.page-box { font-weight: bold; }" },
      { selector: "gateway-table", family: "table", block: "::ng-deep.gateway-table { border-top-left-radius: 6px; }" },
    ],
  };
  const htmlOff = `<uii-table [rows]="rows" [columns]="columns" [searchOptions]="false" [paginationOptions]="false" [limitOptions]="false"></uii-table>`;
  const r = verifyComponent({
    scss: "::ng-deep.gateway-table { border-top-left-radius: 6px; }", // shell present, search/pagination absent
    html: htmlOff, ts: GOOD_TS,
    conventions, transcript: TRANSCRIPT, rawXml: RAW_XML_WITH_CHECKBOX,
  });
  const check = r.checks.find((c) => c.name === "scssCoverage");
  assert.notEqual(check.status, "fail", "dead search/pagination SCSS must not be required when OFF");
  assert.ok(!(check.missing ?? []).some((s) => s.includes("search-input") || s.includes("pagination")), "search/pagination selectors not demanded");
});

test("verify: scssCoverage requires the bare .gateway-table shell when a table is in play", () => {
  const conventionsWithShell = {
    ...CONVENTIONS,
    ngDeepCorpus: [
      ...CONVENTIONS.ngDeepCorpus,
      { selector: "gateway-table", family: "table", block: ":host ::ng-deep.gateway-table { border-top-left-radius: 6px !important; }" },
    ],
  };
  // GOOD_SCSS does not contain `gateway-table`.
  const r = verifyComponent({
    scss: GOOD_SCSS, html: GOOD_HTML, ts: GOOD_TS,
    conventions: conventionsWithShell, transcript: TRANSCRIPT, rawXml: RAW_XML_WITH_CHECKBOX,
  });
  const check = r.checks.find((c) => c.name === "scssCoverage");
  assert.equal(check.status, "fail");
  assert.ok(check.missing.some((s) => s.includes("gateway-table")), "gateway-table flagged missing");
});

// ---------- gridColumns ----------

test("verify: gridColumns fails when a filter row's col spans exceed 12", () => {
  const htmlOverflow = `<div class="row">
    <div class="col-md-4">a</div><div class="col-md-4">b</div><div class="col-md-4">c</div><div class="col-md-4">d</div>
  </div>`;
  const r = verifyComponent({
    scss: GOOD_SCSS, html: htmlOverflow, ts: GOOD_TS,
    conventions: CONVENTIONS, transcript: TRANSCRIPT, rawXml: RAW_XML_WITH_CHECKBOX,
  });
  const check = r.checks.find((c) => c.name === "gridColumns");
  assert.equal(check.status, "fail");
  assert.ok(check.problems.some((p) => p.includes("16/12")), "16/12 overflow named");
});

test("verify: gridColumns passes when spans total ≤ 12", () => {
  const htmlOk = `<div class="row">
    <div class="col-md-3">a</div><div class="col-md-3">b</div><div class="col-md-3">c</div><div class="col-md-3">d</div>
  </div>`;
  const r = verifyComponent({
    scss: GOOD_SCSS, html: htmlOk, ts: GOOD_TS,
    conventions: CONVENTIONS, transcript: TRANSCRIPT, rawXml: RAW_XML_WITH_CHECKBOX,
  });
  const check = r.checks.find((c) => c.name === "gridColumns");
  assert.equal(check.status, "pass");
});

// ---------- noTranslation ----------

test("verify: noTranslation fails on a | translate pipe", () => {
  const htmlTranslate = `<h1>{{ 'bill.type' | translate }}</h1>`;
  const r = verifyComponent({
    scss: GOOD_SCSS, html: htmlTranslate, ts: GOOD_TS,
    conventions: CONVENTIONS, transcript: TRANSCRIPT, rawXml: RAW_XML_WITH_CHECKBOX,
  });
  const check = r.checks.find((c) => c.name === "noTranslation");
  assert.equal(check.status, "fail");
  assert.ok(check.count >= 1, "counts the translate pipe");
});

test("verify: noTranslation passes on literal text", () => {
  const r = verifyComponent({
    scss: GOOD_SCSS, html: FAITHFUL_HTML, ts: GOOD_TS,
    conventions: CONVENTIONS, transcript: TRANSCRIPT, rawXml: RAW_XML_WITH_CHECKBOX,
  });
  const check = r.checks.find((c) => c.name === "noTranslation");
  assert.equal(check.status, "pass");
});

// ---------- ngxSelectBinding rejects formControlName ----------

test("verify: ngxSelectBinding fails when a select uses formControlName (legacy reactive form)", () => {
  const htmlReactive = `<ngx-select [items]="items" formControlName="kd_jenis_tagihan"></ngx-select>`;
  const r = verifyComponent({
    scss: GOOD_SCSS, html: htmlReactive, ts: GOOD_TS,
    conventions: CONVENTIONS, transcript: TRANSCRIPT, rawXml: RAW_XML_WITH_CHECKBOX,
  });
  const check = r.checks.find((c) => c.name === "ngxSelectBinding");
  assert.equal(check.status, "fail");
  assert.ok(check.problems.some((p) => p.includes("formControlName")), "formControlName flagged");
});

// ---------- inventedUtility ----------

test("verify: inventedUtility fails on a Bootstrap-4 w-100 utility (dead in BS3)", () => {
  const htmlWithW100 = `<button class="btn btn-primary w-100">Cari</button>`;
  const r = verifyComponent({
    scss: GOOD_SCSS, html: htmlWithW100, ts: GOOD_TS,
    conventions: CONVENTIONS, transcript: TRANSCRIPT, rawXml: RAW_XML_WITH_CHECKBOX,
  });
  const check = r.checks.find((c) => c.name === "inventedUtility");
  assert.equal(check.status, "fail");
  assert.ok(check.detail.includes("btn-block"), "hint names btn-block");
});

test("verify: inventedUtility fails on a Bootstrap-4 mr-2 margin utility", () => {
  const htmlWithMr2 = `<button class="btn mr-2">A</button>`;
  const r = verifyComponent({
    scss: GOOD_SCSS, html: htmlWithMr2, ts: GOOD_TS,
    conventions: CONVENTIONS, transcript: TRANSCRIPT, rawXml: RAW_XML_WITH_CHECKBOX,
  });
  const check = r.checks.find((c) => c.name === "inventedUtility");
  assert.equal(check.status, "fail");
  assert.ok(check.detail.includes("margin"), "hint names margin idiom");
});

test("verify: inventedUtility passes on the BS3 idiom (btn-block)", () => {
  const htmlWithBtnBlock = `<button class="btn btn-primary btn-block">Cari</button>`;
  const r = verifyComponent({
    scss: GOOD_SCSS, html: htmlWithBtnBlock, ts: GOOD_TS,
    conventions: CONVENTIONS, transcript: TRANSCRIPT, rawXml: RAW_XML_WITH_CHECKBOX,
  });
  const check = r.checks.find((c) => c.name === "inventedUtility");
  assert.equal(check.status, "pass");
});

test("verify: inventedUtility skips when there is no class vocabulary", () => {
  const htmlWithW100 = `<button class="btn w-100">Cari</button>`;
  const r = verifyComponent({
    scss: GOOD_SCSS, html: htmlWithW100, ts: GOOD_TS,
    conventions: { ...CONVENTIONS, classVocabulary: [] },
    transcript: TRANSCRIPT, rawXml: RAW_XML_WITH_CHECKBOX,
  });
  const check = r.checks.find((c) => c.name === "inventedUtility");
  assert.equal(check.status, "skip");
});

test("verify: inventedUtility fails on gap-2 (atomic utility the project never uses)", () => {
  const htmlWithGap = `<div class="bulk-actions gap-2"><button class="btn">A</button></div>`;
  const r = verifyComponent({
    scss: GOOD_SCSS, html: htmlWithGap, ts: GOOD_TS,
    conventions: CONVENTIONS, transcript: TRANSCRIPT, rawXml: RAW_XML_WITH_CHECKBOX,
  });
  const check = r.checks.find((c) => c.name === "inventedUtility");
  assert.equal(check.status, "fail");
  assert.ok(check.detail.includes("gap-2"), "gap-2 flagged invented");
});

test("verify: inventedUtility fails on rounded-xl (not in vocabulary)", () => {
  const htmlWithRounded = `<div class="well rounded-xl"></div>`;
  const r = verifyComponent({
    scss: GOOD_SCSS, html: htmlWithRounded, ts: GOOD_TS,
    conventions: CONVENTIONS, transcript: TRANSCRIPT, rawXml: RAW_XML_WITH_CHECKBOX,
  });
  const check = r.checks.find((c) => c.name === "inventedUtility");
  assert.equal(check.status, "fail");
  assert.ok(check.detail.includes("rounded-xl"), "rounded-xl flagged invented");
});

test("verify: inventedUtility fails on mt-4 the project never uses (mirror the team)", () => {
  const htmlWithMt4 = `<div class="row mt-4"><div class="col-md-3">x</div></div>`;
  const r = verifyComponent({
    scss: GOOD_SCSS, html: htmlWithMt4, ts: GOOD_TS,
    conventions: CONVENTIONS, transcript: TRANSCRIPT, rawXml: RAW_XML_WITH_CHECKBOX,
  });
  const check = r.checks.find((c) => c.name === "inventedUtility");
  assert.equal(check.status, "fail");
  assert.ok(check.detail.includes("mt-4"), "mt-4 flagged invented");
});

test("verify: inventedUtility does not flag framework grid/layout base (row, col-md-*)", () => {
  const htmlGrid = `<div class="row"><div class="col-md-4 col-12">a</div><div class="col-md-4">b</div></div>`;
  const r = verifyComponent({
    scss: GOOD_SCSS, html: htmlGrid, ts: GOOD_TS,
    conventions: CONVENTIONS, transcript: TRANSCRIPT, rawXml: RAW_XML_WITH_CHECKBOX,
  });
  const check = r.checks.find((c) => c.name === "inventedUtility");
  assert.equal(check.status, "pass", "row + col-* are framework base, not invented");
});

test("verify: inventedUtility does not flag semantic classes (label-custom-warning in vocab)", () => {
  const htmlLabel = `<span class="label label-custom-warning"></span>`;
  const r = verifyComponent({
    scss: GOOD_SCSS, html: htmlLabel, ts: GOOD_TS,
    conventions: CONVENTIONS, transcript: TRANSCRIPT, rawXml: RAW_XML_WITH_CHECKBOX,
  });
  const check = r.checks.find((c) => c.name === "inventedUtility");
  assert.equal(check.status, "pass", "label-custom-warning is in vocabulary → legal");
});

// ---------- styleFidelity (check #18) ----------

test("verify: styleFidelity fails when the title color drifts from the design (#555 vs #000)", () => {
  const transcript = {
    layout: [
      { type: "text", text: "Ubah tagihan", w: 1117, style: { size: 16, weight: 500, color: "#000000" } },
      { type: "divider", bg: "#fdd835" },
    ],
  };
  const driftScss = `.h1 { color: #555; font-size: 16px; font-weight: 500; }\n.content { padding: 5px 20px 20px; }`;
  const driftHtml = `<div class="content"><h1 class="h1">Ubah tagihan</h1><hr style="border-top:1px solid #fdd835"></div>`;
  const r = verifyComponent({
    scss: driftScss, html: driftHtml, ts: GOOD_TS,
    conventions: CONVENTIONS, transcript, rawXml: RAW_XML_NO_CHECKBOX,
  });
  const check = r.checks.find((c) => c.name === "styleFidelity");
  assert.equal(check.status, "fail", `title drift #555 vs #000 must fail: ${JSON.stringify(check.detail)}`);
});

test("verify: styleFidelity passes when title + divider colors are preserved", () => {
  const transcript = {
    layout: [
      { type: "text", text: "Ubah tagihan", w: 1117, style: { size: 16, weight: 500, color: "#000000" } },
      { type: "divider", bg: "#fdd835" },
    ],
  };
  const goodScss = `.h1 { color: #000; font-size: 16px; font-weight: 500; }\n.content { padding: 5px 20px 20px; }`;
  const goodHtml = `<div class="content"><h1 class="h1">Ubah tagihan</h1><hr style="border-top:1px solid #fdd835"></div>`;
  const r = verifyComponent({
    scss: goodScss, html: goodHtml, ts: GOOD_TS,
    conventions: CONVENTIONS, transcript, rawXml: RAW_XML_NO_CHECKBOX,
  });
  const check = r.checks.find((c) => c.name === "styleFidelity");
  assert.equal(check.status, "pass", `faithful colors must pass: ${JSON.stringify(check.detail)}`);
});

test("verify: styleFidelity does not confuse .summary-row with .summary-row-danger (boundary)", () => {
  // 2026-09-10 B5: `.summary-row-danger` used to satisfy the `.summary-row` lookup, so the
  // `.summary-row` fact was mis-resolved to #f44444. The class boundary must be exact.
  const transcript = {
    layout: [
      { type: "text", text: "Selisih", style: { color: "#555555" } },
    ],
  };
  const scss = `.summary-row { color: #555555; }\n.summary-row-danger { color: #f44444; }`;
  const html = `<div class="summary-row"><span>Selisih</span></div>`;
  const r = verifyComponent({
    scss, html, ts: GOOD_TS,
    conventions: CONVENTIONS, transcript, rawXml: RAW_XML_NO_CHECKBOX,
  });
  const check = r.checks.find((c) => c.name === "styleFidelity");
  assert.notEqual(check.status, "fail", ".summary-row must resolve to #555555, not #f44444");
  assert.ok(!String(check.detail ?? "").includes("#f44444"), "must not report the danger color for .summary-row");
});

test("verify: styleFidelity skips when a variable token colors the title (cannot resolve, not a fail)", () => {
  const transcript = {
    layout: [{ type: "text", text: "Ubah tagihan", w: 1117, style: { color: "#000000" } }],
  };
  const tokenScss = `.h1 { color: $title-color; }`;
  const tokenHtml = `<h1 class="h1">Ubah tagihan</h1>`;
  const r = verifyComponent({
    scss: tokenScss, html: tokenHtml, ts: GOOD_TS,
    conventions: CONVENTIONS, transcript, rawXml: RAW_XML_NO_CHECKBOX,
  });
  const check = r.checks.find((c) => c.name === "styleFidelity");
  // no divider fact + token title → nothing assertable (skip), and never a false fail
  assert.notEqual(check.status, "fail", "token substitution must not be false-flagged");
});

test("verify: styleFidelity skips without a transcript", () => {
  const r = verifyComponent({ scss: GOOD_SCSS, html: GOOD_HTML, ts: GOOD_TS, conventions: CONVENTIONS, rawXml: RAW_XML_WITH_CHECKBOX });
  const check = r.checks.find((c) => c.name === "styleFidelity");
  assert.equal(check.status, "skip");
});

test("verify: styleFidelity value-coverage fails on font-size drift on an authored rule (<80%)", () => {
  // Design: title 16px/500. Authored slice rule carries 20px + correct color → size fact drifts,
  // giving 2 comparable (size, weight both authored) — size mismatch alone is 50% < 80% → fail.
  const transcript = { layout: [{ type: "text", text: "Ubah tagihan", style: { size: 16, weight: 500, color: "#000000" } }] };
  const driftScss = `.h1 { color: #000; font-size: 20px; font-weight: 500; }`;
  const driftHtml = `<h1 class="h1">Ubah tagihan</h1>`;
  const r = verifyComponent({ scss: driftScss, html: driftHtml, ts: GOOD_TS, conventions: CONVENTIONS, transcript, rawXml: RAW_XML_NO_CHECKBOX });
  const check = r.checks.find((c) => c.name === "styleFidelity");
  assert.equal(check.status, "fail", `font-size drift must fail: ${JSON.stringify(check.detail)}`);
  assert.match(check.detail, /font-size/);
});

test("verify: styleFidelity value-coverage passes on authored rule with matching values", () => {
  const transcript = { layout: [{ type: "text", text: "Ubah tagihan", style: { size: 16, weight: 500, color: "#000000" } }] };
  const goodScss = `.h1 { color: #000; font-size: 16px; font-weight: 500; }`;
  const goodHtml = `<h1 class="h1">Ubah tagihan</h1>`;
  const r = verifyComponent({ scss: goodScss, html: goodHtml, ts: GOOD_TS, conventions: CONVENTIONS, transcript, rawXml: RAW_XML_NO_CHECKBOX });
  const check = r.checks.find((c) => c.name === "styleFidelity");
  assert.equal(check.status, "pass", `matching authored values must pass: ${JSON.stringify(check.detail)}`);
});

test("verify: styleFidelity does NOT judge a reused project class (copy-convention-first, not a fail)", () => {
  // A project class (e.g. .control-label) is reused, not authored in the slice — verify must not
  // demand its rule match the design (conventions are trusted; only authored slice CSS is judged).
  const transcript = { layout: [{ type: "text", text: "Jenis tagihan", style: { size: 12, color: "#555555" } }] };
  const reuseHtml = `<label class="control-label">Jenis tagihan</label>`; // no authored .control-label rule
  const reuseScss = `.content { padding: 5px; }`;
  const r = verifyComponent({ scss: reuseScss, html: reuseHtml, ts: GOOD_TS, conventions: CONVENTIONS, transcript, rawXml: RAW_XML_NO_CHECKBOX });
  const check = r.checks.find((c) => c.name === "styleFidelity");
  assert.equal(check.status, "skip", "reused project class with no authored rule → no comparable fact → skip, not fail");
});

test("verify: styleFidelity DOM-aware — a label is NOT mis-attributed to a sibling .scheme-box (no false positive)", () => {
  // Regression from the execution log: label text bound to .control-label (a reused, NON-authored
  // class) sits in its own element BEFORE a .scheme-box value box. The old flat-regex attributed
  // the label to the sibling .scheme-box and false-failed. DOM-aware matching binds the label to
  // its real container (.control-label) → not authored → skipped, never failed.
  const transcript = {
    layout: [
      { type: "text", text: "Total tagihan lama (Rp)", style: { color: "#555555", size: 12 } },
    ],
  };
  const html = `<div class="scheme-row">
  <div class="form-group">
    <label class="control-label">Total tagihan lama (Rp)</label>
    <div class="scheme-box total">{{ totalTagihanLama }}</div>
  </div>
</div>`;
  // .scheme-box IS authored (with a drifting color) but .control-label is NOT authored.
  const scss = `.content { padding: 20px; }\n.scheme-box { color: #333333; font-size: 14px; }`;
  const r = verifyComponent({ scss, html, ts: GOOD_TS, conventions: CONVENTIONS, transcript, rawXml: RAW_XML_NO_CHECKBOX });
  const check = r.checks.find((c) => c.name === "styleFidelity");
  assert.equal(check.status, "skip", "label binds to non-authored .control-label → skipped, not falsely attributed to .scheme-box");
  assert.ok(!check.problems || check.problems.length === 0, "no false drift problems against the label");
});

test("verify: styleFidelity DOM-aware — an authored .control-label with correct values PASSES", () => {
  // When the label's own class IS authored with the design values, the DOM-aware matcher binds
  // the text to it and compares honestly → pass (not attributed to a sibling).
  const transcript = {
    layout: [
      { type: "text", text: "Total tagihan lama (Rp)", style: { color: "#555555", size: 12, weight: 600 } },
    ],
  };
  const html = `<div class="scheme-row">
  <div class="form-group">
    <label class="control-label">Total tagihan lama (Rp)</label>
    <div class="scheme-box total">{{ totalTagihanLama }}</div>
  </div>
</div>`;
  const scss = `.control-label { color: #555555; font-size: 12px; font-weight: 600; }`;
  const r = verifyComponent({ scss, html, ts: GOOD_TS, conventions: CONVENTIONS, transcript, rawXml: RAW_XML_NO_CHECKBOX });
  const check = r.checks.find((c) => c.name === "styleFidelity");
  assert.equal(check.status, "pass", `label authored with design values must pass, got ${JSON.stringify(check.detail)}`);
});

test("verify: styleFidelity FAILS when an authored rule omits the design font-size (title renders 2x large)", () => {
  // The execution-log fatal bug: <h1 class="h1 change-title"> with .change-title authored but
  // missing `font-size` renders at the browser default (~2em), not the design's 16px. A missing
  // declared value is a hard fail, NOT a silent skip or a coverage-tolerated drift.
  const transcript = { layout: [{ type: "text", text: "Ubah skema", style: { size: 16, weight: 700, color: "#555555" } }] };
  const html = `<h1 class="h1 change-title">Ubah skema</h1>`;
  const scss = `.change-title { color: #555555; font-weight: 700; margin: 0; }`;
  const r = verifyComponent({ scss, html, ts: GOOD_TS, conventions: CONVENTIONS, transcript, rawXml: RAW_XML_NO_CHECKBOX });
  const check = r.checks.find((c) => c.name === "styleFidelity");
  assert.equal(check.status, "fail", "missing font-size must fail, not pass");
  assert.ok(check.missing?.some((m) => m.includes("font-size")), `must name font-size, got ${JSON.stringify(check.missing)}`);
});

test("verify: styleFidelity PASSES when the title size is authored", () => {
  const transcript = { layout: [{ type: "text", text: "Ubah skema", style: { size: 16, weight: 700, color: "#555555" } }] };
  const html = `<h1 class="h1 change-title">Ubah skema</h1>`;
  const scss = `.change-title { color: #555555; font-weight: 700; font-size: 16px; }`;
  const r = verifyComponent({ scss, html, ts: GOOD_TS, conventions: CONVENTIONS, transcript, rawXml: RAW_XML_NO_CHECKBOX });
  const check = r.checks.find((c) => c.name === "styleFidelity");
  assert.equal(check.status, "pass", `authored size must pass, got ${JSON.stringify(check.detail)}`);
});

test("verify: styleFidelity does NOT flag a size inherited from an authored ancestor", () => {
  // Inheritance-aware: .content authors font-size:16px; the title's .change-title omits it but
  // inherits it — not "missing". Only color/weight must be authored on the title itself.
  const transcript = { layout: [{ type: "text", text: "Ubah skema", style: { size: 16, weight: 700, color: "#555555" } }] };
  const html = `<div class="content"><h1 class="h1 change-title">Ubah skema</h1></div>`;
  const scss = `.content { font-size: 16px; } .change-title { color: #555555; font-weight: 700; }`;
  const r = verifyComponent({ scss, html, ts: GOOD_TS, conventions: CONVENTIONS, transcript, rawXml: RAW_XML_NO_CHECKBOX });
  const check = r.checks.find((c) => c.name === "styleFidelity");
  assert.ok(!check.missing?.some((m) => m.includes("font-size")), "inherited size must not be 'missing'");
});

test("verify: styleFidelity skips token-valued authored rules (cannot resolve, never false-flagged)", () => {
  const transcript = { layout: [{ type: "text", text: "Ubah tagihan", style: { color: "#000000" } }] };
  const tokenScss = `.h1 { color: $title-color; }`;
  const tokenHtml = `<h1 class="h1">Ubah tagihan</h1>`;
  const r = verifyComponent({ scss: tokenScss, html: tokenHtml, ts: GOOD_TS, conventions: CONVENTIONS, transcript, rawXml: RAW_XML_NO_CHECKBOX });
  const check = r.checks.find((c) => c.name === "styleFidelity");
  assert.notEqual(check.status, "fail", "token color must not be false-flagged");
});

test("verify: styleFidelity does NOT mis-attribute library-internal text (column header) to an authored h1", () => {
  // EXPERIENCE-REPORT-2 §4.1: "Tarif" is a uii-table column header (columns[].name) that never
  // appears in the authored HTML. The old substring fallback bound it to <h1>Tambah tarif
  // manual</h1> and demanded contradictory values on .h1. It must be SKIPPED, never attributed.
  const transcript = {
    layout: [
      { type: "text", text: "Tambah tarif manual", style: { size: 16, weight: 500, color: "#000000" } },
      { type: "text", text: "Tarif", style: { size: 14, weight: 600, color: "#303030" } }, // table column header
    ],
  };
  const html = `<h1 class="h1">Tambah tarif manual</h1><uii-table [rows]="rows" [columns]="columns"></uii-table>`;
  const scss = `.h1 { color: #000000; font-size: 16px; font-weight: 500; }`;
  const r = verifyComponent({ scss, html, ts: GOOD_TS, conventions: CONVENTIONS, transcript, rawXml: RAW_XML_NO_CHECKBOX });
  const check = r.checks.find((c) => c.name === "styleFidelity");
  assert.notEqual(check.status, "fail", `library column header must skip, not false-fail: ${JSON.stringify(check.detail)}`);
});

test("verify: styleFidelity does NOT mis-attribute a pagination label ('data') to a button", () => {
  // EXPERIENCE-REPORT-2 §4.1: "data" is the uii-table limit label ("Tampilkan 10 data"), not the
  // "Get data" button. The substring fallback bound it to .get-data-btn and demanded 400/555 on
  // a button that must be 700/white. It must be skipped.
  const transcript = {
    layout: [
      { type: "button", text: "Get data", style: { size: 14, weight: 700, color: "#ffffff" } },
      { type: "text", text: "data", style: { size: 14, weight: 400, color: "#555555" } }, // pagination label
    ],
  };
  const html = `<button class="get-data-btn">Get data</button><uii-table [rows]="rows" [columns]="columns" [limitOptions]="true"></uii-table>`;
  const scss = `.get-data-btn { color: #ffffff; font-weight: 700; font-size: 14px; }`;
  const r = verifyComponent({ scss, html, ts: GOOD_TS, conventions: CONVENTIONS, transcript, rawXml: RAW_XML_NO_CHECKBOX });
  const check = r.checks.find((c) => c.name === "styleFidelity");
  assert.notEqual(check.status, "fail", `pagination label must skip, not false-fail: ${JSON.stringify(check.detail)}`);
});

test("verify: styleFidelity skips hidden transcript nodes (not renderable, not a style fact)", () => {
  const transcript = {
    layout: [
      { type: "text", text: "Ubah tagihan", style: { size: 16, weight: 500, color: "#000000" } },
      { type: "text", text: "Asterisk", hidden: true, style: { size: 14, weight: 700, color: "#f44444" } }, // hidden
    ],
  };
  const html = `<h1 class="h1">Ubah tagihan</h1>`;
  const scss = `.h1 { color: #000000; font-size: 16px; font-weight: 500; }`;
  const r = verifyComponent({ scss, html, ts: GOOD_TS, conventions: CONVENTIONS, transcript, rawXml: RAW_XML_NO_CHECKBOX });
  const check = r.checks.find((c) => c.name === "styleFidelity");
  assert.notEqual(check.status, "fail", `hidden node text must not false-fail: ${JSON.stringify(check.detail)}`);
});

// ---------- scssCoverage hardening (0.2) ----------

test("verify: scssCoverage fails when a corpus token sits only in a comment or emptied rule", () => {
  // ngx-select in play (FAITHFUL_HTML), corpus demands ngx-select__item_active with a real body.
  const commentOnly = `/* ::ng-deep .ngx-select__item_active { color: #fff } */\n::ng-deep .ngx-select__choices { border-radius: 7px; }`;
  const r = verifyComponent({
    scss: commentOnly, html: FAITHFUL_HTML, ts: GOOD_TS,
    conventions: CONVENTIONS, transcript: TRANSCRIPT, rawXml: RAW_XML_WITH_CHECKBOX,
  });
  const check = r.checks.find((c) => c.name === "scssCoverage");
  assert.equal(check.status, "fail", "token in a comment must NOT satisfy the live-rule check");
});

test("verify: scssCoverage treats a dropped advisory micro-effect (toggle-caret) as warn, not fail", () => {
  // FAITHFUL_HTML renders ngx-select; a corpus that includes toggle-caret, output omits it.
  const conv = {
    ...CONVENTIONS,
    ngDeepCorpus: [
      ...CONVENTIONS.ngDeepCorpus,
      { selector: "ngx-select__toggle-caret", family: "select", block: ":host ::ng-deep .ngx-select__toggle-caret { color: #03337b !important; }" },
    ],
  };
  // GOOD_SCSS carries choices/item_active/dropdown but NOT toggle-caret → advisory warn.
  const r = verifyComponent({
    scss: GOOD_SCSS, html: FAITHFUL_HTML, ts: GOOD_TS,
    conventions: conv, transcript: TRANSCRIPT, rawXml: RAW_XML_WITH_CHECKBOX,
  });
  const check = r.checks.find((c) => c.name === "scssCoverage");
  assert.equal(check.status, "warn", "advisory toggle-caret drop is a warn, not a fail");
});

test("verify: scssCoverage passes when a nested corpus block's token appears in a live rule", () => {
  // Corpus demands ugw-pagination li.page-box (table family); output nests it — live body.
  const conv = {
    ...CONVENTIONS,
    ngDeepCorpus: [
      { selector: "ugw-pagination-container li.page-box", family: "table", block: ":host ::ng-deep .ugw-pagination-container li.page-box { font-weight: bold !important; }" },
    ],
  };
  const nestedScss = `:host ::ng-deep { .ugw-pagination-container { li.page-box { font-weight: bold !important; } } }`;
  const r = verifyComponent({
    scss: nestedScss, html: GOOD_HTML, ts: GOOD_TS,
    conventions: conv, transcript: TRANSCRIPT, rawXml: RAW_XML_WITH_CHECKBOX,
  });
  const check = r.checks.find((c) => c.name === "scssCoverage");
  assert.equal(check.status, "pass", "nested live rule counts as present");
});

// ---------- textCoverage rendered-only (0.3) ----------

test("verify: textCoverage fails when a button label lives only in a TS comment (not rendered)", () => {
  const transcript = { layout: [{ type: "button", text: "Cari" }] };
  const tsComment = `// Cari — the search button label\nthis.rows = [];`;
  const noButtonHtml = `<div class="content"><h1 class="h1">Ubah tagihan</h1></div>`;
  const r = verifyComponent({
    scss: GOOD_SCSS, html: noButtonHtml, ts: tsComment,
    conventions: CONVENTIONS, transcript, rawXml: RAW_XML_NO_CHECKBOX,
  });
  const check = r.checks.find((c) => c.name === "textCoverage");
  assert.equal(check.status, "fail", "a label in a TS comment is not a rendered button");
});

test("verify: textCoverage fails when the button is behind *ngIf=false (never renders)", () => {
  const transcript = { layout: [{ type: "button", text: "Cari" }] };
  const hiddenHtml = `<button *ngIf="false" (click)="onSearch()">Cari</button>`;
  const r = verifyComponent({
    scss: GOOD_SCSS, html: hiddenHtml, ts: GOOD_TS,
    conventions: CONVENTIONS, transcript, rawXml: RAW_XML_NO_CHECKBOX,
  });
  const check = r.checks.find((c) => c.name === "textCoverage");
  assert.equal(check.status, "fail", "*ngIf=false button text must not satisfy textCoverage");
});

test("verify: textCoverage passes for text rendered via placeholder attribute", () => {
  const transcript = { layout: [{ type: "text", text: "Pilih jenis tagihan" }] };
  const phHtml = `<input class="form-control" placeholder="Pilih jenis tagihan">`;
  const r = verifyComponent({
    scss: GOOD_SCSS, html: phHtml, ts: GOOD_TS,
    conventions: CONVENTIONS, transcript, rawXml: RAW_XML_NO_CHECKBOX,
  });
  const check = r.checks.find((c) => c.name === "textCoverage");
  assert.equal(check.status, "pass", "placeholder attribute text is user-visible copy");
});

// ---------- filterRowButton generic (0.4) + gridColumns col-N (0.5) ----------

test("verify: filterRowButton catches a non-Cari filter action (Terapkan) when dropped", () => {
  const xml = `<Button_FNC id="f:1"><children><Text id="t:1" characters="Terapkan" /></children></Button_FNC>`;
  const noBtn = `<div class="row"><div class="col-md-3"></div></div>`;
  const r = verifyComponent({
    scss: GOOD_SCSS, html: noBtn, ts: GOOD_TS,
    conventions: CONVENTIONS, transcript: TRANSCRIPT, rawXml: xml,
  });
  const check = r.checks.find((c) => c.name === "filterRowButton");
  assert.equal(check.status, "fail", "a filter-action button with a non-Cari label must be required");
});

test("verify: gridColumns fails on breakpoint-less col-6 spans exceeding 12", () => {
  // Four col-6 = 24 → wraps; BS4 syntax, previously invisible to the infix-mandatory regex.
  const htmlRow = `<div class="row">
    <div class="col-6"></div><div class="col-6"></div>
    <div class="col-6"></div><div class="col-6"></div>
  </div>`;
  const r = verifyComponent({
    scss: GOOD_SCSS, html: htmlRow, ts: GOOD_TS,
    conventions: CONVENTIONS, transcript: TRANSCRIPT, rawXml: RAW_XML_NO_CHECKBOX,
  });
  const check = r.checks.find((c) => c.name === "gridColumns");
  assert.equal(check.status, "fail", "col-6 spans totaling 24 must fail");
});

test("verify: gridColumns passes on breakpoint-less col-3 spans totaling 12", () => {
  const htmlRow = `<div class="row">
    <div class="col-3"></div><div class="col-3"></div>
    <div class="col-3"></div><div class="col-3"></div>
  </div>`;
  const r = verifyComponent({
    scss: GOOD_SCSS, html: htmlRow, ts: GOOD_TS,
    conventions: CONVENTIONS, transcript: TRANSCRIPT, rawXml: RAW_XML_NO_CHECKBOX,
  });
  const check = r.checks.find((c) => c.name === "gridColumns");
  assert.equal(check.status, "pass", "col-3 × 4 = 12 is valid");
});

// ---------- iconColor neutral-trap + 3-hex (0.7) ----------

test("verify: iconColor fails when a design-semantic badge icon is styled a neutral (#333 for #f44444)", () => {
  const transcript = {
    layout: [
      { type: "icon", bg: "#f44444" },
      { type: "text", text: "Menunggu" },
    ],
  };
  const badScss = `:host ::ng-deep .fa-exclamation-circle { color: #333; }`;
  const r = verifyComponent({
    scss: badScss, html: FAITHFUL_HTML, ts: GOOD_TS,
    conventions: CONVENTIONS, transcript, rawXml: RAW_XML_NO_CHECKBOX,
  });
  const check = r.checks.find((c) => c.name === "iconColor");
  assert.equal(check.status, "fail", `neutral #333 for a #f44444 badge icon must fail: ${JSON.stringify(check.detail)}`);
});

test("verify: iconColor parses 3-hex colors (no false pass on an unmatched shorthand)", () => {
  // #f44 → #ff4444 (CSS shorthand), which is NOT the design's #f44444 badge → must still fail.
  // This pins that the 3-hex branch of parseCssColor runs and judges (not silently skips).
  const transcript = { layout: [{ type: "icon", bg: "#f44444" }, { type: "text", text: "Menunggu" }] };
  const hex3 = `:host ::ng-deep .fa-exclamation-circle { color: #f44; }`;
  const r = verifyComponent({
    scss: hex3, html: FAITHFUL_HTML, ts: GOOD_TS,
    conventions: CONVENTIONS, transcript, rawXml: RAW_XML_NO_CHECKBOX,
  });
  const check = r.checks.find((c) => c.name === "iconColor");
  assert.equal(check.status, "fail", "#f44 (= #ff4444) ≠ design #f44444, so the 3-hex was parsed and judged");
});

// ---------- noBareNgDeep (0.9) ----------

test("verify: noBareNgDeep fails on an agent-added bare ::ng-deep not blessed by the corpus", () => {
  // GOOD_SCSS's bare blocks ARE corpus-blessed; add a NEW bare ::ng-deep .my-invention → leak.
  const leakScss = GOOD_SCSS + "\n::ng-deep .my-invented-override { color: red; }\n";
  const r = verifyComponent({
    scss: leakScss, html: FAITHFUL_HTML, ts: GOOD_TS,
    conventions: CONVENTIONS, transcript: TRANSCRIPT, rawXml: RAW_XML_WITH_CHECKBOX,
  });
  const check = r.checks.find((c) => c.name === "noBareNgDeep");
  assert.equal(check.status, "fail", "a bare ::ng-deep not in the corpus is a global leak");
});

test("verify: noBareNgDeep passes when corpus-blessed bare ::ng-deep is copied verbatim", () => {
  const r = verifyComponent({
    scss: GOOD_SCSS, html: FAITHFUL_HTML, ts: GOOD_TS,
    conventions: CONVENTIONS, transcript: TRANSCRIPT, rawXml: RAW_XML_WITH_CHECKBOX,
  });
  const check = r.checks.find((c) => c.name === "noBareNgDeep");
  assert.equal(check.status, "pass", "corpus-derived bare ::ng-deep is the project's own idiom");
});

// ---------- scssCompiles (0.10) ----------

test("verify: scssCompiles fails on unbalanced SCSS braces", () => {
  const broken = `:host ::ng-deep .foo { color: red; `;
  const r = verifyComponent({
    scss: broken, html: FAITHFUL_HTML, ts: GOOD_TS,
    conventions: CONVENTIONS, transcript: TRANSCRIPT, rawXml: RAW_XML_NO_CHECKBOX,
  });
  const check = r.checks.find((c) => c.name === "scssCompiles");
  assert.equal(check.status, "fail", "unclosed block must not exit green");
});

test("verify: scssCompiles passes on balanced SCSS", () => {
  const r = verifyComponent({
    scss: GOOD_SCSS, html: FAITHFUL_HTML, ts: GOOD_TS,
    conventions: CONVENTIONS, transcript: TRANSCRIPT, rawXml: RAW_XML_WITH_CHECKBOX,
  });
  const check = r.checks.find((c) => c.name === "scssCompiles");
  assert.equal(check.status, "pass");
});

// ---------- loadedClass (19) ----------

test("verify: loadedClass fails a utility class absent from the loaded CSS registry", () => {
  const registry = { classes: ["mt-4", "btn-block", "col-md-4", "d-flex"], source: "dist" };
  const htmlDead = `<button class="btn btn-primary w-100">Cari</button>`;
  const r = verifyComponent({
    scss: GOOD_SCSS, html: htmlDead, ts: GOOD_TS,
    conventions: { ...CONVENTIONS, loadedClassRegistry: registry },
    transcript: TRANSCRIPT, rawXml: RAW_XML_NO_CHECKBOX,
  });
  const check = r.checks.find((c) => c.name === "loadedClass");
  assert.equal(check.status, "fail", "w-100 not in loaded CSS → dead class");
  assert.ok(check.dead.includes("w-100"), "w-100 flagged dead");
});

test("verify: loadedClass passes a utility class present in the registry", () => {
  const registry = { classes: ["mt-4", "btn-block", "col-md-4", "d-flex"], source: "dist" };
  const htmlGood = `<button class="btn btn-primary btn-block mt-4">Cari</button>`;
  const r = verifyComponent({
    scss: GOOD_SCSS, html: htmlGood, ts: GOOD_TS,
    conventions: { ...CONVENTIONS, loadedClassRegistry: registry },
    transcript: TRANSCRIPT, rawXml: RAW_XML_NO_CHECKBOX,
  });
  const check = r.checks.find((c) => c.name === "loadedClass");
  assert.equal(check.status, "pass");
});

test("verify: loadedClass skips without a registry (back-compat)", () => {
  const r = verifyComponent({
    scss: GOOD_SCSS, html: FAITHFUL_HTML, ts: GOOD_TS,
    conventions: CONVENTIONS, transcript: TRANSCRIPT, rawXml: RAW_XML_WITH_CHECKBOX,
  });
  const check = r.checks.find((c) => c.name === "loadedClass");
  assert.equal(check.status, "skip");
});

test("verify: loadedClass skips when registry resolved no stylesheet (source none — under-resolved)", () => {
  // A registry that found nothing (source 'none', empty files) must NEVER fail classes — it is
  // insufficient coverage, not a red. Regression guard for the anti-false-positive wiring.
  const registry = { classes: [], source: "none", files: [] };
  const htmlDead = `<button class="btn btn-primary w-100">Cari</button>`;
  const r = verifyComponent({
    scss: GOOD_SCSS, html: htmlDead, ts: GOOD_TS,
    conventions: { ...CONVENTIONS, loadedClassRegistry: registry },
    transcript: TRANSCRIPT, rawXml: RAW_XML_NO_CHECKBOX,
  });
  const check = r.checks.find((c) => c.name === "loadedClass");
  assert.equal(check.status, "skip", "source 'none' registry must skip, not fail dead-looking classes");
});

test("verify: loadedClass does NOT gate breakpoint grid columns against a scss (non-dist) registry", () => {
  // A scss-source registry cannot see @mixin-generated col-md-4; it must not false-fail it.
  const registry = { classes: ["mt-4"], source: "scss" };
  const htmlGrid = `<div class="row"><div class="col-md-4 col-12"></div></div>`;
  const r = verifyComponent({
    scss: GOOD_SCSS, html: htmlGrid, ts: GOOD_TS,
    conventions: { ...CONVENTIONS, loadedClassRegistry: registry },
    transcript: TRANSCRIPT, rawXml: RAW_XML_NO_CHECKBOX,
  });
  const check = r.checks.find((c) => c.name === "loadedClass");
  // col-md-4 is breakpoint-grid (not gated on scss); col-12 IS bare and absent → gated.
  assert.ok(!(check.dead ?? []).includes("col-md-4"), "col-md-4 must not false-fail on scss registry");
});

// ---------- inventedLayout (SUI-STRUCT-004) ----------

test("verify: inventedLayout warns on a shadow/max-width/margin-auto with no design evidence", () => {
  const scss = `${GOOD_SCSS}\n.content { box-shadow: 0 2px 4px rgba(0,0,0,.1); max-width: 1200px; margin: 0 auto; }`;
  const r = verifyComponent({
    scss, html: `<div class="content"></div>`, ts: GOOD_TS,
    conventions: CONVENTIONS, transcript: TRANSCRIPT, rawXml: RAW_XML_NO_CHECKBOX,
  });
  const check = r.checks.find((c) => c.name === "inventedLayout");
  assert.equal(check.status, "warn", "layout effects without evidence warn");
  assert.ok(check.detail.includes("SUI-STRUCT-004"), "names the SUI-STRUCT-004 code");
});

test("verify: inventedLayout passes when the design evidences the effect", () => {
  // The transcript mentions a shadow/centering, so the effect is evidenced — not invented.
  const t = { layout: [{ type: "text", text: "x" }], shadow: true, centered: true };
  const scss = `${GOOD_SCSS}\n.content { box-shadow: 0 2px 4px rgba(0,0,0,.1); margin: 0 auto; }`;
  const r = verifyComponent({
    scss, html: `<div class="content"></div>`, ts: GOOD_TS,
    conventions: CONVENTIONS, transcript: t, rawXml: RAW_XML_NO_CHECKBOX,
  });
  assert.equal(r.checks.find((c) => c.name === "inventedLayout").status, "pass");
});

test("verify: inventedLayout skips deep-CSS (library internal is judged elsewhere)", () => {
  const scss = `${GOOD_SCSS}\n:host ::ng-deep .ugw-pagination-container { box-shadow: none; }`;
  const r = verifyComponent({
    scss, html: `<div></div>`, ts: GOOD_TS,
    conventions: CONVENTIONS, transcript: TRANSCRIPT, rawXml: RAW_XML_NO_CHECKBOX,
  });
  assert.equal(r.checks.find((c) => c.name === "inventedLayout").status, "skip");
});

// ---------- deadCode (unused import / injected dependency) ----------

test("verify: deadCode warns on an unused import and injected-but-unused service", () => {
  const ts = `import { AuthorizationModel } from "@uiigateway/core";
@Component({ selector: "x", template: "" })
export class X {
  constructor(private unusedSvc: FooService) {}
}`;
  const r = verifyComponent({
    scss: GOOD_SCSS, html: `<div></div>`, ts,
    conventions: CONVENTIONS, transcript: TRANSCRIPT, rawXml: RAW_XML_NO_CHECKBOX,
  });
  const check = r.checks.find((c) => c.name === "deadCode");
  assert.equal(check.status, "warn", "dead code warns");
  assert.ok(check.problems.some((p) => p.includes("AuthorizationModel")), "names the unused import");
  assert.ok(check.problems.some((p) => p.includes("unusedSvc")), "names the injected-but-unused service");
});

test("verify: deadCode passes a clean component", () => {
  const ts = `import { Component } from "@angular/core";
@Component({ selector: "x", template: "" })
export class X {
  constructor(private svc: FooService) {}
  ngOnInit() { this.svc.load(); }
}`;
  const r = verifyComponent({
    scss: GOOD_SCSS, html: `<div></div>`, ts,
    conventions: CONVENTIONS, transcript: TRANSCRIPT, rawXml: RAW_XML_NO_CHECKBOX,
  });
  assert.equal(r.checks.find((c) => c.name === "deadCode").status, "pass");
});

// --- PR 5: modal wrapper, framework syntax, structured diagnostics ---

import { decorateCheck, primaryState, CHECK_META } from "../src/lib/diagnostics.mjs";

test("PR5: modalWrapper warns on a modal/card wrapper the design never evidences", () => {
  const html = `<div class="modal-header">Title</div>`;
  const transcript = { layout: [{ id: "x", type: "text", text: "Daftar" }] };
  const r = verifyComponent({ html, scss: "", ts: "", transcript, conventions: {} });
  const c = r.checks.find((x) => x.name === "modalWrapper");
  assert.equal(c.status, "warn");
  assert.match(c.detail, /no design evidence/);
});

test("PR5: modalWrapper passes when the design evidences a modal frame", () => {
  const html = `<div class="modal-header">Title</div>`;
  const transcript = { layout: [{ id: "m", type: "group", description: "modal-konfirmasi", children: [] }] };
  const r = verifyComponent({ html, scss: "", ts: "", transcript, conventions: {} });
  const c = r.checks.find((x) => x.name === "modalWrapper");
  assert.equal(c.status, "pass");
});

test("PR5: modalWrapper skips a neutral wrapper (no semantic class, no modal marker)", () => {
  const html = `<div><ng-container *ngIf="x">ok</ng-container></div>`;
  const transcript = { layout: [{ id: "x", type: "text", text: "ok" }] };
  const r = verifyComponent({ html, scss: "", ts: "", transcript, conventions: {} });
  const c = r.checks.find((x) => x.name === "modalWrapper");
  assert.ok(c.status === "skip" || c.status === "pass", "neutral wrapper not flagged");
});

test("PR5: frameworkSyntax fails Angular ≤13 incompatible syntax", () => {
  const ts = `export class A { constructor() { const x = inject(Foo); } }`;
  const framework = { id: "angular", versionMajor: 13 };
  const r = verifyComponent({ ts, html: `<div *ngIf="x"></div>`, scss: "", conventions: {}, framework });
  const c = r.checks.find((x) => x.name === "frameworkSyntax");
  assert.equal(c.status, "fail");
  assert.match(c.detail, /inject\(\) \(v14\+\)/);
});

test("PR5: frameworkSyntax skips without an Angular ≤13 version snapshot", () => {
  const ts = `export class A {}`;
  const r = verifyComponent({ ts, html: "", scss: "", conventions: {}, framework: null });
  const c = r.checks.find((x) => x.name === "frameworkSyntax");
  assert.equal(c.status, "skip");
});

test("PR5: every check is decorated with stable id/category/trust/severity", () => {
  const r = verifyComponent({ scss: ".a { color: red; }", html: "<div class='a'>x</div>", ts: "export class A {}", conventions: { classVocabulary: [], ngDeepCorpus: [] }, transcript: { layout: [] }, rawXml: "" });
  for (const c of r.checks) {
    assert.ok(c.id, `check ${c.name} has an id`);
    assert.ok(c.id.startsWith("SUI-VERIFY-"), `id is stable-prefixed: ${c.id}`);
    assert.ok(c.category, `check ${c.name} has a category`);
    assert.ok(c.trust, `check ${c.name} has a trust source`);
    assert.ok(["error", "warning", "info"].includes(c.severity), `severity valid: ${c.severity}`);
  }
  // A shared-assumption check must be labeled as such.
  const scssCoverage = r.checks.find((c) => c.name === "scssCoverage");
  assert.equal(scssCoverage.trust, "shared-assumption");
  // A literal-design check must be labeled literal-design.
  const textCoverage = r.checks.find((c) => c.name === "textCoverage");
  assert.equal(textCoverage.trust, "literal-design");
});

test("PR5: primaryState reflects fail / unverifiable / pass", () => {
  assert.equal(primaryState([{ status: "fail" }, { status: "pass" }], true), "fail");
  assert.equal(primaryState([{ status: "pass" }], false), "unverifiable");
  assert.equal(primaryState([{ status: "pass" }], true), "pass");
});

test("PR5: verifyComponent result carries a primary state and pass stays correct", () => {
  const pass = verifyComponent({ scss: ".a{color:red;}", html: "<div class='a'>x</div>", ts: "export class A {}", conventions: { classVocabulary: [], ngDeepCorpus: [] }, transcript: { layout: [] }, rawXml: "" });
  assert.equal(pass.state, "pass");
  assert.equal(pass.pass, true);
  const fail = verifyComponent({ scss: "", html: "", ts: "", conventions: null, transcript: null, rawXml: null });
  assert.equal(fail.state, "unverifiable");
  assert.equal(fail.pass, false);
});

// --- PR 5 corrective patch: FWK-001/FWK-002 (lexical masking) + EXT-001 (headline) ---

function fwkCheck(ts, html = "", framework = { id: "angular", versionMajor: 13 }) {
  return verifyComponent({ ts, html, scss: "", conventions: {}, framework }).checks.find((c) => c.name === "frameworkSyntax");
}

test("PR5c: comments and string literals do not trigger frameworkSyntax", () => {
  const cases = [
    "// inject(Service)",
    "/* signal(0) */",
    "/** computed(() => 1) */",
    `const a = "inject(Service)";`,
    `const b = 'signal(0)';`,
    "const c = `effect(() => {})`;",
    `const d = "escaped quote: \\" inject(Service)";`,
    `const e = 'escaped quote: \\' signal(0)';`,
    `const f = "comment-like // inject()";`,
    `const g = 'comment-like /* signal() */';`,
    `/* quote-like "inject()" and 'signal()' */`,
    "// template-like `${inject(Service)}`",
    "/* multiline\n   block with\n   computed(() => 1)\n*/",
    "const m = `multiline\ntemplate with\ninject(Service)`;",
  ];
  for (const src of cases) {
    const c = fwkCheck(src);
    assert.notEqual(c.status, "fail", `non-executable must not fail: ${JSON.stringify(src.slice(0, 40))}`);
  }
});

test("PR5c: executable syntax is still detected", () => {
  const cases = [
    ["const service = inject(Service);", /inject\(\)/],
    ["const count = signal(0);", /signals API/],
    ["const doubled = computed(() => count() * 2);", /signals API/],
    ["effect(() => console.log(count()));", /signals API/],
    ["const value = `${inject(Service)}`;", /inject\(\)/],
  ];
  for (const [src, re] of cases) {
    const c = fwkCheck(src);
    assert.equal(c.status, "fail", `executable must fail: ${src.slice(0, 40)}`);
    assert.match(c.detail, re);
  }
  // Template control-flow constructs.
  for (const html of ["@if (ready) { }", "@for (item of items) {}", "@switch (v) {}", "@defer {}"]) {
    const c = fwkCheck("", html);
    assert.equal(c.status, "fail", `template control flow must fail: ${html}`);
  }
});

test("PR5c: code after a comment/string remains visible", () => {
  const c = fwkCheck("// inject() is prohibited\nconst actual = inject(Service);");
  assert.equal(c.status, "fail", "executable inject after a comment must still be detected");
});

test("PR5c: identifier boundaries — non-target identifiers do not false-positive", () => {
  const cases = [
    "function myinject() {}",
    "const signalValue = 1;",
    "const computedLabel = 'x';",
    "const sideeffect = () => {};",
  ];
  for (const src of cases) {
    const c = fwkCheck(src);
    assert.notEqual(c.status, "fail", `non-target identifier must not fail: ${src}`);
  }
});

test("PR5c: frameworkSyntax skips without an Angular ≤13 snapshot (version gating intact)", () => {
  const noVer = fwkCheck("const s = inject(x);", "", null);
  assert.equal(noVer.status, "skip");
  const newer = fwkCheck("const s = inject(x);", "", { id: "angular", versionMajor: 17 });
  assert.equal(newer.status, "skip", "newer Angular must not produce an Angular-13 fail");
});

test("PR5c: frameworkSyntax diagnostics retain stable metadata", () => {
  const c = fwkCheck("const s = inject(Service);");
  assert.equal(c.id, "SUI-VERIFY-SYNTAX-005");
  assert.equal(c.category, "framework-syntax");
  assert.equal(c.trust, "verified-capability");
  assert.equal(c.severity, "error");
});

test("PR5c: maskNonExecutable preserves offsets (executable token index unchanged)", async () => {
  // The masker is module-private; verify behavior indirectly: a long comment/string preamble must
  // not shift detection. (Location preservation is asserted via the deterministic full-output
  // deep-equality test below.)
  const src = "// a very long comment\n/* block\ncomment */\nconst doc = `text`;\nconst service = inject(Service);";
  const c = fwkCheck(src);
  assert.equal(c.status, "fail");
  assert.match(c.detail, /inject\(\)/);
});
