// sliceui referee — validate every ground-truth artifact against the two sources of truth
// (XML + codebase). Prints a red list (fail/stale) that is the corruption map. Exit 0 = all pass.

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { refereeArtifacts, readRawXmlFromSliceui } from "../lib/referee.mjs";

export function main(argv) {
  // Parse --target <name> (the slice target component basename) from argv; rest = positional root.
  let target = null;
  const pos = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--target" && argv[i + 1]) { target = argv[++i]; }
    else pos.push(argv[i]);
  }
  const root = pos[0] ? resolve(pos[0]) : process.cwd();
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

  const r = refereeArtifacts(codebaseRoot, ctx, xml, name, transcript, target);

  console.log("SliceUI referee — ground-truth validation (XML + codebase)\n");
  for (const f of r.findings) {
    const icon = f.status === "pass" ? "✓" : f.status === "fail" ? "✗" : f.status === "stale" ? "△" : "·";
    const label = f.status === "stale" ? "STALE" : f.status.toUpperCase();
    const mode = f.mode ? `  [mode: ${f.mode}]` : "";
    const tag = (f.status === "fail" || f.status === "stale")
      ? (f.blocking ? "  [BLOCKING]" : "  [repo-preexisting]")
      : "";
    console.log(`  ${icon} [${f.head}] ${label}  ${f.artifact}${mode}${tag}`);
    console.log(`       ${f.detail}${f.evidencePath ? `  (${f.evidencePath})` : ""}`);
  }
  console.log(`\n${r.blockingRedCount} slice-blocking red · ${r.redCount} red total · ${r.findings.length} checks`);
  if (r.redCount > r.blockingRedCount) {
    console.log("ℹ non-blocking reds are pre-existing repo debt (duplicate selectors, stale conventions) — reported, not slice blockers.");
  }

  // Exit non-zero ONLY on slice-blocking reds (F12). Repo-preexisting reds do not block the slice.
  return r.pass ? 0 : 1;
}

function readTranscript(root) {
  const adir = join(root, ".sliceui", "artifacts");
  if (!existsSync(adir)) return null;
  const design = readdirSync(adir).find((d) => existsSync(join(adir, d, "transcript.json")));
  if (!design) return null;
  try { return JSON.parse(readFileSync(join(adir, design, "transcript.json"), "utf8")); } catch { return null; }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(main(process.argv.slice(2)) ?? 0);
}
