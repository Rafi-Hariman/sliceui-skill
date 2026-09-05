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
//   6. mockRowCount  — rows ≥ max(conventions floor, transcript pagination total)
//   7. noHashedSelectors — reject compiled [_ngcontent-*] leaked into source
//   8. iconColor     — status-icon color must be a design color (no invented mapping)
//   9. phantomWrapper — no structural wrapper beyond the XML
//  10. ngxSelectBinding — every <ngx-select> carries [(ngModel)] + (select) (dead-filter defect)
//  11. rowAuth       — action-column rows carry the auth flags pilar needs to render icons
//  12. filterRowButton — filter-row buttons in the XML (e.g. "Cari") are not dropped
//  13. buttonOrder   — paired action buttons match the XML's left→right order (no row-reverse)
//  14. tableOptions  — search/limit/pagination bindings map XML evidence
//  15. gridColumns   — a filter row's col-*-N spans must sum to ≤ 12 (no wrapped children)
//  16. noTranslation — no `| translate` pipe (SliceUI emits literal text, never i18n)
//  17. inventedUtility — no atomic utility class (w-100/mr-2/gap-2/rounded-xl) the project never uses

import { scssCoverage } from "./fidelity.mjs";
import { LIBRARY_INTERNAL, LIBRARY_INTERNAL_WRAPPER_GUARD, TRIVIAL_CLASS } from "./conventions.mjs";

/** Pseudo-class/state tokens that never count as a distinctive class token of a selector. */
const PSEUDO = new Set(["hover", "focus", "active", "first-child", "last-child", "nth-child", "before", "after", "checked", "disabled"]);

/** Legal uii-table inputs/outputs. Anything else is red unless evidenced. */
const LEGAL_TABLE_BINDINGS = new Set([
  "rows", "columns", "actionTitle", "actionColumn", "checkboxColumn",
  "paginationOptions", "searchOptions", "selectedLimit", "limitOptions",
]);
const LEGAL_TABLE_OUTPUTS = new Set([
  "editClicked", "deleteClicked", "detailClicked", "selectedRow",
]);
const FORBIDDEN_TABLE_BINDINGS = new Set([
  "serverMode", "page", "pageChanged", "limitChanged", "searchChanged",
]);


/**
 * @param {object} args
 * @param {string} args.scss — generated component SCSS
 * @param {string} args.html — generated component HTML
 * @param {string} args.ts   — generated component TS
 * @param {object} [args.conventions] — extractConventions() output (or conventions.json)
 * @param {object} [args.transcript] — the transcript JSON object
 * @param {string} [args.rawXml] — the source FIGML XML (checkbox evidence)
 * @returns {{ checks: Array, pass: boolean, failCount: number, skipCount: number, warnCount: number }}
 */
