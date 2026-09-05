// sliceui detect — scan the current project into .sliceui/project-context.json
// The output feeds the code-gen prompt so generated code matches THIS project's conventions.
// Never throws: unknown projects get detected:false + warnings; the skill degrades gracefully.

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync } from "node:fs";
import { resolve, join, dirname } from "node:path";
import { cwd } from "node:process";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { scanLibraryUsage } from "../lib/library-scan.mjs";
import { extractStyleTokens } from "../lib/style-tokens.mjs";
import { extractLoadedClasses } from "../lib/loaded-classes.mjs";
import { extractConventions } from "../lib/conventions.mjs";

const SKIP_DIRS = new Set(["node_modules", ".git", "dist", ".angular", "build", ".sliceui", ".claude", "coverage"]);

export function detectProject(rootDir) {
  const warnings = [];
  const root = resolve(rootDir);

  const pkg = readJsonSafe(join(root, "package.json"));
  if (!pkg) {
    return {
      version: 1,
      cwd: root,
      detected: false,
      framework: { id: "unknown", label: "Unknown" },
      detectionWarnings: ["No package.json found — cannot detect framework. Code-gen will use generic conventions; ask the user for the target framework."],
      sampleComponents: [],
    };
  }

  const deps = { ...pkg.dependencies, ...pkg.devDependencies };

  // --- framework detection (priority order matters) ---
  const fw = detectFramework(deps, warnings);

  // --- framework-specific deep detection ---
  let prefix = "";
  let prefixAlternates = [];
  let prefixSource = null;
  let prefixNote = null;
  let styleExt = "css";
  let pathAliases = {};
  let componentDir = "";
  let routing = false;
  let stylePaths = [];
  let appModulePath = null;
  let moduleStructure = null;

  if (fw.id === "angular") {
    const angularJson = readJsonSafe(join(root, "angular.json"));
    const ang = detectAngularDetails(root, angularJson, warnings);
    prefix = ang.prefix;
    prefixAlternates = ang.prefixAlternates;
    prefixSource = ang.prefixSource;
    prefixNote = ang.prefixNote;
    styleExt = ang.styleExt;
    pathAliases = ang.pathAliases;
    componentDir = ang.componentDir;
    routing = ang.routing;
    stylePaths = ang.styles;
    appModulePath = ang.appModulePath;
    moduleStructure = ang.moduleStructure;
  } else {
    const tsconfig = readJsonSafe(join(root, "tsconfig.json"));
    pathAliases = extractTsconfigPaths(tsconfig);
    componentDir = guessComponentDir(root, fw.id);
    styleExt = detectStyleExt(root, fw.id);
  }

  const sampleComponents = [
    ...readGoldenReferences(root, warnings),
    ...findSampleComponents(root, fw.id, componentDir, warnings),
  ];

  // Library-aware: capabilities map (category → library + real usage sample).
  // deps feeds the "installed but not yet used" signal so a fresh scaffold still resolves
  // its libraries (e.g. pilar → uii-table) before any component imports them.
  const { capabilities, libraries } = scanLibraryUsage(root, deps);
  const uiLibrary = detectUiLibrary(deps, libraries.inUse);

  // Non-silent nulls: a null capability must surface a note, never quietly fall back.
  for (const [cat, cap] of Object.entries(capabilities)) {
    if (!cap.library) {
      cap.note = `no ${cat} library detected — use native HTML for this element and flag it in the output`;
      warnings.push(`capability "${cat}": no library detected — generated code will use native HTML.`);
    }
  }

  // Design tokens from the project's own stylesheets (SCSS vars + CSS custom props + mixins).
  const designTokens = stylePaths.length ? extractStyleTokens(root, stylePaths) : { scss: [], cssProps: [], mixins: [] };

  // Loaded class registry: which classes actually RESOLVE to CSS in this project (dist CSS or
  // the loaded stylesheet chain). Distinct from the vocabulary (which classes the team USES).
  const loaded = extractLoadedClasses(root, stylePaths);
  const loadedClassRegistry = { classes: [...loaded.classes], source: loaded.source, files: loaded.files };

  // Code conventions — HOW this team writes (reusable classes, ::ng-deep corpus, page
  // anatomy, naming). Distinct from designTokens (WHAT tokens exist): these are the rules
  // the generated code must follow to read as native to this project.
  const conventions = extractConventions(root, { prefix });

  // Provenance: which signal produced each claim — source code beats config beats registry default.
  const provenance = {
    prefix: prefixSource ?? "configFile",
    styleExt: fw.id === "angular" ? "configFile" : "registryDefault",
    componentDir: componentDir ? (fw.id === "angular" ? "configFile" : "sourceCode") : "registryDefault",
    uiLibrary: uiLibrary ? (libraries.inUse.includes(uiLibrary) ? "sourceCode" : "configFile") : "registryDefault",
  };

  return {
    version: 4,
    cwd: root,
    detected: true,
    framework: fw,
    moduleOrStandalone: fw.id === "angular" ? (fw.versionMajor >= 14 ? "standalone-capable" : "module") : "n/a",
    deps,
    prefix,
    prefixAlternates,
    prefixNote,
    styleExt,
    componentDir,
    appModulePath,
    moduleStructure,
    uiLibrary,
    pathAliases,
    provenance,
    capabilities,
    libraries,
    designTokens,
    loadedClassRegistry,
    conventions,
    routing,
    sampleComponents,
    generatedAt: new Date().toISOString(),
    inputHash: hashInputs(root),
    detectionWarnings: warnings,
  };
}

