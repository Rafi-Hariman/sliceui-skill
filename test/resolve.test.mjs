import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveTranscript } from "../src/lib/resolve.mjs";

const CONVENTIONS = {
  ngDeepCorpus: [
    { selector: "label-custom-waiting .fa-exclamation-circle", block: "::ng-deep .label-custom-waiting .fa-exclamation-circle { color: #bd3737 !important; }" },
    { selector: "label-custom-rejected .fa-times-circle", block: "::ng-deep .label-custom-rejected .fa-times-circle { color: #f44444; }" },
    { selector: "label-custom-belum-diverif .fa-exclamation-circle", block: "::ng-deep .label-custom-belum-diverif .fa-exclamation-circle { color: #bd3737; }" },
  ],
  classVocabulary: [
    { name: "label-custom-waiting", family: "label-custom" },
    { name: "label-custom-rejected", family: "label-custom" },
  ],
};

test("resolve: badge #fef2f2 + icon #f44444 → fa-exclamation-circle (NOT triangle)", () => {
  const transcript = {
    layout: [
      { id: "badge1", type: "group", bg: "#fef2f2", children: [
        { id: "icon1", type: "icon", bg: "#f44444" },
      ]},
    ],
  };
  const r = resolveTranscript(transcript, CONVENTIONS);
  assert.equal(r.statusTable.length, 1);
  const status = r.statusTable[0];
  const icons = status.resolved.filter((x) => x.kind === "icon").map((x) => x.value);
  assert.ok(icons.includes("fa-exclamation-circle"), "red #f44444 → fa-exclamation-circle, not triangle");
  assert.ok(!icons.includes("fa-exclamation-triangle"), "must NOT invent triangle");
});

test("resolve: label co-occurrence surfaces candidates, never guesses by bg alone", () => {
  const transcript = {
    layout: [
      { id: "badge1", type: "group", bg: "#fef2f2", children: [
        { id: "icon1", type: "icon", bg: "#f44444" },
      ]},
    ],
  };
  const r = resolveTranscript(transcript, CONVENTIONS);
  const status = r.statusTable[0];
  // The icon pairs with several labels → ambiguity surfaced, not silently guessed.
  assert.ok(status.candidates || status.resolved.some((x) => x.value.startsWith("label-custom-")),
    "label is resolved via co-occurrence, and ambiguity is surfaced");
});

test("resolve: OOV badge (no label-custom-* pairs icon) → native-plain fallback, not silent drop", () => {
  const transcript = {
    layout: [
      { id: "badge1", type: "group", bg: "#fef2f2", children: [
        { id: "icon1", type: "icon", bg: "#4fbbbb" }, // green check — not in the small corpus
      ]},
    ],
  };
  const r = resolveTranscript(transcript, CONVENTIONS);
  const status = r.statusTable[0];
  assert.ok(status.fallback, "OOV → fallback present (never silent drop)");
  assert.equal(status.fallback.kind, "native-plain");
});

test("resolve: bare icon resolves its color to the fa-* set", () => {
  const transcript = {
    layout: [
      { id: "caret", type: "icon", bg: "#03337b" },
    ],
  };
  const r = resolveTranscript(transcript, CONVENTIONS);
  const leaf = r.leaves.find((l) => l.id === "caret");
  assert.ok(leaf.resolved.some((x) => x.value.startsWith("fa-")), "blue icon → a fa-* glyph");
});

test("resolve: non-styled structural nodes are skipped", () => {
  const transcript = {
    layout: [
      { id: "text", type: "text", text: "Ubah tagihan" },
      { id: "frame", type: "group", children: [] },
    ],
  };
  const r = resolveTranscript(transcript, CONVENTIONS);
  assert.equal(r.leaves.length, 0, "text + empty group are not styled leaves");
});

test("resolve: caret icon resolves by NAME (fa-caret-down), not color-first fa-search", () => {
  const transcript = {
    layout: [
      { id: "caret1", type: "icon", bg: "#03337b", description: "Icon_Font_Awesome_Free_Solid_C_caret-down" },
    ],
  };
  const r = resolveTranscript(transcript, CONVENTIONS);
  const icon = r.leaves.find((l) => l.kind === "icon");
  const vals = icon?.resolved?.map((x) => x.value) ?? [];
  assert.ok(vals.includes("fa-caret-down"), `caret name must resolve fa-caret-down, got ${JSON.stringify(vals)}`);
  assert.ok(!vals.includes("fa-search"), "caret must not be color-collapsed into fa-search");
});

test("resolve: eye icon nested under a Vector leaf inherits the FA name from its wrapper (not fa-search)", () => {
  // Real FIGML web-export shape: the FA glyph name sits on the INSTANCE wrapper (color-less);
  // the painted, colored leaf is its inner `Vector` child. The leaf must inherit the wrapper name.
  const transcript = {
    layout: [
      { id: "wrap", type: "icon", description: "Icon_Font_Awesome_Free_Solid_E_eye", children: [
        { id: "vec", type: "icon", description: "Vector", bg: "#03337b" },
      ]},
    ],
  };
  const r = resolveTranscript(transcript, CONVENTIONS);
  const icon = r.leaves.find((l) => l.id === "vec");
  assert.ok(icon, "the Vector leaf is the resolvable styled leaf");
  const vals = icon.resolved.map((x) => x.value);
  assert.ok(vals.includes("fa-eye"), `eye wrapper name must resolve fa-eye, got ${JSON.stringify(vals)}`);
  assert.ok(!vals.includes("fa-search"), "eye must NOT collapse to color-default fa-search");
});

