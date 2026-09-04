// Фони онбордингу за КАНОН-ДИСЦИПЛІНОЮ STORY BOARD (D-056).
//
// Принцип (з 70_pipeline/ASSET_MANIFEST.md): постійний набір референсів, який
// їде в генерацію ЗАВЖДИ той самий — у цьому й консистентність. Канон ніколи
// не перегенеровується «трохи кращим»; заміна канону = окреме рішення в DECISIONS.
//
// Розкладка слотів (ліміт 14 у Gemini 3 Pro Image):
//   ОБʼЄКТНІ  — 1 ракурс локації (найближчий до сцени) з style/canon/location/
//   СТИЛЬОВІ  — 1 еталон манери з style/canon/style/
//   (персонажні слоти для фонів не використовуються — герой малюється окремо)
//
// Запуск: node scripts/bg-canon.mjs <сцена> [--style=bw|color] [--model=pro|flash]
import sharp from 'sharp';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const KEY = readFileSync('E:/Work Stuff/AA/.env.local', 'utf8').match(/^OPENROUTER_API_KEY=(.+)$/m)[1].trim();
const CANON = 'style/canon';

/** Реф у слот: вертикальний 9:16 кроп (модель повторює формат входів). */
async function slot(path) {
  const buf = await sharp(path).resize(896, 1568, { fit: 'cover', position: 'attention' })
    .jpeg({ quality: 82 }).toBuffer();
  return { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${buf.toString('base64')}` } };
}

/** Канон локації: 6 ракурсів. Сцена бере ОДИН — найближчий. */
const LOC = {
  'front-centered': `${CANON}/location/location-front-centered-04.jpeg`,
  'table-close': `${CANON}/location/location-table-close-02.jpeg`,
  'side-path': `${CANON}/location/location-side-path-03.jpeg`,
  'tree-canopy': `${CANON}/location/location-front-tree-canopy-05.jpeg`,
  'wide-right': `${CANON}/location/location-wide-right-06.jpeg`,
  'front-wide': `${CANON}/location/location-front-wide-01.jpeg`,
};

const STYLES = {
  bw: {
    file: `${CANON}/style/style_anchor_bw.png`,
    manner:
      'Match the drawing MANNER of the style reference exactly: hand-drawn graphite pencil illustration, visible pencil hatching and cross-hatching, soft grain of toned paper, monochrome graphite greys, gentle atmospheric depth. NOT vector, NOT flat digital, NOT photoreal.',
  },
  color: {
    file: 'public/v2/bg/druid-evening.jpg',
    manner:
      'Match the painting MANNER of the style reference: clean painted animation-background, soft cel shading, warm palette, simple confident shapes.',
  },
};

const SCENES = {
  'druid-day': { loc: 'front-centered', p: 'Bright sunny summer DAY in the club yard: the clubhouse facade with the arched window and the table-tennis table in front, string lights on the cable OFF, dappled acacia shade on the pavers.' },
  'druid-evening': { loc: 'front-centered', p: 'EVENING blue hour in the same yard: the string lights above the yard are ON and glowing warm, deep dusk sky, the arched window softly lit from inside.' },
  'druid-alley': { loc: 'side-path', p: 'The park alley beside the club in daylight: paver path in perspective, rustic log benches, a bicycle leaning nearby, tall acacia canopy overhead. The clubhouse only peeking at the edge. No table in this shot.' },
  'druid-dayx': { loc: 'wide-right', p: 'Tournament day in the same yard: triangular flag garlands strung between the trees along with the lamps, golden late-afternoon light, a few confetti on the pavers.' },
  'druid-table': { loc: 'table-close', p: 'Close view of the single table-tennis table on the pavers, the clubhouse wall behind, quiet moment before a match.' },
};

const args = process.argv.slice(2);
const name = args.find((a) => !a.startsWith('--'));
const styleKey = (args.find((a) => a.startsWith('--style='))?.split('=')[1] ?? 'color');
const modelKey = (args.find((a) => a.startsWith('--model='))?.split('=')[1] ?? 'pro');
const out = args.find((a) => a.startsWith('--out='))?.split('=')[1];

const scene = SCENES[name];
const style = STYLES[styleKey];
if (!scene || !style) {
  console.log('сцени:', Object.keys(SCENES).join(', '));
  console.log('стилі:', Object.keys(STYLES).join(', '));
  process.exit(1);
}
const MODEL = modelKey === 'pro' ? 'google/gemini-3-pro-image' : 'google/gemini-2.5-flash-image';
if (!existsSync(style.file)) { console.error('нема еталона стилю:', style.file); process.exit(1); }

const PROMPT = `Draw a BACKGROUND illustration of a real, specific place.

REFERENCE 1 = STYLE ANCHOR. ${style.manner}
REFERENCE 2 = THE PLACE (photo). Keep every recognizable detail of this exact location: the white clubhouse with the big arched window and dark brown shutters, the dark rough stone corner pillars, the corrugated roof with wooden beams, the gray foldable table-tennis table on square pavers, the thin cable with small lamps, the tall acacia trees, the old plastered wall.

SCENE: ${scene.p}

Strictly NO people, NO text, NO lettering, NO watermarks. Tall vertical portrait 9:16, full-bleed edge to edge, no frame or borders. This is a background plate — leave the lower third visually calm for a dialogue box.`;

async function gen(attempt = 1) {
  const content = [
    { type: 'text', text: PROMPT },
    await slot(style.file),            // стильовий слот
    await slot(LOC[scene.loc]),        // обʼєктний слот: 1 найближчий ракурс
  ];
  const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ model: MODEL, messages: [{ role: 'user', content }] }),
  });
  const j = await r.json();
  const url = j?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  if (!url) {
    if (attempt < 4) { console.log(`retry ${attempt + 1}: ${j?.error?.message ?? 'no image'}`); return gen(attempt + 1); }
    throw new Error(JSON.stringify(j).slice(0, 300));
  }
  const raw = Buffer.from(url.split(',')[1], 'base64');
  const meta = await sharp(raw).metadata();
  const file = out ?? `public/v2/bg/${name}.jpg`;
  await sharp(raw).resize({ width: 900, withoutEnlargement: true }).jpeg({ quality: 88 }).toFile(file);
  console.log(`✓ ${name} [${styleKey}/${modelKey}] ${meta.width}x${meta.height} → ${file}`);
}

await gen();
