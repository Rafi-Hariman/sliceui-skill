# Foundation — PRD

Last update: 2026-09-10
Status: Live

---

## 1. Description

Product requirements for SliceUI: an agent skill + CLI that converts UI designs (Figma FIGML XML preferred, screenshot fallback) into component code that drops into the target project's framework, version, and UI-library idiom — gated by deterministic verification.

## 2. Important

SliceUI is built for **text-only coding agents** (models that cannot see images). Transcription is the product: the design becomes a structured text transcript; codegen is driven from the transcript plus a mined model of the project's conventions. Angular 13 is the primary, verify-gated target; all other frameworks are explicitly experimental and not verify-gated. Authority for the honesty claims is the README framework matrix (verified against codebase, 2026-09-10).

## 3. Table of Contents

- [4. Scope](#4-scope)
- [5. Goals](#5-goals)
- [6. Non Goals](#6-non-goals)
- [7. Vision Statement](#7-vision-statement)
- [8. Target Personas](#8-target-personas)
- [9. Core Business Value](#9-core-business-value)
- [10. User Journeys & App Flow](#10-user-journeys--app-flow)
- [11. Feature Workflows](#11-feature-workflows)
- [12. Functional Requirements](#12-functional-requirements)
- [13. Non-Functional Requirements (NFRs)](#13-non-functional-requirements-nfrs)
- [14. Acceptance Criteria](#14-acceptance-criteria)
- [14b. External Dependencies & Partners](#14b-external-dependencies--partners)
- [Success Metrics](#success-metrics)
- [Related Documents](#related-documents)
- [Open Questions](#open-questions)

## 4. Scope

SliceUI as a product: pipeline commands, gates, artifacts, and framework support matrix. Does not cover internal module structure (`foundation/architecture.md`).

## 5. Goals

- One design → idiomatic component files the agent writes with confidence, because a blocking gate confirms exit 0.
- Reuse the project's own libraries and classes (`capabilities` + `conventions`), never invent.
- Honest per-layer framework support: no silent "supported" claim without a verify gate.

## 6. Non Goals

- Not a pixel-to-pixel diff/preview tool (no automatic pixel-diff metric).
- Not a generic design-system manager.
- No telemetry; never phones home.
- No server component; 100% local execution (Gemini tier sends the image to Google with the user's own key — that's the only network egress).

## 7. Vision Statement

Any coding agent — even one that cannot see images — slices a design into component code that looks like the team wrote it, and the gate proves it before the agent claims success.

## 8. Target Personas

1. **Agentic developer (primary):** uses Claude Code/Cursor/GLM Code daily, gets a Figma design, wants the component in the project's idiom without hand-wiring libraries.
2. **Org platform team (UIIGateway context):** maintains private UI libraries (pilar) and wants generated code constrained to the org's component vocabulary — not raw HTML.
3. **Contributor:** develops the CLI/skill itself in this repo.

## 9. Core Business Value

- Removes the "agent guesses the UI" failure mode: transcript-driven codegen with exact text/colors/geometry (~90%+ attribute fidelity on the XML tier).
- Closes the loop: `verify` (post-generate) + `referee` (pre-generate) make "gate green" a trustworthy signal instead of a lottery.
- Org-private grammars let an internal team get full library-constrained codegen while the public package ships none of that source.

## 10. User Journeys & App Flow

**Journey A — XML-first (preferred):**
1. Export Figma via FIGML plugin → `design.xml`.
2. `sliceui init` (once per project) → `.sliceui/` + `project-context.json` + `conventions.json`.
3. `sliceui transcribe design.xml` → deterministic parse, fidelity %, no key.
4. `sliceui resolve` → every styled leaf → exact idiom candidates.
5. `referee` green → agent writes `.ts`/`.html`/`.scss` from transcript + project context.
6. `sliceui verify <dir> <name>` exit 0 → slice done.

**Journey B — Screenshot fallback:** same flow; transcribe goes Gemini (user key) → macOS static → OCR. Degrades gracefully tier-by-tier.

## 11. Feature Workflows

- **init:** scaffold `.sliceui/{images,xml,transcript}/`, config, `.env.local`, gitignore; runs detect → project-context + conventions; runs referee codebase head → corruption map at setup.
- **transcribe:** FIGML parse (tier 0, exact) or Gemini/static/OCR fallback; writes `transcript.md/json + .meta.json`; stamps the input path for staleness checks.
- **resolve:** styled leaf → `resolved[]` idiom candidates keyed on design evidence (color, icon, Figma name).
- **referee:** pre-generate ground-truth validation against design + codebase; red → refresh artifacts before codegen.
- **verify:** post-generate blocking gate (fidelity + conventions + structure); exit 0 required. v0.14/0.15 added headless render probes (CSS-cascade check + real Angular mount) in CI.
- **doctor:** environment diagnosis; missing Gemini key = warning (XML/static tiers need none).
- **install/uninstall/update:** skill installation into agent CLIs' skill dirs.

## 12. Functional Requirements

1. FR-1 XML input must parse deterministically with no network, no key.
2. FR-2 Transcripts must be stamped with the input path (`transcript.meta.json`) so staleness is detectable.
3. FR-3 Generated code must reuse project capabilities (library per UI category) with resolution precedence: local usage > installed package > null (plain HTML + note).
4. FR-4 `verify` must fail (exit 1) on: missing text, invented classes, structural wrappers the design doesn't show, dropped filters/buttons/table options, wrong icon-for-color mapping, dead bindings.
5. FR-5 A verify run with no ground truth must never be green.
6. FR-6 Org-private grammars (pilar) load only when present; the public package must contain zero private source.
7. FR-7 Framework honesty: deep adaptation (verify + convention mining) is Angular-only today; other frameworks get detection + neutral transcription + syntax rules and are labeled experimental.
8. FR-8 The transcript/XML owns ALL visible appearance; samples own only wiring idiom (the "division of authority" invariant from SKILL.md).

## 12b. Non-Functional Requirements (NFRs)

1. NFR-1 No telemetry; key never committed or logged.
2. NFR-2 XML tier ~90%+ attribute fidelity (README claim, verified by `sliceui fidelity`).
3. NFR-3 Node >= 20; CI on ubuntu; macOS static tier manually tested (known gap).
4. NFR-4 The full test suite must pass before publish (prepublishOnly).

## 14. Acceptance Criteria

1. A slice is "done" only when `sliceui verify` exits 0.
2. `referee` red → artifacts refreshed before any codegen.
3. Generated component builds and renders all transcript strings + design colors (render probes in CI assert the mechanism).
4. Non-Angular output carries an explicit experimental note; never a guessed library.

## 14b. External Dependencies & Partners

- **Figma FIGML plugin** — XML export format (input format contract).
- **Google Gemini API** — screenshot tier 1 (user's own key; image egress to Google).
- **pilar** (org-private UI library) — optional grammar source, private npm registry `npm.uii.ac.id`.
- **macOS Vision (Swift)** — static OCR tier.

## Success Metrics

- Fidelity score (XML tier) ≥ 90% on real designs.
- Verify false-positive friction trending down (experience reports show ~15–20 min lost per slice when it isn't) — tracked in phases.
- Zero private-source files in the public package (publish guard enforces).

## Related Documents

- `development/api-contract.md` — artifact schemas the pipeline exchanges
- `foundation/architecture.md` — module map realizing these requirements
- `foundation/phases/` — which requirements shipped in which phase
- `skill/SKILL.md` — the agent-facing workflow realizing FR-8's authority rules

## Open Questions

- React/Next/Vue/Svelte deep adaptation timing (fr7) — roadmap decision pending (see status.md).
- Whether `foundation/changelog.md` should eventually publish (currently internal).
