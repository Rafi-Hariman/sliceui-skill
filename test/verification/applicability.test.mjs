// applicability — WHICH verification layers apply, and what that does to the denominator.
import { test } from "node:test";
import assert from "node:assert/strict";
import { APPLICABILITY, layerApplicability, perceptualApplicability, blockingDenominator, denominatorSatisfied } from "../../src/verification/applicability.mjs";

test("applicability: FIGML-only → perceptual is NOT_APPLICABLE (no raster oracle)", () => {
  const a = layerApplicability({ sourceKind: "figml", hasReferenceImage: false });
  assert.equal(a.perceptual, APPLICABILITY.NOT_APPLICABLE);
  for (const layer of ["semantic-content", "topology-relationships", "dom-geometry", "computed-style", "runtime-state", "responsive-safety"]) {
    assert.equal(a[layer], APPLICABILITY.REQUIRED, `${layer} is authoritative for FIGML`);
  }
});

test("applicability: a raster design → perceptual REQUIRED; FIGML + reference image → REQUIRED backstop", () => {
  assert.equal(perceptualApplicability({ sourceKind: "screenshot" }), APPLICABILITY.REQUIRED);
  assert.equal(perceptualApplicability({ sourceKind: "png" }), APPLICABILITY.REQUIRED);
  assert.equal(perceptualApplicability({ sourceKind: "figml", hasReferenceImage: true }), APPLICABILITY.REQUIRED);
});

test("applicability: an unknown source → UNAVAILABLE, never silently required", () => {
  assert.equal(perceptualApplicability({ sourceKind: "mystery" }), APPLICABILITY.UNAVAILABLE);
});

test("applicability: NOT_APPLICABLE is REMOVED from the denominator; SKIP/UNVERIFIABLE are not a mechanism", () => {
  const figml = layerApplicability({ sourceKind: "figml" });
  const shot = layerApplicability({ sourceKind: "screenshot" });
  assert.ok(!blockingDenominator(figml).includes("perceptual"), "N/A layer removed from the denominator");
  assert.ok(blockingDenominator(shot).includes("perceptual"), "required layer stays in the denominator");
  // NOT_APPLICABLE is a distinct enum value — not a SKIP verdict and not UNVERIFIABLE.
  for (const other of ["skip", "unverifiable", "optional", "required", "unavailable"]) {
    assert.notEqual(APPLICABILITY.NOT_APPLICABLE, other);
  }
});

test("applicability: a gated private mount makes project-real UNAVAILABLE (in the denominator, unproven)", () => {
  const a = layerApplicability({ sourceKind: "figml", privateMountAvailable: false });
  assert.equal(a["project-real"], APPLICABILITY.UNAVAILABLE);
  assert.ok(blockingDenominator(a).includes("project-real"), "unavailable ≠ removed");
  // A layer that applies but could not run must never satisfy the denominator as a pass.
  assert.equal(denominatorSatisfied(["project-real"], { "project-real": "unavailable" }), false);
  assert.equal(denominatorSatisfied(["project-real"], { "project-real": "unverifiable" }), true, "an explicit unproven verdict is honest");
});