// ---------- framework detection ----------

function detectFramework(deps, warnings) {
  const ver = (name) => (typeof deps[name] === "string" ? deps[name] : "");

  const present = [];
  if (deps["@angular/core"]) present.push("angular");
  if (deps["next"]) present.push("nextjs");
  if (deps["svelte"]) present.push("svelte");
  if (deps["vue"]) present.push("vue");
  if (deps["react"]) present.push("react");

  // Monorepo / polyglot: several framework deps → surface it, but pick one deterministically
  // (same priority order as before) and warn the user to scope the target directory.
  if (present.length > 1) {
    warnings.push(
      `Multiple frameworks detected (${present.join(", ")}) — using "${present[0]}". ` +
      "If you're slicing into a subproject, run `sliceui detect` from that subproject's directory.",
    );
  }

  const angularCore = deps["@angular/core"];
  if (angularCore) {
    return { id: "angular", label: "Angular", version: angularCore, versionMajor: parseMajor(angularCore) };
  }
  if (deps["next"]) return { id: "nextjs", label: "Next.js", version: ver("next"), versionMajor: parseMajor(ver("next")) };
  if (deps["svelte"]) return { id: "svelte", label: "Svelte", version: ver("svelte"), versionMajor: parseMajor(ver("svelte")) };
  if (deps["vue"]) return { id: "vue-sfc", label: "Vue 3", version: ver("vue"), versionMajor: parseMajor(ver("vue")) };
  if (deps["react"]) return { id: "react-tsx", label: "React", version: ver("react"), versionMajor: parseMajor(ver("react")) };

  warnings.push("No known framework dependency found in package.json — defaulting to tailwind/html output. Ask the user to confirm the target framework.");
  return { id: "tailwind", label: "Tailwind CSS", version: ver("tailwindcss"), versionMajor: null };
}

function parseMajor(v) {
  // handles semver ranges: "^13.3.11", "~13.3.4", ">=13", "13.4.0"
  const m = /(\d+)/.exec(String(v));
  return m ? Number(m[1]) : null;
}

// ---------- Angular deep detection ----------

