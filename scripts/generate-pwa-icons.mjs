#!/usr/bin/env node
/**
 * Genera PNGs placeholder mínimos (válidos) para que el manifest cargue.
 * No dependencias — escribe bytes a mano.
 *
 * Sustituir estos archivos con íconos reales cuando haya identidad visual.
 *
 * Uso: node scripts/generate-pwa-icons.mjs
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync, crc32 } from "node:zlib";

function png(width, height, rgba) {
  // Cabecera PNG
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 6;   // color type: RGBA
  ihdr[10] = 0;  // compression
  ihdr[11] = 0;  // filter
  ihdr[12] = 0;  // interlace

  // IDAT: filter byte 0 al inicio de cada fila
  const raw = Buffer.alloc((width * 4 + 1) * height);
  let p = 0;
  for (let y = 0; y < height; y++) {
    raw[p++] = 0; // no filter
    for (let x = 0; x < width; x++) {
      raw[p++] = rgba[0];
      raw[p++] = rgba[1];
      raw[p++] = rgba[2];
      raw[p++] = rgba[3];
    }
  }
  const idat = deflateSync(raw);

  function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, "ascii");
    const body = Buffer.concat([typeBuf, data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body) >>> 0, 0);
    return Buffer.concat([len, body, crc]);
  }

  return Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// Azul oscuro slate-900 (#0f172a)
const slate = [15, 23, 42, 255];

const targets = [
  { path: "public/icons/icon-192.png", size: 192 },
  { path: "public/icons/icon-512.png", size: 512 },
  { path: "public/icons/icon-maskable-512.png", size: 512 },
  { path: "public/icons/apple-touch-icon.png", size: 180 },
];

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

for (const t of targets) {
  const full = resolve(root, t.path);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, png(t.size, t.size, slate));
  console.log(`✔ ${t.path} (${t.size}x${t.size})`);
}
