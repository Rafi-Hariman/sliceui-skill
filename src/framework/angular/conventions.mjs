// conventions — mine the project for "HOW this team writes" and emit deterministic facts.
// This closes the codebase-idiom gap that a WHAT-only project-context leaves open: which
// classes are reused, which ::ng-deep blocks must survive, what the page anatomy is, and
// how things are named. Fills the three sliceui artifacts (project-context.json = WHAT,
// conventions.json = facts, conventions.md = narrative).
//
// Zero new dependencies: fast-glob + readFileSync + regex, mirroring library-scan.mjs.
// SCSS + HTML only — .ts is touched solely to associate a template with its stylesheet
// (via ts-ast.mjs), never deeply analyzed, because SliceUI emits mock data.

import fg from "fast-glob";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const SKIP = ["**/node_modules/**", "**/dist/**", "**/.angular/**", "**/build/**", "**/.sliceui/**"];

// Bootstrap-style grid/layout classes that carry no project-specific meaning. Exported so
// verify.mjs reuses it as FRAMEWORK_BASE — the set of framework classes that are ALWAYS legal
// (and thus never need to appear in classVocabulary to be allowed).
export const TRIVIAL_CLASS = /^(row|container(-fluid)?|col(-(xs|sm|md|lg|xl|xxl))?(-\d+)?|text-(left|right|center|justify)|pull-(left|right)|hidden(-(xs|sm|md|lg|xl))?|visible-[a-z-]+|clearfix)$/;

/** A Golden reference's own classes become legal vocabulary. The user hand-curated that
 *  component as the canonical writing pattern; its utility classes (mt-4, col-12, p-0) are
 *  therefore NOT "invented" when a generated slice mirrors them. Read each reference's .html
 *  (and its SCSS custom classes) and merge their class tokens into the vocabulary, tagged so
 *  the merge is traceable. */
export function mergeGoldenClasses(classVocabulary, goldenHtml) {
  const out = [...classVocabulary];
  const existing = new Set(classVocabulary.map((c) => c.name));
  const add = (name) => {
    if (!name || TRIVIAL_CLASS.test(name) || /[[\]{}()]/.test(name)) return;
    if (existing.has(name)) return;
    existing.add(name);
    out.push({ name, count: 0, family: null, hint: null, source: "golden" });
  };
  for (const src of goldenHtml) {
    for (const m of src.matchAll(/class=["']([^"']+)["']/g)) {
      for (const raw of m[1].split(/\s+/)) add(raw.trim());
    }
  }
  return out;
}

/** Merge the project's golden references (`.sliceui/config.json` `references`) into a
 *  conventions object: each golden component's classes become legal vocabulary so verify never
 *  flags a mirrored golden idiom as invented. Shared by `init` and standalone `detect` so both
 *  write a conventions.json with the same golden-merged vocabulary (PR 2). */
export function mergeGoldenReferences(root, conventions) {
  let refs = [];
  try {
    const cfg = JSON.parse(readFileSync(join(root, ".sliceui", "config.json"), "utf8"));
    refs = Array.isArray(cfg?.references) ? cfg.references : [];
  } catch { /* no/unreadable config.json → no golden refs */ }
  if (!refs.length) return conventions;
  const { html } = goldenCompanionFiles(root, refs);
  if (!html.length) return conventions;
  return { ...conventions, classVocabulary: mergeGoldenClasses(conventions.classVocabulary ?? [], html) };
}

/** Merge an explicit project policy (`.sliceui/config.json` `mockRowsFloor`) into conventions.
 *  A fixed mock-row count is NOT a SliceUI universal — it is opt-in project policy. When the
 *  config carries a positive `mockRowsFloor`, it overrides the mined `null`; otherwise the
 *  convention keeps `null` (no fixed floor) and the mock-row check degrades to a sanity warn.
 *  Shared by `init` and standalone `detect` so both write the same policy-merged snapshot. */
export function mergeProjectPolicy(root, conventions) {
  let cfg = {};
  try {
    cfg = JSON.parse(readFileSync(join(root, ".sliceui", "config.json"), "utf8"));
  } catch { /* no/unreadable config.json → no policy */ }
  const floor = cfg?.mockRowsFloor;
  if (!Number.isFinite(floor) || floor <= 0) return conventions;
  return {
    ...conventions,
    componentAnatomy: { ...(conventions.componentAnatomy ?? {}), mockRowsFloor: floor },
  };
}

