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
//
// The full pilar API inventory lives in pilar-catalog.mjs (GENERATED — see scripts/extract-pilar.mjs).
// This module consumes that catalog for two things the catalog alone doesn't express: the
// registry-entry samples (which teach "how to wire each category"), and the action→auth→icon
// truth table (derived from PILAR_ACTION_CONFIGS so it can never drift from the source).

import {
  PILAR_ACTION_CONFIGS,
  PILAR_COMPONENTS,
  PILAR_DIRECTIVES,
  PILAR_MODELS,
  PILAR_MODULES,
  PILAR_PIPES,
  PILAR_SERVICES,
  PILAR_VERSION,
} from "./pilar-catalog.mjs";
import { PILAR_SHOWCASE } from "./pilar-showcase.mjs";

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
 * when the row's `auth.<flag>` is truthy). Derived from PILAR_ACTION_CONFIGS (the real
 * TableActionComponent.actionConfigs), so it can never drift from the source. Shared by the
 * verify gate's rowAuth (via verify's import) and by the agent-facing uii-profile.md.
 * Rows: { action, authKey, icon, note? }.
 */
export const UII_ACTION_AUTH_ICON = buildActionIconTable();

function buildActionIconTable() {
  const rows = PILAR_ACTION_CONFIGS.map((c) => ({
    action: c.type,
    authKey: c.authKey,
    icon: c.iconClass + (c.iconType === "mat" ? " (mat)" : c.iconType === "pf" ? " (pf)" : ""),
  }));
  // `activate/toggle` is a uii-switch, not a table icon — it still needs canActivate on the row.
  rows.push({ action: "activate / toggle", authKey: "canActivate", icon: "uii-switch (not an icon)" });
  return rows;
}

/** Machine alias map: normalized Figma action boolean → the authKey whose truthy flag makes
 *  pilar's uii-table render the action icon. The canonical type→authKey pairs come from the
 *  catalog (PILAR_ACTION_CONFIGS); the extra Figma/XML aliases (edit, read, verifivation,
 *  activate/toggle) are sliceui-side normalizations layered on top. The single source for
 *  verify's normalizeFigmaAction. */
export const UII_AUTHKEY_BY_ACTION = buildAuthKeyByAction();

function buildAuthKeyByAction() {
  const map = {};
  for (const c of PILAR_ACTION_CONFIGS) map[c.type] = c.authKey;
  // Figma/XML action-name aliases (the raw XML booleans don't always match pilar's `type`).
  map.edit = "canUpdate";
  map.read = "canRead";
  map.verifivation = "canVerify"; // Figma misspelling observed in real XML
  map.verification = "canVerify";
  map.activate = "canActivate";
  map.toggle = "canActivate"; // toggle-on → pilar renders uii-switch (not an icon), still needs canActivate
  return map;
}

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

/**
 * The full pilar API reference, written by `sliceui init` to `.sliceui/pilar-reference.md`
 * ONLY for UII projects (supersedes the minimal uii-profile.md). Renders the checked-in
 * pilar-catalog so the agent knows the exact UI shape (template) and typing (inputs/outputs,
 * models, services, directives, pipes, modules) WITHOUT the pilar repo being present.
 */
