// verification/content — semantic exact-visible-content verification (doc 04 §3).
//
// The design's visible text and table cells are A1 immutable. Verification proves the RENDERED DOM
// contains exactly those strings — it does not prove, and must not be confused with, the authored
// source containing them. `domTexts` is the set of VISIBLE text nodes measured in the browser.

const norm = (s) => String(s ?? "").replace(/\s+/g, " ").trim();

/** Verify one exact-text check against visible DOM text. */
export function verifyExactText(check, domTexts = []) {
  const haystack = (domTexts ?? []).map(norm);
  const present = haystack.includes(norm(check.expected));
  return {
    status: present ? "pass" : "fail",
    expected: check.expected,
    actual: present ? check.expected : null,
    detail: present ? `exact text "${check.expected}" rendered` : `exact text "${check.expected}" missing from the rendered DOM`,
  };
}

/** Verify a table's designed-visible content (headers + every designed row cell) is present. */
export function verifyTableContent(check, domTexts = []) {
  const present = new Set((domTexts ?? []).map(norm));
  const missingHeaders = (check.headers ?? []).filter((h) => !present.has(norm(h)));
  const missingCells = [];
  for (const row of check.designedRows ?? []) {
    for (const cell of row) if (!present.has(norm(cell))) missingCells.push(cell);
  }
  const ok = missingHeaders.length === 0 && missingCells.length === 0;
  return {
    status: ok ? "pass" : "fail",
    expected: { headers: check.headers, rows: check.designedRows?.length ?? 0 },
    actual: { missingHeaders, missingCells },
    detail: ok
      ? "designed table headers + all designed-visible rows rendered"
      : `missing headers [${missingHeaders.join(", ")}] / cells [${missingCells.slice(0, 6).join(", ")}]`,
  };
}
