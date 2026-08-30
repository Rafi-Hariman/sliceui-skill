import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { extractConventions } from "../src/lib/conventions.mjs";

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

  assert.equal(a.well, true, "well panel detected");
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
