// project-render adapter — the interface over a REPRESENTATIVE Angular project fixture (owning
// AppModule → build → global stylesheet → component stylesheet → ViewEncapsulation → mount →
// evidence), plus the gated Pilar contract. This is NOT Bill/Pilar production rendering.
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeAdapter, classifyRender, RENDER_TIERS, collectDomEvidence, emptyDomEvidence } from "../../src/render/project-render-adapter.mjs";
import { layerApplicability, APPLICABILITY } from "../../src/verification/applicability.mjs";
import { fixtureReady, isSkip, mountAndCollect } from "./browser-harness.mjs";
import { resolvePilar } from "../../src/framework/angular/pilar-mount.mjs";

test("adapter: a representative Angular build mounts and collects evidence through the interface", async (t) => {
  if (!fixtureReady()) { t.skip("mount fixture deps missing"); return; }
  const adapter = makeAdapter({
    id: "angular-representative",
    tier: RENDER_TIERS.SYNTHETIC,
    detect: async () => fixtureReady(),
    mount: async () => mountAndCollect({
      html: `<div class="g"><span class="c">hello</span></div>`,
      scss: `.c{color:#303030}`,
      globalCss: `.g{background-color:#fef2f2}`,
      map: { g: ".g", c: ".c" },
    }),
  });
  assert.equal(await adapter.detect(), true);
  let evidence;
  try { evidence = await adapter.mount(); }
  catch (err) { if (isSkip(err)) { t.skip("chromium unavailable"); return; } throw err; }
  assert.ok(evidence.rects.size >= 2, "mount + DOM geometry collected");
  // Global stylesheet loading: the injected project CSS applied to the element.
  assert.equal(evidence.computedStyles.get("g").backgroundColor, "rgb(254, 242, 242)", "global project stylesheet took effect");
  // Component stylesheet + ViewEncapsulation: the component-scoped color applied.
  assert.equal(evidence.computedStyles.get("c").color, "rgb(48, 48, 48)", "component style took effect");
  assert.equal(classifyRender({ syntheticMounted: true }), RENDER_TIERS.SYNTHETIC, "honest tier: representative, not production");
});

test("adapter: the Pilar project-real mount is GATED (never a fake PASS when the checkout is absent)", () => {
  const checkout = process.env.PILAR_CHECKOUT ?? null;
  const pilar = resolvePilar(checkout);
  if (!pilar.ok) {
    assert.match(pilar.reason, /PILAR_CHECKOUT/, "gated on the private checkout");
    // The applicability model records project-real as UNAVAILABLE (not N/A, not silently satisfied).
    assert.equal(layerApplicability({ sourceKind: "figml", privateMountAvailable: false })["project-real"], APPLICABILITY.UNAVAILABLE);
    // No tier is reported when nothing mounted — a gated result cannot be a PASS.
    assert.equal(classifyRender({}), null);
    assert.equal(classifyRender({ staticOnly: true }), RENDER_TIERS.STATIC);
  } else {
    // The checkout exists: the adapter CAN mount the real module without an architecture change.
    assert.equal(classifyRender({ projectMounted: true }), RENDER_TIERS.PROJECT_REAL);
  }
});

test("adapter: empty evidence is an honest empty shape (no fabricated measurements)", () => {
  const e = emptyDomEvidence();
  assert.equal(e.rects.size, 0);
  assert.equal(e.computedStyles.size, 0);
  assert.deepEqual(e.domTexts, []);
  assert.deepEqual(e.domState, {});
});
