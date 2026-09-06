// ts-ast-shared — AST helpers shared by BOTH pilar extractors (extract-pilar.mjs and
// extract-pilar-showcase.mjs). Single home so the two scripts can't drift apart on how they
// parse/decorate-walk TS (the council's split-brain point).

import ts from "typescript";
import { join } from "node:path";

/** Parse TS text into a SourceFile. */
export function parse(text) {
  return ts.createSourceFile("x.ts", text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
}

/** Decorator name: `@Foo` → "Foo", `@Foo(...)` → "Foo". */
export function decoratorName(d) {
  const expr = d.expression;
  if (ts.isIdentifier(expr)) return expr.text;
  if (ts.isCallExpression(expr) && ts.isIdentifier(expr.expression)) return expr.expression.text;
  return null;
}

/** String-literal first argument of a decorator (e.g. @Input('isActive')), or null. */
export function decoratorAlias(d) {
  const expr = d.expression;
  if (ts.isCallExpression(expr) && expr.arguments[0] && ts.isStringLiteral(expr.arguments[0])) {
    return expr.arguments[0].text;
  }
  return null;
}

/** All decorators of a node that can have them. */
export function decoratorsOf(node) {
  return (ts.canHaveDecorators(node) && ts.getDecorators(node)) || [];
}

/** A local-import map: identifier → absolute path (relative imports only). */
export function buildImportMap(text, fromDir) {
  const sf = parse(text);
  const map = {};
  for (const st of sf.statements) {
    if (!ts.isImportDeclaration(st) || !ts.isStringLiteral(st.moduleSpecifier)) continue;
    const spec = st.moduleSpecifier.text;
    if (!spec.startsWith(".")) continue;
    const abs = join(fromDir, spec + (spec.endsWith(".ts") ? "" : ".ts"));
    const clause = st.importClause;
    if (clause && clause.name) map[clause.name.text] = abs; // default import
    if (clause && clause.namedBindings && ts.isNamedImports(clause.namedBindings)) {
      for (const el of clause.namedBindings.elements) map[el.name.text] = abs;
    }
  }
  return map;
}
