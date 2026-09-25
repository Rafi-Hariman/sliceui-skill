// library-scan — learn how THIS project uses its UI libraries, and build a capabilities
// map (category → { library, sampleHtml, sampleTs }). Combines:
//   (A) curated registry (library-registry.mjs) — for well-known libraries, and
//   (B) local usage scan — find real components that import the library, extract a
//       sample snippet to teach the agent THIS team's conventions (critical for custom
//       frameworks like `pilar` / `@uiigateway/*` with no public docs).

import fg from "fast-glob";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CATEGORIES, registryEntries, withUiiEntries } from "./library-registry.mjs";
import { loadPilar } from "./pilar-loader.mjs";
import { importSources } from "./ts-ast.mjs";

const SKIP = ["**/node_modules/**", "**/dist/**", "**/.angular/**", "**/.sliceui/**", "**/build/**"];

/**
 * Build the capabilities map for a project root.
 * @param {string} root
 * @param {Record<string,string>} [deps] — merged package.json dependencies+devDependencies
 * @returns {{ capabilities: Record<string,object>, libraries: { inUse: string[] } }}
 */
export async function scanLibraryUsage(root, deps = {}, { includeUii = true, preferRegistrySamples = false } = {}) {
  const tsFiles = fg.sync(["**/*.ts"], { cwd: root, ignore: SKIP, absolute: true });
  const htmlFiles = fg.sync(["**/*.html"], { cwd: root, ignore: SKIP, absolute: true });
  const scssFiles = fg.sync(["**/*.scss"], { cwd: root, ignore: SKIP, absolute: true });

  const allTs = tsFiles.map((f) => { try { return { path: f, src: readFileSync(f, "utf8") }; } catch { return { path: f, src: "" }; } });
  const allHtml = htmlFiles.map((f) => { try { return { path: f, src: readFileSync(f, "utf8") }; } catch { return { path: f, src: "" }; } });
  const allScss = scssFiles.map((f) => { try { return { path: f, src: readFileSync(f, "utf8") }; } catch { return { path: f, src: "" }; } });

  // The UII registry entries live in uii-profile.mjs (which imports the private pilar catalog). In
  // the public tarball that module is stripped, so resolve it lazily — present only in an
  // internal/UII install. includeUii + pilar-absent ⇒ base registry only (correct: a public install
  // cannot be a UII project — pilar isn't installable from npmjs).
  const pilar = includeUii ? await loadPilar() : null;
  const uiiRegistry = pilar?.registryEntries ?? {};

  const combined = stripComments([...allTs, ...allHtml].map((x) => x.src).join("\n"));
  // "in use" = actually referenced in source OR installed via package.json. The latter lets a
  // freshly-scaffolded project (deps present, no usage yet) still report its libraries.
  // Active entries = the generic base + the UII profile's org entries ONLY when includeUii.
  const activeEntries = [];
  for (const cat of CATEGORIES) {
    for (const entry of includeUii ? withUiiEntries(cat, uiiRegistry[cat]) : registryEntries(cat)) {
      if (!activeEntries.some((e) => e.name === entry.name)) activeEntries.push(entry);
    }
  }
  const inUse = activeEntries.filter((entry) => {
    if (entry.test.test(combined)) return true;
    // Installed via package.json. Local registry entries (no `package` field) are matched
    // by their `test`/usage pattern above — this fallback is npm-install only, mirroring
    // findLocalSample's `entry.package || entry.name` resolution.
    return Boolean(entry.package && deps[entry.package]);
  }).map((e) => e.name);

  const capabilities = {};
  for (const cat of CATEGORIES) {
    capabilities[cat] = buildCapability(cat, combined, allTs, allHtml, allScss, deps, { includeUii, uiiRegistry, preferRegistrySamples });
  }

  return { capabilities, libraries: { inUse } };
}

/** Resolve one category into { library, sampleHtml, sampleTs } or { library: null }.
 *  Precedence (highest first):
 *    1. local usage — a precise import (testImport) wins over a bare tag (test), which wins
 *       over a generic re-exported tag (tagTest). Always beats a bare install.
 *    2. installed — first entry whose npm `package` appears in deps (registry order = priority).
 *    3. null — fall back to plain HTML with a note.
 */
