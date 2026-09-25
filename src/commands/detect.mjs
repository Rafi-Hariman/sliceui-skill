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
import { extractConventions as extractVueConventions } from "../framework/vue-sfc/conventions.mjs";
import { detectAngularDetails } from "../framework/angular/detect-angular.mjs";
import { mergeGoldenReferences } from "../framework/angular/conventions.mjs";
import { splitProjectContext } from "../lib/snapshot.mjs";
import { walkFiles, readJsonSafe, readFileSyncSafe, toRel, extractTsconfigPaths } from "../lib/detect-utils.mjs";

export async function detectProject(rootDir, { frameworkId = null, profile = null } = {}) {
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
  let componentDirSource = "registryDefault";
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
    componentDirSource = ang.componentDirSource;
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

  // For a UII project the codegen source of truth is the org's curated pilar-reference.md +
  // pilar-showcase.md + conventions.md — NOT feature components sampled from the repo. Sampling
  // feature components and handing them to the agent as "read this for wiring" is what leaked the
  // stale idioms (.margin-top-20 that doesn't exist, the [pagination] bogus input) into a fresh
  // slice (2026-09-24 field session): a checked-in feature component is a snapshot that can be
  // stale and buggy, whereas the generated pilar docs are curated. Keep GOLDEN references (the
  // user hand-sliced them on purpose) but drop the auto-sampled feature components for UII.
  const sampleComponents = isUii
    ? [...readGoldenReferences(root, warnings)]
    : [
        ...readGoldenReferences(root, warnings),
        ...findSampleComponents(root, fw.id, componentDir, warnings),
      ];

  // Library-aware: capabilities map (category → library + real usage sample).
  // deps feeds the "installed but not yet used" signal so a fresh scaffold still resolves
  // its libraries (e.g. pilar → uii-table) before any component imports them.
  const { capabilities, libraries } = await scanLibraryUsage(root, deps, { includeUii: isUii, preferRegistrySamples: isUii });
  const uiLibrary = detectUiLibrary(deps, libraries.inUse);

  // Non-silent nulls: a null capability must surface a note, never quietly fall back.
  // The note is the machine contract (every null capability carries it). The per-capability
  // WARNING, though, is only useful for Angular — there a null table/select means "project has
  // a UI library but this category wasn't resolved" (surprising). For every other framework ALL
  // categories are null by design (the registry is Angular-shaped), so 13 identical warnings
  // drown out real ones. Collapse to one summary line for non-Angular.
  let nullCapabilityCount = 0;
  for (const [cat, cap] of Object.entries(capabilities)) {
    if (!cap.library) {
      cap.note = `no ${cat} library detected — use native HTML for this element and flag it in the output`;
      nullCapabilityCount++;
    }
  }
  if (fw.id === "angular") {
    for (const [cat, cap] of Object.entries(capabilities)) {
      if (!cap.library) warnings.push(`capability "${cat}": no library detected — generated code will use native HTML.`);
    }
  } else if (nullCapabilityCount) {
    warnings.push(`No component libraries detected (${nullCapabilityCount} categories) — this is expected for a non-Angular project; generated code uses native elements + the project's own styling.`);
  }

  // Design tokens from the project's own stylesheets (SCSS vars + CSS custom props + mixins).
  // `stylePaths` is only set for Angular; for every other framework it is [] and
  // extractStyleTokens falls back to globbing src/**/*.scss|css itself (Tailwind v4 @theme
  // tokens live in a plain .css and must NOT be skipped just because the project is not Angular).
  const designTokens = extractStyleTokens(root, stylePaths);

  // Loaded class registry: which classes actually RESOLVE to CSS in this project (dist CSS or
  // the loaded stylesheet chain). Distinct from the vocabulary (which classes the team USES).
  const loaded = extractLoadedClasses(root, stylePaths);
  const loadedClassRegistry = { classes: [...loaded.classes], source: loaded.source, files: loaded.files };

  // Code conventions — HOW this team writes (reusable classes, ::ng-deep corpus, page
  // anatomy, naming). Distinct from designTokens (WHAT tokens exist): these are the rules
  // the generated code must follow to read as native to this project.
  //
  // Deep convention mining is framework-shaped. Angular mines reusable classes from .html +
  // ::ng-deep corpus + Angular event syntax; Vue mines SFC anatomy + :deep() corpus + @event
  // naming. Every other framework still gets an honest empty profile (its miner is not built
  // yet) — the /sliceui-handoff skill reads the real components for those.
  const conventions = fw.id === "angular"
    ? extractConventions(root, { prefix })
    : fw.id === "vue-sfc"
      ? extractVueConventions(root)
      : { classVocabulary: [], ngDeepCorpus: [], componentAnatomy: {}, naming: { prefix: null, eventNaming: null } };

  // Provenance: which signal produced each claim — source code beats config beats registry default.
  const provenance = {
    prefix: prefixSource ?? "configFile",
    styleExt: fw.id === "angular" ? "configFile" : "registryDefault",
    componentDir: componentDir ? (fw.id === "angular" ? componentDirSource : "sourceCode") : "registryDefault",
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
    componentDirSource,
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
export function hashInputs(root) {
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

export async function main(argv) {
  const root = cwd();
  const force = argv.includes("--force");
  const outDir = join(root, ".sliceui");
  const outPath = join(outDir, "project-context.json");

  // Freshness gate (P0-3). `detect` is the EXPENSIVE scan (5 globs over the source tree). It is
  // run by `init` (cold path, always fresh) and was also listed as a normal per-slice step in
  // SKILL.md — which re-paid that scan on every slice for no reason. When the fingerprint of the
  // inputs that determine detection (package.json / angular.json / tsconfig.json / lockfile / git
  // HEAD) is unchanged and the cached context exists, reuse it instead of re-scanning.
  //
  // --force re-scans. Uncommitted source changes are NOT fingerprinted here (only git HEAD is),
  // so a deliberately committed-then-verified workflow is assumed; --force is the escape hatch.
  const cached = readJsonSafe(outPath);
  const currentHash = hashInputs(root);
  if (!force && cached?.inputHash && cached.inputHash === currentHash) {
    console.log(JSON.stringify({
      ok: true,
      out: outPath,
      framework: cached.framework,
      detected: cached.detected,
      fresh: true,
      sampleComponents: (cached.sampleComponents ?? []).map((s) => s.path),
      warnings: [],
      note: "context fresh — no relevant change since last detect; re-run with --force to re-scan",
    }, null, 2));
    return 0;
  }

  const ctx = await detectProject(root);
  mkdirSync(outDir, { recursive: true });
  // PR 2: split — project-context.json keeps only the WHAT facts; loadedClassRegistry +
  // conventions move to conventions.json (single owner). Standalone `detect` must write the
  // canonical conventions.json too, with golden references merged (parity with `init`).
  const { projectContext, conventions } = splitProjectContext(ctx);
  const mergedConventions = mergeGoldenReferences(root, conventions);
  writeFileSync(outPath, JSON.stringify(projectContext, null, 2) + "\n");
  writeFileSync(join(outDir, "conventions.json"), JSON.stringify({ ...mergedConventions, profile: ctx.profile ?? "generic", generatedAt: new Date().toISOString(), inputHash: ctx.inputHash }, null, 2) + "\n");
  writeContextSectionFiles(outDir, ctx);
  console.log(JSON.stringify({
    ok: true,
    out: outPath,
    framework: ctx.framework,
    detected: ctx.detected,
    fresh: false,
    sampleComponents: ctx.sampleComponents.map((s) => s.path),
    warnings: ctx.detectionWarnings,
  }, null, 2));
  return 0;
}

// ---------- agent-readable context sections ----------
// project-context.json is the MACHINE contract (referee/verify/init read it) and on real
// projects it can exceed the agent's Read cap (479 KB in the 2026-09-10 run). The section
// files below carry the SAME facts in readable slices the agent Reads instead of Greps.
// The root file stays complete and authoritative — these are additive views, never a split.

/** Render + write the .sliceui/context/*.md section files. Returns the paths written. */
export function writeContextSectionFiles(outDir, ctx) {
  const dir = join(outDir, "context");
  mkdirSync(dir, { recursive: true });
  const cap = ctx.capabilities ?? {};
  const capLines = ["# Capabilities", "", "Which library serves each element category, with the file to read for wiring.", ""];
  for (const [cat, c] of Object.entries(cap)) {
    capLines.push(`## ${cat}`);
    capLines.push("");
    capLines.push(`- library: ${c.library ?? "_none — use native HTML and flag it_"}`);
    if (c.note) capLines.push(`- note: ${c.note}`);
    for (const k of ["samplePath", "libSourcePath", "sampleScssPath"]) {
      if (c[k]) capLines.push(`- ${k}: \`${c[k]}\``);
    }
    capLines.push("");
  }
  const tk = ctx.designTokens ?? {};
  const tokenLines = ["# Design tokens", "", "SCSS vars + CSS custom props + mixins from this project's stylesheets.", ""];
  for (const t of tk.scss ?? []) tokenLines.push(`- \`${t.name}\`: ${t.value}`);
  for (const t of tk.cssProps ?? []) tokenLines.push(`- \`${t.name}\`: ${t.value}`);
  for (const m of tk.mixins ?? []) tokenLines.push(`- mixin \`${m.name ?? m}\``);
  if (!(tk.scss ?? []).length && !(tk.cssProps ?? []).length && !(tk.mixins ?? []).length) {
    tokenLines.push("_(none detected)_");
  }
  const sampleLines = ["# Sample components", "", "Pointers, not mirrors — read these files to absorb local wiring idiom.", ""];
  for (const s of ctx.sampleComponents ?? []) {
    sampleLines.push(`- \`${s.path}\`${s.golden ? " — **GOLDEN reference; read FIRST**" : ""}${s.selector ? ` (selector \`${s.selector}\`)` : ""}`);
  }
  const fw = ctx.framework ?? {};
  const fwLines = [
    `- framework: ${fw.label ?? fw.id ?? "?"}${fw.version ? ` ${fw.version}` : ""}`,
    `- profile: ${ctx.profile ?? "generic"}`,
  ];
  // Angular-only facts are meaningless (and noisy) for other frameworks: a Vue project has no
  // selector prefix and no NgModule. Emit them only when they exist — never as "``"/"?".
  if (ctx.prefix) {
    fwLines.push(`- prefix: \`${ctx.prefix}\` (alternates: ${(ctx.prefixAlternates ?? []).map((a) => a.prefix).join(", ") || "none"})`);
  }
  if (ctx.moduleStructure?.pattern) {
    fwLines.push(`- moduleStructure: ${ctx.moduleStructure.pattern}${ctx.appModulePath ? ` (\`${ctx.appModulePath}\`)` : ""}`);
  }
  fwLines.push(`- componentDir: \`${ctx.componentDir ?? "?"}\` — **the write target**; if the target component is not under it, STOP and ask the user`);
  fwLines.push(`- styleExt: \`${ctx.styleExt ?? "?"}\``);
  fwLines.push(`- uiLibrary: ${ctx.uiLibrary || "_none_"}`);
  const index = [
    "# SliceUI project context — INDEX",
    "",
    `Full machine context: \`.sliceui/project-context.json\` (may exceed your Read cap — use these sections instead).`,
    "",
    ...fwLines,
    "",
    "Sections:",
    "",
    "- [capabilities.md](capabilities.md) — library per element category + where to read wiring",
    "- [design-tokens.md](design-tokens.md) — SCSS vars / CSS custom props / mixins",
    "- [samples.md](samples.md) — sample + golden components (writing patterns)",
    "",
    "Also read: `.sliceui/conventions.md` (idiom) and `.sliceui/conventions.json` (verify ground truth).",
    "",
    "Detection warnings:",
    "",
    ...(ctx.detectionWarnings ?? []).map((w) => `- ⚠ ${w}`),
    "",
  ];
  const files = { "INDEX.md": index.join("\n"), "capabilities.md": capLines.join("\n"), "design-tokens.md": tokenLines.join("\n"), "samples.md": sampleLines.join("\n") };
  for (const [name, body] of Object.entries(files)) {
    writeFileSync(join(dir, name), body);
  }
  return Object.keys(files).map((n) => join(dir, n));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(main(process.argv.slice(2)) ?? 0);
}
