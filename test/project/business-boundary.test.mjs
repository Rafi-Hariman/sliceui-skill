// Business-behavior boundary — reject invented routes/services/APIs/modals/workflows/permissions.
import { test } from "node:test";
import assert from "node:assert/strict";
import { checkInventedBusiness, defaultActionHandler, FORBIDDEN_INVENTIONS } from "../../src/project/business-boundary.mjs";

test("boundary: unsupported route/navigation generation is rejected", () => {
  const r = checkInventedBusiness({ html: `<a routerLink="/students">Students</a>` });
  assert.equal(r.violated, true);
  assert.ok(r.findings.some((f) => f.id === "navigation"));
});

test("boundary: an invented HTTP service is rejected", () => {
  const r = checkInventedBusiness({ ts: `this.http.get('/api/students').subscribe(...)` });
  assert.equal(r.violated, true);
  assert.ok(r.findings.some((f) => f.id === "api"));
});

test("boundary: an invented modal target is rejected", () => {
  const r = checkInventedBusiness({ ts: `this.modal.open(EditComponent)` });
  assert.equal(r.violated, true);
  assert.ok(r.findings.some((f) => f.id === "modal"));
});

test("boundary: the safe default handler invents nothing", () => {
  const r = checkInventedBusiness({ html: `<button (click)="onAction()">Go</button>`, ts: defaultActionHandler() });
  assert.equal(r.violated, false);
});

test("boundary: a plain mock component with a TODO handler passes", () => {
  const r = checkInventedBusiness({
    html: `<uii-table [rows]="rows" [columns]="columns"></uii-table>`,
    ts: `export class A { rows = []; columns = []; onAction() { /* TODO: wire action */ } }`,
  });
  assert.equal(r.violated, false);
});

test("boundary: every forbidden category is enumerated in the policy", () => {
  assert.ok(FORBIDDEN_INVENTIONS.length >= 5);
  for (const f of FORBIDDEN_INVENTIONS) assert.ok(f.id && f.label && f.detect);
});