function detectAngularDetails(root, angularJson, warnings) {
  let configPrefix = "app";
  let styleExt = "scss";
  let componentDir = "";
  let routing = false;
  let styles = [];

  if (angularJson) {
    const projects = angularJson.projects ?? {};
    const projectNames = Object.keys(projects);
    if (projectNames.length > 1) {
      warnings.push(`Monorepo: angular.json has ${projectNames.length} projects (${projectNames.join(", ")}). Using the first ("${projectNames[0]}").`);
    }
    const p = projects[projectNames[0]];
    if (p) {
      configPrefix = p.prefix || configPrefix;
      const buildOpts = p.architect?.build?.options ?? {};
      if (buildOpts.main) {
        // main: "src/main.ts" → app dir is <dir-of-main>/app by CLI convention
        componentDir = join(dirname(buildOpts.main), "app");
      }
      styles = (buildOpts.styles ?? []).filter((s) => typeof s === "string");
      if (styles.length) {
        const ext = extOf(styles[0]);
        if (ext) styleExt = ext;
      }
    }
  } else {
    warnings.push("No angular.json found — using CLI defaults (prefix app, src/app).");
  }

  const tsconfig = readJsonSafe(join(root, "tsconfig.json"));
  const pathAliases = extractTsconfigPaths(tsconfig);

  // routing: app-routing.module.ts or RouterModule referenced in app.module.ts
  const appDir = componentDir || "src/app";
  if (existsSync(join(root, appDir, "app-routing.module.ts"))) {
    routing = true;
  } else {
    const appModule = readFileSyncSafe(join(root, appDir, "app.module.ts"));
    if (appModule && appModule.includes("RouterModule")) routing = true;
  }

  // prefix: source code is ground truth — config is only a fallback.
  const resolved = resolvePrefix(root, componentDir, configPrefix);

  const { appModulePath, moduleStructure } = detectModuleStructure(root, componentDir);

  return {
    prefix: resolved.prefix,
    prefixAlternates: resolved.prefixAlternates,
    prefixSource: resolved.prefixSource,
    prefixNote: resolved.prefixNote,
    styleExt,
    pathAliases,
    componentDir,
    routing,
    styles,
    appModulePath,
    moduleStructure,
  };
}

// ---------- prefix + module structure (source > config) ----------

/** Collect every `selector:` prefix from source. The root component (app.component.ts)
 *  is the app shell — often a different prefix (e.g. `ugw-root`) than the feature
 *  components sliceui actually generates (`app-*`) — so it is excluded from the vote
 *  and only used as a fallback. */
function collectSelectors(root, componentDir) {
  const found = [];
  const searchRoot = componentDir ? join(root, componentDir) : join(root, "src");
  walkFiles(searchRoot, found, /\.component\.ts$/, { count: 200 }, 0);

  const seen = new Set();
  const featureCounts = new Map();
  let rootPrefix = null;
  for (const path of found) {
    if (seen.has(path)) continue;
    seen.add(path);
    const content = readFileSyncSafe(path) ?? "";
    const sel = /selector:\s*['"]([^'"]+)['"]/.exec(content)?.[1];
    const prefix = selectorPrefix(sel);
    if (!prefix) continue;
    if (/[\\/]app\.component\.ts$/.test(path)) {
      rootPrefix = prefix;
      continue;
    }
    featureCounts.set(prefix, (featureCounts.get(prefix) ?? 0) + 1);
  }
  return { rootPrefix, featureCounts };
}

/** "ugw-root" → "ugw"; "[sidebarMenuItem]" / attribute selectors → null. */
function selectorPrefix(sel) {
  const m = /^([a-zA-Z][a-zA-Z0-9]*)-/.exec(sel ?? "");
  return m ? m[1] : null;
}

/**
 * Resolve the selector prefix from the project's actual condition:
 *   majority among feature components > root selector > angular.json `prefix` fallback.
 */
