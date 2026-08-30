import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { scanLibraryUsage } from "../src/lib/library-scan.mjs";

function makeProject(withSelect = false, withTable = false) {
  const dir = mkdtempSync(join(tmpdir(), "sliceui-libscan-"));
  const app = join(dir, "src", "app");
  mkdirSync(app, { recursive: true });

  if (withSelect) {
    writeFileSync(join(app, "select.component.ts"), `import { Component } from "@angular/core";
import { NgxSelectModule } from "ngx-select-ex";
@Component({ selector: "ugw-select", templateUrl: "./select.component.html" })
export class SelectComponent {}`);
    writeFileSync(join(app, "select.component.html"), `<ngx-select [items]="items" [(ngModel)]="selected" placeholder="Pilih status"></ngx-select>`);
  }
  if (withTable) {
    writeFileSync(join(app, "table.component.ts"), `import { Component } from "@angular/core";
import { NgxDatatableModule } from "@swimlane/ngx-datatable";
@Component({ selector: "ugw-table", templateUrl: "./table.component.html" })
export class TableComponent {}`);
    writeFileSync(join(app, "table.component.html"), `<ngx-datatable class="material" [rows]="rows" [columns]="columns"></ngx-datatable>`);
  }
  return dir;
}

test("detects ngx-select-ex and captures a local usage sample", () => {
  const dir = makeProject(true, false);
  const { capabilities, libraries } = scanLibraryUsage(dir);
  rmSync(dir, { recursive: true, force: true });
  assert.ok(libraries.inUse.includes("ngx-select-ex"), "ngx-select-ex in use");
  assert.ok(capabilities.select.library === "ngx-select-ex", "select → ngx-select-ex");
  assert.ok(capabilities.select.sampleHtml.includes("<ngx-select"), "real html sample captured");
  assert.equal(capabilities.select.source, "local", "sample from local, not registry");
});

test("detects ngx-datatable for table category", () => {
  const dir = makeProject(false, true);
  const { capabilities } = scanLibraryUsage(dir);
  rmSync(dir, { recursive: true, force: true });
  assert.equal(capabilities.table.library, "ngx-datatable");
});

test("returns library:null when a category has no matching library", () => {
  const dir = makeProject(false, false);
  const { capabilities } = scanLibraryUsage(dir);
  rmSync(dir, { recursive: true, force: true });
  assert.equal(capabilities.select.library, null, "no select library → null");
  assert.equal(capabilities.table.library, null, "no table library → null");
});

test("bare <ngx-select> tag with no import → ngx-select (local), not ngx-select-ex", () => {
  const dir = mkdtempSync(join(tmpdir(), "sliceui-libscan-"));
  const app = join(dir, "src", "app");
  mkdirSync(app, { recursive: true });
  // Component uses <ngx-select> but imports nothing select-ish (custom/core re-export).
  writeFileSync(join(app, "c.component.ts"), `import { Component } from "@angular/core";
@Component({ selector: "ugw-c", templateUrl: "./c.component.html" })
export class CComponent {}`);
  writeFileSync(join(app, "c.component.html"), `<ngx-select [items]="items" [(ngModel)]="selected"></ngx-select>`);
  const { capabilities, libraries } = scanLibraryUsage(dir);
  rmSync(dir, { recursive: true, force: true });
  assert.ok(capabilities.select.library.includes("ngx-select"), "select resolves to ngx-select local");
  assert.ok(!capabilities.select.library.includes("ngx-select-ex"), "NOT attributed to ngx-select-ex");
  assert.ok(!libraries.inUse.includes("ngx-select-ex"), "ngx-select-ex NOT marked in use");
  assert.equal(capabilities.select.source, "local", "re-exported tag yields a local sample");
  assert.ok(capabilities.select.sampleHtml.includes("<ngx-select"), "real template usage captured as sampleHtml");
});

test("@danielmoncada/angular-datetime-picker detected for date category", () => {
  const dir = mkdtempSync(join(tmpdir(), "sliceui-libscan-"));
  const app = join(dir, "src", "app");
  mkdirSync(app, { recursive: true });
  writeFileSync(join(app, "d.component.ts"), `import { Component } from "@angular/core";
import { OwlDateTimeModule, OwlNativeDateTimeModule } from "@danielmoncada/angular-datetime-picker";
@Component({ selector: "ugw-d", templateUrl: "./d.component.html" })
export class DComponent {}`);
  writeFileSync(join(app, "d.component.html"), `<input [owlDateTime]="dt" /><owl-date-time #dt [pickerType]="'calendar'"></owl-date-time>`);
  const { capabilities } = scanLibraryUsage(dir);
  rmSync(dir, { recursive: true, force: true });
  assert.equal(capabilities.date.library, "@danielmoncada/angular-datetime-picker");
  assert.ok(!capabilities.date.sampleHtml.includes("ng-pick-datetime"), "sample is local, not ng-pick-datetime");
});

