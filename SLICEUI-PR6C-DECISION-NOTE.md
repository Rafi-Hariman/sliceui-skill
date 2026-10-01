# PR 6C Pre-Implementation Decision Note

> Working artifact (§7 / §56 Phase 2). Root-level planning file — **never staged**, same as the
> other `SLICEUI-*.md` prompts. Written before any source change.

## 0. Checkpoint and baseline

```
checkpoint:      60a0835 (HEAD; ancestor check PASS)
node:            v20.19.5 · npm 10.8.2
baseline focused 194 pass / 0 fail / 0 skip
baseline full    486 tests / 483 pass / 3 pre-existing skip / 0 fail
working tree     22 untracked (21 planning prompts + tester.xml) · 0 modified · 0 unknown
```

PR 6B invariants re-verified live (all PASS): required missing/ambiguous/mismatch → `fail`;
optional ambiguous → `warn`; optional missing → `skip`; zero-required → `unverifiable`.

## 1. Design-fact vocabulary actually available (the real constraint)

The §9 oracle is `transcript.json`. The vocabulary is set by **`src/lib/figml-parse.mjs`**, not by
`transcript-schema.mjs` (which only shape-checks a permissive subset — `radius`, `border`, `gap`,
`cornerRadius`, `justify`, `style.family/letterSpacing` all pass validation without appearing in it).

Emitted per node, by type:

| fact | emitted from | to which node types |
| :--- | :--- | :--- |
| `x/y/w/h`, `bg`, `hidden` | every node | all |
| `radius` (uniform) | `cornerRadius` | group / image / divider |
| `cornerRadius{tl,tr,br,bl}` | per-corner attrs, **only when asymmetric** | group / image / divider |
| `border{color,width?}` | stroke (visible only) | group / image / divider / instance-types |
| `padding{top,right,bottom,left}` | `padding*` / `verticalPadding` etc. | group / instance-types |
| `gap` | `itemSpacing` — **PACKED auto-layout ONLY** | group / instance-types |
| `justify:"space-between"` | `primaryAxisAlignItems` — **only this value** | group / instance-types |
| `axis` | `layoutMode` (HORIZONTAL→row) | group / instance-types |
| `style{size,weight,color,family,lineHeight,letterSpacing}` | font attrs | text |
| `glyphName`, `description` | node name | text / icon / vector |

**Two hard limits found:**

1. **No alignment vocabulary beyond `space-between`.** `justifyContentOf` returns `null` for every
   other value ("other alignment modes stay on `gap`"). No `alignItems` is emitted at all. So
   "center alignment", "align to container end", "vertical center" have **no design-fact source**.
2. **No row/cell granularity.** There is no `row`/`cell` node type. A Figma table exports as a frame
   of row-frames of text nodes. "Header row height" / "cell padding" would require per-row/per-cell
   facts the format never carries — the parser is out of scope (§5 "no parser rewrite"), so these
   cannot be derived from the oracle.

## 2. Coverage matrix — all 38 families from §8, explicit disposition

Legend: **IMPL** = implement · **MAP** = implement via locator map · **NOEV** = unsupported, no
defensible design fact · **DECIDE** = needs user scope decision.

### Structural / flex gaps
| family | evidence | disposition |
| :--- | :--- | :--- |
| structural / flex gaps | `gap` (PACKED) | **IMPL** required when node declares `gap` |
| label-to-control gap | sibling `gap` on the field's parent | **IMPL** (structural fallback: sibling bbox distance) |
| button-group gap | `gap` on the button row | **IMPL** |
| icon-to-text gap | `gap` on the instance's row | **IMPL** via map (icon is `glyphName`, not text) |
| toolbar gap | `gap` on toolbar frame | **IMPL** |
| header-to-content spacing | no common parent frame in export | **NOEV** |

