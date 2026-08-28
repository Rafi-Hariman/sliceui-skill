// library-registry — curated mapping from UI *element categories* to libraries.
// Used as the fallback when a project doesn't use a known library for a category,
// and to seed the "which library serves this element?" lookup.
// Each entry: category → { libraries: [ { name, test (regex), sampleHtml, sampleTs } ] }

export const CATEGORIES = [
  "select", "table", "modal", "toast", "editor", "date", "slider", "switch",
];

export const REGISTRY = {
  select: [
    {
      name: "ngx-select-ex",
      test: /ngx-select|ngxSelectModule/i,
      sampleHtml: `<ngx-select [items]="items" [(ngModel)]="selected" placeholder="Pilih..."></ngx-select>`,
      sampleTs: `import { NgxSelectModule } from "ngx-select-ex";\n// add NgxSelectModule to imports[]`,
    },
    {
      name: "ng-multiselect-dropdown",
      test: /ng-multiselect-dropdown|NgMultiSelectDropDownModule/i,
      sampleHtml: `<ng-multiselect-dropdown [settings]="dropdownSettings" [data]="items"></ng-multiselect-dropdown>`,
      sampleTs: `import { NgMultiSelectDropDownModule } from "ng-multiselect-dropdown";`,
    },
  ],
  table: [
    {
      name: "ngx-datatable",
      test: /ngx-datatable|NgxDatatableModule/i,
      sampleHtml: `<ngx-datatable class="material" [rows]="rows" [columns]="columns"></ngx-datatable>`,
      sampleTs: `import { NgxDatatableModule } from "@swimlane/ngx-datatable";`,
    },
    {
      name: "mat-table",
      test: /mat-table|MatTableModule/i,
      sampleHtml: `<table mat-table [dataSource]="data"><tr mat-header-row *matHeaderRowDef="cols"></tr><tr mat-row *matRowDef="let row; columns: cols"></tr></table>`,
      sampleTs: `import { MatTableModule } from "@angular/material/table";`,
    },
    {
      name: "primeng-table",
      test: /p-table|TableModule.*primeng/i,
      sampleHtml: `<p-table [value]="rows"><ng-template pTemplate="body" let-row><tr>…</tr></ng-template></p-table>`,
      sampleTs: `import { TableModule } from "primeng/table";`,
    },
  ],
  modal: [
    {
      name: "ngx-bootstrap",
      test: /ngx-bootstrap|BsModalService|ModalModule/i,
      sampleHtml: `<!-- open via BsModalService.show(Component, { initialState }) -->`,
      sampleTs: `import { BsModalService, BsModalRef, ModalOptions } from "ngx-bootstrap/modal";`,
    },
    {
      name: "mat-dialog",
      test: /MatDialogModule|MatDialog/i,
      sampleHtml: `<!-- open via dialog.open(Component, { data }) -->`,
      sampleTs: `import { MatDialogModule, MatDialog } from "@angular/material/dialog";`,
    },
  ],
  toast: [
    {
      name: "ngx-toastr",
      test: /ngx-toastr|ToastrService|ToastrModule/i,
      sampleHtml: `<!-- inject ToastrService; toastr.success('Saved') -->`,
      sampleTs: `import { ToastrService } from "ngx-toastr";`,
    },
  ],
  editor: [
    {
      name: "ngx-quill",
      test: /ngx-quill|quill-editor|QuillModule/i,
      sampleHtml: `<quill-editor [modules]="modules" [(ngModel)]="content"></quill-editor>`,
      sampleTs: `import { QuillModule } from "ngx-quill";`,
    },
    {
      name: "tinymce",
      test: /tinymce-angular|TinymceModule/i,
      sampleHtml: `<editor [init]="tinymceInit" [(ngModel)]="content"></editor>`,
      sampleTs: `import { EditorModule } from "@tinymce/tinymce-angular";`,
    },
  ],
  date: [
    {
      name: "ng-pick-datetime",
      test: /ng-pick-datetime|DateTimePickerModule/i,
      sampleHtml: `<input [owlDateTime]="dt" />`,
      sampleTs: `import { DateTimePickerModule } from "ng-pick-datetime";`,
    },
  ],
  slider: [
    {
      name: "ngx-slider",
      test: /ngx-slider|NgxSliderModule/i,
      sampleHtml: `<ngx-slider [(value)]="val" [options]="options"></ngx-slider>`,
      sampleTs: `import { NgxSliderModule } from "@angular-slider/ngx-slider";`,
    },
  ],
  switch: [
    {
      name: "ngx-ui-switch",
      test: /ngx-ui-switch|UiSwitchModule/i,
      sampleHtml: `<ui-switch [(ngModel)]="enabled"></ui-switch>`,
      sampleTs: `import { UiSwitchModule } from "ngx-ui-switch";`,
    },
  ],
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