test("commented-out import does not trigger a library", () => {
  const dir = mkdtempSync(join(tmpdir(), "sliceui-libscan-"));
  const app = join(dir, "src", "app");
  mkdirSync(app, { recursive: true });
  writeFileSync(join(app, "c.component.ts"), `import { Component } from "@angular/core";
// import { OwlDateTimeModule } from 'ng-pick-datetime';
@Component({ selector: "ugw-c" })
export class CComponent {}`);
  writeFileSync(join(app, "c.component.html"), `<input type="text">`);
  const { capabilities, libraries } = scanLibraryUsage(dir);
  rmSync(dir, { recursive: true, force: true });
  assert.equal(capabilities.date.library, null, "commented ng-pick-datetime ignored");
  assert.ok(!libraries.inUse.includes("ng-pick-datetime"), "ng-pick-datetime not in use");
});

test("package.json deps resolve capabilities even with no usage (fresh scaffold)", () => {
  const dir = mkdtempSync(join(tmpdir(), "sliceui-libscan-"));
  mkdirSync(join(dir, "src"), { recursive: true });
  writeFileSync(join(dir, "package.json"), JSON.stringify({
    dependencies: {
      "pilar": "^3.3.18",
      "ngx-select-ex": "8.0.1",
      "@swimlane/ngx-datatable": "^15.0.2",
      "@uiigateway/core": "^4.1.0",
    },
  }));
  const { capabilities, libraries } = scanLibraryUsage(dir, { pilar: "^3.3.18", "ngx-select-ex": "8.0.1", "@swimlane/ngx-datatable": "^15.0.2", "@uiigateway/core": "^4.1.0" });
  rmSync(dir, { recursive: true, force: true });
  assert.equal(capabilities.table.library, "pilar (uii-table)", "table → pilar uii-table from package.json");
  assert.equal(capabilities.select.library, "ngx-select-ex", "select → ngx-select-ex from package.json");
  assert.equal(capabilities.layout.library, "@uiigateway/core (layout)", "layout → @uiigateway/core from package.json");
  // Installed-but-unused library claims the registry sample (a fallback; the agent reads the
  // library's own .d.ts at generation time).
  assert.equal(capabilities.table.source, "installed", "table resolves from package.json");
  assert.equal(capabilities.select.source, "installed", "select resolves from package.json");
  assert.ok(libraries.inUse.includes("pilar (uii-table)"), "pilar table marked in use");
  assert.ok(libraries.inUse.includes("@uiigateway/core (layout)"), "core layout marked in use");
});

test("local usage wins over an installed package (import-first)", () => {
  const dir = mkdtempSync(join(tmpdir(), "sliceui-libscan-"));
  const app = join(dir, "src", "app");
  mkdirSync(app, { recursive: true });
  writeFileSync(join(dir, "package.json"), JSON.stringify({ dependencies: { "pilar": "^3.3.18" } }));
  writeFileSync(join(app, "t.component.ts"), `import { Component } from "@angular/core";
import { NgxDatatableModule } from "@swimlane/ngx-datatable";
@Component({ selector: "ugw-t", templateUrl: "./t.component.html" })
export class TComponent {}`);
  writeFileSync(join(app, "t.component.html"), `<ngx-datatable [rows]="rows" [columns]="columns"></ngx-datatable>`);
  const { capabilities } = scanLibraryUsage(dir, { pilar: "^3.3.18", "@swimlane/ngx-datatable": "^15.0.2" });
  rmSync(dir, { recursive: true, force: true });
  assert.equal(capabilities.table.library, "ngx-datatable", "real ngx-datatable usage beats installed pilar");
});

test("package-name matching captures a local sample even when the entry has a display label", () => {
  // entry.name is "pilar (uii-table)" but the import says "pilar" — the local scan must
  // match on entry.package, not entry.name, and must read the template via regex.
  const dir = mkdtempSync(join(tmpdir(), "sliceui-libscan-"));
  const app = join(dir, "src", "app");
  mkdirSync(app, { recursive: true });
  writeFileSync(join(app, "p.component.ts"), `import { Component } from "@angular/core";
import { TableModule } from "pilar";
@Component({ selector: "ugw-p", templateUrl: "./p.component.html" })
export class PComponent {}`);
  writeFileSync(join(app, "p.component.html"), `<uii-table [columns]="columns" [rows]="rows" [checkboxColumn]="true"></uii-table>`);
  const { capabilities } = scanLibraryUsage(dir, { pilar: "^3.3.18" });
  rmSync(dir, { recursive: true, force: true });
  assert.equal(capabilities.table.library, "pilar (uii-table)", "pilar resolves to uii-table");
  assert.equal(capabilities.table.source, "local", "local template sample captured");
  assert.ok(capabilities.table.sampleHtml.includes("<uii-table"), "real <uii-table> usage is the sample");
});
