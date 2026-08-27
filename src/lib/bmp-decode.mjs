// Pure-JS BMP decoder — zero dependencies.
// Decodes the uncompressed 24/32-bit BI_RGB BMPs that macOS `sips` writes,
// into an RGBA byte grid. This is how the static tier reads pixels without
// any npm image library.

/**
 * @param {Uint8Array} buf — raw BMP file bytes
 * @returns {{ width: number, height: number, rgba: Uint8Array }} — top-down RGBA
 * @throws {Error} on unsupported BMP variants
 */
export function decodeBmp(buf) {
  if (buf.length < 54) throw new Error("BMP too small");
  if (buf[0] !== 0x42 || buf[1] !== 0x4d) throw new Error("Not a BMP (bad magic)");

  const dataOffset = readU32(buf, 10);
  const headerSize = readU32(buf, 14);
  if (headerSize < 40) throw new Error(`Unsupported BMP header size ${headerSize}`);

  const width = readI32(buf, 18);
  const rawHeight = readI32(buf, 22);
  const bitCount = readU16(buf, 28);
  const compression = readU32(buf, 30);

  if (compression !== 0) throw new Error(`Unsupported BMP compression ${compression}`);
  if (bitCount !== 24 && bitCount !== 32) throw new Error(`Unsupported BMP bit depth ${bitCount}`);

  const topDown = rawHeight < 0;
  const height = Math.abs(rawHeight);
  const bytesPerPixel = bitCount / 8;
  // rows are padded to 4-byte boundaries
  const stride = Math.ceil((width * bitCount) / 32) * 4;

  const rgba = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    const srcRow = topDown ? y : height - 1 - y;
    const rowStart = dataOffset + srcRow * stride;
    for (let x = 0; x < width; x++) {
      const src = rowStart + x * bytesPerPixel;
      const dst = (y * width + x) * 4;
      rgba[dst] = buf[src + 2];     // R (BMP is BGR)
      rgba[dst + 1] = buf[src + 1]; // G
      rgba[dst + 2] = buf[src];     // B
      rgba[dst + 3] = 0xff;         // A (opaque)
    }
  }
  return { width, height, rgba };
}

function readU16(buf, off) {
  return buf[off] | (buf[off + 1] << 8);
}
function readU32(buf, off) {
  return (buf[off] | (buf[off + 1] << 8) | (buf[off + 2] << 16) | (buf[off + 3] << 24)) >>> 0;
}
function readI32(buf, off) {
  return buf[off] | (buf[off + 1] << 8) | (buf[off + 2] << 16) | (buf[off + 3] << 24);
}
