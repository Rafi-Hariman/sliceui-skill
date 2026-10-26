// semantic-style — semantic target mapping (foreground/background/border/icon/state/inherited).
import { test } from "node:test";
import assert from "node:assert/strict";
import { semanticTargetFor, isComparable, computedPropertyFor, SEMANTIC_TARGET } from "../../src/verification/semantic-style.mjs";

test("semantic-style: foreground text color ≠ background ≠ border ≠ icon fill", () => {
  const text = semanticTargetFor({ role: "TEXT" }, "color");
  const bg = semanticTargetFor({ role: "CONTAINER" }, "background-color");
  const border = semanticTargetFor({ role: "CONTAINER" }, "border-color");
  const icon = semanticTargetFor({ role: "ICON" }, "color");
  assert.equal(text, SEMANTIC_TARGET.FOREGROUND);
  assert.equal(bg, SEMANTIC_TARGET.BACKGROUND);
  assert.equal(border, SEMANTIC_TARGET.BORDER);
  assert.equal(icon, SEMANTIC_TARGET.ICON);
  assert.equal(isComparable(text, bg), false, "foreground never compared to background");
  assert.equal(isComparable(text, border), false);
});

test("semantic-style: a state selector maps to STATE, not foreground", () => {
  const s = semanticTargetFor({ role: "TEXT", selector: ".x:focus" }, "color");
  assert.equal(s, SEMANTIC_TARGET.STATE);
});

test("semantic-style: a placeholder maps distinctly", () => {
  const p = semanticTargetFor({ role: "TEXT", sourceName: "placeholder" }, "color");
  assert.equal(p, SEMANTIC_TARGET.PLACEHOLDER);
});

test("semantic-style: an unresolvable property returns null (never fabricated)", () => {
  assert.equal(semanticTargetFor({ role: "CONTAINER" }, "transform"), null);
});

test("semantic-style: computedPropertyFor maps each target to its CSS property", () => {
  assert.equal(computedPropertyFor(SEMANTIC_TARGET.FOREGROUND), "color");
  assert.equal(computedPropertyFor(SEMANTIC_TARGET.BACKGROUND), "backgroundColor");
  assert.equal(computedPropertyFor(SEMANTIC_TARGET.BORDER), "borderColor");
});