test("resolve: pencil-alt icon nested under a Vector leaf inherits the FA name from its wrapper", () => {
  const transcript = {
    layout: [
      { id: "wrap", type: "icon", description: "Icon_Font_Awesome_Free_Solid_P_pencil-alt", children: [
        { id: "vec", type: "icon", description: "Vector", bg: "#03337b" },
      ]},
    ],
  };
  const r = resolveTranscript(transcript, CONVENTIONS);
  const icon = r.leaves.find((l) => l.id === "vec");
  const vals = icon?.resolved?.map((x) => x.value) ?? [];
  assert.ok(vals.includes("fa-pencil"), `pencil wrapper name must resolve fa-pencil, got ${JSON.stringify(vals)}`);
  assert.ok(!vals.includes("fa-search"), "pencil must NOT collapse to color-default fa-search");
});

test("resolve: ambiguous-color bare icon with NO name surfaces the family + a fallback, not a confident fa-search", () => {
  // #03337b is search/pencil/eye alike; a bare leaf (generic "Vector") carries no glyph signal,
  // so the resolver must NOT emit a confident single answer — it surfaces the family + a note
  // and leaves the pick to the action context (H1: honesty over false confidence).
  const transcript = {
    layout: [
      { id: "bare", type: "icon", description: "Vector", bg: "#03337b" },
    ],
  };
  const r = resolveTranscript(transcript, CONVENTIONS);
  const icon = r.leaves.find((l) => l.id === "bare");
  const vals = icon?.resolved?.map((x) => x.value) ?? [];
  assert.deepEqual(vals.sort(), ["fa-eye", "fa-pencil", "fa-search"], "ambiguous color surfaces the whole fa family");
  assert.ok(icon.fallback, "ambiguity must be flagged, not silent");
  assert.match(icon.fallback.note, /ambiguous/i);
});

test("resolve: unambiguous-color bare icon (single family) still resolves to that glyph", () => {
  const transcript = {
    layout: [
      { id: "check", type: "icon", description: "Vector", bg: "#4fbbbb" }, // single: fa-check-circle
    ],
  };
  const r = resolveTranscript(transcript, CONVENTIONS);
  const icon = r.leaves.find((l) => l.id === "check");
  const vals = icon?.resolved?.map((x) => x.value) ?? [];
  assert.ok(vals.includes("fa-check-circle"), `single-family color resolves its glyph, got ${JSON.stringify(vals)}`);
  assert.equal(icon.fallback, null, "no ambiguity → no fallback");
});

test("resolve: badge with status text 'Dibatalkan' → label-custom-cancel (text beats color co-occurrence)", () => {
  const vocab = [
    ...CONVENTIONS.classVocabulary,
    { name: "label-custom-cancel", family: "label-custom" },
    { name: "label-custom-warning", family: "label-custom" },
  ];
  const transcript = {
    layout: [
      { id: "badgeB", type: "group", bg: "#f6cacb", children: [
        { id: "iconB", type: "icon", bg: "#f44444" },
        { id: "txtB", type: "text", text: "Dibatalkan" },
      ]},
    ],
  };
  const r = resolveTranscript(transcript, { ...CONVENTIONS, classVocabulary: vocab });
  const status = r.statusTable[0];
  const classes = status.resolved.filter((x) => x.kind === "class").map((x) => x.value);
  assert.ok(classes.includes("label-custom-cancel"), `'Dibatalkan' text must pick cancel, got ${JSON.stringify(classes)}`);
});

test("resolve: button variant secondary → btn-secondary when in vocabulary", () => {
  const vocab = [
    ...CONVENTIONS.classVocabulary,
    { name: "btn-secondary", family: "btn", hint: "button" },
    { name: "btn-primary", family: "btn", hint: "button" },
  ];
  const transcript = {
    layout: [
      { id: "btn1", type: "button", text: "Ubah massal tgl akhir bayar", variant: "secondary" },
    ],
  };
  const r = resolveTranscript(transcript, { ...CONVENTIONS, classVocabulary: vocab });
  const btn = r.leaves.find((l) => l.kind === "button");
  const classes = btn?.resolved?.map((x) => x.value) ?? [];
  assert.ok(classes.includes("btn-secondary"), `variant secondary → btn-secondary, got ${JSON.stringify(classes)}`);
});

test("resolve: button variant with no matching btn-* falls back native-plain (not invented)", () => {
  const transcript = {
    layout: [{ id: "btn2", type: "button", text: "Kirim", variant: "ghost" }],
  };
  const r = resolveTranscript(transcript, CONVENTIONS); // no btn-ghost in vocab
  const btn = r.leaves.find((l) => l.kind === "button");
  assert.ok(btn.fallback?.kind === "native-plain", "unknown variant → native-plain fallback");
});

test("resolve: button with no variant maps white bg → btn-secondary (outline action)", () => {
  const vocab = [
    ...CONVENTIONS.classVocabulary,
    { name: "btn-secondary", family: "btn", hint: "button" },
    { name: "btn-primary", family: "btn", hint: "button" },
  ];
  const transcript = {
    layout: [{ id: "batal", type: "button", text: "Batal", bg: "#ffffff" }],
  };
  const r = resolveTranscript(transcript, { ...CONVENTIONS, classVocabulary: vocab });
  const btn = r.leaves.find((l) => l.id === "batal");
  const classes = btn?.resolved?.map((x) => x.value) ?? [];
  assert.ok(classes.includes("btn-secondary"), `white-bg button → btn-secondary, got ${JSON.stringify(classes)}`);
});

