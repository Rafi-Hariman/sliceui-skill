import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { extractStyleTokens } from "../src/lib/style-tokens.mjs";

function makeProject() {
  const dir = mkdtempSync(join(tmpdir(), "sliceui-tokens-"));
  const styles = join(dir, "src", "styles");
  mkdirSync(styles, { recursive: true });
  writeFileSync(join(dir, "src", "styles.scss"), `@import "./styles/_tokens";\n@import "./styles/_variables";\n`);
  writeFileSync(join(styles, "_tokens.scss"), `$primary: #22c55e;\n$radius: 8px;\n$gap: 1.5rem;\n$derived: $primary;\n$calc: calc(100% - 10px);\n:root {\n  --color-bg: #0f172a;\n  --space: var(--gap);\n}\n@mixin center {\n  display: flex;\n}\n`);
  writeFileSync(join(styles, "_variables.scss"), `$accent: #0ea5e9;\n`);
  return dir;
}

test("extracts SCSS variables with literal values", () => {
  const dir = makeProject();
  const t = extractStyleTokens(dir, ["src/styles.scss"]);
  rmSync(dir, { recursive: true, force: true });
  assert.ok(t.scss.some((x) => x.name === "$primary" && x.value === "#22c55e"), "$primary hex");
  assert.ok(t.scss.some((x) => x.name === "$radius" && x.value === "8px"), "$radius px");
  assert.ok(t.scss.some((x) => x.name === "$gap" && x.value === "1.5rem"), "$gap rem");
  assert.ok(t.scss.some((x) => x.name === "$accent"), "partial _variables.scss merged");
});

test("reference values (another var / calc) become value:null", () => {
  const dir = makeProject();
  const t = extractStyleTokens(dir, ["src/styles.scss"]);
  rmSync(dir, { recursive: true, force: true });
  const derived = t.scss.find((x) => x.name === "$derived");
  const calc = t.scss.find((x) => x.name === "$calc");
  assert.equal(derived.value, null, "$derived is a reference → null");
  assert.equal(calc.value, null, "$calc is a calc() → null");
});

test("extracts CSS custom props and mixins", () => {
  const dir = makeProject();
  const t = extractStyleTokens(dir, ["src/styles.scss"]);
  rmSync(dir, { recursive: true, force: true });
  assert.ok(t.cssProps.some((x) => x.name === "--color-bg" && x.value === "#0f172a"), "--color-bg hex");
  assert.equal(t.cssProps.find((x) => x.name === "--space").value, null, "--space references var() → null");
  assert.ok(t.mixins.includes("center"), "@mixin center captured");
});

test("skips node_modules style paths (design-system stylesheets)", () => {
  const dir = makeProject();
  const t = extractStyleTokens(dir, ["src/styles.scss", "./node_modules/pilar/assets/stylesheets/styles.scss"]);
  rmSync(dir, { recursive: true, force: true });
  assert.ok(!t.scss.some((x) => x.name.startsWith("$pilar")), "no tokens mined from node_modules");
});
