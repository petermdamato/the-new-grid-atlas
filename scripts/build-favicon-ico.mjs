/**
 * Wraps public/favicon.png in a minimal Windows ICO (PNG payload, Vista+).
 * ICO width/height bytes must match the embedded PNG or Next/sharp rejects the file.
 * Run after changing public/favicon.png: `node scripts/build-favicon-ico.mjs`
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const pngPath = path.join(root, "public", "favicon.png");
const png = fs.readFileSync(pngPath);
if (png.length < 24 || png[0] !== 0x89) {
  throw new Error("public/favicon.png must be a PNG");
}

/** IHDR width/height (big-endian) after 8-byte signature + 4 length + 4 "IHDR" */
function readPngDimensions(buf) {
  const w = buf.readUInt32BE(16);
  const h = buf.readUInt32BE(20);
  if (!w || !h || w > 256 || h > 256) {
    throw new Error(`PNG dimensions ${w}x${h} not supported for ICO (max 256)`);
  }
  return { w, h };
}

const { w, h } = readPngDimensions(png);

/** ICO entry: 0 means 256; otherwise 1–255 */
function icoDimByte(n) {
  if (n === 256) return 0;
  if (n < 1 || n > 255) throw new Error(`Invalid ICO dimension: ${n}`);
  return n;
}

const header = Buffer.alloc(22);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(1, 4);
header.writeUInt8(icoDimByte(w), 6);
header.writeUInt8(icoDimByte(h), 7);
header.writeUInt8(0, 8);
header.writeUInt8(0, 9);
header.writeUInt16LE(1, 10);
header.writeUInt16LE(32, 12);
header.writeUInt32LE(png.length, 14);
header.writeUInt32LE(22, 18);

const ico = Buffer.concat([header, png]);
fs.writeFileSync(path.join(root, "public", "favicon.ico"), ico);
fs.writeFileSync(path.join(root, "src", "app", "favicon.ico"), ico);
console.log("Wrote public/favicon.ico and src/app/favicon.ico (%s bytes), %sx%s", ico.length, w, h);