test("resolve: button with no variant maps solid bg → btn-primary", () => {
  const vocab = [
    ...CONVENTIONS.classVocabulary,
    { name: "btn-secondary", family: "btn", hint: "button" },
    { name: "btn-primary", family: "btn", hint: "button" },
  ];
  const transcript = {
    layout: [{ id: "simpan", type: "button", text: "Simpan", bg: "#b1bccc" }],
  };
  const r = resolveTranscript(transcript, { ...CONVENTIONS, classVocabulary: vocab });
  const btn = r.leaves.find((l) => l.id === "simpan");
  const classes = btn?.resolved?.map((x) => x.value) ?? [];
  assert.ok(classes.includes("btn-primary"), `solid-bg button → btn-primary, got ${JSON.stringify(classes)}`);
});

test("resolve: button with no variant and no btn-* in vocab falls back native-plain (not invented)", () => {
  const transcript = {
    layout: [{ id: "batal2", type: "button", text: "Batal", bg: "#ffffff" }],
  };
  const r = resolveTranscript(transcript, CONVENTIONS); // no btn-secondary/btn-primary in vocab
  const btn = r.leaves.find((l) => l.id === "batal2");
  assert.ok(btn.fallback?.kind === "native-plain", "no btn-* in vocab → native-plain fallback");
});

test("resolve: Icon_primary / Icon_white names are generic (no false glyph), contextual fallback", () => {
  // Report #1 §7.7 / #2 §4.7: "Icon_primary" is a primary-action icon with no FA name in the
  // XML. It must NOT masquerade as a glyph signal, and its fallback note must point the agent at
  // the action context (never a confident guess).
  const transcript = {
    layout: [
      { id: "get-data", type: "icon", bg: "#ffffff", description: "Icon_primary" },
      { id: "white-glyph", type: "icon", bg: "#3e82f3", description: "Icon_white" },
    ],
  };
  const r = resolveTranscript(transcript, CONVENTIONS);
  const leaf = r.leaves.find((l) => l.id === "get-data");
  assert.ok(leaf, "Icon_primary icon is resolved (not dropped)");
  assert.ok(leaf.fallback, "no FA name → fallback present");
  assert.match(leaf.fallback.note, /infer from the action context/i, "note points at action context");
});

test("resolve: F8 — a Figma variantName on an icon resolves the glyph (sync), not a fallback", () => {
  // 2026-09-11 F8: the "Get data" icon carried <variantProperties Name="sync"/>; the old fallback
  // suggested fa-cloud-download (wrong). The variant name IS the glyph signal.
  const transcript = {
    layout: [
      { id: "get-data", type: "icon", bg: "#ffffff", description: "Icon_primary", variantName: "sync" },
    ],
  };
  const r = resolveTranscript(transcript, CONVENTIONS);
  const leaf = r.leaves.find((l) => l.id === "get-data");
  assert.ok(leaf, "icon leaf resolved");
  assert.equal(leaf.fallback, null, "variant name gives a confident answer, not a fallback");
  // Pinned to the FA4 class name: the org's projects carry font-awesome@^4.7.0, where
  // `fa-sync-alt` (FA5+) does not exist and renders an empty box (2026-09-24, report §4.2).
  assert.deepEqual((leaf.resolved ?? []).map((x) => x.value), ["fa-refresh"], `resolved glyph is the FA4 sync glyph: ${JSON.stringify(leaf.resolved)}`);
});

test("resolve: an icon INSTANCE wrapper's variantName is inherited by its colored Vector child", () => {
  // The REAL field shape (2026-09-24, mahasiswa-tarif export): <variantProperties Name="sync"/>
  // sits on a COLORLESS Icon_primary INSTANCE; the painted, color-bearing leaf is its inner
  // Vector child (generic name). The child must inherit the wrapper's variant to resolve — the
  // F8 test above put variantName directly on the colored node, which masked this inheritance gap.
  const transcript = {
    layout: [
      {
        id: "get-data-wrapper", type: "icon", description: "Icon_primary", variantName: "sync",
        children: [{ id: "get-data-leaf", type: "icon", bg: "#ffffff", description: "Vector", glyphName: "Vector" }],
      },
    ],
  };
  const r = resolveTranscript(transcript, CONVENTIONS);
  const leaf = r.leaves.find((l) => l.id === "get-data-leaf");
  assert.ok(leaf, "the Vector leaf is resolved");
  assert.deepEqual((leaf.resolved ?? []).map((x) => x.value), ["fa-refresh"], "inherits sync → fa-refresh");
});

test("resolve: F8 — fallback note no longer invents a specific (wrong) glyph example", () => {
  const transcript = {
    layout: [{ id: "x", type: "icon", bg: "#ffffff", description: "Icon_primary" }],
  };
  const r = resolveTranscript(transcript, CONVENTIONS);
  const leaf = r.leaves.find((l) => l.id === "x");
  assert.ok(!/fa-cloud-download/.test(leaf.fallback.note), "no invented glyph example in the fallback");
});

test("resolve: badge 'Aktif' bg #eef6ff is detected as a badge", () => {
  // Report #1 §6.6: "Aktif" badge (blue #eef6ff) must be recognized so it resolves to a
  // label-custom-* class, not a silent native-plain (which caused .label-aktif duplication).
  const transcript = {
    layout: [
      { id: "aktif", type: "group", bg: "#eef6ff", children: [
        { id: "c", type: "icon", bg: "#3e82f3" },
        { id: "t", type: "text", text: "Aktif" },
      ]},
    ],
  };
  const r = resolveTranscript(transcript, CONVENTIONS);
  const status = r.statusTable.find((s) => s.id === "aktif");
  assert.ok(status, "badge #eef6ff is recognized as a badge");
  assert.equal(status.evidence.statusText, "Aktif", "status text extracted");
});

