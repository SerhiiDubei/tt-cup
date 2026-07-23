// Прибирає дрібні «летючі» артефакти генерацій (текст-сміття, крихти):
// лишає тільки великі звʼязні непрозорі компоненти (>1.5% пікселів),
// решту робить прозорою, потім перекроп. Запуск: node scripts/v2-vars-clean.mjs 5 10
import sharp from 'sharp';
import { writeFileSync } from 'node:fs';

for (const n of process.argv.slice(2).map(Number)) {
  const p = `public/v2/vars/${String(n).padStart(2, '0')}.png`;
  const { data, info } = await sharp(p).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const label = new Int32Array(w * h).fill(-1);
  const sizes = [];
  for (let start = 0; start < w * h; start++) {
    if (label[start] !== -1 || data[start * 4 + 3] === 0) continue;
    const id = sizes.length;
    let size = 0;
    const stack = [start];
    label[start] = id;
    while (stack.length) {
      const q = stack.pop();
      size++;
      const x = q % w, y = (q / w) | 0;
      for (const d of [q - 1, q + 1, q - w, q + w]) {
        if (d < 0 || d >= w * h) continue;
        if ((d === q - 1 && x === 0) || (d === q + 1 && x === w - 1)) continue;
        if (label[d] === -1 && data[d * 4 + 3] > 0) { label[d] = id; stack.push(d); }
      }
    }
    sizes.push(size);
  }
  const keep = new Set(sizes.map((s, i) => [s, i]).filter(([s]) => s > w * h * 0.015).map(([, i]) => i));
  let removed = 0;
  for (let q = 0; q < w * h; q++) {
    if (data[q * 4 + 3] > 0 && !keep.has(label[q])) { data[q * 4 + 3] = 0; removed++; }
  }
  const out = await sharp(data, { raw: { width: w, height: h, channels: 4 } })
    .trim({ threshold: 10 }).png().toBuffer();
  writeFileSync(p, out);
  console.log(`✓ ${p}: компонентів ${sizes.length}, лишено ${keep.size}, стерто ${removed}px`);
}
