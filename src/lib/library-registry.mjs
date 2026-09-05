// library-registry — curated mapping from UI *element categories* to libraries.
// Two signals feed the resolver (see library-scan.mjs):
//   (1) `test` / `testImport` — the library is actually USED in source (import or tag).
//   (2) `package` — the library's npm package is installed (package.json dependencies).
// A `package` lets a freshly-scaffolded project resolve its components BEFORE any usage
// exists, while real local usage still wins over a bare install.
// Array ORDER within a category is the fixed priority when several libraries are installed.
//
// The org's private entries (pilar / @uiigateway/core) are NOT here — they live in
// src/lib/profiles/uii.mjs and are merged in via withUiiEntries() only for UII projects.

import { UII_REGISTRY_ENTRIES } from "./profiles/uii.mjs";

export const CATEGORIES = [
  "select", "table", "modal", "toast", "editor", "date", "slider", "switch",
  "pagination", "divider", "well", "checkbox", "layout",
];

export const REGISTRY = {
  select: [
    {
      name: "ngx-select-ex",
      package: "ngx-select-ex",
      test: /ngx-select-ex|NgxSelectModule/i,
      testImport: /from ["']ngx-select-ex["']/i,
      sampleHtml: `<ngx-select [items]="items" [(ngModel)]="selected" placeholder="Pilih..."></ngx-select>`,
      sampleTs: `import { NgxSelectModule } from "ngx-select-ex";\n// add NgxSelectModule to imports[]`,
    },
    {
      name: "ng-multiselect-dropdown",
      package: "ng-multiselect-dropdown",
      test: /ng-multiselect-dropdown|NgMultiSelectDropDownModule/i,
      sampleHtml: `<ng-multiselect-dropdown [settings]="dropdownSettings" [data]="items"></ng-multiselect-dropdown>`,
      sampleTs: `import { NgMultiSelectDropDownModule } from "ng-multiselect-dropdown";`,
    },
    {
      // A generic <ngx-select> tag that isn't backed by a detected import — the component
      // is often re-exported by a custom/core package (e.g. @uiigateway/core, pilar). Don't
      // claim ngx-select-ex; teach the agent to mirror local usage instead.
      name: "ngx-select (local)",
      test: /<ngx-select\b/i,
      tagTest: /<ngx-select\b/i,
      sampleHtml: `<ngx-select [items]="items" [optionTextField]="'name'" [optionValueField]="'value'" [(ngModel)]="selected" placeholder="Pilih..."></ngx-select>`,
      sampleTs: `// <ngx-select> is provided by a local/core package (e.g. @uiigateway/core) — mirror an existing local usage.`,
    },
  ],
  table: [
    {
      name: "ngx-datatable",
      package: "@swimlane/ngx-datatable",
      test: /ngx-datatable|NgxDatatableModule/i,
      sampleHtml: `<ngx-datatable class="material" [rows]="rows" [columns]="columns"></ngx-datatable>`,
      sampleTs: `import { NgxDatatableModule } from "@swimlane/ngx-datatable";`,
    },
    {
      name: "mat-table",
      package: "@angular/material",
      test: /mat-table|MatTableModule/i,
      sampleHtml: `<table mat-table [dataSource]="data"><tr mat-header-row *matHeaderRowDef="cols"></tr><tr mat-row *matRowDef="let row; columns: cols"></tr></table>`,
      sampleTs: `import { MatTableModule } from "@angular/material/table";`,
    },
    {
      name: "primeng-table",
      package: "primeng",
      test: /p-table|TableModule.*primeng/i,
      sampleHtml: `<p-table [value]="rows"><ng-template pTemplate="body" let-row><tr>…</tr></ng-template></p-table>`,
      sampleTs: `import { TableModule } from "primeng/table";`,
    },
  ],
  modal: [
    {
      name: "ngx-bootstrap",
      package: "ngx-bootstrap",
      test: /ngx-bootstrap|BsModalService|ModalModule/i,
      sampleHtml: `<!-- open via BsModalService.show(Component, { initialState }) -->`,
      sampleTs: `import { BsModalService, BsModalRef, ModalOptions } from "ngx-bootstrap/modal";`,
    },
    {
      name: "mat-dialog",
      package: "@angular/material",
      test: /MatDialogModule|MatDialog/i,
      sampleHtml: `<!-- open via dialog.open(Component, { data }) -->`,
      sampleTs: `import { MatDialogModule, MatDialog } from "@angular/material/dialog";`,
    },
  ],
  toast: [
    {
      name: "ngx-toastr",
      package: "ngx-toastr",
      test: /ngx-toastr|ToastrService|ToastrModule/i,
      sampleHtml: `<!-- inject ToastrService; toastr.success('Saved') -->`,
      sampleTs: `import { ToastrService } from "ngx-toastr";`,
    },
  ],
  editor: [
    {
      name: "ngx-quill",
      package: "ngx-quill",
      test: /ngx-quill|quill-editor|QuillModule/i,
      sampleHtml: `<quill-editor [modules]="modules" [(ngModel)]="content"></quill-editor>`,
      sampleTs: `import { QuillModule } from "ngx-quill";`,
    },
    {
      name: "tinymce",
      package: "@tinymce/tinymce-angular",
      test: /tinymce-angular|TinymceModule/i,
      sampleHtml: `<editor [init]="tinymceInit" [(ngModel)]="content"></editor>`,
      sampleTs: `import { EditorModule } from "@tinymce/tinymce-angular";`,
    },
  ],
  date: [
    {
      name: "ng-pick-datetime",
      package: "ng-pick-datetime",
      test: /ng-pick-datetime|DateTimePickerModule/i,
      testImport: /from ["']ng-pick-datetime["']/i,
      sampleHtml: `<input [owlDateTime]="dt" />`,
      sampleTs: `import { DateTimePickerModule } from "ng-pick-datetime";`,
    },
    {
      name: "@danielmoncada/angular-datetime-picker",
      package: "@danielmoncada/angular-datetime-picker",
      test: /owl-date-time|OwlDateTimeModule|OwlNativeDateTimeModule/i,
      testImport: /from ["']@danielmoncada\/angular-datetime-picker["']/i,
      sampleHtml: `<input [owlDateTime]="dt" /><owl-date-time #dt [pickerType]="'calendar'"></owl-date-time>`,
      sampleTs: `import { OwlDateTimeModule, OwlNativeDateTimeModule } from "@danielmoncada/angular-datetime-picker";`,
    },
  ],
  slider: [
    {
      name: "ngx-slider",
      package: "@angular-slider/ngx-slider",
      test: /ngx-slider|NgxSliderModule/i,
      sampleHtml: `<ngx-slider [(value)]="val" [options]="options"></ngx-slider>`,
      sampleTs: `import { NgxSliderModule } from "@angular-slider/ngx-slider";`,
    },
  ],
  switch: [
    {
      name: "ngx-ui-switch",
      package: "ngx-ui-switch",
      test: /ngx-ui-switch|UiSwitchModule/i,
      sampleHtml: `<ui-switch [(ngModel)]="enabled"></ui-switch>`,
      sampleTs: `import { UiSwitchModule } from "ngx-ui-switch";`,
    },
  ],
  pagination: [
    {
      name: "ngx-datatable pagination",
      package: "@swimlane/ngx-datatable",
      test: /ngx-datatable.*footer|FooterComponent.*ngx-datatable/i,
      sampleHtml: `<!-- ngx-datatable ships a built-in footer/pagination — use its [footerHeight] + footer component -->`,
      sampleTs: `import { NgxDatatableModule } from "@swimlane/ngx-datatable";`,
    },
  ],
  divider: [
    {
      // A divider is a primitive, not a library component — but recording it makes the
      // "hr" the transcript's divider nodes should become explicit in project context.
      name: "native-hr",
      test: /<hr\b/i,
      sampleHtml: `<hr />`,
      sampleTs: null,
    },
  ],
  well: [
    {
      // Bootstrap 3 `.well` (a styled panel). Only claims when `bootstrap` is installed;
      // otherwise the agent falls back to a styled div/card with the transcript's bg.
      name: "bootstrap-well",
      package: "bootstrap",
      test: /class=["'][^"']*\bwell\b|\.well\b/,
      sampleHtml: `<div class="well">…</div>`,
      sampleTs: null,
    },
  ],
  checkbox: [
    {
      // awesome-bootstrap-checkbox: Bootstrap 3 styled checkboxes via `.checkbox` + input.
      name: "awesome-bootstrap-checkbox",
      package: "awesome-bootstrap-checkbox",
      test: /awesome-bootstrap-checkbox|class=["'][^"']*\bcheckbox\b/i,
      sampleHtml: `<div class="checkbox"><label><input type="checkbox"> …</label></div>`,
      sampleTs: `// awesome-bootstrap-checkbox styles <input type="checkbox"> inside .checkbox > label`,
    },
  ],
  // layout is served by the org's @uiigateway/core shell in the uii profile only; a generic
  // project has no library here and honestly reports a null capability (native HTML + note).
  layout: [],
};

/**
 * Find the library entry that matches the project's usage, or null.
 * @param {string} category
 * @param {string} haystack — combined source text to test against
 */
export function matchLibrary(category, haystack) {
  const libs = REGISTRY[category] || [];
  return libs.find((l) => l.test.test(haystack)) || null;
}

/** All library names across the registry (for in-use detection). */
export function registryLibraryNames() {
  const set = new Set();
  for (const cat of Object.values(REGISTRY)) {
    for (const l of cat) set.add(l.name);
  }
  return [...set];
}

/** Entries for one category from the GENERIC base registry. The org-private entries are only
 *  present after withUiiEntries() merges the uii profile in. */
export function registryEntries(category) {
  return (REGISTRY[category] || []).slice();
}

/** A category's entries with the UII profile's org entries merged in at their original priority.
 *  Called by scanLibraryUsage ONLY when the project fingerprints as UII. The entries carry their
 *  `insertIndex` (from profiles/uii.mjs) so pilar stays first-by-design where it was. */
export function withUiiEntries(category, profileEntries) {
  const base = (REGISTRY[category] || []).slice();
  for (const entry of profileEntries ?? []) {
    const at = Math.min(entry.insertIndex ?? base.length, base.length);
    base.splice(at, 0, entry);
  }
  return base;
}
