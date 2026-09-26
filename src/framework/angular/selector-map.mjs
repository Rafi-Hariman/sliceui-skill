// selector-map (PR 6C) — fixture-scoped, LOCATOR-ONLY design-node → rendered-DOM binding.
//
// Why this exists: a design node's identity in the transcript is its `id` (e.g. `btn1`), but the
// rendered DOM carries no marker for it. PR 6B resolved facts by text/role heuristics, which run out
// for repeated structural nodes (pagination items, table rows, footer frames) where several elements
// legitimately share shape and text. A locator map names the ONE element each such design node
// corresponds to.
//
// HARD CONTRACT (§10/§11): the map identifies an element. It NEVER carries an expected value. Every
// expected dimension/spacing/alignment/color/radius is read independently from the transcript/XML.
// A map that carries `expected*` is rejected by `validateSelectorMap` — that rejection is what keeps
// the oracle honest, so it is enforced structurally, not by convention.

/** Bump only on a breaking shape change; an unknown version is rejected, never best-effort parsed. */
export const SELECTOR_MAP_VERSION = 1;

/** Bounded selector length — a pathological selector is a smell, not a locator. */
export const MAX_SELECTOR_LENGTH = 200;

/** Fields that would turn the locator map into an expected-value oracle. Rejected outright (§11). */
const FORBIDDEN_EXPECTED_FIELDS = [
  "expected", "expectedHeight", "expectedWidth", "expectedGap", "expectedSpacing",
  "expectedAlignment", "expectedColor", "expectedRadius", "expectedSize", "expectedBorder",
  "expectedPadding", "expect", "value", "actual", "design",
];

