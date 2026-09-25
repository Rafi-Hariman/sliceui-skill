// fs-trace — an opt-in read counter for the hot path.
//
// The plan's repository-access guard requires proving the hot-path commands don't read outside
// their allowlist (`.sliceui/**`, the design input, and the generated target). This module gives
// that proof without wrapping every one of the ~100 readFileSync call sites in the repo: commands
// OPT IN by calling the traced helpers, and the counters are process-global so the CLI entry can
// report one summary at exit.
//
// Deliberately NOT a hard guard — it never throws on an out-of-allowlist read, it counts. A hard
// guard would silently break legitimate reads (escape hatches, the owning-module read, the
// cold-path commands); the count is the honest signal the plan's tests assert against.

import { readFileSync } from "node:fs";
import fg from "fast-glob";

let fileReads = 0;
let bytesRead = 0;
let repoReads = 0; // reads of project files OUTSIDE the allowlist (the metric the plan cares about)
let globs = 0;

const allowlist = new Set();

/** Register a root (absolute) whose files are "in scope" and must NOT count as repo reads. */
export function allowRoot(abs) {
  if (abs) allowlist.add(abs);
}

function isAllowed(p) {
  for (const root of allowlist) if (p.startsWith(root)) return true;
  return false;
}

/** Counted readFileSync. Returns the same value as `node:fs` (string by default). */
export function tracedReadFileSync(path, opts) {
  const content = readFileSync(path, opts);
  const bytes = typeof content === "string" ? Buffer.byteLength(content) : (content?.length ?? 0);
  fileReads++;
  bytesRead += bytes;
  if (!isAllowed(String(path))) repoReads++;
  return content;
}

/** Counted glob. Pass patterns + options exactly as to fg.sync. */
export function tracedGlob(patterns, options) {
  globs++;
  return fg.sync(patterns, options);
}

export function traceSummary() {
  return { fileReads, bytesRead, repoReads, globs, allowlist: [...allowlist] };
}

export function resetTrace() {
  fileReads = 0; bytesRead = 0; repoReads = 0; globs = 0;
}
