import { test } from "node:test";
import assert from "node:assert/strict";
import { aggregateRuns, UNTIMED_COMMANDS } from "../src/lib/timing.mjs";

/** Build a runs.jsonl body from [cmd, ts, elapsedMs] tuples. */
function log(rows) {
  return rows.map(([cmd, ts, elapsedMs]) => JSON.stringify({ ts, cmd, args: [], elapsedMs, exit: 0 })).join("\n") + "\n";
}

test("timing: aggregates per-command count + total from the log", () => {
  const a = aggregateRuns(log([
    ["transcribe", 1000, 300],
    ["resolve", 2000, 210],
    ["resolve", 3000, 190],
  ]));
  const resolve = a.stages.find((s) => s.cmd === "resolve");
  assert.equal(resolve.count, 2);
  assert.equal(resolve.totalMs, 400, "totals accumulate across runs");
  const transcribe = a.stages.find((s) => s.cmd === "transcribe");
  assert.equal(transcribe.count, 1);
  assert.equal(transcribe.totalMs, 300);
});

test("timing: generate gap = first verify ts − last resolve ts (the LLM's own work)", () => {
  // A slice: transcribe, resolve, [agent generates ≈4 min of nothing logged], verify.
  const a = aggregateRuns(log([
    ["transcribe", 1000, 300],
    ["resolve", 2000, 210],
    ["verify", 2000 + 240000, 400],
  ]));
  assert.equal(a.generateGapMs, 240000, "gap spans from last resolve to first verify");
});

test("timing: verify retries counted beyond the first verify", () => {
  const a = aggregateRuns(log([
    ["resolve", 1000, 200],
    ["verify", 2000, 300],
    ["verify", 3000, 300],
    ["verify", 4000, 300],
  ]));
  assert.equal(a.verifyRetries, 2, "3 verify runs = 2 retries");
  assert.equal(a.stages.find((s) => s.cmd === "verify").count, 3);
});

test("timing: malformed lines are skipped, not fatal", () => {
  const body = log([["resolve", 1000, 200]]) + "not json\n\n" + JSON.stringify({ noTs: true }) + "\n";
  const a = aggregateRuns(body);
  assert.equal(a.stages.length, 1, "only the well-formed record survives");
  assert.equal(a.stages[0].cmd, "resolve");
});

test("timing: no gap when verify runs before resolve (or either is absent)", () => {
  assert.equal(aggregateRuns(log([["transcribe", 1000, 100]])).generateGapMs, null, "no verify → null gap");
  assert.equal(aggregateRuns(log([["verify", 500, 100], ["resolve", 900, 100]])).generateGapMs, null, "verify before resolve → null");
});

test("timing: infra commands are never logged", () => {
  for (const c of ["install", "update", "doctor", "uninstall", "timing"]) {
    assert.ok(UNTIMED_COMMANDS.has(c), `${c} must be untimed`);
  }
  assert.ok(!UNTIMED_COMMANDS.has("transcribe"), "slice stages ARE timed");
  assert.ok(!UNTIMED_COMMANDS.has("verify"), "verify IS timed (retry count depends on it)");
});
