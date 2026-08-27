// Static extraction (tier 2) — layout bands + color palette from an RGBA grid.
// Zero dependencies. Deterministic. No semantic understanding — that is tier 1's job;
// this tier carries structure, geometry, and colors so a text-only model still gets a skeleton.

/**
 * Extract colors + layout bands from an RGBA grid.
 * @param {{ width: number, height: number, rgba: Uint8Array }} img
 * @returns {{ colors: Array<{role:string,hex:string,share:number}>, bands: Array<{y:number,h:number}> }}
 */
export function extractColorsAndBands(img) {
  const { width, height, rgba } = img;

  // --- 1. color census (5-bit quantization -> frequency map) ---
  const counts = new Map();
  const total = width * height;
  for (let i = 0; i < total; i++) {
    const r = rgba[i * 4] >> 3, g = rgba[i * 4 + 1] >> 3, b = rgba[i * 4 + 2] >> 3;
    const key = (r << 10) | (g << 5) | b;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  const colors = top.map(([key, n]) => {
    const hex = rgbToHex(((key >> 10) & 31) << 3, ((key >> 5) & 31) << 3, (key & 31) << 3);
    return { hex, share: n / total };
  });

  // roles by luminance + share: largest share = background; lightest of the rest = text;
  // most saturated = accent; rest = surface
  const withLum = colors.map((c) => ({ ...c, lum: luminance(c.hex) }));
  const background = withLum[0];
  const rest = withLum.slice(1);
  const text = rest.length ? rest.reduce((a, b) => (a.lum > b.lum ? a : b)) : null;
  const accent = rest.length ? rest.reduce((a, b) => (saturation(a.hex) > saturation(b.hex) ? a : b)) : null;
  const roleMap = new Map();
  if (background) roleMap.set(background.hex, "background");
  if (text && text !== background) roleMap.set(text.hex, "text");
  if (accent && accent !== background && accent !== text) roleMap.set(accent.hex, "accent");
  for (const c of withLum) if (!roleMap.has(c.hex)) roleMap.set(c.hex, "surface");

  // --- 2. row bands vs dominant background ---
  const bgHex = background ? background.hex : null;
  const rowsContent = new Uint8Array(height);
  for (let y = 0; y < height; y++) {
    let diff = 0;
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (quantHex(rgba[i], rgba[i + 1], rgba[i + 2]) !== bgHex) diff++;
    }
    rowsContent[y] = diff > width * 0.02 ? 1 : 0; // >2% differing pixels = content row
  }
  const bands = [];
  let start = -1;
  for (let y = 0; y <= height; y++) {
    const content = y < height ? rowsContent[y] : 0;
    if (content && start === -1) start = y;
    if (!content && start !== -1) {
      bands.push({ y: start, h: y - start });
      start = -1;
    }
  }

  return {
    colors: withLum.map((c) => ({ role: roleMap.get(c.hex) ?? "surface", hex: c.hex, share: Math.round(c.share * 1000) / 1000 })),
    bands,
  };
}

/**
 * Column edges within a band -> child boxes (for grouping siblings).
 * @param {{ width: number, height: number, rgba: Uint8Array }} img
 * @param {{y:number,h:number}} band
 * @param {string|null} bgHex - quantized background hex to diff against
 * @returns {Array<{x:number,w:number}>}
 */
export function bandColumns(img, band, bgHex) {
  const { width, rgba } = img;
  const colsContent = new Uint8Array(width);
  for (let x = 0; x < width; x++) {
    let diff = 0;
    for (let y = band.y; y < band.y + band.h; y++) {
      const i = (y * width + x) * 4;
      if (quantHex(rgba[i], rgba[i + 1], rgba[i + 2]) !== bgHex) diff++;
    }
    colsContent[x] = diff > band.h * 0.05 ? 1 : 0;
  }
  const boxes = [];
  let start = -1;
  for (let x = 0; x <= width; x++) {
    const content = x < width ? colsContent[x] : 0;
    if (content && start === -1) start = x;
    if (!content && start !== -1) {
      boxes.push({ x: start, w: x - start });
      start = -1;
    }
  }
  return boxes;
}

// ---------- color helpers ----------

/** Quantize a pixel to the same 5-bit hex the census uses. */
function quantHex(r, g, b) {
  return rgbToHex((r >> 3) << 3, (g >> 3) << 3, (b >> 3) << 3);
}

function rgbToHex(r, g, b) {
  const h = (n) => n.toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

function hexChannel(hex, idx) {
  return parseInt(hex.slice(1 + idx * 2, 3 + idx * 2), 16);
}

function luminance(hex) {
  const r = hexChannel(hex, 0);
  const g = hexChannel(hex, 1);
  const b = hexChannel(hex, 2);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

function saturation(hex) {
  const r = hexChannel(hex, 0) / 255;
  const g = hexChannel(hex, 1) / 255;
  const b = hexChannel(hex, 2) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  return max === 0 ? 0 : (max - min) / max;
}
