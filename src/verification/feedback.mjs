// verification/feedback — actionable corrective feedback for a failed check.
//
// Every failure reports expected, actual, evidence, likely cause, and a correction direction — never
// just "FAIL". This is the doc 04 §15 contract, shared by every verifier in this directory.

/**
 * @param {object} check — the compiled check
 * @param {object} result — the verifier's result ({status, actual, delta, detail})
 * @returns {{ expected, actual, evidence, likelyCause, correction }}
 */
export function correctiveFeedback(check, result) {
  const expected = check.expected ?? null;
  const actual = result?.actual ?? null;
  return {
    expected,
    actual,
    evidence: check.evidence ?? [],
    likelyCause: likelyCauseFor(check, result),
    correction: check.remediation ?? result?.remediation ?? "correct the mismatch to the design value",
  };
}

function likelyCauseFor(check, result) {
  switch (check.category) {
    case "sibling-ratio": return "a sibling is missing its fill/grow (or a fixed width was authored instead)";
    case "item-distance": return "the design gap was stacked on top of existing child margins, or a child margin was left unreset";
    case "alignment": return "the element is not aligned to the design's parent edge/center";
    case "relative-size": return "the child's size is not the designed fraction of its parent";
    case "containment": return "the child escapes its intended container (missing overflow containment)";
    case "grid-track": return "the rendered grid has a different column/row count than the design";
    case "anchor": return "the floating element is anchored to a different edge/corner";
    case "exact-text": case "table-content": return "the designed visible content was replaced or dropped";
    case "pagination-visible": return "the runtime/mock state does not satisfy the component's pagination visibility condition";
    case "responsive-safety": return "the layout overflows/overlaps at the unsupplied viewport";
    default: return "the rendered value diverges from the design";
  }
}
