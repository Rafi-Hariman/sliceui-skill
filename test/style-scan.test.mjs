import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { scanStyleBehavior } from "../src/lib/style-scan.mjs";

function makeFixture() {
  const dir = mkdtempSync(join(tmpdir(), "sliceui-style-"));
  const src = join(dir, "src", "app");
  mkdirSync(src, { recursive: true });

  // Two components sharing the same ngx-select override (recurring pattern)
  const override = `
:host ::ng-deep .ngx-select__toggle-caret {
  color: #03337b !important;
}
::ng-deep .ngx-select__choices {
  border-radius: 7px;
}
::ng-deep .ngx-select__item_active {
  color: #fff;
  background-color: #428bca;
}
`;
  writeFileSync(join(src, "a.component.scss"), override);
  writeFileSync(join(src, "b.component.scss"), override);
  writeFileSync(join(src, "c.component.scss"), ".plain { color: #428bca; background: #093697; }\n");

  // A template using ngx-select + a module importing ngx-bootstrap
  writeFileSync(join(src, "a.component.html"), '<ngx-select [items]="items"></ngx-select>\n');
  writeFileSync(join(src, "a.component.ts"), 'import { BsModalService } from "ngx-bootstrap/modal";\n');

  return dir;
}

test("captures recurring ::ng-deep patterns with occurrence counts", () => {
  const dir = makeFixture();
  const r = scanStyleBehavior(dir);
  const ngxChoices = r.styling.patterns.find((p) => p.selector.includes("ngx-select__choices"));
  assert.ok(ngxChoices, "ngx-select__choices pattern captured");
  assert.equal(ngxChoices.occurrences, 2, "dedupe across files counts 2");
  const active = r.styling.patterns.find((p) => p.selector.includes("ngx-select__item_active"));
  assert.ok(active, "item_active pattern captured");
  assert.ok(active.declarations.includes("#428bca"), "declarations carry the literal hex");
  rmSync(dir, { recursive: true, force: true });
});

test("captures recurring literal hex colors (not just $vars)", () => {
  const dir = makeFixture();
  const r = scanStyleBehavior(dir);
  const hex = Object.fromEntries(r.styling.recurringColors.map((c) => [c.hex, c.occurrences]));
  assert.ok(hex["#428bca"] >= 2, "#428bca appears 2+ times");
  assert.ok(hex["#093697"] >= 1, "#093697 captured");
  rmSync(dir, { recursive: true, force: true });
});

test("detects libraries actually used (ngx-select + ngx-bootstrap), not primeng", () => {
  const dir = makeFixture();
  const r = scanStyleBehavior(dir);
  assert.ok(r.libraries.inUse.includes("ngx-select-ex"), "ngx-select-ex in use");
  assert.ok(r.libraries.inUse.includes("ngx-bootstrap"), "ngx-bootstrap in use");
  assert.ok(!r.libraries.inUse.includes("primeng"), "primeng NOT a false positive");
  rmSync(dir, { recursive: true, force: true });
});
