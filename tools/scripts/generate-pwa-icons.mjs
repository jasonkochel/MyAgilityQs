#!/usr/bin/env node
/**
 * Renders client/public/icon-{192,512,180}.png from icon-512.svg.
 *
 * Why PNGs in addition to the SVGs we already ship:
 * - Android Chrome sometimes refuses to fire `beforeinstallprompt` (and
 *   refuses to render the install banner) for manifests that only declare
 *   SVG icons. Shipping at least one PNG at 192x192 satisfies the criterion.
 * - The 180x180 PNG is the iOS Safari "Add to Home Screen" icon. iOS still
 *   accepts SVG via `<link rel="apple-touch-icon">`, but PNG is what every
 *   guide tells iOS users to expect.
 *
 * Run after editing icon-512.svg:
 *   node tools/scripts/generate-pwa-icons.mjs
 */
import { Resvg } from "@resvg/resvg-js";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = resolve(__dirname, "..", "..", "client", "public");
const svgSource = readFileSync(resolve(publicDir, "icon-512.svg"), "utf8");

const targets = [
  { size: 192, file: "icon-192.png" },
  { size: 512, file: "icon-512.png" },
  { size: 180, file: "apple-touch-icon.png" },
];

for (const { size, file } of targets) {
  const png = new Resvg(svgSource, {
    fitTo: { mode: "width", value: size },
  })
    .render()
    .asPng();
  const out = resolve(publicDir, file);
  writeFileSync(out, png);
  console.log(`Wrote ${out} (${png.length} bytes, ${size}x${size})`);
}
