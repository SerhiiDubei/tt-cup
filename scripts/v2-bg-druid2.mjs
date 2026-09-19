// Фони онбордингу v2 (D-052): img2img за РЕАЛЬНИМИ фото ДРУЇДА
// (E:\Work Stuff\ttcup-onboard\PHOTO DRUID) — консистентна впізнавана сцена:
// білий будиночок клубу з арочним вікном і темними віконницями, чорний
// камʼяний кут, стіл на світлій плитці, гірлянда на тросах, високі акації.
// Запуск: node scripts/v2-bg-druid2.mjs [сцени: day evening alley dayx]
import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'node:fs';

const KEY = readFileSync('E:/Work Stuff/AA/.env.local', 'utf8').match(/^OPENROUTER_API_KEY=(.+)$/m)[1].trim();
const PH = 'E:/Work Stuff/ttcup-onboard/PHOTO DRUID';

/** Реф-фото стискаємо до 1024px, щоб запит не роздувався. */
async function ref(n) {
  const buf = await sharp(`${PH}/photo_${n}_2026-08-03_17-01-45.jpg`)
    .resize({ width: 1024, withoutEnlargement: true }).jpeg({ quality: 78 }).toBuffer();
  return `data:image/jpeg;base64,${buf.toString('base64')}`;
}

const KEEP =
  'Redraw this EXACT real place as a warm painterly cartoon illustration background (clean shapes, soft light). KEEP the real layout and recognizable details from the reference photos: the white one-storey clubhouse with a big arched window with dark brown wooden shutters, dark rough stone corner base, dark roof; the gray foldable table-tennis table on light square pavers right next to the house; thin cables with small lamps strung above the yard; tall black locust (acacia) trees with lacy foliage around. NO people, NO text, NO letters. Tall vertical portrait 9:16 full-bleed composition, no frame, no borders.';

const SCENES = [
  {
    f: 'druid-day', refs: [15, 22, 16],
    p: `${KEEP} Scene: sunny summer day at the club yard — the table and the arched-window facade both clearly visible, dappled acacia shade on the pavers.`,
  },
  {
    f: 'druid-evening', refs: [15, 40],
    p: `${KEEP} Scene: the SAME yard at evening blue hour — deep blue sky, the string lights above the yard are ON with a warm glow, warm light pooling on the pavers and the white wall, the arched window softly lit from inside.`,
  },
  {
    f: 'druid-alley', refs: [33, 30, 19],
    p: `${KEEP} Scene: the park alley next to the club — pinkish-gray pavers in perspective, rustic log-fence benches along the path, a bicycle leaning nearby, tall acacia canopy above, sunny with soft shadows. The clubhouse just peeking in the distance. No table in this shot.`,
  },
  {
    f: 'druid-dayx', refs: [22, 15],
    p: `${KEEP} Scene: tournament day at the SAME yard — small triangular flag garlands added between the trees along with the lamps, golden late-afternoon light, festive but still the same recognizable place, a few confetti on the pavers.`,
  },
];

async function gen(s, attempt = 1) {
  const refs = await Promise.all(s.refs.map(ref));
  const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash-image',
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: s.p },
          ...refs.map((u) => ({ type: 'image_url', image_url: { url: u } })),
        ],
      }],
    }),
  });
  const j = await r.json();
  const url = j?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  if (!url) {
    if (attempt < 4) { console.log(`${s.f} retry ${attempt + 1} (${j?.error?.message ?? 'no image'})`); return gen(s, attempt + 1); }
    throw new Error(`${s.f}: no image`);
  }
  let img = sharp(Buffer.from(url.split(',')[1], 'base64'));
  // зріз одноколірних полів з усіх боків
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h, channels: c } = info;
  const px = (x, y) => [data[(y * w + x) * c], data[(y * w + x) * c + 1], data[(y * w + x) * c + 2]];
  const same = (a, b) => Math.abs(a[0] - b[0]) < 14 && Math.abs(a[1] - b[1]) < 14 && Math.abs(a[2] - b[2]) < 14;
  const rowM = (y, ref2) => { let ok = 0; for (let x = 0; x < w; x += 2) if (same(px(x, y), ref2)) ok++; return ok / Math.ceil(w / 2) > 0.97; };
  const colM = (x, ref2) => { let ok = 0; for (let y = 0; y < h; y += 2) if (same(px(x, y), ref2)) ok++; return ok / Math.ceil(h / 2) > 0.97; };
  let top = 0; while (top < h * 0.4 && rowM(top, px(2, 2))) top++;
  let bot = h - 1; while (bot > h * 0.6 && rowM(bot, px(2, h - 3))) bot--;
  let left = 0; while (left < w * 0.3 && colM(left, px(2, 2))) left++;
  let right = w - 1; while (right > w * 0.7 && colM(right, px(w - 3, 2))) right--;
  const out = await sharp(Buffer.from(url.split(',')[1], 'base64'))
    .extract({ left, top, width: right - left + 1, height: bot - top + 1 })
    .resize({ width: 900, withoutEnlargement: true })
    .jpeg({ quality: 86 }).toBuffer();
  writeFileSync(`public/v2/bg/${s.f}.jpg`, out);
  console.log(`✓ ${s.f} (${(out.length / 1024) | 0}kb, кроп T${top} B${h - 1 - bot} L${left} R${w - 1 - right})`);
}

const only = process.argv.slice(2);
const list = only.length ? SCENES.filter((s) => only.some((o) => s.f.includes(o))) : SCENES;
for (const s of list) await gen(s).catch((e) => console.error('✗', e.message));
console.log('done');
