# SliceUI Read-Path and Context Duplication Audit

> Read-only audit. No source code, artifact, or documentation was modified. The only new file is this report.
> Every material finding carries file → symbol → line → call-chain evidence. Token figures are **estimates** (`ceil(chars/4)`), not measured usage.

## 1. Executive Summary

**The headline is asymmetric — the hot path is largely clean; the duplication is not.**

1. **Biggest problem — context duplication, not read-path.** `loadedClassRegistry` (14,083 CSS class names, **264 KB / ~66k tokens**) is byte-identical inside *both* `.sliceui/project-context.json` and `.sliceui/conventions.json`. That one structure alone is **~132k tokens of pure duplication** and is the largest single waste in the system. It is a *verify* input that never needs to reach the *generator agent* at full fidelity.

2. **Most expensive command — `referee`.** It performs a **full-repository scan** (539 source files / ~3.4 MB / 1.1 MB of HTML+SCSS concatenated) on every invocation, including the pre-generate hot path (`sliceui referee --target`). Measured trace: `projectSourceReads = 539`, `projectSourceUnique = 538` against the real target project.

3. **The hot path does NOT read the repository — except `referee`.** `resolve`, `spec`, `fidelity`, and `verify` were each instrumented with a read-only `node:fs` tracing shim: `resolve`/`spec`/`fidelity` read **0** project-source files (only the design XML + `.sliceui/conventions.json`); `verify` reads a **bounded** set (3 generated files + 4 owning-module files, scoped walk). The claim "hot path re-reads the repo" is **false for every command except `referee`**, and the SKILL already instructs agents *not* to re-run `detect`.

4. **Snapshot sufficiency.** `.sliceui` already contains everything the generator needs; the project source is read in only two places: `init`/`detect` (cold path, by design) and `referee` (provenance validation, currently on the hot path).

**Three highest-impact recommendations:**

- **P0 — move `referee`'s codebase-head validation off the hot path** (to `init`/explicit `--deep`), so the pre-generate gate reads only `.sliceui` + the design input.
- **P0 — deduplicate `loadedClassRegistry`**: keep it in exactly one artifact (a machine-only file the verify gate reads, e.g. `conventions.json`), and drop it from `project-context.json` (the agent-facing JSON).
- **P0 — extend `fs-trace` to opt-in coverage of every read site** (or a loader-level counter) and add context-size/token accounting to `timing`, so the target `repo reads per hot-path op == 0` becomes *provable*, not *asserted by two call sites*.

---

## 2. Audit Scope

| Item | Value |
|---|---|
| Repository (audited) | `sliceui-skill` — `/Users/bsi-2-2200019/Development/freelance/sliceui-skill` |
| Commit | `5ea001338a136f1f0487cf52e96cab84ea378cdf` (2026-09-25) |
| Package version | `0.15.0` |
| Node | `v20.19.5` |
| Target project (fixture) | `/Users/bsi-2-2200019/Development/finance/lib-uii-gateway-bill-angular` |
| Target `.sliceui` | `.sliceui/` in the above (git HEAD `0c8e23cd`) |
| Design artifact | `.sliceui/artifacts/figml-export (7)/` (FIGML export, 1274×814) |
| Audit date | 2026-09-25 |

**Limitations (things I could not verify):**
- Token counts are **estimates** via `ceil(charCount / 4)`; no API/`claude-code` tokenizer was available.
- Instrumentation was **read-only** (a `node:fs` ESM shim loaded via `--import`, outside the repo). It counts `readFileSync`/`readFile`/`readdirSync`/`stat*`; it does **not** capture glob *traversal internals* inside `fast-glob` (which uses its own `fs` calls, but the *files it then reads* are captured). Recursive traversal is inferred from the union of `readdir` + subsequent reads, not from a glob counter.
- Child-process reads (`git rev-parse HEAD` in `detect`, `sips`/`swiftc` in `doctor`, `ng build`) are **not** captured by the fs shim.
- I did **not** run `sliceui init` against the real project (it would rewrite real artifacts); I verified init/detect behavior by static tracing plus the existing `.sliceui` snapshot.
- The `verify` PascalCase-name path (`TestingcomponentComponent`) returns exit 2 with "no component files found" — this is a **name-matching defect**, evidenced below; the kebab-case path was used for the read-set trace.

---

## 3. Methodology

1. **Static inspection** — read every command module, its `lib/` dependencies, and the framework modules; traced each call chain to the actual `fs`/`fast-glob` call sites.
2. **Call-chain tracing** — followed `main()` → imported functions → filesystem primitives, recording the exact file/function/line for each read.
3. **Filesystem instrumentation** — a read-only ESM loader (`/tmp/sliceui-shim`, outside the repo) redirects every `node:fs` import to a counting wrapper, logging `{op, path, bytes}`. Each command ran against a *temporary copy* of `.sliceui` (resolve/spec/fidelity) or the real project read-only (referee/verify). No source modified.
4. **Timing** — read `src/lib/timing.mjs`, `src/commands/timing.mjs`, and the real `.sliceui/runs.jsonl`.
5. **Artifact measurement** — `stat` byte size + `wc -m` char count + token estimate for every `.sliceui` file.
6. **Duplication analysis** — byte-diff of overlapping structures (`loadedClassRegistry`, `conventions`, projections) via Node.

Instrumentation scripts live under `/tmp/sliceui-shim/` and are **not** part of the repository.

---

## 4. Current Architecture

```
COLD PATH (one-shot)
  sliceui init ──► detectProject() ──► scan repo (glob *.ts/*.html/*.scss + style tokens +
                                         loaded classes + conventions mining + sample components)
                 ──► .sliceui/project-context.json   (machine contract, 476 KB)
                 ──► .sliceui/context/{INDEX,capabilities,design-tokens,samples}.md  (agent slices)
                 ──► .sliceui/conventions.json        (verify ground truth, 452 KB)
                 ──► .sliceui/conventions.md          (agent narrative)
                 ──► .sliceui/{uii-profile,pilar-reference,pilar-showcase}.md  (UII only, projections of pilar-catalog)
                 ──► refereeArtifacts()               (re-scans repo to validate conventions — cold, report-only)

HOT PATH (per slice)
  design XML ──► transcribe ──► transcript.{json,md,meta.json}   (design facts)
  transcript  ──► resolve   ──► resolved.json                     (styled leaves → idiom candidates)
  transcript+conventions ──► spec ──► spec.md                     (merged render doc)
  [agent] reads: INDEX.md + capabilities.md + conventions.md + transcript.{md|json}
                 + resolved.json + spec.md (+ grep pilar-reference/showcase for UII)
  [agent] writes: <name>.component.{ts,html,scss}
  referee ──► FULL REPO SCAN (validate conventions + target-exists + duplicate selectors)
  verify   ──► reads generated files + scoped owning-module files + .sliceui ground truth
```

**Source-of-truth boundaries (as implemented):**
- Design appearance → raw XML → `transcript.json` (authoritative) → `transcript.md` (projection).
- Idiom/class names → `resolved.json` (derived from corpus + XML).
- Wiring/styling rules → `conventions.json` (machine, verify ground truth) + `conventions.md` (narrative projection).
- Pilar API → `pilar-catalog.mjs` (machine, generated) → `pilar-reference.md`/`pilar-showcase.md` (projections).

---

## 5. Command Read Matrix

Legend: **Class** = `cold` (init/detect), `hot` (per-slice), `val` (validation/gate), `infra`.