// --- glyph-as-text (2026-09-10 §1.1/§1.2): empty text + glyph name resolves the toggle ---

test("resolve: empty-TEXT glyph with toggle-on name → fa-toggle-on (NOT the #03337b 3-icon family)", () => {
  // The reported failure: an action-column toggle glyph arrived as text `"" {15px w900 #1b3680}`;
  // the #03337b color resolved to [fa-search, fa-pencil, fa-eye] and the agent had to guess.
  const transcript = {
    layout: [
      { id: "tgl", type: "text", text: "", style: { size: 15, weight: 900, color: "#03337b" },
        glyphName: "Icon_Font_Awesome_Free_Solid_T_toggle-on" },
    ],
  };
  const r = resolveTranscript(transcript, CONVENTIONS);
  const leaf = r.leaves.find((l) => l.id === "tgl");
  assert.ok(leaf, "glyph-as-text leaf is resolved (not skipped)");
  assert.deepEqual(leaf.resolved, [{ kind: "icon", value: "fa-toggle-on" }]);
  assert.equal(leaf.fallback, null);
});

test("resolve: empty-TEXT glyph inherits the wrapper's glyphName (no glyphName of its own)", () => {
  // FIGML nests the glyph text under a named INSTANCE wrapper; the text itself is generic.
  const transcript = {
    layout: [
      { id: "wrap", type: "icon", description: "Icon_Font_Awesome_Free_Solid_E_eye", glyphName: "Icon_Font_Awesome_Free_Solid_E_eye",
        children: [
          { id: "vec", type: "text", text: "", style: { color: "#03337b" } },
        ]},
    ],
  };
  const r = resolveTranscript(transcript, CONVENTIONS);
  const leaf = r.leaves.find((l) => l.id === "vec");
  assert.ok(leaf, "inner glyph text resolved");
  assert.deepEqual(leaf.resolved, [{ kind: "icon", value: "fa-eye" }]);
});

test("resolve: toggle-off name resolves fa-toggle-off; bare toggle defaults to fa-toggle-on", () => {
  const transcript = {
    layout: [
      { id: "off", type: "text", text: "", style: { color: "#03337b" }, glyphName: "Icon_..._T_toggle-off" },
      { id: "bare", type: "text", text: "", style: { color: "#03337b" }, glyphName: "Icon_..._T_toggle" },
    ],
  };
  const r = resolveTranscript(transcript, CONVENTIONS);
  assert.deepEqual(r.leaves.find((l) => l.id === "off").resolved, [{ kind: "icon", value: "fa-toggle-off" }]);
  assert.deepEqual(r.leaves.find((l) => l.id === "bare").resolved, [{ kind: "icon", value: "fa-toggle-on" }]);
});

test("resolve: real text is never treated as a glyph, even with a glyphName present", () => {
  const transcript = {
    layout: [
      { id: "label", type: "text", text: "Ubah tagihan", style: { color: "#03337b" }, glyphName: "Icon_..._T_toggle-on" },
    ],
  };
  const r = resolveTranscript(transcript, CONVENTIONS);
  assert.equal(r.leaves.find((l) => l.id === "label"), undefined, "text with content is not an icon leaf");
});

// --- groups: dedup identical leaves (2026-09-10 §1.3: 1,659-line resolved.json) ---

test("resolve: 10 identical badges group into 1 entry with count+ids; leaves stay full", () => {
  const rows = Array.from({ length: 10 }, (_, i) => ({
    id: `badge${i}`, type: "group", bg: "#fef2f2", children: [
      { id: `icon${i}`, type: "icon", bg: "#f44444" },
      { id: `txt${i}`, type: "text", text: "Aktif" },
    ],
  }));
  const r = resolveTranscript({ layout: rows }, CONVENTIONS);
  const badgeGroups = r.groups.filter((g) => g.kind === "status");
  assert.equal(badgeGroups.length, 1, "all identical badges collapse to one group");
  assert.equal(badgeGroups[0].count, 10);
  assert.equal(badgeGroups[0].ids.length, 10);
  assert.equal(r.leaves.filter((l) => l.kind === "status").length, 10, "leaves remain per-node");
});

test("resolve: distinct evidence signatures stay in separate groups", () => {
  const transcript = {
    layout: [
      { id: "a1", type: "group", bg: "#fef2f2", children: [{ id: "i1", type: "icon", bg: "#f44444" }, { id: "t1", type: "text", text: "Dibatalkan" }] },
      { id: "a2", type: "group", bg: "#fef7ec", children: [{ id: "i2", type: "icon", bg: "#f9933f" }, { id: "t2", type: "text", text: "Belum bayar" }] },
    ],
  };
  const r = resolveTranscript(transcript, CONVENTIONS);
  assert.ok(r.groups.filter((g) => g.kind === "status").length === 2, "two distinct badges → two groups");
  assert.ok(r.groups.every((g) => g.count === 1), "each group has a single member");
});

// --- PR 4: provenance + semantic safety (typed resolution) ---

import { behaviorBindingRecommendations, confidenceLevel, CLASSIFICATIONS, AUTHORITIES, RESOLUTION_BUDGET, RESOLVED_SCHEMA_VERSION } from "../src/lib/resolution-policy.mjs";