/** Selector content that is executable, path-like, or otherwise unsafe as a fixture locator. */
const UNSAFE_SELECTOR_PATTERNS = [
  { re: /[<>]/, why: "HTML/script-like content" },
  { re: /(^|\/)(etc|var|usr|home|Users)\//, why: "absolute/private filesystem path" },
  { re: /^\s*(https?:)?\/\//, why: "URL" },
  { re: /\bjavascript\s*:/i, why: "javascript: scheme" },
  { re: /\beval\s*\(/, why: "eval()" },
  { re: /\[.*\bexpected\w*\b.*\]/i, why: "expected-value attribute" },
];

// --- SCH-001: strict schema allowlist + recursive semantic-field rejection ---

/** The only fields each level may carry (§21). An unknown field is rejected, never silently ignored. */
const SCHEMA_ALLOWLIST = {
  root: new Set(["version", "mappings"]),
  mapping: new Set(["designNodeId", "renderLocator", "required"]),
  locator: new Set(["strategy", "selector"]),
};

/** Normalize a field name for semantic comparison (§20): lowercase, collapse `_`/`-`/whitespace. */
const normKey = (s) => String(s).toLowerCase().replace(/[_\s-]+/g, "");

/** Named semantic-exception / expected-value field forms that are not a bare `expected*`/`actual*`.
 *  `expected*`/`actual*` are caught by prefix, below. This set covers the named exceptions (§11/§19)
 *  and the bare `value`/`expect`/`design` carriers the shallow denylist used to reject. */
const FORBIDDEN_NORMALIZED = new Set([
  "value", "values", "expect", "design", "actual",
  "allowoverflow", "expectedscroll", "scrollintent",
  "validtruncation", "ellipsisexpected", "truncateintent",
  "overflowexpected", "overflowallowed",
]);

/** A field name is forbidden when its normalized form either starts with `expected`/`actual` or
 *  matches a named semantic-exception form. This is deliberately broad — the locator map's only job
 *  is to name an element, so there is no legitimate `expected*` field at any depth. */
const isForbiddenKey = (key) => {
  const n = normKey(key);
  if (n.startsWith("expected") || n.startsWith("actual")) return true;
  return FORBIDDEN_NORMALIZED.has(n);
};

/** Recursive defense-in-depth (§21): reject any forbidden field name anywhere in the payload,
 *  including nested objects and array-contained objects. String VALUES (e.g. the selector) are not
 *  inspected — §20 forbids rejecting a selector for containing innocent words. */
function scanForbidden(node, path, errors) {
  if (Array.isArray(node)) {
    node.forEach((v, i) => scanForbidden(v, `${path}[${i}]`, errors));
    return;
  }
  if (!node || typeof node !== "object") return;
  for (const [k, v] of Object.entries(node)) {
    if (isForbiddenKey(k)) {
      errors.push(`${path}.${k} is forbidden — a locator map must never carry an expected or semantic value`);
    }
    scanForbidden(v, `${path}.${k}`, errors);
  }
}

/**
 * Validate a parsed selector map.
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function validateSelectorMap(map) {
  const errors = [];
  if (!map || typeof map !== "object" || Array.isArray(map)) {
    return { ok: false, errors: ["selector map is not an object"] };
  }

  if (map.version !== SELECTOR_MAP_VERSION) {
    errors.push(`version must be ${SELECTOR_MAP_VERSION} (got ${JSON.stringify(map.version)})`);
  }

  // --- SCH-001: unknown root fields are rejected (strict allowlist) ---
  for (const k of Object.keys(map)) {
    if (!SCHEMA_ALLOWLIST.root.has(k)) errors.push(`unknown root field "${k}"`);
  }

  if (!Array.isArray(map.mappings)) {
    errors.push("mappings must be an array");
    return { ok: false, errors };
  }

  // Defense-in-depth: the whole payload is scanned for forbidden semantic fields regardless of
  // where they are nested (they are also rejected by the per-level allowlist below).
  scanForbidden(map, "map", errors);

  const seen = new Set();
  for (const [i, m] of map.mappings.entries()) {
    const where = `mappings[${i}]`;
    if (!m || typeof m !== "object") { errors.push(`${where} is not an object`); continue; }

    for (const k of Object.keys(m)) {
      if (!SCHEMA_ALLOWLIST.mapping.has(k)) errors.push(`${where} has unknown field "${k}"`);
    }

    if (typeof m.designNodeId !== "string" || !m.designNodeId) {
      errors.push(`${where}.designNodeId must be a non-empty string`);
    } else if (seen.has(m.designNodeId)) {
      errors.push(`${where}.designNodeId "${m.designNodeId}" is duplicated — one locator per design node`);
    } else {
      seen.add(m.designNodeId);
    }

    const loc = m.renderLocator;
    if (!loc || typeof loc !== "object") { errors.push(`${where}.renderLocator must be an object`); continue; }
    for (const k of Object.keys(loc)) {
      if (!SCHEMA_ALLOWLIST.locator.has(k)) errors.push(`${where}.renderLocator has unknown field "${k}"`);
    }
    if (loc.strategy !== "css") {
      errors.push(`${where}.renderLocator.strategy must be "css" (got ${JSON.stringify(loc.strategy)})`);
    }
    if (typeof loc.selector !== "string" || !loc.selector.trim()) {
      errors.push(`${where}.renderLocator.selector must be a non-empty string`);
    } else {
      if (loc.selector.length > MAX_SELECTOR_LENGTH) {
        errors.push(`${where}.renderLocator.selector exceeds ${MAX_SELECTOR_LENGTH} chars (${loc.selector.length})`);
      }
      for (const { re, why } of UNSAFE_SELECTOR_PATTERNS) {
        if (re.test(loc.selector)) errors.push(`${where}.renderLocator.selector is unsafe (${why})`);
      }
    }

    // `required` is a fact property, not a locator property — optional, but must be boolean if present.
    if (m.required !== undefined && typeof m.required !== "boolean") {
      errors.push(`${where}.required must be a boolean when present`);
    }
  }

  return { ok: errors.length === 0, errors };
}

/**
 * Index a validated map by designNodeId.
 * @returns {Map<string, {selector: string, required: boolean}>}
 */
export function indexSelectorMap(map) {
  const out = new Map();
  for (const m of map?.mappings ?? []) {
    out.set(m.designNodeId, {
      selector: m.renderLocator.selector,
      required: m.required !== false,
    });
  }
  return out;
}
