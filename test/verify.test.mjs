import { test } from "node:test";
import assert from "node:assert/strict";
import { verifyComponent } from "../src/lib/verify.mjs";

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
<ngx-select placeholder="Pilih jenis tagihan"></ngx-select>
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
  const scssWithInvented = GOOD_SCSS + "\n::ng-deep .label-custom-unpaid { background: #fef2f2; }\n";
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
  const htmlNoCheckbox = `<uii-table [rows]="rows" [columns]="columns"></uii-table>`;
  const r = verifyComponent({ scss: GOOD_SCSS, html: htmlNoCheckbox, ts: GOOD_TS });
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

test("verify: no-exemplar never scores pass (empty corpus → skip, not pass)", () => {
  const r = verifyComponent({
    scss: GOOD_SCSS, html: GOOD_HTML, ts: GOOD_TS,
    conventions: { ...CONVENTIONS, ngDeepCorpus: [] },
    transcript: TRANSCRIPT, rawXml: RAW_XML_WITH_CHECKBOX,
  });
  const check = r.checks.find((c) => c.name === "scssCoverage");
  assert.equal(check.status, "skip", "empty corpus is skip (cannot verify), never pass");
});
