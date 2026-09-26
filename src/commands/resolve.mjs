// sliceui resolve — deterministic idiom-resolution pass. Reads the transcript + conventions,
// writes .sliceui/artifacts/<name>/resolved.json so the agent assembles from EXACT candidates.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, basename } from "node:path";
import { resolveTranscript } from "../lib/resolve.mjs";
import { parseFigml } from "../lib/figml-parse.mjs";
import { loadPilar } from "../lib/pilar-loader.mjs";
import { RESOLVED_SCHEMA_VERSION, confidenceLevel } from "../lib/resolution-policy.mjs";

export async function main(argv) {
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
  // PR 4 — the pilar catalog (in-memory import, never a repo read) lets behavior bindings
  // verify their public API names machine-side; null on public installs degrades to hint.
  const pilar = await loadPilar().catch(() => null);
  const result = resolveTranscript(transcript, conventions, pilar);

  // The written artifact carries the DEDUPED view (groups) — identical table-row leaves repeat
  // 10×+ and reading them whole wasted ~90% of the resolved.json (2026-09-10 §1.3). `leaves`
  // stays available for programmatic callers via --json. Schema 2 adds the typed resolution
  // fields (classification/authority/confidence/provenance) + behaviorBindings — additive on
  // the schema-1 groups[] shape, so older artifacts and readers stay valid.
  const deduped = {
    schemaVersion: RESOLVED_SCHEMA_VERSION,
    groups: result.groups,
    behaviorBindings: result.behaviorBindings,
    meta: { totalLeaves: result.leaves.length, uniqueGroups: result.groups.length },
  };
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
  for (const b of result.behaviorBindings ?? []) {
    console.log(`  behavior ${b.property} → ${b.implementation.expression}  (${b.authority}, ${confidenceLevel(b.confidence)}; behavioral CSS rejected)`);
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
  main(process.argv.slice(2)).then((code) => process.exit(code ?? 0));
}
