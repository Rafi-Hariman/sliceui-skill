// benchmark/inventory — the seeded benchmark corpus. Every member declares its origin honestly:
// the ONE real structured export (mahasiswa-tarif), a handful of adversarial fixtures (known-good /
// known-bad falsification members), and property-generated cases. This is a framework-validation
// seed, NOT a 30–50 screen production corpus (section 10) — the runner reports it as insufficient.

import { ORIGIN, PRIVACY } from "./schema.mjs";

const r = (x, y, width, height) => ({ x, y, width, height });

function member(m) {
  return {
    suppliedViewports: [],
    requiredProjectAdapter: "none",
    applicabilityRequirements: { perceptual: "NOT_APPLICABLE" },
    privacyClassification: PRIVACY.SYNTHETIC,
    project: "sliceui-framework-validation",
    ...m,
  };
}

export function buildInventory() {
  return [
    // The ONE real structured export in the repo. Its fidelity score is PENDING a reference render
    // (no reference implementation exists) — it is a REGRESSION member, not benchmark coverage.
    member({
      id: "mahasiswa-tarif",
      origin: ORIGIN.REAL_STRUCTURED_EXPORT,
      topologyFamilies: ["LINEAR", "REPEATED", "COMPOSITE"],
      sourceInput: "test/fixtures/mahasiswa-tarif/raw.xml",
      suppliedViewports: [1440],
      privacyClassification: PRIVACY.PUBLIC,
      project: "mahasiswa-tarif",
      pendingReferenceRender: true,
      semanticExpectations: ["8-column table", "5 designed-visible rows", "pagination footer 1-5 of 215"],
      topologyExpectations: ["filter row 1:1:1:1", "table = REPEATED"],
      requiredRuntimeStates: ["pagination-visible"],
    }),

    // --- adversarial fixtures (falsification members: the pipeline must PASS good / FAIL bad) ---
    member({
      id: "adv-ratio-good",
      origin: ORIGIN.ADVERSARIAL_FIXTURE,
      topologyFamilies: ["LINEAR"],
      sourceInput: "inline",
      expectedVerdict: "pass",
      selectorTokens: [".a", ".b"], dimensionTokens: ["300"],
      semanticExpectations: ["two equal siblings"],
      topologyExpectations: ["sibling ratio 1:1"],
      requiredRuntimeStates: [],
      intentGraph: { constraints: [{ type: "SIBLING_RATIO", regionId: "r", parentId: "row", childIds: ["a", "b"], axis: "x", value: [1, 1], tolerance: 0.1 }], tables: [], content: [], states: [] },
      evidence: { rects: new Map([["a", r(0, 0, 300, 40)], ["b", r(300, 0, 300, 40)]]) },
    }),
    member({
      id: "adv-ratio-bad",
      origin: ORIGIN.ADVERSARIAL_FIXTURE,
      topologyFamilies: ["LINEAR"],
      sourceInput: "inline",
      expectedVerdict: "fail",
      selectorTokens: [".a", ".b"], dimensionTokens: ["640", "100"],
      semanticExpectations: ["two equal siblings"],
      topologyExpectations: ["sibling ratio 1:1 (defective render is 6.4:1)"],
      requiredRuntimeStates: [],
      intentGraph: { constraints: [{ type: "SIBLING_RATIO", regionId: "r", parentId: "row", childIds: ["a", "b"], axis: "x", value: [1, 1], tolerance: 0.1 }], tables: [], content: [], states: [] },
      evidence: { rects: new Map([["a", r(0, 0, 640, 40)], ["b", r(640, 0, 100, 40)]]) },
    }),
    member({
      id: "adv-content-bad",
      origin: ORIGIN.ADVERSARIAL_FIXTURE,
      topologyFamilies: ["REPEATED"],
      sourceInput: "inline",
      expectedVerdict: "fail",
      copyTextTokens: ["alice", "Mahasiswa Contoh A"],
      semanticExpectations: ["designed row cells exact"],
      topologyExpectations: ["designed-visible rows immutable"],
      requiredRuntimeStates: [],
      intentGraph: {
        constraints: [],
        tables: [{ tableNodeId: "tbl", headers: [{ value: "Nama" }, { value: "NIM" }], designedVisibleRows: [{ cells: [{ value: "alice" }, { value: "123" }] }] }],
        content: [], states: [],
      },
      evidence: { domTexts: ["Nama", "NIM", "BOGUS", "999"] }, // designed rows replaced by synthetic data
    }),
    member({
      id: "adv-anchor-good",
      origin: ORIGIN.ADVERSARIAL_FIXTURE,
      topologyFamilies: ["OVERLAY"],
      sourceInput: "inline",
      expectedVerdict: "pass",
      selectorTokens: [".badge"], dimensionTokens: ["40"],
      semanticExpectations: ["floating badge"],
      topologyExpectations: ["anchor END/START"],
      requiredRuntimeStates: [],
      intentGraph: { constraints: [{ type: "ANCHOR", nodeId: "badge", anchorNodeId: "card", value: { horizontal: "END", vertical: "START" }, tolerance: 2 }], tables: [], content: [], states: [] },
      evidence: { rects: new Map([["card", r(0, 0, 300, 200)], ["badge", r(260, 0, 40, 40)]]) },
    }),

    // --- property-generated (scale/translation invariance) ---
    member({
      id: "prop-ratio-111",
      origin: ORIGIN.PROPERTY_GENERATED,
      topologyFamilies: ["LINEAR"],
      sourceInput: "inline",
      expectedVerdict: "pass",
      dimensionTokens: ["200"],
      semanticExpectations: ["three equal siblings"],
      topologyExpectations: ["sibling ratio 1:1:1"],
      requiredRuntimeStates: [],
      intentGraph: { constraints: [{ type: "SIBLING_RATIO", regionId: "r", parentId: "row", childIds: ["a", "b", "c"], axis: "x", value: [1, 1, 1], tolerance: 0.1 }], tables: [], content: [], states: [] },
      evidence: { rects: new Map([["a", r(0, 0, 200, 40)], ["b", r(200, 0, 200, 40)], ["c", r(400, 0, 200, 40)]]) },
    }),
    member({
      id: "prop-relative-size",
      origin: ORIGIN.PROPERTY_GENERATED,
      topologyFamilies: ["GRID"],
      sourceInput: "inline",
      expectedVerdict: "pass",
      dimensionTokens: ["1000", "500"],
      semanticExpectations: ["a child half its parent"],
      topologyExpectations: ["relative size 0.5 (scale-invariant)"],
      requiredRuntimeStates: [],
      intentGraph: { constraints: [{ type: "RELATIVE_SIZE", childId: "c", parentId: "p", axis: "x", value: 0.5, tolerance: 0.05 }], tables: [], content: [], states: [] },
      evidence: { rects: new Map([["p", r(0, 0, 1000, 500)], ["c", r(0, 0, 500, 250)]]) },
    }),
  ];
}