function buildCapability(category, combined, allTs, allHtml, allScss, deps, { includeUii = true, uiiRegistry = {}, preferRegistrySamples = false } = {}) {
  const libs = includeUii
    ? withUiiEntries(category, uiiRegistry[category])
    : registryEntries(category);
  // Prefer the library whose PACKAGE is actually imported — that's the authoritative
  // signal for which npm package provides the component. A generic template tag like
  // <ngx-select> can be re-exported by several packages (e.g. @uiigateway/core/pilar),
  // so a bare tag match is a weak signal and must NOT win over a real import.
  const imported = libs.find((lib) => lib.testImport && lib.testImport.test(combined));
  const used = libs.find((lib) => lib.test.test(combined));
  const entry = imported || used;
  if (entry) {
    // UII projects (preferRegistrySamples) take the registry's CURATED sample over a
    // repo-scanned one: a sampled feature component is a snapshot that can be stale/buggy (the
    // field session leaked `.margin-top-20` and `[pagination]` into a fresh slice this way).
    // The curated sample lives in uii-profile.mjs and is regenerated from the pilar catalogs.
    if (!preferRegistrySamples) {
      const local = findLocalSample(entry, allTs, allHtml, allScss);
      if (local.sampleHtml || local.sampleTs) {
        return { library: entry.name, sampleHtml: local.sampleHtml, sampleTs: local.sampleTs, sampleScss: local.sampleScss, sampleScssPath: local.sampleScssPath, source: "local" };
      }
    }
    return { library: entry.name, sampleHtml: entry.sampleHtml, sampleTs: entry.sampleTs, source: "registry" };
  }

  // Installed but not yet used: claim it (registry sample teaches the agent the API).
  const installed = libs.find((lib) => lib.package && deps[lib.package]);
  if (installed) {
    return { library: installed.name, sampleHtml: installed.sampleHtml, sampleTs: installed.sampleTs, source: "installed" };
  }

  return { library: null, sampleHtml: null, sampleTs: null };
}

/** Find a real local usage sample for a matched registry entry.
 *  HTML and TS samples are gathered independently — a package's import often lives in a
 *  `.module.ts` (no template) while the actual usage lives in a component template, so
 *  neither should block the other. `templateUrl` is read via regex (componentMeta's
 *  decorator detection is unreliable across TS versions); importSources is still used
 *  to confirm the package is genuinely imported (not just commented/re-exported).
 */
function findLocalSample(entry, allTs, allHtml, allScss) {
  const pkgName = entry.package || entry.name;
  const tagTest = entry.tagTest || tagTestFor(entry.name);
  // A tag-only entry (no `package`/`testImport`) is matched by its template tag, not by an
  // import string — e.g. "ngx-select (local)" is a re-exported tag with no import to match.
  const importGated = Boolean(entry.package || entry.testImport);

  // (1) HTML sample — a real component template that USES the library's tag. Requiring the
  // tag (not just the package import) matters: a component can import pilar for a different
  // widget while its template never renders <uii-table>, and that template is a bad sample.
  // Among matching templates, prefer the RICHEST (most usages of the tag). When the entry
  // has no tag pattern (e.g. directive-style APIs), fall back to the first importing template.
  let sampleHtml = null;
  let chosenTs = null; // the component whose template was chosen — its SCSS is the paste-target
  if (tagTest) {
    let bestCount = 0;
    for (const f of allTs) {
      if (importGated && !importSources(f.src).some((s) => s.includes(pkgName))) continue;
      const templateUrl = /templateUrl:\s*['"]([^'"]+)['"]/.exec(f.src)?.[1];
      if (!templateUrl) continue;
      const html = readTemplate(f.path, templateUrl, allHtml);
      if (!html) continue;
      const count = html.split(tagTest.source.replace("\\b", "")).length - 1;
      // Prefer a LIST/read view over a FORM/edit/detail view: a slice most often reproduces
      // the list + filter + table, and a form component carries form-specific ::ng-deep
      // (e.g. .table-input-autonumeric) that a list slice must NOT be required to copy.
      const score = count - (isFormView(f.path) ? 1000 : 0);
      if (score > bestCount) {
        bestCount = score;
        sampleHtml = html;
        chosenTs = f;
      }
    }
    if (!sampleHtml) {
      for (const h of allHtml) {
        if (tagTest.test(h.src)) {
          sampleHtml = extractTagBlock(h.src, tagTest) || null;
          if (sampleHtml) break;
        }
      }
    }
  } else {
    for (const f of allTs) {
      if (!importSources(f.src).some((s) => s.includes(pkgName))) continue;
      const templateUrl = /templateUrl:\s*['"]([^'"]+)['"]/.exec(f.src)?.[1];
      if (templateUrl) {
        const html = readTemplate(f.path, templateUrl, allHtml);
        if (html) { sampleHtml = html; chosenTs = f; break; }
      }
    }
  }

  // (2) TS sample — prefer a component whose template actually uses the tag (its class holds
  // the columns/rows wiring), else the first file importing the package.
  let sampleTs = null;
  for (const f of allTs) {
    if (!importSources(f.src).some((s) => s.includes(pkgName))) continue;
    const templateUrl = /templateUrl:\s*['"]([^'"]+)['"]/.exec(f.src)?.[1];
    if (!templateUrl) continue;
    const html = readTemplate(f.path, templateUrl, allHtml);
    if (html && tagTest && tagTest.test(html)) {
      sampleTs = extractSnippet(f.src, pkgName);
      chosenTs = chosenTs || f;
      if (sampleTs) break;
    }
  }
  if (!sampleTs) {
    for (const f of allTs) {
      if (!importSources(f.src).some((s) => s.includes(pkgName))) continue;
      sampleTs = extractSnippet(f.src, pkgName);
      chosenTs = chosenTs || f;
      if (sampleTs) break;
    }
  }

  // (3) SCSS sample — the chosen component's stylesheet, so the agent copies the ::ng-deep
  // block verbatim instead of reconstructing (and dropping) library-internal selectors.
  const { sampleScss, sampleScssPath } = readStylesheet(chosenTs, allScss);

  return { sampleHtml, sampleTs, sampleScss, sampleScssPath };
}

