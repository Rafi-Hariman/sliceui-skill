// pilar-typecheck — type-check a generated slice against the pilar API (from the catalog).
//
// verify.mjs checks binding NAMES (regex); this module checks TYPE correctness of the slice's
// TypeScript body against the catalog's declared types. It generates a deterministic `.d.ts`
// stub from the catalog (components as classes with typed @Input/@Output members, models as
// interface/type/class, services as classes) and runs ts.createProgram(noEmit) over the slice
// together with that stub.
//
// Chain of trust (non-circular): pilar source → (extract-pilar + source-diff test) → catalog →
// stub → type-check. The ground-truth anchor is the source-diff test (test/pilar-roundtrip).
//
// Boundary (documented, not silent): this type-checks the slice's TS BODY (model imports, field
// types like TableColumn[], service usage). Full TEMPLATE type-check needs @angular/compiler-cli
// and a real Angular project — out of scope here; template binding NAMES are gated by
// verify's pilarBindings, and template RENDER is proven by pilar-mount (dev-only).

import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ts from "typescript";
import {
  PILAR_COMPONENTS,
  PILAR_MODELS,
  PILAR_SERVICES,
} from "./pilar-catalog.mjs";

/** A safe TS identifier for a selector (`[uiiTooltip]` → `UiiTooltipComponent`). */
function classIdFor(selector) {
  const base = String(selector)
    .replace(/^\[|\]$/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .split("-")
    .filter(Boolean)
    .map((s) => s[0].toUpperCase() + s.slice(1))
    .join("");
  return base ? `${base}Component` : "PilarComponent";
}

/**
 * Emit a deterministic .d.ts stub from the catalog. Components become exported classes whose
 * members carry the catalog's @Input/@Output types (as `public` fields). Models/services are
 * emitted verbatim (their `text` is already valid TS declarations with no imports).
 */
export function generatePilarDts() {
  const L = [];
  L.push("// AUTO-GENERATED pilar type stub (from pilar-catalog.mjs). Do not edit.");

  // Models first (components reference their types, e.g. TableColumn, PilTablePage).
  for (const m of PILAR_MODELS) {
    // Model text is an `export …` declaration; emit as-is (it carries no imports).
    L.push(m.text);
  }

  // Services (ToastService etc.) — emit verbatim; their own types resolve from models above.
  for (const s of PILAR_SERVICES) {
    L.push(s.text);
  }

  // Components: a class per selector with typed public members. Inputs are the bindable API;
  // outputs are EventEmitter<T> (declared in the ambient @angular/core module, emitted as a
  // sibling file by angularAmbientDts()). We reference the ambient EventEmitter directly.
  L.push("/// <reference path=\"./angular-ambient.d.ts\" />");
  for (const c of PILAR_COMPONENTS) {
    const name = classIdFor(c.selector);
    const members = [];
    for (const i of c.inputs) {
      members.push(`  ${i.name}: ${cleanType(i.type)};`);
    }
    for (const o of c.outputs) {
      members.push(`  ${o.name}: EventEmitter<${cleanType(o.type)}>;`);
    }
    L.push(`export class ${name} {\n${members.join("\n")}\n}`);
  }
  return L.join("\n\n");
}

/** Ambient @angular/core declaration — a SEPARATE .d.ts with NO top-level import/export (a true
 *  global ambient declaration). Declaring it inside pilar-stub.d.ts would make it a module
 *  AUGMENTATION (which fails because @angular/core doesn't exist in the fixture), not a fresh
 *  module. Runtime is irrelevant — this only feeds the type-checker. */
export function angularAmbientDts() {
  return `declare module "@angular/core" {
  export function Component(opts: any): ClassDecorator;
  export function Directive(opts: any): ClassDecorator;
  export function Injectable(opts?: any): ClassDecorator;
  export function Input(alias?: string): PropertyDecorator;
  export function Output(alias?: string): PropertyDecorator;
  export class EventEmitter<T = any> { emit(value: T): void; subscribe(observer: any): any; }
  export interface OnInit { ngOnInit(): void; }
}`;
}

/** A catalog `type` string is already TypeScript (`Array<TableColumn>`, `'left' | 'right'`,
 *  `boolean`, `TableLimitOptions`). A null/undefined type defaults to `any`. */
function cleanType(t) {
  const s = String(t ?? "").trim();
  return s || "any";
}

/**
 * Type-check a slice's TS body against the catalog stub.
 * @param {object} opts
 * @param {string} opts.ts — the slice component's TypeScript source
 * @returns {{ ok: boolean, diagnostics: Array<{ file, message }> }}
 */
export function typeCheckSlice({ ts: tsSource }) {
  const dts = generatePilarDts();
  const dir = mkdtempSync(join(tmpdir(), "sliceui-typecheck-"));
  try {
    const stubPath = join(dir, "pilar-stub.d.ts");
    const ambientPath = join(dir, "angular-ambient.d.ts");
    const slicePath = join(dir, "slice.ts");
    writeFileSync(stubPath, dts);
    writeFileSync(ambientPath, angularAmbientDts());
    // Rewrite the slice's `from "pilar"` imports to the stub path so model/component types resolve.
    const slice = String(tsSource).replace(/from\s+["']pilar["']/g, `from "./pilar-stub"`);
    writeFileSync(slicePath, slice);

    const program = ts.createProgram([slicePath, stubPath, ambientPath], {
      noEmit: true,
      strict: false,
      skipLibCheck: true,
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.NodeJs,
      types: [],
      baseUrl: dir,
    });
    const diagnostics = ts.getPreEmitDiagnostics(program)
      .filter((d) => d.file)
      .map((d) => ({
        file: d.file?.fileName?.split("/").pop() ?? "",
        message: ts.flattenDiagnosticMessageText(d.messageText, " "),
      }));
    return { ok: diagnostics.length === 0, diagnostics };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
