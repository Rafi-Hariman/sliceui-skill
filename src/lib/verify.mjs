// verify — deterministic "is this generated component faithful to (a) the design transcript
// and (b) the project's conventions" checks. Emits structured verdicts, not prose: each
// check returns { name, status: pass|fail|skip, detail }. The gate must be able to say
// "I cannot verify this" — a check that lacks its ground truth reports `skip`, never pass.
//
// Thirteen checks, each closing a known defect class from the history-agreement audit:
//   1. scssCoverage  — every ::ng-deep selector in the conventions corpus survived verbatim
//   2. textCoverage  — fidelity-critical text (buttons/placeholders/title) not dropped
//   3. tableBindings — legal binding set, checkbox evidenced by RAW XML (not transcript)
//   4. classVocabulary — reuse the project's classes; invented status labels are red
//   5. anatomy       — table present ⇒ skeleton loading state present
//   6. mockRowCount  — rows ≥ max(conventions floor, transcript pagination total)
//   7. ngxSelectBinding — every <ngx-select> carries [(ngModel)] + (select) (dead-filter defect)
//   8. rowAuth       — action-column rows carry the auth flags pilar needs to render icons
//   9. filterRowButton — filter-row buttons in the XML (e.g. "Cari") are not dropped
//  10. buttonOrder   — paired action buttons match the XML's left→right order (no row-reverse)
//  11. tableOptions  — search/limit/pagination bindings map XML evidence (search bar, "Tampilkan N data", pagination footer)
//  12. gridColumns   — a filter row's col-*-N spans must sum to ≤ 12 (no wrapped children)
//  13. noTranslation — no `| translate` pipe (SliceUI emits literal text, never i18n)

import { scssCoverage } from "./fidelity.mjs";
import { LIBRARY_INTERNAL } from "./conventions.mjs";

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
    checkScssCoverage(scss, html, conventions?.ngDeepCorpus),
    checkTextCoverage(html + " " + ts, transcript),
    checkTableBindings(html, rawXml),
    checkClassVocabulary(scss + " " + html + " " + ts, conventions?.classVocabulary, conventions?.ngDeepCorpus),
    checkAnatomy(html, conventions?.componentAnatomy),
    checkMockRowCount(ts, conventions?.componentAnatomy, transcript),
    checkNoHashedSelectors(scss),
    checkIconColor(ts + " " + scss, transcript),
    checkPhantomWrapper(html, transcript),
    checkNgxSelectBinding(html),
    checkRowAuth(html, ts, rawXml),
    checkFilterRowButton(html, rawXml),
    checkButtonOrder(html, scss, rawXml),
    checkTableOptions(html, rawXml),
    checkGridColumns(html),
    checkNoTranslation(html, ts),
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
  // The "Cari" search button lives in the filter group, adjacent to the fields (its XML is a
  // <Button_FNC> whose child text is "Cari"). Count the XML's filter-area buttons.
  const filterButtons = [...rawXml.matchAll(/<Button_FNC\b[\s\S]*?<\/Button_FNC>/gi)]
    .filter((m) => /characters="Cari"/i.test(m[0]));
  if (!filterButtons.length) {
    return { name: "filterRowButton", status: "skip", detail: "no filter-area button (Cari) in XML" };
  }
  // The generated HTML must render a button whose text is "Cari".
  const hasCariButton = /<button\b[^>]*>[\s\S]*?Cari/i.test(html);
  if (!hasCariButton) {
    return { name: "filterRowButton", status: "fail", detail: "XML has a Cari filter button but output dropped it" };
  }
  return { name: "filterRowButton", status: "pass", detail: "filter-row Cari button present" };
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
  const problems = [];
  // Split into top-level <div class="row"> blocks (no nesting in these slices).
  const rowRe = /<div[^>]*class="[^"]*\brow\b[^"]*"[\s\S]*?(?=<div[^>]*class="[^"]*\brow\b|$)/gi;
  const rows = html.match(rowRe) || [html];
  let rowIdx = 0;
  for (const row of rows) {
    rowIdx++;
    let span = 0;
    let count = 0;
    for (const m of row.matchAll(/col-(?:xs|sm|md|lg|xl|xxl)-(\d+)/gi)) {
      span += Number(m[1]);
      count++;
    }
    if (span > 12) {
      problems.push(`filter row #${rowIdx} spans ${span}/12 columns across ${count} items (a child wraps to the next line)`);
    }
  }
  if (problems.length) {
    return { name: "gridColumns", status: "fail", detail: problems.join("; "), problems };
  }
  return { name: "gridColumns", status: "pass", detail: "no filter row exceeds 12 columns" };
}

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
  // Collect (fa-*, assigned color) from generated SCSS: `::ng-deep .fa-X { color: #yyy }`.
  const styledIcons = [...generated.matchAll(/fa-([a-z0-9-]+)[^{}]*\{[^}]*color:\s*(#[0-9a-fA-F]{6})/g)]
    .map((m) => ({ icon: "fa-" + m[1], color: m[2].toLowerCase() }));
  if (!styledIcons.length) {
    return { name: "iconColor", status: "skip", detail: "no fa-* icon with a color in generated code" };
  }
  // Any icon styled with a color that is NOT a design semantic color = wrong mapping
  // (the agent gave the badge a color the design doesn't have — e.g. #f9933f for a #f44444
  // badge). Structural neutrals (#303030/#fff/#333/#000) are allowed.
  const neutral = new Set(["#303030", "#333333", "#333", "#000000", "#000", "#ffffff", "#fff", "#f5f5f5"]);
  const problems = [];
  for (const { icon, color } of styledIcons) {
    if (semantic.includes(color)) continue; // matches a design color → OK
    if (neutral.has(color)) continue;
    problems.push(`${icon} styled with ${color}, but design status icons are ${semantic.join(", ")}`);
  }
  if (problems.length) {
    return { name: "iconColor", status: "fail", detail: problems.join("; ") };
  }
  return { name: "iconColor", status: "pass", detail: `icons match design colors (${semantic.join(", ")})` };
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

// ---------- shared walker ----------

function walkNodes(nodes, fn) {
  for (const n of nodes ?? []) {
    if (!n || typeof n !== "object") continue;
    fn(n);
    if (n.children) walkNodes(n.children, fn);
  }
}
