// library-scan — learn how THIS project uses its UI libraries, and build a capabilities
// map (category → { library, sampleHtml, sampleTs }). Combines:
//   (A) curated registry (library-registry.mjs) — for well-known libraries, and
//   (B) local usage scan — find real components that import the library, extract a
//       sample snippet to teach the agent THIS team's conventions (critical for custom
//       frameworks like `pilar` / `@uiigateway/*` with no public docs).

import fg from "fast-glob";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { REGISTRY, CATEGORIES, matchLibrary, registryLibraryNames } from "./library-registry.mjs";
import { importSources, componentMeta } from "./ts-ast.mjs";

const SKIP = ["**/node_modules/**", "**/dist/**", "**/.angular/**", "**/.sliceui/**", "**/build/**"];

/**
 * Build the capabilities map for a project root.
 * @param {string} root
 * @returns {{ capabilities: Record<string,object>, libraries: { inUse: string[] } }}
 */
export function scanLibraryUsage(root) {
  const tsFiles = fg.sync(["**/*.ts"], { cwd: root, ignore: SKIP, absolute: true });
  const htmlFiles = fg.sync(["**/*.html"], { cwd: root, ignore: SKIP, absolute: true });

  const allTs = tsFiles.map((f) => { try { return { path: f, src: readFileSync(f, "utf8") }; } catch { return { path: f, src: "" }; } });
  const allHtml = htmlFiles.map((f) => { try { return { path: f, src: readFileSync(f, "utf8") }; } catch { return { path: f, src: "" }; } });

  const combined = [...allTs, ...allHtml].map((x) => x.src).join("\n");
  const inUse = registryLibraryNames().filter((name) => {
    const entry = findEntryByName(name);
    return entry ? entry.test.test(combined) : false;
  });

  const capabilities = {};
  for (const cat of CATEGORIES) {
    capabilities[cat] = buildCapability(cat, combined, allTs, allHtml);
  }

  return { capabilities, libraries: { inUse } };
}

/** Resolve one category into { library, sampleHtml, sampleTs } or { library: null }. */
function buildCapability(category, combined, allTs, allHtml) {
  const libs = REGISTRY[category] || [];
  for (const lib of libs) {
    if (lib.test.test(combined)) {
      // Found usage: prefer a real local sample; fall back to the registry template.
      const local = findLocalSample(lib.name, allTs, allHtml);
      return {
        library: lib.name,
        sampleHtml: local.sampleHtml || lib.sampleHtml,
        sampleTs: local.sampleTs || lib.sampleTs,
        source: local.sampleHtml || local.sampleTs ? "local" : "registry",
      };
    }
  }
  return { library: null, sampleHtml: null, sampleTs: null };
}

/** Find the first component in the project that imports this library. */
function findLocalSample(libName, allTs, allHtml) {
  // match a TS file whose imports reference the library
  for (const f of allTs) {
    if (importSources(f.src).some((s) => s.includes(libName))) {
      const meta = componentMeta(f.src);
      const html = meta && meta.templateUrl ? readTemplate(f.path, meta.templateUrl, allHtml) : null;
      const tsSample = extractSnippet(f.src, libName);
      return { sampleHtml: html, sampleTs: tsSample };
    }
  }
  return {};
}

function readTemplate(tsPath, templateUrl, allHtml) {
  const dir = tsPath.replace(/[^/]*$/, "");
  const abs = join(dir, templateUrl);
  for (const h of allHtml) {
    if (h.path === abs) return h.src.trim().split("\n").slice(0, 40).join("\n");
  }
  // fallback: match by filename
  const base = templateUrl.split("/").pop();
  for (const h of allHtml) {
    if (h.path.endsWith("/" + base)) return h.src.trim().split("\n").slice(0, 40).join("\n");
  }
  return null;
}

function extractSnippet(src, libName) {
  // Return up to ~25 lines containing the import + first usage, trimmed.
  const lines = src.split("\n");
  const importIdx = lines.findIndex((l) => l.includes(libName) && /^import|from\s+/.test(l));
  if (importIdx === -1) return null;
  const start = Math.max(0, importIdx - 1);
  return lines.slice(start, start + 25).join("\n");
}

function findEntryByName(name) {
  for (const cat of Object.values(REGISTRY)) {
    for (const l of cat) {
      if (l.name === name) return l;
    }
  }
  return null;
}
