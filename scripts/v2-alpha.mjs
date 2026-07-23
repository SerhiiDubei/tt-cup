// Обробка кадрів героя: білий фон → альфа, трим, ресайз.
// Запуск: node scripts/v2-alpha.mjs <input.png> <output-rel-to-public>
import sharp from 'sharp';
import path from 'node:path';
import fs from 'node:fs';

const [input, outRel] = process.argv.slice(2);
if (!input || !outRel) {
  console.error('usage: node scripts/v2-alpha.mjs <input.png> <public-relative-out.png>');
  process.exit(1);
}
const out = path.join(process.cwd(), 'public', outRel);
fs.mkdirSync(path.dirname(out), { recursive: true });

const img = sharp(input).ensureAlpha();
const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });

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
