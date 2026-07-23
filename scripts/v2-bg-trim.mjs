// Зрізає запечені однотонні поля зверху/знизу АІ-фонів public/v2/bg/*.jpg
// (генерації вийшли «картинка в рамці» — кремові смуги ламали фулскрін-фон).
// Рядок вважається полем, якщо >97% пікселів близькі до кольору кута кадру.
// Запуск: node scripts/v2-bg-trim.mjs
import sharp from 'sharp';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

const DIR = 'public/v2/bg';
const TOL = 14; // допуск відхилення каналу від кольору поля

for (const f of readdirSync(DIR).filter((f) => f.endsWith('.jpg'))) {
  const p = join(DIR, f);
  const { data, info } = await sharp(p).raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h, channels: c } = info;
  const px = (x, y) => [data[(y * w + x) * c], data[(y * w + x) * c + 1], data[(y * w + x) * c + 2]];
  const isMarginRow = (y, ref) => {
    let ok = 0;
    for (let x = 0; x < w; x += 2) {
      const [r, g, b] = px(x, y);
      if (Math.abs(r - ref[0]) < TOL && Math.abs(g - ref[1]) < TOL && Math.abs(b - ref[2]) < TOL) ok++;
    }
    return ok / Math.ceil(w / 2) > 0.97;
  };
  const topRef = px(2, 2);
  const botRef = px(2, h - 3);
  let top = 0;
  while (top < h * 0.45 && isMarginRow(top, topRef)) top++;
  let bot = h - 1;
  while (bot > h * 0.55 && isMarginRow(bot, botRef)) bot--;
  if (top === 0 && bot === h - 1) { console.log(f, '— полів нема'); continue; }
  const cropH = bot - top + 1;
  await sharp(p).extract({ left: 0, top, width: w, height: cropH }).jpeg({ quality: 88 }).toFile(p + '.tmp');
  const { renameSync } = await import('node:fs');
  renameSync(p + '.tmp', p);
  console.log(`${f}: зрізано top=${top} bottom=${h - 1 - bot} → ${w}×${cropH}`);
}
