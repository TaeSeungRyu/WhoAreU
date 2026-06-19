// Generates assets/tray-icon.png — a 32x32 PNG placeholder.
// Pure Node (zlib + CRC32), no dependencies. Runs from `yarn postinstall`.
// Skips silently if a tray icon already exists (so a user-provided icon is preserved).

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const OUT_DIR = path.join(__dirname, '..', 'assets');
const OUT_FILE = path.join(OUT_DIR, 'tray-icon.png');

if (fs.existsSync(OUT_FILE)) {
  process.exit(0);
}
fs.mkdirSync(OUT_DIR, { recursive: true });

const SIZE = 32;

// Build raw RGBA pixels: dark navy background, magenta "?" glyph baked in via a small bitmap.
function buildPixels() {
  const bg = [30, 41, 59, 255];     // slate-800
  const fg = [236, 72, 153, 255];   // pink-500
  // 7x9 bitmap for "?" — rows top→bottom, 1 = foreground
  const glyph = [
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
  const gw = glyph[0].length;
  const gh = glyph.length;
  const scale = 3;
  const gx = Math.floor((SIZE - gw * scale) / 2);
  const gy = Math.floor((SIZE - gh * scale) / 2);

  const pixels = Buffer.alloc(SIZE * SIZE * 4);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      let color = bg;
      const lx = x - gx;
      const ly = y - gy;
      if (lx >= 0 && ly >= 0 && lx < gw * scale && ly < gh * scale) {
        const cell = glyph[Math.floor(ly / scale)][Math.floor(lx / scale)];
        if (cell === '1') color = fg;
      }
      const idx = (y * SIZE + x) * 4;
      pixels[idx] = color[0];
      pixels[idx + 1] = color[1];
      pixels[idx + 2] = color[2];
      pixels[idx + 3] = color[3];
    }
  }
  return pixels;
}

// PNG IDAT requires a filter byte (0 = None) prefixed to each scanline.
function withFilterBytes(pixels) {
  const stride = SIZE * 4;
  const out = Buffer.alloc(SIZE * (stride + 1));
  for (let y = 0; y < SIZE; y++) {
    out[y * (stride + 1)] = 0;
    pixels.copy(out, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  return out;
}

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

const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0);  // width
ihdr.writeUInt32BE(SIZE, 4);  // height
ihdr.writeUInt8(8, 8);        // bit depth
ihdr.writeUInt8(6, 9);        // color type: RGBA
ihdr.writeUInt8(0, 10);       // compression
ihdr.writeUInt8(0, 11);       // filter
ihdr.writeUInt8(0, 12);       // interlace

const idatRaw = withFilterBytes(buildPixels());
const idat = zlib.deflateSync(idatRaw, { level: 9 });

const png = Buffer.concat([
  signature,
  chunk('IHDR', ihdr),
  chunk('IDAT', idat),
  chunk('IEND', Buffer.alloc(0)),
]);

fs.writeFileSync(OUT_FILE, png);
console.log(`[make-icon] wrote ${OUT_FILE} (${png.length} bytes)`);
