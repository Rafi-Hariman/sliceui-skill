// sliceui benchmark — run the seeded benchmark and print the engineering + product-claim reports.

import { buildInventory } from "../benchmark/inventory.mjs";
import { runBenchmark } from "../benchmark/runner.mjs";
import { engineeringReport, productClaimReport, engineeringCapabilityStatement, renderReport } from "../benchmark/report.mjs";

export function main(argv) {
  const json = argv.includes("--json");
  const entries = buildInventory();
  const results = runBenchmark(entries);
  const report = engineeringReport(results, entries);
  const claim = productClaimReport(report);
  const capability = engineeringCapabilityStatement(report);
  if (json) {
    process.stdout.write(JSON.stringify({ report, claim, capability }, null, 2) + "\n");
  } else {
    process.stdout.write(renderReport(report, claim, capability));
  }
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exitCode = main(process.argv.slice(2));
}
