import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { extractConventions, renderConventionsMd } from "../src/framework/vue-sfc/conventions.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIX = join(HERE, "fixtures", "vue-tailwind");

test("extractConventions (Vue): :deep() corpus + SFC anatomy, Tailwind skips class vocabulary", () => {
  const c = extractConventions(FIX);
  assert.deepEqual(c.deepCorpus.map((x) => x.selector), [".inner"], "one :deep target");
  assert.equal(c.deepCorpus[0].reusable, false, ".inner is project-specific");
  assert.equal(c.componentAnatomy.scriptSetup, true);
  assert.equal(c.componentAnatomy.styleScoped, true);
  assert.equal(c.componentAnatomy.tailwind, true);
  assert.deepEqual(c.classVocabulary, [], "Tailwind utilities are not a vocabulary");
});

test("extractConventions (Vue): reusable = library-internal deep selector", () => {
  const c = extractConventions(join(HERE, "fixtures", "vue-el"));
  const sel = c.deepCorpus.map((x) => x.selector);
  assert.ok(sel.includes(".el-input__wrapper"), "library internal captured");
  const el = c.deepCorpus.find((x) => x.selector === ".el-input__wrapper");
  assert.equal(el.reusable, true, ".el-* is a reusable library idiom");
  const inner = c.deepCorpus.find((x) => x.selector === ".inner");
  assert.equal(inner.reusable, false, ".inner stays component-specific");
});

test("renderConventionsMd (Vue): Vue-native, never Angular idiom", () => {
  const md = renderConventionsMd({
    classVocabulary: [],
    deepCorpus: [{ selector: ".el-input__wrapper", block: ":deep(.el-input__wrapper) { border-radius: 6px; }", source: "a.vue", reusable: true }],
    componentAnatomy: { scriptSetup: true, styleScoped: true, styleLang: "scss", tailwind: false, tableTag: "el-table", pagination: true },
    naming: { componentCase: "PascalCase", eventNaming: '@event="handler" — dominant handler: "onSearch" (3×)' },
  }, "Vue 3");
  assert.ok(md.includes(":deep() corpus"), "has :deep() section");
  assert.ok(md.includes(".el-input__wrapper"), "corpus block inlined");
  assert.ok(!md.includes("::ng-deep"), "never emits ::ng-deep");
  assert.ok(!md.includes("translation pipe"), "no Angular | translate note");
  assert.ok(!md.includes("inject()"), "no Angular DI note");
  assert.ok(md.includes("<script setup"), "documents script setup");
  assert.ok(md.includes("NO i18n wrapper"), "has the literal-text invariant");
});
