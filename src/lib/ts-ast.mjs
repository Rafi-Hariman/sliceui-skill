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
