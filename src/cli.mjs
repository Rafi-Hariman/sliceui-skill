#!/usr/bin/env node
// sliceui — CLI entry point. Dispatches to command modules.
// Commands: install, detect, transcribe, --help, --version.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { appendRun, UNTIMED_COMMANDS } from "./lib/timing.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(HERE, "..", "package.json"), "utf8"));

const HELP = `sliceui ${pkg.version} — screenshot → component code that matches your project

Usage:
  sliceui install [--dir DIR]   Install the agent skill (default ~/.claude/skills/sliceui)
  sliceui init [--key-from F]   Set up this project: .sliceui/ dirs, config, .env.local, gitignore, detect
  sliceui detect                Detect the current project's framework/conventions
  sliceui transcribe <img>      Screenshot/XML → .sliceui/artifacts/<name>/transcript.md (Gemini → static fallback)
  sliceui transcribe <img> --static   Force the static tier (no API key needed)
  sliceui doctor                Diagnose install (Node, platform, sips/swiftc, key, skill, live Gemini)
  sliceui fidelity <xml>        Score visual-attribute preservation (FIGML → transcript)
  sliceui verify <dir> [name]   Gate a generated component: fidelity + codebase conventions (--xml/--transcript/--conventions; --render = dev-only browser render)
  sliceui referee [root] [--target <name>]   Validate ground-truth artifacts (snapshot mode; no repo scan)
  sliceui referee [root] [--target <name>] --deep   Live full repo scan + refresh the stored verdict
  sliceui resolve <xml|json>    Resolve styled leaves → exact idiom candidates (resolve-then-assemble)
  sliceui spec <xml|json>       One-pass render doc: elements + inline idioms + copy-targets
  sliceui timing                Per-stage wall-clock from .sliceui/runs.jsonl (where the minutes go)
  sliceui uninstall             Remove this project's .sliceui/ setup (+ .env.local if sliceui-owned)
  sliceui uninstall --skill     Remove the installed skill (~/.claude/skills/sliceui)
  sliceui update                Self-update the CLI + refresh the installed skill
  sliceui --help                This help
  sliceui --version             Print version

Examples:
  npm i -g sliceui && sliceui install && sliceui doctor
  sliceui init --key-from ~/other-project/.env.local
  sliceui detect
  sliceui transcribe ~/Desktop/hero.png
`;

async function run(argv) {
  const cmd = argv[0];

  if (!cmd || cmd === "--help" || cmd === "-h") {
    process.stdout.write(HELP);
    return 0;
  }
  if (cmd === "--version" || cmd === "-v") {
    process.stdout.write(pkg.version + "\n");
    return 0;
  }

  const rest = argv.slice(1);
  const profile = rest.includes("--profile");
  const jsonReport = rest.includes("--json-report");
  const cmdArgs = rest.filter((a) => a !== "--profile" && a !== "--json-report");
  const exit = await dispatch(cmd, cmdArgs);
  recordRun(cmd, cmdArgs, exit);
  if (profile || jsonReport) reportTrace(cmd, jsonReport);
  return exit;
}

/** Print the repository-access + read summary for a command run (`--profile` / `--json-report`).
 *  Reports the counters the plan's guard asserts against (files/bytes read, repo reads outside the
 *  allowlist, globs). Never logs source content or secrets — only counts. */
function reportTrace(cmd, json) {
  import("./lib/fs-trace.mjs").then(({ traceSummary }) => {
    const s = traceSummary();
    if (json) {
      process.stdout.write("\n" + JSON.stringify({ profile: { command: cmd, ...s } }, null, 2) + "\n");
    } else {
      process.stdout.write(
        `\nSliceUI profile — ${cmd}\n` +
        `  files read         : ${s.fileReads}\n` +
        `  bytes read         : ${s.bytesRead}\n` +
        `  repo reads (outside allowlist): ${s.repoReads}\n` +
        `  glob operations    : ${s.globs}\n`,
      );
    }
  });
}

/** Log one command run to .sliceui/runs.jsonl (no-op before .sliceui/ exists, or for infra cmds).
 *  This is what makes "where did the minutes go?" answerable — see `sliceui timing`. */
function recordRun(cmd, args, exit) {
  if (UNTIMED_COMMANDS.has(cmd)) return;
  const elapsedMs = Math.round(monotonicMs() - startMs);
  appendRun(process.cwd(), { ts: Date.now(), cmd, args, elapsedMs, exit });
}

/** Monotonic milliseconds (immune to wall-clock jumps; the log's `ts` stays wall-clock). */
function monotonicMs() {
  return Number(process.hrtime.bigint() / 1000000n);
}

/** Process-start anchor for the command's own elapsed time. */
const startMs = monotonicMs();

async function dispatch(cmd, rest) {
  switch (cmd) {
    case "install": {
      const { main } = await import("./commands/install.mjs");
      return main(rest);
    }
    case "init": {
      const { main } = await import("./commands/init.mjs");
      return main(rest);
    }
    case "detect": {
      const { main } = await import("./commands/detect.mjs");
      return main(rest);
    }
    case "transcribe": {
      const { main } = await import("./commands/transcribe.mjs");
      return main(rest);
    }
    case "doctor": {
      const { main } = await import("./commands/doctor.mjs");
      return main(rest);
    }
    case "fidelity": {
      const { main } = await import("./commands/fidelity.mjs");
      return main(rest);
    }
    case "verify": {
      const { main } = await import("./commands/verify.mjs");
      return main(rest);
    }
    case "referee": {
      const { main } = await import("./commands/referee.mjs");
      return main(rest);
    }
    case "resolve": {
      const { main } = await import("./commands/resolve.mjs");
      return main(rest);
    }
    case "spec": {
      const { main } = await import("./commands/spec.mjs");
      return main(rest);
    }
    case "timing": {
      const { main } = await import("./commands/timing.mjs");
      return main(rest);
    }
    case "uninstall": {
      const { main } = await import("./commands/uninstall.mjs");
      return main(rest);
    }
    case "update": {
      const { main } = await import("./commands/update.mjs");
      return main(rest);
    }
    default:
      process.stderr.write(`Unknown command: ${cmd}\n\n${HELP}`);
      return 1;
  }
}

run(process.argv.slice(2)).then((code) => {
  process.exitCode = code ?? 0;
  // `init` (interactive) reads a line from stdin but never closes it; a ref'd stdin keeps the
  // event loop alive after the command prints, so the terminal never returns to the prompt.
  // Unref it so the process exits cleanly once output is flushed. Safe for non-TTY (agent/CI):
  // stdin is already null/paused there and this is a no-op.
  if (process.stdin.isTTY && !process.stdin.destroyed) {
    process.stdin.unref();
  }
});
