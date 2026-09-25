// timing — per-stage instrumentation so a slice can answer "where did the minutes go?"
// The CLI stages are instant; the slow parts are the agent's generate pass (the gap between
// the last `resolve` and the first `verify`) and the verify-retry loop. A single command can't
// see either — only a log of every command with timestamps can. `sliceui timing` aggregates it.
//
// Log shape: one JSON line per command run in `.sliceui/runs.jsonl`:
//   {"ts": 1726000000000, "cmd": "resolve", "args": ["x.xml"], "elapsedMs": 210, "exit": 0}

import { appendFileSync, existsSync } from "node:fs";
import { join } from "node:path";

/** Commands we do NOT log — they run before `.sliceui/` exists, or are infra, not a slice stage. */
export const UNTIMED_COMMANDS = new Set(["install", "uninstall", "update", "doctor", "timing", "help"]);

/** Append one run record to `.sliceui/runs.jsonl` (created lazily). Returns false when skipped. */
export function appendRun(rootDir, { ts, cmd, args, elapsedMs, exit }) {
  const runsDir = join(rootDir, ".sliceui");
  if (!existsSync(runsDir)) return false;
  try {
    appendFileSync(
      join(runsDir, "runs.jsonl"),
      JSON.stringify({ ts, cmd, args, elapsedMs, exit }) + "\n",
    );
    return true;
  } catch {
    return false;
  }
}

/** Parse a runs.jsonl body (or array of line strings) into records, dropping malformed lines. */
function parseLines(lines) {
  const out = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const r = JSON.parse(line);
      if (r && typeof r.ts === "number" && typeof r.cmd === "string") out.push(r);
    } catch { /* skip malformed lines */ }
  }
  return out;
}

/**
 * Aggregate a runs log into a per-stage summary.
 * @param {string|string[]} log — the runs.jsonl body, or an array of line strings.
 * @returns {{ stages: Array<{cmd,count,totalMs,lastMs}>, generateGapMs: number|null, verifyRetries: number }}
 */
export function aggregateRuns(log) {
  const lines = Array.isArray(log) ? log : String(log ?? "").split(/\r?\n/);
  const runs = parseLines(lines).sort((a, b) => a.ts - b.ts);

  const byCmd = new Map();
  for (const r of runs) {
    const s = byCmd.get(r.cmd) ?? { cmd: r.cmd, count: 0, totalMs: 0, lastMs: r.elapsedMs };
    s.count++;
    s.totalMs += r.elapsedMs;
    s.lastMs = r.elapsedMs;
    byCmd.set(r.cmd, s);
  }

  // Generate gap: the LLM's own work is the wall-clock between the LAST resolve and the FIRST
  // verify (both commands run through the same CLI, so their timestamps share one clock).
  const lastResolve = [...runs].reverse().find((r) => r.cmd === "resolve");
  const firstVerify = runs.find((r) => r.cmd === "verify");
  const generateGapMs = lastResolve && firstVerify && firstVerify.ts > lastResolve.ts
    ? firstVerify.ts - lastResolve.ts
    : null;

  // Verify retries: every verify run beyond the first is a gate iteration.
  const verifyCount = (byCmd.get("verify")?.count ?? 0);
  const verifyRetries = verifyCount > 0 ? verifyCount - 1 : 0;

  return {
    stages: [...byCmd.values()].sort((a, b) => a.cmd.localeCompare(b.cmd)),
    generateGapMs,
    verifyRetries,
  };
}
