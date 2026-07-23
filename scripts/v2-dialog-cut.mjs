// Вирізає світло-сірий фон у 7 емоцій-портретів dialog/*.png (D-033):
// у діалозі v3 портрет стоїть без рамки-картки — сірий квадрат більше не канає.
// Edge-connected flood fill по «світлому ненасиченому» — очі/зуби всередині
// силуету не чіпаються. Запуск: node scripts/v2-dialog-cut.mjs
import sharp from 'sharp';
import { readdirSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import { join } from 'node:path';

const DIR = 'public/v2/dialog';

for (const f of readdirSync(DIR).filter((f) => f.endsWith('.png'))) {
  const p = join(DIR, f);
  const buf = readFileSync(p);
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  let transparent = 0;
  for (let i = 3; i < data.length; i += 4) if (data[i] === 0) transparent++;
  if (transparent / (w * h) > 0.05) { console.log(`${f} — вже з альфою`); continue; }

  const isBg = (i) => {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const mn = Math.min(r, g, b), mx = Math.max(r, g, b);
    return mn > 178 && mx < 246 && mx - mn < 22;
  };
  const seen = new Uint8Array(w * h);
  const stack = [];
  for (let x = 0; x < w; x++) stack.push(x, x + (h - 1) * w);
  for (let y = 0; y < h; y++) stack.push(y * w, w - 1 + y * w);
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
    .trim({ threshold: 10 }).png().toBuffer();
  writeFileSync(p + '.tmp', out);
  renameSync(p + '.tmp', p);
  console.log(`✓ ${f} — фон зрізано`);
}
console.log('done');