| Command | Entry point | Reads `.sliceui` | Reads design input | Reads generated target | Reads project source | Recursive traversal | Reads dep source | Spawns child | Default/optional | Class | Evidence |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `init` | `src/commands/init.mjs:initProject` | writes | — | — | **yes (via detect)** | **yes** | yes (pilar via `loadPilar`) | yes (`git rev-parse`) | cold, one-shot | cold | `init.mjs:113,180` → `detectProject` |
| `detect` | `src/commands/detect.mjs:main` | writes | — | — | **yes** | **yes (5+ globs)** | yes (pilar) | yes (`git rev-parse`) | freshness-gated; `--force` | cold | `detect.mjs:480`, `library-scan.mjs:24-26` |
| `transcribe` | `src/commands/transcribe.mjs:main` | writes; reads `conventions.json` for staleness | **yes (xml/img)** | — | no | no | no | yes (gemini fetch/sips) | hot | hot | `transcribe.mjs:137-147` |
| `resolve` | `src/commands/resolve.mjs:main` | reads `conventions.json` | **yes (xml/transcript)** | — | **no** | **no** | no | no | hot | hot | measured: 0 project reads |
| `spec` | `src/commands/spec.mjs:main` | reads `conventions.json` | **yes (xml/transcript)** | — | **no** | **no** | no | no | hot | hot | measured: 0 project reads |
| `referee` | `src/commands/referee.mjs:main` | reads `project-context.json` + transcript + xml | **yes** | — | **yes (full scan)** | **yes** | no | no | hot (recommended: cold) | **val** | measured: 539 project reads |
| `verify` | `src/commands/verify.mjs:main` | reads `conventions.json`+`project-context.json`+`config.json` | yes (xml/transcript) | **yes** | **yes (scoped owning-module walk)** | no (bounded) | no | no | hot | val | measured: 7 project reads |
| `fidelity` | `src/commands/fidelity.mjs:main` | no | **yes (xml)** | — | no | no | no | no | hot | val | measured: 1 read (the xml) |
| `doctor` | `src/commands/doctor.mjs:runDoctor` | no | — | — | reads `package.json` | no | yes (pilar version check) | yes (`sips`/`swiftc`/gemini) | infra | infra | `doctor.mjs:147,167` |
| `timing` | `src/commands/timing.mjs:main` | reads `runs.jsonl` | — | — | no | no | no | no | infra | infra | `timing.mjs:17-22` |

**Key result:** only `referee` performs a repository-wide traversal on the hot path. `verify` performs a *scoped* walk (component dir → root, `*.module.ts` only), not a full scan.

---

## 6. Detailed Read-Path Findings

