// guard-publish — the pilar catalogs embed the org's PRIVATE pilar source (model/service text,
// 112 showcase examples, templates). Shipping that outside the org's private registry
// (npm.uii.ac.id) would leak it. This guard runs as part of prepublishOnly: if the catalogs
// are present in the package payload, publishing must target the UII registry (or be private).
//
// How the target registry is resolved (mirroring npm's precedence):
//   1. --registry flag on the publish command (highest)
//   2. NPM_CONFIG_REGISTRY env
//   3. project .npmrc registry=
//   4. ~/.npmrc registry=
//   5. npm default (registry.npmjs.org)
// `npm publish --access restricted` / a private registry → allowed. Default public npmjs → blocked.

import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = join(HERE, "..");

const UII_REGISTRY_HOST = "npm.uii.ac.id";
const CATALOG_GLOB = "src/framework/angular";

function registryFrom(argv) {
  const flag = argv.find((a) => a === "--registry" || a.startsWith("--registry="));
  if (flag) {
    if (flag.includes("=")) return flag.split("=").slice(1).join("=");
    const i = argv.indexOf(flag);
    if (argv[i + 1]) return argv[i + 1];
  }
  if (process.env.NPM_CONFIG_REGISTRY) return process.env.NPM_CONFIG_REGISTRY;
  for (const rc of [join(PKG_ROOT, ".npmrc"), join(homedir(), ".npmrc")]) {
    if (!existsSync(rc)) continue;
    const m = /^registry\s*=\s*(\S+)/m.exec(readFileSync(rc, "utf8"));
    if (m) return m[1];
  }
  return "https://registry.npmjs.org/";
}

function catalogsPresent() {
  return [
    join(PKG_ROOT, CATALOG_GLOB, "pilar-catalog.mjs"),
    join(PKG_ROOT, CATALOG_GLOB, "pilar-showcase.mjs"),
  ].filter((p) => existsSync(p));
}

export function guardPublish(argv = []) {
  const found = catalogsPresent();
  if (!found.length) return { ok: true, reason: "no pilar catalogs in payload" };

  const registry = registryFrom(argv);
  const isUii = registry.includes(UII_REGISTRY_HOST);
  if (isUii) return { ok: true, reason: `catalogs present, registry is ${UII_REGISTRY_HOST}` };
  return {
    ok: false,
    reason:
      `REFUSING: this package embeds private pilar source (${found.map((p) => p.split("/").pop()).join(", ")}) ` +
      `but the publish target is ${registry} (not ${UII_REGISTRY_HOST}). ` +
      `Publish to the org registry (--registry https://${UII_REGISTRY_HOST}/) or remove the catalogs first.`,
    registry,
  };
}

// CLI entry (invoked by prepublishOnly, which receives no publish args — env/.npmrc decide).
if (import.meta.url === `file://${process.argv[1]}`) {
  const r = guardPublish(process.argv.slice(2));
  if (!r.ok) {
    console.error(`\n❌ ${r.reason}\n`);
    process.exit(1);
  }
  console.log(`✅ publish guard: ${r.reason}`);
}
