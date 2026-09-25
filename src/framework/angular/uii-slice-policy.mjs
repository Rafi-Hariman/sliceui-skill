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
  // `paginationAlign` was forbidden until 2026-09-24. It is a PRESENTATION input, not server-mode
  // state — and the runtime default is 'center' (pilar-catalog: uii-client-table.paginationAlign
  // default "'center'", forwarding to uii-pagination.paginationALign default "'center'"). A design
  // whose pagination sits right therefore renders CENTERED unless the binding is sent, and no
  // amount of ::ng-deep fixes it correctly. Field evidence: 23 Sep 2026 report §4.4 (three hand-
  // written alignment overrides, all unnecessary once the public input was used).
  //
  // Un-forbidding alone would trade a false positive for a silent false negative, so the binding
  // is now EVIDENCE-GATED in verify.mjs (checkTableOptions): it is required only when the raw XML
  // shows the footer frame distributing its children (SPACE_BETWEEN), and a ::ng-deep override of
  // the pagination/footer alignment raises SUI006.
  "paginationAlign",
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
  "pageNumberDefault", "searchDefault", "actionInValidation",
]);

export const SLICE_FORBIDDEN_TABLE_OUTPUTS = new Set([
  "pageChanged", "limitChanged", "searchChanged",
]);