export function renderPilarReferenceMd() {
  const L = [];
  L.push("<!-- Generated by SliceUI — pilar API reference (from the checked-in pilar-catalog). -->");
  L.push("");
  L.push(`# pilar reference (v${PILAR_VERSION ?? "?"})`);
  L.push("");
  L.push("The org's shared Angular UI library. Use these components for UII-sliced UI. Every");
  L.push("`@Input`/`@Output` and type below is exact — read it before emitting a `uii-*` tag so the");
  L.push("binding names and types are correct. This is the SHAPE + TYPING source of truth; the");
  L.push("design's appearance still comes from the transcript/XML.");
  L.push("");

  // --- action → authKey → icon ---
  L.push("## Table action → authKey → icon");
  L.push("");
  L.push("`uii-table` renders an action icon only when the row's `auth.<authKey>` is truthy.");
  L.push("When `[actionColumn]` is on, every row carries an `auth` object (import `AuthorizationModel`");
  L.push("from `@uiigateway/core`) with one flag per enabled XML `<Aksi>` action.");
  L.push("");
  L.push("| action | authKey (set true) | icon |");
  L.push("|---|---|---|");
  for (const r of UII_ACTION_AUTH_ICON) L.push(`| ${r.action} | \`${r.authKey}\` | ${r.icon} |`);
  L.push("");
  L.push(`> ${UII_AUTH_NOTE}`);
  L.push("");

  // --- table column cell types (the wiring the agent otherwise reverse-engineers) ---
  L.push("## Table column `type` → rendered cell");
  L.push("");
  L.push("A `TableColumn` (`{ prop, name, type?, inputType?, format?, … }`) renders differently by");
  L.push("`type`. This is the exact switch from the pilar table cell template — read it before");
  L.push("emitting a `columns[]` so input cells are wired correctly, not guessed from the XML.");
  L.push("");
  L.push("| `column.type` | Rendered cell | Key props |");
  L.push("|---|---|---|");
  L.push("| *(absent / `'text'`)* | `{{ row[prop] }}` plain text | — |");
  L.push("| `'number'` | `{{ row[prop] \\| number:'1.0-2' }}` (formatted number) | `format` |");
  L.push("| `'input-number'` | `<input [type]=\"inputType\" class=\"table-input-number\">` bound to `row[prop]` | `inputType`, `inputMin`, `inputMaxLength`, `textUppercase`/`textLowercase`, `disabled` |");
  L.push("| `'input-text'` | `<input [type]=\"inputType\" class=\"table-input-text\">` bound to `row[prop]` | same as input-number |");
  L.push("| `'input-select'` | `<select class=\"table-select\" [(ngModel)]=\"row[prop]\">` | options from `format`/data |");
  L.push("| `'input-radio'` | radio group in `.gateway-rcb` | — |");
  L.push("| `'input-checkbox'` | checkbox in `.gateway-rcb` | — |");
  L.push("");
  L.push("Other column facts (from `TableColumn`):");
  L.push("- `prop: 'number'` → the auto-index column: the table writes `row.number = startPage + i`");
  L.push("  itself, and the header is not sortable — declare it, do NOT render `row.number` manually.");
  L.push("- `'header-type': 'html'` → the column HEADER is rendered via `[innerHTML]` (HTML in `name`).");
  L.push("- `hide_in_mobile: true` → column hidden below the mobile breakpoint.");
  L.push("");

  // --- components ---
  L.push("## Components");
  L.push("");
  const publicComponents = PILAR_COMPONENTS.filter((c) => c.public);
  const internalComponents = PILAR_COMPONENTS.filter((c) => !c.public);
  for (const c of publicComponents) {
    L.push(`### \`<${c.selector}>\``);
    L.push("");
    if (c.inputs.length) {
      L.push("**Inputs:**");
      L.push("");
      L.push("```ts");
      for (const i of c.inputs) L.push(`  ${i.name}${i.type ? `: ${i.type}` : ""}${i.default != null ? ` = ${i.default}` : ""}`);
      L.push("```");
    }
    if (c.outputs.length) {
      L.push("**Outputs:**");
      L.push("");
      L.push("```ts");
      for (const o of c.outputs) L.push(`  ${o.name}${o.type ? `: ${o.type}` : ""}`);
      L.push("```");
    }
    if (c.template) {
      L.push("**Template shape** (real markup):");
      L.push("");
      L.push("```html");
      L.push(c.template);
      L.push("```");
    }
    L.push("");
  }
  if (internalComponents.length) {
    L.push("### Internal building blocks (do NOT emit directly)");
    L.push("");
    L.push("These are rendered BY the public components above (uii-table wraps uii-server-table /");
    L.push("uii-client-table / uii-table-action; the date-time-picker ships its own calendar internals).");
    L.push("You never write them in a slice:");
    L.push("");
    L.push(internalComponents.map((c) => `- \`<${c.selector}>\``).join("\n"));
    L.push("");
  }

  // --- directives ---
  L.push("## Directives");
  L.push("");
  for (const d of PILAR_DIRECTIVES) {
    L.push(`- \`${d.selector}\` — inputs: ${d.inputs.map((i) => `\`${i.name}\``).join(", ") || "none"}`);
  }
  L.push("");

  // --- pipes ---
  L.push("## Pipes");
  L.push("");
  L.push(PILAR_PIPES.map((p) => `- \`${p.name}\``).join("\n"));
  L.push("");

  // --- models ---
  L.push("## Models & types");
  L.push("");
  for (const m of PILAR_MODELS) {
    L.push(`### ${m.kind} \`${m.name}\``);
    L.push("");
    L.push("```ts");
    L.push(m.text);
    L.push("```");
    L.push("");
  }

  // --- services ---
  L.push("## Services");
  L.push("");
  for (const s of PILAR_SERVICES) {
    L.push(`### \`${s.name}\``);
    L.push("");
    L.push("```ts");
    L.push(s.text);
    L.push("```");
    L.push("");
  }

  // --- modules ---
  L.push("## Feature modules (the imports[] wiring)");
  L.push("");
  L.push("To use a component, import its module in the owning NgModule's `imports[]`:");
  L.push("");
  L.push("```ts");
  L.push(`import { ${PILAR_MODULES.map((m) => m.name).join(", ")} } from "pilar";`);
  L.push("```");
  L.push("");
  for (const m of PILAR_MODULES) {
    L.push(`- **\`${m.name}\`** exports: ${m.exports.map((x) => `\`${x}\``).join(", ")}`);
  }
  L.push("");

  return L.join("\n");
}

/**
 * The pilar showcase reference — the org's complete documentation + working usage examples,
 * written by `sliceui init` to `.sliceui/pilar-showcase.md` ONLY for UII projects. Renders the
 * checked-in pilar-showcase catalog so a pilar-fingerprinted project gets every doc-* example's
 * real markup/TypeScript/SCSS without the pilar repo being present.
 */
export function renderPilarShowcaseMd() {
  const L = [];
  L.push("<!-- Generated by SliceUI — pilar showcase reference (from the checked-in pilar-showcase). -->");
  L.push("");
  L.push("# pilar showcase (working examples)");
  L.push("");
  L.push("The pilar demo app's documentation — every `doc-*` showcase with its real, working usage");
  L.push("examples. Read the entry for the component you're emitting; copy its exact markup and");
  L.push("TypeScript wiring (the design's appearance still comes from the transcript/XML).");
  L.push("");

  const index = [];
  for (const e of PILAR_SHOWCASE) {
    const sectionCount = e.sections.length;
    index.push(`- [${e.title ?? e.id}](#${anchor(e.id)})${sectionCount ? ` — ${sectionCount} example${sectionCount > 1 ? "s" : ""}` : ""}`);
  }
  L.push("## Index");
  L.push("");
  L.push(index.join("\n"));
  L.push("");

  for (const e of PILAR_SHOWCASE) {
    L.push(`## ${e.title ?? e.id}`);
    L.push("");
    if (e.description) {
      L.push(e.description);
      L.push("");
    }
    if (e.selector) L.push(`- doc selector: \`${e.selector}\``);
    if (e.apiDoc?.selector) L.push(`- API selector: \`${e.apiDoc.selector}\``);
    if (e.apiDoc?.properties?.length) {
      L.push("");
      L.push("**Properties**");
      L.push("");
      L.push("| name | type | default | description |");
      L.push("|---|---|---|---|");
      for (const p of e.apiDoc.properties) {
        const name = p.name === "none" ? "" : p.name;
        if (!name) continue;
        L.push(`| \`${name}\` | ${p.type ?? ""} | ${p.default ?? ""} | ${p.description ?? ""} |`);
      }
    }
    if (e.apiDoc?.events?.length) {
      L.push("");
      L.push("**Events**");
      L.push("");
      L.push("| name | type | default | description |");
      L.push("|---|---|---|---|");
      for (const ev of e.apiDoc.events) {
        if (ev.name === "none") continue;
        L.push(`| \`${ev.name}\` | ${ev.type ?? ""} | ${ev.default ?? ""} | ${ev.description ?? ""} |`);
      }
    }
    L.push("");

    for (const s of e.sections) {
      L.push(`### ${s.title ?? s.anchor}`);
      L.push("");
      if (s.desc) {
        L.push(s.desc);
        L.push("");
      }
      if (s.html) {
        L.push("```html");
        L.push(s.html);
        L.push("```");
        L.push("");
      }
      if (s.ts && !s.ts.includes("Does not require typescript")) {
        L.push("```ts");
        L.push(s.ts);
        L.push("```");
        L.push("");
      }
      if (s.scss) {
        L.push("```scss");
        L.push(s.scss);
        L.push("```");
        L.push("");
      }
    }

    for (const x of e.extras ?? []) {
      L.push(`### \`${x.path}\``);
      L.push("");
      L.push("```");
      L.push(x.text);
      L.push("```");
      L.push("");
    }
  }

  return L.join("\n");
}

/** A stable markdown anchor for a showcase entry id (doc-table → doc-table). */
function anchor(id) {
  return String(id).toLowerCase().replace(/[^a-z0-9-]+/g, "-");
}