test("PR4: every resolved group carries a valid classification/authority/confidence", () => {
  const transcript = {
    layout: [
      { id: "b1", type: "group", bg: "#fef2f2", children: [
        { id: "i1", type: "icon", bg: "#f44444" },
        { id: "t1", type: "text", text: "Dibatalkan" },
      ]},
      { id: "caret", type: "icon", bg: "#03337b", description: "Icon_Font_Awesome_Free_Solid_C_caret-down" },
      { id: "bare", type: "icon", description: "Vector", bg: "#03337b" },
      { id: "none", type: "icon", bg: "#abcdef" },
      { id: "btn", type: "button", text: "Kirim", variant: "ghost" },
    ],
  };
  const vocab = [...CONVENTIONS.classVocabulary,
    { name: "label-custom-cancel", family: "label-custom" },
    { name: "btn-secondary", family: "btn" }];
  const r = resolveTranscript(transcript, { ...CONVENTIONS, classVocabulary: vocab });
  for (const g of r.groups) {
    assert.ok(CLASSIFICATIONS.includes(g.classification), `classification valid: ${g.classification}`);
    assert.ok(AUTHORITIES.includes(g.authority), `authority valid: ${g.authority}`);
    assert.equal(typeof g.confidence, "number");
    assert.equal(typeof g.fallbackUsed, "boolean");
    assert.ok(g.provenance?.design?.length >= 1, "design provenance present");
    assert.ok(g.provenance?.mapping?.rule, "mapping provenance present");
  }
});

test("PR4: icon metadata (variantName) beats label text and color — sync stays sync", () => {
  // Metadata "sync" on the icon instance; the button label suggests search. Metadata wins;
  // the text-inference rung is never reached.
  const transcript = {
    layout: [
      { id: "btn", type: "button", text: "Cari data", children: [
        { id: "wrap", type: "icon", description: "Icon_primary", variantName: "sync", children: [
          { id: "vec", type: "icon", bg: "#ffffff", description: "Vector" },
        ]},
      ]},
    ],
  };
  const r = resolveTranscript(transcript, CONVENTIONS);
  const leaf = r.leaves.find((l) => l.id === "vec");
  assert.deepEqual((leaf.resolved ?? []).map((x) => x.value), ["fa-refresh"], "metadata sync → fa-refresh, label text never consulted");
  assert.equal(leaf.classification, "implementation-recommendation");
  assert.equal(leaf.authority, "hint");
  assert.equal(leaf.confidence, 0.95);
  assert.equal(leaf.fallbackUsed, false);
  assert.match(leaf.provenance.mapping.rule, /icon-alias-registry/);
});

test("PR4: corpus color icon is a semantic hypothesis, not a design fact", () => {
  const transcript = { layout: [{ id: "ic", type: "icon", bg: "#f44444" }] };
  // corpus has label-custom-waiting .fa-exclamation-circle with #f44444 in block? No — block has #bd3737. Use a color present in a corpus block.
  const conventions = { ...CONVENTIONS, ngDeepCorpus: [
    ...CONVENTIONS.ngDeepCorpus,
    { selector: "something .fa-eye", block: "::ng-deep .something .fa-eye { color: #03337b; }" },
  ]};
  const r = resolveTranscript(transcript, conventions);
  const leaf = r.leaves.find((l) => l.id === "ic");
  assert.equal(leaf.classification, "semantic-hypothesis");
  assert.equal(leaf.confidence, 0.7);
  assert.ok(leaf.provenance.project[0].source.includes("ngDeepCorpus"), "project provenance points at the corpus");
});

test("PR4: text-based icon resolution marks fallbackUsed and lowers confidence", () => {
  // No metadata anywhere (generic "Vector"), unknown color → unresolved, fallbackUsed true.
  const transcript = { layout: [{ id: "u", type: "icon", description: "Vector", bg: "#123456" }] };
  const r = resolveTranscript(transcript, CONVENTIONS);
  const leaf = r.leaves.find((l) => l.id === "u");
  assert.equal(leaf.classification, "unresolved");
  assert.equal(leaf.authority, "fallback");
  assert.equal(leaf.confidence, 0);
  assert.equal(leaf.fallbackUsed, true);
  assert.deepEqual(leaf.resolved, [], "no invented icon");
});

test("PR4: status text-table mapping is stronger than co-occurrence", () => {
  const vocab = [...CONVENTIONS.classVocabulary, { name: "label-custom-cancel", family: "label-custom" }];
  const t1 = { layout: [{ id: "a", type: "group", bg: "#f6cacb", children: [
    { id: "ai", type: "icon", bg: "#f44444" }, { id: "at", type: "text", text: "Dibatalkan" }] }] };
  const byText = resolveTranscript(t1, { ...CONVENTIONS, classVocabulary: vocab }).leaves[0];
  const t2 = { layout: [{ id: "b", type: "group", bg: "#fef2f2", children: [
    { id: "bi", type: "icon", bg: "#f44444" }] }] };
  const byCooc = resolveTranscript(t2, { ...CONVENTIONS, classVocabulary: [] }).leaves[0];
  assert.equal(byText.confidence, 0.85, "documented status-text table → 0.85");
  assert.ok(byCooc.confidence < byText.confidence, "co-occurrence scores lower");
  assert.equal(byText.provenance.mapping.rule, "status-text-table");
});

test("PR4: status color alone is never exact — the real 'Aktif' case stays a hint", () => {
  // The real field fixture: 'Aktif' badge #eef6ff + #3e82f3 icon → label-custom-active via
  // co-occurrence. It must be labelled a semantic-hypothesis hint, not presented as fact.
  const corpus = [{ selector: "label-custom-active .fa-check-circle", block: "::ng-deep .label-custom-active .fa-check-circle { color: #3e82f3; }" }];
  const transcript = { layout: [{ id: "aktif", type: "group", bg: "#eef6ff", children: [
    { id: "ic", type: "icon", bg: "#3e82f3" }, { id: "tx", type: "text", text: "Aktif" }] }] };
  const r = resolveTranscript(transcript, { ngDeepCorpus: corpus, classVocabulary: [] });
  const status = r.statusTable[0];
  const label = status.resolved.find((x) => x.kind === "class");
  assert.equal(label.value, "label-custom-active");
  assert.equal(status.classification, "implementation-recommendation");
  assert.equal(status.authority, "hint", "project idiom recommendation is never authoritative");
  assert.ok(status.confidence < 1, "co-occurrence can never reach exact");
});

