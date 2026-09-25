// ts-ast — TypeScript AST helpers (via the `typescript` compiler).
// Robust import/decorator extraction — replaces fragile regex for .ts files.

import ts from "typescript";

/**
 * Extract import sources from a TS file's text.
 * @param {string} source
 * @returns {string[]}
 */
export function importSources(source) {
  const sf = ts.createSourceFile("x.ts", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const sources = [];
  for (const st of sf.statements) {
    if (ts.isImportDeclaration(st) && st.moduleSpecifier && ts.isStringLiteral(st.moduleSpecifier)) {
      sources.push(st.moduleSpecifier.text);
    }
  }
  return sources;
}

/**
 * Find all import sources that reference a given package name (substring).
 * @param {string} source
 * @param {string} pkg
 * @returns {boolean}
 */
export function importsPackage(source, pkg) {
  return importSources(source).some((s) => s.includes(pkg));
}

/**
 * Extract @Component decorator metadata (selector, templateUrl, styleUrls) if present.
 * @param {string} source
 * @returns {{ selector: string|null, templateUrl: string|null, styleUrls: string[] } | null}
 */
export function componentMeta(source) {
  const sf = ts.createSourceFile("x.ts", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  let meta = null;
  const visit = (node) => {
    if (ts.isClassDeclaration(node) && node.decorators) {
      for (const d of node.decorators) {
        const expr = d.expression;
        if (ts.isCallExpression(expr) && expr.expression.getText(sf) === "Component") {
          const arg = expr.arguments[0];
          if (arg && ts.isObjectLiteralExpression(arg)) {
            meta = {};
            for (const prop of arg.properties) {
              if (ts.isPropertyAssignment(prop) && ts.isIdentifier(prop.name)) {
                const key = prop.name.text;
                if (key === "selector" && ts.isStringLiteral(prop.initializer)) meta.selector = prop.initializer.text;
                if (key === "templateUrl" && ts.isStringLiteral(prop.initializer)) meta.templateUrl = prop.initializer.text;
                if (key === "styleUrls" && ts.isArrayLiteralExpression(prop.initializer)) {
                  meta.styleUrls = prop.initializer.elements
                    .filter(ts.isStringLiteral)
                    .map((e) => e.text);
                }
              }
            }
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return meta;
}

/**
 * Named imports whose binding is never referenced elsewhere in the file (a dead import).
 * Conservative: only flags named bindings (not `import * as x` / side-effect imports), and only
 * when the source has no other identifier of the same name anywhere (including in types).
 * @param {string} source
 * @returns {string[]} unused named import specifiers, e.g. ["AuthorizationModel"]
 */
export function unusedImports(source) {
  const sf = ts.createSourceFile("x.ts", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const unused = [];
  for (const st of sf.statements) {
    if (!ts.isImportDeclaration(st) || !st.importClause) continue;
    const named = st.importClause.namedBindings;
    if (!named || !ts.isNamedImports(named)) continue;
    for (const el of named.elements) {
      const localName = el.name.getText(sf);
      if (identifierCount(sf, localName) <= 1) unused.push(localName);
    }
  }
  return unused;
}

/** Count how many times an identifier appears in a source file (declaration included). */
function identifierCount(sf, name) {
  let count = 0;
  const visit = (node) => {
    if (ts.isIdentifier(node) && node.text === name) count++;
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return count;
}

/**
 * Constructor parameters (injected services) that are never referenced in the class body.
 * A `constructor(private svc: FooService) {}` whose `svc` never appears outside the parameter
 * list is an injected-but-unused dependency. Conservative: ignores a bare constructor with no
 * body references by only flagging params whose name count in the file is exactly 1.
 * @param {string} source
 * @returns {string[]} unused constructor parameter names
 */
export function unusedConstructorParams(source) {
  const sf = ts.createSourceFile("x.ts", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const unused = [];
  const visit = (node) => {
    if (ts.isConstructorDeclaration(node) && node.body) {
      for (const p of node.parameters) {
        const name = p.name.getText(sf);
        if (identifierCount(sf, name) <= 1) unused.push(name);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return unused;
}
