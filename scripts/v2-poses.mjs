// Скачує всі пози героїні з AutoSprite (JSON від get_character),
// проганяє через альфа+трим і кладе в public/v2/hero/<name>.png.
// Запуск: node scripts/v2-poses.mjs <babusia-ready.json>
import sharp from 'sharp';
import path from 'node:path';
import fs from 'node:fs';

const jsonPath = process.argv[2];
if (!jsonPath) {
  console.error('usage: node scripts/v2-poses.mjs <get_character-response.json>');
  process.exit(1);
}

// Відповідь — SSE: рядки "data: {...}"; беремо перший data-JSON
const raw = fs.readFileSync(jsonPath, 'utf8');
const dataLine = raw.split(/\r?\n/).find((l) => l.startsWith('data:'));
const parsed = JSON.parse(dataLine.slice(5));
const sc = parsed.result?.structuredContent ?? {};
const ch = sc.character ?? sc;
const poses = ch.poses ?? [];
if (poses.length === 0) {
  console.error('no poses in response');
  process.exit(1);
}

const outDir = path.join(process.cwd(), 'public', 'v2', 'hero');
fs.mkdirSync(outDir, { recursive: true });

for (const p of poses) {
  const name = (p.name ?? p.label ?? p.id).toString().toLowerCase().replace(/[^a-z0-9-]/g, '');
  const url = p.imageUrl ?? p.url ?? p.baseImageUrl;
  if (!url) {
    console.warn('skip (no url):', name, JSON.stringify(p).slice(0, 200));
    continue;
  }
  const res = await fetch(url);
  if (!res.ok) {
    console.warn('skip (http ' + res.status + '):', name);
    continue;
  }
  const buf = Buffer.from(await res.arrayBuffer());
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) {
    const min = Math.min(data[i], data[i + 1], data[i + 2]);
    if (min > 244) data[i + 3] = 0;
    else if (min > 228) data[i + 3] = Math.round(((244 - min) / 16) * 255);
  }
  const out = path.join(outDir, `${name}.png`);
  await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .trim()
    .resize({ height: 900, withoutEnlargement: true })
    .png({ compressionLevel: 9 })
    .toFile(out);
  console.log('written', out);
}