### Table
| family | evidence | disposition |
| :--- | :--- | :--- |
| table header row height | no row-height fact | **NOEV** |
| table header cell padding | no cell fact | **NOEV** |
| table header typography | text `style` on header text nodes | **IMPL** (role mapping) |
| table body-row height | no row-height fact | **NOEV** |
| table body-cell padding | no cell fact | **NOEV** |
| table body typography | text `style` | **IMPL** (role mapping) |
| checkbox / action column alignment | no `alignItems` | **NOEV** |
| table footer height | `h` on the footer row frame | **MAP** (optional) |
| table footer padding / gap | `padding` / `gap` on footer frame | **MAP** |
| footer information-text alignment | no `alignItems` | **NOEV** |

### Pagination
| family | evidence | disposition |
| :--- | :--- | :--- |
| pagination control height | `h` on pagination container | **MAP** |
| pagination item size | `w`/`h` on item nodes | **MAP** |
| pagination item gap | `gap` on container | **MAP** |
| pagination relative position | no `justify` beyond space-between | **NOEV** |
| pagination alignment | no `alignItems` | **NOEV** |

### Alignment
| family | evidence | disposition |
| :--- | :--- | :--- |
| section / toolbar relative alignment | `justify:"space-between"` only | **IMPL** (space-between only) |
| required-element containment | structural, measured | **IMPL** |

### Overflow / clipping
| family | evidence | disposition |
| :--- | :--- | :--- |
| overflow-x / overflow-y | structural (defect detector) | **IMPL** |
| text clipping | structural | **IMPL** |
| valid truncation | needs explicit design evidence | **RESOLVED: unsupported** — documented, never approximated (§25) |
| expected table scroll | needs explicit design evidence | **RESOLVED: unsupported** — defect side only; `overflow:hidden` alone never fails (§24 r3) |

### Border / radius
| family | evidence | disposition |
| :--- | :--- | :--- |
| border widths | `border.width` | **IMPL** |
| border styles | **not emitted** by the parser | **NOEV** |
| border colors | `border.color` | **IMPL** |
| per-corner radius | `radius` / `cornerRadius{tl,tr,br,bl}` | **IMPL** |

### Font / typography
| family | evidence | disposition |
| :--- | :--- | :--- |
| font-family evidence | `style.family` | **IMPL** |
| font fallback | `style.family` + `document.fonts.check` | **IMPL** |
| heading / label / body / helper typography | `style` + role | **IMPL** (role) |
| table / button / status / footer / pagination typography | `style` + role | **IMPL** (role) |

### Enabling mechanism
| family | disposition |
| :--- | :--- |
| selector-map coverage | **IMPL** (locator-only, §10/§11) |

**Tally:** IMPL 20 · MAP 5 · **NOEV 11** · DECIDE 0 (both resolved to NOEV, user-approved).

**User decisions (recorded):**
1. **Table density** — implement typography density (header/body `style`) + table/footer/pagination
   frames; declare header/body **row height** and **cell padding** explicitly unsupported, citing
   that `figml-parse.mjs` emits no row/cell node type. §54's row-density criteria are recorded as
   evidence-blocked, not silently dropped.
2. **Overflow** — implement the **defect side** as blocking (unintended scrollWidth/scrollHeight
   overflow, clipped required text, off-viewport required control). An explicit "expected scroll" /
   "valid truncation" contract is **unsupported** (no design evidence) rather than approximated.
   `overflow:hidden` alone never fails.

**Deviation from §54 (declared, per the user decision):** the acceptance checkbox "table row density
implemented" cannot be satisfied without either a fake oracle or a parser rewrite. It is recorded as
**evidence-blocked** rather than claimed. Full PR 6 closure verification must judge that explicitly.

## 3. Selector-map ownership and shape

Fixture-scoped, locator-only (§10). Lives beside the fixture:
`test/fixtures/render-geometry/<variant>/geometry.map.json`. Never carries expected values; §11
validation rejects `expected*` fields, script content, path-like selectors, unbounded length,
duplicate `designNodeId`, unknown schema version. Missing target → non-green when required;
>1 match → ambiguous, never first-picked (§30).

Why needed: a design node's identity is its `id` (e.g. `btn1`), but the rendered DOM has no marker
for it. The transcript alone cannot bind `btn1` → a specific `<button>`; text/role heuristics are
the PR 6B approach and they run out for repeated structural nodes (pagination items, table rows).

## 4. Fact-to-box semantics (§12)