export function verifyComponent({ scss = "", html = "", ts = "", conventions, transcript, rawXml } = {}) {
  const checks = [
    checkScssCompiles(scss),
    checkScssCoverage(scss, html, conventions?.ngDeepCorpus),
    checkTextCoverage(html, transcript),
    checkTableBindings(html, rawXml),
    checkClassVocabulary(scss + " " + html + " " + ts, conventions?.classVocabulary, conventions?.ngDeepCorpus),
    checkAnatomy(html, conventions?.componentAnatomy),
    checkMockRowCount(ts, conventions?.componentAnatomy, transcript),
    checkNoHashedSelectors(scss),
    checkNoBareNgDeep(scss, conventions?.ngDeepCorpus),
    checkIconColor(ts + " " + scss, transcript),
    checkPhantomWrapper(html, transcript),
    checkNgxSelectBinding(html),
    checkRowAuth(html, ts, rawXml),
    checkFilterRowButton(html, rawXml),
    checkButtonOrder(html, scss, rawXml),
    checkTableOptions(html, rawXml),
    checkGridColumns(html),
    checkNoTranslation(html, ts),
    checkInventedUtility(html, conventions?.classVocabulary),
    checkStyleFidelity(scss + " " + html, transcript),
    checkLoadedClass(html, conventions?.loadedClassRegistry),
  ];
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
  return { checks, pass: failCount === 0 && hasGroundTruth, failCount, skipCount, warnCount, hasGroundTruth };
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
 *  conventions.mjs's isReusable (token match + NOT under a component-specific wrapper). */
function relevantCorpus(ngDeepCorpus, html) {
  const triggers = {
    select: /<ngx-select\b|dropdown-menu/i,
    table: /<(uii-table|ngx-datatable|mat-table)(?!-skeleton)\b|ugw-pagination|gateway-table/i,
    layout: /ugw-header|ugw-sidebar|ugw-breadcrumb/i,
  };
  const inPlay = Object.keys(triggers).filter((fam) => triggers[fam].test(html));
  return ngDeepCorpus.filter((c) => {
    if (!c.family || !inPlay.includes(c.family)) return false;
    const rx = LIBRARY_INTERNAL[c.family];
    if (!rx || !rx.test(c.selector)) return false;
    const guard = LIBRARY_INTERNAL_WRAPPER_GUARD[c.family];
    return guard ? !guard.test(c.selector) : true;
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
    const t = (n.text ?? "").trim();
    if (!t || GLYPH.test(t)) return;
    if (n.type === "button") buttons.add(t);
    else if (/^pilih\b/i.test(t)) placeholders.add(t);
  });
  // Title: first text leaf (largest/first in document order) — a faithful label for the page.
  let firstText = null;
  walkNodes(transcript?.layout, (n) => {
    const t = (n.text ?? "").trim();
    if (firstText === null && t && !GLYPH.test(t) && n.type === "text") firstText = t;
  });
  if (firstText) title.push(firstText);
  for (const t of [...buttons, ...placeholders, ...title]) if (t) out.push(t);
  return [...new Set(out)];
}

// ---------- 3. tableBindings ----------

function checkTableBindings(html, rawXml) {
  // Exclude the skeleton: `<uii-table-skeleton>` must not match the table component.
  const tableTag = /<(uii-table|ngx-datatable|mat-table)(?!-skeleton)\b[\s\S]*?>/i.exec(html);
  if (!tableTag) {
    return { name: "tableBindings", status: "skip", detail: "no table component in output" };
  }
  const el = tableTag[0];
  const inputs = [...el.matchAll(/\[(\w+)\]/g)].map((m) => m[1]);
  const outputs = [...el.matchAll(/\((\w+)\)\s*=/g)].map((m) => m[1]);

  const problems = [];

  for (const b of inputs) {
    if (FORBIDDEN_TABLE_BINDINGS.has(b)) problems.push(`forbidden input [${b}] (server-mode/sliceui is mock-only)`);
    else if (!LEGAL_TABLE_BINDINGS.has(b)) problems.push(`unknown input [${b}]`);
  }
  for (const o of outputs) {
    if (!LEGAL_TABLE_OUTPUTS.has(o)) problems.push(`unknown output (${o})`);
  }

  // Checkbox column: the XML is the single source of truth. Evidence is the raw XML's
  // <Checkbox_FNC> (the transcript mirrors it as `checkbox` nodes, but the raw source is
  // authoritative) — never a guess from the component or a default.
  if (inputs.includes("checkboxColumn")) {
    if (!rawXml || !/<Checkbox_FNC\b/i.test(rawXml)) {
      problems.push("[checkboxColumn] has no <Checkbox_FNC> evidence in the source XML");
    }
  } else if (rawXml && /<Checkbox_FNC\b/i.test(rawXml)) {
    problems.push("source XML has <Checkbox_FNC> but output is missing [checkboxColumn]");
  }

  if (problems.length) {
    return { name: "tableBindings", status: "fail", detail: problems.join("; "), problems };
  }
  return { name: "tableBindings", status: "pass", detail: "bindings legal + checkbox evidenced" };
}

// ---------- 4. classVocabulary ----------

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

// ---------- 4d. phantom wrapper (structure = XML, not convention) ----------

function checkPhantomWrapper(html, transcript) {
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
  if (/(?:id|class)=["'][^"']*\bwell\b/i.test(html) && !transcriptHasWell) {
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

function checkRowAuth(html, ts, rawXml) {
  if (!/\[actionColumn\]/.test(html)) {
    return { name: "rowAuth", status: "skip", detail: "no [actionColumn] (action column not emitted)" };
  }
  if (!rawXml || !/<Aksi\b/i.test(rawXml)) {
    return { name: "rowAuth", status: "skip", detail: "no <Aksi> action-node evidence in raw XML" };
  }
  const required = requiredAuthKeysFromXml(rawXml);
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

function requiredAuthKeysFromXml(rawXml) {
  const keys = new Set();
  for (const block of rawXml.matchAll(/<Aksi\b[\s\S]*?<\/Aksi>/gi)) {
    const props = block[0].match(/<componentProperties\b[\s\S]*?<\/componentProperties>/i);
    if (!props) continue;
    for (const prop of props[0].matchAll(/<([A-Za-z_][\w]*)\b([^>]*)\/>/g)) {
      const name = prop[1];
      const attrs = prop[2];
      if (/type="BOOLEAN"/.test(attrs) && /value="true"/.test(attrs)) {
        const key = normalizeFigmaAction(name);
        if (key) keys.add(key);
      }
    }
  }
  return [...keys];
}

function normalizeFigmaAction(rawName) {
  const base = String(rawName).toLowerCase().replace(/_\d+(_\d+)?$/, "").replace(/^_+|_+$/g, "");
  return TABLE_ACTION_AUTH[base] ?? null;
}

/** Scan the WHOLE ts string (not just `[…]` bodies — auth is often attached inside a `.map()`
 *  callback) for truthy auth flag assignments. Accepts:
 *    auth.canUpdate = true | 1          (also this.auth.canUpdate)
 *    auth["canUpdate"] = true | 1
 *    auth: { canUpdate: true }          (and AuthorizationModel({ canUpdate: true }) literals)
 */
function detectAuthFlags(ts) {
  const flags = new Set();
  for (const m of ts.matchAll(/\bauth\s*\.\s*([A-Za-z_$][\w$]*)\s*=\s*(?:true|1)\b/g)) flags.add(m[1]);
  for (const m of ts.matchAll(/\bauth\s*\[\s*["']([A-Za-z]+)["']\s*\]\s*=\s*(?:true|1)\b/g)) flags.add(m[1]);
  for (const m of ts.matchAll(/\b(?:auth|AuthorizationModel)\s*(?::|=)\s*(?:new\s+AuthorizationModel\s*\(\s*)?\{([^}]*)\}/g)) {
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
  if (/<search_bar\b/i.test(rawXml)) required.push("searchOptions");
  if (/Tampilkan\s+\d+\s+data/i.test(rawXml)) required.push("limitOptions");
  if (/Menampilkan\s+\d+\s*-\s*\d+\s+(?:dari|of)\s+\d+\s+data/i.test(rawXml)) required.push("paginationOptions");

  const missing = required.filter((b) => !inputs.has(b));
  if (missing.length) {
    return {
      name: "tableOptions",
      status: "fail",
      detail: `uii-table missing binding(s) evidenced by the XML: ${missing.join(", ")}`,
      missing,
    };
  }
  if (!required.length) {
    return { name: "tableOptions", status: "skip", detail: "no search/limit/pagination evidence in XML" };
  }
  return { name: "tableOptions", status: "pass", detail: `table options bound (${required.join(", ")})` };
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
};

/** pilar action-config truth table: normalized Figma action boolean name → the authKey whose
 *  truthy flag makes pilar's uii-table render the action icon. The consumer is authoritative
 *  (pilar `table-action.component.ts` actionConfigs) over @uiigateway/core's AuthorizationModel:
 *  pilar consumes canExport/canImport (not canExpImp) and canPosting/canUnposting/canReject/
 *  canAudit, which the model does not declare. */
const TABLE_ACTION_AUTH = {
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
  const neutral = new Set(["#303030", "#333333", "#000000", "#ffffff", "#f5f5f5"]);
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
function parseCssColor(v) {
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
  if (hasTable && anatomy.skeletonTag && !new RegExp(`<${anatomy.skeletonTag}\\b`, "i").test(html)) {
    return {
      name: "anatomy",
      status: "fail",
      detail: `table present but <${anatomy.skeletonTag}> loading state missing`,
    };
  }
  return { name: "anatomy", status: "pass", detail: "table + skeleton structure present" };
}

// ---------- 6. mockRowCount ----------

function checkMockRowCount(ts, anatomy = {}, transcript) {
  const rows = countMockRows(ts);
  if (rows === null) {
    return { name: "mockRowCount", status: "skip", detail: "could not determine mock row count" };
  }
  const floor = anatomy?.mockRowsFloor ?? 15;
  const target = paginationTotal(transcript);
  const required = Math.max(floor, target);
  if (rows < required) {
    return {
      name: "mockRowCount",
      status: "fail",
      detail: `${rows} mock rows < required ${required} (floor ${floor}${target > floor ? `, transcript total ${target}` : ""})`,
      rows,
      required,
    };
  }
  return { name: "mockRowCount", status: "pass", detail: `${rows} mock rows ≥ ${required}` };
}

/** Count top-level elements in the mock array. Supports the patterns SliceUI actually emits:
 *  `const base = [...]`, `rows = [...]`, `private mockTagihanData: Array<any> = [...]` (and
 *  other `name = [...]` assignments). Prefers the LARGEST array — the mock data source. */
function countMockRows(ts) {
  let best = null;
  const re = /(?:(?:private|protected|public|readonly|const|let|var)\s+)?\w+\s*(?::\s*[A-Za-z<>\[\]]+)?\s*=\s*\[([\s\S]*?)\]\s*;/g;
  let m;
  while ((m = re.exec(ts)) !== null) {
    const n = countArrayElements(m[1]);
    if (n > 0 && (best === null || n > best)) best = n;
  }
  return best;
}

/** Count top-level comma-separated elements (brace/quote aware) inside an array body. */
function countArrayElements(body) {
  let depth = 0;
  let count = 1;
  let quote = null;
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (quote) { if (c === quote) quote = null; continue; }
    if (c === '"' || c === "'") { quote = c; continue; }
    if (c === "{" || c === "[" || c === "(") depth++;
    else if (c === "}" || c === "]" || c === ")") depth--;
    else if (c === "," && depth === 0) count++;
  }
  return count;
}

/** "Menampilkan 1-10 dari 20 data" → 20 (the total the transcript evidences). */
function paginationTotal(transcript) {
  let total = 0;
  walkNodes(transcript?.layout, (n) => {
    const m = /(?:Menampilkan|Showing)\s+\d+\s*-\s*\d+\s+(?:dari|of)\s+(\d+)\s+data/i.exec(n.text ?? "");
    if (m) total = Math.max(total, Number(m[1]));
  });
  return total;
}

// ---------- 18. styleFidelity (design colors of the page's key elements survive) ----------

/** Style-fidelity check. The transcript carries the DESIGN's own color choices for the page's
 *  key elements (title text, divider). The classic verify-green-but-localhost-wrong miss was
 *  `.h1 { color: #555 }` when the design said `#000000` — no check compared generated SCSS values
 *  against the transcript. This check maps two deterministic, low-ambiguity facts:
 *    (a) title color — locate the rendered heading whose text is the transcript title, find its
 *        class rule in generated SCSS, and compare that rule's color to the design's title color.
 *    (b) divider color — a design divider with a non-default bg must have that color (or the
 *        transcript's own value) reachable in the generated scss+html.
 *  Token substitution ($x / var(--y)) is skipped, never false-flagged — without a resolved token
 *  value we cannot judge it. */
function checkStyleFidelity(generated, transcript) {
  if (!transcript) return { name: "styleFidelity", status: "skip", detail: "no transcript to check style facts against" };
  const scssHtml = String(generated ?? "");
  if (!scssHtml.trim()) return { name: "styleFidelity", status: "skip", detail: "no generated scss/html to check" };

  const title = titleNode(transcript);
  const problems = [];

  // (a) title color: rendered heading text → its class rule's color vs design.
  if (title?.style?.color) {
    const designColor = normHex(title.style.color);
    const rendered = renderedTitleColor(scssHtml, title.text);
    if (rendered) {
      if (rendered.designToken) {
        // SCSS variable / css-var — cannot resolve; do not judge.
      } else if (rendered.color !== designColor) {
        problems.push(`title "${trunc(title.text)}" styled ${rendered.color}, design says ${designColor}`);
      }
    }
    // No rendered color for the title rule → inherited project style; can't compare. Not a fail.
  }

  // (b) divider color: a non-default divider bg in the design must be reachable in output.
  const dividerColor = dividerColorOf(transcript);
  if (dividerColor) {
    if (!normHex(scssHtml).includes(normHex(dividerColor))) {
      problems.push(`divider color ${dividerColor} (design) missing from generated css/html`);
    }
  }

  if (!problems.length) {
    const n = (title?.style?.color ? 1 : 0) + (dividerColor ? 1 : 0);
    return n ? { name: "styleFidelity", status: "pass", detail: "title/divider design colors preserved" }
              : { name: "styleFidelity", status: "skip", detail: "no title-color or divider-color design facts" };
  }
  return { name: "styleFidelity", status: "fail", detail: problems.join("; "), problems };
}

/** First text node that reads like a page title — the largest (by w) text leaf in the top
 *  region, or simply the first styled text node with a color. */
function titleNode(transcript) {
  let firstStyled = null;
  let largest = null;
  walkNodes(transcript?.layout, (n) => {
    if (!n || typeof n !== "object" || n.type !== "text") return;
    const t = (n.text ?? "").trim();
    if (!t) return;
    if (n.style?.color && !firstStyled) firstStyled = n;
    if (!largest || (n.w ?? 0) > (largest.w ?? 0)) largest = n;
  });
  return firstStyled && largest && firstStyled.id === largest.id ? firstStyled : (firstStyled ?? largest);
}

/** Find the generated rule that colors the rendered heading with the title text; return its
 *  resolved color (or { designToken: true } when the color is a variable). */
function renderedTitleColor(scssHtml, titleText) {
  // Which element renders the title? Prefer <h1 class="…">…title…</h1>; fall back to any
  // element whose inner text contains the title.
  const t = (titleText ?? "").trim();
  const esc = t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const hRe = new RegExp(`<h([1-6])\\b([^>]*)>[\\s\\S]{0,80}?${esc}[\\s\\S]{0,80}?</h\\1>`, "i");
  const anyRe = new RegExp(`<([a-z][\\w-]*)\\b([^>]*)>[\\s\\S]{0,80}?${esc}[\\s\\S]{0,80}?</\\1>`, "i");
  const m = hRe.exec(scssHtml) || anyRe.exec(scssHtml);
  if (!m) return null;
  const cls = /class=["']([^"']+)["']/.exec(m[2])?.[1];
  if (!cls) return null;
  const firstCls = cls.split(/\s+/)[0];
  // Find the SCSS rule for this class and pull its color declaration.
  const ruleRe = new RegExp(`\\.${cssEscape(firstCls)}\\b[^{]*\\{[^}]*color\\s*:\\s*([^;!}]+)`, "i");
  const rule = ruleRe.exec(scssHtml);
  if (!rule) return null;
  const val = rule[1].trim();
  if (/^\$|var\(|--[a-z]/i.test(val)) return { designToken: true };
  const hex = /#[0-9a-f]{3,6}/i.exec(val)?.[0];
  return hex ? { color: normHex(hex) } : null;
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

function normHex(s) {
  return String(s ?? "").replace(/#([0-9a-fA-F])([0-9a-fA-F])([0-9a-fA-F])(?![0-9a-fA-F])/g, "#$1$1$2$2$3$3").toLowerCase();
}
function trunc(s) { const t = String(s ?? "").replace(/\s+/g, " ").trim(); return t.length > 24 ? t.slice(0, 24) + "…" : t; }

// ---------- shared walker ----------

function walkNodes(nodes, fn) {
  for (const n of nodes ?? []) {
    if (!n || typeof n !== "object") continue;
    fn(n);
    if (n.children) walkNodes(n.children, fn);
  }
}
