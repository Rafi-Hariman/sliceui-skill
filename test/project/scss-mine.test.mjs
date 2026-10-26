// scss-mine — declaration mining + aggregation + evidence classification (unit, inline fixtures).
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mineProjectDeclarations, aggregateObservations, declarationsFromAggregates, declarationsStats,
  normalizeValue, componentIdentity,
} from "../../src/project/scss-mine.mjs";
import { buildProjectKnowledgeGraph } from "../../src/project/knowledge-graph.mjs";

async function mine(files) {
  return mineProjectDeclarations("/x", { files });
}
async function decls(files) {
  const { observations, parseFailures } = await mine(files);
  const { aggregates } = aggregateObservations(observations);
  return { declarations: declarationsFromAggregates(aggregates), parseFailures };
}
const byProp = (ds, sel, prop) => ds.find((d) => d.selector === sel && d.property === prop);

// ---------- parsing fixtures ----------

test("mine: nested selectors are flattened by sass (`.card { .header {…} }` → `.card .header`)", async () => {
  const { declarations } = await decls([{ path: "/x/a.scss", src: ".card { .header { color: #222222; } }" }]);
  const d = declarations.find((x) => x.selector === "card .header");
  assert.ok(d, "the nested selector is flattened to `card .header`");
  assert.equal(d.property, "color");
});

test("mine: ::ng-deep selectors are normalized (prefix + leading dot stripped)", async () => {
  const { declarations } = await decls([{ path: "/x/a.scss", src: ":host ::ng-deep .form-control { border-radius: 6px; }" }]);
  const d = byProp(declarations, "form-control", "border-radius");
  assert.ok(d, "normalized to `form-control`");
});

test("mine: a pseudo-state selector is flagged and classified STATE_STYLE when stable", async () => {
  const { declarations } = await decls([
    { path: "/x/a.scss", src: "::ng-deep .x:hover { color: white; }" },
    { path: "/x/b.scss", src: "::ng-deep .x:hover { color: white; }" },
  ]);
  const d = byProp(declarations, "x:hover", "color");
  assert.equal(d.semantics, "STATE_STYLE");
});

test("mine: media-query context is separated from the base rule", async () => {
  const { declarations } = await decls([
    { path: "/x/a.scss", src: ".search { width: 384px; } @media (max-width: 768px) { .search { width: 260px; } }" },
  ]);
  const base = declarations.find((d) => d.selector === "search" && d.media === null);
  const media = declarations.find((d) => d.selector === "search" && d.media);
  assert.ok(base, "base rule present");
  assert.ok(media, "media rule present");
  assert.match(media.media, /max-width/);
});

// ---------- independent usage counting ----------

test("mine: duplicate declarations in ONE component count as one independent usage", async () => {
  const { declarations } = await decls([
    { path: "/x/a.component.scss", src: "::ng-deep .list-item { padding: 12px; padding: 12px; padding: 12px; }" },
  ]);
  const d = byProp(declarations, "list-item", "padding");
  assert.equal(d.semantics, "UNVERIFIED_SAMPLE", "a single component cannot prove stability");
  assert.equal(d.confidence, 0.35, "no confidence inflation");
});

test("mine: the same declaration across THREE independent components counts as three usages", async () => {
  const { declarations } = await decls([
    { path: "/x/a.component.scss", src: "::ng-deep .list-item { padding: 12px; }" },
    { path: "/x/b.component.scss", src: "::ng-deep .list-item { padding: 12px; }" },
    { path: "/x/c.component.scss", src: "::ng-deep .list-item { padding: 12px; }" },
  ]);
  const d = byProp(declarations, "list-item", "padding");
  assert.equal(d.semantics, "DESIGN_OVERRIDABLE", "3 stable geometry usages promote");
  assert.equal(d.confidence, 0.9);
});

test("mine: copied same-name component in two dirs (hope/slice) dedups to one usage", async () => {
  const { declarations } = await decls([
    { path: "/x/hope/sample-card.component.scss", src: "::ng-deep .card { margin: 8px; }" },
    { path: "/x/slice/sample-card.component.scss", src: "::ng-deep .card { margin: 8px; }" },
  ]);
  const d = byProp(declarations, "card", "margin");
  assert.equal(d.semantics, "UNVERIFIED_SAMPLE", "the copy is not an independent usage");
});

// ---------- classification counterexamples ----------

test("mine: search width 384/301/420 across independent pages → PAGE_SPECIFIC_GEOMETRY", async () => {
  const { declarations } = await decls([
    { path: "/x/search.component.scss", src: "::ng-deep .search-options input { width: 384px; }" },
    { path: "/x/billing.component.scss", src: "::ng-deep .search-options input { width: 301px; }" },
    { path: "/x/archive.component.scss", src: "::ng-deep .search-options input { width: 420px; }" },
  ]);
  const d = byProp(declarations, "search-options input", "width");
  assert.equal(d.semantics, "PAGE_SPECIFIC_GEOMETRY");
  assert.ok(d.values.includes("384px") && d.values.includes("301px") && d.values.includes("420px"), "all three values retained");
});