test("PR4: confidence is deterministic — same input, same score and ordering", () => {
  const transcript = { layout: [{ id: "x", type: "icon", bg: "#03337b", description: "Vector" }] };
  const a = resolveTranscript(transcript, CONVENTIONS);
  const b = resolveTranscript(transcript, CONVENTIONS);
  assert.deepEqual(a.groups, b.groups, "identical output for identical input (incl. typing fields)");
});

test("PR4: candidate and evidence budgets hold", () => {
  const manyCorpus = Array.from({ length: 8 }, (_, i) => ({
    selector: `label-custom-x${i} .fa-exclamation-circle`, block: `::ng-deep .label-custom-x${i} .fa-exclamation-circle { color: #f44444; }`,
  }));
  const transcript = { layout: [{ id: "b", type: "group", bg: "#fef2f2", children: [
    { id: "i", type: "icon", bg: "#f44444" }] }] };
  const r = resolveTranscript(transcript, { ngDeepCorpus: manyCorpus, classVocabulary: [] });
  const status = r.statusTable[0];
  assert.ok((status.candidates ?? []).length <= RESOLUTION_BUDGET.maxCandidates, "candidates bounded");
  assert.ok((status.provenance.design ?? []).length <= RESOLUTION_BUDGET.maxEvidence, "design evidence bounded");
});

test("PR4: public API precedence — paginationAlign recommended, behavioral CSS rejected", () => {
  const transcript = { layout: [
    { id: "footer", type: "group", justify: "space-between", children: [
      { id: "info", type: "text", text: "Menampilkan 1-10 dari 20 data" },
    ]},
  ]};
  const pilar = { pilarComponents: [{ selector: "uii-table", inputs: [{ name: "paginationAlign", default: "'center'" }] }] };
  const recs = behaviorBindingRecommendations(transcript, pilar);
  assert.equal(recs.length, 1);
  const b = recs[0];
  assert.equal(b.implementation.category, "component-api");
  assert.equal(b.implementation.expression, "[paginationAlign]=\"'right'\"");
  // AUT-001: the top-level entry is a RECOMMENDATION → hint; the verified fact is the
  // capability existence, represented on the evidence entry, never on the recommendation.
  assert.equal(b.authority, "hint", "recommendation is a hint, not verified");
  assert.equal(b.confidence, 0.85);
  assert.equal(b.rejected.length, 1);
  assert.match(b.rejected[0].reason, /public component input/);
  assert.ok(b.evidence.some((e) => e.type === "structural-design-fact"));
  const cap = b.evidence.find((e) => e.type === "project-capability");
  assert.ok(cap, "capability evidence present");
  assert.equal(cap.authority, "verified", "capability existence is the verified fact");
  assert.equal(cap.component, "uii-table");
  assert.equal(cap.api, "paginationAlign");
});

test("PR4: no public API in catalog degrades to hint, never silently verified", () => {
  const transcript = { layout: [
    { id: "footer", type: "group", justify: "space-between", children: [
      { id: "info", type: "text", text: "Menampilkan 1-10 dari 20 data" },
    ]},
  ]};
  const b = behaviorBindingRecommendations(transcript, null)[0];
  assert.equal(b.authority, "hint");
  assert.equal(b.confidence, 0.7);
  assert.ok(b.provenance.project[0].note.includes("not machine-verified"));
});

test("PR4: no distributed-footer evidence → no paginationAlign recommendation (no modal-style guessing)", () => {
  const transcript = { layout: [{ id: "x", type: "text", text: "plain page" }] };
  assert.equal(behaviorBindingRecommendations(transcript, {}).length, 0, "absence of evidence → no recommendation");
});

test("PR4: resolveTranscript threads pilar into behaviorBindings", () => {
  const transcript = { layout: [
    { id: "footer", type: "group", justify: "space-between", children: [
      { id: "info", type: "text", text: "Menampilkan 1-10 dari 20 data" },
    ]},
  ]};
  const pilar = { pilarComponents: [{ selector: "uii-table", inputs: [{ name: "paginationAlign", default: "'center'" }] }] };
  const r = resolveTranscript(transcript, {}, pilar);
  assert.equal(r.behaviorBindings.length, 1);
  // AUT-001: recommendation is hint; verified capability lives on the evidence entry.
  assert.equal(r.behaviorBindings[0].authority, "hint");
  assert.equal(r.behaviorBindings[0].evidence.find((e) => e.type === "project-capability").authority, "verified");
  // Without pilar the same design still yields the recommendation, unverified.
  const r2 = resolveTranscript(transcript, {}, null);
  assert.equal(r2.behaviorBindings[0].authority, "hint");
});

test("PR4: confidenceLevel maps scores to named levels", () => {
  assert.equal(confidenceLevel(1.0), "exact");
  assert.equal(confidenceLevel(0.95), "high");
  assert.equal(confidenceLevel(0.85), "high");
  assert.equal(confidenceLevel(0.7), "medium");
  assert.equal(confidenceLevel(0.5), "low");
  assert.equal(confidenceLevel(0), "none");
});

