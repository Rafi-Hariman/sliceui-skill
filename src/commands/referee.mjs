// sliceui referee — validate every ground-truth artifact against the two sources of truth
// (XML + codebase). Prints a red list (fail/stale) that is the corruption map. Exit 0 = all pass.

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { refereeArtifacts, readRawXmlFromSliceui } from "../lib/referee.mjs";

export function main(argv) {
  const root = argv[0] ? resolve(argv[0]) : process.cwd();
  const sliceuiDir = join(root, ".sliceui");
  const ctxPath = join(sliceuiDir, "project-context.json");
  if (!existsSync(ctxPath)) {
    console.error(`no ${ctxPath} — run \`sliceui init\` first.`);
    return 2;
  }
  const ctx = JSON.parse(readFileSync(ctxPath, "utf8"));
  const { xml, name } = readRawXmlFromSliceui(root);
  const transcript = readTranscript(root);

  // The project root lives in ctx.cwd (project-context was generated there); .sliceui may be
  // in a different working dir. codebase-evidence must scan the REAL project source tree.
  const codebaseRoot = ctx.cwd && existsSync(ctx.cwd) ? ctx.cwd : root;

  const r = refereeArtifacts(codebaseRoot, ctx, xml, name, transcript);

  console.log("SliceUI referee — ground-truth validation (XML + codebase)\n");
  for (const f of r.findings) {
    const icon = f.status === "pass" ? "✓" : f.status === "fail" ? "✗" : f.status === "stale" ? "△" : "·";
    const label = f.status === "stale" ? "STALE" : f.status.toUpperCase();
    console.log(`  ${icon} [${f.head}] ${label}  ${f.artifact}`);
    console.log(`       ${f.detail}${f.evidencePath ? `  (${f.evidencePath})` : ""}`);
  }
  console.log(`\n${r.redCount} red (fail/stale) · ${r.findings.length} checks`);

  return r.pass ? 0 : 1;
}

function readTranscript(root) {
  const tdir = join(root, ".sliceui", "transcript");
  if (!existsSync(tdir)) return null;
  const json = readdirSync(tdir).find((f) => f.endsWith(".transcript.json") && !f.endsWith(".meta.json"));
  if (!json) return null;
  try { return JSON.parse(readFileSync(join(tdir, json), "utf8")); } catch { return null; }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(main(process.argv.slice(2)) ?? 0);
}
