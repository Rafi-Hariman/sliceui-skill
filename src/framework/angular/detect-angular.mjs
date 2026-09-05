// detect-angular — Angular-specific deep detection for the detect pipeline.
// Extracted from commands/detect.mjs (Jalur A reorg). These functions are the "how this
// Angular project is wired" knowledge: angular.json prefix/styleExt/module structure,
// selector-prefix voting from source, and the owning NgModule layout. They are pure —
// they take `root`/deps and return facts, importing only shared fs helpers from
// src/lib/detect-utils.mjs (never back into the generic orchestrator).

import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { walkFiles, readJsonSafe, readFileSyncSafe, extOf, toRel, extractTsconfigPaths } from "../../lib/detect-utils.mjs";

export function detectAngularDetails(root, angularJson, warnings) {
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
