// fs-trace — the repository-access counter behind --profile / --json-report (P0-1 / §7).
// Asserts the plan's guard invariant: reads inside the allowlist don't count as "repo reads";
// reads outside it do. The counter must count, never throw (a hard guard would break the
// escape-hatch reads).

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { allowRoot, tracedReadFileSync, tracedGlob, traceSummary, resetTrace } from "../src/lib/fs-trace.mjs";

test("fs-trace: counts reads and separates allowlisted from repo reads", () => {
  resetTrace();
  const root = mkdtempSync(join(tmpdir(), "sliceui-trace-"));
  try {
    const sliceui = join(root, ".sliceui");
    mkdirSync(sliceui, { recursive: true });
    writeFileSync(join(sliceui, "conventions.json"), "{}");
    writeFileSync(join(root, "outside.ts"), "export const x = 1;\n");
    allowRoot(sliceui);

    tracedReadFileSync(join(sliceui, "conventions.json"), "utf8"); // allowlisted
    tracedReadFileSync(join(root, "outside.ts"), "utf8");          // repo read

    const s = traceSummary();
    assert.equal(s.fileReads, 2, "two reads counted");
    assert.equal(s.repoReads, 1, "the read outside .sliceui/ counts as a repo read");
    assert.ok(s.bytesRead > 0, "bytes counted");
  } finally {
    rmSync(root, { recursive: true, force: true });
    resetTrace();
  }
});

test("fs-trace: glob is counted and never throws on a real glob", () => {
  resetTrace();
  const root = mkdtempSync(join(tmpdir(), "sliceui-trace-"));
  try {
    writeFileSync(join(root, "a.ts"), "");
    const files = tracedGlob(["*.ts"], { cwd: root });
    assert.equal(files.length, 1, "glob resolves");
    assert.equal(traceSummary().globs, 1, "glob counted");
  } finally {
    rmSync(root, { recursive: true, force: true });
    resetTrace();
  }
});
