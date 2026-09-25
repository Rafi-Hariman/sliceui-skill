// sliceui referee — validate ground-truth artifacts against the sources of truth (XML + codebase).
// Prints a red list (fail/stale) that is the corruption map. Exit 0 = all pass.
//
// PR 3 cold/hot split:
//   default (`referee --target <name>`)  = SNAPSHOT mode — reads the stored codebase-evidence
//                                          verdict + bounded target/design checks. No repository scan.
//   `--deep`                             = live full repository scan (legacy behavior), and
//                                          writes/refreshes the stored verdict.

import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  refereeArtifacts,
  refereeHot,
  codebaseEvidenceFindings,
  readRawXmlFromSliceui,
} from "../lib/referee.mjs";
import { assessRefereeVerdict, buildRefereeVerdict, REFEREE_VERDICT_FILE } from "../lib/referee-verdict.mjs";

export function main(argv) {
  // Parse --target <name> and --deep; rest = positional root.
  let target = null;
  let deep = false;
  const pos = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--target" && argv[i + 1]) { target = argv[++i]; }
    else if (argv[i] === "--deep") { deep = true; }
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
  // in a different working dir. codebase-evidence (deep only) must scan the REAL project source tree.
  const codebaseRoot = ctx.cwd && existsSync(ctx.cwd) ? ctx.cwd : root;

  if (deep) {
    return runDeep(codebaseRoot, ctx, xml, name, transcript, target);
  }
  return runHot(root, ctx, xml, name, transcript, target);
}

/** SNAPSHOT mode: stored verdict + bounded live checks. Never scans the repository. */
function runHot(root, ctx, xml, name, transcript, target) {
  const assessment = assessRefereeVerdict(root, ctx);
  console.log("SliceUI referee — ground-truth validation (XML + codebase)\n");
  console.log(`  Referee mode          : snapshot`);
  console.log(`  Codebase scan         : skipped`);
  console.log(`  Stored verdict        : ${assessment.state}`);

  if (assessment.state === "missing" || assessment.state === "invalid" || assessment.state === "stale") {
    console.log(`\n⚠ ${assessment.diagnostics.join("\n")}`);
    console.log("\nNOT VERIFIABLE — codebase evidence unavailable. No repository scan was performed.");
    return 1; // non-green, non-zero, no silent scan (no pass-by-absence)
  }

  // fresh-pass or fresh-fail: surface the stored codebase findings + run bounded live checks.
  const r = refereeHot(assessment.verdict, ctx, xml, name, transcript, target);
  printFindings(r);
  return r.pass ? 0 : 1;
}

/** DEEP mode: live full repository scan (legacy behavior) + write the stored verdict. */
function runDeep(codebaseRoot, ctx, xml, name, transcript, target) {
  console.log("SliceUI referee — ground-truth validation (XML + codebase)\n");
  console.log(`  Referee mode          : deep`);
  console.log(`  Codebase scan         : enabled`);

  const r = refereeArtifacts(codebaseRoot, ctx, xml, name, transcript, target);
  printFindings(r);

  // Persist the codebase-evidence verdict so subsequent hot runs skip the scan.
  const conv = readConventions(codebaseRoot);
  const codebase = codebaseEvidenceFindings(codebaseRoot, conv, ctx);
  const verdict = buildRefereeVerdict({ ctx, codebaseFindings: codebase.findings, evidence: codebase.evidence });
  try {
    writeFileSync(join(codebaseRoot, ".sliceui", REFEREE_VERDICT_FILE), JSON.stringify(verdict, null, 2) + "\n");
    console.log(`\nStored verdict          : written (${codebase.evidence.filesConsidered} files, ${codebase.evidence.selectorsChecked} selectors)`);
  } catch (err) {
    console.log(`\nStored verdict          : NOT written (${err?.message ?? err})`);
  }

  return r.pass ? 0 : 1;
}

function printFindings(r) {
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
}

function readConventions(root) {
  try { return JSON.parse(readFileSync(join(root, ".sliceui", "conventions.json"), "utf8")); } catch { return {}; }
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
