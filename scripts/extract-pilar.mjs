#!/usr/bin/env node
// extract-pilar — developer-side generator that scans a pilar library checkout and emits
// src/framework/angular/pilar-catalog.mjs, the complete machine-readable inventory of the
// org's UI library: every component (selector + full @Input/@Output typing), directive, pipe,
// model/interface/enum, service, feature module, and the table action→auth→icon map.
//
// The catalog is CHECKED IN and ships inside the sliceui-skill package — the end-user never
// runs this script and never needs the pilar repo. Re-run it whenever pilar changes so the
// shipped catalog stays in sync:
//
//   node scripts/extract-pilar.mjs <path-to-pilar>   # project root OR .../src/lib
//
// Uses the `typescript` compiler AST (already a sliceui-skill dependency), not regex, so the
// extracted selectors and input/output types are exact.

import { readFileSync, readdirSync, writeFileSync, statSync, existsSync } from "node:fs";
import { join, resolve, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { parse, decoratorName, decoratorAlias, decoratorsOf } from "./lib/ts-ast-shared.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
// OUT can be overridden (tests re-run the extractor into a temp dir to diff against the
// checked-in snapshot — the dev-only source-diff round-trip test).
const OUT = process.env.SLICEUI_EXTRACT_OUT
  ? resolve(process.env.SLICEUI_EXTRACT_OUT)
  : resolve(__dirname, "../src/framework/angular/pilar-catalog.mjs");

// --- selectors a consumer never emits directly (library building blocks) ---
const INTERNAL_SELECTORS = new Set([
  // uii-table wraps these; a slice binds uii-table, not its inner server/client table.
  "uii-server-table",
  "uii-client-table",
  // table internals (action/filter/footer are rendered BY uii-table).
  "uii-table-action",
  "uii-table-filter",
  "uii-mobile-filter",
  "uii-table-footer",
  // date-time-picker internals (calendar/timer/dialog building blocks).
  "uii-date-time-timer-box",
  "uii-date-time-timer",
  "uii-date-time-picker-container",
  "uii-date-time-calendar",
  "uii-date-time-picker-multi-year-view",
  "uii-date-time-picker-year-view",
  "uii-date-time-picker-month-view",
  "uii-datetime-picker-dialog-container",
  "[uii-date-time-picker-calendar-body]",
]);

/** Resolve the pilar `src/lib` directory from a project root or a lib path. */
function resolveLibDir(arg) {
  const p = resolve(arg);
  if (existsSync(join(p, "pilar.module.ts")) && existsSync(join(p, "components"))) return p;
  const viaProject = join(p, "projects/uiigateway/pilar/src/lib");
  if (existsSync(join(viaProject, "pilar.module.ts"))) return viaProject;
  throw new Error(`Cannot find pilar src/lib under ${p}`);
}

function walk(dir, ext, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, ext, out);
    else if (ext.some((e) => name.endsWith(e)) && !name.endsWith(".spec.ts")) out.push(p);
  }
  return out;
}

function read(p) { return readFileSync(p, "utf8"); }

// parse / decoratorName / decoratorAlias / decoratorsOf: shared from ./lib/ts-ast-shared.mjs

