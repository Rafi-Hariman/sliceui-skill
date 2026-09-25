import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { readFileSync, existsSync, statSync } from "node:fs";
import { detectProject, writeContextSectionFiles } from "../src/commands/detect.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIX = join(HERE, "fixtures");

test("context section files: written, readable-sized, and INDEX names the write target", async () => {
  const ctx = await detectProject(join(FIX, "angular13"));
  const outDir = mkdtempSync(join(tmpdir(), "sliceui-ctx-"));
  try {
    writeContextSectionFiles(outDir, ctx);

    for (const name of ["INDEX.md", "capabilities.md", "design-tokens.md", "samples.md"]) {
      const p = join(outDir, "context", name);
      assert.ok(existsSync(p), `${name} written`);
      assert.ok(statSync(p).size < 256 * 1024, `${name} under the 256 KB Read cap`);
    }
    const index = readFileSync(join(outDir, "context", "INDEX.md"), "utf8");
    assert.match(index, /componentDir: `src\/app`/, "INDEX names the componentDir write target");
    assert.match(index, /Angular/, "INDEX names the framework");
    assert.match(index, /project-context\.json/, "INDEX points back at the machine contract");
  } finally {
    rmSync(outDir, { recursive: true, force: true });
  }
});

test("context section files: project-context.json stays the complete machine contract", async () => {
  // The split is ADDITIVE — referee/verify/init/transcribe read the root file; it must keep
  // every key the programmatic consumers touch.
  const ctx = await detectProject(join(FIX, "angular13"));
  assert.ok(ctx.conventions, "conventions present");
  assert.ok(Array.isArray(ctx.sampleComponents), "sampleComponents present");
  assert.ok(ctx.loadedClassRegistry, "loadedClassRegistry present");
  assert.ok(ctx.capabilities, "capabilities present");
});