/** Resolve a `.sliceui/config.json` `references` entry to its companion HTML/SCSS file contents,
 *  so the golden vocabulary merge has real markup to mine. A reference points at a `.component.ts`
 *  (or its directory); the `.html`/`.scss` live alongside it (templateUrl/styleUrls resolve too,
 *  but the co-located `<name>.component.{html,scss}` is the reliable default). */
export function goldenCompanionFiles(root, refs, read = readFileSync, stat = existsSync) {
  const htmlOut = [];
  const filesOut = [];
  for (const ref of refs) {
    const abs = resolveRefToComponent(root, ref);
    if (!abs) continue;
    const base = abs.replace(/\.component\.ts$/, "");
    for (const ext of ["html", "scss"]) {
      const p = `${base}.component.${ext}`;
      if (stat(p)) {
        filesOut.push(p);
        if (ext === "html") htmlOut.push(read(p, "utf8"));
      }
    }
  }
  return { html: htmlOut, files: filesOut };
}

function resolveRefToComponent(root, ref) {
  const p = ref.startsWith("/") || /^[A-Za-z]:/.test(ref) ? ref : join(root, ref);
  if (/\.component\.ts$/.test(p) && existsSync(p)) return p;
  if (existsSync(p)) {
    const entries = readdirSync(p, { withFileTypes: true });
    const name = p.split(/[\\/]/).pop();
    const named = entries.find((e) => e.isFile() && e.name === `${name}.component.ts`);
    if (named) return join(p, named.name);
    const any = entries.find((e) => e.isFile() && e.name.endsWith(".component.ts"));
    if (any) return join(p, any.name);
  }
  return null;
}

/**
 * Extract the project's code conventions.
 * @param {string} root — project root
 * @param {object} ctx — detectProject's result (for prefix, componentDir, framework)
 * @returns {{ classVocabulary: Array, ngDeepCorpus: Array, componentAnatomy: object, naming: object }}
 */
export function extractConventions(root, ctx = {}) {
  const htmlFiles = fg.sync(["**/*.html"], { cwd: root, ignore: SKIP, absolute: true });
  const scssFiles = fg.sync(["**/*.scss", "**/*.css"], { cwd: root, ignore: SKIP, absolute: true });

  const allHtml = htmlFiles.map((p) => ({ path: p, src: readFileSyncSafe(p) }));
  const allScss = scssFiles.map((p) => ({ path: p, src: readFileSyncSafe(p) }));

  // 2026-09-10 C5: a file generated by SliceUI itself is NOT project convention. Re-running
  // `init` after a slice must not absorb the slice's own ::ng-deep/classes into the "authoritative"
  // corpus (the corpus would then teach the agent to copy its own output). Strip them up front.
  const projectHtml = allHtml.filter((f) => !isSliceUiGenerated(f.src));
  const projectScss = allScss.filter((f) => !isSliceUiGenerated(f.src));

  const classVocabulary = extractClassVocabulary(projectHtml, projectScss);
  const ngDeepCorpus = extractNgDeepCorpus(projectScss);
  const componentAnatomy = extractAnatomy(projectHtml, projectScss);
  const naming = extractNaming(projectHtml, ctx);

  return { classVocabulary, ngDeepCorpus, componentAnatomy, naming };
}

/** A file whose first line carries the SliceUI marker is our own prior output, not a convention. */
function isSliceUiGenerated(src) {
  return /^\s*(?:\/\/|<!--)\s*Generated by SliceUI/.test(String(src ?? ""));
}

// ---------- class vocabulary ----------

/** Count class="…" usage across templates; group reuse families (label-custom-*), skip
 *  grid/layout noise. Top classes + their families become the "reuse these, don't invent"
 *  list the agent reads in Pass 1 and the verify gate enforces.
 *  Each entry is also tagged with its DEFINITION status (2026-09-11 F10): `defined` (a real
 *  `.cls {` rule exists in the project SCSS), `context-dependent` (only ever defined nested
 *  under a specific wrapper like `.modal-footer .button-action-center`), or `undefined` (name
 *  appears in markup/corpus but has NO CSS anywhere — a name-trap). */
