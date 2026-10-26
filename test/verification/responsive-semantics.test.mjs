// responsive semantics + adapter maturity — DESIGN_VERIFIED vs RESPONSIVE_INFERRED, and the gate
// that an unavailable private adapter can never yield project-real PASS / L5-L6 / release-ready.
import { test } from "node:test";
import assert from "node:assert/strict";
import { verifyResponsiveSafety, responsiveFidelityImpact, RESPONSIVE_SEMANTICS } from "../../src/verification/responsive.mjs";
import { adapterMaturity, releaseReadiness } from "../../src/verification/applicability.mjs";

const check = { tolerance: 1, designViewports: [1200] };

test("responsive semantics: a supplied width is DESIGN_VERIFIED; an unsupplied width is RESPONSIVE_INFERRED", () => {
  const v = verifyResponsiveSafety(check, { widths: [{ width: 1200, pageOverflow: 0 }, { width: 480, pageOverflow: 0 }] });
  assert.equal(v.semanticsPerWidth.find((w) => w.width === 1200).semantics, RESPONSIVE_SEMANTICS.DESIGN_VERIFIED);
  assert.equal(v.semanticsPerWidth.find((w) => w.width === 480).semantics, RESPONSIVE_SEMANTICS.RESPONSIVE_INFERRED);
  assert.equal(v.status, "pass");
});

test("responsive semantics: an inferred-width PASS adds NO design-fidelity coverage", () => {
  const v = verifyResponsiveSafety({ tolerance: 1, designViewports: [] }, { widths: [{ width: 480, pageOverflow: 0 }, { width: 320, pageOverflow: 0 }] });
  assert.equal(v.status, "pass", "safety passes");
  const impact = responsiveFidelityImpact(v);
  assert.equal(impact.designVerifiedWidths, 0);
  assert.equal(impact.inferredWidths, 2);
  assert.equal(impact.designFidelityContribution, 0, "an inferred PASS must NOT upgrade design fidelity as if a mobile design were supplied");
});

test("adapter maturity: a representative fixture proves mechanics, never production maturity", () => {
  const m = adapterMaturity({ representativeProven: true, productionMounted: false });
  assert.equal(m.representativeAngularFixture, "mechanics-proven");
  assert.equal(m.actualBillPilarTarget, "GATED/UNAVAILABLE");
});

test("adapter maturity: an unavailable REQUIRED private adapter cannot produce PASS/L5-L6/release-ready", () => {
  const r = releaseReadiness({ privateMountAvailable: false, projectRealPass: true, familyMean: 100 });
  assert.equal(r.projectRealPass, false, "gated → no project-real PASS even with perfect scores");
  assert.equal(r.familyMaturity, "GATED", "gated → not L5/L6");
  assert.equal(r.releaseReady, false);
});

test("adapter maturity: with the mount available and passing, L6/release are reachable", () => {
  const r = releaseReadiness({ privateMountAvailable: true, projectRealPass: true, familyMean: 95 });
  assert.equal(r.projectRealPass, true);
  assert.equal(r.familyMaturity, "L6");
  assert.equal(r.releaseReady, true);
});
