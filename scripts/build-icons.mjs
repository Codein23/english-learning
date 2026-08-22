/**
 * Génère les icônes PNG du manifeste PWA à partir de `public/favicon.svg`.
 * Exécuté hors runtime : `npm run build:icons`. Les PNG sont versionnés,
 * le build de production n'a donc aucune dépendance à `sharp`.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const root = path.resolve(import.meta.dirname, '..');
const outDir = path.join(root, 'public', 'icons');

const MARK = (size, padding) => {
  const scale = size / 64;
  const inner = size - padding * 2;
  const s = inner / 64;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${padding > 0 ? 0 : 14 * scale}" fill="#2b2b2b"/>
  <g transform="translate(${padding} ${padding}) scale(${s})">
    <rect x="14" y="19" width="36" height="6" rx="3" fill="#ffffff"/>
    <rect x="14" y="29" width="28" height="6" rx="3" fill="#ffffff" opacity="0.72"/>
    <rect x="14" y="39" width="20" height="6" rx="3" fill="#c0246e"/>
  </g>
</svg>`;
};

async function render(name, size, padding) {
  const png = await sharp(Buffer.from(MARK(size, padding))).png({ compressionLevel: 9 }).toBuffer();
  await writeFile(path.join(outDir, name), png);
  console.log(`${name} — ${size}×${size} (${(png.length / 1024).toFixed(1)} ko)`);
}

await mkdir(outDir, { recursive: true });
await render('icon-192.png', 192, 0);
await render('icon-512.png', 512, 0);
// Maskable : la zone sûre est un cercle de 80 % — on rentre la marque de 12 %.
await render('icon-512-maskable.png', 512, Math.round(512 * 0.12));