test("mine: stable focus border color → STATE_STYLE", async () => {
  const { declarations } = await decls([
    { path: "/x/a.scss", src: "::ng-deep .grid-card:focus { border-color: #3e82f3; }" },
    { path: "/x/b.scss", src: "::ng-deep .grid-card:focus { border-color: #3e82f3; }" },
  ]);
  const d = byProp(declarations, "grid-card:focus", "border-color");
  assert.equal(d.semantics, "STATE_STYLE");
});

test("mine: stable dropdown portal z-index → STRUCTURAL_INTERNAL", async () => {
  const { declarations } = await decls([
    { path: "/x/a.scss", src: "::ng-deep .dropdown-menu { z-index: 1000; }" },
    { path: "/x/b.scss", src: "::ng-deep .dropdown-menu { z-index: 1000; }" },
  ]);
  const d = byProp(declarations, "dropdown-menu", "z-index");
  assert.equal(d.semantics, "STRUCTURAL_INTERNAL");
});

test("mine: width:100% on an internal fill wrapper is NOT page-specific", async () => {
  const { declarations } = await decls([{ path: "/x/a.scss", src: "::ng-deep .form-control { width: 100%; }" }]);
  const d = byProp(declarations, "form-control", "width");
  assert.equal(d.semantics, "STRUCTURAL_INTERNAL");
});

test("mine: position:absolute on an overlay is NOT page-specific", async () => {
  const { declarations } = await decls([{ path: "/x/a.scss", src: "::ng-deep .floating-badge { position: absolute; top: 0; right: 0; }" }]);
  assert.equal(byProp(declarations, "floating-badge", "position").semantics, "STRUCTURAL_INTERNAL");
  assert.equal(byProp(declarations, "floating-badge", "top").semantics, "STRUCTURAL_INTERNAL");
  assert.equal(byProp(declarations, "floating-badge", "right").semantics, "STRUCTURAL_INTERNAL");
});

// ---------- normalization ----------

test("normalize: colors, zero-units, decimals canonicalize; units stay distinct", () => {
  assert.equal(normalizeValue("#FFF"), "#ffffff");
  assert.equal(normalizeValue("rgb(255, 0, 0)"), "#ff0000");
  assert.equal(normalizeValue("0px"), "0");
  assert.equal(normalizeValue("4.0px"), "4px");
  assert.equal(normalizeValue("0.50"), "0.5");
  assert.notEqual(normalizeValue("16px"), normalizeValue("1rem"), "px and rem never equated");
  assert.notEqual(normalizeValue("50%"), normalizeValue("50vw"), "% and vw never equated");
});

test("normalize: border-radius 4 identical values collapse to one", () => {
  assert.equal(normalizeValue("0px 5px 5px 0px", "border-radius"), "0 5px 5px 0");
  assert.equal(normalizeValue("4px 4px 4px 4px", "border-radius"), "4px");
});

// ---------- robustness ----------

test("mine: malformed SCSS is recorded as a parse failure, never silently dropped", async () => {
  const { parseFailures, declarations } = await decls([
    { path: "/x/broken.component.scss", src: "::ng-deep .broken { color: #ffffff;" },
    { path: "/x/ok.component.scss", src: "::ng-deep .ok { color: #ffffff; }" },
  ]);
  assert.equal(parseFailures.length, 1, "one parse failure recorded");
  assert.match(parseFailures[0].message || "", /./);
  assert.ok(declarations.length >= 1, "the healthy file still mines");
});

test("mine: deterministic order and knowledge-graph hash", async () => {
  const files = [
    { path: "/x/b.scss", src: "::ng-deep .dropdown-menu { z-index: 1000; }" },
    { path: "/x/a.scss", src: "::ng-deep .form-control { width: 100%; }" },
  ];
  const r1 = await mine(files);
  const r2 = await mine([...files].reverse()); // input order must not matter
  assert.deepEqual(r1.observations.map((o) => o.selector + o.property), r2.observations.map((o) => o.selector + o.property), "sorted deterministically");

  const g1 = buildProjectKnowledgeGraph({ conventions: { declarations: aggregateObservations(r1.observations) }, projectContext: {} });
  const g2 = buildProjectKnowledgeGraph({ conventions: { declarations: aggregateObservations(r2.observations) }, projectContext: {} });
  assert.equal(g1.hash, g2.hash, "knowledge-graph hash is deterministic");
});

test("mine: componentIdentity strips .component.scss and leading underscore", () => {
  assert.equal(componentIdentity("/p/students/students.component.scss"), "students");
  assert.equal(componentIdentity("/p/_tokens.scss"), "tokens");
  assert.equal(componentIdentity("/p/card.component.css"), "card");
});
