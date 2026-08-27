// sliceui detect — scan the current project into .sliceui/project-context.json
// The output feeds the code-gen prompt so generated code matches THIS project's conventions.
// Never throws: unknown projects get detected:false + warnings; the skill degrades gracefully.

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync } from "node:fs";
import { resolve, join, dirname } from "node:path";
import { cwd } from "node:process";

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
  let styleExt = "css";
  let pathAliases = {};
  let componentDir = "";
  let routing = false;

  if (fw.id === "angular") {
    const angularJson = readJsonSafe(join(root, "angular.json"));
    const ang = detectAngularDetails(root, angularJson, warnings);
    prefix = ang.prefix;
    styleExt = ang.styleExt;
    pathAliases = ang.pathAliases;
    componentDir = ang.componentDir;
    routing = ang.routing;
  } else {
    const tsconfig = readJsonSafe(join(root, "tsconfig.json"));
    pathAliases = extractTsconfigPaths(tsconfig);
    componentDir = guessComponentDir(root, fw.id);
    styleExt = detectStyleExt(root, fw.id);
  }

  const uiLibrary = detectUiLibrary(deps);
  const tokens = detectTokens(root);
  const sampleComponents = findSampleComponents(root, fw.id, componentDir, warnings);

  return {
    version: 1,
    cwd: root,
    detected: true,
    framework: fw,
    moduleOrStandalone: fw.id === "angular" ? (fw.versionMajor >= 14 ? "standalone-capable" : "module") : "n/a",
    prefix,
    styleExt,
    componentDir,
    uiLibrary,
    pathAliases,
    tokens,
    routing,
    sampleComponents,
    detectionWarnings: warnings,
  };
}

// ---------- framework detection ----------

function detectFramework(deps, warnings) {
  const ver = (name) => (typeof deps[name] === "string" ? deps[name] : "");

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
  let prefix = "app";
  let styleExt = "scss";
  let componentDir = "";
  let routing = false;

  if (angularJson) {
    const projects = angularJson.projects ?? {};
    const projectNames = Object.keys(projects);
    if (projectNames.length > 1) {
      warnings.push(`Monorepo: angular.json has ${projectNames.length} projects (${projectNames.join(", ")}). Using the first ("${projectNames[0]}").`);
    }
    const p = projects[projectNames[0]];
    if (p) {
      prefix = p.prefix || prefix;
      const buildOpts = p.architect?.build?.options ?? {};
      if (buildOpts.main) {
        // main: "src/main.ts" → app dir is <dir-of-main>/app by CLI convention
        componentDir = join(dirname(buildOpts.main), "app");
      }
      const styles = buildOpts.styles ?? [];
      if (styles.length && typeof styles[0] === "string") {
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

  return { prefix, styleExt, pathAliases, componentDir, routing };
}

// ---------- generic detection ----------

function detectUiLibrary(deps) {
  if (deps["@angular/material"]) return "angular-material";
  if (deps["@angular/cdk"]) return "angular-cdk";
  if (deps["primeng"] || deps["primeicons"]) return "primeng";
  if (deps["antd"]) return "antd";
  if (deps["@mui/material"]) return "mui";
  if (deps["bootstrap"]) return "bootstrap";
  if (deps["vuetify"]) return "vuetify";
  return "";
}

function detectTokens(root) {
  const scssVars = new Set();
  const cssVars = new Set();

  // bounded walk of src/ for style files (max ~150 files, depth 6) — enough to find token files
  const found = walkStyleFiles(join(root, "src"));
  for (const f of found) {
    const content = readFileSyncSafe(f);
    if (!content) continue;
    for (const m of content.matchAll(/^\s*\$([\w-]+)\s*:/gm)) scssVars.add(m[1]);
    for (const m of content.matchAll(/--([\w-]+)\s*:/g)) cssVars.add(m[1]);
  }
  return { scssVars: [...scssVars].slice(0, 40), cssVars: [...cssVars].slice(0, 40) };
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

  const searchRoots = componentDir ? [join(root, componentDir), join(root, "src")] : [join(root, "src")];
  const found = [];
  for (const sr of searchRoots) {
    walkFiles(sr, found, rx, { count: 50 }, 0);
    if (found.length >= 3) break;
  }
  if (!found.length) {
    warnings.push(`No ${fwId} component files found — code-gen will use framework defaults.`);
    return samples;
  }

  const limit = Math.min(found.length, 3);
  for (let i = 0; i < limit; i++) {
    const path = found[i];
    const content = readFileSyncSafe(path) ?? "";
    const rel = toRel(root, path);
    if (fwId === "angular") {
      samples.push(parseAngularComponent(rel, content));
    } else {
      samples.push({ path: rel, note: "read this file to absorb local idioms" });
    }
  }
  return samples;
}

function parseAngularComponent(rel, content) {
  const selector = /selector:\s*['"]([^'"]+)['"]/.exec(content)?.[1] ?? null;
  const templateUrl = /templateUrl:\s*['"]([^'"]+)['"]/.exec(content)?.[1] ?? null;
  const styleUrlsMatch = /styleUrls:\s*\[([^\]]*)\]/.exec(content)?.[1] ?? "";
  const styleUrls = [...styleUrlsMatch.matchAll(/['"]([^'"]+)['"]/g)].map((m) => m[1]);
  const hasInline = /template:\s*`/.test(content);
  return {
    path: rel,
    selector,
    templateUrl,
    styleUrls,
    hasInlineTemplate: hasInline,
    note: "read this file to absorb local idioms",
  };
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

function walkStyleFiles(dir, out = [], budget = { count: 150 }, depth = 0) {
  if (depth > 6 || budget.count <= 0) return out;
  let entries;
  try { entries = readdirSync(dir); } catch { return out; }
  for (const e of entries) {
    if (budget.count <= 0) return out;
    if (SKIP_DIRS.has(e)) continue;
    const full = join(dir, e);
    let st;
    try { st = statSync(full); } catch { continue; }
    if (st.isDirectory()) {
      walkStyleFiles(full, out, budget, depth + 1);
    } else if (/\.(scss|css|sass|less)$/i.test(e)) {
      out.push(full);
      budget.count -= 1;
    }
  }
  return out;
}

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
