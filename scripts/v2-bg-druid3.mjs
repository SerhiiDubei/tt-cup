// Доганяємо day/alley/dayx до еталону: перший реф = наша ВЕРТИКАЛЬНА
// мальована druid-evening (якір стилю і формату), далі — реальні фото місця.
// Запуск: node scripts/v2-bg-druid3.mjs
import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'node:fs';

const KEY = readFileSync('E:/Work Stuff/AA/.env.local', 'utf8').match(/^OPENROUTER_API_KEY=(.+)$/m)[1].trim();
const PH = 'E:/Work Stuff/ttcup-onboard/PHOTO DRUID';

/** ВСІ рефи — вертикальні 9:16 (кроп cover): модель повторює формат входів. */
async function toRef(path) {
  const buf = await sharp(path)
    .resize(768, 1352, { fit: 'cover', position: 'attention' })
    .jpeg({ quality: 78 }).toBuffer();
  return `data:image/jpeg;base64,${buf.toString('base64')}`;
}
const photo = (n) => toRef(`${PH}/photo_${n}_2026-08-03_17-01-45.jpg`);
const styleAnchor = () => toRef('public/v2/bg/druid-evening.jpg');

const BASE =
  'The FIRST reference image is a painted illustration of this exact place — copy its illustration STYLE and its TALL VERTICAL 9:16 composition exactly. The other references are real photos of the same place. Repaint the scene keeping every recognizable detail: white clubhouse with big arched window and dark brown shutters, dark rough stone corners, gray foldable table-tennis table on light pavers, thin cables with small lamps, tall acacia trees. Strictly NO people, NO text. NOT photorealistic — clean painted animation-background style like reference 1. Tall vertical portrait 9:16, full-bleed.';

const SCENES = [
  { f: 'druid-day', refs: [15, 22], p: `${BASE} Scene: bright sunny summer DAY at the club yard — blue sky, dappled acacia shade on the pavers, lamps on the cables visible but OFF, the arched window DARK (no warm interior light — it is daytime).` },
  { f: 'druid-alley', refs: [33, 30], p: `${BASE} Scene: the park alley beside the club in daylight — pinkish-gray pavers in perspective, rustic LOG benches along the path, a bicycle leaning nearby, acacia canopy; the clubhouse just peeking at the side. No table in this shot.` },
  { f: 'druid-dayx', refs: [22, 15], p: `${BASE} Scene: tournament day at the yard — small triangular flag garlands between the trees, golden late-afternoon light, a few confetti on the pavers, festive but the same recognizable place.` },
];

async function gen(s, attempt = 1) {
  const refs = [await styleAnchor(), ...(await Promise.all(s.refs.map(photo)))];
  const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash-image',
      messages: [{ role: 'user', content: [
        { type: 'text', text: s.p },
        ...refs.map((u) => ({ type: 'image_url', image_url: { url: u } })),
      ]}],
    }),
  });
  const j = await r.json();
  const url = j?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  if (!url) {
    if (attempt < 4) { console.log(`${s.f} retry ${attempt + 1} (${j?.error?.message ?? 'no image'})`); return gen(s, attempt + 1); }
    throw new Error(`${s.f}: no image`);
  }
  const raw = Buffer.from(url.split(',')[1], 'base64');
  const meta = await sharp(raw).metadata();
  const out = await sharp(raw).resize({ width: 900, withoutEnlargement: true }).jpeg({ quality: 86 }).toBuffer();
  writeFileSync(`public/v2/bg/${s.f}.jpg`, out);
  console.log(`✓ ${s.f} ${meta.width}x${meta.height} (${(out.length / 1024) | 0}kb)${meta.width > meta.height ? ' ⚠️ ГОРИЗОНТАЛЬНА' : ''}`);
}

for (const s of SCENES) await gen(s).catch((e) => console.error('✗', e.message));
console.log('done');
