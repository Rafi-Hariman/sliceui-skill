// Pure-JS BMP decoder — zero dependencies.
// Decodes the BMPs macOS `sips` writes (BITMAPV5, compression=3 BI_BITFIELDS, 32-bit BGRA,
// top-down) plus classic 24/32-bit BI_RGB bottom-up BMPs.

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

  const topDown = rawHeight < 0;
  const height = Math.abs(rawHeight);

  // --- resolve channel masks ---
  let maskR = 0x00ff0000, maskG = 0x0000ff00, maskB = 0x000000ff, maskA = 0xff000000;
  if (compression === 3) {
    // BI_BITFIELDS: masks live right after the 40-byte core (offset 54) for
    // both BITMAPINFOHEADER+bitfields and the V2–V5 extended headers.
    maskR = readU32(buf, 54);
    maskG = readU32(buf, 58);
    maskB = readU32(buf, 62);
    if (headerSize >= 56) maskA = readU32(buf, 66); // alpha mask only in V4/V5
  } else if (compression !== 0) {
    throw new Error(`Unsupported BMP compression ${compression}`);
  }
  if (bitCount !== 24 && bitCount !== 32) {
    throw new Error(`Unsupported BMP bit depth ${bitCount}`);
  }

  const bpp = bitCount / 8;
  const stride = Math.ceil((width * bitCount) / 32) * 4;

  // mask shift helpers (assume contiguous masks — true for everything sips writes)
  const shiftOf = (mask) => {
    let s = 0;
    while (mask && !(mask & 1)) { mask >>>= 1; s++; }
    return s;
  };
  const bitsOf = (mask) => {
    let n = 0;
    while (mask && !(mask & 1)) { mask >>>= 1; }
    while (mask & 1) { mask >>>= 1; n++; }
    return n;
  };
  const sR = shiftOf(maskR), sG = shiftOf(maskG), sB = shiftOf(maskB), sA = shiftOf(maskA);
  const scaleR = bitsOf(maskR), scaleG = bitsOf(maskG), scaleB = bitsOf(maskB);

  const rgba = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    const srcRow = topDown ? y : height - 1 - y;
    const rowStart = dataOffset + srcRow * stride;
    for (let x = 0; x < width; x++) {
      const src = rowStart + x * bpp;
      const dst = (y * width + x) * 4;
      if (bitCount === 24) {
        rgba[dst] = buf[src + 2];
        rgba[dst + 1] = buf[src + 1];
        rgba[dst + 2] = buf[src];
        rgba[dst + 3] = 0xff;
      } else {
        const px = readU32(buf, src);
        rgba[dst] = rescale((px & maskR) >>> sR, scaleR);
        rgba[dst + 1] = rescale((px & maskG) >>> sG, scaleG);
        rgba[dst + 2] = rescale((px & maskB) >>> sB, scaleB);
        rgba[dst + 3] = maskA ? rescale((px & maskA) >>> sA, bitsOf(maskA)) : 0xff;
      }
    }
  }
  return { width, height, rgba };
}

/** Scale an n-bit channel value to 8-bit. */
function rescale(v, bits) {
  if (bits === 8) return v;
  if (bits === 0) return 0;
  return Math.round((v * 255) / ((1 << bits) - 1));
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