`border-box` (design frame IS the rendered box) · `content-box` (padding-excluded) · `container-frame`
(optional) · `sibling-distance` (structural) · `edge-delta` / `center-delta` (relations) ·
`containment` (relation) · `text-line-box` · `typography-style`. Canvas `x/y` is **never** copied to
internal layout expectations.

## 5. Required / optional, tolerances, sampling

- required: root padding, control height, line-height, divider, declared `gap`, border color/width,
  radius, font-family (when expected font is a literal fact), overflow violation.
- optional: button frame height, table frame, footer container frame, pagination container.
- tolerances centralized in `GEOMETRY_TOLERANCE`, extended by family (spacing, table, pagination,
  border, radius, font-size, letter-spacing); all derived from 3-run variance + subpixel allowance.
- sampling: bounded max N rows/cells, deterministic selection, report min/max/median/count; a
  required outlier is **never** hidden by a passing median.
- **AGG-001 preserved:** zero required facts → `unverifiable`, exit 3.

## 6. Fixture variants (§37)

Extend `test/fixtures/render-geometry/` — prefer one `known-good` + small overrides over duplicated
trees. New: `table-pagination/` (3+ rows, footer, pagination), `gaps/`, `border-radius/`,
`typography/`, plus defect overrides. All synthetic, no private data.

## 7. Files to change

```
src/framework/angular/render-geometry.mjs        (families + tolerances)
src/framework/angular/selector-map.mjs           (NEW — schema + validate)
src/framework/angular/render-verify.mjs          (bounded integration only)
test/render-geometry.test.mjs · test/selector-map.test.mjs (NEW)
test/fixtures/render-geometry/**                 (variants + maps)
skill/SKILL.md · api-contract.md · verify-gate-trust.md · foundation/status.md
```

**Not changed:** parser, resolver, referee, snapshot, static verify, CLI surface, package contract.

---

## Corrective-Patch Addendum (OVF-001 / BOR-001 / SCH-001)

Appended at corrective-patch time. The findings below were reproduced pre-fix with actual output
(see the focused re-verification result).

### Root cause

- **OVF-001** — `collectGeometryFacts` emits only one `overflow-x` fact on the page container; there
  is no `overflow-y`, no off-viewport check, and no per-mapped-element scroll-overflow check. The
  docs claim clipped-text and off-viewport are "implemented and blocking" — they are not.
- **BOR-001** — the border fact measures only `borderTopWidth`/`borderTopColor`. A uniform design
  border is one stroke fact, but a correct render must honor all four sides; measuring one side
  silently passes a wrong bottom/left/right border.
- **SCH-001** — `validateSelectorMap` uses an exact-match, shallow denylist (`FORBIDDEN_EXPECTED_FIELDS`).
  `expectedScroll`/`allowOverflow`/`validTruncation`/case variants/nested fields are accepted.

### Policy decision (recording, per §2 "do not narrow the claim to avoid implementing")

- Implement the **objective** overflow defects for the page container (x + y) and for **mapped
  required elements** (scroll overflow = off-container/clipping, and bounding-rect-outside-viewport).
- Off-viewport/off-container scope is **mapped required elements only** (§7 says "required mapped
  element"; text/role-mapped facts are heuristic and can't guarantee a single semantic element).
- `overflow:hidden` alone still never fails — only measurable scroll overflow or out-of-viewport loss.
- expected-scroll and valid-truncation remain NOEV; no semantic exception field is added.
- Uniform design `border` → all four sides expected equal (width + color). Divider stays top-edge
  (a divider IS a single line). Border style stays NOEV.
- Selector map moves to a **strict schema allowlist** (root/mapping/locator) PLUS a recursive,
  case/separator-normalized semantic-field rejection as defense-in-depth.

### Files to change

`render-geometry.mjs` (overflow + full-side border) · `selector-map.mjs` (allowlist + recursive
strictness) · `render-verify.mjs` (no change expected — aggregation already handles arrays/numeric) ·
`test/render-geometry.test.mjs` + `test/selector-map.test.mjs` (regressions + negatives) ·
`api-contract.md` / `verify-gate-trust.md` / `skill/SKILL.md` (docs) · `status.md` only if stale.
