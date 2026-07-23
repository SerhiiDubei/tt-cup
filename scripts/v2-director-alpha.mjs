// Разова обробка: базовий кадр Директора (AutoSprite) — білий фон → альфа.
// Запуск: node scripts/v2-director-alpha.mjs <input.png>
import sharp from 'sharp';
import path from 'node:path';
import fs from 'node:fs';

const input = process.argv[2];
if (!input) {
  console.error('usage: node scripts/v2-director-alpha.mjs <input.png>');
  process.exit(1);
}
const outDir = path.join(process.cwd(), 'public', 'v2');
fs.mkdirSync(outDir, { recursive: true });
const out = path.join(outDir, 'director.png');

const img = sharp(input).ensureAlpha();
const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });

// Білий і майже білий → прозорий, з мʼяким переходом на межі
for (let i = 0; i < data.length; i += 4) {
  const r = data[i], g = data[i + 1], b = data[i + 2];
  const min = Math.min(r, g, b);
  if (min > 244) data[i + 3] = 0;
  else if (min > 228) data[i + 3] = Math.round(((244 - min) / 16) * 255);
}

await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
  .trim()
  .resize({ height: 900, withoutEnlargement: true })
  .png({ compressionLevel: 9 })
  .toFile(out);

console.log('written', out);