test("PR4: resolved schema version exported", () => {
  assert.equal(RESOLVED_SCHEMA_VERSION, 2);
});

test("PR4: resolver + policy are snapshot-only (no fs/glob imports)", async () => {
  const { readFileSync } = await import("node:fs");
  const read = (p) => readFileSync(new URL(`../src/lib/${p}`, import.meta.url), "utf8");
  for (const mod of ["resolve.mjs", "resolution-policy.mjs", "agent-context.mjs"]) {
    const src = read(mod);
    assert.ok(!/from ["']node:fs["']|require\(["']fs["']\)|fg\.sync|fast-glob/.test(src), `${mod} stays pure (no fs/glob)`);
  }
});

test("PR4: artifact budget — provenance does not leak source bodies or full corpus blocks", () => {
  const corpus = [{ selector: "label-custom-waiting .fa-exclamation-circle", block: "::ng-deep .BIG-BODY ".repeat(50) }];
  const transcript = { layout: [{ id: "b", type: "group", bg: "#fef2f2", children: [
    { id: "i", type: "icon", bg: "#f44444" }] }] };
  const r = resolveTranscript(transcript, { ngDeepCorpus: corpus, classVocabulary: [] });
  const serialized = JSON.stringify(r.groups);
  assert.ok(!serialized.includes("BIG-BODY"), "no corpus block bodies leak into provenance");
  // provenance stores selectors/locators only — spot-check the size stays small.
  const provenanceChars = JSON.stringify(r.groups.map((g) => g.provenance)).length;
  assert.ok(provenanceChars < 2_000, `provenance bounded (got ${provenanceChars} chars for 1 group)`);
});

test("PR4: legacy schema-1 groups remain readable — v2 typing is purely additive", () => {
  // A schema-1 artifact carried only id/kind/type/evidence/resolved/fallback/count/ids. Every
  // one of those keys must still exist with the same meaning, so an older reader (or the agent
  // following the documented §10.5 contract) is not broken by the v2 typing fields.
  const transcript = { layout: [
    { id: "badge", type: "group", bg: "#fef2f2", children: [
      { id: "ic", type: "icon", bg: "#f44444" }, { id: "tx", type: "text", text: "Dibatalkan" }]},
  ]};
  const vocab = [...CONVENTIONS.classVocabulary, { name: "label-custom-cancel", family: "label-custom" }];
  const g = resolveTranscript(transcript, { ...CONVENTIONS, classVocabulary: vocab }).groups[0];
  for (const legacyKey of ["id", "kind", "type", "evidence", "resolved", "count", "ids"]) {
    assert.ok(legacyKey in g, `legacy field preserved: ${legacyKey}`);
  }
  assert.ok(Array.isArray(g.resolved) && g.resolved.every((x) => x.kind && x.value), "resolved[] shape unchanged");
  assert.equal(typeof g.count, "number");
  // …and the new fields are additive.
  for (const newKey of ["classification", "authority", "confidence", "fallbackUsed", "provenance"]) {
    assert.ok(newKey in g, `v2 field added: ${newKey}`);
  }
});

test("PR4: resolve → spec → agent-context roundtrip is consistent", async () => {
  const { buildSpec } = await import("../src/commands/spec.mjs");
  const { buildAgentContext } = await import("../src/lib/agent-context.mjs");
  const transcript = { layout: [
    { id: "footer", type: "group", justify: "space-between", children: [
      { id: "info", type: "text", text: "Menampilkan 1-10 dari 20 data" }]},
  ]};
  const pilar = { pilarComponents: [
    { selector: "uii-table", inputs: [{ name: "paginationAlign", default: "'center'" }] },
  ]};
  const behavior = behaviorBindingRecommendations(transcript, pilar)[0];
  const spec = buildSpec(transcript, {}, pilar);
  const { manifest } = buildAgentContext({ transcript, conventions: {}, projectContext: {}, pilar, design: "d" });
  // The same recommendation surfaces, with the same verified binding, in all three artifacts.
  assert.ok(spec.includes(behavior.implementation.expression), "spec carries the binding");
  assert.ok(manifest.implementationHints.some((h) => h.expression === behavior.implementation.expression), "agent-context carries the binding");
});

// --- PR 4 corrective patch: TAX-001 (status co-occurrence ambiguity) + AUT-001 (authority) ---

test("PR4-corrective: multiple equal co-occurrence candidates → no silent selection, candidates surfaced", () => {
  const corpus = [
    { selector: "label-custom-waiting .fa-exclamation-circle", block: "::ng-deep .label-custom-waiting .fa-exclamation-circle { color: #f44444; }" },
    { selector: "label-custom-warning .fa-exclamation-circle", block: "::ng-deep .label-custom-warning .fa-exclamation-circle { color: #f44444; }" },
    { selector: "label-custom-new-student .fa-exclamation-circle", block: "::ng-deep .label-custom-new-student .fa-exclamation-circle { color: #f44444; }" },
    { selector: "label-custom-rejected .fa-exclamation-circle", block: "::ng-deep .label-custom-rejected .fa-exclamation-circle { color: #f44444; }" },
  ];
  const t = { layout: [{ id: "b", type: "group", bg: "#fef2f2", children: [{ id: "i", type: "icon", bg: "#f44444" }] }] };
  const s = resolveTranscript(t, { ngDeepCorpus: corpus, classVocabulary: [] }).statusTable[0];
  // No class selected (no silent first-pick).
  assert.deepEqual(s.resolved.filter((x) => x.kind === "class"), [], "no label class selected");
  // Icon still resolved (independent of the label ambiguity).
  assert.deepEqual(s.resolved.filter((x) => x.kind === "icon").map((x) => x.value), ["fa-exclamation-circle"]);
  // Candidates surfaced and bounded.
  assert.equal(s.candidates.length, 3, "bounded to maxCandidates");
  assert.deepEqual(s.candidates, ["label-custom-waiting", "label-custom-warning", "label-custom-new-student"], "stable corpus order");
  assert.equal(s.classification, "semantic-hypothesis");
  assert.equal(s.authority, "hint");
  assert.equal(s.confidence, 0.5, "ambiguous tier");
  assert.equal(s.fallbackUsed, false, "no fallback invented for ambiguity");
  assert.equal(s.fallback, null);
  // Explicit diagnostic.
  assert.ok(s.diagnostics?.some((d) => d.code === "SUI-RESOLVE-STATUS-AMBIGUOUS"), "ambiguity diagnostic present");
});

test("PR4-corrective: one co-occurrence candidate still selects as hint (real Aktif case unchanged)", () => {
  const corpus = [{ selector: "label-custom-active .fa-check-circle", block: "::ng-deep .label-custom-active .fa-check-circle { color: #3e82f3; }" }];
  const t = { layout: [{ id: "a", type: "group", bg: "#eef6ff", children: [
    { id: "ic", type: "icon", bg: "#3e82f3" }, { id: "tx", type: "text", text: "Aktif" }] }] };
  const s = resolveTranscript(t, { ngDeepCorpus: corpus, classVocabulary: [] }).statusTable[0];
  const label = s.resolved.find((x) => x.kind === "class");
  assert.equal(label.value, "label-custom-active", "single candidate selected");
  assert.equal(s.classification, "implementation-recommendation");
  assert.equal(s.authority, "hint");
  assert.equal(s.confidence, 0.7, "corpus co-occurrence stays ≤0.70");
  assert.equal(s.provenance.mapping.rule, "corpus-cooccurrence");
  assert.equal(s.candidates, undefined, "no spurious candidate list for a single pick");
});

test("PR4-corrective: zero candidates remains unresolved + fallback, no invented class", () => {
  const t = { layout: [{ id: "b", type: "group", bg: "#fef2f2", children: [{ id: "i", type: "icon", bg: "#00ff00" }] }] };
  const s = resolveTranscript(t, CONVENTIONS).statusTable[0];
  assert.deepEqual(s.resolved.filter((x) => x.kind === "class"), []);
  assert.equal(s.classification, "unresolved");
  assert.equal(s.authority, "fallback");
  assert.equal(s.confidence, 0);
  assert.equal(s.fallbackUsed, true);
  assert.ok(s.fallback, "conservative fallback emitted");
});

test("PR4-corrective: multiple candidates ordering is stable regardless of corpus order", () => {
  const mk = (names) => names.map((n) => ({ selector: `${n} .fa-exclamation-circle`, block: `::ng-deep ${n} .fa-exclamation-circle { color: #f44444; }` }));
  const a = resolveTranscript({ layout: [{ id: "b", type: "group", bg: "#fef2f2", children: [{ id: "i", type: "icon", bg: "#f44444" }] }] }, { ngDeepCorpus: mk(["label-custom-a", "label-custom-b", "label-custom-c"]), classVocabulary: [] }).statusTable[0];
  const b = resolveTranscript({ layout: [{ id: "b", type: "group", bg: "#fef2f2", children: [{ id: "i", type: "icon", bg: "#f44444" }] }] }, { ngDeepCorpus: mk(["label-custom-c", "label-custom-a", "label-custom-b"]), classVocabulary: [] }).statusTable[0];
  // Corpus order IS the deterministic presentation order — same corpus order ⇒ same candidates.
  assert.deepEqual(a.candidates, ["label-custom-a", "label-custom-b", "label-custom-c"]);
  assert.deepEqual(b.candidates, ["label-custom-c", "label-custom-a", "label-custom-b"], "deterministic given input order");
  // But both remain ambiguous (no selection) — order never becomes a semantic winner.
  assert.deepEqual(a.resolved.filter((x) => x.kind === "class"), []);
  assert.deepEqual(b.resolved.filter((x) => x.kind === "class"), []);
  assert.equal(a.confidence, 0.5);
  assert.equal(b.confidence, 0.5);
});

test("PR4-corrective: more than maxCandidates is bounded to top 3, deterministic", () => {
  const names = Array.from({ length: 8 }, (_, i) => `label-custom-x${i}`);
  const corpus = names.map((n) => ({ selector: `${n} .fa-exclamation-circle`, block: `::ng-deep ${n} .fa-exclamation-circle { color: #f44444; }` }));
  const s = resolveTranscript({ layout: [{ id: "b", type: "group", bg: "#fef2f2", children: [{ id: "i", type: "icon", bg: "#f44444" }] }] }, { ngDeepCorpus: corpus, classVocabulary: [] }).statusTable[0];
  assert.equal(s.candidates.length, 3, "bounded to 3");
  assert.deepEqual(s.candidates, names.slice(0, 3), "top 3 in corpus order");
  assert.deepEqual(s.resolved.filter((x) => x.kind === "class"), [], "still no selection");
});

test("PR4-corrective: color-only status is never authoritative or high confidence", () => {
  const t = { layout: [{ id: "b", type: "group", bg: "#fef2f2", children: [{ id: "i", type: "icon", bg: "#f44444" }] }] };
  const s = resolveTranscript(t, CONVENTIONS).statusTable[0];
  assert.notEqual(s.authority, "authoritative");
  assert.ok(s.confidence < 0.85, "color-only never reaches high/exact");
});
