/**
 * Wraps public/favicon.png in a minimal Windows ICO (PNG payload, Vista+).
 * Run after changing public/favicon.png: `node scripts/build-favicon-ico.mjs`
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const pngPath = path.join(root, "public", "favicon.png");
const png = fs.readFileSync(pngPath);
if (png.length < 8 || png[0] !== 0x89) {
  throw new Error("public/favicon.png must be a PNG");
}

const header = Buffer.alloc(22);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(1, 4);
header.writeUInt8(0, 6);
header.writeUInt8(0, 7);
header.writeUInt8(0, 8);
header.writeUInt8(0, 9);
header.writeUInt16LE(1, 10);
header.writeUInt16LE(32, 12);
header.writeUInt32LE(png.length, 14);
header.writeUInt32LE(22, 18);

const ico = Buffer.concat([header, png]);
fs.writeFileSync(path.join(root, "public", "favicon.ico"), ico);
fs.writeFileSync(path.join(root, "src", "app", "favicon.ico"), ico);
console.log("Wrote public/favicon.ico and src/app/favicon.ico (%s bytes)", ico.length);