function extractClassVocabulary(allHtml, allScss = []) {
  const counts = new Map();
  for (const f of allHtml) {
    for (const m of f.src.matchAll(/class=["']([^"']+)["']/g)) {
      for (const raw of m[1].split(/\s+/)) {
        const cls = raw.trim();
        if (!cls || TRIVIAL_CLASS.test(cls)) continue;
        // Strip Angular binding noise: [ngClass], {{…}}, (…)
        if (/[[\]{}()]/.test(cls)) continue;
        counts.set(cls, (counts.get(cls) ?? 0) + 1);
      }
    }
  }

  // Family detection: "label-custom-success" + "label-custom-warning" share "label-custom".
  const entries = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const families = new Map();
  for (const [cls] of entries) {
    const fam = familyOf(cls);
    if (fam) families.set(fam, (families.get(fam) ?? 0) + 1);
  }

  // Workhorse classes (top-N by frequency) PLUS any member of a deliberate taxonomy
  // (family with ≥2 siblings) — low-frequency status labels (label-custom-success/-warning)
  // are exactly the reuse vocabulary that must not fall off a frequency cutoff.
  const top = entries.slice(0, 40).map(([name, count]) => ({ name, count }));
  const taxonomy = entries
    .filter(([cls]) => {
      const fam = familyOf(cls);
      return fam && (families.get(fam) ?? 0) >= 2;
    })
    .map(([name, count]) => ({ name, count }));

  const merged = new Map();
  for (const item of [...top, ...taxonomy]) merged.set(item.name, item);

  const scss = allScss.map((f) => f.src).join("\n");
  const vocab = [...merged.values()].map(({ name, count }) => ({
    name,
    count,
    family: familyOf(name),
    hint: hintFor(name),
    definition: definitionStatus(name, scss),
  }));
  return vocab;
}

/** Class definition status (F10): does `.cls` resolve to a real rule anywhere in the project?
 *  - "defined": a top-level `.cls {` (or `.cls,`/`.cls.` variant) exists.
 *  - "context-dependent": only a NESTED occurrence (`.parent .cls` or `& .cls`), so it works only
 *    inside that wrapper.
 *  - "undefined": no `.cls` selector at all — the name appears in markup/corpus but has no CSS. */
