// sliceui fidelity — measure visual-attribute preservation for a FIGML XML file.
// Prints a single coverage score + a per-attribute breakdown, so "does the parser drop
// the design's spacing/radius/typography?" becomes a number you can CI-enforce.

import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { computeFidelity } from "../lib/fidelity.mjs";

export function main(argv) {
  const path = argv[0];
  if (!path) {
    console.error("usage: sliceui fidelity <figml.xml>");
    return 2;
  }
  let xml;
  try {
    xml = readFileSync(path, "utf8");
  } catch (err) {
    console.error(`cannot read ${path}: ${err?.message ?? err}`);
    return 3;
  }
  const r = computeFidelity(xml, basename(path));
  const pct = Math.round(r.score * 100);

  console.log(`Fidelity: ${pct}% (${r.preserved}/${r.total} visual attributes preserved)`);
  console.log(`${r.droppedNodes} nodes dropped by design (hidden/metadata) — excluded from the score\n`);
  console.log("Per-attribute breakdown:");
  for (const [attr, s] of Object.entries(r.byAttr)) {
    const apct = Math.round((s.preserved / s.expected) * 100);
    console.log(`  ${attr.padEnd(12)} ${String(s.preserved).padStart(3)}/${s.expected}  ${apct}%`);
  }
  return r.score >= 0.9 ? 0 : 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(main(process.argv.slice(2)) ?? 0);
}
