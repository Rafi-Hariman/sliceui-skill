// uii-slice-policy — the slice-generation POLICY for pilar components.
//
// Two different questions must never share one answer:
//   (a) "What is pilar's FULL API?" → pilar-catalog.mjs (the reference the agent reads).
//   (b) "What may a SliceUI-generated mock slice bind?" → THIS module (the gate's whitelist).
//
// SliceUI emits client-side mock data only. Pilar's real API includes server-mode and advanced
// state-management inputs that a slice must never emit — but the earlier "derive the legal set
// from the catalog" approach made those LEGAL by definition (the council's circular-gate flaw,
// realized: verify let [saveStatement]/[allowRightClick]/[rightClickMenuActions] pass green).
//
// So: the catalog stays the full reference; this module is the curated slice subset. The two are
// kept in tension — verify.mjs enforces BOTH: a binding must (1) exist in the catalog (name
// correct) AND (2) pass this policy (mock-appropriate).

/** uii-table inputs a mock slice may bind. Deliberately small — the common filter+table shape. */
export const SLICE_TABLE_INPUTS = new Set([
  "rows", "columns",
  "actionTitle", "actionColumn", "checkboxColumn",
  "paginationOptions", "searchOptions", "limitOptions",
  "emptyTableMsg", "footerInfo", "radioColumn",
]);

/** uii-table outputs a mock slice may listen for — the action icons (each auth-gated in pilar),
 *  row selection, and switch/row edits. No server-side pagination/search callbacks. */
export const SLICE_TABLE_OUTPUTS = new Set([
  "editClicked", "deleteClicked", "detailClicked", "commentClicked",
  "auditClicked", "importClicked", "exportClicked", "printClicked",
  "publishClicked", "postingClicked", "unpostingClicked", "rejectClicked",
  "validateClicked", "verifyClicked", "inValidateClicked", "reloadClicked",
  "selectedRow", "switchChanged", "rowsChanged", "stateCleared",
]);

/** Server-mode wiring + advanced state a slice must NEVER emit, even though pilar declares it. */
export const SLICE_FORBIDDEN_TABLE_INPUTS = new Set([
  // server-mode (SliceUI is client-side mock only)
  "serverMode", "page", "selectedLimit",
  // advanced state / persistence / layout that mock data doesn't touch
  "saveStatement", "forceLimitOptions", "alignedComponent", "allowRightClick",
  "rightClickMenuActions", "summaryRows", "showSummary", "isAllCheckbox",
  "pageNumberDefault", "searchDefault", "actionInValidation", "paginationAlign",
]);

export const SLICE_FORBIDDEN_TABLE_OUTPUTS = new Set([
  "pageChanged", "limitChanged", "searchChanged",
]);
