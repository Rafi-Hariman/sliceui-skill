// recipe-merger — declaration-level merge of project recipes against the immutable Design Intent.
//
// Policy (doc 03 §7): A1 explicit design target > A3 visual default / design-overridable declaration.
//   - PAGE_SPECIFIC_GEOMETRY / UNVERIFIED_SAMPLE → suppress (never a reusable default).
//   - DESIGN_OVERRIDABLE / VISUAL_DEFAULT → design wins when the design states an explicit value;
//     every such override is recorded as an explicit MergeConflict (never a SILENT A1 override).
//   - STRUCTURAL_INTERNAL / STATE_STYLE / BEHAVIOR_REQUIRED → preserved (behavior/internal).
//
// The guarantee "zero silent A1 override" is structural: a suppressed project value that contradicts
// the design is always surfaced as a conflict with resolution "DESIGN_WINS".

import { designGeometryKey, valuesDiffer } from "./design-geometry.mjs";

export const MERGE_RESOLUTIONS = Object.freeze(["PRESERVED", "SUPPRESSED_PAGE_SPECIFIC", "DESIGN_WINS", "UNRESOLVED"]);

/**
 * Merge recipe declarations against the design geometry.
 * @param {Array} declarations — recipe-semantics `mineRecipeDeclarations` output
 * @param {Record<string, object>} designGeometry — design-geometry `extractDesignGeometry` output
 * @returns {{ effective: Array, suppressed: Array, conflicts: Array, silentOverrideCount: number }}
 */
export function mergeDeclarations(declarations = [], designGeometry = {}) {
  const effective = [];
  const suppressed = [];
  const conflicts = [];
  let silentOverrideCount = 0;

  for (const decl of declarations) {
    const semantics = decl.semantics;
    if (semantics === "PAGE_SPECIFIC_GEOMETRY" || semantics === "UNVERIFIED_SAMPLE") {
      suppressed.push({ ...decl, resolution: "SUPPRESSED_PAGE_SPECIFIC" });
      continue;
    }

    const key = designGeometryKey(decl.property);
    const designValue = key ? findDesignValue(key, designGeometry, decl.family) : null;

    if ((semantics === "DESIGN_OVERRIDABLE" || semantics === "VISUAL_DEFAULT") && designValue != null) {
      if (valuesDiffer(decl.value, designValue, decl.property)) {
        // Explicit A1 wins — recorded, never silent.
        suppressed.push({ ...decl, resolution: "DESIGN_WINS", designValue });
        conflicts.push({
          property: decl.property,
          designValue,
          projectValue: decl.value,
          projectSemantics: semantics,
          resolution: "DESIGN_WINS",
          selector: decl.selector,
        });
        continue;
      }
    }

    effective.push({ ...decl, resolution: "PRESERVED" });
  }

  return { effective, suppressed, conflicts, silentOverrideCount };
}

/** Find a design value for `key`, matched by capability family so `.form-control` (form) never
 *  conflicts with an unrelated table's radius. A specific-capability recipe matches only design
 *  nodes of the same capability; a family-agnostic recipe (null/other/layout) matches any node. */
function findDesignValue(key, designGeometry, family) {
  const caps = capabilitiesForFamily(family);
  for (const g of Object.values(designGeometry ?? {})) {
    if (g[key] == null) continue;
    if (caps && !caps.has(g.capability ?? "container")) continue;
    return g[key];
  }
  return null;
}

function capabilitiesForFamily(family) {
  switch (family) {
    case "form": case "select": return new Set(["form"]);
    case "table": return new Set(["table"]);
    case "label": case "icon": return new Set(["icon"]);
    case "button": return new Set(["button"]);
    default: return null; // family-agnostic — match any
  }
}
