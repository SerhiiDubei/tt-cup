// Фони онбордингу за РЕАЛЬНОЮ локацією ДРУЇД (D-026/D-033, фото Сергія 21.07):
// ОДИН вуличний стіл, сіра бруківка, високі старі дерева, лавки, гірлянда ввечері.
// Вертикальні 9:16 сцени без людей. Запуск: node scripts/v2-bg-druid.mjs
import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'node:fs';

const KEY = readFileSync('E:/Work Stuff/AA/.env.local', 'utf8').match(/^OPENROUTER_API_KEY=(.+)$/m)[1].trim();

// ВПІЗНАВАНІСТЬ (фідбек 21.07): не «фентезі за мотивами», а реальна локація
// з фото — конкретний стіл, конкретна бруківка, конкретні ліхтарі. Без соборів.
const STYLE =
  'Stylized painterly illustration faithfully depicting a REAL recognizable place (keep the real layout and objects, just rendered as clean warm cartoon painting). NO people, NO text except the word EXPERT on the table skirt. Tall vertical portrait composition 9:16, full-bleed edge to edge, no frame, no border, no margins.';

const PLACE =
  "The real place: a city park corner in western Ukraine. ONE outdoor foldable table-tennis table: light gray top with thin white edge lines, blue net, and a black skirt panel under the tabletop with small white letters EXPERT, simple black metal legs. It stands on small square gray cobblestone pavers (old-town style paving). Around: very tall dense old trees with dark green foliage (black locust and chestnut), simple wooden park benches with black metal frames, low round globe park lanterns on short posts, a low hedge. Behind the trees only hints of ordinary low 2-4 storey city houses (one yellowish with a plain red roof) — modest, NOT grand architecture, NO churches, NO cathedrals, NO towers.";

const SCENES = [
  { f: 'druid-alley', p: `${STYLE} A cobblestone park alley in perspective with the small square gray pavers, tall dense trees forming a green canopy, simple benches with black metal frames along the path, round globe lanterns on short posts, a bicycle leaning near a bench, soft dappled daylight. No table in this shot. ${PLACE.split('Around:')[1] ? '' : ''}` },
  { f: 'druid-day', p: `${STYLE} ${PLACE} Daytime, soft sunlight through the leaves, the single EXPERT table slightly off-center seen a bit from the side, benches and globe lanterns around, calm and ordinary — like a snapshot of the real spot.` },
  { f: 'druid-evening', p: `${STYLE} ${PLACE} Evening: a single string of warm round bulbs on a thin black cable hangs above the table between two trees, deep blue dusk sky in the gaps of dark foliage, warm light pooling on the gray pavers. Cozy, real, understated.` },
  { f: 'druid-dayx', p: `${STYLE} ${PLACE} Tournament day at the same spot: two strings of warm bulbs and small triangular flag garlands between the trees, golden late-afternoon light, a few paper confetti pieces on the pavers, the same single EXPERT table — festive but still the recognizable real place.` },
];

async function gen(s, attempt = 1) {
  const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash-image',
      messages: [{ role: 'user', content: [{ type: 'text', text: s.p }] }],
    }),
  });
  const j = await r.json();
  const url = j?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  if (!url) {
    if (attempt < 4) { console.log(`${s.f} retry ${attempt + 1} (${j?.error?.message ?? 'no image'})`); return gen(s, attempt + 1); }
    throw new Error(`${s.f}: no image`);
  }
  const raw = Buffer.from(url.split(',')[1], 'base64');
  // одразу кроп можливих запечених полів: суцільні одноколірні смуги зверху/знизу
  const { data, info } = await sharp(raw).raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h, channels: c } = info;
  const px = (x, y) => [data[(y * w + x) * c], data[(y * w + x) * c + 1], data[(y * w + x) * c + 2]];
  const marginRow = (y, ref) => {
    let ok = 0;
    for (let x = 0; x < w; x += 2) {
      const [r2, g, b] = px(x, y);
      if (Math.abs(r2 - ref[0]) < 14 && Math.abs(g - ref[1]) < 14 && Math.abs(b - ref[2]) < 14) ok++;
    }
    return ok / Math.ceil(w / 2) > 0.97;
  };
  let top = 0; const tRef = px(2, 2);
  while (top < h * 0.4 && marginRow(top, tRef)) top++;
  let bot = h - 1; const bRef = px(2, h - 3);
  while (bot > h * 0.6 && marginRow(bot, bRef)) bot--;
  const out = await sharp(raw)
    .extract({ left: 0, top, width: w, height: bot - top + 1 })
    .resize({ width: 900, withoutEnlargement: true })
    .jpeg({ quality: 86 })
    .toBuffer();
  writeFileSync(`public/v2/bg/${s.f}.jpg`, out);
  console.log(`✓ ${s.f} → ${w}x${bot - top + 1} (${(out.length / 1024) | 0}kb)`);
}

for (const s of SCENES) await gen(s).catch((e) => console.error('✗', e.message));
console.log('done');
