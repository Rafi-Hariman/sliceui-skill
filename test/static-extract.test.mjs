import { test } from "node:test";
import assert from "node:assert/strict";
import { decodeBmp } from "../src/lib/bmp-decode.mjs";
import { extractColorsAndBands, bandColumns } from "../src/lib/static-extract.mjs";

// --- BMP round-trip ---

/** Build a minimal 24-bit BI_RGB BMP from an RGBA grid. */
function encodeBmp(width, height, rgba) {
  const bytesPerPixel = 3;
  const stride = Math.ceil((width * 24) / 32) * 4;
  const dataSize = stride * height;
  const fileSize = 54 + dataSize;
  const buf = Buffer.alloc(fileSize);
  buf.write("BM", 0, "ascii");
  buf.writeUInt32LE(fileSize, 2);
  buf.writeUInt32LE(54, 10);
  buf.writeUInt32LE(40, 14);       // BITMAPINFOHEADER size
  buf.writeInt32LE(width, 18);
  buf.writeInt32LE(height, 22);    // positive = bottom-up
  buf.writeUInt16LE(1, 26);        // planes
  buf.writeUInt16LE(24, 28);       // bit count
  buf.writeUInt32LE(0, 30);        // compression BI_RGB
  buf.writeUInt32LE(dataSize, 34);
  for (let y = 0; y < height; y++) {
    const srcRow = height - 1 - y;
    const rowStart = 54 + srcRow * stride;
    for (let x = 0; x < width; x++) {
      const s = (y * width + x) * 4;
      const d = rowStart + x * bytesPerPixel;
      buf[d] = rgba[s + 2];        // B
      buf[d + 1] = rgba[s + 1];    // G
      buf[d + 2] = rgba[s];        // R
    }
  }
  return buf;
}

test("decodeBmp round-trips a 24-bit BMP", () => {
  const w = 4, h = 3;
  const rgba = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    rgba[i * 4] = 255; rgba[i * 4 + 1] = 0; rgba[i * 4 + 2] = 0; rgba[i * 4 + 3] = 255;
  }
  const img = decodeBmp(new Uint8Array(encodeBmp(w, h, rgba)));
  assert.equal(img.width, w);
  assert.equal(img.height, h);
  assert.equal(img.rgba[0], 255);
  assert.equal(img.rgba[1], 0);
  assert.equal(img.rgba[2], 0);
});

test("decodeBmp rejects non-BMP magic", () => {
  assert.throws(() => decodeBmp(new Uint8Array(100)), /magic/);
});

// --- extraction ---

test("extractColorsAndBands finds a dominant background and a content band", () => {
  const w = 20, h = 20;
  const rgba = new Uint8Array(w * h * 4);
  // fill all with dark background
  for (let i = 0; i < w * h; i++) {
    rgba[i * 4] = 15; rgba[i * 4 + 1] = 23; rgba[i * 4 + 2] = 42; rgba[i * 4 + 3] = 255; // #0f172a
  }
  // draw a bright horizontal band (rows 5..8) as "content"
  for (let y = 5; y <= 8; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      rgba[i] = 255; rgba[i + 1] = 255; rgba[i + 2] = 255;
    }
  }
  const { colors, bands } = extractColorsAndBands({ width: w, height: h, rgba });
  assert.ok(colors.length >= 2);
  const bg = colors.find((c) => c.role === "background");
  assert.ok(bg);
  // extractor quantizes to 5-bit channels: 15->8, 23->16, 42->40 => #081028
  assert.equal(bg.hex, "#081028");
  // the bright band should be detected
  assert.ok(bands.length >= 1);
  const band = bands.find((b) => b.y >= 5 && b.h >= 3);
  assert.ok(band, "expected a band around y=5");
});

test("bandColumns splits a band with two separated groups", () => {
  const w = 30, h = 10;
  const rgba = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    rgba[i * 4] = 15; rgba[i * 4 + 1] = 23; rgba[i * 4 + 2] = 42; rgba[i * 4 + 3] = 255;
  }
  // two bright blocks at x=3..8 and x=20..25
  for (let y = 0; y < h; y++) {
    for (let x = 3; x <= 8; x++) {
      const i = (y * w + x) * 4; rgba[i] = 255; rgba[i + 1] = 255; rgba[i + 2] = 255;
    }
    for (let x = 20; x <= 25; x++) {
      const i = (y * w + x) * 4; rgba[i] = 255; rgba[i + 1] = 255; rgba[i + 2] = 255;
    }
  }
  const boxes = bandColumns({ width: w, height: h, rgba }, { y: 0, h }, "#081028");
  assert.ok(boxes.length >= 2, `expected >=2 boxes, got ${boxes.length}`);
});
