// sliceui verify — deterministic fidelity + conventions gate for a generated component.
// Reads the component files (html/scss/ts) and their ground truth (conventions.json +
// transcript + raw XML) and prints a structured verdict. Exit 0 = all checks pass.

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { verifyComponent } from "../lib/verify.mjs";

export function main(argv) {
  const dir = argv[0] ? resolve(argv[0]) : process.cwd();
  const name = argv[1] ?? null; // optional component basename (e.g. "history-agreement")

  const { scss, html, ts } = readComponent(dir, name);
  const conventions = readJsonSafe(join(process.cwd(), ".sliceui", "conventions.json"));
  const transcript = readTranscript(process.cwd());
  const rawXml = readRawXml(process.cwd());

  if (!html && !scss && !ts) {
    console.error(`no component files found in ${dir}`);
    return 2;
  }

  const result = verifyComponent({ scss, html, ts, conventions, transcript, rawXml });

  console.log("SliceUI verify — generated component fidelity + conventions\n");
  for (const c of result.checks) {
    const icon = c.status === "pass" ? "✓" : c.status === "warn" ? "▲" : c.status === "fail" ? "✗" : "·";
    console.log(`  ${icon} ${c.name.padEnd(16)} ${c.status.padEnd(4)} ${c.detail}`);
    if (c.missing?.length) {
      for (const m of c.missing.slice(0, 8)) console.log(`       - ${m}`);
      if (c.missing.length > 8) console.log(`       … and ${c.missing.length - 8} more`);
    }
    if (c.problems?.length) for (const p of c.problems) console.log(`       - ${p}`);
    if (c.invented?.length) console.log(`       invented: ${c.invented.join(", ")}`);
  }
  const warned = result.warnCount ? ` · ${result.warnCount} warn` : "";
  console.log(`\n${result.failCount} fail${warned} · ${result.skipCount} skip · ${result.checks.length} checks`);
  if (!result.hasGroundTruth) {
    console.log("⚠ NO GROUND TRUTH — no .sliceui/conventions.json, transcript, or XML found (run `sliceui init` and `sliceui transcribe` first). NOT verifiable.");
  } else if (!conventions) {
    console.log("⚠ no .sliceui/conventions.json — run `sliceui init` first (convention checks may skip).");
  }

  return result.pass ? 0 : 1;
}

/** Read a component's html/scss/ts from a directory (or explicit basename). */
function readComponent(dir, name) {
  const files = existsSync(dir) ? readdirSync(dir) : [];
  const pick = (ext) => {
    const match = files.find((f) => f.endsWith(`.component.${ext}`) && (!name || f.startsWith(name)));
    return match ? readFileSyncSafe(join(dir, match)) : "";
  };
  return { scss: pick("scss"), html: pick("html"), ts: pick("ts") };
}

function readTranscript(cwdDir) {
  const tdir = join(cwdDir, ".sliceui", "transcript");
  if (!existsSync(tdir)) return null;
  const json = readdirSync(tdir).find((f) => f.endsWith(".transcript.json") && !f.endsWith(".meta.json"));
  return json ? readJsonSafe(join(tdir, json)) : null;
}

function readRawXml(cwdDir) {
  const xdir = join(cwdDir, ".sliceui", "xml");
  if (!existsSync(xdir)) return null;
  const xml = readdirSync(xdir).find((f) => /\.(xml|figml)$/i.test(f));
  return xml ? readFileSyncSafe(join(xdir, xml)) : null;
}

function readFileSyncSafe(p) {
  try { return readFileSync(p, "utf8"); } catch { return ""; }
}
function readJsonSafe(p) {
  try { return JSON.parse(readFileSync(p, "utf8")); } catch { return null; }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(main(process.argv.slice(2)) ?? 0);
}
