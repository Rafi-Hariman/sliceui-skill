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
  { nim: "11" }, { nim: "12" }, { nim: "13" }, { nim: "14" }, { nim: "15" },
  { nim: "16" }, { nim: "17" }, { nim: "18" }, { nim: "19" }, { nim: "20" },
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
    conventions: CONVENTIONS, transcript: TRANSCRIPT, rawXml: RAW_XML_NO_CHECKBOX,
  });
  const check = r.checks.find((c) => c.name === "tableBindings");
  assert.equal(check.status, "fail");
  assert.ok(check.problems.some((p) => p.includes("checkbox")), "checkbox evidence problem");
});

test("verify: checkboxColumn absent when XML HAS checkbox fails", () => {
  const htmlNoCheckbox = `<uii-table [rows]="rows" [columns]="columns"></uii-table>`;
  const r = verifyComponent({
    scss: GOOD_SCSS, html: htmlNoCheckbox, ts: GOOD_TS,
    conventions: CONVENTIONS, transcript: TRANSCRIPT, rawXml: RAW_XML_WITH_CHECKBOX,
  });
  const check = r.checks.find((c) => c.name === "tableBindings");
  assert.equal(check.status, "fail");
  assert.ok(check.problems.some((p) => p.includes("checkboxColumn")), "missing checkboxColumn flagged");
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

test("verify: anatomy fails when table present but skeleton missing", () => {
  const htmlNoSkeleton = `<uii-table [rows]="rows" [columns]="columns"></uii-table>`;
  const r = verifyComponent({
    scss: GOOD_SCSS, html: htmlNoSkeleton, ts: GOOD_TS,
    conventions: CONVENTIONS, transcript: TRANSCRIPT, rawXml: RAW_XML_WITH_CHECKBOX,
  });
  const check = r.checks.find((c) => c.name === "anatomy");
  assert.equal(check.status, "fail");
});

test("verify: mockRowCount fails when rows < transcript total (20)", () => {
  const tsFewRows = `const base = [{ nim: "1" }, { nim: "2" }, { nim: "3" }];`;
  const r = verifyComponent({
    scss: GOOD_SCSS, html: GOOD_HTML, ts: tsFewRows,
    conventions: CONVENTIONS, transcript: TRANSCRIPT, rawXml: RAW_XML_WITH_CHECKBOX,
  });
  const check = r.checks.find((c) => c.name === "mockRowCount");
  assert.equal(check.status, "fail");
  assert.equal(check.rows, 3);
  assert.equal(check.required, 20, "required = max(floor 15, transcript 20) = 20");
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

// ---------- rowAuth ----------

test("verify: rowAuth passes when actionColumn rows carry the required auth flag", () => {
  const r = verifyComponent({
    scss: GOOD_SCSS, html: ACTION_HTML, ts: GOOD_TS_AUTH,
    conventions: CONVENTIONS, transcript: TRANSCRIPT, rawXml: RAW_XML_WITH_AKSI,
  });
  const check = r.checks.find((c) => c.name === "rowAuth");
  assert.equal(check.status, "pass");
  assert.deepEqual([...check.required ?? []].sort(), ["canUpdate"]);
});

test("verify: rowAuth fails when actionColumn rows lack the auth flag (edit→canUpdate)", () => {
  const r = verifyComponent({
    scss: GOOD_SCSS, html: ACTION_HTML, ts: BAD_TS,
    conventions: CONVENTIONS, transcript: TRANSCRIPT, rawXml: RAW_XML_WITH_AKSI,
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

// ---------- gateway-table scssCoverage (reusable table shell) ----------

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

test("verify: styleFidelity skips token-valued authored rules (cannot resolve, never false-flagged)", () => {
  const transcript = { layout: [{ type: "text", text: "Ubah tagihan", style: { color: "#000000" } }] };
  const tokenScss = `.h1 { color: $title-color; }`;
  const tokenHtml = `<h1 class="h1">Ubah tagihan</h1>`;
  const r = verifyComponent({ scss: tokenScss, html: tokenHtml, ts: GOOD_TS, conventions: CONVENTIONS, transcript, rawXml: RAW_XML_NO_CHECKBOX });
  const check = r.checks.find((c) => c.name === "styleFidelity");
  assert.notEqual(check.status, "fail", "token color must not be false-flagged");
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