function definitionStatus(cls, scss) {
  // "defined" = a top-level rule: `.cls` at the START of a selector (file start, after a `}`
  // closing the previous rule, or after a `,` selector separator). A NESTED occurrence is
  // preceded by `{ ` (SCSS nesting) or another selector (descendant `.parent .cls`) — neither
  // makes it reusable outside that context.
  const top = new RegExp(`(?:^|}|,)\\s*\\.${escape(cls)}\\s*(?=[,{.:\\[])`, "i");
  if (top.test(scss)) return "defined";
  const nested = new RegExp(`\\.${escape(cls)}\\b`, "i");
  if (nested.test(scss)) return "context-dependent";
  return "undefined";
}
function escape(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

/** "label-custom-success" → "label-custom"; null when no trailing -segment to group.
 *  The trailing segment may start with a letter OR a digit: "mt-2"/"mb-3" are members of the
 *  spacing-utility family ("mt", "mb") just as "label-custom-warning" is of "label-custom".
 *  Without the digit case, numeric-suffix utilities can never form a family and fall off the
 *  top-N cutoff — they'd then be flagged "invented" by verify despite heavy team usage. */
function familyOf(cls) {
  const m = /^(.+)-[a-zA-Z0-9][\w-]*$/.exec(cls);
  return m ? m[1] : null;
}

/** Cheap semantic hint for the conventions.md narrative. */
function hintFor(cls) {
  if (/label/i.test(cls)) return "status/field label";
  if (/well|panel|card/i.test(cls)) return "container/panel";
  if (/btn|button/i.test(cls)) return "button";
  if (/active|selected|current/i.test(cls)) return "state";
  return null;
}

// ---------- ::ng-deep corpus ----------

/** Library-internal reusable ::ng-deep selectors per capability family. Single source of
 *  truth shared with verify.mjs (which imports it for the scssCoverage gate). These are the
 *  universal "how to style this library" idioms; a selector OUTSIDE this whitelist is
 *  component-specific (one slice's editable-cell / spreadsheet idiom) and must NOT be
 *  copied as if reusable. The table family includes the bare table shell (`gateway-table$`)
 *  and its internal cell/empty/data classes, but NOT generic descendants like `row-container`
 *  (which also tags component-specific editable-cell blocks). */
export const LIBRARY_INTERNAL = {
  select: /ngx-select__toggle-caret|ngx-select__choices|ngx-select__item_active|dropdown-menu|^ngx-select__toggle$/i,
  // `gateway-table-data` (a hover transition one slice added) and bare `header-cell`/`data-cell`
  // nth-child centering (master-bank centers ITS columns 4-5 by index) are excluded: they are
  // column-index-specific or effect-specific to one page, not universal table idioms. The
  // universal set is the shell (gateway-table$), footer/pagination, and search/limit internals.
  table: /ugw-pagination|page-box|nav-icon|search-|filter-options|limit-options|table-footer|gateway-table\s*$|cell-html|gateway-empty-data/i,
  layout: /ugw-header|ugw-sidebar|ugw-breadcrumb/i,
  // Bare form controls are the project's universal input rounding/border idiom — distinct from
  // component-specific pseudo variants (form-control:focus = spreadsheet border:none) and from
  // .ngx-select .form-control (the table-cell select), both of which stay non-reusable.
  form: /^form-control$|^input$/i,
};

/** The same families' WRAPPER guard: a reusable idiom must not sit under a component-specific
 *  wrapper class. `table-select .ngx-select__toggle-caret` (an editable-cell idiom) and
 *  `custom-select .ngx-select__toggle-caret` (hides the caret) contain a reusable TOKEN but
 *  belong to one slice's context — the wrapper changes what the block does. A token match
 *  anywhere in the chain (the old behavior) let those masquerade as reusable in the corpus. */
export const LIBRARY_INTERNAL_WRAPPER_GUARD = {
  select: /table-select|custom-select/,
  table: /table-select|custom-select|table-input-autonumeric/,
};

/** A corpus block is "reusable" (safe to copy into any slice) when its selector is a known
 *  library-internal idiom for its family AND not chained under a component-specific wrapper,
 *  OR it is a status-label/icon taxonomy member (which the project reuses across pages).
 *  Everything else is component-specific. */
function isReusable(selector, family) {
  if (family === "label" || family === "icon") return true;
  const rx = LIBRARY_INTERNAL[family];
  if (!rx || !rx.test(selector)) return false;
  const guard = LIBRARY_INTERNAL_WRAPPER_GUARD[family];
  return guard ? !guard.test(selector) : true;
}

/** Merge EVERY ::ng-deep / :host ::ng-deep block across all stylesheets into one corpus.
 *  This is the verbatim-copy source for Pass 3 — the fix for defect #1/#3 where a single
 *  sampleScss (or a null one) left the agent reconstructing and dropping selectors. */
function extractNgDeepCorpus(allScss) {
  // Group by NORMALIZED selector, then keep the MOST FREQUENT block variant. First-wins was
  // wrong: a single outlier file (e.g. a pagination block whose `border-style: hidden` was
  // ordered AFTER `border-bottom`, clobbering it) won the tie. Majority picks the canonical
  // variant that the team actually ships most often. Grouping keys on a WHITESPACE-COLLAPSED
  // canonical text (not exact text) so the vote isn't fragmented by indentation differences —
  // the winning block is still stored verbatim from its first occurrence.
  const variants = new Map(); // normalized selector -> Map(canonicalText -> { count, block, source, family })
  for (const f of allScss) {
    for (const block of extractNgDeepBlocks(f.src)) {
      const key = normalizeSelector(block.selector);
      if (!key) continue;
      let byBlock = variants.get(key);
      if (!byBlock) {
        byBlock = new Map();
        variants.set(key, byBlock);
      }
      const canon = semanticCanon(block.block);
      if (!byBlock.has(canon)) {
        byBlock.set(canon, { count: 0, block: block.block, source: toRelPath(f.path), family: familyForSelector(block.selector) });
      }
      byBlock.get(canon).count += 1;
    }
  }
  const corpus = [];
  for (const [key, byBlock] of variants) {
    let best = null;
    for (const [canon, meta] of byBlock) {
      if (!best || meta.count > best.count) best = meta;
    }
    corpus.push({
      selector: key,
      // Block is stored hash-free: a copy-target carrying [_ngcontent-*] is unusable output
      // (noHashedSelectors fails it) — normalize once here, not in every consumer (F5).
      block: stripHashedScopes(best.block),
      source: best.source,
      family: best.family,
      reusable: isReusable(key, best.family),
    });
  }
  return collapseIdenticalCorpus(corpus);
}

/** Canonical form of a selector for dedup/matching: strip Angular `[_ngcontent-*]` attribute
 *  scopes, drop leading `:host `/`::ng-deep `/`.`, collapse whitespace. */
function normalizeSelector(sel) {
  return stripHashedScopes(sel)
    .replace(/^(?::host\s+)?::ng-deep\s*/i, "")
    .replace(/^\./, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Remove Angular compiled-scope attributes `[_ngcontent-*]` / `[_nghost-*]` from a string.
 *  Applied to BOTH the corpus selector and the stored BLOCK: a hash in a copy-target block makes
 *  the agent copy a compiled selector verbatim, which `noHashedSelectors` then fails — two gates
 *  contradicting on the same entry (2026-09-11 F5). Normalize once at the source. */
function stripHashedScopes(s) {
  return String(s ?? "").replace(/\[_(?:ngcontent|nhost)-[^\]]*\]/g, "");
}

/** Canonical form of a block body for dedup voting: collapse whitespace and normalize
 *  hex colors to lowercase, so `border-color: #b1bccc` and `border-color: #B1BCCC` vote
 *  together. This stops a single semantic variant (e.g. `border-radius: 6px`) from fragmenting
 *  across case/whitespace differences and losing a majority vote to an outlier. */
function semanticCanon(block) {
  return block.replace(/\s+/g, " ").replace(/#[0-9a-fA-F]{3,8}\b/g, (hex) => hex.toLowerCase());
}

/** A state pseudo-class/element that a hover/focus style idiom adds to an otherwise-identical
 *  rule — stripped so `a:hover` and `a:focus` variants of the SAME combined block can be merged. */
const STATE_PSEUDO = /::?(?:hover|focus|active|visited|disabled|checked|first-child|last-child|nth-child(?:\([^)]*\))?|not\([^)]*\)|before|after)\b/g;

/** Strip state pseudo-classes so two entries that differ only by `:hover` vs `:focus` share a base. */
function stripStatePseudo(selector) {
  return String(selector).replace(STATE_PSEUDO, "").replace(/\s+/g, " ").trim();
}

/** Collapse corpus entries that are pseudo-class variants of the SAME base rule with an IDENTICAL
 *  body — e.g. a combined `:hover,\n:focus { … }` rule whose comma-group heads were split into two
 *  entries each carrying the full identical block. Keeping both made conventions.md list the block
 *  twice and scssCoverage count one authored rule as two required idioms. Additive merge only:
 *  entries whose base selector, family, OR body differ are left untouched. */
function collapseIdenticalCorpus(corpus) {
  const groups = new Map(); // `${family}§${base}§${canon}` → { block, source, family, selectors: Set }
  for (const c of corpus) {
    const base = stripStatePseudo(c.selector);
    const key = `${c.family ?? ""}§${base}§${semanticCanon(c.block)}`;
    let g = groups.get(key);
    if (!g) {
      g = { block: c.block, source: c.source, family: c.family, selectors: new Set() };
      groups.set(key, g);
    }
    g.selectors.add(c.selector);
  }
  const out = [];
  for (const g of groups.values()) {
    const selector = [...g.selectors].join(", ");
    out.push({
      selector,
      block: g.block,
      source: g.source,
      family: g.family,
      reusable: isReusable(selector, g.family),
    });
  }
  return out;
}

/** Classify a ::ng-deep selector into the capability family it styles. This scopes the
 *  verify gate to the capabilities actually in play — a component that renders only
 *  ngx-select + uii-table must not be required to copy every modal/dialog/editor block.
 *  Also consumed by src/project/scss-mine.mjs (declaration-level mining keeps one family map). */
export function familyForSelector(sel) {
  if (/ngx-select|dropdown-menu|ngx-select-ex/i.test(sel)) return "select";
  if (/gateway-table|table-footer|ugw-pagination|page-box|nav-icon|search-|filter-options|limit-options|cell-html|row-container|gateway-table-data|gateway-empty-data/i.test(sel)) return "table";
  if (/label-custom/.test(sel)) return "label";
  if (/\.fa-|font-awesome|fa-check|fa-times|fa-clock/.test(sel)) return "icon";
  if (/ugw-header|ugw-sidebar|ugw-breadcrumb|ugw-info-box/i.test(sel)) return "layout";
  // Bare form controls (`.form-control`, `.input`) are the universal input rounding/border idiom.
  // Pseudo/variant selectors (`.form-control:focus`, `.ngx-select .form-control`) are matched
  // earlier by `ngx-select` → select, or fall through to `other` — they stay non-reusable.
  if (/^form-control$|^input$/i.test(sel)) return "form";
  return "other";
}

/** Extract full ::ng-deep blocks (selector + balanced body) so the agent copies verbatim.
 *  Handles nested selectors via balanced-brace scanning, unlike a flat [^{}]+ regex. Also
 *  handles the GROUP form `:host ::ng-deep { … }` (no selector head), which the 51 correct
 *  pagination files use — the direct-form scanner alone would miss them and let a buggy
 *  outlier win the corpus. */
function extractNgDeepBlocks(src) {
  const clean = src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/.*$/gm, " ");
  const out = [];
  const re = /(?::host\s+)?::ng-deep/g;
  let m;
  while ((m = re.exec(clean)) !== null) {
    const open = clean.indexOf("{", m.index);
    if (open === -1) continue;
    let depth = 0;
    let close = -1;
    for (let i = open; i < clean.length; i++) {
      if (clean[i] === "{") depth++;
      else if (clean[i] === "}") { depth--; if (depth === 0) { close = i; break; } }
    }
    if (close === -1) continue;
    const block = clean.slice(m.index, close + 1).trim();
    const head = clean.slice(m.index + m[0].length, open).trim().replace(/^\./, "");
    const headSelectors = head
      .split(",")
      .map((part) => part.replace(/\s+/g, " ").trim())
      .filter((s) => s && !s.startsWith("{"));
    if (headSelectors.length) {
      for (const sel of headSelectors) out.push({ selector: sel, block });
    } else {
      // Group form `:host ::ng-deep { … }` — descend into the body and emit each top-level
      // nested rule as its own block (reconstructed as a direct `::ng-deep <sel> { … }`).
      for (const nested of extractNestedRules(clean.slice(open + 1, close))) {
        out.push(nested);
      }
    }
  }
  return out;
}

