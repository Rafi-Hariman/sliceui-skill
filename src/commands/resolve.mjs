// sliceui resolve — deterministic idiom-resolution pass. Reads the transcript + conventions,
// writes .sliceui/resolve/<name>.resolved.json so the agent assembles from EXACT candidates.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, basename } from "node:path";
import { resolveTranscript } from "../lib/resolve.mjs";
import { parseFigml } from "../lib/figml-parse.mjs";

export function main(argv) {
  const path = argv[0];
  if (!path) {
    console.error("usage: sliceui resolve <transcript|xml> [--json]");
    return 2;
  }
  const abs = path.startsWith("/") ? path : join(process.cwd(), path);

  // Accept either a transcript .json or a raw XML (parse it on the fly).
  let transcript;
  if (/\.(xml|figml)$/i.test(abs)) {
    const xml = readFileSync(abs, "utf8");
    const r = parseFigml(xml, basename(abs));
    if (!r.ok) { console.error("parse failed:", r.reason, r.message); return 3; }
    transcript = r.transcript;
  } else {
    transcript = JSON.parse(readFileSync(abs, "utf8"));
  }

  const conventions = readConventions(process.cwd());
  const result = resolveTranscript(transcript, conventions);

  const outDir = join(process.cwd(), ".sliceui", "resolve");
  mkdirSync(outDir, { recursive: true });
  const stem = basename(abs).replace(/\.(xml|figml|json)$/i, "");
  const out = join(outDir, `${stem}.resolved.json`);
  writeFileSync(out, JSON.stringify(result, null, 2) + "\n");

  if (argv.includes("--json")) {
    console.log(JSON.stringify(result, null, 2));
    return 0;
  }
  console.log(`SliceUI resolve — ${result.leaves.length} styled leaves resolved`);
  console.log(`status leaves: ${result.statusTable.length}`);
  for (const s of result.statusTable.slice(0, 12)) {
    const r = s.resolved.map((x) => `${x.value}`).join(" + ") || "(none)";
    const oov = s.fallback ? `  ⚠ ${s.fallback.note}` : "";
    console.log(`  ${s.evidence.bg} + ${s.evidence.iconColor} → ${r}${oov}`);
  }
  console.log(`\nOut: ${out}`);
  return 0;
}

function readConventions(cwdDir) {
  const p = join(cwdDir, ".sliceui", "conventions.json");
  if (existsSync(p)) { try { return JSON.parse(readFileSync(p, "utf8")); } catch {} }
  return {};
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(main(process.argv.slice(2)) ?? 0);
}
