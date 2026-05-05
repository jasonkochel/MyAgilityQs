#!/usr/bin/env node
/**
 * Generates client/public/favicon.ico — a minimal 16x16 solid-color ICO.
 * Browsers auto-request /favicon.ico regardless of <link rel="icon"> tags,
 * so this file silences the 404. The actual icon used by modern browsers is
 * still favicon.svg via the link tag.
 *
 * Run once: node tools/scripts/generate-favicon-ico.mjs
 */
import { writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const out = resolve(__dirname, "..", "..", "client", "public", "favicon.ico");

// Brand blue #228be6 = R 34, G 139, B 230 (BGRA: 0xE6, 0x8B, 0x22, 0xFF)
const W = 16;
const H = 16;

// BITMAPINFOHEADER (40 bytes). Note: BMP-in-ICO sets height to 2x actual
// height because the AND mask is appended below the pixel data.
const bih = Buffer.alloc(40);
bih.writeUInt32LE(40, 0);          // header size
bih.writeInt32LE(W, 4);            // width
bih.writeInt32LE(H * 2, 8);        // height * 2 (BMP+AND mask convention)
bih.writeUInt16LE(1, 12);          // planes
bih.writeUInt16LE(32, 14);         // bits per pixel (32-bit BGRA)
// remaining fields zero (BI_RGB compression, no palette, etc.)

// Pixel data: BGRA, bottom-up rows
const pixels = Buffer.alloc(W * H * 4);
for (let i = 0; i < W * H; i++) {
  pixels[i * 4 + 0] = 0xe6; // B
  pixels[i * 4 + 1] = 0x8b; // G
  pixels[i * 4 + 2] = 0x22; // R
  pixels[i * 4 + 3] = 0xff; // A
}

// AND mask: 1 bit per pixel, padded to 4-byte rows. All zeros (fully visible).
const andMaskRowBytes = Math.ceil(W / 8 / 4) * 4; // 4 bytes per row for 16px
const andMask = Buffer.alloc(andMaskRowBytes * H);

const imageData = Buffer.concat([bih, pixels, andMask]);

// ICONDIR (6 bytes)
const iconDir = Buffer.alloc(6);
iconDir.writeUInt16LE(0, 0);       // reserved
iconDir.writeUInt16LE(1, 2);       // type = 1 (ICO)
iconDir.writeUInt16LE(1, 4);       // image count

// ICONDIRENTRY (16 bytes)
const entry = Buffer.alloc(16);
entry.writeUInt8(W === 256 ? 0 : W, 0);
entry.writeUInt8(H === 256 ? 0 : H, 1);
entry.writeUInt8(0, 2);            // color count (0 = no palette)
entry.writeUInt8(0, 3);            // reserved
entry.writeUInt16LE(1, 4);         // color planes
entry.writeUInt16LE(32, 6);        // bits per pixel
entry.writeUInt32LE(imageData.length, 8);
entry.writeUInt32LE(6 + 16, 12);   // offset to image data (after ICONDIR + ICONDIRENTRY)

const ico = Buffer.concat([iconDir, entry, imageData]);
writeFileSync(out, ico);
console.log(`Wrote ${out} (${ico.length} bytes)`);