/** Extract a class's @Input / @Output members with types + defaults. */
function extractMembers(text) {
  const sf = parse(text);
  const inputs = [];
  const outputs = [];
  const seenInput = new Set();
  const seenOutput = new Set();

  function pushInput(entry) {
    const key = entry.name;
    if (!key || seenInput.has(key)) return;
    seenInput.add(key);
    inputs.push(entry);
  }
  function pushOutput(entry) {
    const key = entry.name;
    if (!key || seenOutput.has(key)) return;
    seenOutput.add(key);
    outputs.push(entry);
  }

  function visit(node) {
    if (ts.isClassDeclaration(node)) {
      for (const member of node.members) {
        const decos = decoratorsOf(member);
        let isInput = false, isOutput = false, alias = null;
        for (const d of decos) {
          const n = decoratorName(d);
          if (n === "Input") { isInput = true; alias = decoratorAlias(d) || alias; }
          if (n === "Output") { isOutput = true; alias = decoratorAlias(d) || alias; }
        }
        if (!isInput && !isOutput) continue;

        let name = null, type = null, init = null;
        if (ts.isPropertyDeclaration(member)) {
          name = member.name.getText(sf);
          type = member.type ? member.type.getText(sf) : null;
          init = member.initializer ? member.initializer.getText(sf) : null;
          // @Output() foo = new EventEmitter<T>(); — recover T as the type.
          if (!type && init) {
            const em = /new\s+EventEmitter\s*<([^>]*)>/.exec(init);
            if (em) type = em[1].trim() || "any";
          }
        } else if (ts.isSetAccessorDeclaration(member)) {
          name = member.name.getText(sf);
          const p0 = member.parameters[0];
          type = p0 && p0.type ? p0.type.getText(sf) : null;
        } else if (ts.isGetAccessorDeclaration(member)) {
          name = member.name.getText(sf);
          type = member.type ? member.type.getText(sf) : null;
        } else if (ts.isMethodDeclaration(member)) {
          name = member.name.getText(sf);
        }
        if (!name) continue;

        const entry = { name: alias || name };
        if (type) entry.type = type;
        if (init) entry.default = init;
        if (isInput) pushInput(entry);
        if (isOutput) pushOutput(entry);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sf);
  return { inputs, outputs };
}

/** @Component / @Directive metadata: selector, template (inline) or templateUrl. */
function extractComponentMeta(text, kind = "Component") {
  const sf = parse(text);
  let meta = null;
  function visit(node) {
    if (meta) return;
    if (ts.isClassDeclaration(node)) {
      for (const d of decoratorsOf(node)) {
        if (decoratorName(d) !== kind) continue;
        const expr = d.expression;
        const objArg = ts.isCallExpression(expr) ? expr.arguments[0] : null;
        if (!objArg || !ts.isObjectLiteralExpression(objArg)) continue;
        const props = new Map();
        for (const p of objArg.properties) {
          if (ts.isPropertyAssignment(p) && ts.isIdentifier(p.name)) {
            const key = p.name.text;
            if (ts.isStringLiteral(p.initializer)) props.set(key, p.initializer.text);
            else if (ts.isNoSubstitutionTemplateLiteral(p.initializer)) props.set(key, p.initializer.text);
          }
        }
        const hasTemplate = objArg.properties.some((p) => ts.isPropertyAssignment(p) && ts.isIdentifier(p.name) && p.name.text === "template");
        meta = {
          selector: props.get("selector") || null,
          inlineTemplate: hasTemplate ? extractTemplateText(objArg, sf) : null,
          templateUrl: props.get("templateUrl") || null,
          className: node.name ? node.name.text : null,
        };
        return;
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sf);
  return meta;
}

function extractTemplateText(objArg, sf) {
  for (const p of objArg.properties) {
    if (ts.isPropertyAssignment(p) && ts.isIdentifier(p.name) && p.name.text === "template") {
      let t;
      if (ts.isNoSubstitutionTemplateLiteral(p.initializer)) t = p.initializer.text;
      else if (ts.isStringLiteral(p.initializer)) t = p.initializer.text;
      else t = p.initializer.getText(sf);
      return truncate(t.trim());
    }
  }
  return null;
}

/** Cap inline templates: the giant uii-table / uii-wizard templates are internal wiring, not
 *  consumer-facing shape — a concise cap keeps the catalog lean while preserving small
 *  inline templates (uii-information, uii-tooltip) verbatim. */
function truncate(text, cap = 800) {
  if (text.length <= cap) return text;
  return text.slice(0, cap) + "\n… (truncated)";
}

/** Resolve a component's actual template HTML: inline template if present, else the
 *  templateUrl .html file read from disk. Capped so a single component can't bloat the catalog. */
function resolveTemplateHtml(comp, tsFilePath) {
  if (comp.inlineTemplate) return comp.inlineTemplate;
  if (comp.templateUrl) {
    const abs = join(dirname(tsFilePath), comp.templateUrl);
    try { return truncate(read(abs).trim(), 1500); } catch { return null; }
  }
  return null;
}

/** Top-level `export const NAME = { … }` object declarations (e.g. MODAL, AUTH_TYPE), with
 *  their full source text. Base64 string constants (IMAGE_*_PLACEHOLDER) are skipped — pure
 *  noise for an agent and they bloat the catalog. */
function extractConstObjects(text) {
  const sf = parse(text);
  const out = [];
  for (const st of sf.statements) {
    if (!ts.isVariableStatement(st)) continue;
    for (const decl of st.declarationList.declarations) {
      if (!ts.isIdentifier(decl.name) || !decl.initializer || !ts.isObjectLiteralExpression(decl.initializer)) continue;
      const name = decl.name.text;
      if (/PLACEHOLDER/.test(name)) continue; // base64 blobs
      out.push({ name, text: st.getText(sf) });
    }
  }
  return out;
}

/** Top-level type declarations (interface/class/enum/type alias) with their full source text. */
function extractTypeDeclarations(text) {
  const sf = parse(text);
  const out = [];
  for (const st of sf.statements) {
    if (ts.isInterfaceDeclaration(st)) {
      out.push({ name: st.name.text, kind: "interface", text: st.getText(sf) });
    } else if (ts.isTypeAliasDeclaration(st)) {
      out.push({ name: st.name.text, kind: "type", text: st.getText(sf) });
    } else if (ts.isEnumDeclaration(st)) {
      out.push({ name: st.name.text, kind: "enum", text: st.getText(sf) });
    } else if (ts.isClassDeclaration(st) && st.name) {
      out.push({ name: st.name.text, kind: "class", text: st.getText(sf) });
    }
  }
  return out;
}

/** A service class: name + public method signatures + full class text.
 *  Prefers the @Injectable-decorated class (a service file may declare auxiliary classes first,
 *  e.g. loadingBar.service.ts declares LoadingBarEvent before LoadingBarService). */
function extractService(text) {
  const sf = parse(text);
  const classes = [];
  function visit(node) {
    if (ts.isClassDeclaration(node) && node.name) {
      const isInjectable = decoratorsOf(node).some((d) => decoratorName(d) === "Injectable");
      const methods = [];
      for (const member of node.members) {
        if (ts.isMethodDeclaration(member) && member.name) {
          methods.push({ name: member.name.getText(sf), text: member.getText(sf) });
        } else if (ts.isGetAccessorDeclaration(member) && member.name) {
          methods.push({ name: `get ${member.name.getText(sf)}`, text: member.getText(sf) });
        } else if (ts.isSetAccessorDeclaration(member) && member.name) {
          methods.push({ name: `set ${member.name.getText(sf)}`, text: member.getText(sf) });
        }
      }
      classes.push({ name: node.name.text, methods, text: node.getText(sf), isInjectable });
    }
    ts.forEachChild(node, visit);
  }
  visit(sf);
  // Prefer the @Injectable class, then a *Service-named class, then the first class.
  const svc = classes.find((c) => c.isInjectable)
    || classes.find((c) => /Service$/.test(c.name))
    || classes[0];
  if (!svc) return null;
  const { isInjectable, ...out } = svc;
  return out;
}

/** A feature module: name + its declared/exported symbols. */
function extractModule(text) {
  const sf = parse(text);
  let out = null;
  function visit(node) {
    if (out) return;
    if (ts.isClassDeclaration(node) && node.name && node.name.text.endsWith("Module")) {
      let meta = null;
      for (const d of decoratorsOf(node)) {
        if (decoratorName(d) !== "NgModule") continue;
        const expr = d.expression;
        const objArg = ts.isCallExpression(expr) ? expr.arguments[0] : null;
        if (!objArg || !ts.isObjectLiteralExpression(objArg)) continue;
        const readArr = (key) => {
          for (const p of objArg.properties) {
            if (ts.isPropertyAssignment(p) && ts.isIdentifier(p.name) && p.name.text === key && ts.isArrayLiteralExpression(p.initializer)) {
              return p.initializer.elements.map((e) => {
                const t = e.getText(sf);
                return t.split(".").pop().replace(/[^A-Za-z0-9_$]/g, "");
              }).filter(Boolean);
            }
          }
          return [];
        };
        meta = { declares: readArr("declarations"), exports: readArr("exports"), imports: readArr("imports") };
      }
      if (meta) out = { name: node.name.text, ...meta };
      return;
    }
    ts.forEachChild(node, visit);
  }
  visit(sf);
  return out;
}

/** @Pipe name. */
function extractPipeName(text) {
  const sf = parse(text);
  let out = null;
  function visit(node) {
    if (out) return;
    if (ts.isClassDeclaration(node)) {
      for (const d of decoratorsOf(node)) {
        if (decoratorName(d) !== "Pipe") continue;
        const expr = d.expression;
        const objArg = ts.isCallExpression(expr) ? expr.arguments[0] : null;
        if (objArg && ts.isObjectLiteralExpression(objArg)) {
          for (const p of objArg.properties) {
            if (ts.isPropertyAssignment(p) && ts.isIdentifier(p.name) && p.name.text === "name" && ts.isStringLiteral(p.initializer)) {
              out = p.initializer.text;
            }
          }
        }
      }
      if (node.name && !out) out = node.name.text;
    }
    ts.forEachChild(node, visit);
  }
  visit(sf);
  return out;
}

/** The table action→auth→icon map, from table-action.component.ts `actionConfigs`.
 *  `suffix` is a `AUTH_TYPE.X` const reference — resolved against the AUTH_TYPE map so the
 *  catalog carries its literal value (the `rightClickAction` payload's `suffix` field). */
function extractActionConfigs(text) {
  const sf = parse(text);

  // Resolve `export const AUTH_TYPE = { POSTING: 'posting', … }`.
  const authType = {};
  function visitAuthType(node) {
    if (ts.isVariableStatement(node)) {
      for (const decl of node.declarationList.declarations) {
        if (ts.isIdentifier(decl.name) && decl.name.text === "AUTH_TYPE" && decl.initializer && ts.isObjectLiteralExpression(decl.initializer)) {
          for (const p of decl.initializer.properties) {
            if (ts.isPropertyAssignment(p) && ts.isIdentifier(p.name) && ts.isStringLiteral(p.initializer)) {
              authType[p.name.text] = p.initializer.text;
            }
          }
        }
      }
    }
    ts.forEachChild(node, visitAuthType);
  }
  visitAuthType(sf);

  const out = [];
  function strProp(obj, key) {
    for (const p of obj.properties) {
      if (ts.isPropertyAssignment(p) && ts.isIdentifier(p.name) && p.name.text === key && ts.isStringLiteral(p.initializer)) {
        return p.initializer.text;
      }
    }
    return null;
  }
  function suffixValue(obj) {
    for (const p of obj.properties) {
      if (ts.isPropertyAssignment(p) && ts.isIdentifier(p.name) && p.name.text === "suffix") {
        if (ts.isStringLiteral(p.initializer)) return p.initializer.text;
        // AUTH_TYPE.X → resolve against the const map; fall back to the raw text.
        const raw = p.initializer.getText(sf);
        const m = /AUTH_TYPE\s*\.\s*([A-Za-z_]+)/.exec(raw);
        if (m && authType[m[1]] != null) return authType[m[1]];
        return raw;
      }
    }
    return null;
  }
  function visit(node) {
    if (ts.isPropertyDeclaration(node) && node.name.getText(sf) === "actionConfigs" && node.initializer && ts.isArrayLiteralExpression(node.initializer)) {
      for (const el of node.initializer.elements) {
        if (!ts.isObjectLiteralExpression(el)) continue;
        const type = strProp(el, "type");
        const authKey = strProp(el, "authKey");
        if (!type || !authKey) continue;
        out.push({
          type,
          authKey,
          iconClass: strProp(el, "iconClass"),
          iconType: strProp(el, "iconType"),
          suffix: suffixValue(el),
        });
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sf);
  return out;
}

// ---------- main ----------

function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.error("usage: node scripts/extract-pilar.mjs <path-to-pilar>");
    process.exit(2);
  }
  const libDir = resolveLibDir(arg);
  const rel = (p) => relative(libDir, p);

  const components = [];
  const directives = [];
  const pipes = [];
  const models = [];
  const services = [];
  const modules = [];

  const componentFiles = walk(join(libDir, "components"), [".ts"]);
  for (const f of componentFiles) {
    const text = read(f);
    const compMeta = extractComponentMeta(text, "Component");
    if (!compMeta || !compMeta.selector) continue;
    const { inputs, outputs } = extractMembers(text);
    components.push({
      selector: compMeta.selector,
      className: compMeta.className,
      path: rel(f),
      public: !INTERNAL_SELECTORS.has(compMeta.selector),
      template: resolveTemplateHtml(compMeta, f),
      inputs,
      outputs,
    });
  }

  const directiveFiles = walk(join(libDir, "directives"), [".ts"]);
  for (const f of directiveFiles) {
    const text = read(f);
    const meta = extractComponentMeta(text, "Directive");
    if (!meta || !meta.selector) continue;
    const { inputs, outputs } = extractMembers(text);
    directives.push({
      selector: meta.selector,
      className: meta.className,
      path: rel(f),
      public: !INTERNAL_SELECTORS.has(meta.selector),
      inputs,
      outputs,
    });
  }

  for (const f of walk(join(libDir, "pipes"), [".ts"])) {
    const name = extractPipeName(read(f));
    if (name) pipes.push({ name, path: rel(f) });
  }

  for (const f of walk(join(libDir, "models"), [".ts"])) {
    for (const decl of extractTypeDeclarations(read(f))) {
      models.push({ ...decl, path: rel(f) });
    }
  }

  for (const f of walk(join(libDir, "services"), [".ts"])) {
    const text = read(f);
    const svc = extractService(text);
    if (svc) services.push({ ...svc, path: rel(f) });
    // A service file may also declare auxiliary public types (e.g. loadingBar.service.ts
    // declares the LoadingBarEvent class + LoadingBarEventType enum). Capture them as models
    // so the typing is complete — excluding the service class itself.
    for (const decl of extractTypeDeclarations(text)) {
      if (svc && decl.name === svc.name) continue;
      if (decl.kind === "class" && /Service$/.test(decl.name)) continue;
      models.push({ ...decl, path: rel(f) });
    }
  }

  // Lib-root files exported by pilar's public_api but not under models/ or services/. Their
  // types close the model dependency graph: pilar.model.ts exports CssStyle (referenced by
  // FormLoaderDefs/ModalOptions/…); pilar.constant.ts exports MODAL (dialog size classes).
  // The base64 IMAGE_*_PLACEHOLDER blobs are deliberately skipped (pure noise for an agent).
  for (const base of ["pilar.model.ts", "pilar.constant.ts"]) {
    const f = join(libDir, base);
    if (!existsSync(f)) continue;
    const text = read(f);
    for (const decl of extractTypeDeclarations(text)) {
      models.push({ ...decl, path: rel(f) });
    }
    for (const decl of extractConstObjects(text)) {
      models.push({ ...decl, kind: "const", path: rel(f) });
    }
  }

  // AUTH_TYPE from table-action.component.ts — the action-suffix enum pilar's right-click
  // payload carries (`suffix` in actionConfigs already carries the VALUES; the const itself
  // makes the mapping explicit for the agent).
  const authType = extractConstObjects(read(join(libDir, "components/table/common/table-action/table-action.component.ts")))
    .find((d) => d.name === "AUTH_TYPE");
  if (authType) {
    models.push({ ...authType, kind: "const", path: rel(join(libDir, "components/table/common/table-action/table-action.component.ts")) });
  }

  for (const f of walk(join(libDir, "modules"), [".ts"])) {
    const mod = extractModule(read(f));
    if (mod) modules.push({ ...mod, path: rel(f) });
  }

  // action→auth→icon map from the real table-action component.
  const actionConfigs = extractActionConfigs(read(join(libDir, "components/table/common/table-action/table-action.component.ts")));

  // pilar version from the library's own package.json (projects/uiigateway/pilar/package.json).
  let version = null;
  const pkgCandidates = [join(libDir, "../../package.json"), join(libDir, "../../../../package.json"), join(libDir, "../../../../../../package.json")];
  for (const p of pkgCandidates) {
    try { version = JSON.parse(read(resolve(p))).version; break; } catch {}
  }

  const src = renderCatalog({ components, directives, pipes, models, services, modules, actionConfigs, version, libDir });
  writeFileSync(OUT, src);
  console.log(`Wrote ${OUT}`);
  console.log(`  components: ${components.length} (public: ${components.filter((c) => c.public).length})`);
  console.log(`  directives: ${directives.length}  pipes: ${pipes.length}`);
  console.log(`  models: ${models.length}  services: ${services.length}  modules: ${modules.length}`);
  console.log(`  actionConfigs: ${actionConfigs.length}`);
}

function renderCatalog(data) {
  const J = (v) => JSON.stringify(v, null, 2);
  return `// pilar-catalog.mjs — GENERATED by scripts/extract-pilar.mjs. Do not edit by hand.
// Complete machine-readable inventory of the org's pilar UI library, checked in so the
// agent can write type-accurate pilar code WITHOUT the pilar repo being present on the
// end-user's machine. Regenerate after a pilar change:
//   node scripts/extract-pilar.mjs <path-to-pilar>
// Source: ${data.libDir}
// pilar version: ${data.version ?? "unknown"}
// Generated at: ${new Date().toISOString()}

export const PILAR_VERSION = ${J(data.version)};

/** Every @Component in pilar: selector, full @Input/@Output typing, template location, and
 *  whether a consumer writes it directly (\`public: true\`) or it is a library-internal
 *  building block the consumer never emits (\`public: false\`). */
export const PILAR_COMPONENTS = ${J(data.components)};

/** Every @Directive (attribute/structural selectors like \`[uiiTooltip]\`). */
export const PILAR_DIRECTIVES = ${J(data.directives)};

/** Every @Pipe. */
export const PILAR_PIPES = ${J(data.pipes)};

/** Every model/interface/enum/type the library exposes (full source text = exact typing). */
export const PILAR_MODELS = ${J(data.models)};

/** Every service + its public method signatures (full class text = exact typing). */
export const PILAR_SERVICES = ${J(data.services)};

/** Feature modules and the symbols they declare/export (the imports[] wiring the agent must do). */
export const PILAR_MODULES = ${J(data.modules)};

/** The table action→auth→icon truth table, extracted from TableActionComponent.actionConfigs.
 *  A uii-table renders an action icon only when the row's auth.<authKey> is truthy. */
export const PILAR_ACTION_CONFIGS = ${J(data.actionConfigs)};
`;
}

main();
