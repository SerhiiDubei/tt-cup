// Фікс-прохід по public/v2/vars/*.png: якщо фон лишився (прозорих <5%),
// зрізати його заново. Критерій фону стійкий до градієнта: «світло-сірий
// ненасичений» (185..242, розкид каналів <16), flood fill від країв кадру —
// білі елементи персонажа (>242: шкарпетки, зуби, очі) не чіпаються.
// Запуск: node scripts/v2-vars-fix.mjs
import sharp from 'sharp';
import { readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const DIR = 'public/v2/vars';

for (const f of readdirSync(DIR).filter((f) => f.endsWith('.png'))) {
  const p = join(DIR, f);
  const { data, info } = await sharp(p).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  let transparent = 0;
  for (let i = 3; i < data.length; i += 4) if (data[i] === 0) transparent++;
  if (transparent / (w * h) > 0.05) { console.log(`${f} — вже вирізаний (${((transparent / (w * h)) * 100) | 0}% альфи)`); continue; }

  const isBg = (i) => {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const mn = Math.min(r, g, b), mx = Math.max(r, g, b);
    return mn > 185 && mx < 243 && mx - mn < 16;
  };
  const seen = new Uint8Array(w * h);
  const stack = [];
  for (let x = 0; x < w; x++) { stack.push(x, x + (h - 1) * w); }
  for (let y = 0; y < h; y++) { stack.push(y * w, w - 1 + y * w); }
  while (stack.length) {
    const q = stack.pop();
    if (seen[q]) continue;
    seen[q] = 1;
    if (!isBg(q * 4)) continue;
    data[q * 4 + 3] = 0;
    const x = q % w, y = (q / w) | 0;
    if (x > 0) stack.push(q - 1);
    if (x < w - 1) stack.push(q + 1);
    if (y > 0) stack.push(q - w);
    if (y < h - 1) stack.push(q + w);
  }
  const out = await sharp(data, { raw: { width: w, height: h, channels: 4 } })
    .trim({ threshold: 10 })
    .png()
    .toBuffer();
  writeFileSync(p, out);
  console.log(`✓ ${f} — фон зрізано повторно`);
}
console.log('done');
