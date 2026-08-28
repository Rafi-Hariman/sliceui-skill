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
