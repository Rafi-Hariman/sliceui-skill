// sliceui resolve — deterministic idiom-resolution pass. Reads the transcript + conventions,
// writes .sliceui/artifacts/<name>/resolved.json so the agent assembles from EXACT candidates.

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

  // The written artifact carries the DEDUPED view (groups) — identical table-row leaves repeat
  // 10×+ and reading them whole wasted ~90% of the resolved.json (2026-09-10 §1.3). `leaves`
  // stays available for programmatic callers via --json.
  const deduped = { groups: result.groups, meta: { totalLeaves: result.leaves.length, uniqueGroups: result.groups.length } };
  const stem = basename(abs).replace(/\.(xml|figml|json)$/i, "");
  const outDir = join(process.cwd(), ".sliceui", "artifacts", stem);
  mkdirSync(outDir, { recursive: true });
  const out = join(outDir, `resolved.json`);
  writeFileSync(out, JSON.stringify(deduped, null, 2) + "\n");

  if (argv.includes("--json")) {
    console.log(JSON.stringify(result, null, 2));
    return 0;
  }
  console.log(`SliceUI resolve — ${result.groups.length} unique leaf groups (from ${result.leaves.length} styled leaves)`);
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
