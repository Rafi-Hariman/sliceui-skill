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

/**
 * The org's action → authKey → icon truth table (pilar `uii-table` renders an action icon only
 * when the row's `auth.<flag>` is truthy). The single home for this mapping — shared by the
 * verify gate's TABLE_ACTION_AUTH (via verify's import) and by the agent-facing uii-profile.md.
 * Rows: { action, authKey, icon, note? }.
 */
export const UII_ACTION_AUTH_ICON = [
  { action: "edit / update", authKey: "canUpdate", icon: "fa-pencil" },
  { action: "detail / read", authKey: "canRead", icon: "visibility (mat)" },
  { action: "delete", authKey: "canDelete", icon: "fa-trash" },
  { action: "print", authKey: "canPrint", icon: "fa-print" },
  { action: "verify (also verifivation/verification)", authKey: "canVerify", icon: "fa-check-square-o" },
  { action: "validate", authKey: "canValidate", icon: "playlist_add_check (mat)" },
  { action: "publish", authKey: "canPublish", icon: "fa-arrow-circle-up" },
  { action: "export", authKey: "canExport", icon: "fa-cloud-upload" },
  { action: "import", authKey: "canImport", icon: "fa-cloud-download" },
  { action: "posting", authKey: "canPosting", icon: "fa-arrow-circle-up" },
  { action: "unposting", authKey: "canUnposting", icon: "fa-times" },
  { action: "reject", authKey: "canReject", icon: "fa-times" },
  { action: "audit", authKey: "canAudit", icon: "pf-clipboard-list" },
  { action: "activate / toggle", authKey: "canActivate", icon: "uii-switch (not an icon)" },
];

/** Machine alias map: normalized Figma action boolean → the authKey whose truthy flag makes
 *  pilar's uii-table render the action icon. The single source for verify's normalizeFigmaAction
 *  (the old TABLE_ACTION_AUTH lived in verify.mjs). */
export const UII_AUTHKEY_BY_ACTION = {
  edit: "canUpdate",
  update: "canUpdate",
  detail: "canRead",
  read: "canRead",
  delete: "canDelete",
  print: "canPrint",
  verify: "canVerify",
  verifivation: "canVerify", // Figma misspelling observed in real XML
  verification: "canVerify",
  validate: "canValidate",
  publish: "canPublish",
  export: "canExport",
  import: "canImport",
  posting: "canPosting",
  unposting: "canUnposting",
  reject: "canReject",
  audit: "canAudit",
  activate: "canActivate",
  toggle: "canActivate", // toggle-on → pilar renders uii-switch (not an icon), still needs canActivate
};

/** The note that accompanies the truth table (pilar is authoritative over the model's flags). */
export const UII_AUTH_NOTE =
  "pilar is authoritative over @uiigateway/core's AuthorizationModel: it consumes canExport/canImport (not canExpImp) plus canPosting/canUnposting/canReject/canAudit, which the model does not declare. Set flags the pilar table consumes.";

/**
 * The agent-facing profile document, written by `sliceui init` to `.sliceui/uii-profile.md`
 * ONLY for UII projects. Keeping it out of the always-read skill body means a non-UII project
 * is never handed the org grammar.
 */
export function renderUiiProfileMd() {
  const rows = UII_ACTION_AUTH_ICON.map((r) => `| ${r.action} | \`${r.authKey}\` | ${r.icon} |`).join("\n");
  return `# UII Gateway profile (project-specific)

This project fingerprints as a UII Gateway project (pilar / @uiigateway/* on the private registry).
When you emit a \`[actionColumn]\` on \`uii-table\`, every row must carry an \`auth\` object
(import \`AuthorizationModel\` from \`@uiigateway/core\`) with one \`auth.<flag> = true\` per action
the XML's \`<Aksi>\` marks enabled.

**action → authKey → icon** (pilar \`uii-table\` renders an icon only when the row's \`auth.<flag>\` is truthy):

| XML action | authKey (set true) | pilar icon |
|---|---|---|
${rows}

> ${UII_AUTH_NOTE}
`;
}
