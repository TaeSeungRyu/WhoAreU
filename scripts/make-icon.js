// Generates two PNG placeholders:
//   - assets/tray-icon.png  (32x32, used by Tray)
//   - assets/icon.png       (256x256, used by electron-builder for the EXE)
// Pure Node (zlib + CRC32), no dependencies. Runs from `yarn postinstall`.
// Skips files that already exist so user-provided icons are preserved.

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const OUT_DIR = path.join(__dirname, '..', 'assets');
fs.mkdirSync(OUT_DIR, { recursive: true });

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

// 7x9 bitmap for "?" — rows top→bottom, 1 = foreground
const GLYPH = [
  '01110',
  '10001',
  '00001',
  '00010',
  '00100',
  '00100',
  '00000',
  '00100',
  '00000',
];

function buildPixels(size) {
  const bg = [30, 41, 59, 255];     // slate-800
  const fg = [236, 72, 153, 255];   // pink-500
  const gw = GLYPH[0].length;
  const gh = GLYPH.length;
  // Scale glyph so it occupies roughly the centre 60% of the canvas.
  const scale = Math.max(1, Math.floor(size * 0.6 / Math.max(gw, gh)));
  const gx = Math.floor((size - gw * scale) / 2);
  const gy = Math.floor((size - gh * scale) / 2);

  const pixels = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let color = bg;
      const lx = x - gx;
      const ly = y - gy;
      if (lx >= 0 && ly >= 0 && lx < gw * scale && ly < gh * scale) {
        const cell = GLYPH[Math.floor(ly / scale)][Math.floor(lx / scale)];
        if (cell === '1') color = fg;
      }
      const idx = (y * size + x) * 4;
      pixels[idx] = color[0];
      pixels[idx + 1] = color[1];
      pixels[idx + 2] = color[2];
      pixels[idx + 3] = color[3];
    }
  }
  return pixels;
}

// Each scanline is prefixed with a filter byte (0 = None).
function withFilterBytes(pixels, size) {
  const stride = size * 4;
  const out = Buffer.alloc(size * (stride + 1));
  for (let y = 0; y < size; y++) {
    out[y * (stride + 1)] = 0;
    pixels.copy(out, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  return out;
}

function makePng(size) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr.writeUInt8(8, 8);
  ihdr.writeUInt8(6, 9);
  ihdr.writeUInt8(0, 10);
  ihdr.writeUInt8(0, 11);
  ihdr.writeUInt8(0, 12);

  const idatRaw = withFilterBytes(buildPixels(size), size);
  const idat = zlib.deflateSync(idatRaw, { level: 9 });

  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function writeIfMissing(outFile, size) {
  if (fs.existsSync(outFile)) {
    console.log(`[make-icon] kept ${path.basename(outFile)} (already present)`);
    return;
  }
  const png = makePng(size);
  fs.writeFileSync(outFile, png);
  console.log(`[make-icon] wrote ${path.basename(outFile)} (${size}x${size}, ${png.length} bytes)`);
}

writeIfMissing(path.join(OUT_DIR, 'tray-icon.png'), 32);
writeIfMissing(path.join(OUT_DIR, 'icon.png'), 256);
