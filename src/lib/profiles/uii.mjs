// UII Gateway profile — the single home for the org's private component grammar.
//
// WHY a separate gated module: the org's UI libraries (pilar, @uiigateway/core) live on a
// private registry (npm.uii.ac.id) and are only installable inside UII projects. Their component
// idiom (uii-table bindings, AuthorizationModel auth, ugw-* shell) must therefore never be
// resolved, mined, or taught to a generic (non-UII) project. detect computes a uii fingerprint
// (repo name / deps / .npmrc) and only then are these entries merged into the active registry.
//
// Keep EVERYTHING org-specific here — no pilar/@uiigateway/AuthorizationModel/ugw-* strings in
// the shared registry or conventions modules. This is also the seam a future framework reorg
// moves to `src/framework/angular/uii-profile` unchanged.

/**
 * The org's registry entries, keyed by category. `insertIndex` preserves the entry's original
 * priority within the category array when merged (pilar was first-by-design for table/pagination,
 * last in switch/modal/date/toast). Each carries `scope: "uii"`.
 */
export const UII_REGISTRY_ENTRIES = {
  table: [
    {
      insertIndex: 0,
      // pilar's uii-table is the org's table — first by design (see handoff: table → uii-table).
      name: "pilar (uii-table)",
      scope: "uii",
      package: "pilar",
      test: /uii-table|uii-client-table|uii-server-table/i,
      sampleHtml: `<uii-table [columns]="columns" [rows]="rows" [checkboxColumn]="true" [actionColumn]="true" [paginationOptions]="true" [searchOptions]="true" (editClicked)="onEdit($event)"></uii-table>`,
      sampleTs: `import { TableModule } from "pilar";\nimport { AuthorizationModel } from "@uiigateway/core";\n// columns: [{ prop: "nim", name: "NIM" }];\n// rows carry auth so action icons render: auth.canUpdate = true -> fa-pencil\n// add TableModule to imports[]`,
    },
  ],
  modal: [
    {
      insertIndex: 2,
      name: "pilar (uii-dialog)",
      scope: "uii",
      package: "pilar",
      test: /uii-infodialog|ModalDialogComponent|ConfirmDialog2Component|DangerDialog2Component|SuccessDialog2Component|WarningDialog2Component/i,
      sampleHtml: `<!-- open via ModalService / the uii-*-dialog2 components -->`,
      sampleTs: `import { ModalService } from "pilar";\n// or the uii-infodialog / *-dialog2 components for confirm/danger/success/warning dialogs`,
    },
  ],
  toast: [
    {
      insertIndex: 1,
      name: "pilar (uii-toast)",
      scope: "uii",
      package: "pilar",
      test: /uii-toast|ToastService/i,
      sampleHtml: `<!-- inject ToastService; this.toast.success('Saved') -->`,
      sampleTs: `import { ToastService } from "pilar";\n// this.toast.success('Saved') / .error('Failed')`,
    },
  ],
  date: [
    {
      insertIndex: 2,
      name: "pilar (uii-date-time-picker)",
      scope: "uii",
      package: "pilar",
      test: /uii-date-time-picker/i,
      sampleHtml: `<input [uiiDateTimePicker]="dt" /><uii-date-time-picker-inline #dt></uii-date-time-picker-inline>`,
      sampleTs: `import { DateTimePickerModule } from "pilar";\n// add DateTimePickerModule to imports[]`,
    },
  ],
  switch: [
    {
      insertIndex: 1,
      name: "pilar (uii-switch)",
      scope: "uii",
      package: "pilar",
      test: /uii-switch/i,
      sampleHtml: `<uii-switch [(checked)]="enabled"></uii-switch>`,
      sampleTs: `import { SwitchModule } from "pilar";\n// add SwitchModule to imports[]`,
    },
  ],
  pagination: [
    {
      insertIndex: 0,
      name: "pilar (uii-pagination)",
      scope: "uii",
      package: "pilar",
      test: /uii-pagination/i,
      sampleHtml: `<uii-pagination [currentPage]="page" [amountOfData]="total" [dataPerPage]="perPage" (pageChanged)="onPage($event)"></uii-pagination>`,
      sampleTs: `import { PaginationModule } from "pilar";\n// add PaginationModule to imports[]`,
    },
  ],
  layout: [
    {
      insertIndex: 0,
      // @uiigateway/core ships the org's app shell (header/sidebar/breadcrumb/templates).
      name: "@uiigateway/core (layout)",
      scope: "uii",
      package: "@uiigateway/core",
      test: /ugw-header|ugw-sidebar|ugw-breadcrumb|ugw-empty-data|ugw-tableloader|ugw-not-found|ugw-under-construction/i,
      sampleHtml: `<ugw-header></ugw-header>\n<ugw-sidebar></ugw-sidebar>\n<ugw-breadcrumb></ugw-breadcrumb>`,
      sampleTs: `import { HeaderComponent, SidebarComponent, BreadcrumbComponent } from "@uiigateway/core";\n// register in the app's core/shared module`,
    },
  ],
};