/** Split a `::ng-deep { … }` group body into top-level nested rules, each reconstructed as a
 *  direct `:host ::ng-deep <selector> { <body> }` block so it dedups and copies like a direct
 *  block. Preserves each nested rule's inner declaration order (the pagination border-order
 *  bug lives in this order). */
function extractNestedRules(body) {
  const rules = [];
  let depth = 0;
  let selBuf = "";
  let bodyStart = -1;
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (c === "{") {
      if (depth === 0) {
        const selector = selBuf.replace(/\s+/g, " ").trim();
        if (selector) rules.push({ selector, bodyStart: i + 1 });
      }
      depth++;
    } else if (c === "}") {
      depth--;
      if (depth === 0) {
        const rule = rules[rules.length - 1];
        if (rule && rule.bodyEnd === undefined) rule.bodyEnd = i;
        selBuf = "";
      }
    } else if (depth === 0) {
      selBuf += c;
    }
  }
  return rules
    .filter((r) => r.selector && r.bodyStart !== -1 && r.bodyEnd !== undefined)
    .map((r) => ({
      selector: r.selector,
      block: `:host ::ng-deep ${r.selector} {${body.slice(r.bodyStart, r.bodyEnd)}}`,
    }));
}

// ---------- component anatomy ----------

/** Detect the recurring page structure so Pass 1 can reproduce it: well panel, table
 *  skeleton, table tag, pagination, and the mock-row floor derived from pagination text. */
