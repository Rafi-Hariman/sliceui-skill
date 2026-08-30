// verify — deterministic "is this generated component faithful to (a) the design transcript
// and (b) the project's conventions" checks. Emits structured verdicts, not prose: each
// check returns { name, status: pass|fail|skip, detail }. The gate must be able to say
// "I cannot verify this" — a check that lacks its ground truth reports `skip`, never pass.
//
// Six checks, each closing a known defect class from the history-agreement audit:
//   1. scssCoverage  — every ::ng-deep selector in the conventions corpus survived verbatim
//   2. textCoverage  — fidelity-critical text (buttons/placeholders/title) not dropped
//   3. tableBindings — legal binding set, checkbox evidenced by RAW XML (not transcript)
//   4. classVocabulary — reuse the project's classes; invented status labels are red
//   5. anatomy       — table present ⇒ skeleton loading state present
//   6. mockRowCount  — rows ≥ max(conventions floor, transcript pagination total)

import { scssCoverage } from "./fidelity.mjs";

/** Legal uii-table inputs/outputs. Anything else is red unless evidenced. */
const LEGAL_TABLE_BINDINGS = new Set([
  "rows", "columns", "actionTitle", "actionColumn", "checkboxColumn",
  "paginationOptions", "searchOptions", "selectedLimit",
]);
const LEGAL_TABLE_OUTPUTS = new Set([
  "editClicked", "deleteClicked", "detailClicked",
]);
const FORBIDDEN_TABLE_BINDINGS = new Set([
  "serverMode", "page", "pageChanged", "limitChanged", "searchChanged",
]);

/** Library-internal reusable ::ng-deep selectors per capability family. These are the
 *  universal "how to style this library" idioms that must survive verbatim into any slice
 *  using the library. Component-specific variants (editable-cell tables, empty states,
 *  header cells, label taxonomy members) are deliberately EXCLUDED — they belong to one
 *  slice, not the reusable corpus. */
const LIBRARY_INTERNAL = {
  // The canonical open-state + toggle selectors only — these are the "lost design effect"
  // set (the unfamiliar library-internal selectors the agent drops). Granular variants
  // (toggle-button, value-container, custom-select wrappers) are deliberately excluded.
  select: /ngx-select__toggle-caret|ngx-select__choices|ngx-select__item_active|dropdown-menu/i,
  table: /ugw-pagination|page-box|nav-icon|search-|filter-options|limit-options|table-footer/i,
  layout: /ugw-header|ugw-sidebar|ugw-breadcrumb/i,
};

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
    checkScssCoverage(scss, html, conventions?.ngDeepCorpus),
    checkTextCoverage(html + " " + ts, transcript),
    checkTableBindings(html, rawXml),
    checkClassVocabulary(scss + " " + html + " " + ts, conventions?.classVocabulary, conventions?.ngDeepCorpus),
    checkAnatomy(html, conventions?.componentAnatomy),
    checkMockRowCount(ts, conventions?.componentAnatomy, transcript),
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

// ---------- 1. scssCoverage ----------

function checkScssCoverage(scss, html, ngDeepCorpus = []) {
  // Smoke test: did the LIBRARY-INTERNAL styling idioms survive verbatim into the output?
  // Scoped to (a) the capability families this component renders and (b) library-internal
  // selectors only. Matching is by LEAF TOKEN, not full selector chain — a nested block
  // (`.ugw-pagination-container { li.page-box {…} .nav-icon {…} }`) is copied verbatim as
  // nested, so exact-chain `includes()` would false-flag it. Token presence asks the one
  // question that matters: is this idiom present at all, or was it dropped?
  const relevant = relevantCorpus(ngDeepCorpus, html);
  if (!relevant.length) {
    return { name: "scssCoverage", status: "skip", detail: "no reusable ::ng-deep blocks for the capabilities in play" };
  }
  const missing = [];
  for (const c of relevant) {
    if (!anyTokenPresent(c.selector, scss)) missing.push(c.selector);
  }
  if (missing.length) {
    return {
      name: "scssCoverage",
      status: "fail",
      detail: `${missing.length}/${relevant.length} reusable ::ng-deep idioms missing`,
      missing,
    };
  }
  return { name: "scssCoverage", status: "pass", detail: `${relevant.length} reusable ::ng-deep idioms present` };
}

/** Does ANY distinctive class token of the selector appear in the generated SCSS? A wrapper
 *  entry like `custom-select .ngx-select__toggle-caret` survives if its library-internal
 *  token (`ngx-select__toggle-caret`) is present, even if the wrapper class isn't copied. */
function anyTokenPresent(selector, scss) {
  const PSEUDO = new Set(["hover", "focus", "active", "first-child", "last-child", "nth-child", "before", "after", "checked", "disabled"]);
  const tokens = selector.split(/[^a-zA-Z0-9_-]+/).filter(Boolean);
  return tokens.some((t) => !PSEUDO.has(t) && /[-_]/.test(t) && t.length > 1 && scss.includes(t));
}

/** Which corpus blocks must THIS component copy? Family triggered by the component's own
 *  tags/classes, then filtered to library-internal (reusable) selectors only. */
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
    return rx ? rx.test(c.selector) : false;
  });
}

// ---------- 2. textCoverage (fidelity-critical text) ----------

/** Glyph/private-use codepoints that are icon font data, never literal UI copy. */
const GLYPH = /[-]/;

function checkTextCoverage(generated, transcript) {
  const critical = fidelityCriticalText(transcript);
  if (!critical.length) {
    return { name: "textCoverage", status: "skip", detail: "no transcript text to check" };
  }
  // Whitespace-normalize both sides: the transcript may carry an OCR/parse artifact
  // ("Pilih  status" double space) that the agent correctly renders as one space.
  const norm = (s) => s.replace(/\s+/g, " ").trim();
  const gen = norm(generated);
  const missing = [];
  for (const t of critical) {
    if (!gen.includes(norm(t))) missing.push(t);
  }
  if (missing.length) {
    return {
      name: "textCoverage",
      status: "fail",
      detail: `${missing.length} fidelity-critical text(s) dropped`,
      missing,
    };
  }
  return { name: "textCoverage", status: "pass", detail: `${critical.length} critical texts present` };
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

/** Count top-level elements in the mock array (`const base = [...]` / `rows = [...]`). */
function countMockRows(ts) {
  const m = /(?:const\s+\w+\s*=\s*|\brows\s*=\s*)\[([\s\S]*?)\]\s*;/.exec(ts);
  if (!m) return null;
  return countArrayElements(m[1]);
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

// ---------- shared walker ----------

function walkNodes(nodes, fn) {
  for (const n of nodes ?? []) {
    if (!n || typeof n !== "object") continue;
    fn(n);
    if (n.children) walkNodes(n.children, fn);
  }
}
