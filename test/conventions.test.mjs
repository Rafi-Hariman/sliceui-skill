import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { extractConventions, renderConventionsMd, mergeGoldenClasses } from "../src/framework/angular/conventions.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIX = join(HERE, "fixtures", "conventions");
const DEDUP_FIX = join(HERE, "fixtures", "ngdeep-dedup");

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
  // "Menampilkan 1-10 dari 20 data" still sets pagination=true, but the mock-row CAP stays 15
  // (the transcript total no longer raises the count — report §6.5).
  assert.equal(a.mockRowsFloor, 15, "mockRowsFloor is a fixed cap of 15 (not the pagination total)");
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

test("renderConventionsMd: non-Angular emits an honest note, never Angular idiom", () => {
  const md = renderConventionsMd({}, "Vue 3", "vue-sfc");
  // The Angular sections must be absent for a non-Angular framework.
  assert.ok(!md.includes("::ng-deep corpus"), "no ::ng-deep section for Vue");
  assert.ok(!md.includes("translation pipe"), "no | translate note for Vue");
  // The honest note points at the real sources instead.
  assert.ok(md.includes("Angular-shaped"), "explains WHY the profile is empty");
  assert.ok(md.includes("/sliceui-handoff"), "points at the handoff skill for a fuller profile");
  assert.ok(md.includes(":deep()"), "uses the target framework's own term as the example");
});

test("ngDeepCorpus: bare form-control + ngx-select__toggle are reusable", () => {
  const c = extractConventions(FIX, { prefix: "ugw" });
  const fc = c.ngDeepCorpus.find((x) => x.selector === "form-control");
  assert.ok(fc, "bare form-control block captured");
  assert.equal(fc.reusable, true, "bare form-control is reusable (input rounding idiom)");
  const toggle = c.ngDeepCorpus.find((x) => x.selector === "ngx-select__toggle");
  assert.ok(toggle, "bare ngx-select__toggle block captured");
  assert.equal(toggle.reusable, true, "bare ngx-select__toggle is reusable (border idiom)");
});

test("ngDeepCorpus: collapses :hover/:focus variants of ONE identical block into a single idiom", () => {
  const c = extractConventions(DEDUP_FIX, { prefix: "app" });
  const dropdown = c.ngDeepCorpus.filter((x) => x.selector.includes("dropdown-menu > li > a"));
  // The combined `a:hover,\n a:focus { … }` rule must be ONE corpus entry (not two), even though
  // its comma-group head carries two state pseudo-variants. The separate distinct `> a { … }` rule
  // (different body) stays its own entry — so expect exactly two dropdown-menu entries total.
  assert.equal(dropdown.length, 2, `expected 2 dropdown-menu idioms (hover+focus merged + plain a), got ${dropdown.length}: ${JSON.stringify(dropdown.map((d) => d.selector))}`);
  // The merged entry's selector carries BOTH state variants (union), so scssCoverage can match the
  // output regardless of which the agent writes — and the block appears exactly once.
  const merged = dropdown.find((x) => x.selector.includes(":hover") && x.selector.includes(":focus"));
  assert.ok(merged, "the :hover,:focus pair merged into one entry with both selectors");
  const blockCount = (merged.block.match(/background-color:\s*#093697/g) ?? []).length;
  assert.equal(blockCount, 1, "the merged entry carries the block exactly once");
});

test("renderConventionsMd: an identical hover+focus rule renders ONCE (no duplicate .md block)", () => {
  const c = extractConventions(DEDUP_FIX, { prefix: "app" });
  const md = renderConventionsMd({ ngDeepCorpus: c.ngDeepCorpus, classVocabulary: [], componentAnatomy: {}, naming: {} }, "angular");
  const occurrences = (md.match(/background-color:\s*#093697/g) ?? []).length;
  assert.equal(occurrences, 1, `the combined dropdown block must appear exactly once in the .md, got ${occurrences}`);
});

test("mergeGoldenClasses: golden reference classes (mt-4, col-12, p-0) become legal vocabulary", () => {
  const base = [{ name: "control-label", count: 10, family: "control" }];
  const goldenHtml = [`<div class="col-md-4 col-12 search-col mt-4 p-0">
    <button class="btn btn-primary btn-block">Cari</button></div>`];
  const merged = mergeGoldenClasses(base, goldenHtml);
  const names = merged.map((c) => c.name);
  // Golden classes are added (tagged source:golden)…
  for (const expect of ["mt-4", "p-0", "search-col", "btn-block"]) {
    assert.ok(names.includes(expect), `golden class ${expect} must be legal vocabulary`);
  }
  const goldenEntry = merged.find((c) => c.name === "mt-4");
  assert.equal(goldenEntry.source, "golden", "merge must be tagged for traceability");
  // col-12 is TRIVIAL (always legal) so it is not duplicated; col-md-4 is trivial too.
  assert.ok(!names.includes("col-12"), "trivial grid classes are not merged");
  assert.ok(!names.includes("col-md-4"), "trivial grid classes are not merged");
  // Existing vocabulary is preserved and not duplicated.
  assert.ok(names.includes("control-label"), "existing vocabulary preserved");
  assert.equal(merged.filter((c) => c.name === "control-label").length, 1);
});