function resolvePrefix(root, componentDir, configPrefix) {
  const { rootPrefix, featureCounts } = collectSelectors(root, componentDir);
  const prefixAlternates = [...featureCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([prefix, count]) => ({ prefix, count }));

  let prefix, prefixSource, prefixNote = null;
  if (prefixAlternates.length) {
    prefix = prefixAlternates[0].prefix;
    prefixSource = "sourceCode";
  } else if (rootPrefix) {
    prefix = rootPrefix;
    prefixSource = "sourceCode";
  } else {
    prefix = configPrefix || "app";
    prefixSource = "configFile";
  }

  if (prefixSource === "sourceCode" && rootPrefix && rootPrefix !== prefix) {
    prefixNote = `root selector "${rootPrefix}-*" differs from feature components "${prefix}-*" — using feature prefix`;
  } else if (prefixSource === "sourceCode" && configPrefix && prefix !== configPrefix) {
    prefixNote = `angular.json prefix "${configPrefix}" differs from source "${prefix}" — using source`;
  }

  return { prefix, prefixAlternates, prefixSource, prefixNote };
}

/** Where the owning NgModule lives + how components are organized. */
function detectModuleStructure(root, componentDir) {
  const appDirAbs = join(root, componentDir || "src/app");
  const appModule = join(appDirAbs, "app.module.ts");
  const hasAppModule = existsSync(appModule);

  const found = [];
  walkFiles(appDirAbs, found, /\.module\.ts$/, { count: 50 }, 0);
  const featureModules = found
    .filter((p) => !/[\\/]app\.module\.ts$/.test(p) && !/[\\/]app-routing\.module\.ts$/.test(p))
    .map((p) => toRel(root, p))
    .slice(0, 5);

  return {
    appModulePath: hasAppModule ? toRel(root, appModule) : null,
    moduleStructure: {
      featureModules,
      pattern: featureModules.length ? "feature-modules" : "single-app-module",
    },
  };
}

// ---------- generic detection ----------

function detectUiLibrary(deps, inUse = []) {
  // Prefer "actually used" libraries. @angular/cdk alone is NOT a UI library.
  const uiLibs = [
    "angular-material", "ngx-bootstrap", "ngx-select-ex", "ngx-datatable",
    "ngx-toastr", "ngx-quill", "tinymce", "primeng", "ng-zorro", "antd", "mui", "vuetify",
  ];
  for (const lib of uiLibs) {
    if (inUse.includes(lib)) return lib;
  }
  if (deps["@angular/material"]) return "angular-material";
  if (deps["bootstrap"]) return "bootstrap";
  return inUse.length ? inUse.join(" + ") : "";
}

function findSampleComponents(root, fwId, componentDir, warnings) {
  const samples = [];
  const patterns = {
    angular: /\.component\.ts$/,
    "react-tsx": /\.(tsx|jsx)$/,
    nextjs: /\.(tsx|jsx)$/,
    svelte: /\.svelte$/,
    "vue-sfc": /\.vue$/,
  };
  const rx = patterns[fwId];
  if (!rx) return samples;

  const searchRoots = componentDir
    ? [join(root, componentDir), join(root, "src"), join(root, "projects")]
    : [join(root, "src"), join(root, "projects")];
  const found = [];
  for (const sr of searchRoots) {
    if (!existsSync(sr)) continue;
    walkFiles(sr, found, rx, { count: 200 }, 0);
  }
  // Exclude the app shell — it's a bad idiom sample (matches collectSelectors' exclusion).
  // Then rank by feature-relevance: a component whose template renders a capability tag
  // (uii-table/ngx-select) is a better idiom sample than a leaf widget (activity-log etc).
  const candidates = found.filter((p) => !/[\\/]app\.component\.ts$/.test(p));
  if (!candidates.length) {
    warnings.push(`No ${fwId} feature component files found — code-gen will use framework defaults.`);
    return samples;
  }
  const relevant = candidates
    .map((path) => {
      const content = readFileSyncSafe(path) ?? "";
      const template = readTemplateOf(path, content, root);
      // A template rendering a table or select is the strongest signal of a filter+table page.
      const score = (/<(uii-table|ngx-datatable|mat-table)(?!-skeleton)\b/i.test(template) ? 2 : 0)
        + (/<ngx-select\b|<select\b/i.test(template) ? 1 : 0);
      return { path, content, score };
    })
    .sort((a, b) => b.score - a.score);
  // Take top-3 relevant, but keep the original order among ties for determinism.
  const limit = Math.min(relevant.length, 3);
  const chosen = relevant.slice(0, limit);

  for (const { path, content } of chosen) {
    const rel = toRel(root, path);
    // Pointers, not mirrors — the agent reads these files to learn idiom (no inline copies).
    if (fwId === "angular") {
      const selector = /selector:\s*['"]([^'"]+)['"]/.exec(content)?.[1] ?? null;
      const templateUrl = /templateUrl:\s*['"]([^'"]+)['"]/.exec(content)?.[1] ?? null;
      const styleUrlsMatch = /styleUrls:\s*\[([^\]]*)\]/.exec(content)?.[1] ?? "";
      const styleUrls = [...styleUrlsMatch.matchAll(/['"]([^'"]+)['"]/g)].map((m) => m[1]);
      samples.push({ path: rel, selector, templateUrl, styleUrls, note: "read this file to absorb local idioms" });
    } else {
      samples.push({ path: rel, note: "read this file to absorb local idioms" });
    }
  }
  return samples;
}

