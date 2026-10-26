// verification/relationship — verify relationship/topology constraints against browser DOM geometry.
//
// Pure: takes `rects` (Map<nodeId, {x,y,width,height}>) + a compiled check, returns a result with
// expected/actual/delta/remediation. The rects come from getBoundingClientRect (browser) OR synthetic
// fixtures (unit tests) — the verifier never knows which, and never trusts source CSS presence as
// proof. A `pass` means a real measured relationship matched within tolerance.

/** @param {object} check — a compiled relationship check
 *  @param {Map<string,{x:number,y:number,width:number,height:number}>} rects
 *  @returns {{ status:"pass"|"fail"|"unverifiable", expected, actual, delta, remediation }} */
export function verifyRelationship(check, rects) {
  const r = (id) => rects.get(id);
  switch (check.category) {
    case "sibling-ratio": return verifySiblingRatio(check, rects);
    case "item-distance": return verifyItemDistance(check, rects);
    case "alignment": return verifyAlignment(check, rects);
    case "relative-size": return verifyRelativeSize(check, rects);
    case "containment": return verifyContainment(check, rects);
    case "grid-track": return verifyGridTrack(check, rects);
    case "anchor": return verifyAnchor(check, rects);
    default: return unverifiable(check, `unknown relationship category ${check.category}`);
  }
}

function verifySiblingRatio(check, rects) {
  const dims = (check.childIds ?? []).map((id) => {
    const b = rects.get(id);
    return b ? (check.axis === "x" ? b.width : b.height) : null;
  });
  if (dims.some((d) => d == null || d <= 0)) return unverifiable(check, "a sibling rect is missing");
  const min = Math.min(...dims);
  const actual = dims.map((d) => round1(d / min));
  const expected = check.expected ?? [];
  const ok = expected.length === actual.length && actual.every((a, i) => Math.abs(a - expected[i]) <= (check.tolerance ?? 0.1));
  return verdict(check, ok, actual, expected, `ratio ${actual.join(":")} vs design ${expected.join(":")}`);
}

function verifyItemDistance(check, rects) {
  const a = rects.get(check.fromNodeId);
  const b = rects.get(check.toNodeId);
  if (!a || !b) return unverifiable(check, "a spacing endpoint rect is missing");
  const actual = round1(check.axis === "x" ? b.x - (a.x + a.width) : b.y - (a.y + a.height));
  const ok = Math.abs(actual - check.expected) <= (check.tolerance ?? 1);
  return verdict(check, ok, actual, check.expected, `distance ${actual}px vs design ${check.expected}px`);
}

function verifyAlignment(check, rects) {
  const c = rects.get(check.childId);
  const p = rects.get(check.parentId);
  if (!c || !p) return unverifiable(check, "an alignment rect is missing");
  const axis = check.axis ?? "x";
  const actual = deriveAlignment(c, p, axis);
  const ok = actual === check.expected || (check.expected === "UNKNOWN");
  return verdict(check, ok, actual, check.expected, `alignment ${actual} vs design ${check.expected}`);
}

function verifyRelativeSize(check, rects) {
  const c = rects.get(check.childId);
  const p = rects.get(check.parentId);
  if (!c || !p) return unverifiable(check, "a relative-size rect is missing");
  const axis = check.axis ?? "x";
  const cd = axis === "x" ? c.width : c.height;
  const pd = axis === "x" ? p.width : p.height;
  if (pd <= 0) return unverifiable(check, "parent dimension is zero");
  const actual = round1(cd / pd);
  const ok = Math.abs(actual - check.expected) <= (check.tolerance ?? 0.05);
  return verdict(check, ok, actual, check.expected, `relative size ${actual} vs design ${check.expected}`);
}

function verifyContainment(check, rects) {
  const c = rects.get(check.childId);
  const p = rects.get(check.parentId);
  if (!c || !p) return unverifiable(check, "a containment rect is missing");
  const tol = check.tolerance ?? 1;
  const inside = c.x >= p.x - tol && c.y >= p.y - tol && (c.x + c.width) <= (p.x + p.width) + tol && (c.y + c.height) <= (p.y + p.height) + tol;
  // An explicitly escaping/scrollable topology (an un-clipped overlay host) is not a defect —
  // the design says the child may leave the box (OVERLAY escape behavior).
  if (!inside && check.escapeAllowed === true) {
    return { status: "pass", expected: true, actual: { escaped: true, allowed: true }, delta: null, detail: "explicit escape is designed (un-clipped host) — not a containment defect", remediation: null };
  }
  return verdict(check, inside, inside, true, inside ? "contained" : "child escapes the intended container");
}

