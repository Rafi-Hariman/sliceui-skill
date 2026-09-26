// verify — deterministic "is this generated component faithful to (a) the design transcript
// and (b) the project's conventions" checks. Emits structured verdicts, not prose: each
// check returns { name, status: pass|fail|skip, detail }. The gate must be able to say
// "I cannot verify this" — a check that lacks its ground truth reports `skip`, never pass.
//
// Checks, each closing a known defect class from the history-agreement audit:
//   1. scssCoverage  — every ::ng-deep selector in the conventions corpus survived verbatim
//   2. textCoverage  — fidelity-critical text (buttons/placeholders/title) not dropped
//   3. tableBindings — legal binding set, checkbox evidenced by RAW XML (not transcript)
//   4. classVocabulary — reuse the project's classes; invented status labels are warn
//   5. anatomy       — table present ⇒ skeleton loading state present
//   6. mockRowCount  — paginated table renders exactly `mockRowsFloor` (default 15) mock rows
//   7. noHashedSelectors — reject compiled [_ngcontent-*] leaked into source
//   8. iconColor     — status-icon color must be a design color (no invented mapping)
//   9. phantomWrapper — no structural wrapper beyond the XML
//  10. ngxSelectBinding — every <ngx-select> carries [(ngModel)] + (select) (dead-filter defect)
//  11. rowAuth       — action-column rows carry the auth flags pilar needs to render icons
//  12. filterRowButton — filter-row buttons in the XML (e.g. "Cari") are not dropped
//  13. buttonOrder   — paired action buttons match the XML's left→right order (no row-reverse)
//  14. tableOptions  — search/limit/pagination bindings map XML evidence (incl. paginationAlign)
//  14b. alignmentViaDeepCss — SUI006: footer/pagination alignment via ::ng-deep instead of the
//      component's public input (warn — see the 23 Sep 2026 report §4.4 / §7 SUI006)
//  14c. requiredMarker — a required marker emitted-but-hidden, or reconstructed for an optional
//      field, is unrequested output (report §4.5)
//  14d. containerPadding — an authored padding the design's explicit XML values don't state
//  14e. inventedLayout — box-shadow/max-width/absolute/margin-auto with no design evidence (warn)
//      (report §4.1)
//  15. gridColumns   — a filter row's col-*-N spans must sum to ≤ 12 (no wrapped children)
//  16. noTranslation — no `| translate` pipe (SliceUI emits literal text, never i18n)
//  17. inventedUtility — no atomic utility class (w-100/mr-2/gap-2/rounded-xl) the project never uses

import { LIBRARY_INTERNAL, LIBRARY_INTERNAL_WRAPPER_GUARD, TRIVIAL_CLASS } from "./conventions.mjs";
import { walkNodes } from "../../lib/walk-nodes.mjs";
import { parseFigml } from "../../lib/figml-parse.mjs";
import { unusedImports, unusedConstructorParams } from "../../lib/ts-ast.mjs";
import { decorateCheck, primaryState } from "../../lib/diagnostics.mjs";

/** Pseudo-class/state tokens that never count as a distinctive class token of a selector. */
const PSEUDO = new Set(["hover", "focus", "active", "first-child", "last-child", "nth-child", "before", "after", "checked", "disabled"]);


/**
 * @param {object} args
 * @param {string} args.scss — generated component SCSS
 * @param {string} args.html — generated component HTML
 * @param {string} args.ts   — generated component TS
 * @param {object} [args.conventions] — extractConventions() output (or conventions.json)
 * @param {object} [args.transcript] — the transcript JSON object
 * @param {string} [args.rawXml] — the source FIGML XML (checkbox evidence)
 * @param {object|null} [args.pilar] — pilar feature data (from loadPilar()); null when pilar is
 *   stripped from the install. The uii-table binding-policy / catalog / row-auth checks only run
 *   when pilar is present; a null pilar degrades them to `skip` so a non-UII (public) install
 *   never crashes and never needs the private pilar modules.
 * @returns {{ checks: Array, pass: boolean, failCount: number, skipCount: number, warnCount: number }}
 */
export function verifyComponent({ scss = "", html = "", ts = "", conventions, transcript, rawXml, pilar = null, modules = "", framework = null } = {}) {
  const rawChecks = [
    checkScssCompiles(scss),
    checkScssCoverage(scss, html, conventions?.ngDeepCorpus),
    checkTextCoverage(html, transcript),
    checkTableBindings(html, rawXml, pilar),
    checkPilarBindings(html, pilar),
    checkDeadCode(ts),
    checkClassVocabulary(scss + " " + html + " " + ts, conventions?.classVocabulary, conventions?.ngDeepCorpus),
    checkAnatomy(html, conventions?.componentAnatomy),
    checkMockRowCount(html, ts, conventions?.componentAnatomy, transcript),
    checkNoHashedSelectors(scss),
    checkNoBareNgDeep(scss, conventions?.ngDeepCorpus),
    checkAlignmentViaDeepCss(scss),
    checkRequiredMarker(html),
    checkContainerPadding(html, scss, transcript),
    checkInventedLayout(scss, transcript),
    checkIconColor(ts + " " + scss, transcript),
    checkPhantomWrapper(html, transcript, conventions?.componentAnatomy),
    checkModalWrapper(html, transcript),
    checkNgxSelectBinding(html),
    checkRowAuth(html, ts, rawXml, pilar),
    checkFilterRowButton(html, rawXml),
    checkButtonOrder(html, scss, rawXml),
    checkTableOptions(html, rawXml),
    checkGridColumns(html),
    checkNoTranslation(html, ts),
    checkInventedUtility(html, conventions?.classVocabulary),
    checkStyleFidelity(scss, html, transcript, conventions),
    checkLibraryTable(html, conventions?.componentAnatomy, transcript, rawXml),
    checkLoadedClass(html, conventions?.loadedClassRegistry),
    checkPilarInjection(scss, html, ts, pilar),
    checkDeclaredInModule(ts, modules),
    checkFrameworkSyntax(ts, html, framework),
  ];
  // PR 5 — decorate each check with its stable diagnostic metadata (id / category / trust /
  // severity). Additive: the original { name, status, detail, ... } fields are preserved.
  const checks = rawChecks.map(decorateCheck);
  const failCount = checks.filter((c) => c.status === "fail").length;
  const warnCount = checks.filter((c) => c.status === "warn").length;
  const skipCount = checks.filter((c) => c.status === "skip").length;
  // A run with NO ground truth at all (no conventions.json, no transcript, no rawXml — the
  // uninitialized-project / wrong-directory case) must NOT be green. Without a reference
  // there is nothing to verify against; a green here is the false-confidence machine. The
  // council's literal `skipCount === 0` was rejected (over-blocks components with no table),
  // but requiring SOME ground truth is the honest gate. Note: an uninitialized project can
  // still "pass" tableBindings/anatomy/mockRowCount (self-verifiable), so we gate on the
  // reference, not the verdicts.
  const hasGroundTruth = Boolean(conventions || transcript || rawXml);
  const state = primaryState(checks, hasGroundTruth);
  return { checks, pass: state === "pass", state, failCount, skipCount, warnCount, hasGroundTruth };
}

// ---------- 0. scssCompiles (structural smoke — unbalanced SCSS cannot exit green) ----------

function checkScssCompiles(scss) {
  // Deterministic no-dependency syntax smoke: brace balance + no unterminated comment/string.
  // A generated SCSS with an unclosed `{` would fail the Angular build; verify must not bless it.
  if (!String(scss ?? "").trim()) return { name: "scssCompiles", status: "skip", detail: "no scss to check" };
  const src = String(scss);
  let depth = 0;
  let inStr = null;
  let blockComment = false;
  let lineComment = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    const n = src[i + 1];
    if (lineComment) { if (c === "\n") lineComment = false; continue; }
    if (blockComment) { if (c === "*" && n === "/") { blockComment = false; i++; } continue; }
    if (inStr) { if (c === inStr && src[i - 1] !== "\\") inStr = null; continue; }
    if (c === "/" && n === "/") { lineComment = true; i++; continue; }
    if (c === "/" && n === "*") { blockComment = true; i++; continue; }
    if (c === '"' || c === "'") inStr = c;
    else if (c === "{") depth++;
    else if (c === "}") { depth--; if (depth < 0) { return { name: "scssCompiles", status: "fail", detail: "unbalanced SCSS: closing brace without opener" }; } }
  }
  if (depth !== 0) return { name: "scssCompiles", status: "fail", detail: `unbalanced SCSS: ${depth} unclosed block(s)` };
  if (inStr) return { name: "scssCompiles", status: "fail", detail: "unterminated string in SCSS" };
  if (blockComment) return { name: "scssCompiles", status: "fail", detail: "unterminated comment in SCSS" };
  return { name: "scssCompiles", status: "pass", detail: "SCSS braces balanced" };
}

// ---------- 1. scssCoverage ----------

function checkScssCoverage(scss, html, ngDeepCorpus = []) {
  // Did the LIBRARY-INTERNAL styling idioms survive into the output as *live rules* — not just
  // as a stray string somewhere? Matching is per class token but only counts a token that
  // appears inside a non-empty CSS rule (comments stripped), so a token left in a comment, used
  // as a variable name, or copied as an emptied rule `.x { }` does NOT satisfy the check.
  // Scoped to (a) the capability families this component renders and (b) library-internal
  // selectors only (mirroring conventions.mjs's reusable test). Micro-effect selectors
  // (`toggle-caret`, `ngx-select__toggle`) are ADVISORY: a faithful slice may drop them without
  // breaking the dropdown, so their absence is a warn, never a fail.
  const relevant = relevantCorpus(ngDeepCorpus, html);
  if (!relevant.length) {
    return { name: "scssCoverage", status: "skip", detail: "no reusable ::ng-deep blocks for the capabilities in play" };
  }
  const clean = stripComments(scss);
  const missing = [];
  const advisoryMissing = [];
  for (const c of relevant) {
    const present = selectorRulePresent(c.selector, clean);
    if (present) continue;
    if (isAdvisorySelector(c.selector)) advisoryMissing.push(c.selector);
    else missing.push(c.selector);
  }
  if (missing.length) {
    return {
      name: "scssCoverage",
      status: "fail",
      detail: `${missing.length}/${relevant.length} reusable ::ng-deep idioms missing`,
      missing,
      advisoryMissing,
    };
  }
  if (advisoryMissing.length) {
    return {
      name: "scssCoverage",
      status: "warn",
      detail: `${relevant.length} reusable idioms present; ${advisoryMissing.length} advisory micro-effect(s) dropped`,
      advisoryMissing,
    };
  }
  return { name: "scssCoverage", status: "pass", detail: `${relevant.length} reusable ::ng-deep idioms present` };
}

/** A corpus selector survives if ANY of its distinctive class tokens occurs inside a live rule:
 *  `<token>[^{}]*{ <non-empty body> }`. Works for flat and nested blocks alike because we scan
 *  the whole (comment-stripped) SCSS for that rule shape, not for a specific chain. */
function selectorRulePresent(selector, cleanScss) {
  const tokens = selector.split(/[^a-zA-Z0-9_-]+/).filter(Boolean);
  for (const t of tokens) {
    if (PSEUDO.has(t) || !/[-_]/.test(t) || t.length <= 1) continue;
    // Match a class or bare token used as a selector, followed by a rule body holding content.
    const re = new RegExp(`(?:^|[\\s>+~.,#\\[])\\.?${cssEscape(t)}(?![\\w-])[^{}]*\\{[^}]*\\S`, "i");
    if (re.test(cleanScss)) return true;
  }
  return false;
}

/** Micro-effect selectors a faithful slice may omit without changing the control's function. */
function isAdvisorySelector(selector) {
  return /toggle-caret|^ngx-select__toggle$|caret/i.test(selector);
}

function stripComments(scss) {
  return String(scss ?? "")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\/\/.*$/gm, " ");
}

function cssEscape(s) { return s.replace(/[^\w-]/g, "\\$&"); }

/** Which corpus blocks must THIS component copy? Family triggered by the component's own
 *  tags/classes, then filtered to library-internal (reusable) selectors only — mirroring
 *  conventions.mjs's isReusable (token match + NOT under a component-specific wrapper).
 *  For the TABLE family, a second filter scopes to the bindings that are actually IN PLAY:
 *  a table with search/pagination/limit all OFF must not be forced to paste their dead SCSS
 *  (2026-09-11 F6). */
function relevantCorpus(ngDeepCorpus, html) {
  const triggers = {
    select: /<ngx-select\b|dropdown-menu/i,
    table: /<(uii-table|ngx-datatable|mat-table)(?!-skeleton)\b|ugw-pagination|gateway-table/i,
    layout: /ugw-header|ugw-sidebar|ugw-breadcrumb/i,
  };
  const inPlay = Object.keys(triggers).filter((fam) => triggers[fam].test(html));
  const tableTag = /<(?:uii-table|ngx-datatable|mat-table)(?!-skeleton)\b[^>]*>/i.exec(String(html ?? ""))?.[0] ?? "";
  // "Explicitly OFF" (`="false"`) is the F6 signal — a deliberately disabled complement must not
  // demand its dead SCSS. ABSENT keeps the current behaviour (the default is on), so a table
  // without an explicit `[paginationOptions]="false"` still requires its pagination corpus.
  const bindingOff = (name) => new RegExp(`\\[${name}\\]\\s*=\\s*["']false["']`).test(tableTag);

  return ngDeepCorpus.filter((c) => {
    if (!c.family || !inPlay.includes(c.family)) return false;
    const rx = LIBRARY_INTERNAL[c.family];
    if (!rx || !rx.test(c.selector)) return false;
    const guard = LIBRARY_INTERNAL_WRAPPER_GUARD[c.family];
    if (guard && guard.test(c.selector)) return false;
    // F6: drop table-family selectors whose effect belongs to a binding explicitly OFF.
    if (c.family === "table") {
      const sel = c.selector ?? "";
      if (bindingOff("searchOptions") && /search-input|search-options/i.test(sel)) return false;
      if (bindingOff("limitOptions") && /limit-options/i.test(sel)) return false;
      if (bindingOff("paginationOptions") && /pagination|page-box/i.test(sel)) return false;
    }
    return true;
  });
}

// ---------- 2. textCoverage (fidelity-critical text) ----------

/** Glyph/private-use codepoints that are icon font data, never literal UI copy. */
const GLYPH = /[-]/;