/** Form/detail/add components are poor exemplars for a list slice — deprioritize them. */
function isFormView(path) {
  return /[\\/]?[\w]*-?(edit|form|detail|add|create|update)[-\\.\w]*\.component\.ts$/i.test(path);
}

/** Build a tag regex from the entry's display name ("pilar (uii-table)" → /<uii-table\b/). */
function tagTestFor(displayName) {
  const m = /\(([^)]*uii[^)]*)\)/.exec(displayName);
  if (!m) return null;
  const tag = m[1].trim().split(/\s+/)[0].replace(/^uii-/i, "");
  return new RegExp(`<uii-${tag}\\b`, "i");
}

/** Read the chosen component's first stylesheet from its `styleUrls` (or `styleUrl`).
 *  The full file (trimmed to a sane cap) is the paste-target the agent copies — it carries
 *  the ::ng-deep / :host ::ng-deep blocks whose library-internal selectors must survive. */
function readStylesheet(chosenTs, allScss) {
  if (!chosenTs || !allScss) return { sampleScss: null, sampleScssPath: null };
  const styleUrls = /styleUrls:\s*\[([^\]]*)\]/.exec(chosenTs.src)?.[1]
    ?? (/(?:styleUrl|styleUrls)\s*:\s*['"]([^'"]+)['"]/.test(chosenTs.src) ? `'${/(?:styleUrl|styleUrls)\s*:\s*['"]([^'"]+)['"]/.exec(chosenTs.src)[1]}'` : null);
  if (!styleUrls) return { sampleScss: null, sampleScssPath: null };
  const first = styleUrls.match(/['"]([^'"]+)['"]/)?.[1];
  if (!first) return { sampleScss: null, sampleScssPath: null };
  const dir = chosenTs.path.replace(/[^/]*$/, "");
  const abs = join(dir, first);
  for (const s of allScss) {
    if (s.path === abs || s.path.endsWith("/" + first.split("/").pop())) {
      const lines = s.src.trim().split("\n");
      const capped = lines.slice(0, 160).join("\n");
      return { sampleScss: capped, sampleScssPath: first };
    }
  }
  return { sampleScss: null, sampleScssPath: null };
}

/** Extract the first template block containing the tag, trimmed to a useful span. */
function extractTagBlock(src, tagTest) {
  const idx = src.search(tagTest);
  if (idx === -1) return null;
  const start = Math.max(0, src.lastIndexOf("\n", Math.max(0, idx - 200)) + 1);
  const end = src.indexOf("\n", idx + 200);
  const chunk = src.slice(start, end === -1 ? src.length : end);
  const lines = chunk.split("\n");
  const keep = lines.filter((l) => l.trim()).slice(0, 20);
  return keep.join("\n");
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

/** Strip // line and /* * / block comments so imports/tags in comments never count as usage. */
function stripComments(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\/\/.*$/gm, " ");
}