function verifyGridTrack(check, rects) {
  const ids = (check.nodeIds ?? []).map((id) => ({ id, b: rects.get(id) })).filter((x) => x.b);
  if (!ids.length) return unverifiable(check, "no grid cell rects");
  const cols = cluster1d(ids.map((x) => x.b.x + x.b.width / 2), Math.max(4, ids[0].b.width * 0.5));
  const rows = cluster1d(ids.map((x) => x.b.y + x.b.height / 2), Math.max(4, ids[0].b.height * 0.5));
  const actual = { columns: cols.length, rows: rows.length };
  const ok = actual.columns === check.expected.columns && actual.rows === check.expected.rows;
  return verdict(check, ok, actual, check.expected, `grid ${actual.columns}×${actual.rows} vs design ${check.expected.columns}×${check.expected.rows}`);
}

function verifyAnchor(check, rects) {
  const n = rects.get(check.nodeId);
  const a = rects.get(check.anchorNodeId);
  if (!n || !a) return unverifiable(check, "an anchor rect is missing");
  const tol = check.tolerance ?? 2;
  const exp = check.expected ?? {};
  const rightGap = (a.x + a.width) - (n.x + n.width);
  const leftGap = n.x - a.x;
  const bottomGap = (a.y + a.height) - (n.y + n.height);
  const topGap = n.y - a.y;
  const actualH = near(rightGap, 0, tol) ? "END" : near(leftGap, 0, tol) ? "START" : near(leftGap, rightGap, tol) ? "CENTER" : "START";
  const actualV = near(bottomGap, 0, tol) ? "END" : near(topGap, 0, tol) ? "START" : near(topGap, bottomGap, tol) ? "CENTER" : "START";
  const actual = { horizontal: actualH, vertical: actualV };
  const ok = (exp.horizontal == null || actual.horizontal === exp.horizontal) && (exp.vertical == null || actual.vertical === exp.vertical);
  return verdict(check, ok, actual, exp, `anchor ${actualH}/${actualV} vs design ${exp.horizontal}/${exp.vertical}`);
}

// ---------- helpers ----------

function deriveAlignment(c, p, axis) {
  const tol = Math.max(2, (axis === "x" ? p.width : p.height) * 0.005);
  if (axis === "x") {
    const leftGap = c.x - p.x;
    const rightGap = (p.x + p.width) - (c.x + c.width);
    if (near(c.width, p.width, tol)) return "STRETCH";
    if (near(leftGap, rightGap, tol)) return "CENTER";
    if (near(rightGap, 0, tol)) return "END";
    return "START";
  }
  const topGap = c.y - p.y;
  const bottomGap = (p.y + p.height) - (c.y + c.height);
  if (near(c.height, p.height, tol)) return "STRETCH";
  if (near(topGap, bottomGap, tol)) return "CENTER";
  if (near(bottomGap, 0, tol)) return "END";
  return "START";
}

function cluster1d(values, tol) {
  const sorted = [...values].sort((a, b) => a - b);
  const clusters = [];
  let cur = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] - cur[cur.length - 1] <= tol) cur.push(sorted[i]);
    else { clusters.push(avg(cur)); cur = [sorted[i]]; }
  }
  clusters.push(avg(cur));
  return clusters;
}
function avg(a) { return a.reduce((s, v) => s + v, 0) / a.length; }
function near(a, b, tol) { return Math.abs(a - b) <= tol; }
function round1(v) { return Math.round(v * 10) / 10; }

function verdict(check, ok, actual, expected, detail) {
  return { status: ok ? "pass" : "fail", expected, actual, delta: null, detail, remediation: ok ? null : check.remediation };
}
function unverifiable(check, detail) {
  return { status: "unverifiable", expected: check.expected, actual: null, delta: null, detail, remediation: check.remediation };
}