function checkTextCoverage(html, transcript) {
  const critical = fidelityCriticalText(transcript);
  if (!critical.length) {
    return { name: "textCoverage", status: "skip", detail: "no transcript text to check" };
  }
  // Scan only text that ACTUALLY renders: element inner text and placeholder/aria-label values,
  // never TS strings/comments (a label living only in a TS comment is NOT a rendered button).
  const rendered = renderedText(html);
  if (!rendered.trim()) {
    return { name: "textCoverage", status: "fail", detail: "no rendered element text found to match", missing: critical };
  }
  // Whitespace-normalize both sides: the transcript may carry an OCR/parse artifact
  // ("Pilih  status" double space) that the agent correctly renders as one space.
  const norm = (s) => s.replace(/\s+/g, " ").trim();
  const gen = norm(rendered);
  const missing = [];
  for (const t of critical) {
    if (!gen.includes(norm(t))) missing.push(t);
  }
  if (missing.length) {
    return {
      name: "textCoverage",
      status: "fail",
      detail: `${missing.length} fidelity-critical text(s) not rendered`,
      missing,
    };
  }
  return { name: "textCoverage", status: "pass", detail: `${critical.length} critical texts rendered` };
}

/** Extract the user-visible text a browser would render from the component HTML: element inner
 *  text (buttons, headings, labels, spans) plus placeholder/aria-label attributes. Comments are
 *  stripped; elements under *ngIf="false" or [hidden] contribute nothing; an empty tag
 *  (<button></button> or a self-closed void with no text) renders nothing. */
function renderedText(html) {
  const src = String(html ?? "")
    .replace(/<!--[\s\S]*?-->/g, " ")
    // Drop non-rendering conditional/hidden subtrees at the string level (their text must not satisfy).
    .replace(/<\w+[^>]*\*ngIf="false"[\s\S]*?<\/\w+>/gi, " ")
    .replace(/<\w+[^>]*\bhidden\b[\s\S]*?<\/\w+>/gi, " ");
  const out = [];
  // Attribute-borne text: placeholder/aria-label/title carry user-visible copy. ngx-select
  // binds placeholders as [placeholder]="'Pilih …'" (a string literal binding) — extract the
  // quoted literal too, since the control renders it.
  for (const m of src.matchAll(/\b(?:placeholder|aria-label|title)\s*=\s*["']([^"']*)["']/gi)) {
    if (m[1].trim()) out.push(m[1]);
  }
  // [placeholder]="'Pilih …'" → the control renders the inner single-quoted literal.
  for (const m of src.matchAll(/\[(?:attr\.)?(?:placeholder|aria-label|title)\]\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)) {
    const inner = m[1] ?? m[2] ?? "";
    const lit = /^\s*'([^']*)'\s*$/.exec(inner) || /^\s*"([^"]*)"\s*$/.exec(inner);
    const text = lit ? lit[1] : inner;
    if (text.trim()) out.push(text.trim());
  }
  // Element inner text (button/h1-h6/label/a/span/option/th/td) — but only when the element has
  // a closing tag with real text content (an empty/void control renders no text of its own).
  for (const m of src.matchAll(/<(button|h[1-6]|label|a|span|option|th|td|div|strong|em)\b[^>]*>([\s\S]*?)<\/\1>/gi)) {
    const inner = stripTags(m[2]).trim();
    if (inner) out.push(inner);
  }
  return out.join(" ");
}

function stripTags(s) {
  return String(s ?? "")
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Fidelity-critical text = button labels, title, and "Pilih …" placeholders. These are UI
 *  chrome that must survive verbatim. Table-cell mock data (NIM, names, currency) is
 *  intentionally excluded — the agent replaces it with mock rows, so literal-matching it
 *  would be the self-contradicting textCoverage the council rejected. */
function fidelityCriticalText(transcript) {
  const out = [];
  const buttons = new Set();
  const title = [];
  const placeholders = new Set();
  walkNodes(transcript?.layout, (n) => {
    if (n?.hidden) return; // hidden node's text is not rendered — never required
    const t = (n.text ?? "").trim();
    if (!t || GLYPH.test(t)) return;
    if (n.type === "button") buttons.add(t);
    else if (/^pilih\b/i.test(t)) placeholders.add(t);
  });
  // Title: first text leaf (largest/first in document order) — a faithful label for the page.
  let firstText = null;
  walkNodes(transcript?.layout, (n) => {
    if (n?.hidden) return; // a hidden node is not the visible page title
    const t = (n.text ?? "").trim();
    if (firstText === null && t && !GLYPH.test(t) && n.type === "text") firstText = t;
  });
  if (firstText) title.push(firstText);
  for (const t of [...buttons, ...placeholders, ...title]) if (t) out.push(t);
  return [...new Set(out)];
}

// ---------- 3. tableBindings ----------

function checkTableBindings(html, rawXml, pilar = null) {
  // The uii-table binding-policy is pilar feature data. Without pilar (public install), this
  // check has no whitelist to judge against → skip (never crash, never leak).
  if (!pilar) {
    return { name: "tableBindings", status: "skip", detail: "no uii-table binding policy (pilar not present in this install)" };
  }
  const { forbiddenTableInputs, forbiddenTableOutputs, legalTableInputs, legalTableOutputs } = pilar;
  // Exclude the skeleton: `<uii-table-skeleton>` must not match the table component.
  const tableTag = /<(uii-table|ngx-datatable|mat-table)(?!-skeleton)\b[\s\S]*?>/i.exec(html);
  if (!tableTag) {
    return { name: "tableBindings", status: "skip", detail: "no table component in output" };
  }
  const el = tableTag[0];
  const inputs = [...el.matchAll(/\[(\w+)\]/g)].map((m) => m[1]);
  const outputs = [...el.matchAll(/\((\w+)\)\s*=/g)].map((m) => m[1]);
  // A binding explicitly set to "false" is a deliberate OFF (the design lacks that column), not
  // a usage claim — it must not trip forbidden/evidence checks (2026-09-11 F7, same guard
  // pattern as checkRowAuth's [actionColumn]="false").
  const isFalsy = (binding) => new RegExp(`\\[${binding}\\]\\s*=\\s*["']false["']`).test(el);

  const problems = [];

  for (const b of inputs) {
    if (forbiddenTableInputs.has(b) && !isFalsy(b)) {
      problems.push(`forbidden input [${b}] (server-mode/sliceui is mock-only)`);
    } else if (!legalTableInputs.has(b)) {
      problems.push(`unknown input [${b}]`);
    }
  }
  for (const o of outputs) {
    if (forbiddenTableOutputs.has(o)) problems.push(`forbidden output (${o}) (server-mode/sliceui is mock-only)`);
    else if (!legalTableOutputs.has(o)) problems.push(`unknown output (${o})`);
  }

  // Checkbox column: the XML is the single source of truth. Evidence is the raw XML's
  // <Checkbox_FNC> (the transcript mirrors it as `checkbox` nodes, but the raw source is
  // authoritative) — never a guess from the component or a default. An explicit
  // [checkboxColumn]="false" is a deliberate OFF — no evidence required, no violation.
  const checkboxOn = inputs.includes("checkboxColumn") && !isFalsy("checkboxColumn");
  const checkboxOff = inputs.includes("checkboxColumn") && isFalsy("checkboxColumn");
  if (checkboxOn) {
    if (!rawXml || !/<Checkbox_FNC\b/i.test(rawXml)) {
      problems.push("[checkboxColumn] has no <Checkbox_FNC> evidence in the source XML");
    }
  } else if (!checkboxOff && rawXml && /<Checkbox_FNC\b/i.test(rawXml)) {
    // XML evidences a checkbox column but the output emits none (and doesn't explicitly turn it
    // off) — that is a dropped design fact.
    problems.push("source XML has <Checkbox_FNC> but output is missing [checkboxColumn]");
  }

  if (problems.length) {
    return { name: "tableBindings", status: "fail", detail: problems.join("; "), problems };
  }
  // `(rowsChanged)` is a legal output but a footgun: reassigning `rows = $event` in its handler
  // re-triggers the table's preprocessRows → ngOnChanges → rowsChanged loop (browser hang). Warn
  // but do not fail — the binding itself is not illegal (Report #1 §6.1).
  if (outputs.includes("rowsChanged")) {
    return { name: "tableBindings", status: "warn", detail: "bindings legal; (rowsChanged) bound — reassigning `rows` in its handler re-triggers the table (infinite loop). Read-only use or drop the binding." };
  }
  // Honest pass message: name the checkbox state actually found (F7 — "checkbox evidenced" was
  // misleading when the table has no checkbox column at all).
  const cbNote = checkboxOn ? " + checkbox evidenced" : checkboxOff ? " + checkbox explicitly off" : "";
  return { name: "tableBindings", status: "pass", detail: `bindings legal${cbNote}` };
}

// ---------- 3b. pilarBindings (catalog-enforcing, all uii-* tags) ----------

/** Every `<uii-*>` element's bindings must EXIST in the catalog's declared inputs/outputs for
 *  that component. This closes the council's circular-gate flaw from the other side: tableBindings
 *  enforces the mock POLICY (which inputs may be bound); pilarBindings enforces the CATALOG (that
 *  the binding is even a real pilar API). A misspelled `[colums]` or a hallucinated `(onSave)`
 *  that no pilar component declares is red. Skeleton/loader tags are skipped (they are the
 *  loading state, not the table). Non-uii tags (ngx-select, native html) are out of scope. */
function checkPilarBindings(html, pilar = null) {
  // The pilar catalog is private feature data; without it (public install) there is nothing to
  // judge uii-* bindings against → skip. No pilar components should exist in a generic slice anyway.
  if (!pilar) {
    return { name: "pilarBindings", status: "skip", detail: "no pilar catalog (pilar not present in this install)" };
  }
  const catalog = new Map(pilar.pilarComponents.map((c) => [c.selector, c]));
  const problems = [];
  let checked = 0;
  for (const m of String(html).matchAll(/<(uii-[a-z-]+)[^>]*>/gi)) {
    const selector = m[1].toLowerCase();
    if (selector === "uii-table-skeleton" || selector.endsWith("-loader")) continue;
    const comp = catalog.get(selector);
    if (!comp) {
      // A uii-* tag not in the catalog at all (hallucinated component).
      problems.push(`<${selector}> is not a pilar component (not in catalog)`);
      continue;
    }
    checked++;
    const tag = m[0];
    const declaredIn = new Set(comp.inputs.map((i) => i.name));
    const declaredOut = new Set(comp.outputs.map((o) => o.name));
    for (const b of [...tag.matchAll(/\[(\w+)\]/g)].map((x) => x[1])) {
      if (!declaredIn.has(b)) problems.push(`<${selector}>: [${b}] is not a declared @Input (catalog has: ${[...declaredIn].join(", ") || "none"})`);
    }
    for (const o of [...tag.matchAll(/\((\w+)\)\s*=/g)].map((x) => x[1])) {
      if (!declaredOut.has(o)) problems.push(`<${selector}>: (${o}) is not a declared @Output (catalog has: ${[...declaredOut].join(", ") || "none"})`);
    }
  }
  if (!checked && !problems.length) {
    return { name: "pilarBindings", status: "skip", detail: "no pilar component tags in output" };
  }
  if (problems.length) {
    return { name: "pilarBindings", status: "fail", detail: problems.join("; "), problems };
  }
  return { name: "pilarBindings", status: "pass", detail: `${checked} pilar component(s) bind only declared inputs/outputs` };
}

// ---------- 4. classVocabulary ----------

/** Bootstrap/framework button namespace that is ALWAYS legal in a UI-library project, even when
 *  the project's own `classVocabulary` carries no `btn-*` member. A UII/BS project loads these
 *  from the library's global CSS (`.btn.btn-primary` = the org's primary action), so flagging them
 *  "invented" would force the agent to hand-roll a WORSE local class (Report #2 §4.2). */
const FRAMEWORK_BUTTONS = new Set([
  "btn", "btn-primary", "btn-secondary", "btn-default", "btn-success", "btn-danger",
  "btn-warning", "btn-info", "btn-light", "btn-dark", "btn-link", "btn-block",
  "btn-sm", "btn-lg", "btn-outline-primary", "btn-outline-secondary", "btn-outline-default",
  "btn-outline-success", "btn-outline-danger", "btn-outline-warning", "btn-outline-info",
  "btn-outline-light", "btn-outline-dark",
]);

function checkClassVocabulary(generated, classVocabulary = [], ngDeepCorpus = []) {
  // Known reusable classes = HTML class="…" vocabulary ∪ the SCSS label taxonomy
  // (::ng-deep .label-custom-* blocks). The label taxonomy lives in SCSS + TS string
  // templates, NOT literal HTML class="…", so classVocabulary alone would falsely flag
  // every `label-custom-<x>` as invented.
  const known = new Set(classVocabulary.map((c) => c.name));
  for (const c of ngDeepCorpus) {
    for (const m of c.selector.matchAll(/([a-zA-Z][\w-]*-custom-[a-zA-Z][\w-]*)/g)) {
      known.add(m[1]);
    }
  }
  // No vocabulary to compare against → cannot verify. Must SKIP (never pass), or an all-skip
  // run (missing conventions — the wrong-directory false-green) would still get a classVocabulary
  // verdict and exit green.
  if (known.size === 0) {
    return { name: "classVocabulary", status: "skip", detail: "no class vocabulary in conventions" };
  }
  // A generated `label-custom-*` class that is NOT in the project's SCSS/HTML at all.
  const invented = [];
  for (const m of generated.matchAll(/([a-zA-Z][\w-]*-custom-[a-zA-Z][\w-]*)/g)) {
    const cls = m[1];
    if (!known.has(cls) && !invented.includes(cls)) invented.push(cls);
  }

  // An invented `btn-*` class is a HARD fail: buttons are core action controls, and a wrong
  // button class (e.g. `btn-gray` when the project uses `btn-primary`/`btn-secondary`) silently
  // breaks an action's styling/behavior. Unlike the advisory `label-custom-*` taxonomy, this must
  // not be softened.
  const badButtons = [];
  // `id="btn-*"` is an element ID, NOT a class — this project uses `id="btn-*"` ~46× (a dominant
  // convention), and the old whole-text scan mistook every one for an invented button class
  // (2026-09-10 B3). Strip id attributes before scanning: only class-attribute values, `[class.btn-*]`
  // bindings, and `.btn-*` SCSS selectors are real class positions.
  const btnSource = String(generated).replace(/\bid\s*=\s*["'][^"']*["']/gi, " ");
  for (const m of btnSource.matchAll(/\bbtn-([a-z0-9-]+)/gi)) {
    const cls = m[0].toLowerCase();
    // A framework button (btn-primary etc.) is legal even when the project's own vocabulary
    // carries no btn-* — the library's global CSS defines it. Only a NON-framework, non-vocab
    // btn-* (e.g. btn-gray) is "invented".
    if (FRAMEWORK_BUTTONS.has(cls)) continue;
    if (!known.has(cls) && !known.has(`btn-${m[1].toLowerCase()}`) && !badButtons.includes(cls)) badButtons.push(cls);
  }

  if (badButtons.length) {
    return {
      name: "classVocabulary",
      status: "fail",
      detail: `invented button class(es): ${badButtons.join(", ")} — use the project's btn-* classes`,
      inventedButtons: badButtons,
    };
  }
  if (invented.length) {
    // WARN, not fail: a new member of a deliberate taxonomy is a signal, but it must not
    // block the gate — the whole point of SliceUI is generating code the project doesn't
    // have yet (council fix #2: soften to advisory).
    return {
      name: "classVocabulary",
      status: "warn",
      detail: `invented classes not in project vocabulary: ${invented.join(", ")}`,
      invented,
    };
  }
  return { name: "classVocabulary", status: "pass", detail: "no invented classes" };
}

// ---------- 4b. no-hashed-selectors ----------

function checkNoHashedSelectors(scss) {
  // Angular emits [_ngcontent-XXX] attribute selectors during a build. They are NOT valid
  // source — they only match the component's compiled DOM in dev, and the hash changes on
  // every build. A generated SCSS containing them is broken output (agent leaked a compiled
  // selector from a wrong Grep). Hard fail.
  const matches = [...scss.matchAll(/\[_ngcontent-[^\]]*\]/g)].map((m) => m[0]);
  if (matches.length) {
    return {
      name: "noHashedSelectors",
      status: "fail",
      detail: `compiled [_ngcontent-*] selector(s) leaked into source SCSS: ${matches.slice(0, 3).join(", ")}`,
    };
  }
  return { name: "noHashedSelectors", status: "pass", detail: "no compiled selectors in source" };
}