/** Read `.sliceui/config.json` `references` (hand-sliced "golden" components) and emit
 *  sampleComponents entries the agent must read FIRST as canonical writing patterns.
 *  A reference is a path (abs or relative to root) to a `.component.ts` file, or a directory
 *  containing one. Graceful: absent config / empty references produce no entry and no warning
 *  (optional feature); a reference that cannot resolve does warn (user error worth surfacing). */
function readGoldenReferences(root, warnings) {
  const config = readJsonSafe(join(root, ".sliceui", "config.json"));
  const refs = config?.references ?? [];
  if (!Array.isArray(refs) || !refs.length) return [];

  const out = [];
  for (const ref of refs) {
    const tsPath = resolveReferenceTs(root, ref);
    if (!tsPath) {
      warnings.push(`reference "${ref}" has no resolvable .component.ts — skipped`);
      continue;
    }
    const content = readFileSyncSafe(tsPath) ?? "";
    const selector = /selector:\s*['"]([^'"]+)['"]/.exec(content)?.[1] ?? null;
    const templateUrl = /templateUrl:\s*['"]([^'"]+)['"]/.exec(content)?.[1] ?? null;
    const styleUrlsMatch = /styleUrls:\s*\[([^\]]*)\]/.exec(content)?.[1] ?? "";
    const styleUrls = [...styleUrlsMatch.matchAll(/['"]([^'"]+)['"]/g)].map((m) => m[1]);
    out.push({
      path: toRel(root, tsPath),
      golden: true,
      selector,
      templateUrl,
      styleUrls,
      note: "GOLDEN reference — canonical writing pattern; read FIRST (wiring/structure/SCSS idiom). XML still owns appearance.",
    });
  }
  return out;
}

/** Resolve a `references` entry to its `.component.ts`: accept a direct file path, or a
 *  directory (use its `<basename>.component.ts`, else any single `.component.ts` within). */
function resolveReferenceTs(root, ref) {
  const abs = resolve(root, ref);
  if (existsSync(abs) && abs.endsWith(".component.ts")) return abs;
  if (existsSync(abs) && statSync(abs).isDirectory()) {
    const entries = readdirSync(abs, { withFileTypes: true });
    const name = abs.split("/").pop();
    const named = entries.find((e) => e.isFile() && e.name === `${name}.component.ts`);
    if (named) return join(abs, named.name);
    const any = entries.find((e) => e.isFile() && e.name.endsWith(".component.ts"));
    if (any) return join(abs, any.name);
    return null;
  }
  return null;
}

