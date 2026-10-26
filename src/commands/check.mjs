// sliceui check — the public post-generate gate (remediation Phase 4).
//
// Facade over the existing deterministic verify engine: same checks, same exit-code contract
// (0 pass / 1 fail / 2 invalid / 3 unverifiable), but exposed under the new agent-facing name and
// the decomposed authority model. `verify` remains the compatibility alias; the checks themselves
// are NOT rewritten here — the layer contract lives in `check-layers.mjs` and is surfaced via
// `--layers`.
//
// Arg shape: `sliceui check <target-dir> [design-name|xml|transcript.json] [verify-flags] [--layers]`
//   <target-dir>       the generated component's directory (verify's `<dir>`)
//   [design]           the design ground truth: a bare name (verify's pairing), an xml/figml path,
//                      or a transcript.json path

import { main as verifyMain } from "./verify.mjs";
import { renderCheckLayers } from "../framework/angular/check-layers.mjs";

const VALUE_FLAGS = new Set(["--xml", "--transcript", "--conventions", "--viewport"]);

/** Map check's `<target> [design]` onto verify's argv (design → --xml/--transcript/name). */
export function buildVerifyArgv(target, design, passthrough = []) {
  const argv = [target];
  if (design) {
    if (/\.(xml|figml)$/i.test(design)) argv.push("--xml", design);
    else if (/\.json$/i.test(design)) argv.push("--transcript", design);
    else argv.push(design);
  }
  for (const f of passthrough) argv.push(f);
  return argv;
}

/** Split check's argv into target/design + verify passthrough flags (+ --layers). */
export function parseCheckArgs(argv) {
  const positional = [];
  const passthrough = [];
  let layers = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--layers") {
      layers = true;
    } else if (a.startsWith("--")) {
      passthrough.push(a);
      if (VALUE_FLAGS.has(a) && argv[i + 1]) passthrough.push(argv[++i]);
    } else {
      positional.push(a);
    }
  }
  return { target: positional[0] ?? null, design: positional[1] ?? null, passthrough, layers };
}

export async function main(argv) {
  const { target, design, passthrough, layers } = parseCheckArgs(argv);
  if (!target) {
    console.error("usage: sliceui check <target-dir> [design-name|xml|transcript.json] [--xml F] [--transcript F] [--render] [--layers]");
    return 2;
  }
  const exit = await verifyMain(buildVerifyArgv(target, design, passthrough));
  if (layers) console.log("\n" + renderCheckLayers());
  return exit;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main(process.argv.slice(2)).then((code) => process.exit(code ?? 0));
}