function checkNoBareNgDeep(scss, ngDeepCorpus = []) {
  // A bare `::ng-deep` (without a `:host ` ancestor) pierces GLOBALLY under emulated
  // encapsulation. BUT the project's own corpus may carry bare blocks, and a faithful slice is
  // SUPPOSED to copy them verbatim — so we only flag a bare `::ng-deep` whose selector is NOT
  // one the corpus already blesses (i.e. an agent-ADDED leak). Corpus-derived bare blocks are
  // the project's pre-existing idiom; normalizing those is a corpus-level task, not a slice
  // failure. (skip when no ::ng-deep at all.)
  if (!/::ng-deep/.test(scss)) return { name: "noBareNgDeep", status: "skip", detail: "no ::ng-deep in generated scss" };
  const clean = stripComments(scss); // a comment mentioning "::ng-deep" is not a rule
  // Bare (non-:host) ::ng-deep selectors the corpus itself ships → allowed verbatim.
  const corpusBare = new Set();
  for (const c of ngDeepCorpus) {
    const b = stripComments(c.block ?? "");
    for (const m of b.matchAll(/(?<!:host\s)::ng-deep\s*([^{}]+)/g)) {
      corpusBare.add(m[1].trim());
    }
  }
  const added = [];
  for (const m of clean.matchAll(/(?<!:host\s)::ng-deep\s*([^{}]+)\s*\{/g)) {
    const sel = m[1].trim();
    if (sel && !corpusBare.has(sel)) added.push(`::ng-deep ${sel}`);
  }
  if (added.length) {
    return {
      name: "noBareNgDeep",
      status: "fail",
      detail: `bare ::ng-deep not from the corpus (agent-added global leak) — scope \`:host ::ng-deep\`: ${added.slice(0, 3).join("; ")}`,
      added,
    };
  }
  return { name: "noBareNgDeep", status: "pass", detail: "all ::ng-deep are :host-scoped or corpus-blessed" };
}

// ---------- 4c-bis. alignmentViaDeepCss (SUI006: capability ignored in favor of deep CSS) ----------

/** Selectors whose subject is the table's own footer/pagination region — the DOM pilar owns and
 *  exposes configuration for. An alignment override aimed at THESE is the SUI006 case. Deliberately
 *  narrow: the reusable corpus itself styles `.ugw-pagination-container li.page-box` (borders,
 *  radius, weight) and that is legitimate VISUAL detail — only *layout distribution* (flex/grid
 *  alignment, auto margins, text-align) on these owned containers is flagged. */
const PAGINATION_OWNED = /\.table-footer|ugw-pagination|uii-pagination|\.pagination\b|\.aligned-footer/;
/** Properties that place an element rather than decorate it. */
const ALIGNMENT_PROPS = /\b(justify-content|justify-items|justify-self|align-items|align-self|text-align|margin-left|margin-right|margin-inline-start|margin-inline-end|float)\s*:/i;

function checkAlignmentViaDeepCss(scss) {
  // Why WARN and not FAIL: the string tier cannot always tell a needed workaround from a
  // redundant one (a design may legitimately right-align inside a footer pilar already aligns).
  // But a silent pass is what produced the 23 Sep 2026 field defect — three hand-written
  // alignment overrides, none of which worked, where `[paginationAlign]="'right'"` did. The rule
  // routes the agent to the public input without blocking a slice that genuinely needs the CSS.
  const clean = stripComments(scss ?? "");
  if (!clean.includes("::ng-deep")) {
    return { name: "alignmentViaDeepCss", status: "skip", detail: "no ::ng-deep in generated scss" };
  }
  const offenders = [];
  const rule = /([^{}]*::ng-deep[^{}]*)\{([^{}]*)\}/g;
  for (const m of clean.matchAll(rule)) {
    const selector = m[1].trim();
    if (!PAGINATION_OWNED.test(selector)) continue;
    const body = m[2];
    for (const decl of body.matchAll(/([a-z-]+)\s*:\s*([^;]+)/gi)) {
      if (!ALIGNMENT_PROPS.test(`${decl[1]}:`)) continue;
      offenders.push(`${selector} { ${decl[1]}: ${decl[2].trim()} }`);
    }
  }
  if (offenders.length) {
    return {
      name: "alignmentViaDeepCss",
      status: "warn",
      detail: `SUI006 — pagination/footer alignment set via ::ng-deep instead of the component's public input. Prefer [paginationAlign]="'right'" on <uii-table> (or [paginationALign] on <uii-pagination>); reach for deep CSS only for visual detail the input can't express: ${offenders.slice(0, 3).join("; ")}`,
      offenders,
    };
  }
  return { name: "alignmentViaDeepCss", status: "pass", detail: "no deep-CSS alignment override on the pagination/footer region" };
}

// ---------- 4c-ter. requiredMarker (explicit XML `required` beats a reconstructed marker) ----------

/** A required-marker element that is emitted-but-hidden, or a marker on a field the XML states is
 *  optional. Both are unrequested output: the design's required state is an EXPLICIT XML attribute
 *  (`required="true"|"false"`), so the generator renders the asterisk for required fields and
 *  renders NOTHING for optional ones — it must never reconstruct the design's hidden asterisk and
 *  then hide it again (2026-09-24, report §4.5).
 *
 *  `hidden` in the generated markup is the tell either way: a marker the DESIGN hid was carried
 *  into the output as a still-hidden span, which means the generator copied visibility instead of
 *  meaning. Scope: markers only (a class/asterisk span), never `*ngIf`-gated content generally. */
const REQUIRED_MARKER = /<span\b[^>]*class\s*=\s*["'][^"']*(?:required|mandatory)[^"']*["'][^>]*>/gi;

function checkRequiredMarker(html) {
  const markers = [...String(html ?? "").matchAll(REQUIRED_MARKER)];
  if (!markers.length) {
    return { name: "requiredMarker", status: "skip", detail: "no required-marker element in output" };
  }
  const hidden = markers.filter((m) => /\bhidden\b|display\s*:\s*none|aria-hidden\s*=\s*["']true["']/i.test(m[0]));
  if (hidden.length) {
    return {
      name: "requiredMarker",
      status: "fail",
      detail: `required marker emitted but hidden (${hidden.length}) — the design states the field's required state as an explicit XML attribute, so emit the marker for a required field and emit NOTHING for an optional one; never reconstruct a hidden asterisk and re-hide it. A marker is either rendered or absent: ${hidden[0][0]}`,
      markers: hidden.map((m) => m[0]),
    };
  }
  return { name: "requiredMarker", status: "pass", detail: `${markers.length} required marker(s), none hidden` };
}

// ---------- 4c-quater. containerPadding (explicit XML padding must survive) ----------

/** The padding the design declares on a node, as [top, right, bottom, left]. Read from the
 *  TRANSCRIPT rather than the raw XML on purpose: the parser already applies the precedence the
 *  report asks for (§4.1 — per-side > shorthand > project convention > fallback) and resolves
 *  `verticalPadding`/`horizontalPadding` alongside the per-side attributes, so re-deriving it from
 *  the XML here would be a second implementation free to disagree with the first. */
function paddingTuple(node) {
  const p = node?.padding;
  if (!p || typeof p !== "object") return null;
  const vals = ["top", "right", "bottom", "left"].map((k) => Number(p[k] ?? 0) || 0);
  return vals.some((v) => v > 0) ? vals : null;
}

function checkContainerPadding(html, scss, transcript) {
  if (!transcript?.layout?.length) {
    return { name: "containerPadding", status: "skip", detail: "no transcript to check container padding against" };
  }
  const rules = authoredRules(scss);
  if (!rules.length) {
    return { name: "containerPadding", status: "skip", detail: "no authored SCSS rules to compare against" };
  }
  // The outermost node that declares padding IS the page container the design describes.
  const root = transcript.layout.find((n) => paddingTuple(n));
  if (!root) {
    return { name: "containerPadding", status: "skip", detail: "the design declares no padding on its outer frame" };
  }
  const design = paddingTuple(root);
  // Ownership guard: only compare a rule whose selector names a class the OUTPUT actually uses.
  // A same-named class in the project's own SCSS is not this slice's rule.
  const htmlStr = String(html ?? "");
  const owned = rules.filter((r) => r.classes.some((c) => htmlStr.includes(c)));
  if (!owned.length) {
    return { name: "containerPadding", status: "skip", detail: "no authored rule whose class the output uses (slice reuses project classes)" };
  }
  // `pxNum` requires the `px` suffix, but CSS shorthand writes zero bare (`padding: 0 20px`).
  // Without this, a side-aware declaration reads as unparseable and the check silently skips the
  // very output it exists to judge.
  const cssLen = (v) => (String(v ?? "").trim() === "0" ? 0 : pxNum(v));
  const found = [];
  for (const r of owned) {
    const decls = declMap(r.body);
    const shorthand = decls["padding"];
    if (shorthand !== undefined) {
      const n = shorthand.trim().split(/\s+/).map(cssLen);
      if (n.some((v) => v === null)) continue; // token/rem — cannot judge
      // CSS shorthand: 1 value = all sides; 2 = v/h; 3 = t/h/b; 4 = t/r/b/l.
      const tuple = n.length === 1 ? [n[0], n[0], n[0], n[0]]
        : n.length === 2 ? [n[0], n[1], n[0], n[1]]
        : n.length === 3 ? [n[0], n[1], n[2], n[1]]
        : n.slice(0, 4);
      found.push({ selector: r.selector, tuple });
      continue;
    }
    const tuple = ["padding-top", "padding-right", "padding-bottom", "padding-left"].map((p) => {
      const v = decls[p];
      return v === undefined ? null : pxNum(v);
    });
    if (tuple.every((v) => v === null)) continue;
    found.push({ selector: r.selector, tuple });
  }
  if (!found.length) {
    return { name: "containerPadding", status: "skip", detail: "no authored rule declares padding (nothing to compare)" };
  }
  // Each declared padding must be one of the values the design states SOMEWHERE on that edge —
  // a container legitimately drops the sides it hands to inner elements. Comparing whole tuples
  // instead would flag correct output (`padding: 0 20px`) as a defect and push the agent back to
  // the fabricated `5px` the report is complaining about.
  const SIDES = ["top", "right", "bottom", "left"];
  const suspects = [];
  for (const f of found) {
    const bad = f.tuple
      .map((v, i) => ({ v, i }))
      .filter(({ v, i }) => v !== null && v > 0 && v !== design[i]);
    if (bad.length) {
      suspects.push(`${f.selector} ${SIDES[bad[0].i]}=${bad[0].v}px (XML: ${design[bad[0].i]}px)`);
    }
  }
  if (suspects.length) {
    return {
      name: "containerPadding",
      status: "warn",
      detail: `container padding differs from the design's explicit XML values — explicit spacing must beat a generator fallback: ${suspects.join("; ")}`,
      suspects,
    };
  }
  return { name: "containerPadding", status: "pass", detail: `container padding matches the design (${design.join("/")})` };
}

/** The slice's OWN (authored) SCSS rules as { selector, body, classes }. Rules that pierce into a
 *  library component (`::ng-deep`) are library styling, not the slice's layout, and are excluded —
 *  they are the corpus's business, judged by scssCoverage/noBareNgDeep, never here. */
function authoredRules(scss) {
  const clean = stripComments(scss ?? "");
  const out = [];
  for (const m of clean.matchAll(/([^{}]*)\{([^{}]*)\}/g)) {
    const selector = m[1].trim();
    if (!selector || /^\s*@/.test(selector) || selector.includes("::ng-deep")) continue;
    const classes = [...selector.matchAll(/\.([\w-]+)/g)].map((x) => x[1]);
    if (!classes.length) continue;
    out.push({ selector, body: m[2], classes });
  }
  return out;
}

// ---------- 4d. phantom wrapper (structure = XML, not convention) ----------

function checkPhantomWrapper(html, transcript, anatomy = {}) {
  // User's single-source-of-truth principle: structure comes from the XML/transcript ONLY.
  // A wrapper the design doesn't show (`.well`, `page-canvas`) is a phantom added by a
  // convention leak. Flag structural wrappers that have no transcript counterpart.
  const hasTranscript = Boolean(transcript);
  if (!hasTranscript) {
    return { name: "phantomWrapper", status: "skip", detail: "no transcript to check structure against" };
  }
  const transcriptText = JSON.stringify(transcript);
  const transcriptHasWell = /\bwell\b/i.test(transcriptText);

  const phantoms = [];
  // The `.well` clause only fires when the project actually HAS a well idiom (wellAvailable).
  // A project with no `.well` anywhere in its templates must NOT be failed for emitting one —
  // the conventions layer and this gate pulled in opposite directions until 2026-09-10 §3.9.
  // An ABSENT key keeps the check ON (older conventions fixtures).
  const wellClauseActive = anatomy.wellAvailable !== false;
  if (wellClauseActive && /(?:id|class)=["'][^"']*\bwell\b/i.test(html) && !transcriptHasWell) {
    phantoms.push("id/class=\"well\" (design has no well)");
  }
  if (/class=["'][^"']*page-canvas/i.test(html) && !/page-canvas/i.test(transcriptText)) {
    phantoms.push("page-canvas wrapper (design has none)");
  }

  if (phantoms.length) {
    return {
      name: "phantomWrapper",
      status: "fail",
      detail: `structural wrapper(s) not in the design: ${phantoms.join("; ")}`,
      phantoms,
    };
  }
  return { name: "phantomWrapper", status: "pass", detail: "no structural wrappers beyond the design" };
}

// ---------- 4d-ter. modalWrapper (modal semantics require design evidence) ----------

/** Modal/card semantic wrappers are STRUCTURE (transcript-owned), never convention. A generated
 *  `.modal-header`/`.modal-body`/`.modal-footer`, `.card`, `.modal-content`, or a `role="dialog"`
 *  that the design never evidences is invented structure — the transcript must show a modal frame
 *  (backdrop, dialog title + body + footer, or a `modal`-named node) for the output to use one.
 *  Neutral Angular wrappers (a bare `<div>` for *ngFor or host layout) carry no such semantic
 *  class and are NOT flagged — only the named modal/card idiom is. */
function checkModalWrapper(html, transcript) {
  const hasTranscript = Boolean(transcript);
  if (!hasTranscript) {
    return { name: "modalWrapper", status: "skip", detail: "no transcript to check modal structure against" };
  }
  const tx = JSON.stringify(transcript);
  // Design evidence of a modal/dialog: a node named/naming modal, dialog, or a backdrop/overlay.
  const designHasModal = /"(?:description|text|glyphName|name)"\s*:\s*"[^"]*(?:modal|dialog|backdrop|overlay|konfirmasi)/i.test(tx)
    || /\bmodal\b/i.test(tx) || /\bdialog\b/i.test(tx);

  // Generated modal/card semantic markers.
  const markers = [];
  for (const m of String(html ?? "").matchAll(/class\s*=\s*["']([^"']*)["']/gi)) {
    for (const cls of m[1].split(/\s+/)) {
      if (/^(?:modal|card)(?:-|$)|modal-(?:header|body|footer|content|dialog)|-modal\b/i.test(cls) && !markers.includes(cls)) {
        markers.push(cls);
      }
    }
  }
  if (/role\s*=\s*["']dialog["']/i.test(html ?? "")) markers.push('role="dialog"');

  if (markers.length && !designHasModal) {
    return {
      name: "modalWrapper",
      status: "warn",
      detail: `modal/card semantic wrapper(s) with no design evidence (the transcript shows no modal/dialog/backdrop frame): ${markers.join(", ")} — structure = XML/transcript only`,
      markers,
    };
  }
  if (!markers.length) {
    return { name: "modalWrapper", status: "skip", detail: "no modal/card semantic wrapper in output" };
  }
  return { name: "modalWrapper", status: "pass", detail: "modal/card wrapper evidenced by the design" };
}

// ---------- 4d-quater. frameworkSyntax (Angular ≤13 compatibility) ----------

/** Angular version-gated syntax. The project pins Angular ≤13 (module-based, no @if/@for/inject/
 *  standalone/signals). The framework version comes from the canonical snapshot; without it the
 *  check skips (never guesses the version). Bounded static diagnostics — not a compiler.
 *
 *  PR 5 corrective patch (FWK-001/FWK-002): matching runs against the LEXICALLY MASKED source, so
 *  a comment ("do not use inject()") or a string/template literal never counts as executable
 *  syntax — only real code does. `effect(` joins the signals family (FWK-002). The mask is a
 *  same-length whitespace replacement, so line/column offsets are preserved. */
function checkFrameworkSyntax(ts, html, framework) {
  const isAngular = framework?.id === "angular" || framework?.label?.toLowerCase?.() === "angular";
  if (!isAngular) {
    return { name: "frameworkSyntax", status: "skip", detail: "not an Angular project (or no framework snapshot)" };
  }
  const major = Number(framework?.versionMajor ?? framework?.version?.match(/(\d+)/)?.[1] ?? 0);
  // Only gate when the snapshot asserts an Angular ≤13 line (the org's actual version).
  if (!(major > 0 && major <= 13)) {
    return { name: "frameworkSyntax", status: "skip", detail: `no Angular ≤13 version evidence (major ${major || "unknown"})` };
  }
  // Mask comments + string/template LITERALS; keep template `${…}` interpolations and all real
  // code. Same length + newlines → diagnostic offsets stay exact.
  const src = maskNonExecutable(`${String(ts ?? "")}\n${String(html ?? "")}`);
  const offenders = [];
  if (/@if\s*\(|@for\s*\(|@switch\s*\(|@defer\b/.test(src)) offenders.push("control-flow block (@if/@for/@switch/@defer — v17+)");
  if (/\binject\s*\(/.test(src)) offenders.push("inject() (v14+)");
  if (/standalone\s*:\s*true/.test(src)) offenders.push("standalone: true component metadata (v14+)");
  if (/\b(?:signal|computed|effect|input|model)\s*\(/.test(src)) offenders.push("signals API (v16+)");
  if (offenders.length) {
    return {
      name: "frameworkSyntax",
      status: "fail",
      detail: `Angular ≤13 incompatible syntax: ${offenders.join("; ")} — use *ngIf/*ngFor, constructor DI, and NgModule registration`,
      offenders,
    };
  }
  return { name: "frameworkSyntax", status: "pass", detail: "no Angular ≤13 incompatible syntax" };
}

/** Mask comments and string/template literal text with same-length whitespace (newlines kept), so
 *  framework-syntax matching sees only executable code. Template `${…}` interpolations stay
 *  visible (they are executable expressions); their plain-text surroundings are masked. A bounded
 *  state machine — deliberately not a full JS lexer. Regex literals are NOT masked: none of the
 *  bounded framework patterns can match inside one, so masking them would add complexity for no
 *  signal. Returns the masked string. */
function maskNonExecutable(src) {
  const out = src.split("");
  const BLANK = (ch) => (ch === "\n" || ch === "\r" ? ch : " ");
  const blank = (i) => { out[i] = BLANK(out[i]); };
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    const d = src[i + 1];
    // Line comment → newline.
    if (c === "/" && d === "/") {
      while (i < n && src[i] !== "\n") blank(i++);
      continue;
    }
    // Block comment → closing `*/`.
    if (c === "/" && d === "*") {
      blank(i++); blank(i++);
      while (i < n && !(src[i] === "*" && src[i + 1] === "/")) blank(i++);
      if (i < n) { blank(i++); blank(i++); }
      continue;
    }
    // Single/double-quoted string literal (with escapes).
    if (c === "'" || c === '"') {
      const q = c;
      blank(i++);
      while (i < n) {
        if (src[i] === "\\") { blank(i++); if (i < n) blank(i++); continue; }
        if (src[i] === q) { blank(i++); break; }
        blank(i++);
      }
      continue;
    }
    // Template literal: mask plain text, keep `${…}` interpolation executable (with nesting).
    if (c === "`") {
      blank(i++);
      const scanTemplate = () => {
        while (i < n) {
          if (src[i] === "\\") { blank(i++); if (i < n) blank(i++); continue; }
          if (src[i] === "`") { blank(i++); return; }        // close template
          if (src[i] === "$" && src[i + 1] === "{") {         // enter interpolation (keep executable)
            i += 2;
            const scanExpr = () => {
              let depth = 1;
              while (i < n && depth > 0) {
                const e = src[i];
                // nested template inside the expression → recurse
                if (e === "`") { blank(i++); scanTemplate(); continue; }
                if (e === "'" || e === '"') {
                  const q2 = e; blank(i++);
                  while (i < n) {
                    if (src[i] === "\\") { blank(i++); if (i < n) blank(i++); continue; }
                    if (src[i] === q2) { blank(i++); break; }
                    blank(i++);
                  }
                  continue;
                }
                if (e === "{" ) depth++;
                if (e === "}" ) depth--;
                if (depth === 0) { i++; return; }
                i++;
              }
            };
            scanExpr();
            continue;
          }
          blank(i++);
        }
      };
      scanTemplate();
      continue;
    }
    i++;
  }
  return out.join("");
}

// ---------- 4d-bis. inventedLayout (SUI-STRUCT-004: layout effect with no design evidence) ----------

/** Layout effects the generator emits but the design never evidences: `box-shadow`, `max-width`,
 *  `position: absolute`, and an outer `margin: Xpx auto`. These are the wrapper-invention patterns
 *  the plan's §7.2 calls out — the string tier cannot know WHY a shadow or a centering margin was
 *  added, so this is a WARN, never a fail (preset: alignmentViaDeepCss / containerPadding are warn
 *  for the same reason).
 *
 *  Scoped to the slice's OWN authored rules (::ng-deep excluded — that is library internal, judged
 *  elsewhere). Evidence is the transcript: a design that actually shadows/centers a frame carries
 *  it in the transcript JSON, so a rule whose effect has no transcript counterpart is flagged. */
function checkInventedLayout(scss, transcript) {
  if (!transcript) {
    return { name: "inventedLayout", status: "skip", detail: "no transcript to check layout evidence against" };
  }
  const rules = authoredRules(scss).filter((r) => !r.selector.includes("::ng-deep"));
  if (!rules.length) {
    return { name: "inventedLayout", status: "skip", detail: "no authored SCSS rules to inspect" };
  }
  const transcriptText = JSON.stringify(transcript);
  const offenders = [];
  for (const r of rules) {
    const body = r.body;
    if (/box-shadow\s*:/i.test(body) && !/shadow/i.test(transcriptText)) {
      offenders.push(`${r.selector} { box-shadow }`);
    }
    if (/max-width\s*:/i.test(body) && !/max-width/i.test(transcriptText)) {
      offenders.push(`${r.selector} { max-width }`);
    }
    if (/position\s*:\s*absolute/i.test(body) && !/absolute|position/i.test(transcriptText)) {
      offenders.push(`${r.selector} { position: absolute }`);
    }
    if (/margin\s*:\s*[^;]*auto/i.test(body) && !/center|margin/i.test(transcriptText)) {
      offenders.push(`${r.selector} { margin: … auto }`);
    }
  }
  if (offenders.length) {
    return {
      name: "inventedLayout",
      status: "warn",
      detail: `SUI-STRUCT-004 — layout effect(s) with no design evidence (canvas x/y must not become outer spacing; a shadow/centering/max-width the design never shows is invented): ${offenders.join("; ")}`,
      offenders,
    };
  }
  return { name: "inventedLayout", status: "pass", detail: "no layout effect without design evidence" };
}

// ---------- 3b-bis. deadCode (unused import / injected dependency) ----------

/** Dead-code lint (P0-5 §5.5): a slice must not carry an import or an injected service it never
 *  uses — those are speculative infrastructure the design never asked for (report §4.9: "import,
 *  service injection, atau lifecycle infrastructure dibuat walaupun tidak dipakai"). WARN, not
 *  fail: the TS AST heuristic counts identifier occurrences, so a param referenced only inside a
 *  template string or a decorator would be a false positive the string tier cannot disprove. */
function checkDeadCode(tsSource) {
  if (!tsSource || !String(tsSource).trim()) {
    return { name: "deadCode", status: "skip", detail: "no TS source to lint" };
  }
  const src = String(tsSource);
  const problems = [];
  const deadImports = unusedImports(src);
  const deadParams = unusedConstructorParams(src);
  for (const n of deadImports) problems.push(`unused import \`${n}\``);
  for (const n of deadParams) problems.push(`injected but unused \`${n}\``);
  if (problems.length) {
    return {
      name: "deadCode",
      status: "warn",
      detail: `dead code — remove the unused import or injected dependency (the design never asked for it): ${problems.join("; ")}`,
      problems,
    };
  }
  return { name: "deadCode", status: "pass", detail: "no unused import or injected dependency" };
}

// ---------- 3c. ngx-select binding (dead-filter defect) ----------

function checkNgxSelectBinding(html) {
  const selects = [...html.matchAll(/<ngx-select\b[\s\S]*?>/gi)].map((m) => m[0]);
  if (!selects.length) {
    return { name: "ngxSelectBinding", status: "skip", detail: "no <ngx-select> in output" };
  }
  const problems = [];
  selects.forEach((tag, i) => {
    if (!/\[\(ngModel\)\]/.test(tag)) problems.push(`select #${i + 1} missing [(ngModel)]`);
    if (!/\(select\)\s*=/.test(tag)) problems.push(`select #${i + 1} missing (select)= handler`);
    if (/formControlName\s*=/.test(tag)) problems.push(`select #${i + 1} uses formControlName (reactive-form legacy idiom — SliceUI emits [(ngModel)])`);
  });
  if (problems.length) {
    return { name: "ngxSelectBinding", status: "fail", detail: `${problems.length} ngx-select binding problem(s)`, problems };
  }
  return { name: "ngxSelectBinding", status: "pass", detail: `${selects.length} ngx-select(s) bound with [(ngModel)] + (select)` };
}

// ---------- 3c2. no translation (literal text only) ----------

function checkNoTranslation(html, ts) {
  const src = html + " " + ts;
  const matches = [...src.matchAll(/\|\s*translate\b/g)];
  if (matches.length) {
    return {
      name: "noTranslation",
      status: "fail",
      detail: `${matches.length} \`| translate\` pipe(s) — SliceUI emits literal text, never i18n`,
      count: matches.length,
    };
  }
  return { name: "noTranslation", status: "pass", detail: "no `| translate` pipe" };
}

// ---------- 3c3. invented utility (an atomic utility class the project never uses) ----------

/** Atomic utility classes that carry no project-specific meaning but whose presence in a
 *  slice is meaningful: spacing (`m`/`p` families), sizing (`w`/`h`/`min-`/`max-`), flexbox
 *  (`gap`, `d-*`, `flex-*`, `justify-*`, `align-*`, `order-*`), and radius (`rounded-*`).
 *  These are the Bootstrap "utility namespaces". A slice that uses one the project itself
 *  never uses (e.g. `w-100`, `mr-2`, `gap-2`, `rounded-xl`) is inventing — the agent should
 *  mirror what the team actually writes, not guess framework utilities. Semantic/component
 *  classes (`btn-*`, `label-custom-*`, `table-*`, `text-danger`, …) are deliberately OUT of
 *  scope here — they are handled by the `classVocabulary` warn check, not flagged as invented. */
const UTILITY_SHAPE = /^(?:[mp][trblsxye]?-|[wh]-|mw-|mh-|min-|max-|(?:row-|column-)?gap-|d-|flex|justify-content-|align-(?:items|self|content)-|order-|rounded(?:-|$))/;

/** Atomic utility + breakpoint-less grid classes (`col-6`, `col-12`, `col`) that MUST come from
 *  a global build. `col-md-4`/`col-xs-12` (breakpoint-prefixed) are also gated here when a
 *  registry is present — a BS3 build without `col-md-*` is equally broken. */
const LOADED_UTILITY_SHAPE = /^(?:[mp][trblsxye]?-|[wh]-|mw-|mh-|min-|max-|(?:row-|column-)?gap-|d-|flex|justify-content-|align-(?:items|self|content)-|order-|rounded(?:-|$)|col(?:-(?:xs|sm|md|lg|xl|xxl))?-\d+|col$)/;

/** Actionable hints for the most common invented prefixes — the fix that mirrors the team's
 *  actual idiom instead of a bare "you invented this". */
const UTILITY_HINTS = {
  w: "use `btn-block` or a `col-*-12` for full width",
  h: "prefer the XML's geometry (or the component's natural height) over `h-*`",
  mr: "use `gap`, `button-action-right`, or the project's `margin-*-N` idiom",
  ml: "use `gap`, `button-action-right`, or the project's `margin-*-N` idiom",
  gap: "use the project's margin idiom (the `gap` utility class is not emitted here)",
  rounded: "take the radius from the transcript/XML",
};

function checkInventedUtility(html, classVocabulary = []) {
  const known = new Set(classVocabulary.map((c) => c.name));
  if (known.size === 0) {
    return { name: "inventedUtility", status: "skip", detail: "no class vocabulary in conventions" };
  }
  const problems = [];
  const seen = new Set();
  for (const m of html.matchAll(/class=["']([^"']+)["']/g)) {
    for (const raw of m[1].split(/\s+/)) {
      const cls = raw.trim();
      if (!cls || seen.has(cls)) continue;
      seen.add(cls);
      if (TRIVIAL_CLASS.test(cls)) continue;   // framework grid/layout base — always legal
      if (known.has(cls)) continue;            // the team already uses it — legal
      if (!UTILITY_SHAPE.test(cls)) continue;  // semantic/component class — out of scope here
      const prefix = /^[a-z]+/.exec(cls)?.[0] ?? "";
      const hint = UTILITY_HINTS[prefix];
      problems.push(hint ? `"${cls}" is invented — ${hint}` : `"${cls}" is invented — the project never uses this utility`);
    }
  }
  if (problems.length) {
    return { name: "inventedUtility", status: "fail", detail: problems.join("; "), problems };
  }
  return { name: "inventedUtility", status: "pass", detail: "no invented utility classes" };
}

// ---------- 19. loadedClass (utility/grid classes must resolve in the LOADED css) ----------

/** A utility/grid class the generated HTML uses must actually resolve to a rule in the project's
 *  LOADED stylesheets (dist CSS or the angular.json styles chain) — not merely appear in the
 *  team's vocabulary. This catches the dead class that "passes" the vocabulary model: `col-12`
 *  in a BS3 build that only generates `.p-col-12`, or `w-100`/`mr-2`/`gap-2` in a project whose
 *  loaded CSS has no such rule. Only fires when the registry is present (detect built it), and
 *  only for UTILITY_SHAPE classes (semantic/component classes live in the component's own SCSS,
 *  out of scope). */
function checkLoadedClass(html, registry) {
  const classes = registry?.classes;
  const source = registry?.source ?? "none";
  // 'none' means no stylesheet chain resolved at all — an under-resolved registry must never
  // fail legitimate classes (insufficient coverage is a skip, not a red). Only a registry that
  // actually READ a stylesheet may gate.
  if (!Array.isArray(classes) || !classes.length || source === "none") {
    return { name: "loadedClass", status: "skip", detail: "no loaded-class registry (run `sliceui init` on a built project)" };
  }
  const loaded = new Set(classes);
  // A non-compiled (scss) registry cannot see grid classes generated via @mixin make-grid-columns
  // (col-md-4, col-xs-12 are produced, never written literally). Gating those against a scss
  // registry would false-fail every bootstrap project. So: only gate breakpoint-prefixed grid
  // columns when the registry is a compiled dist CSS (the ground truth of what ships).
  const gateBreakpointGrid = source === "dist";
  const dead = [];
  const seen = new Set();
  for (const m of html.matchAll(/class=["']([^"']+)["']/g)) {
    for (const raw of m[1].split(/\s+/)) {
      const cls = raw.trim();
      if (!cls || seen.has(cls)) continue;
      seen.add(cls);
      if (!LOADED_UTILITY_SHAPE.test(cls)) continue; // semantic/component class — own SCSS
      if (loaded.has(cls)) continue;               // resolves in loaded CSS → legal
      if (!gateBreakpointGrid && /^col-(?:xs|sm|md|lg|xl|xxl)-\d+$/.test(cls)) continue;
      dead.push(cls);
    }
  }
  if (dead.length) {
    return {
      name: "loadedClass",
      status: "fail",
      detail: `utility/grid class(es) used but not found in loaded CSS: ${dead.slice(0, 6).join(", ")}`,
      dead,
    };
  }
  return { name: "loadedClass", status: "pass", detail: "utility/grid classes resolve in loaded CSS" };
}

// ---------- 3d. row auth (action-column icons only render when row.auth.<flag> truthy) ----------

function checkRowAuth(html, ts, rawXml, pilar = null) {
  // The XML action→authKey grammar is pilar feature data; without it (public install) there is no
  // mapping to derive required auth flags → skip.
  if (!pilar) {
    return { name: "rowAuth", status: "skip", detail: "no pilar action→authKey grammar (pilar not present in this install)" };
  }
  // Distinguish `[actionColumn]="false"` (column deliberately OFF, per the design) from a truthy
  // column. The bare `[actionColumn]` (no value) and `="true"` both mean ON in Angular; only an
  // explicit `="false"` is OFF. The old presence-only guard false-failed `="false"` (2026-09-10 B1).
  const ac = /\[actionColumn\](?:\s*=\s*(?:"([^"]*)"|'([^']*)'))?/.exec(html);
  if (!ac || /^\s*false\s*$/i.test(ac[1] ?? ac[2] ?? "true")) {
    return { name: "rowAuth", status: "skip", detail: "no truthy [actionColumn] (action column not emitted)" };
  }
  if (!rawXml || !/<Aksi\b/i.test(rawXml)) {
    return { name: "rowAuth", status: "skip", detail: "no <Aksi> action-node evidence in raw XML" };
  }
  const required = requiredAuthKeysFromXml(rawXml, pilar.authKeyByAction);
  if (!required.length) {
    return { name: "rowAuth", status: "skip", detail: "<Aksi> present but no enabled action booleans (nothing to require)" };
  }
  const assigned = detectAuthFlags(ts);
  const missing = required.filter((k) => !assigned.has(k));
  if (missing.length) {
    return {
      name: "rowAuth",
      status: "fail",
      detail: `action-column auth missing: ${missing.join(", ")}`,
      missing,
      required,
    };
  }
  return { name: "rowAuth", status: "pass", detail: `action-column auth flags present (${required.join(", ")})`, required };
}

function requiredAuthKeysFromXml(rawXml, authKeyByAction) {
  const keys = new Set();
  for (const block of rawXml.matchAll(/<Aksi\b[\s\S]*?<\/Aksi>/gi)) {
    // A hidden <Aksi> is not a visible action column → it must not require auth flags. Hidden is
    // signalled either as `visible="false"` on the node OR (FIGML style) via
    // `<override overriddenField="visible" value="false">`. The old check read only the direct
    // attribute, so a hidden-by-override Aksi forced the agent to add phantom auth (2026-09-10 B1).
    if (isHiddenAksi(block[0])) continue;
    const props = block[0].match(/<componentProperties\b[\s\S]*?<\/componentProperties>/i);
    if (!props) continue;
    for (const prop of props[0].matchAll(/<([A-Za-z_][\w]*)\b([^>]*)\/>/g)) {
      const name = prop[1];
      const attrs = prop[2];
      if (/type="BOOLEAN"/.test(attrs) && /value="true"/.test(attrs)) {
        const key = normalizeFigmaAction(name, authKeyByAction);
        if (key) keys.add(key);
      }
    }
  }
  return [...keys];
}

/** Is an <Aksi> block hidden? True when the node (or an override within it) sets visible=false. */
function isHiddenAksi(block) {
  const open = /^<Aksi\b([^>]*)>/i.exec(block)?.[1] ?? "";
  if (/visible\s*=\s*["']false["']/i.test(open)) return true;
  for (const o of block.matchAll(/<override\b([^>]*)\/?>/gi)) {
    const attrs = o[1];
    if (/overriddenField\s*=\s*["']visible["']/i.test(attrs) && /value\s*=\s*["']false["']/i.test(attrs)) {
      return true;
    }
  }
  return false;
}

function normalizeFigmaAction(rawName, authKeyByAction) {
  const base = String(rawName).toLowerCase().replace(/_\d+(_\d+)?$/, "").replace(/^_+|_+$/g, "");
  return authKeyByAction[base] ?? null;
}

/** Scan the WHOLE ts string (not just `[…]` bodies — auth is often attached inside a `.map()`
 *  callback) for truthy auth flag assignments. Accepts:
 *    auth.canUpdate = true | 1          (also this.auth.canUpdate)
 *    auth["canUpdate"] = true | 1
 *    auth: { canUpdate: true }          (and AuthorizationModel({ canUpdate: true }) literals)
 *    auth: Object.assign(new AuthorizationModel(), { canUpdate: true })   (2026-09-11 F3 —
 *      the idiom this repo's existing components use; the old regex missed it and reported
 *      explicitly-written flags as "missing")
 */
function detectAuthFlags(ts) {
  const flags = new Set();
  for (const m of ts.matchAll(/\bauth\s*\.\s*([A-Za-z_$][\w$]*)\s*=\s*(?:true|1)\b/g)) flags.add(m[1]);
  for (const m of ts.matchAll(/\bauth\s*\[\s*["']([A-Za-z]+)["']\s*\]\s*=\s*(?:true|1)\b/g)) flags.add(m[1]);
  for (const m of ts.matchAll(/\b(?:auth|AuthorizationModel)\s*(?::|=)\s*(?:new\s+AuthorizationModel\s*\(\s*)?\{([^}]*)\}/g)) {
    for (const p of m[1].matchAll(/\b(can[A-Za-z]+)\s*:\s*(?:true|1)\b/g)) flags.add(p[1]);
  }
  for (const m of ts.matchAll(/Object\.assign\(\s*new\s+AuthorizationModel\s*\([^)]*\)\s*,\s*\{([^}]*)\}/g)) {
    for (const p of m[1].matchAll(/\b(can[A-Za-z]+)\s*:\s*(?:true|1)\b/g)) flags.add(p[1]);
  }
  return flags;
}

// ---------- 3e. filter-row button (XML button in the filter group is not dropped) ----------

function checkFilterRowButton(html, rawXml) {
  if (!rawXml) {
    return { name: "filterRowButton", status: "skip", detail: "no raw XML to check filter buttons against" };
  }
  // The search/apply button lives in the filter group, adjacent to the fields. Its label is NOT
  // hardcoded to this codebase's "Cari" — a slice may say "Search"/"Filter"/"Terapkan". Collect
  // the XML's filter-action buttons (a label that names a search/filter/apply action), which keeps
  // the check language-agnostic without sweeping in unrelated short buttons (bulk actions).
  const FILTER_ACTION = /\b(cari|search|filter|apply|terapkan|go|jalankan|reset|ulang)\b|\bcari\s+data\b|^\s*(cari|search)\s*$/i;
  const labels = new Set();
  for (const b of rawXml.matchAll(/<Button_FNC\b[\s\S]*?<\/Button_FNC>/gi)) {
    const chars = /characters="([^"]*)"/.exec(b[0])?.[1]?.trim();
    // Short imperative that names an action on the filter (≤ 24 chars) — excludes the long
    // object-verb bulk buttons ("Ubah massal tgl akhir bayar") that live below the filter row.
    if (chars && chars.length <= 24 && FILTER_ACTION.test(chars)) labels.add(chars);
  }
  if (!labels.size) {
    return { name: "filterRowButton", status: "skip", detail: "no filter-action button in XML" };
  }
  // Each filter-area button label must be rendered as visible element text.
  const rendered = renderedText(html);
  const norm = (s) => s.replace(/\s+/g, " ").trim();
  const gen = norm(rendered);
  const missing = [...labels].filter((l) => !gen.includes(norm(l)));
  if (missing.length) {
    return {
      name: "filterRowButton",
      status: "fail",
      detail: `filter-action button(s) not rendered: ${missing.join(", ")}`,
      missing,
    };
  }
  return { name: "filterRowButton", status: "pass", detail: `filter-action button(s) rendered (${[...labels].join(", ")})` };
}

// ---------- 3f. button order (paired action buttons match XML left→right order) ----------

function checkButtonOrder(html, scss, rawXml) {
  // Only meaningful when the output actually reverses the visual order. The defect: the agent
  // emits `flex-direction: row-reverse` on a row of paired action buttons, flipping the XML's
  // left→right order. That signal lives in SCSS (e.g. `.action-bar { flex-direction: row-reverse }`)
  // or as an inline style. Without the reverse signal there is nothing to flag.
  const reverse = /flex-direction\s*:\s*row-reverse/i.test(scss + " " + html);
  if (!reverse) {
    return { name: "buttonOrder", status: "skip", detail: "no row-reverse signal in output" };
  }
  return { name: "buttonOrder", status: "fail", detail: "bulk/action buttons reversed (row-reverse) vs XML left→right order" };
}

// ---------- 3g. table options (search/limit/pagination map XML evidence) ----------

function checkTableOptions(html, rawXml) {
  // Map XML evidence → the uii-table binding that must be present. The three bindings are
  // LEGAL (not the forbidden server-mode set), but the 0.10.0 output dropped them even
  // though the XML shows a search bar, "Tampilkan N data", and a pagination footer.
  const tableTag = /<(uii-table|ngx-datatable|mat-table)(?!-skeleton)\b[\s\S]*?>/i.exec(html);
  if (!tableTag) {
    return { name: "tableOptions", status: "skip", detail: "no table component in output" };
  }
  if (!rawXml) {
    return { name: "tableOptions", status: "skip", detail: "no raw XML to check table options against" };
  }
  const el = tableTag[0];
  const inputs = new Set([...el.matchAll(/\[(\w+)\]/g)].map((m) => m[1]));

  const required = [];
  // A <search_bar> is the TABLE's toolbar search UNLESS it sits inside a filter card that also
  // carries other filter controls (Field/Select/Button_FNC) — then it is a decorative page
  // search, and demanding [searchOptions] makes the table render a SECOND search box (2026-09-11
  // F14). The heuristic is conservative: only skip when the search_bar is inside a frame that
  // also contains a filter control.
  if (/<search_bar\b/i.test(rawXml) && !searchBarInFilterCard(rawXml)) required.push("searchOptions");
  if (/Tampilkan\s+\d+\s+data/i.test(rawXml)) required.push("limitOptions");
  if (/Menampilkan\s+\d+\s*-\s*\d+\s+(?:dari|of)\s+\d+\s+data/i.test(rawXml)) required.push("paginationOptions");
  // The pagination ALIGNMENT is evidence-gated the same way (2026-09-24). `paginationAlign` is a
  // legal *presentation* input whose runtime default is 'center', so a design that puts the
  // pagination at the frame's right edge renders centered unless the binding is sent — and the
  // hand-written ::ng-deep that used to compensate never aligned it reliably.
  const wantsRight = paginationAlignRightEvidenced(rawXml);

  const missing = required.filter((b) => !inputs.has(b));
  if (missing.length) {
    return {
      name: "tableOptions",
      status: "fail",
      detail: `uii-table missing binding(s) evidenced by the XML: ${missing.join(", ")}`,
      missing,
    };
  }
  // Checked against the ACTUAL binding value, not mere presence: `[paginationAlign]="'left'"`
  // set against a right-aligned footer is wrong even though the input is present. The value is
  // normalized rather than regex-matched — Angular templates quote it as `"'right'"`, `'right'`,
  // `"right"` or a bare expression, and a pattern tuned to one form silently rejects the others.
  const alignValue = String(el.match(/\[paginationAlign\]\s*=\s*(['"])([\s\S]*?)\1/i)?.[2] ?? "")
    .replace(/['"]/g, "")
    .trim()
    .toLowerCase();
  if (wantsRight && alignValue !== "right") {
    return {
      name: "tableOptions",
      status: "fail",
      detail: `uii-table [paginationAlign] must be "'right'" — the XML footer distributes its children (pagination at the frame's right edge). pilar defaults this input to 'center', so a missing/other value renders the control centered.`,
      missing: ["paginationAlign"],
    };
  }
  if (!required.length && !wantsRight) {
    return { name: "tableOptions", status: "skip", detail: "no search/limit/pagination evidence in XML" };
  }
  const bound = [...required];
  // Naming the actual value (not just "present") keeps the pass message honest when the design
  // is right-aligned AND when it is centered/left (binding allowed, simply not required).
  if (wantsRight) bound.push(`paginationAlign='right'`);
  else if (inputs.has("paginationAlign")) bound.push("paginationAlign='center' (no right-edge evidence)");
  return { name: "tableOptions", status: "pass", detail: `table options bound (${bound.join(", ")})` };
}

/** Does the raw XML show the pagination footer distributing its children (pagination pinned to
 *  the frame's right edge)? Uses the SAME `isSpaceBetween` predicate the parser and fidelity
 *  scoring use (figml-parse.mjs / fidelity.mjs both read `primaryAxisAlignItems ?? justifyContent
 *  ?? justify`), so the gate, the transcript, and the fidelity score can never disagree about
 *  what "right-aligned" means — the strongest agent-side proxy for a Figma "auto-layout with
 *  space-between" frame, which is how a right-pinned pagination is drawn.
 *
 *  Best-effort and conservative: any ambiguity (unparseable XML, no alignment attribute at all)
 *  returns false, so the binding stays ALLOWED but UNREQUIRED rather than being demanded on a
 *  guess. */
function paginationAlignRightEvidenced(rawXml) {
  if (!rawXml || !PAGINATION_HINT.test(rawXml)) return false;
  const parsed = parseFigml(rawXml, "evidence.xml");
  if (!parsed.ok) return false;
  // Two independent signals, either sufficient. The parser keeps ONLY "space-between" in
  // `node.justify` (justifyContentOf returns null for every other value), so `distributes` is a
  // plain truth test, not a string compare.
  //
  // (a) PARSED — walk the transcript tree, carrying the ancestor chain, and match a node whose
  //     surviving text/description names the pagination region while it (or a container in its
  //     chain) distributes its children. This is the precise signal.
  // (b) RAW — fallback for the shape the parser cannot carry: a frame's `name` attribute is NOT
  //     retained on non-icon nodes, so `<frame name="Pagination">` is invisible to (a). Match the
  //     raw tags directly.
  let found = false;
  const visit = (nodes, ancestors) => {
    for (const n of nodes ?? []) {
      if (found || !n || typeof n !== "object") continue;
      const content = `${n.glyphName ?? ""} ${n.description ?? ""} ${n.text ?? ""}`;
      if (PAGINATION_HINT.test(content) && (n.justify === "space-between" || ancestors.some((a) => a.justify === "space-between"))) {
        found = true;
        return;
      }
      const next = n.justify === "space-between" ? [...ancestors, n] : ancestors;
      if (n.children) visit(n.children, next);
    }
  };
  visit(parsed.transcript.layout, []);
  if (found) return true;
  return /<frame[^>]*(?:primaryAxisAlignItems|justifyContent)="SPACE_BETWEEN"[^>]*>[\s\S]*?(?:pagination|Menampilkan)/i.test(rawXml);
}

/** What the design calls the pagination region. Deliberately NOT bare `page` — the root frame of a
 *  FIGML export is frequently named "Page", and matching that would demand a right-aligned table
 *  on every design. The `Menampilkan N-M dari K data` footer is included because it is the same
 *  signal `checkTableOptions` already uses to demand [paginationOptions] — the two must agree. */
const PAGINATION_HINT = /pagination|pager\b|page[-_]?(?:box|nav|number)|Menampilkan\s+\d+\s*-\s*\d+\s+(?:dari|of)/i;

/** Conservative F14 heuristic: is a <search_bar> inside a filter card (i.e. a frame that ALSO
 *  holds a Field/Select/Button filter control), not the table's own toolbar? True only when the
 *  search_bar shares a frame with a filter control — anything ambiguous → false (keep requiring
 *  searchOptions, the safer default). */
function searchBarInFilterCard(rawXml) {
  for (const frame of rawXml.matchAll(/<frame\b[\s\S]*?<\/frame>/gi)) {
    const body = frame[0];
    if (!/<search_bar\b/i.test(body)) continue;
    if (/<Field\b|<Select\b|<Button_FNC\b|<Dropdown\b/i.test(body)) return true;
  }
  return false;
}

// ---------- 3h. grid columns (a filter row's col spans must sum to ≤ 12) ----------

function checkGridColumns(html) {
  // A `.row` whose Bootstrap col-*-N spans sum to more than 12 wraps its trailing children onto
  // the next line. The 0.11.0 output put 4 items in one filter row all at col-md-4 (16 > 12),
  // so the "Cari" button fell to a new line. Enforce the invariant deterministically instead of
  // relying on the agent reading a prose rule.
  //
  // Per-breakpoint summation: a grid child carries ONE span per breakpoint (`col-md-4 col-12` is
  // md:4 + a mobile fallback col-12, NOT two concurrent columns). We sum per breakpoint bucket
  // (bare `col-6` → "default"), and only the DIRECT children of a `.row` (nested `.row`s are
  // their own rows, never siblings of the parent row's columns).
  const problems = [];
  const nodes = divTree(html);
  for (const node of nodes) {
    if (!isRow(node)) continue;
    const sums = new Map();
    const counts = new Map();
    for (const child of node.children) {
      if (!isCol(child)) continue;
      const cls = classOf(child);
      const seen = new Set();
      for (const m of cls.matchAll(/col(?:-(xs|sm|md|lg|xl|xxl))?-(\d+)/gi)) {
        const bp = m[1] ?? "default";
        if (seen.has(bp)) continue; // one span per breakpoint per element
        seen.add(bp);
        sums.set(bp, (sums.get(bp) ?? 0) + Number(m[2]));
        counts.set(bp, (counts.get(bp) ?? 0) + 1);
      }
    }
    for (const [bp, span] of sums) {
      if (span > 12) {
        problems.push(`a row's ${bp === "default" ? "breakpoint-less" : bp} columns span ${span}/12 across ${counts.get(bp)} items (a child wraps)`);
      }
    }
  }
  if (problems.length) {
    return { name: "gridColumns", status: "fail", detail: problems.join("; "), problems };
  }
  return { name: "gridColumns", status: "pass", detail: "no filter row exceeds 12 columns" };
}

// ---------- minimal div tree (gridColumns) ----------

/** A {tag,attrs,children,closed} node parsed from opening/closing tags (no text needed). */
function divTree(html) {
  const root = { children: [], closed: true };
  const stack = [root];
  const re = /<\/?div\b[^>]*>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const token = m[0];
    const isClose = token.startsWith("</");
    if (isClose) {
      const top = stack[stack.length - 1];
      if (top !== root) { top.closed = true; stack.pop(); }
      continue;
    }
    const node = { tag: "div", attrs: token, children: [], closed: false };
    stack[stack.length - 1].children.push(node);
    if (!token.endsWith("/>")) stack.push(node);
  }
  return root.children;
}
function isRow(n) { return /\brow\b/.test(classOf(n)); }
function isCol(n) { return /\bcol(?:-(?:xs|sm|md|lg|xl|xxl))?-\d+/.test(classOf(n)); }
function classOf(n) { return /class=["']([^"']*)["']/.exec(n.attrs)?.[1] ?? ""; }

// ---------- 4c. icon color / status-badge semantics ----------

/** FontAwesome icon colors. The XML's icon fill color picks which `fa-*` is faithful: a
 *  red `#f44444` badge icon is `fa-exclamation-circle`; an orange `#f9933f` is
 *  `fa-exclamation-triangle`. SliceUI must map the XML color → the right icon, not invent one.
 *  (Defect: sliceui emitted `fa-exclamation-triangle` + `#f9933f` for a `#f44444` badge.) */
const FA_ICON_COLORS = {
  "#f44444": ["fa-exclamation-circle", "fa-times-circle", "fa-minus"],
  "#f9933f": ["fa-exclamation-triangle", "fa-exclamation"],
  "#4fbbbb": ["fa-check-circle"],
  "#03337b": ["fa-search", "fa-pencil", "fa-eye"],
  "#004c88": ["fa-info-circle"], // banner info icon (Report #1 §6.4)
  "#3e82f3": ["fa-check-circle"], // "Aktif" badge glyph (Report #1 §6.6)
};

function checkIconColor(generated, transcript) {
  // The design's status-icon fill colors (from the transcript's icon nodes) — skip generic
  // blue/black/white that are structural, not semantic.
  const designColors = new Set();
  walkNodes(transcript?.layout, (n) => {
    if (n.type === "icon" && n.bg && !["#03337b", "#303030", "#ffffff"].includes(n.bg)) {
      designColors.add(n.bg);
    }
  });
  const semantic = [...designColors].filter((c) => FA_ICON_COLORS[c]);
  if (!semantic.length) {
    return { name: "iconColor", status: "skip", detail: "no semantic status-icon colors in design" };
  }
  // Collect (fa-*, assigned color) from generated SCSS, accepting 3-hex, 6-hex, and rgb()/rgba().
  const styledIcons = [];
  const re = /fa-([a-z0-9-]+)[^{}]*\{[^}]*color\s*:\s*([^;!}]+)/gi;
  for (const m of generated.matchAll(re)) {
    const color = parseCssColor(m[2]);
    if (color) styledIcons.push({ icon: "fa-" + m[1], color });
  }
  if (!styledIcons.length) {
    return { name: "iconColor", status: "skip", detail: "no fa-* icon with a color in generated code" };
  }
  // An icon is only "matched" if it is one the design's semantic color would produce (same
  // icon glyph family). Neutrals are structural ONLY when no design color targets that glyph;
  // a badge whose design fill is #f44444 must not render its icon neutral (#333/#fff/#000).
  // `#03337b` is the project's structural BLUE for ACTION icons (search/pencil/eye) — not a
  // status color. It is excluded from `designColors` above; it must be neutral HERE too, or a
  // faithful `fa-pencil { color: #03337b }` gets false-failed (2026-09-10 B4).
  const neutral = new Set(["#303030", "#333333", "#000000", "#ffffff", "#f5f5f5", "#03337b"]);
  const problems = [];
  for (const { icon, color } of styledIcons) {
    if (semantic.includes(color)) continue; // matches a design color → OK
    const designGlyphs = semantic.flatMap((c) => FA_ICON_COLORS[c]);
    const targetsDesignGlyph = designGlyphs.includes(icon);
    if (neutral.has(color) && !targetsDesignGlyph) continue; // structural neutral, no design target
    problems.push(`${icon} styled with ${color}, but design status icons are ${semantic.join(", ")}`);
  }
  if (problems.length) {
    return { name: "iconColor", status: "fail", detail: problems.join("; ") };
  }
  return { name: "iconColor", status: "pass", detail: `icons match design colors (${semantic.join(", ")})` };
}

/** Normalize a CSS color value to lowercase #rrggbb (or null when it is not a literal color). */
export function parseCssColor(v) {
  const s = (v ?? "").trim().toLowerCase();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/.exec(s);
  if (hex) {
    const h = hex[1];
    return h.length === 3 ? `#${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}` : `#${h}`;
  }
  const rgb = /^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/.exec(s);
  if (rgb) {
    return `#${[1, 2, 3].map((i) => Number(rgb[i]).toString(16).padStart(2, "0")).join("")}`;
  }
  return null;
}

// ---------- 5. anatomy ----------

function checkAnatomy(html, anatomy = {}) {
  const hasTable = /<(uii-table|ngx-datatable|mat-table)(?!-skeleton)\b/i.test(html);
  if (!anatomy.tableTag && !hasTable) {
    return { name: "anatomy", status: "skip", detail: "no table anatomy to check" };
  }
  // The skeleton is a LOADING-state structure. "STRUCTURE = XML/TRANSCRIPT ONLY" is SliceUI's
  // hardest rule — demanding a skeleton the design never shows forces the agent to ADD an
  // isLoading/*ngIf wrapper that contradicts it (2026-09-11 F11). Downgrade to a WARN: the
  // skeleton is a good-to-have when the project loads data async, never a blocking fail.
  if (hasTable && anatomy.skeletonTag && !new RegExp(`<${anatomy.skeletonTag}\\b`, "i").test(html)) {
    return {
      name: "anatomy",
      status: "warn",
      detail: `table present but <${anatomy.skeletonTag}> loading state missing — add it only if the design/UX evidences a loading state (never a hard fail: structure = XML only)`,
    };
  }
  return { name: "anatomy", status: "pass", detail: "table + skeleton structure present" };
}

// ---------- 6. mockRowCount ----------

/** Is this a LIBRARY table (uii-table/ngx-datatable/mat-table), i.e. the paged-data table the
 *  mock-row floor exists for? Shared regex used by tableBindings/anatomy/scssCoverage too. */
function isLibraryTable(html) {
  return /<(uii-table|ngx-datatable|mat-table)(?!-skeleton)\b/i.test(String(html ?? ""));
}

function checkMockRowCount(html, ts, anatomy = {}, transcript) {
  // The mock-row floor exists to activate PAGINATED LIBRARY tables. A uii-table with all
  // complement bindings explicitly OFF (`[paginationOptions]="false"`, `[searchOptions]="false"`,
  // `[limitOptions]="false"`) is a plain canvas: every row renders at once, so the design's row
  // count is correct and 15 would be WRONG (2026-09-11 F4). Same guard pattern as checkRowAuth.
  if (isLibraryTable(html)) {
    const tableTag = /<(?:uii-table|ngx-datatable|mat-table)(?!-skeleton)\b[^>]*>/i.exec(String(html ?? ""))?.[0] ?? "";
    const off = (binding) => new RegExp(`\\[${binding}\\]\\s*=\\s*["']false["']`).test(tableTag);
    if (off("paginationOptions") && off("searchOptions") && off("limitOptions")) {
      return {
        name: "mockRowCount",
        status: "skip",
        detail: "table complement explicitly off (pagination/search/limit = false) — a plain canvas renders the design's row count, the 15-row floor does not apply",
      };
    }
  }
  const rows = countMockRows(html, ts);
  if (rows === null) {
    return { name: "mockRowCount", status: "skip", detail: "could not determine mock row count" };
  }
  // The mock-row floor exists to activate PAGINATED LIBRARY tables. A plain HTML <table> detail
  // list (not a uii-table/ngx-datatable/mat-table, no pagination footer) is a different design —
  // demanding 15 rows there would force the agent to invent content the design doesn't show.
  // Honest "not applicable" (H3) instead of a false positive.
  if (!isLibraryTable(html)) {
    return {
      name: "mockRowCount",
      status: "skip",
      detail: "no paginated library table (uii-table/ngx-datatable/mat-table) — mock-row floor not applicable (plain/detail list)",
    };
  }
  // Cap, not a floor: a paginated table renders EXACTLY 15 mock rows. The transcript's
  // "dari N data" total must NOT raise the count (report §6.5 — 513 literal rows is a
  // non-idiomatic file). More than 15 is a fail just like fewer than 15.
  const required = anatomy?.mockRowsFloor ?? 15;
  if (rows !== required) {
    return {
      name: "mockRowCount",
      status: "fail",
      detail: `${rows} mock rows != required ${required} (a paginated table renders exactly ${required} mock rows — no more, no fewer)`,
      rows,
      required,
    };
  }
  return { name: "mockRowCount", status: "pass", detail: `${rows} mock rows = ${required}` };
}

// ---------- 6b. libraryTable (no downgrade to a plain <table> in a library-table project) ----------

function checkLibraryTable(html, anatomy = {}, transcript = null, rawXml = null) {
  const tableTag = anatomy?.tableTag;
  const isLibraryTag = tableTag && /^(uii-table|ngx-datatable|mat-table)$/i.test(tableTag);
  if (!isLibraryTag) {
    return { name: "libraryTable", status: "skip", detail: "no library-table convention in this project" };
  }
  const plain = /<table\b/i.test(String(html ?? ""));
  if (!plain) {
    return { name: "libraryTable", status: "skip", detail: "no plain <table> in output" };
  }
  if (new RegExp(`<${tableTag}\\b`, "i").test(String(html ?? ""))) {
    return { name: "libraryTable", status: "pass", detail: `uses the project's <${tableTag}> library table` };
  }
  // A plain <table> is a real downgrade ONLY when the design evidences a PAGED list — search bar
  // ("Tampilkan N data" / <search_bar>), a pagination footer ("Menampilkan … dari N data"), or
  // limit options. A plain matrix/read-only detail/placeholder table (rowspan/colspan, no
  // search/limit/pagination) is a legitimate native table, not a downgrade (Report #1 §6.3).
  const hasPagedEvidence = /(?:Menampilkan|Showing)\s+\d+\s*-\s*\d+\s+(?:dari|of)\s+\d+\s+data/i.test(String(transcript ? JSON.stringify(transcript) : ""))
    || /Tampilkan\s+\d+\s+data/i.test(String(transcript ? JSON.stringify(transcript) : ""))
    || /<search_bar\b/i.test(String(rawXml ?? ""))
    || /<uii-pagination\b|ugw-pagination/i.test(String(rawXml ?? ""));
  if (!hasPagedEvidence) {
    return { name: "libraryTable", status: "skip", detail: "plain <table> is a detail/matrix/placeholder table (no search/limit/pagination evidence) — native is legitimate" };
  }
  return {
    name: "libraryTable",
    status: "fail",
    detail: `plain <table> used where the design shows a paged list — use <${tableTag}> (it wires search/limit/pagination the design relies on)`,
  };
}

// ---------- 6c. pilar-injection (a uii-* slice must not silently skip the pilar checks) ----------

/** The pilar feature data (catalog + binding policy) gates the uii-table binding / row-auth checks.
 *  It is injected by the CLI (`loadPilar()`) but is `null` when `verifyComponent` is used as a
 *  library directly. A `uii-*` slice verified WITHOUT pilar would silently skip those checks and
 *  could read "green" — the false-confidence machine from the other side. Emit a warn (not a fail,
 *  since a non-UII install legitimately lacks pilar) so a direct-library caller KNOWS the wiring
 *  checks did not run (Report #2 §4.6). */
function checkPilarInjection(scss, html, ts, pilar) {
  const usesUii = /<(uii-[a-z-]+)\b/i.test(String(html ?? "")) || /@uiigateway/i.test(String(ts ?? ""));
  if (pilar || !usesUii) {
    return { name: "pilarInjection", status: "skip", detail: pilar ? "pilar present" : "no uii-* usage" };
  }
  return {
    name: "pilarInjection",
    status: "warn",
    detail: "uii-* component present but pilar catalog is NOT injected — tableBindings/pilarBindings/rowAuth were skipped. Inject loadPilar() for a UII project.",
  };
}

// ---------- 20. declaredInModule (a library component must be in its NgModule declarations) ----------

/** A library `ng build` silently SKIPS a component that is not in its NgModule's `declarations`
 *  (green ≠ compiled; NG8001 only surfaces in the app build). This check names the component class
 *  and confirms it appears INSIDE a `declarations: [...]` array — parsed brace-aware, NOT matched
 *  loosely across the whole module source: the old whole-source regex false-PASSED a component
 *  that only appeared in a route's `component: X` entry (2026-09-11 F2). */
function checkDeclaredInModule(ts, modules) {
  const cls = /export\s+class\s+([A-Za-z_$][\w$]*)\s*(?:extends|implements|\{|\()/.exec(String(ts ?? ""))?.[1];
  if (!cls) {
    return { name: "declaredInModule", status: "skip", detail: "no exported component class to check" };
  }
  const mods = String(modules ?? "");
  if (!mods.trim()) {
    return { name: "declaredInModule", status: "skip", detail: "no module source to check against (run verify from the project root)" };
  }
  const declared = extractDeclarationsArrays(mods);
  if (!declared.length) {
    // Cannot statically confirm (no parseable declarations array) → honest skip, never a pass.
    return { name: "declaredInModule", status: "skip", detail: "cannot statically confirm — no parseable declarations: [...] array found in module sources" };
  }
  if (declared.some((body) => new RegExp(`(^|[^\\w$])${cls}([^\\w$]|$)`).test(body))) {
    return { name: "declaredInModule", status: "pass", detail: `${cls} is in the owning NgModule declarations` };
  }
  return {
    name: "declaredInModule",
    status: "warn",
    detail: `${cls} not found in any NgModule declarations — a library ng build skips undeclared components; register it, then confirm with the app build`,
  };
}

/** Extract the BODY of every `declarations: [...]` array in @NgModule-ish source (brace-aware,
 *  so `imports: [RouterModule.forChild(routes)]` cannot bleed into the match). */
function extractDeclarationsArrays(src) {
  const out = [];
  const re = /\bdeclarations\s*:\s*\[/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    const start = m.index + m[0].length;
    let depth = 1;
    for (let i = start; i < src.length && depth > 0; i++) {
      const c = src[i];
      if (c === "[" || c === "(" || c === "{") depth++;
      else if (c === "]" || c === ")" || c === "}") depth--;
      if (depth === 0) {
        out.push(src.slice(start, i));
        break;
      }
    }
  }
  return out;
}

/** Count the mock rows. Prefers the array BOUND to `[rows]="X"` in the HTML (2026-09-11 F4: the
 *  old largest-array heuristic counted `columns` (5) instead of `rows` (3) and failed a correct
 *  component). Falls back to the largest array only when the binding cannot be resolved.
 *  Supports `const base = [...]`, `rows = [...]`, `private x: Array<any> = [...]`, `x = [...]`. */
function countMockRows(html, ts) {
  const bound = /\[rows\]\s*=\s*["'](\w+)["']/.exec(String(html ?? ""))?.[1];
  if (bound) {
    const re = new RegExp(`(?:(?:private|protected|public|readonly|const|let|var)\\s+)?${bound}\\s*(?::\\s*[A-Za-z<>\\[\\]]+)?\\s*=\\s*\\[([\\s\\S]*?)\\]\\s*;`);
    const m = re.exec(String(ts ?? ""));
    if (m) {
      const n = countArrayElements(m[1]);
      if (n > 0) return n;
    }
    // Bound name present in HTML but no matching array literal (rows built via .map/fill):
    // counting a DIFFERENT array would be wrong — skip honestly.
    return null;
  }
  let best = null;
  const re = /(?:(?:private|protected|public|readonly|const|let|var)\s+)?\w+\s*(?::\s*[A-Za-z<>\[\]]+)?\s*=\s*\[([\s\S]*?)\]\s*;/g;
  let m;
  while ((m = re.exec(ts)) !== null) {
    const n = countArrayElements(m[1]);
    if (n > 0 && (best === null || n > best)) best = n;
  }
  return best;
}

/** Count top-level comma-separated elements (brace/quote aware) inside an array body.
 *  A trailing comma (`[a, b, c,]`) is a legal, idiomatic TS array — it must NOT count as an
 *  extra element (2026-09-10 B2). */
function countArrayElements(body) {
  const trimmed = String(body ?? "").replace(/[\s,]+$/, ""); // drop trailing whitespace + commas
  if (!trimmed) return 0;
  let depth = 0;
  let count = 1;
  let quote = null;
  for (let i = 0; i < trimmed.length; i++) {
    const c = trimmed[i];
    if (quote) { if (c === quote) quote = null; continue; }
    if (c === '"' || c === "'") { quote = c; continue; }
    if (c === "{" || c === "[" || c === "(") depth++;
    else if (c === "}" || c === "]" || c === ")") depth--;
    else if (c === "," && depth === 0) count++;
  }
  return count;
}

// ---------- 18. styleFidelity (value coverage: design values survive in the authored slice) ----------

/** Style-fidelity check (value-coverage, remediation FASE 1.1). The transcript carries the
 *  DESIGN's own values — text color/size/weight, divider color — per node. The classic
 *  verify-green-but-localhost-wrong miss was `.h1 { color: #555 }` when the design said
 *  `#000000`; no check compared generated SCSS VALUES against the transcript. This check
 *  compares every design value fact that maps deterministically to an AUTHORSED slice rule
 *  (a `.class { … }` written in the generated SCSS) and passes only when ≥80% of comparable
 *  facts match.
 *
 *  Anti-false-positive guard (invented-only): a design fact is compared ONLY when the generated
 *  element's class has its own authored rule in the slice SCSS. A class the slice REUSES from
 *  the project (btn, form-group, control-label, ::ng-deep corpus, a library-internal token) has
 *  no authored slice rule → the fact is skipped, never failed. This keeps "copy-convention-first"
 *  intact while still catching invented values that drift from the design.
 *
 *  Token substitution ($x / var(--y)) is skipped, never false-flagged — without a resolved value
 *  we cannot judge it (and an unreachable token is not a comparable fact). */
/** Gather the authored-rule design facts (text color/size/weight + divider color) that both
 *  `checkStyleFidelity` scores and `render-probe` renders. Returns
 *  `{ comparable, problems }` where each `comparable` entry is
 *  `{ kind: "text"|"divider", where, prop, design, actual, className?, text? }` and `problems`
 *  is the drift-string list (same phrasing the verify gate reports). Shared so the string-level
 *  gate and the browser-level probe can never disagree on WHAT to judge. */
export function collectStyleFacts(scss, html, transcript) {
  const gen = `${String(scss ?? "")}\n${String(html ?? "")}`;
  const comparable = []; // { where, prop, design, actual, kind, className, text } — every fact with an authored target
  const problems = [];
  const missing = []; // design values the slice authored a rule for but FAILED to declare (hard fail)
  const seen = new Set();

  const addFact = (where, prop, design, actual, extra = {}) => {
    const key = `${where}|${prop}`;
    if (seen.has(key)) return;
    seen.add(key);
    comparable.push({ where, prop, design, actual, ...extra });
    if (String(actual).toLowerCase() !== String(design).toLowerCase()) problems.push(`${where} ${prop}: actual ${actual}, design ${design}`);
  };

  // (1) Authored-rule text facts: every styled text node (title, buttons, labels) whose generated
  // element carries an authored class rule → compare color/size/weight.
  for (const n of textNodes(transcript)) {
    const t = (n.text ?? "").trim();
    if (!t || GLYPH.test(t)) continue;
    const authored = authoredRuleForText(html, t, scss); // { className, ruleBody, chain, tag } or null
    if (!authored) continue; // reuse class / no authored slice rule → not comparable (skip, never fail)
    const where = `text "${trunc(t)}" (.${authored.className})`;
    // Effective declarations = innermost-wins merge across the authored chain (element → ancestors),
    // so a value inherited from an authored parent is NOT treated as missing.
    const decls = effectiveDecls(authored.chain);
    const extra = { kind: "text", className: authored.className, text: t };
    if (n.style?.color) {
      const dv = normHex(n.style.color);
      const cv = resolveHex(decls.color);
      if (cv) addFact(where, "color", dv, cv, extra); // token/absent → skip (never false-flagged)
    }
    if (n.style?.size) {
      const size = Number(n.style.size);
      if (/^h[1-6]$/.test(authored.tag) && decls["font-size"] === undefined) {
        // Heading with a design size but NO authored font-size renders at the UA default (~2em),
        // a categorically wrong, high-visibility defect (the title 2× too large). This is the ONE
        // "missing declaration" case the string-level gate can flag reliably — non-headings inherit
        // or default to design-consistent values, and descendant-selector styling (.table th) is
        // invisible to a class-chain model. Full cascade "missing" detection is the render-probe's job.
        addFact(where, "font-size", size, "missing", extra);
        missing.push(`${where} font-size`);
      } else {
        const cv = pxNum(decls["font-size"]);
        if (cv !== null) addFact(where, "font-size", size, cv, extra);
      }
    }
    if (n.style?.weight) {
      const cv = weightNum(decls["font-weight"]);
      if (cv !== null) addFact(where, "font-weight", Number(n.style.weight), cv, extra);
    }
  }

  // (2) Divider color: a design divider with a non-default bg must be reachable in output.
  //     Counted as ONE comparable fact — its actual is "missing" when absent, so a dropped
  //     divider always drags coverage (never passes silently on a strong text match).
  const dividerColor = dividerColorOf(transcript);
  if (dividerColor) {
    const present = normHex(gen).includes(normHex(dividerColor));
    const where = "divider";
    if (present) {
      comparable.push({ where, prop: "bg", design: dividerColor, actual: dividerColor, kind: "divider" });
    } else {
      comparable.push({ where, prop: "bg", design: dividerColor, actual: "missing", kind: "divider" });
      problems.push(`divider bg: actual missing ${dividerColor} (design)`);
    }
  }

  return { comparable, problems, missing };
}

function checkStyleFidelity(scss, html, transcript, conventions = {}) {
  if (!transcript) return { name: "styleFidelity", status: "skip", detail: "no transcript to check style facts against" };
  const gen = `${String(scss ?? "")}\n${String(html ?? "")}`;
  if (!gen.trim()) return { name: "styleFidelity", status: "skip", detail: "no generated scss/html to check" };

  const { comparable, problems, missing } = collectStyleFacts(scss, html, transcript);

  if (!comparable.length) {
    return { name: "styleFidelity", status: "skip", detail: "no authored-rule design facts to compare (slice reuses project classes)" };
  }
  // A design value the slice authored a rule for but FAILED to declare is a HARD fail, not a
  // coverage drift: omitting the title's font-size renders it at the browser default (~2em),
  // which is categorically wrong — unlike a drift that the ≥80% tolerance is meant to absorb.
  if (missing.length) {
    return {
      name: "styleFidelity",
      status: "fail",
      detail: `missing design value(s) in the authored rule: ${missing.slice(0, 6).join("; ")}`,
      problems,
      missing,
    };
  }
  const ok = comparable.length - problems.length;
  const pct = Math.round((ok / comparable.length) * 100);
  if (problems.length && pct < 80) {
    return {
      name: "styleFidelity", status: "fail",
      detail: `${problems.length}/${comparable.length} design value(s) drift (${pct}% match < 80%): ${problems.slice(0, 6).join("; ")}`,
      problems,
    };
  }
  return { name: "styleFidelity", status: "pass", detail: `${pct}% of ${comparable.length} comparable design value(s) match` };
}

/** All styled text nodes (color/size/weight) — the design's text facts. */
function textNodes(transcript) {
  const out = [];
  walkNodes(transcript?.layout, (n) => {
    if (!n || typeof n !== "object" || n.type !== "text") return;
    if (n.hidden) return; // hidden node is not visible — its style is not a renderable fact
    const t = (n.text ?? "").trim();
    if (!t || GLYPH.test(t)) return;
    if (n.style?.color || n.style?.size || n.style?.weight) out.push(n);
  });
  return out;
}

/** Find the authored slice rule(s) for the element that renders `text`. DOM-aware: builds a
 *  lightweight element tree of the generated HTML and returns the rule for the DEEPEST element
 *  whose textContent equals the text — so a label text inside its own classed element can never
 *  be mis-attributed to a sibling/ancestor's class (the flat-regex false-positive from the
 *  execution log: labels "Total tagihan lama (Rp)" wrongly bound to `.scheme-box`).
 *
 *  Returns { className, ruleBody, chain } where `chain` is the list of authored
 *  `{ className, ruleBody }` rules along the element → ancestors (innermost first). `className`
 *  and `ruleBody` are the INNERMOST authored class (back-compat); `chain` lets callers compute
 *  effective (inheritance-aware) declarations. Returns null when the element and all its
 *  ancestors reuse project classes (no authored slice rule).
 *
 *  IMPORTANT — no substring fallback. When `findDeepestByText` (exact textContent match) misses,
 *  the text is NOT authored in the generated HTML — it lives inside a library component
 *  (a `uii-table` column header `columns[].name`, a pagination "Tampilkan N data" label, a
 *  `ngx-select` option). A case-insensitive substring scan would mis-attribute such text to a
 *  DIFFERENT authored element ("Tarif" → `<h1>Tambah tarif manual</h1>`, "data" → `Get data`
 *  button), then demand two contradictory style values on one class. That is a ghost fact, not a
 *  fidelity check: if the text is not exactly in the authored HTML, we cannot judge its style →
 *  return null (skip, never fail). This is the fix for EXPERIENCE-REPORT-2 §4.1. */
function authoredRuleForText(html, text, scss) {
  const t = String(text ?? "").trim();
  if (!t) return null;
  const tree = buildElementTree(String(html ?? ""));
  const exact = tree.findDeepestByText(t);
  if (!exact) return null; // not in the authored HTML → library-internal → skip, never attribute
  const chain = [];
  for (const el of exact.chain) {
    for (const c of el.classList) {
      if (!c) continue;
      const rule = authoredRule(scss, c);
      if (rule) chain.push({ className: c, ruleBody: rule });
    }
  }
  if (!chain.length) return null; // every ancestor reuses project classes → skip (never fail)
  // `tag` is the matched element's own tag (innermost of exact.chain), used to scope the
  // heading-size "missing" hard-fail.
  return { className: chain[0].className, ruleBody: chain[0].ruleBody, chain, tag: exact.el?.tag };
}

/** Merge authored rule bodies along an element→ancestor chain into EFFECTIVE declarations,
 *  innermost-first (CSS cascade: the closest element that sets a property wins). A property set by
 *  an authored ancestor is thus "present" and inheritable, not "missing". */
function effectiveDecls(chain) {
  const out = {};
  for (const { ruleBody } of chain ?? []) {
    const d = declMap(ruleBody);
    for (const [k, v] of Object.entries(d)) {
      if (!(k in out)) out[k] = v; // innermost (first in chain) wins
    }
  }
  return out;
}

/** Build a lightweight element tree (tag, classList, textContent, children, parent chain) from
 *  generated HTML, so text→element attribution is DOM-nesting aware instead of flat-regex. */
function buildElementTree(html) {
  const root = { tag: "#root", classList: [], children: [], parent: null, textContent: "" };
  let cur = root;
  const re = /<(\/?)([a-zA-Z][\w-]*)((?:"[^"]*"|'[^']*'|[^'">])*)>/g;
  let m;
  let lastIndex = 0;
  while ((m = re.exec(html)) !== null) {
    const between = html.slice(lastIndex, m.index);
    if (between) appendText(cur, between);
    const closing = m[1] === "/";
    const tag = m[2].toLowerCase();
    if (closing) {
      // Close the nearest ancestor with this tag.
      let node = cur;
      while (node && node !== root && node.tag !== tag) node = node.parent;
      if (node && node !== root) cur = node.parent ?? root;
    } else {
      if (/^(area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)$/.test(tag)) {
        appendText(cur, m[0]); // void element: treat as text (no subtree)
      } else {
        const clsAttr = /class\s*=\s*["']([^"']*)["']/i.exec(m[3]);
        const el = {
          tag,
          classList: (clsAttr?.[1] ?? "").split(/\s+/).filter(Boolean),
          children: [],
          parent: cur,
          textContent: "",
        };
        cur.children.push(el);
        cur = el;
      }
    }
    lastIndex = re.lastIndex;
  }
  appendText(cur, html.slice(lastIndex));
  // Propagate textContent up so every node's textContent includes descendants (used for the
  // "deepest element whose text == text" search).
  const hydrate = (node) => {
    for (const child of node.children) {
      hydrate(child);
      node.textContent += child.textContent;
    }
  };
  hydrate(root);
  return {
    /** Find the deepest element whose trimmed textContent equals `text`; return { el, chain }
     *  where chain is the element + its ancestors (root-excluded), innermost first. */
    findDeepestByText(text) {
      const matches = [];
      const visit = (node) => {
        for (const child of node.children) {
          if ((child.textContent || "").trim() === text) matches.push(child);
          visit(child);
        }
      };
      visit(root);
      if (!matches.length) return null;
      matches.sort((a, b) => depthOf(b) - depthOf(a)); // deepest first
      const el = matches[0];
      const chain = [];
      for (let n = el; n && n !== root; n = n.parent) chain.push(n);
      return { el, chain };
    },
  };
}

function depthOf(node) {
  let d = 0;
  for (let n = node.parent; n; n = n.parent) d++;
  return d;
}

function appendText(node, text) {
  if (text) node.textContent += text;
}

/** The body of the first authored `.class { … }` rule (any selector whose head contains the
 *  class), or null. Reused/global classes that the slice never authors return null. */
function authoredRule(scss, cls) {
  const clean = stripComments(scss);
  // `(?![-\\w])` after the class name is the boundary fix: `\b` alone lets `.summary-row-danger`
  // satisfy a lookup for `.summary-row` (the `\b` matches between `w` and `-`), which mis-resolved
  // `.summary-row` to the danger rule's color (2026-09-10 B5).
  const re = new RegExp(`(?:^|\\})[^{}]*\\.${cssEscape(cls)}(?![-\\w])[^{]*\\{([^{}]*)\\}`, "g");
  const m = re.exec(clean);
  return m ? m[1] : null;
}

/** Map a CSS declaration block body → { property: value } (last wins). */
function declMap(body) {
  const out = {};
  for (const m of String(body ?? "").matchAll(/([a-zA-Z-]+)\s*:\s*([^;]+)/g)) {
    out[m[1].trim().toLowerCase()] = m[2].trim().replace(/!important\s*$/i, "").trim();
  }
  return out;
}

/** Resolve a css color value to normalized hex, or null (token/var/gradient/named → cannot judge). */
function resolveHex(v) {
  if (!v) return null;
  if (/^\$|var\(|--[a-z]/i.test(v)) return null;
  const hex = /#[0-9a-f]{3,8}/i.exec(v)?.[0];
  return hex ? normHex(hex) : null;
}

/** A `14px`/`14` length → number; null when not a px literal (rem/em/token). */
export function pxNum(v) {
  if (!v) return null;
  const m = /^(-?\d+(?:\.\d+)?)px$/.exec(v.trim());
  return m ? Number(m[1]) : null;
}

/** font-weight: 500 | normal | bold | var → numeric 100-900, else null. */
export function weightNum(v) {
  if (!v) return null;
  const s = v.trim().toLowerCase();
  if (/^\$|var\(|--[a-z]/i.test(s)) return null;
  const num = /^(\d{3})$/.exec(s);
  if (num) return Number(num[1]);
  const named = { normal: 400, bold: 700, bolder: 900, lighter: 100 };
  if (s in named) return named[s];
  return null;
}

/** A design divider with a distinctive bg color (the hr under the title). */
function dividerColorOf(transcript) {
  let out = null;
  walkNodes(transcript?.layout, (n) => {
    if (out || !n || typeof n !== "object") return;
    if (n.type === "divider" && n.bg && !["#000000", "#ffffff", "#333333"].includes(n.bg.toLowerCase())) {
      out = n.bg;
    }
  });
  return out;
}

export function normHex(s) {
  return String(s ?? "").replace(/#([0-9a-fA-F])([0-9a-fA-F])([0-9a-fA-F])(?![0-9a-fA-F])/g, "#$1$1$2$2$3$3").toLowerCase();
}
function trunc(s) { const t = String(s ?? "").replace(/\s+/g, " ").trim(); return t.length > 24 ? t.slice(0, 24) + "…" : t; }

// ---------- shared walker ----------

// walkNodes imported from src/lib/walk-nodes.mjs (shared home; deduped 2026-09-05).
