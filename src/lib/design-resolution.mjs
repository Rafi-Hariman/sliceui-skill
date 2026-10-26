// design-resolution — canonical design feature set + recipe states (focused remediation B/C/D).
//
// The SINGLE source of truth for "which features does this design use" and "which project recipes
// are required / allowed / rejected / conflicting for those features". Consumed by BOTH `inspect`
// (the agent-facing context) and `check` (the scssCoverage gate), so a recipe can never be
// simultaneously demanded and forbidden.
//
//   design → capability → feature → exact recipe state
//
// Feature-level pruning closes the G2 leak: a table with no status badge must not receive
// `label-custom-*` recipes, even though the project has them. Recipe states close the G3
// contradiction: a `::ng-deep` block superseded by a public component input is `rejected`, never
// `required`. Conflict detection closes G4: an explicit design value that contradicts a project
// recipe is surfaced as `conflicting` with "design wins" (authority A1).
//
// Pure — no fs. Reuses resolveTranscript for the styled-leaf inventory (status badges), so the
// feature set and the resolved idioms share one walk of the design.

import { resolveTranscript } from "./resolve.mjs";
import { behaviorBindingRecommendations } from "./resolution-policy.mjs";

export const RECIPE_STATES = Object.freeze(["required", "allowed", "rejected", "conflicting"]);

/**
 * Derive the design feature set from the transcript + resolved groups. A feature is present only
 * when the design (or a resolved mapping) evidences it — never merely because the project has a
 * recipe for it (rule §4).
 */
export function deriveFeatures(transcript, groups = []) {
  const features = {
    table: { present: false, pagination: false, search: false, statusBadge: false, checkbox: false, actionColumn: false, actions: [] },
    select: { present: false },
    buttons: { present: false },
  };
  const hasStatus = groups.some((g) => g?.kind === "status");
  const walk = (nodes) => {
    for (const n of nodes ?? []) {
      if (!n || typeof n !== "object") continue;
      if (n.hidden) continue; // hidden design layers are debug evidence, not a feature signal
      if (n.table) features.table.present = true;
      if (n.type === "input") {
        if (hasIconChild(n)) features.select.present = true;
        else if (/pencarian|search|cari/i.test(`${n.text ?? ""} ${n.label ?? ""}`)) features.table.search = true;
      }
      if (n.type === "button") features.buttons.present = true;
      if (n.type === "checkbox") features.table.checkbox = true;
      if (n.type === "text" && /menampilkan|showing\b/i.test(n.text ?? "") && /data/i.test(n.text ?? "")) {
        features.table.pagination = true;
      }
      walk(n.children);
    }
  };
  walk(transcript?.layout);
  features.table.statusBadge = hasStatus;
  return features;
}

/** Which corpus family a feature gate maps to (used by resolveRecipes for feature-level pruning). */
const FEATURE_FAMILY_GATE = {
  select: "select",
  table: "table",
  "table.statusBadge": "label",
  "table.checkbox": "checkbox",
};

/**
 * Resolve each reusable corpus recipe into a state for THIS design.
 *   - feature-level prune: a family whose design feature is absent is dropped (not selected);
 *   - `rejected`: a behavior binding says a public input supersedes this CSS selector;
 *   - `required`: in play and not rejected.
 * A non-reusable (component-specific) block is never selected. Unknown families are KEPT
 * (conservative — never drop what cannot be shown unused), mirroring spec's existing posture.
 */
export function resolveRecipes(conventions = {}, features = {}, behaviorBindings = []) {
  const corpus = conventions.ngDeepCorpus ?? [];
  const rejected = rejectedSelectorSet(behaviorBindings);
  const inPlay = new Set();
  for (const [feature, family] of Object.entries(FEATURE_FAMILY_GATE)) {
    if (feature === "table.statusBadge" && features.table?.statusBadge) inPlay.add(family);
    else if (feature === "table.checkbox" && features.table?.checkbox) inPlay.add(family);
    else if (feature === "select" && features.select?.present) inPlay.add(family);
    else if (feature === "table" && features.table?.present) inPlay.add(family);
  }

  const recipes = [];
  for (const c of corpus) {
    if (!c?.reusable) continue;
    const family = c.family ?? null;
    // Feature-level prune: a select/table/label/checkbox family is selected only when its feature
    // is in play. A recipe with no family (or an unknown family) is kept.
    if (family && FEATURE_FAMILY_GATE[Object.keys(FEATURE_FAMILY_GATE).find((k) => FEATURE_FAMILY_GATE[k] === family)]) {
      if (!inPlay.has(family)) continue;
    }
    const state = isRejectedRecipe(c.selector, c.block, rejected) ? "rejected" : "required";
    recipes.push({ selector: c.selector, family, state, block: c.block ?? "" });
  }
  return recipes;
}