/** Read a component's template (inline `template:` or `templateUrl` file) for relevance scoring. */
function readTemplateOf(tsPath, content, root) {
  const inline = /template\s*:\s*`([\s\S]*?)`/.exec(content)?.[1]
    ?? /template\s*:\s*["']([\s\S]*?)["']/.exec(content)?.[1];
  if (inline) return inline;
  const templateUrl = /templateUrl:\s*['"]([^'"]+)['"]/.exec(content)?.[1];
  if (!templateUrl) return "";
  const dir = tsPath.replace(/[^/]*$/, "");
  const abs = join(dir, templateUrl);
  try { return readFileSyncSafe(abs); } catch { return ""; }
}

/** Hash the config inputs + git HEAD so a stale project-context is detectable. */
function hashInputs(root) {
  const hash = createHash("sha1");
  for (const f of ["package.json", "angular.json", "tsconfig.json", "package-lock.json"]) {
    const c = readFileSyncSafe(join(root, f));
    if (c) hash.update(f).update(c);
  }
  // Include git HEAD when available so a new commit invalidates the cached context.
  const head = gitHead(root);
  if (head) hash.update("git").update(head);
  return hash.digest("hex").slice(0, 12);
}

/** `git rev-parse HEAD` (best-effort; null outside a repo or on failure). */
function gitHead(root) {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, stdio: "pipe", encoding: "utf8", timeout: 2000 }).trim() || null;
  } catch {
    return null;
  }
}

function guessComponentDir(root, fwId) {
  const guesses = {
    "react-tsx": ["src/components", "src/app", "src"],
    nextjs: ["src/app", "src/components", "app", "components"],
    svelte: ["src/lib", "src/components", "src"],
    "vue-sfc": ["src/components", "src"],
  };
  const list = guesses[fwId] ?? ["src/components", "src"];
  for (const g of list) {
    if (existsSync(join(root, g))) return g;
  }
  return "src";
}

function detectStyleExt(root, fwId) {
  if (existsSync(join(root, "tailwind.config.js")) || existsSync(join(root, "tailwind.config.ts"))) return "tailwind";
  return "css";
}

function extractTsconfigPaths(tsconfig) {
  if (!tsconfig) return {};
  const paths = tsconfig.compilerOptions?.paths ?? {};
  const out = {};
  for (const [alias, targets] of Object.entries(paths)) {
    out[alias] = Array.isArray(targets) ? targets[0] : String(targets);
  }
  return out;
}

// ---------- walkers + fs helpers ----------

function walkFiles(dir, out, rx, budget, depth) {
  if (depth > 8 || budget.count <= 0) return;
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    if (budget.count <= 0) return;
    if (SKIP_DIRS.has(e.name)) continue;
    const full = join(dir, e.name);
    if (e.isDirectory()) {
      walkFiles(full, out, rx, budget, depth + 1);
    } else if (rx.test(e.name)) {
      out.push(full);
      budget.count -= 1;
    }
  }
}

function readJsonSafe(p) {
  try { return JSON.parse(readFileSync(p, "utf8")); } catch { return null; }
}
function readFileSyncSafe(p) {
  try { return readFileSync(p, "utf8"); } catch { return null; }
}
function extOf(p) {
  const i = p.lastIndexOf(".");
  return i === -1 ? "" : p.slice(i + 1);
}
function toRel(root, p) {
  return p.startsWith(root) ? p.slice(root.length + 1) : p;
}

// ---------- CLI entry ----------

export function main(argv) {
  const root = cwd();
  const ctx = detectProject(root);
  const outDir = join(root, ".sliceui");
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, "project-context.json");
  writeFileSync(outPath, JSON.stringify(ctx, null, 2) + "\n");
  console.log(JSON.stringify({
    ok: true,
    out: outPath,
    framework: ctx.framework,
    detected: ctx.detected,
    sampleComponents: ctx.sampleComponents.map((s) => s.path),
    warnings: ctx.detectionWarnings,
  }, null, 2));
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(main(process.argv.slice(2)) ?? 0);
}
