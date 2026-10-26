// check-layers — the authority decomposition of the verify gate's checks (remediation Phase 4).
//
// Each of the 32 checks is classified into exactly ONE layer, grounded in the authority model:
//   design    = evidenced by the design itself (transcript/XML) — universal to every SliceUI project
//   framework = syntactic/structural validity (Angular version, SCSS, NgModule registration)
//   project   = THIS team's idiom (library/corpus/token) — from project evidence/configuration
//   policy    = org-private (pilar/uii) or SliceUI output-contract constraints, NOT universal fidelity
//
// `render` is deliberately NOT a check layer: it is a backstop MECHANISM applied to render-dependent
// design verdicts (styleFidelity / containerPadding / iconColor) when a browser can measure the
// cascade — never a bucket a check lives in. `sliceui check --layers` exposes this table so the
// agent can see WHY a failure is blocking (design evidence) vs advisory (convention).

export const LAYERS = Object.freeze(["design", "framework", "project", "policy"]);

const CLASSIFICATION = {
  // design — universal, evidenced by the design itself
  textCoverage: "design",
  styleFidelity: "design",
  phantomWrapper: "design",
  modalWrapper: "design",
  containerPadding: "design",
  requiredMarker: "design",
  iconColor: "design",
  inventedLayout: "design",
  buttonOrder: "design",
  filterRowButton: "design",
  gridColumns: "design",
  // framework — syntactic/structural validity (Angular/toolchain)
  scssCompiles: "framework",
  frameworkSyntax: "framework",
  declaredInModule: "framework",
  noHashedSelectors: "framework",
  deadCode: "framework",
  // project — this team's idiom, from project evidence/configuration
  classVocabulary: "project",
  inventedUtility: "project",
  loadedClass: "project",
  libraryTable: "project",
  ngxSelectBinding: "project",
  scssCoverage: "project",
  noBareNgDeep: "project",
  alignmentViaDeepCss: "project",
  tableOptions: "project",
  anatomy: "project",
  // policy — org-private (pilar/uii) or SliceUI output-contract (not universal fidelity rules)
  pilarBindings: "policy",
  pilarInjection: "policy",
  rowAuth: "policy",
  tableBindings: "policy",
  mockRowCount: "policy",
  noTranslation: "policy",
};

/** The authority layer a check belongs to, or null for an unknown name (never guessed). */
export function classifyCheck(name) {
  return CLASSIFICATION[name] ?? null;
}

/** Layer → check names, grouped. */
export function listCheckLayers() {
  const byLayer = { design: [], framework: [], project: [], policy: [] };
  for (const [name, layer] of Object.entries(CLASSIFICATION)) byLayer[layer].push(name);
  return byLayer;
}

/** Compact markdown table of the authority decomposition (for `check --layers`). */
export function renderCheckLayers() {
  const by = listCheckLayers();
  const L = ["# Verify gate — authority layers", ""];
  for (const layer of LAYERS) {
    L.push(`## ${layer}`);
    L.push("");
    for (const name of by[layer].sort()) L.push(`- ${name}`);
    L.push("");
  }
  L.push("## render (backstop, not a layer)");
  L.push("");
  L.push("- Applied to render-dependent design verdicts (styleFidelity, containerPadding, iconColor) when a browser can measure the cascade.");
  return L.join("\n");
}
