// verification/verify — the orchestrator: run the compiled VerificationPlan against measured DOM
// evidence (geometry rects, computed styles, visible text, runtime state). Pure — the evidence is
// supplied by the caller (a browser collector or synthetic fixtures); this module never launches a
// browser and never reads the filesystem.

import { compileVerificationPlan } from "./plan.mjs";
import { verifyRelationship } from "./relationship.mjs";
import { verifyExactText, verifyTableContent } from "./content.mjs";
import { verifyRuntime } from "./runtime.mjs";
import { verifyStyle } from "./style.mjs";
import { verifyResponsiveSafety, responsiveFidelityImpact } from "./responsive.mjs";
import { correctiveFeedback } from "./feedback.mjs";

/**
 * @param {object} opts
 * @param {object} opts.intentGraph
 * @param {Map<string,{x,y,width,height}>} [opts.rects]
 * @param {Map<string,object>} [opts.computedStyles]
 * @param {string[]} [opts.domTexts]
 * @param {object} [opts.domState]
 * @param {Array} [opts.styleChecks] — extra style checks ({nodeId, property, expected, node})
 * @returns {{ state, checks, summary }}
 */
export function verifyIntent({ intentGraph, rects = new Map(), computedStyles = new Map(), domTexts = [], domState = {}, styleChecks = [] }) {
  const plan = compileVerificationPlan(intentGraph);
  const checks = [];

  for (const c of plan.relationship) {
    const r = verifyRelationship(c, rects);
    checks.push({ category: "relationship", family: c.category, id: c.id, ...r, ...(r.status !== "pass" ? { feedback: correctiveFeedback(c, r) } : {}) });
  }
  for (const c of plan.semantic) {
    const r = c.category === "table-content" ? verifyTableContent(c, domTexts) : verifyExactText(c, domTexts);
    checks.push({ category: "content", family: c.category, id: c.id, ...r, ...(r.status !== "pass" ? { feedback: correctiveFeedback(c, r) } : {}) });
  }
  for (const c of plan.runtime) {
    const r = verifyRuntime(c, domState);
    checks.push({ category: "runtime", family: c.category, id: c.id, ...r, ...(r.status !== "pass" ? { feedback: correctiveFeedback(c, r) } : {}) });
  }
  for (const c of plan.responsive) {
    const r = verifyResponsiveSafety(c, domState);
    checks.push({ category: "responsive", family: c.category, id: c.id, ...r, ...(r.status !== "pass" ? { feedback: correctiveFeedback(c, r) } : {}) });
  }
  for (const c of styleChecks) {
    const r = verifyStyle(c, computedStyles);
    checks.push({ category: "style", family: c.property, id: c.id ?? `SUI-STYLE-${c.property}`, ...r, ...(r.status !== "pass" ? { feedback: correctiveFeedback(c, r) } : {}) });
  }

  const fails = checks.filter((c) => c.status === "fail");
  const unverifiable = checks.filter((c) => c.status === "unverifiable" || c.status === "unresolved");
  const pass = checks.filter((c) => c.status === "pass");
  const responsive = checks.find((c) => c.category === "responsive");
  return {
    state: fails.length ? "fail" : checks.length ? (unverifiable.length && !pass.length ? "unverifiable" : "pass") : "unverifiable",
    checks,
    summary: {
      total: checks.length, pass: pass.length, fail: fails.length, unverifiable: unverifiable.length,
    },
    // Responsive safety is reported SEPARATELY from design fidelity: an inferred-width PASS never
    // adds design-fidelity coverage (no mobile design was supplied).
    responsiveFidelity: responsive ? responsiveFidelityImpact(responsive) : null,
  };
}
