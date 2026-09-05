// sliceui detect — scan the current project into .sliceui/project-context.json
// The output feeds the code-gen prompt so generated code matches THIS project's conventions.
// Never throws: unknown projects get detected:false + warnings; the skill degrades gracefully.

import { writeFileSync, mkdirSync, existsSync, readdirSync, statSync } from "node:fs";
import { resolve, join, basename } from "node:path";
import { homedir } from "node:os";
import { cwd } from "node:process";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { scanLibraryUsage } from "../lib/library-scan.mjs";
import { extractStyleTokens } from "../lib/style-tokens.mjs";
import { extractLoadedClasses } from "../lib/loaded-classes.mjs";
import { extractConventions } from "../framework/angular/conventions.mjs";
import { detectAngularDetails } from "../framework/angular/detect-angular.mjs";
import { walkFiles, readJsonSafe, readFileSyncSafe, toRel, extractTsconfigPaths } from "../lib/detect-utils.mjs";

export function detectProject(rootDir, { frameworkId = null, profile = null } = {}) {
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

  // --- UII profile (org-private grammar gating). An explicit --profile override wins over the
  //     auto fingerprint (so a mis-detected project can be corrected); "auto" = fingerprint. ---
  let isUii, signals;
  if (profile === "uii") { isUii = true; signals = ["override:uii"]; }
  else if (profile === "generic") { isUii = false; signals = ["override:generic"]; }
  else { ({ isUii, signals } = uiiFingerprint(root, deps)); }

  // --- framework detection. An explicit --framework <id> forces the framework (skips detection),
  //     which also lets a project with no known dep target e.g. nextjs. ---
  const fw = frameworkId
    ? { id: frameworkId, label: labelForId(frameworkId), version: null, versionMajor: null, forced: true }
    : detectFramework(deps, warnings);

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
  const { capabilities, libraries } = scanLibraryUsage(root, deps, { includeUii: isUii });
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
    profile: isUii ? "uii" : "generic",
    isUii,
    uiiSignals: signals,
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

// ---------- UII profile detection ----------

/** Decide whether this project is a UII Gateway project (org-private libraries pilar /
 *  @uiigateway/* on a private registry). Knowledge of the org's component grammar is only
 *  loaded/served when this is true. OR-composite fingerprint:
 *   1. root folder name contains "uii" or "uii-gateway",
 *   2. package.json depends on `@uiigateway/core` or `pilar` (STRONGEST — private libs that
 *      only UII projects can install),
 *   3. an .npmrc (project or user home) points at registry `npm.uii.ac.id`.
 *  A bare repo-name match alone is weak (a UII project may be named anything, e.g. bill-ui),
 *  so signals are reported for transparency and profile is 'uii' on ANY match. */
function uiiFingerprint(root, deps = {}) {
  const signals = [];
  const name = basename(root).toLowerCase();
  if (/\buii\b|uii-gateway/.test(name)) signals.push("repo-name:uii");
  if (deps["@uiigateway/core"] || deps["pilar"] || Object.keys(deps).some((d) => d.startsWith("@uiigateway/"))) {
    signals.push("dep:uiigateway|pilar");
  }
  for (const npmrc of [join(root, ".npmrc"), join(homedir(), ".npmrc")]) {
    if (!existsSync(npmrc)) continue;
    const txt = readFileSyncSafe(npmrc) ?? "";
    if (/npm\.uii\.ac\.id/i.test(txt)) {
      signals.push("registry:npm.uii.ac.id");
      break;
    }
  }
  return { isUii: signals.length > 0, signals };
}

// ---------- framework detection ----------

const FRAMEWORK_LABELS = {
  angular: "Angular", "react-tsx": "React", nextjs: "Next.js", "vue-sfc": "Vue 3",
  svelte: "Svelte", tailwind: "Tailwind CSS", bootstrap5: "Bootstrap 5", "native-html": "Native HTML",
};
/** Human label for a forced framework id (auto-detection resolves versions/labels itself). */
function labelForId(id) {
  return FRAMEWORK_LABELS[id] ?? id;
}

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