function extractAnatomy(allHtml, allScss) {
  const html = allHtml.map((f) => f.src).join("\n");

  const tableTag = pick(/<(uii-table|ngx-datatable|mat-table)\b/i, html) ?? null;
  const skeletonTag = pick(/<(uii-table-skeleton|ngx-datatable-skeleton)\b/i, html) ?? null;

  // A fixed mock-row count is an EXPLICIT project policy, not a SliceUI universal: a paginated
  // library table renders the minimum representative rows the design needs, never a hardcoded 15
  // (remediation §13). The transcript's "dari N data" total sets `pagination = true` (paged), but
  // it does NOT drive the row count — that would re-introduce the 513-literal-rows defect. The
  // policy value (config.json `mockRowsFloor`) is injected by `mergeProjectPolicy`, not mined here.
  let pagination = null;
  const pm = /(?:Menampilkan|Showing)\s+\d+\s*-\s*\d+\s+(?:dari|of)\s+(\d+)\s+data/i.exec(html);
  if (pm) {
    const total = Number(pm[1]);
    if (Number.isFinite(total) && total > 0) pagination = true;
  }
  if (pagination === null) pagination = /<uii-pagination\b|ugw-pagination/i.test(html);

  return {
    // wellAvailable (not "well: wrap it"): `.well` exists as a project idiom, but whether a
    // given slice uses it is decided by the XML/transcript — NOT this convention (user's
    // single-source-of-truth principle; the old `well:true` caused phantom wrappers).
    wellAvailable: /(?:id|class)=["'][^"']*\bwell\b/i.test(html),
    tableTag,
    skeletonTag,
    pagination,
    mockRowsFloor: null,
  };
}

/** First capture group of the first regex match, or null. */
function pick(re, src) {
  const m = re.exec(src);
  return m ? m[1] : null;
}

// ---------- naming ----------

/** Naming conventions: selector prefix (from detect) + the dominant event-handler pattern. */
function extractNaming(allHtml, ctx) {
  const eventCounts = new Map();
  for (const f of allHtml) {
    for (const m of f.src.matchAll(/\((\w+)\)\s*=/g)) {
      const h = m[1];
      if (/^(click|change|select|submit|input|keyup|blur|focus|edit|delete|detail)/i.test(h)) {
        eventCounts.set(h, (eventCounts.get(h) ?? 0) + 1);
      }
    }
  }
  const top = [...eventCounts.entries()].sort((a, b) => b[1] - a[1]);
  const eventNaming = top.length
    ? `onXxx($event) — dominant handler: "${top[0][0]}" (${top[0][1]}×)`
    : "onXxx($event)";
  return {
    prefix: ctx.prefix ?? null,
    eventNaming,
  };
}

// ---------- helpers ----------

function readFileSyncSafe(p) {
  try { return readFileSync(p, "utf8"); } catch { return ""; }
}

/** Absolute → repo-relative path for the corpus `source` field. */
function toRelPath(p) {
  const parts = p.split(/[\\/]/);
  return parts.slice(parts.length - 2).join("/");
}

/**
 * Render the agent-facing narrative profile (conventions.md) from deterministic facts.
 * `init` has no LLM, so this is a deterministic template — the agent MAY enrich it during
 * a slice when it spots an idiom the scan missed, but the baseline is always written here.
 * @param {object} conventions — extractConventions() output
 * @param {string} frameworkLabel — e.g. "Angular 13" for the header
 * @param {string} [frameworkId] — detect's framework id ("angular", "vue-sfc", …). The full
 *   Angular narrative (::ng-deep corpus, translation-pipe note) is Angular-only; a non-Angular
 *   project gets an honest note instead of misleading Angular idiom (2026-09-19 — the
 *   conventions.md-for-Vue bug).
 * @returns {string}
 */
export function renderConventionsMd(conventions, frameworkLabel = "", frameworkId = "angular") {
  if (frameworkId !== "angular") {
    return renderNonAngularNote(frameworkLabel);
  }
  const { classVocabulary = [], ngDeepCorpus = [], componentAnatomy = {}, naming = {} } = conventions ?? {};
  const L = [];
  L.push("<!-- Generated by SliceUI — codebase conventions. Regenerate with `sliceui init`. -->");
  L.push("");
  L.push("# Project Conventions" + (frameworkLabel ? ` — ${frameworkLabel}` : ""));
  L.push("");
  L.push("How THIS codebase writes. Follow these before any framework defaults. The source of");
  L.push("truth for design is the transcript; the source of truth for idiom is this file.");
  L.push("");

  // --- anatomy ---
  L.push("## Page anatomy");
  L.push("");
  L.push("**Structure comes from the XML/transcript ONLY.** Conventions style elements that");
  L.push("already exist in the design — they never ADD structural wrappers.");
  const a = componentAnatomy;
  if (a.wellAvailable) {
    L.push("- `.well` is a container class THIS project uses — apply it only when the design");
    L.push("  (transcript) actually shows a container to style. Do NOT wrap the form in `id=\"well\"`");
    L.push("  unless the XML has that wrapper.");
  }
  if (a.skeletonTag) L.push(`- Loading state: render \`<${a.skeletonTag} *ngIf="isLoading">\` before the table.`);
  if (a.tableTag) L.push(`- Table: use \`<${a.tableTag}>\` with \`[rows]\` + \`[columns]\`, wired client-side only (mock).`);
  if (a.pagination) {
    const floorNote = Number.isFinite(a.mockRowsFloor) && a.mockRowsFloor > 0
      ? `provide exactly \`${a.mockRowsFloor}\` mock rows (project policy) to activate it.`
      : `provide the minimum representative mock rows to activate it (no fixed floor).`;
    L.push(`- Pagination: the table paginates itself from \`rows\` — ${floorNote}`);
  }
  L.push("");

  // --- reusable classes ---
  L.push("## Reusable classes (reuse, don't invent)");
  const labels = classVocabulary.filter((x) => x.hint === "status/field label");
  const others = classVocabulary.filter((x) => x.hint !== "status/field label").slice(0, 20);
  if (!classVocabulary.length) {
    L.push("");
    L.push("_(none detected — this project has little template reuse; follow the transcript's classes.)_");
  } else {
    L.push("");
    L.push("Common classes seen across templates (highest frequency first):");
    L.push("");
    L.push("```");
    L.push(others.map((x) => `  ${x.name}${x.family ? `   (family: ${x.family})` : ""}`).join("\n"));
    L.push("```");
  }
  if (labels.length) {
    L.push("");
    L.push("Status/field labels are a deliberate taxonomy — use the EXACT family member, never");
    L.push("invent a new one:");
    L.push("");
    L.push("```");
    L.push(labels.map((x) => `  ${x.name}`).join("\n"));
    L.push("```");
  }
  L.push("");

  // --- ::ng-deep corpus ---
  L.push("## ::ng-deep corpus (copy verbatim & complete)");
  const reusable = ngDeepCorpus.filter((c) => c.reusable);
  const specific = ngDeepCorpus.filter((c) => !c.reusable);
  if (!ngDeepCorpus.length) {
    L.push("");
    L.push("_(none detected.)_");
  } else {
    L.push("");
    L.push("The project styles library-internal DOM with `::ng-deep`. **Only copy the REUSABLE");
    L.push("blocks below** when the matching capability is in play. A dropped reusable selector");
    L.push("= a lost design effect (hover, open-state, pagination border, table radius, status colors).");
    L.push("");
    if (reusable.length) {
      L.push("### Reusable (copy when the capability is in play)");
      L.push("");
      L.push("```scss");
      for (const c of reusable) L.push(c.block);
      L.push("```");
    }
    if (specific.length) {
      L.push("");
      L.push("### Component-specific (skip unless your slice matches this exact context)");
      L.push("");
      L.push("These belong to ONE slice's context (e.g. a select rendered inside a table cell, or");
      L.push("an editable spreadsheet). Do NOT copy them into a normal page filter/table — copying");
      L.push("a `border: none` control block globally is how a page-filter select loses its border.");
      L.push("");
      L.push("```scss");
      for (const c of specific) L.push(`/* source: ${c.source} */\n${c.block}`);
      L.push("```");
    }
  }
  L.push("");

  // --- naming ---
  L.push("## Naming");
  L.push("");
  if (naming.prefix) L.push(`- Component selector prefix: \`${naming.prefix}\`.`);
  L.push(`- Event handlers: \`${naming.eventNaming ?? "onXxx($event)"}\`.`);
  L.push("");
  L.push("## Always literal — NO translation pipe");
  L.push("");
  L.push("SliceUI emits mock/placeholder code, not production i18n. **Every string is literal text**");
  L.push("(HTML and TS). Never wrap in `| translate`, never add dictionary keys, never read");
  L.push("`id-lang.ts`/`en-lang.ts` — even though this codebase's own templates use `| translate`.");
  L.push("Slicing deliberately deviates from the codebase on this one point.");
  L.push("");

  return L.join("\n");
}

/** Honest conventions.md for a non-Angular project. Deep convention mining (reusable-class
 *  corpus, ::ng-deep, page anatomy, event-handler naming) is Angular-shaped — writing its
 *  Angular idiom for a Vue/React/Svelte project would mislead the agent (::ng-deep → Vue uses
 *  :deep(); "reuse these classes" → Tailwind composes utilities). Point at the real sources
 *  instead of fabricating Angular facts. */
function renderNonAngularNote(frameworkLabel) {
  const L = [];
  L.push("<!-- Generated by SliceUI — codebase conventions. Regenerate with `sliceui init`. -->");
  L.push("");
  L.push("# Project Conventions" + (frameworkLabel ? ` — ${frameworkLabel}` : ""));
  L.push("");
  L.push("Deep convention mining in SliceUI is Angular-shaped (reusable-class corpus from `.html`");
  L.push("templates, `::ng-deep` blocks, Angular event syntax). This project is not Angular, so");
  L.push("SliceUI deliberately does NOT emit those Angular idioms here — they would be misleading");
  L.push("(e.g. a `::ng-deep` section for a Vue project, which uses `:deep()` instead).");
  L.push("");
  L.push("To write idiomatically for this project, the agent should instead:");
  L.push("");
  L.push("1. Read the sample components in `.sliceui/context/samples.md` — they are the real wiring");
  L.push("   and styling patterns, not a synthesized Angular summary.");
  L.push("2. Run the `/sliceui-handoff` skill for a fuller profile: it reads the actual component");
  L.push("   files and writes `.sliceui/handoff.md` with the styling system in THIS framework's own");
  L.push("   terms (`:deep()` for Vue, CSS modules for React, `@theme`/utility composition for");
  L.push("   Tailwind).");
  L.push("3. Follow the framework's own defaults for structure — the design (transcript/XML) is still");
  L.push("   the single source of truth for what exists.");
  L.push("");
  return L.join("\n");
}
