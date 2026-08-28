#!/usr/bin/env node
// sliceui — CLI entry point. Dispatches to command modules.
// Commands: install, detect, transcribe, --help, --version.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(HERE, "..", "package.json"), "utf8"));

const HELP = `sliceui ${pkg.version} — screenshot → component code that matches your project

Usage:
  sliceui install [--dir DIR]   Install the agent skill (default ~/.claude/skills/sliceui)
  sliceui init [--key-from F]   Set up this project: .sliceui/ dirs, config, .env.local, gitignore, detect
  sliceui detect                Detect the current project's framework/conventions
  sliceui transcribe <img>      Screenshot → .sliceui/transcript.md (Gemini → static fallback)
  sliceui transcribe <img> --static   Force the static tier (no API key needed)
  sliceui doctor                Diagnose install (Node, platform, sips/swiftc, key, skill, live Gemini)
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
    default:
      process.stderr.write(`Unknown command: ${cmd}\n\n${HELP}`);
      return 1;
  }
}

run(process.argv.slice(2)).then((code) => {
  process.exitCode = code ?? 0;
});
