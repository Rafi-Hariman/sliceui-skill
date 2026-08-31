import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { extractConventions, renderConventionsMd } from "../src/lib/conventions.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIX = join(HERE, "fixtures", "conventions");

test("classVocabulary: counts + families, skips grid noise", () => {
  const c = extractConventions(FIX, { prefix: "ugw" });
  const names = c.classVocabulary.map((x) => x.name);

  // Reusable classes captured.
  assert.ok(names.includes("label-custom-success"), "label-custom-success present");
  assert.ok(names.includes("label-custom-warning"), "label-custom-warning present");
  assert.ok(names.includes("well"), "well present");
  assert.ok(names.includes("control-label"), "control-label present");

  // Families detected.
  const success = c.classVocabulary.find((x) => x.name === "label-custom-success");
  assert.equal(success.family, "label-custom", "family grouped under label-custom");
  assert.equal(success.hint, "status/field label", "hint for label classes");

  // Grid/layout noise skipped.
  assert.ok(!names.includes("row"), "no grid `row` in vocabulary");
});

test("ngDeepCorpus: merges ALL ::ng-deep blocks across files", () => {
  const c = extractConventions(FIX, { prefix: "ugw" });
  const sels = c.ngDeepCorpus.map((x) => x.selector);

  assert.ok(sels.some((s) => s.includes("ngx-select__choices")), "ngx-select__choices in corpus");
  assert.ok(sels.some((s) => s.includes("ngx-select__item_active")), "ngx-select__item_active in corpus");
  assert.ok(sels.some((s) => s.includes("label-custom-success")), "label-custom-success in corpus");
  assert.ok(sels.some((s) => s.includes("label-custom-warning")), "label-custom-warning in corpus");

  // Each corpus entry carries a verbatim block + source path.
  const choices = c.ngDeepCorpus.find((x) => x.selector.includes("ngx-select__choices"));
  assert.ok(choices.block.includes("border-radius: 7px"), "block carries full body");
  assert.ok(choices.source.includes("sample.component.scss"), "source path recorded");
});

test("componentAnatomy: well + skeleton + table + pagination floor", () => {
  const c = extractConventions(FIX, { prefix: "ugw" });
  const a = c.componentAnatomy;

  assert.equal(a.wellAvailable, true, "well idiom available (NOT a structural instruction)");
  assert.equal(a.tableTag, "uii-table", "table tag detected");
  assert.equal(a.skeletonTag, "uii-table-skeleton", "skeleton tag detected");
  assert.equal(a.pagination, true, "pagination text detected");
  // "Menampilkan 1-10 dari 20 data" → floor max(15, 20) = 20.
  assert.equal(a.mockRowsFloor, 20, "mockRowsFloor derived from pagination total (20)");
});

test("naming: prefix + dominant event handler", () => {
  const c = extractConventions(FIX, { prefix: "ugw" });
  assert.equal(c.naming.prefix, "ugw");
  assert.ok(/on\w+\(\$event\)/.test(c.naming.eventNaming), "event naming pattern reported");
});

test("graceful on empty project (no files)", () => {
  const c = extractConventions(join(FIX, "does-not-exist"), { prefix: null });
  assert.deepEqual(c.classVocabulary, []);
  assert.deepEqual(c.ngDeepCorpus, []);
  assert.equal(c.componentAnatomy.mockRowsFloor, 15, "default floor 15");
  assert.equal(c.naming.prefix, null);
});

test("ngDeepCorpus: flags reusable vs component-specific blocks", () => {
  const c = extractConventions(FIX, { prefix: "ugw" });

  // Reusable library-internal idiom.
  const choices = c.ngDeepCorpus.find((x) => x.selector.includes("ngx-select__choices"));
  assert.equal(choices.reusable, true, "ngx-select__choices is reusable");

  // Component-specific: ngx-select inside a table cell (border:none) is NOT reusable.
  const cellSelect = c.ngDeepCorpus.find((x) => x.selector.includes("ngx-select .form-control"));
  assert.ok(cellSelect, "ngx-select .form-control block is captured");
  assert.equal(cellSelect.reusable, false, "ngx-select .form-control is component-specific");
});

test("ngDeepCorpus: dedups by majority, not first-wins", () => {
  const c = extractConventions(FIX, { prefix: "ugw" });
  const pagination = c.ngDeepCorpus.find((x) => x.selector.includes("page-box"));
  assert.ok(pagination, "pagination page-box block present");
  // The correct variant (border-style first) appears in 2 files vs 1 buggy file.
  const idxStyle = pagination.block.indexOf("border-style");
  const idxBottom = pagination.block.indexOf("border-bottom");
  assert.ok(idxStyle < idxBottom, "majority variant orders border-style before border-bottom");
});

test("renderConventionsMd: splits reusable vs component-specific", () => {
  const md = renderConventionsMd({
    ngDeepCorpus: [
      { selector: "ngx-select__choices", block: "::ng-deep .ngx-select__choices { border-radius: 7px; }", source: "a.component.scss", family: "select", reusable: true },
      { selector: "ngx-select .form-control", block: "::ng-deep .ngx-select .form-control { border: none; }", source: "installment-spreadsheet.component.scss", family: "select", reusable: false },
    ],
    classVocabulary: [],
    componentAnatomy: {},
    naming: {},
  });

  assert.ok(md.includes("Reusable (copy when the capability is in play)"), "reusable section present");
  assert.ok(md.includes("Component-specific (skip unless your slice matches this exact context)"), "specific section present");
  // The component-specific block is annotated with its source so the agent can judge context.
  assert.ok(md.includes("installment-spreadsheet.component.scss"), "specific block annotated with source");
});
