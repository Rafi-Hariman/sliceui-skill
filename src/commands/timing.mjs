// sliceui timing — print the per-stage timing summary from .sliceui/runs.jsonl.
// Answers "where did the minutes go?" for a slice: per-command totals, the generate gap
// (last resolve → first verify = the LLM's own work), and the verify retry count.

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { aggregateRuns } from "../lib/timing.mjs";

function fmtMs(ms) {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function main() {
  const root = process.cwd();
  const runsPath = join(root, ".sliceui", "runs.jsonl");
  if (!existsSync(runsPath)) {
    console.log("No .sliceui/runs.jsonl yet — run a slice first (transcribe → resolve → verify).");
    return 0;
  }
  const { stages, generateGapMs, verifyRetries } = aggregateRuns(readFileSync(runsPath, "utf8"));

  console.log("SliceUI timing — per-stage wall-clock (from .sliceui/runs.jsonl)\n");
  if (!stages.length) {
    console.log("(empty log — no recorded runs)");
  }
  for (const s of stages) {
    const retry = s.cmd === "verify" && s.count > 1 ? `  ×${s.count} (${verifyRetries} retr${verifyRetries === 1 ? "y" : "ies"})` : "";
    console.log(`  ${s.cmd.padEnd(12)} ${fmtMs(s.totalMs).padStart(8)}  (${s.count}×)${retry}`);
  }
  if (generateGapMs != null) {
    console.log(`\n  generate gap  ${fmtMs(generateGapMs).padStart(8)}  (last resolve → first verify — the LLM's own work)`);
    if (generateGapMs > 120000) {
      console.log("  ⚠ generate is the floor — run `sliceui spec` to collapse 3 passes into one.");
    }
  }
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(main() ?? 0);
}