/** The set of selector tokens a behavior binding rejects (public input supersedes the CSS). */
export function rejectedSelectorSet(behaviorBindings = []) {
  const set = new Set();
  for (const b of behaviorBindings ?? []) {
    for (const sel of b.rejectedSelectors ?? []) {
      const tok = String(sel).replace(/^[.#]/, "").trim();
      if (tok) set.add(tok);
    }
    // Free-text fallback: tokenize the rejection value for any `.class`/`#id` it names.
    for (const r of b.rejected ?? []) {
      for (const m of String(r.value ?? "").matchAll(/[.#]([\w-]+)/g)) set.add(m[1]);
    }
  }
  return set;
}

/** The element actually styled by a selector (its last non-pseudo token) — the precise unit a
 *  rejected selector names. This avoids over-matching a descendant selector like
 *  `.ugw-pagination-container li.page-box` when only `.ugw-pagination-container` (the alignment
 *  container) is rejected. */
const PSEUDO_CLASSES = new Set(["hover", "focus", "active", "first-child", "last-child", "nth-child", "before", "after", "checked", "disabled", "visited"]);

function primaryToken(selector) {
  const tokens = String(selector ?? "").split(/[^a-zA-Z0-9_-]+/).filter(Boolean);
  for (let i = tokens.length - 1; i >= 0; i--) {
    if (!PSEUDO_CLASSES.has(tokens[i].toLowerCase())) return tokens[i];
  }
  return tokens[tokens.length - 1] ?? "";
}

/** True when a selector's styled element matches a rejected token (shared by inspect + check). */
export function selectorRejected(selector, rejected) {
  if (!rejected?.size) return false;
  return rejected.has(primaryToken(selector));
}

function isRejected(selector, rejected) {
  return selectorRejected(selector, rejected);
}

/** Layout-distribution declarations a public behavior input supersedes (mirrors verify.mjs's
 *  ALIGNMENT_PROPS so resolve and the checker agree on "behavior" vs "visual"). */
const ALIGNMENT_PROP = /\b(justify-content|justify-items|justify-self|align-items|align-self|text-align|margin-left|margin-right|margin-inline-start|margin-inline-end|float|flex-direction)\s*:/i;

/** Split a recipe block's declarations by responsibility: alignment/behavior vs visual.
 *  The block is a full SCSS rule (`:host ::ng-deep .sel { decls }`), so the body between the
 *  braces is extracted first — the selector/brace prefix and trailing `}` are not declarations. */
export function splitBlockByResponsibility(block) {
  const m = /\{([\s\S]*)\}/.exec(String(block ?? ""));
  const body = m ? m[1] : String(block ?? "");
  const alignment = [];
  const visual = [];
  for (const raw of body.split(";")) {
    const d = raw.trim();
    if (!d) continue;
    (ALIGNMENT_PROP.test(d) ? alignment : visual).push(d);
  }
  return { alignment, visual };
}

/** Does the block carry a visual declaration (anything beyond layout-distribution behavior)? */
export function hasVisualResponsibility(block) {
  return splitBlockByResponsibility(block).visual.length > 0;
}

/** A recipe is REJECTED only when a public input supersedes its behavior AND the block has no
 *  visual responsibility of its own. A block that also styles internal DOM visually stays in play
 *  (its alignment declaration is superseded, its visuals are not). This is the §7 responsibility
 *  split: `paginationAlign` supersedes alignment behavior, NOT the page-box visual recipe. */
export function isRejectedRecipe(selector, block, rejectedSelectors) {
  if (!selectorRejected(selector, rejectedSelectors)) return false;
  return !hasVisualResponsibility(block);
}

/**
 * Surface design-vs-recipe conflicts for comparable visual properties. A recipe that is in play
 * (`required`) but declares a value that contradicts an explicit design fact is `conflicting`;
 * the resolution is "design wins" (authority A1) and the verifier must not demand the project
 * value. Deterministic — parses the recipe block for a bounded set of comparable properties.
 * Currently: border-radius (the G4 example). Extensible to color/font-size/weight.
 */
export function detectConflicts(transcript, recipes = [], features = {}) {
  const conflicts = [];
  const byFamily = new Map();
  for (const r of recipes) {
    if (r.state !== "required" || !r.family) continue;
    (byFamily.get(r.family) ?? byFamily.set(r.family, []).get(r.family)).push(r);
  }
  const walk = (nodes) => {
    for (const n of nodes ?? []) {
      if (!n || typeof n !== "object") continue;
      if (n.hidden) continue;
      const radius = uniformRadius(n);
      if (radius != null) {
        const family = familyOfNode(n);
        if (family && byFamily.has(family)) {
          for (const r of byFamily.get(family)) {
            // Per-node semantic correspondence (final remediation §6): a table container must not
            // inherit a search/limit/pagination descendant's recipe radius merely because both are
            // in the `table` family. Skip recipes whose selector does not correspond to the node.
            if (!roleMatchesRecipe(n, r)) continue;
            const recipeRadius = extractRadius(r.block);
            if (recipeRadius != null && recipeRadius !== radius) {
              conflicts.push({
                property: "border-radius",
                family,
                nodeId: n.id,
                design: radius,
                recipe: recipeRadius,
                selector: r.selector,
                resolution: "design wins",
              });
            }
          }
        }
      }
      walk(n.children);
    }
  };
  walk(transcript?.layout);
  return conflicts;
}

/** A node's radius as a single number: uniform `radius`, or a uniform per-corner radius. */
function uniformRadius(n) {
  if (typeof n.radius === "number") return n.radius;
  const c = n.cornerRadius;
  if (c && c.tl === c.tr && c.br === c.bl && c.tl === c.tr && typeof c.tl === "number") return c.tl;
  return null;
}

/** Design node → capability family for conflict matching (null when not applicable). */
function familyOfNode(n) {
  if (n.table) return "table";
  if (n.type === "input") return "select";
  if (n.type === "button") return "button";
  return null;
}

/** Does a recipe's selector actually correspond to this node's role? Within the `table` family a
 *  container node must match the table/grid container recipe, not a search/limit/pagination
 *  descendant's recipe. Deterministic + conservative: an unclear correspondence yields false →
 *  no fabricated conflict. */
function roleMatchesRecipe(n, recipe) {
  const sel = String(recipe.selector ?? "");
  if (n.table) {
    return /table|datatable|grid|gateway/i.test(sel) && !/search|pagination|page-box|limit-options|nav-icon|cell-html|empty/i.test(sel);
  }
  if (n.type === "input") return /select|ngx-select|form-control|dropdown/i.test(sel);
  if (n.type === "button") return /btn|button/i.test(sel);
  return false;
}

/** Parse a `border-radius: Npx` declaration out of a recipe block (first match). */
function extractRadius(block) {
  const m = /border-radius\s*:\s*([0-9.]+)\s*(?:px|rem)?/i.exec(String(block ?? ""));
  if (!m) return null;
  const v = Number(m[1]);
  return Number.isFinite(v) ? v : null;
}

/** Recursive icon-child detection (a caret glyph marks a select/dropdown). */
function hasIconChild(node) {
  for (const c of node.children ?? []) {
    if (c?.type === "icon") return true;
    if (c && hasIconChild(c)) return true;
  }
  return false;
}

/**
 * Canonical design resolution: features + resolved idioms + behavior bindings + recipe states +
 * conflicts, all from one walk. This is the single contract consumed by `inspect` and `check`.
 */
export function resolveDesign(transcript, conventions = {}, pilar = null) {
  const resolved = resolveTranscript(transcript, conventions, pilar);
  const behaviorBindings = resolved.behaviorBindings ?? behaviorBindingRecommendations(transcript, pilar);
  const features = deriveFeatures(transcript, resolved.groups);
  const recipes = resolveRecipes(conventions, features, behaviorBindings);
  const conflicts = detectConflicts(transcript, recipes, features);
  return { features, groups: resolved.groups, behaviorBindings, recipes, conflicts };
}

/**
 * Compile the design's pagination footer evidence ("Menampilkan 1-10 dari 30 data") into the
 * runtime state it implies: visibleStart/visibleEnd/pageSize/total. This is the evidence the
 * mock/runtime state must reproduce for the designed pagination to render (render-reality
 * remediation B) — consumed by `inspect` (guidance) and render-verify (the synthetic mount state).
 * Returns null when the design carries no parseable pagination footer.
 */
export function paginationEvidence(transcript) {
  let found = null;
  const walk = (nodes) => {
    for (const n of nodes ?? []) {
      if (found) return;
      if (!n || typeof n !== "object" || n.hidden) continue;
      if (n.type === "text") {
        const t = (n.text ?? "").trim();
        if (/menampilkan|showing\b/i.test(t) && /data/i.test(t)) {
          const m = /(\d+)\s*-\s*(\d+)\s+(?:dari|of)\s+(\d+)/i.exec(t);
          if (m) {
            const start = Number(m[1]);
            const end = Number(m[2]);
            const total = Number(m[3]);
            const pageSize = end - start + 1;
            if (pageSize > 0 && total > 0) {
              found = { nodeId: n.id, text: t, visibleStart: start, visibleEnd: end, pageSize, total };
              return;
            }
          }
        }
      }
      if (n.children) walk(n.children);
    }
  };
  walk(transcript?.layout);
  return found;
}
