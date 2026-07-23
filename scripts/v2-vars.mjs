// 10 варіацій подачі Джеремі (D-031): повне тіло / активні й гіперболізовані
// емоції / з обідком-стікером і без / різні плани. OpenRouter gemini-2.5-flash-image
// з двома реф-картинками (портрет-лице + повний ріст для пропорцій).
// Фон генерується сірим (#DDDDDD) → зрізається edge-connected flood fill
// (внутрішні світлі зони — очі, обідок стікера — зберігаються).
// Запуск: node scripts/v2-vars.mjs [лише_номери, напр. 3 7]
import sharp from 'sharp';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const KEY = (() => {
  const env = readFileSync('E:/Work Stuff/AA/.env.local', 'utf8');
  const m = env.match(/^OPENROUTER_API_KEY=(.+)$/m);
  if (!m) throw new Error('OPENROUTER_API_KEY не знайдено в AA/.env.local');
  return m[1].trim();
})();

const b64 = (p, mime) => `data:${mime};base64,${readFileSync(p).toString('base64')}`;
const refFace = b64('public/v2/dialog/calm.png', 'image/png');
const refBody = b64('public/v2/hero-jeremy/still.png', 'image/png');

const CHAR =
  'Same character as in the two reference images: a cheerful boy ~12 years old, dark backwards baseball cap, brown hair, big brown eyes, dark t-shirt. Flat cartoon illustration, clean bold shapes, soft cel shading, vibrant colors. Solid plain light gray #DDDDDD background, nothing else in frame.';

const VARS = [
  { n: 1, tag: 'повне тіло · смеш у стрибку · без обідка', p: 'Full body, mid-air jump smashing a ping-pong ball with a red racket, dynamic diagonal action pose, mouth open with effort and joy.' },
  { n: 2, tag: 'повне тіло · жест «дивись, що тут» · без обідка', p: 'Full body standing slightly sideways, one arm sweeping wide presenting something off-frame, proud confident smile, other hand in pocket.' },
  { n: 3, tag: 'погруддя · гіпер-ШОК · без обідка', p: 'Bust shot, hugely exaggerated shocked expression: jaw dropped to the floor, eyes popping enormous, hands pressed on cheeks, comic style exaggeration.' },
  { n: 4, tag: 'погруддя · гіпер-ХАЙП · без обідка', p: 'Bust shot, over-the-top excitement: screaming with joy, huge open smile, squeezed shut happy eyes, both fists clenched up, stars and sparkles around head.' },
  { n: 5, tag: 'по пояс · стікер з ТОВСТИМ білим обідком', p: 'Waist-up, winking and giving a thumbs up, die-cut sticker style with a thick uniform white outline border around the character silhouette.' },
  { n: 6, tag: 'по пояс · нахил У КАМЕРУ, вказує на глядача', p: 'Waist-up leaning strongly INTO the camera, pointing index finger straight at the viewer with exaggerated foreshortening (finger and hand big, closer to camera), mischievous grin.' },
  { n: 7, tag: 'чібі · повний ріст з ракеткою', p: 'Chibi proportions: oversized head, tiny body, full figure, hugging a ping-pong racket, huge sparkling eyes, cheerful, super cute.' },
  { n: 8, tag: 'повний ріст · зі спини через плече · ракетка на плечі', p: 'Full body from three-quarter back view, looking back over his shoulder at the viewer with a cool smirk, red racket resting on shoulder, relaxed street posture.' },
  { n: 9, tag: 'екстрим-клоузап · погляд-виклик', p: 'Extreme close-up of the face filling the frame, challenging confident grin, one eyebrow raised, looking straight at viewer.' },
  { n: 10, tag: 'фістбамп У КАМЕРУ · перебільшена перспектива', p: 'Fist bump thrown straight at the camera with dramatic foreshortening: the fist is HUGE in the foreground, determined happy face behind it.' },
];

/** Альфа: flood fill від рамки кадру по кольору фону (колір кута ± tol). */
async function cutBg(buf) {
  const img = sharp(buf).ensureAlpha();
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const ref = [data[0], data[1], data[2]];
  const near = (i) =>
    Math.abs(data[i] - ref[0]) < 26 && Math.abs(data[i + 1] - ref[1]) < 26 && Math.abs(data[i + 2] - ref[2]) < 26;
  const seen = new Uint8Array(w * h);
  const stack = [];
  for (let x = 0; x < w; x++) { stack.push(x, x + (h - 1) * w); }
  for (let y = 0; y < h; y++) { stack.push(y * w, w - 1 + y * w); }
  while (stack.length) {
    const p = stack.pop();
    if (seen[p]) continue;
    seen[p] = 1;
    if (!near(p * 4)) continue;
    data[p * 4 + 3] = 0;
    const x = p % w, y = (p / w) | 0;
    if (x > 0) stack.push(p - 1);
    if (x < w - 1) stack.push(p + 1);
    if (y > 0) stack.push(p - w);
    if (y < h - 1) stack.push(p + w);
  }
  return sharp(data, { raw: { width: w, height: h, channels: 4 } })
    .trim({ threshold: 10 })
    .resize({ height: 900, fit: 'inside', withoutEnlargement: true })
    .png()
    .toBuffer();
}

async function gen(v, attempt = 1) {
  const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash-image',
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: `${CHAR}\n\nPose/emotion for this image: ${v.p}` },
          { type: 'image_url', image_url: { url: refFace } },
          { type: 'image_url', image_url: { url: refBody } },
        ],
      }],
    }),
  });
  const j = await r.json();
  const url = j?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  if (!url) {
    if (attempt < 3) { console.log(`#${v.n} retry ${attempt + 1} (${j?.error?.message ?? 'no image'})`); return gen(v, attempt + 1); }
    throw new Error(`#${v.n}: ${JSON.stringify(j).slice(0, 200)}`);
  }
  const raw = Buffer.from(url.split(',')[1], 'base64');
  const out = await cutBg(raw);
  const file = `public/v2/vars/${String(v.n).padStart(2, '0')}.png`;
  writeFileSync(file, out);
  console.log(`✓ #${v.n} ${v.tag} → ${file} (${(out.length / 1024) | 0}kb)`);
}

mkdirSync('public/v2/vars', { recursive: true });
const only = process.argv.slice(2).map(Number);
const list = only.length ? VARS.filter((v) => only.includes(v.n)) : VARS;
// по 3 паралельно, щоб не впертись у рейт-ліміт
for (let i = 0; i < list.length; i += 3) {
  await Promise.all(list.slice(i, i + 3).map((v) => gen(v).catch((e) => console.error('✗', e.message))));
}
console.log('done');