### 6.1 `init`
- Entry `src/commands/init.mjs:initProject` (line 29). Delegates to `detectProject` (line 113) which is the full cold scan (see 6.2).
- Writes all `.sliceui` artifacts (project-context, context/*.md, conventions.json/md, UII pilar docs).
- **Calls `refereeArtifacts` at line 180** — this *re-scans* the whole repo immediately after detect, to surface the corruption map at setup time. Report-only, but it means `init` performs **two** full repo passes (detect + referee). Acceptable cold-path cost; worth noting.

### 6.2 `detect`
- Entry `src/commands/detect.mjs:main` (line 450). Freshness-gated on `hashInputs` (package.json/angular.json/tsconfig/lockfile/git HEAD, `detect.mjs:410-429`).
- Full scan components (`detect.mjs:19-191`): `scanLibraryUsage` (3 globs over `**/*.ts|html|scss`, `library-scan.mjs:24-26`), `extractStyleTokens` (glob `src/**/*.scss|css`), `extractLoadedClasses` (reads `dist/styles.css`, **14,083 classes**), `extractConventions` (2 more globs, `conventions.mjs:87-91`), `findSampleComponents` (recursive `walkFiles`, `detect.mjs:300-306`).
- **Classification: cold-path-required.** All correct to run once.

### 6.3 `transcribe`
- Entry `src/commands/transcribe.mjs:main`. FIGML path reads only the input XML (`transcribe.mjs:25`). Reads `conventions.json` + `project-context.json` **only** for the staleness warning (`checkConventions`, `transcribe.mjs:133-155`) — a light read, hot-path-acceptable.
- **0 project-source reads.**

### 6.4 `resolve`
- Entry `src/commands/resolve.mjs:main` (line 9). Reads the design input (XML or transcript JSON, line 20/25) and `conventions.json` (`readConventions`, line 56-60). Calls `resolveTranscript` in `src/lib/resolve.mjs` — **pure in-memory** over `conventions.ngDeepCorpus`/`classVocabulary`; no `fs` import at all in `resolve.mjs`.
- **Confirmed: 0 repository reads, 0 recursive traversal, 0 dependency-source reads.** The `conventions.json` it reads is the snapshot; the design input is `.sliceui/inputs/xml/*`. This directly answers Q3: **`resolve` does NOT scan the repository.**
- **Recommendation:** nothing to move; already snapshot-lookup.

### 6.5 `spec`
- Entry `src/commands/spec.mjs:main` (line 209). Reads the design input + `conventions.json`. `buildSpec` (line 68) calls `resolveTranscript` (in-memory) and emits `spec.md` from transcript layout + resolved idioms + pruned reusable corpus.
- **Confirmed: 0 repository reads.** `spec` is the merge/denormalize step; its only input besides the design is `conventions.json` (snapshot).

### 6.6 `referee` — the one hot-path repo scanner
- Entry `src/commands/referee.mjs:main` → `src/lib/referee.mjs:refereeArtifacts`.
- Full-scan evidence (`referee.mjs:96-99`):
  ```
  const htmlFiles = fg.sync(["**/*.html"], { cwd: root, ignore: SKIP, absolute: true });
  const scssFiles = fg.sync(["**/*.scss", "**/*.css"], { cwd: root, ignore: SKIP, absolute: true });
  const html = htmlFiles.map(readFileSyncSafe).join("\n");
  const scss = scssFiles.map(readFileSyncSafe).join("\n");
  ```
  plus `findDuplicateSelectors` (another `**/*.component.ts` glob + full read, `referee.mjs:233-246`) and `locateTargetTs` (a repo-wide `**/${stem}.component.ts` glob, `referee.mjs:268`).
- **Measured (real project):** 539 project-source reads, 538 unique files, **3.4 MB** total read (1.1 MB of HTML+SCSS concatenated), across `.ts` (177) / `.html` (175) / `.scss` (151) / `.css` (36). This is the "codebase-evidence" head.
- **Why it exists:** it falsifies convention claims against the real repo (does `.well`/corpus selector/duplicate-selector actually trace?). That is a *provenance* validation — legitimate, but it belongs on the **cold path / explicit refresh**, not on every pre-generate gate.
- **Recommendation:** split `refereeArtifacts` into (a) `.sliceui`-only validation (target-exists against `project-context.sampleComponents`/`componentDir`, XML fidelity) that runs hot, and (b) the codebase-evidence head that runs in `init`/`refresh` (where it already runs once). Precompute and persist the provenance scan result (a "referee fingerprint") into `.sliceui` so the hot path reads a stored verdict, not the tree.

### 6.7 `verify`
- Entry `src/commands/verify.mjs:main`. Reads generated component (`readComponent`, `verify.mjs:188-195`), `conventions.json` + optional `project-context.json` (for `loadedClassRegistry`), paired transcript + raw XML (`pairGroundTruth`), pilar (via `loadPilar`, in-memory import), and owning modules via **scoped** `readOwningModules` (`verify.mjs:241-263`).
- **Measured (real project, kebab-case name):** 7 project-source reads — the 3 generated files + `testingcomponent.module.ts`, `testingcomponent-routing.module.ts`, `bill.module.ts`, `bill.shared.module.ts`. No full traversal (the walk ascends parent dirs only).
- **Correct minimal read-set** = the 3 generated files + the nearest `*.module.ts` chain + `.sliceui` ground truth. That is what it does today. ✓
- **Defect found:** `readComponent` matches by `f.startsWith(name)` (`verify.mjs:191`). The PascalCase class name `TestingcomponentComponent` does not prefix `testingcomponent.component.ts` (kebab-case), so `verify` with the class name (the name `referee` also accepts, and the name the `runs.jsonl` shows the agent passed) finds **no files → exit 2** "no component files found". This is a **name-normalization gap**: `referee` normalizes class→kebab (`referee.mjs:278-287`) but `verify.readComponent` does not.

### 6.8 `fidelity`
- Entry `src/commands/fidelity.mjs:main`. Reads only the input XML (`fidelity.mjs:17`). **0 repo reads, 1 read total.**

---

## 7. Filesystem Trace Capability

`src/lib/fs-trace.mjs` (55 lines) provides `tracedReadFileSync`, `tracedGlob`, `allowRoot`, `traceSummary`, `resetTrace`.

**Capabilities:**
- Counts `fileReads`, `bytesRead`, `repoReads` (reads outside the allowlist), `globs`.
- Reported at CLI exit via `--profile` / `--json-report` (`src/cli.mjs:66-81`).

**Gaps — it is NOT sufficient to prove "repo reads per hot-path op == 0":**
1. **Opt-in only.** Callers must invoke `tracedReadFileSync`/`tracedGlob`. A grep of the codebase shows **only 2 call sites** use them: `src/commands/verify.mjs:9` (`tracedReadFileSync`, `readJsonSafe`/`readFileSyncSafe` at lines 220-266) and `tracedGlob` is defined but **never called**. `resolve`, `spec`, `referee`, `fidelity`, `transcribe`, `detect`, `init` all use raw `readFileSync`/`fg.sync` and are **invisible to the counter**. The module's own header says "~100 readFileSync call sites" are un-wrapped.
2. **`repoReads` semantics are allowlist-relative, not absolute.** A read only counts as "repo" if a caller registered an `allowRoot`. `referee` registers nothing, so its 539 repo reads would be reported as `repoReads: 0` (they're not even counted, since it never calls the traced helpers).
3. **Recursive traversal is not measured.** `tracedGlob` increments a `globs` counter but does not count *files* a glob returns, nor distinguish a 1-pattern glob from a full-tree walk. `fast-glob`'s internal `readdir` recursion is invisible.
4. **Child-process reads are invisible** (`git rev-parse`, `ng build`, `sips`).
5. **No command-level attribution** — counters are process-global; a single summary at exit cannot attribute reads to a sub-stage.

**Conclusion:** `fs-trace` today proves almost nothing by itself. To make the target provable, either (a) wrap every read site (≈100 edits — invasive), or (b) switch to a **loader-level / `node:fs` interception** counter (as this audit's shim did) that requires zero per-site edits, and add a `--profile` summary of unique-files-read, bytes, and repo-reads. The latter is what this audit used and is the recommended direction.

---

## 8. Timing and Performance Observability

`src/lib/timing.mjs` + `src/commands/timing.mjs` record one JSON line per command into `.sliceui/runs.jsonl`: `{ts, cmd, args, elapsedMs, exit}`.

**Measured stages:** per-command wall-clock (count + total + last), plus derived `generateGapMs` (last `resolve` → first `verify` = "the LLM's own work") and `verifyRetries` (verify count − 1).

**Real `runs.jsonl` (target project):**
```
init       5174 ms
transcribe   82 ms
resolve      74 ms
spec         50 ms
referee     617 ms   (exit 1 — pre-existing duplicate selectors)
verify     1103 ms   (exit 2 — PascalCase name mismatch)
```

**Gaps:**
- **No context-size / token / read-count instrumentation** — the primary cost in this pipeline (agent context) is entirely unmeasured. `elapsedMs` for the CLI stages is near-zero; the expensive part is the *agent* reading context and generating, which timing only approximates as a gap.
- **No separation of repo-scan from context-assembly** inside `init`/`detect`/`referee` (all lumped into one `elapsedMs`).
- **No cache hit/miss** (the `detect` freshness gate writes `"fresh": true/false` to stdout but does not record it in `runs.jsonl`).
- **No file-read count or bytes** in the log.
- **No render/build duration** (verify does not build; `ng build` is an agent step and never logged).
- **`generateGapMs` is a weak proxy** for agent time — it assumes resolve→verify adjacency and cannot separate prompt-assembly, model time, and file I/O.

**Recommendation:** extend the run record to carry `{filesRead, bytesRead, repoReads, contextChars, estimatedTokens}` (populated from the fs counter + artifact sizes), and record `detect.fresh`/cache hits.

---

## 9. `.sliceui` Context Inventory

Measured on the real target project. Tokens = `ceil(chars/4)` (**estimate**).

| File | Producer | Consumer | Bytes | Chars | Est. tokens | Authority | Duplicates | Staleness risk | Recommendation |
|---|---|---|---|---|---|---|---|---|---|
| `project-context.json` | `init`/`detect` | CLI (referee/verify), agent (indexed) | 476,039 | 476,028 | 119,007 | machine contract | embeds `conventions` (69k) + `loadedClassRegistry` (264k) | high (git HEAD only) | **split**: drop `loadedClassRegistry` + `conventions` here |
| `conventions.json` | `init` | **verify gate** (ground truth) | 452,589 | 452,586 | 113,147 | verify ground truth | embeds `loadedClassRegistry` (264k) | high | keep as sole home of `loadedClassRegistry` + corpus |
| `conventions.md` | `init` | agent | 31,253 | 31,234 | 7,809 | narrative projection | full corpus + class vocab (from `.json`) | high | keep (agent-facing); prune class-vocab list |
| `context/INDEX.md` | `init` | agent (first read) | 985 | 969 | 243 | entry pointer | framework/prefix/componentDir (from json) | low | keep |
| `context/capabilities.md` | `init` | agent | 632 | 632 | 158 | pointer | capabilities (from json) | low | keep |
| `context/design-tokens.md` | `init` | agent | 3,318 | 3,318 | 830 | slice | designTokens (from json) | low | keep |
| `context/samples.md` | `init` | agent | 94 | 92 | 23 | pointer | sampleComponents (empty here) | low | keep |
| `pilar-reference.md` | `init` (UII) | agent (grep) | 56,301 | 56,251 | 14,063 | projection | = `pilar-catalog.mjs` (machine source) | **pilar version skew** | keep, but mark as projection of catalog |
| `pilar-showcase.md` | `init` (UII) | agent (grep) | 182,749 | 182,697 | 45,675 | projection | = `pilar-showcase.mjs` (machine source) | pilar version skew | keep (index-grep only) |
| `uii-profile.md` | `init` (UII) | agent | 1,398 | 1,394 | 349 | projection | action→auth→icon (subset of pilar-reference) | low | keep (or fold into pilar-reference) |
| `artifacts/…/transcript.json` | `transcribe` | agent + verify | 84,751 | 84,739 | 21,185 | authoritative design facts | — | low | keep (machine design truth) |
| `artifacts/…/transcript.md` | `transcribe` | agent | 13,042 | 13,020 | 3,255 | projection | = transcript.json | low | keep (agent reading format) |
| `artifacts/…/transcript.meta.json` | `transcribe` | agent (stale check) | 198 | 198 | 50 | authoritative | — | low | keep |
| `artifacts/…/resolved.json` | `resolve` | agent + spec | 3,718 | 3,718 | 930 | derived (idiom) | — | low | keep |
| `artifacts/…/spec.md` | `spec` | agent | 21,414 | 21,171 | 5,293 | merged render doc | re-copies transcript + resolved + corpus | low | keep (the one-pass render target) |
| `config.json` | `init` | CLI + agent | 275 | 275 | 69 | user config | — | low | keep |
| `runs.jsonl` | `cli.mjs` | `timing` | 905 | 905 | 227 | telemetry | — | n/a | keep |
| `inputs/xml/figml-export (7).xml` | user | transcribe/resolve/spec/verify | 120,224 | 120,212 | 30,053 | authoritative design | — | low | keep |

**Note on authority:** `conventions.md`, `pilar-reference.md`, `pilar-showcase.md`, `transcript.md`, and `context/*.md` are **human/agent-readable projections** of machine sources. They carry the same facts but are not the authoritative copy; the `.json`/`.mjs` sources are.

---

## 10. Context Duplication Matrix

Token figures are estimates of the *duplicated* portion, not the whole file.

| Information type | Source file | Duplicate file(s) | Identical? | Paraphrase? | Conflict? | Current SoT | Recommended SoT | Removable chars (est.) |
|---|---|---|---|---|---|---|---|---|
| Loaded CSS class registry (14,083 names) | `project-context.json.loadedClassRegistry` | `conventions.json.loadedClassRegistry` | **byte-identical** | no | no | both | `conventions.json` only | **264,140** (~66k tok) |
| Conventions (classVocabulary + ngDeepCorpus + anatomy + naming) | `conventions.json` | `project-context.json.conventions` | **byte-identical** (sans lcr/ts) | no | no | both | `conventions.json` only | **69,082** (~17k tok) |
| Framework + version + prefix + componentDir | `project-context.json` | `context/INDEX.md`, `conventions.md` header | no (paraphrase) | yes | no | project-context.json | project-context.json | ~500 |
| Design visible text + hierarchy + geometry | `transcript.json` | `transcript.md`, `spec.md` (Elements) | no (format differs) | paraphrase | no | transcript.json | transcript.json | 0 (md is the agent format) |
| Resolved idioms | `resolved.json` | `spec.md` (Resolved idioms + inline) | no | paraphrase | no | resolved.json | resolved.json | 0 (spec is the render doc) |
| Reusable `::ng-deep` corpus | `conventions.json.ngDeepCorpus` | `conventions.md`, `spec.md` (Copy verbatim) | block-identical | no | no | conventions.json | conventions.json | 0 (spec prunes by design) |
| Pilar component API (selector/inputs/outputs/templates) | `pilar-catalog.mjs` | `pilar-reference.md`, `pilar-showcase.md`, `uii-profile.md` | projection | no | **version skew** | pilar-catalog.mjs | pilar-catalog.mjs (machine) | 0 (md is the agent format) |
| Design tokens | `project-context.json.designTokens` | `context/design-tokens.md` | no | yes | no | project-context.json | project-context.json | 0 |
| Sample/golden components | `project-context.json.sampleComponents` | `context/samples.md` | no | yes | no | project-context.json | project-context.json | 0 |
| Angular ≤13 syntax constraints | `skill/SKILL.md` | `skill/references/angular13-cheatsheet.md` | no | paraphrase | no | SKILL.md | SKILL.md | 0 |
| action→authKey→icon | `uii-profile.mjs` (src) | `uii-profile.md`, `pilar-reference.md` (§Table action) | yes | no | no | uii-profile.mjs | uii-profile.mjs | ~1,300 |

**Net removable duplication (exact only): ~333,222 chars ≈ 83k tokens** from `loadedClassRegistry` + `conventions` living twice. The Markdown projections are *not* flagged for removal — they are the agent's reading format and are intentionally denormalized.

---

## 11. Agent Context Reconstruction

Reconstructed from `skill/SKILL.md` (Claude Code / CLI-capable agent) and `skill/handoff/SKILL.md` (CLI-less web agent).

### 11.1 Claude Code / CLI agent (primary `sliceui` skill)

Ordered read instructions (`SKILL.md` Steps 0–4):

| Step | File(s) | Mandatory | Size (est. tokens) |
|---|---|---|---|
| 1 | `.sliceui/context/INDEX.md` | yes (first) | 243 |
| 1 | one of `capabilities.md` / `design-tokens.md` / `samples.md` | on-demand | 158 / 830 / 23 |
| 2 | golden `sampleComponents[*]` (`.ts`/`.html`/`.scss`) | if `golden:true` | variable (none here) |
| 2 | `capabilities.<cat>` pointed-to files (`samplePath`/`libSourcePath`) | on-demand | variable |
| 2b | `.sliceui/conventions.md` | yes | 7,809 |
| 2b | `.sliceui/conventions.json` | yes ("deterministic facts") | **113,147** |
| 2b | `pilar-reference.md` (UII) | yes, grep sections | up to 14,063 |
| 2b | `pilar-showcase.md` (UII) | yes, grep index + section | up to 45,675 |
| 2b | `uii-profile.md` (UII) | yes | 349 |
| 3 | `transcript.md` (or `.json`) | yes | 3,255 (md) or 21,185 (json) |
| 3b | `resolved.json` | yes | 930 |
| 3c/4 | `spec.md` | yes (render from it) | 5,293 |
| 3.5 | referee output (stdout only) | yes | n/a |

**Total (worst case, UII, full reads):** ~190k tokens. **Realistic (following the SKILL's own "targeted" guidance):** INDEX + capabilities + conventions.md + transcript.md + resolved.json + spec.md + grep'd pilar sections ≈ **~18–22k tokens**. The dominant avoidable item is **`conventions.json` (113k tokens)** — the SKILL tells the agent to read it as "deterministic facts," but the generator agent needs only the *narrative* facts + reusable corpus already in `conventions.md` (7.8k tokens). `conventions.json` is the verify gate's ground truth, not the generator's reading material.

### 11.2 CLI-less web agent (`sliceui-handoff` skill)

Writes a single `.sliceui/handoff.md` (target ≤ ~20 KB) from INDEX + conventions.json + capabilities + a **direct codebase scan** (Step 2 reads 2–3 real components) + UII greps. This is a **cold**, human-initiated export — its repo scan is intentional and does not touch the hot path.

### 11.3 Duplicate instruction surfaces

- `spec.md` and `resolved.json` are both read; `spec.md` already *embeds* the resolved idioms inline. Reading `resolved.json` separately is redundant once `spec.md` is read (but `resolved.json` is still needed to *produce* `spec.md`). **The agent is told to read both** (Steps 3b and 3c/4).
- `transcript.json` and `transcript.md` carry the same design facts; the agent is told to read "the .md (or .json)". Both present.

---

## 12. Facts, Hypotheses, and Recommendations

Classification of `transcript.json` / `resolved.json` / `spec.md` fields:

| Field/section | Artifact | Classification |
|---|---|---|
| `layout[]` node `x/y/w/h/bg/text/radius/padding/gap/border` | transcript.json | **literal design fact** |
| `tokens.colors/fonts/spacing` | transcript.json | **normalized design fact** |
| `meta.textQuality = "exact"` | transcript.json | **literal fact (parser tier)** |
| `resolved[].value` (e.g. `label-custom-active`, `fa-check-circle`) | resolved.json | **implementation recommendation** (derived from corpus) |
| `resolved.evidence` (color/name/statusText) | resolved.json | **normalized design fact** |
| `resolved.fallback.note` | resolved.json | **semantic hypothesis** (honest fallback, not a fact) |
| `resolved.candidates` | resolved.json | **semantic hypothesis** (ambiguous, surfaces all) |
| `spec.md` "Render this… idiom inline" | spec.md | **generated instruction** |
| `spec.md` "Layout rules" | spec.md | **implementation recommendation** (from SKILL, not design) |
| `spec.md` "Layout verdicts" | spec.md | **normalized design fact** (computed geometry) |
| verify checks (scssCoverage, tableBindings…) | verify.mjs | **verification expectation** |

**Findings on fact/hypothesis/recommendation separation:**

1. **Inference stored as fact — moderate, but bounded.** `resolved.json` collapses "this icon color + name ⇒ `fa-info-circle`" into a single `resolved[].value`. The *evidence* is preserved alongside (`evidence.color/name`), so the inference is **traceable**, but the file presents it as a resolved string with no explicit confidence field. `label-custom-active` is a project-capability claim backed only by corpus co-occurrence, with no provenance pointer to the corpus entry.

2. **Resolved decisions do not store confidence.** `resolved.json` has no confidence/source field. `fallback.note` carries the *reason* for an empty resolve, but a *successful* resolve carries no confidence or corpus-trace (which `ngDeepCorpus` entry produced `label-custom-active`). This makes "self-consistent wrongness" harder to audit downstream (see §13).

3. **`spec.md` hides the origin of a decision.** `spec.md` renders `→ label-custom-active + fa-check-circle` inline with no pointer back to `resolved.evidence` or the corpus rule that produced it. The generator cannot tell from the spec *why* — which is fine for a render-only pass, but means any error is silently propagated.

4. **Project capability lacks provenance in the agent-facing docs.** `pilar-reference.md` / `context/capabilities.md` do not carry the "this came from `pilar-catalog.mjs` at `PILAR_VERSION`" provenance into the rendered text (the source `.mjs` does; the `.md` projection drops it). The skew guard exists (`pilar-version.mjs`), but the agent reading the `.md` has no in-file signal of which version it reflects.

5. **Verifier checks `resolved` decisions? No — good.** `verify.mjs` does **not** read `resolved.json` or `spec.md`; it re-derives against `transcript.json` + `rawXml` + `conventions.json`. This means the verifier is **independent of the generator's resolve step** — the important property the target wants. The residual coupling is the shared `ngDeepCorpus`/`classVocabulary` in `conventions.json` (see §13).

---

## 13. Self-Consistent Wrongness Risks

The pipeline is: XML → transcript → resolved → spec → generated code → verify(resolved/spec-independent, but corpus-shared).

The verifier is **not** chained to `resolved`/`spec` (confirmed: no import of those artifacts). The remaining self-consistency risk is the **shared `conventions.json` corpus** between generator and verifier:

1. **scssCoverage shares the generator's assumption.** `checkScssCoverage` (verify.mjs:133) asserts the generated SCSS reproduces the *reusable `ngDeepCorpus` selectors* from `conventions.json`. The generator copies those exact blocks (SKILL Step 4 "copy verbatim"). If a corpus block itself encodes a wrong assumption (e.g. a `::ng-deep` selector that doesn't actually match the installed pilar DOM, or a stale color), both the generator *and* the verifier "agree" on the wrong thing — the check passes while the UI is wrong. This is a **shared-assumption check**, not independent verification.

2. **`checkIconColor`/`checkClassVocabulary` verify against the same vocabulary** the generator was told to reuse — again a shared premise, not a cross-check against the design alone.

3. **`resolve`'s `label-custom-*`/`fa-*` mapping is name/color heuristic** (`resolve.mjs` `FA_ICON_COLORS`, `STATUS_LABELS`). If a project reuses `#eef6ff` for a *different* semantic than "Aktif", `resolve` confidently emits `label-custom-active` and `verify.checkClassVocabulary` *accepts it* (it's in the vocab). Neither step checks the *design's actual status text* against the corpus co-occurrence beyond what `resolve` already did. The specific modal/card-wrapper/canvas-x/y/pagination-align hazards called out in the audit brief are guarded by **distinct, XML-derived checks** (e.g. `checkTableOptions` paginationAlign from `SPACE_BETWEEN`, `checkPhantomWrapper` against transcript, `checkRequiredMarker`, `checkInventedLayout`) — these are genuinely independent of `resolve` and read the raw XML/transcript. Good.

4. **Net:** the **appearance/structure checks are independent and XML-grounded**; the **idiom/styling checks are corpus-shared** and can co-validate a wrong corpus. The fix is to give corpus entries **provenance + a freshness marker** and, for the highest-risk idioms (pagination alignment, label status, required marker), keep the XML-evidence gate (already present) as the primary signal.

---

## 14. Public Component API Registry Assessment

Audited: `pilar-catalog.mjs`, `pilar-showcase.mjs`, `pilar-typecheck.mjs`, `uii-profile.mjs`, `uii-slice-policy.mjs`, `library-registry.mjs`, `library-scan.mjs`, `pilar-loader.mjs`, `scripts/extract-pilar.mjs`, `scripts/extract-pilar-showcase.mjs`.

| Question | Answer |
|---|---|
| Exact selector stored? | **Yes** — `PILAR_COMPONENTS[*].selector` (exact string). |
| Exact case-sensitive inputs stored? | **Yes** — `inputs[*].name` (exact, incl. `paginationALign` vs `paginationAlign`). |
| Outputs, defaults, required wiring stored? | **Yes** — `outputs[*].name`, `inputs[*].default`, `inputs[*].type`; policy module separates legal/forbidden slice inputs. |
| Machine-queryable capability? | **Yes** — `pilar-catalog.mjs` is a JS array; `pilar-typecheck.mjs` generates a `.d.ts` stub and runs `ts.createProgram`. |
| Agent must read Markdown to find inputs? | **Yes, in practice** — the agent is instructed (SKILL.md:115-121) to *grep* `pilar-reference.md`/`pilar-showcase.md`, not to query the catalog. The catalog is consumed by the CLI (typecheck, skew guard, registry merge), but the *agent* reads the Markdown projection. |
| Public API split across artifacts? | **Yes** — full API (`pilar-catalog.mjs`), slice policy (`uii-slice-policy.mjs`), action→auth→icon (`uii-profile.mjs`), registry samples (`uii-profile.mjs` `UII_REGISTRY_ENTRIES`), docs/examples (`pilar-showcase.mjs`). |
| Registry sufficient to replace repo lookup? | **Yes for pilar/registered libraries** — `loadPilar()` returns the full catalog; `library-scan` merges curated registry samples. The only non-catalog knowledge is *local usage samples* (`findLocalSample`), which for UII is deliberately suppressed in favor of curated registry samples. |

**Assessment:** the component API knowledge is **already machine-actionable** (catalog + typecheck). The gap is that the *generator agent* consumes the lossy Markdown projection instead of a machine query. A small `sliceui pilar <component>` lookup (or emitting a per-design, pruned capability JSON) would let the agent get exact inputs without grepping 184 KB of showcase.

---

## 15. Source Example Assessment

Producers/consumers of source examples:
- `pilar-showcase.md` — full working examples (markup/TS/SCSS) for every `doc-*` pilar component (184 KB).
- `pilar-reference.md` — API docs + minimal template shapes (56 KB).
- `samples.md` / `sampleComponents[*]` — pointers to real project components (empty in the UII fixture).
- `capabilities.<cat>.sampleHtml/sampleTs/sampleScss` — registry-curated or repo-scanned snippets.
- `conventions.md` reusable corpus — verbatim `::ng-deep` blocks.

| Question | Answer |
|---|---|
| Why included? | Teach wiring/spelling (bindings, imports, models), not appearance. |
| Used for syntax, layout, or both? | **Syntax + wiring**; the SKILL explicitly forbids copying sample layout/wrapper (`SKILL.md:43-47`). |
| Risk of copying tech debt? | **Present but mitigated** — UII path suppresses repo-scanned feature samples (`detect.mjs:93-98`) in favor of curated pilar docs; SKILL explicitly warns samples "may be stale" (leaked `.margin-top-20`/`[pagination]` incident documented at `SKILL.md:90-93`). |
| Count bounded? | Yes — `findSampleComponents` caps at 3 (`detect.mjs:327`); non-UII registry samples are 1-per-category. |
| Chosen by design? | Partially — `spec` prunes corpus to in-play families (`spec.mjs:121-125`); but the *agent* is still pointed at the whole `pilar-showcase.md` index and told to grep, not given a design-scoped subset. |
| Agent reads irrelevant examples? | **Yes, risk** — the SKILL says "Read ONLY the Index then grep for your component," but there is no per-design capability → showcase-section manifest, so the agent can over-read. |
| Replaceable by grammar/minimal snippets? | **Largely yes** — the machine catalog already holds the grammar; a design-scoped "capability manifest" could replace full-showcase grepping with exact input/output lists. |

---

## 16. Current vs Minimal Required Read-Set

| Command | Current read-set | Minimal required | Excess |
|---|---|---|---|
| `resolve` | design XML + conventions.json | same | none |
| `spec` | design XML + conventions.json | same | none |
| `transcribe` | design input + (conventions.json for staleness) | same | none |
| `verify` | 3 generated + scoped modules + conventions.json + project-context.json + transcript + raw XML | same (minus project-context if lcr deduped) | none (structural) |
| `referee` | **539 project files** + .sliceui + XML | .sliceui + XML + a **stored** provenance verdict | **~539 files / 3.4 MB** |
| `fidelity` | XML | XML | none |
| `detect`/`init` | full repo (by design) | full repo (cold) | none |

The single excess is `referee`'s live repo scan.

---

## 17. Findings by Severity

### Critical
- **CD-001 — `loadedClassRegistry` duplicated 264 KB in two artifacts.** `project-context.json.loadedClassRegistry` and `conventions.json.loadedClassRegistry` are byte-identical (14,083 entries). ~66k tokens duplicated; the generator agent is pointed at `conventions.json` (which embeds it) while never needing the class list at all. Evidence: measured `JSON.stringify(pc.loadedClassRegistry) === JSON.stringify(cv.loadedClassRegistry) → true`. **Confidence: Confirmed.** *Fix: keep in `conventions.json` only (verify reads it); strip from `project-context.json`.*

### High
- **RP-001 — `referee` full-repo scan on the hot path.** `referee.mjs:96-99,233-246` glob+read every `*.html/scss/css/component.ts` each invocation. Measured 539 files / 3.4 MB. **Confidence: Confirmed.** *Fix: move codebase-evidence head to cold path / explicit `--deep`; persist verdict.*
- **CD-002 — `project-context.json.conventions` duplicates `conventions.json`.** Byte-identical (sans lcr/ts), 69 KB. **Confidence: Confirmed.** *Fix: drop `conventions` from `project-context.json`; keep `conventions.json` as sole owner.*
- **OB-001 — `fs-trace` cannot prove the 0-repo-read target.** Only 2 opt-in call sites; `tracedGlob` unused; `referee`/`resolve`/`spec`/`detect` invisible. **Confidence: Confirmed.** *Fix: loader-level counter (no per-site edits) or wrap all sites.*

### Medium
- **AC-001 — generator agent pointed at `conventions.json` (113k tokens).** `SKILL.md:110` says read it as "deterministic facts"; the generator needs only `conventions.md` (7.8k). **Confidence: Confirmed.** *Fix: instruct agent to read `conventions.md` + a pruned machine slice, not the full JSON.*
- **RP-003 — `verify` name-normalization gap.** `verify.mjs:191` `f.startsWith(name)` does not normalize PascalCase→kebab; class-name input returns "no component files" (exit 2). `referee` normalizes (`referee.mjs:278-287`); `verify` does not. **Confidence: Confirmed** (observed in real `runs.jsonl` + reproduced). *Fix: reuse `classNameToFileStem` in `verify.readComponent`.*
- **CD-004 — `spec.md` + `resolved.json` both read; spec embeds resolved.** SKILL tells agent to read both (Steps 3b + 4). Redundant once spec is read. **Confidence: Confirmed.** *Fix: clarify SKILL — read spec (which embeds idioms); read resolved only if not running spec.*
- **OB-002 — `timing` has no context/token/read accounting.** `timing.mjs` records only `elapsedMs`. **Confidence: Confirmed.**
- **VG-001 — `scssCoverage` shares the generator's corpus assumption.** Verifier checks generated SCSS against the *same* `ngDeepCorpus` the generator copies. **Confidence: Strong evidence** (both read `conventions.json`).

### Low
- **CD-005 — pilar `.md` docs are projections with no in-file version provenance.** Skew guard exists in CLI, but the rendered docs don't state the version. **Confidence: Confirmed.**
- **API-001 — machine catalog consumed via lossy Markdown.** Agent greps 184 KB showcase instead of querying the catalog. **Confidence: Confirmed.**
- **CD-003 / CD-006 — transcript.md and context/*.md projections.** Denormalized by design; not flagged for removal.

### Informational
- **RP-004 — resolve/spec/fidelity do 0 repo reads** (positive confirmation, see §6.4–6.8).
- **RP-002 — init runs detect + referee = two full passes.** Acceptable cold cost.
- **VG-002 — `render-probe.mjs` is orphaned** (no importer found), and `pilar-mount`/`render-mount` are referenced only in comments — no render/mount verification is wired into `verify`.

---

## 18. Recommended Target Architecture

**Cold path (unchanged intent, + one addition):**
- `init`/`detect` scan the repo **once**; produce `.sliceui` snapshot.
- **Add:** persist the `referee` codebase-evidence verdict (a fingerprint + findings) into `.sliceui` so it is never recomputed on the hot path.

**Hot path (target):**
- `transcribe`/`resolve`/`spec` read only `.sliceui` + the design input (already true).
- `referee` reads only `.sliceui` + design input + the **stored** provenance verdict; `--deep` re-scans explicitly.
- `verify` reads generated files + scoped owning modules + `.sliceui` ground truth (already true).

**Snapshot boundaries / source-of-truth policy:**
- One machine authority per fact: `transcript.json` (design), `conventions.json` (idiom + corpus + loaded classes), `pilar-catalog.mjs` (pilar API), `project-context.json` (framework/dir/capabilities — minus the two duplicated blobs).
- Agent-facing `.md` files are projections; each states its machine source.

**Context pruning:**
- Generator reads INDEX + capabilities + conventions.md + transcript.md + resolved/spec — **not** `conventions.json` (verify-only).
- Design-scoped capability manifest replaces full-showcase grepping.

**Independent verification (already largely true):**
- Verify re-derives from transcript + raw XML + conventions.json, independent of resolved/spec. Keep the XML-evidence checks as the primary signal; add provenance/freshness to the corpus to de-risk the shared-corpus checks.

---

## 19. Prioritized Remediation Plan

### P0

| Item | Problem | Minimal change | Likely files | Risk | Acceptance criteria | Dependency | Scope |
|---|---|---|---|---|---|---|---|
| P0-1 Loader-level fs counter | 0-repo-reads unprovable | intercept `node:fs` (or wrap all sites) + report unique files/bytes/repo-reads | `src/lib/fs-trace.mjs` (+ loader, or per-site wraps) | low | `--profile` shows unique repo files read = 0 for resolve/spec/transcribe/fidelity/verify | none | Small |
| P0-2 Remove `referee` repo scan from hot path | 3.4 MB re-read each pre-generate gate | persist provenance verdict in `init`/`detect`; hot `referee` reads verdict; `--deep` re-scans | `src/lib/referee.mjs`, `src/commands/referee.mjs`, `src/commands/init.mjs` | medium (must not lose duplicate-selector/target-exists semantics) | hot referee reads 0 project files; `--deep` reproduces full scan | P0-1 (to prove it) | Medium |
| P0-3 Dedupe `loadedClassRegistry` + `conventions` | 333 KB / 83k tokens duplicated | write `loadedClassRegistry` only to `conventions.json`; drop from `project-context.json`; verify reads conventions.json (already does) | `src/commands/detect.mjs`, `src/commands/init.mjs`, `src/commands/verify.mjs` | low | `project-context.json` shrinks ~333 KB; verify `loadedClass` still passes | none | Small |
| P0-4 Record context size/token in `timing` | hot cost unmeasured | extend run record with `{filesRead, bytesRead, repoReads, contextChars, estTokens}` | `src/lib/timing.mjs`, `src/cli.mjs` | low | `sliceui timing` shows context + read metrics | P0-1 | Small |

### P1

| Item | Problem | Minimal change | Likely files | Risk | Acceptance | Scope |
|---|---|---|---|---|---|---|
| P1-1 Machine-readable capability registry (agent-facing) | agent greps Markdown for API | emit per-design pruned capability JSON (or a `sliceui pilar <c>` lookup) | `src/lib/library-registry.mjs`, `pilar-catalog.mjs`, skill | low | agent gets exact inputs/outputs without grep | P0-3 | Medium |
| P1-2 Freshness fingerprint incl. source files | stale snapshot undetected between git commits | extend `hashInputs` to sample source hashes, or record a manifest | `src/commands/detect.mjs` | medium | stale context provable without full scan | none | Medium |
| P1-3 Context manifest (per design) | agent over-reads irrelevant capabilities/examples | emit a design-scoped manifest at `spec` time | `src/commands/spec.mjs` | low | unused capabilities in context = 0 | none | Small |
| P1-4 Facts/hypotheses/confidence in `resolved.json` | resolve stores inference as flat fact | add `confidence` + `provenance` to each resolved entry | `src/lib/resolve.mjs` | low | every resolved idiom carries confidence + corpus trace | none | Small |

### P2

| Item | Problem | Minimal change | Risk | Scope |
|---|---|---|---|---|
| P2-1 Visual verification | no render/mount check wired into verify | wire `render-probe`/`render-mount` into an explicit `verify --render` | medium | Medium |
| P2-2 Incremental refresh | full rescan on any relevant change | per-artifact invalidation | medium | Large |
| P2-3 Content-addressed cache | duplicate corpus blocks across families | content-hash dedup in corpus | low | Small |
| P2-4 Advanced benchmarking | no end-to-end slice cost model | instrument agent context assembly end-to-end | medium | Medium |

---

## 20. Proposed Experiments

Fixtures available: the real target project `.sliceui` snapshot (`figml-export (7)`), plus the `test/fixtures/` tree in the repo.

1. **Current pipeline** — run transcribe→resolve→spec→referee→verify on the fixture; capture elapsed + read-set (with P0-1 counter) + final artifact sizes. Baseline.
2. **Minimal-context pipeline** — generate using only INDEX + capabilities.md + conventions.md + transcript.md + resolved.json (drop conventions.json and full pilar greps). Measure output quality (verify pass/fail parity + human diff) vs baseline.
3. **Repository-assisted pipeline** — same as minimal but allow explicit `sliceui pilar <c>` lookups. Measure whether verify results differ (they should not — verify is independent) and whether generation quality improves.

Metrics: wall-clock per stage, `filesRead`/`repoReads`/`bytesRead`, context token estimate, verify fail/skip counts, and (if available) a manual design-fidelity diff.

---

## 21. Acceptance Criteria for Future Fixing

- [ ] `repoReads == 0` (provable via `--profile`, not asserted) for `resolve`, `spec`, `transcribe`, `fidelity`, `verify`, and hot-path `referee`.
- [ ] Raw source examples loaded by default == 0 (golden/registry samples only; UII uses curated pilar docs).
- [ ] Unused capabilities in agent context == 0 (design-scoped manifest).
- [ ] Deep scan disabled by default; `--deep`/`--force` explicit.
- [ ] Context size and token estimate measurable via `sliceui timing`/`--profile`.
- [ ] Every artifact has exactly one authority classification (machine vs projection), stated in-file.
- [ ] Verifier not solely dependent on resolved/spec (already true — keep it that way; add corpus provenance).
- [ ] Snapshot freshness provable without a full scan.

---

## 22. Open Questions

1. **Is `conventions.json` ever legitimately read by the *generator* agent**, or only by `verify`? (If only verify, the SKILL instruction to read it is purely wasteful — 113k tokens.) *Not determinable from source; requires an agent-behavior decision.*
2. **Does the UII generator actually need the full pilar showcase**, or only a per-component input/output list + one wiring example? (Cost tradeoff the org must decide; the machine data exists either way.)
3. **What is the intended freshness model** — commit-based (`git HEAD` only, as today) or content-based (sample file hashes)? The current `hashInputs` misses uncommitted source changes by design; whether that is acceptable is a product decision.
4. **Should `referee`'s duplicate-selector and target-exists checks stay blocking on the hot path**, or move to a CI/pre-commit step? (They are the only genuinely *live* repo checks a mock slice needs.)

---

## 23. Final Recommendation

**Keep:** the resolve→spec denormalization (correct, cheap, snapshot-only); the transcript.json-as-machine-truth + .md-as-projection split; the verify gate's independence from resolved/spec; the UII curated-pilar-docs over repo-sampled-components decision; the context/*.md index-first reading model.

**Prune:** `loadedClassRegistry` + `conventions` from `project-context.json` (CD-001/CD-002 — 83k tokens); the agent's `conventions.json` read instruction (AC-001 — point it at `conventions.md` + a pruned machine slice).

**Move to cold path:** `referee`'s codebase-evidence head (RP-001), leaving a stored verdict the hot path reads; keep `--deep` for explicit revalidation.

**Resolve:** *keep* `resolve` — it does zero repo reads and produces the deduped idiom facts; it is already a snapshot lookup, not a hint.

**Spec:** *keep* `spec` — it is the correct one-pass render denormalization; its only "cost" is re-copying transcript + resolved + corpus, which is the point. Optionally emit a **design-scoped context manifest** alongside it (P1-3) to kill the separate read of full `conventions.json`/showcase.

**First safest implementation step:** P0-3 (dedupe `loadedClassRegistry`) — it is a pure write-path change with no behavioral surface, shrinks both JSON files ~333 KB immediately, and requires no changes to verify's read path. Follow with P0-1 (loader-level fs counter) so every subsequent read-path change is measurable.

---

## Appendix A: Call Graphs

### `init`
```
initProject (init.mjs:29)
├─ loadPilar (pilar-loader.mjs:14) ─ import pilar-catalog/uii-profile/uii-slice-policy/pilar-version
├─ detectProject (detect.mjs:19)
│   ├─ uiiFingerprint (detect.mjs:205) — reads .npmrc (root + home)
│   ├─ detectFramework (detect.mjs:234) — package.json deps
│   ├─ detectAngularDetails (detect-angular.mjs) — angular.json + walkFiles
│   ├─ readGoldenReferences (detect.mjs:351) — config.json references
│   ├─ findSampleComponents (detect.mjs:288) — walkFiles **/*.component.ts
│   ├─ scanLibraryUsage (library-scan.mjs:23) — fg **/*.ts|html|scss (×3)
│   ├─ extractStyleTokens (style-tokens.mjs) — fg src/**/*.scss|css
│   ├─ extractLoadedClasses (loaded-classes.mjs) — readdir dist, read dist/styles.css
│   └─ extractConventions (conventions.mjs:86) — fg **/*.html + **/*.scss
├─ writeContextSectionFiles (detect.mjs:503) — writes context/*.md
├─ renderConventionsMd (conventions.mjs:542) — writes conventions.md
├─ pilar.render{ UiiProfile, PilarReference, PilarShowcase }Md (uii-profile.mjs)
└─ refereeArtifacts (referee.mjs:26) — fg **/*.html|scss + **/*.component.ts (FULL RESCAN)
```

### `detect`
```
main (detect.mjs:450)
├─ hashInputs (detect.mjs:410) — reads package.json/angular.json/tsconfig/lockfile + git rev-parse
└─ detectProject (as above)
```

### `resolve`
```
main (resolve.mjs:9)
├─ readFileSync(xml) OR parseFigml — design input
├─ readConventions (resolve.mjs:56) — .sliceui/conventions.json
└─ resolveTranscript (lib/resolve.mjs:32) — pure in-memory (no fs)
```

### `spec`
```
main (spec.mjs:209)
├─ readFileSync(xml|transcript) — design input
├─ readConventions (spec.mjs:241) — .sliceui/conventions.json
└─ buildSpec (spec.mjs:68)
    ├─ resolveTranscript — in-memory
    ├─ familiesInPlay (spec.mjs:167)
    └─ layoutVerdicts (spec.mjs:185)
```

### `referee`
```
main (referee.mjs:8)
├─ readRawXmlFromSliceui (referee.mjs:303) — readdir .sliceui/inputs/xml
├─ readTranscript (referee.mjs:53) — readdir artifacts, read transcript.json
└─ refereeArtifacts (lib/referee.mjs:26)
    ├─ locateTargetTs (referee.mjs:260) — fg **/<stem>.component.ts
    ├─ computeFidelity (fidelity.mjs) — in-memory
    ├─ fg **/*.html + **/*.scss|css  + readFileSync all → html/scss  ← FULL SCAN
    └─ findDuplicateSelectors (referee.mjs:233) — fg **/*.component.ts + readFileSync all
```

### `verify`
```
main (verify.mjs:11)
├─ nearestProjectRoot (verify.mjs:205) — walk up for .sliceui/angular.json
├─ readComponent (verify.mjs:188) — readdir dir, read {scss,html,ts}
├─ readJsonSafe(conventions.json) + optional project-context.json (lcr)
├─ pairGroundTruth (verify.mjs:121) — readdir artifacts/inputs, read transcript.json + xml
├─ loadPilar — in-memory import
├─ readOwningModules (verify.mjs:241) — readdir ascendant dirs, read *.module.ts  ← SCOPED
└─ verifyComponent (angular/verify.mjs:55) — pure in-memory over inputs
```

---

## Appendix B: Raw Measurements

### `.sliceui` artifacts (target project) — bytes / chars / lines / est tokens

| File | Bytes | Chars | Lines | Est tokens |
|---|---|---|---|---|
| project-context.json | 476,039 | 476,028 | 17,636 | 119,007 |
| conventions.json | 452,589 | 452,586 | 16,989 | 113,147 |
| pilar-showcase.md | 182,749 | 182,697 | 7,747 | 45,675 |
| pilar-reference.md | 56,301 | 56,251 | 2,139 | 14,063 |
| conventions.md | 31,253 | 31,234 | 1,007 | 7,809 |
| transcript.json | 84,751 | 84,739 | 2,398 | 21,185 |
| transcript.md | 13,042 | 13,020 | 188 | 3,255 |
| resolved.json | 3,718 | 3,718 | 183 | 930 |
| spec.md | 21,414 | 21,171 | 604 | 5,293 |
| context/INDEX.md | 985 | 969 | 24 | 243 |
| context/capabilities.md | 632 | 632 | 56 | 158 |
| context/design-tokens.md | 3,318 | 3,318 | 100 | 830 |
| context/samples.md | 94 | 92 | 4 | 23 |
| uii-profile.md | 1,398 | 1,394 | 28 | 349 |
| transcript.meta.json | 198 | 198 | 8 | 50 |
| config.json | 275 | 275 | 8 | 69 |
| runs.jsonl | 905 | 905 | 7 | 227 |
| inputs/xml/figml-export (7).xml | 120,224 | 120,212 | 1,581 | 30,053 |
| **TOTAL** | **1,449,885** | **1,449,439** | — | **362,360** |

### `conventions.json` / `project-context.json` top-level key sizes

| Key | Chars | Owner |
|---|---|---|
| `loadedClassRegistry` | 264,140 | **both** (identical) |
| `conventions` | 69,082 | project-context (dup of conventions.json body) |
| `ngDeepCorpus` (130 entries, 36 reusable) | 42,602 | conventions.json |
| `classVocabulary` (281 entries) | 26,213 | conventions.json |

### Instrumented read counts (fs shim, real project)

| Command | user read calls | unique user files | bytes (user) | project-source reads | project-source unique | readdir |
|---|---|---|---|---|---|---|
| resolve | 2 | 2 | 572,813 | **0** | 0 | 0 |
| spec | 2 | 2 | 572,813 | **0** | 0 | 0 |
| fidelity | 1 | 1 | 120,224 | **0** | 0 | 0 |
| referee | 542 | 541 | 3,403,989 | **539** | **538** | 2 |
| verify (kebab) | 9 | 9 | 502,547 | 7 | 7 | 12 |

`resolve`/`spec` `bytesReadUser = 572,813` = design XML (120 KB) + `conventions.json` (452 KB), both under `.sliceui` — no project source.

### Source-file counts scanned by `referee` (target project)

html 175 · scss 151 · css 36 · component.ts 176 → ~1.1 MB concatenated HTML+SCSS+CSS.

---

## Appendix C: Duplicate Content Evidence

1. **`loadedClassRegistry` byte-identical across two files** — `JSON.stringify(project-context.loadedClassRegistry) === JSON.stringify(conventions.loadedClassRegistry) === true`; 14,083 entries; `source: "dist"`, file `dist/.../styles.css`.

2. **`conventions` byte-identical across two files** — `JSON.stringify(project-context.conventions) === JSON.stringify(conventions minus {loadedClassRegistry, generatedAt, inputHash, profile}) === true` (69,082 chars).

3. **`transcript.md` = `renderTranscript(transcript.json)`** — `render-transcript.mjs` is the sole writer (`transcribe.mjs:88`); the `.md` is a deterministic projection of the `.json` layout/tokens/icons/images.

4. **`pilar-reference.md`/`pilar-showcase.md`/`uii-profile.md` = projections of `pilar-catalog.mjs`/`pilar-showcase.mjs`** — `uii-profile.mjs:191,344` (`renderPilarReferenceMd`, `renderPilarShowcaseMd`) render directly from the catalog/showcase arrays; the catalog header declares `GENERATED by scripts/extract-pilar.mjs`.

5. **`spec.md` re-embeds** transcript elements (line 90-96 of spec.mjs), resolved idioms (line 102-109), and pruned reusable corpus (line 123-137) — all present in `transcript.json`/`resolved.json`/`conventions.json`.

---

## Appendix D: Commands Executed

All read-only unless noted. Key commands:

```
git status --short ; git rev-parse HEAD ; node --version
find src test scripts skill docs -type f
wc -l src/.../*.mjs
# artifact measurement (Node walk + stat + wc -m)
# duplication diff (Node JSON.stringify comparison)
# fs-trace + timing test inspection (cat test/fs-trace.test.mjs, test/timing.test.mjs)
# read-only instrumentation:
#   node --import /tmp/sliceui-shim/register.mjs .../cli.mjs resolve|spec|fidelity <xml>   (temp .sliceui copy)
#   node --import .../cli.mjs referee --target TestingcomponentComponent                  (real project, read-only)
#   node --import .../cli.mjs verify <dir> testingcomponent                               (real project, read-only)
```

No source, artifact, or documentation file in the repository was modified. The instrumentation shim (`/tmp/sliceui-shim/`) and temporary `.sliceui` copy (`/tmp/sliceui-audit-*`) live outside the repository.

---

*End of audit. Nothing was implemented, refactored, or fixed — this report only documents findings and recommendations.*
