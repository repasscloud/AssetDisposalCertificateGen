/**
 * create-icons.mjs
 * Generates minimal solid-colour PNG icons for the PWA manifest.
 * Pure Node.js — no external dependencies.
 * Run automatically via npm prebuild / predev.
 */
import { deflateSync } from "zlib";
import { writeFileSync, mkdirSync, existsSync } from "fs";

function uint32BE(value) {
  const buf = Buffer.alloc(4);
  buf.writeUInt32BE(value >>> 0, 0);
  return buf;
}

function crc32(data) {
  // Build CRC table
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c;
  }
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc = table[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const typeBytes = Buffer.from(type, "ascii");
  const combined = Buffer.concat([typeBytes, data]);
  const crcVal = crc32(combined);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crcVal, 0);
  return Buffer.concat([uint32BE(data.length), typeBytes, data, crcBuf]);
}

function createSolidPng(size, r, g, b) {
  // PNG signature
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR: width, height, bit-depth=8, color-type=2(RGB), compress=0, filter=0, interlace=0
  const ihdrData = Buffer.concat([
    uint32BE(size),
    uint32BE(size),
    Buffer.from([8, 2, 0, 0, 0]),
  ]);
  const ihdr = makeChunk("IHDR", ihdrData);

  // Raw scanlines: filter-byte(0) + RGB per pixel
  const raw = Buffer.alloc(size * (1 + size * 3));
  let offset = 0;
  for (let y = 0; y < size; y++) {
    raw[offset++] = 0; // filter none
    for (let x = 0; x < size; x++) {
      raw[offset++] = r;
      raw[offset++] = g;
      raw[offset++] = b;
    }
  }

  const compressed = deflateSync(raw, { level: 6 });
  const idat = makeChunk("IDAT", compressed);
  const iend = makeChunk("IEND", Buffer.alloc(0));

  return Buffer.concat([sig, ihdr, idat, iend]);
}

const outDir = "public/icons";
mkdirSync(outDir, { recursive: true });

// Dark navy: #1a2332
const R = 26, G = 35, B = 50;

const icon192 = `${outDir}/icon-192.png`;
const icon512 = `${outDir}/icon-512.png`;

if (!existsSync(icon192)) {
  writeFileSync(icon192, createSolidPng(192, R, G, B));
  console.log("Created", icon192);
}
if (!existsSync(icon512)) {
  writeFileSync(icon512, createSolidPng(512, R, G, B));
  console.log("Created", icon512);
}
