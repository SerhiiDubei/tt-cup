// Перегенерація бракованих варіацій (D-031): 08 (була тенісна ракетка +
// продірявлена кепка) і 09 (клоузап різати не можна — зберігаємо повний кадр).
// Запуск: node scripts/v2-vars-regen.mjs
import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'node:fs';

const KEY = readFileSync('E:/Work Stuff/AA/.env.local', 'utf8').match(/^OPENROUTER_API_KEY=(.+)$/m)[1].trim();
const b64 = (p) => `data:image/png;base64,${readFileSync(p).toString('base64')}`;
const refFace = b64('public/v2/dialog/calm.png');
const refBody = b64('public/v2/hero-jeremy/still.png');

const CHAR =
  'Same character as in the two reference images: a cheerful boy ~12 years old, DARK CHARCOAL backwards baseball cap (keep the cap dark, not gray), brown hair, big brown eyes, dark t-shirt. Flat cartoon illustration, clean bold shapes, soft cel shading, vibrant colors.';

const JOBS = [
  {
    n: 8, cut: true,
    p: `${CHAR} Solid plain light gray #DDDDDD background, nothing else in frame.\n\nPose: full body from three-quarter back view, looking back over his shoulder at the viewer with a cool smirk, holding a small round TABLE TENNIS PADDLE (short handle ping-pong bat, red rubber, NOT a tennis racket with strings) resting on his shoulder, relaxed street posture. Entire character fully inside frame with margin on all sides.`,
  },
  {
    n: 9, cut: false,
    p: `${CHAR}\n\nShot: extreme close-up of the face filling the whole frame edge to edge, challenging confident grin, one eyebrow raised, looking straight at viewer. Background: blurred warm evening park with string lights bokeh. Cinematic dialogue-scene framing.`,
  },
];

async function cutBg(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const isBg = (i) => {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const mn = Math.min(r, g, b), mx = Math.max(r, g, b);
    return mn > 185 && mx < 243 && mx - mn < 16;
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
  return sharp(data, { raw: { width: w, height: h, channels: 4 } })
    .trim({ threshold: 10 }).resize({ height: 900, fit: 'inside', withoutEnlargement: true }).png().toBuffer();
}

for (const job of JOBS) {
  for (let attempt = 1; attempt <= 4; attempt++) {
    const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-image',
        messages: [{ role: 'user', content: [
          { type: 'text', text: job.p },
          { type: 'image_url', image_url: { url: refFace } },
          { type: 'image_url', image_url: { url: refBody } },
        ]}],
      }),
    });
    const j = await r.json();
    const url = j?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    if (!url) { console.log(`#${job.n} retry ${attempt} (${j?.error?.message ?? 'no image'})`); continue; }
    const raw = Buffer.from(url.split(',')[1], 'base64');
    const out = job.cut
      ? await cutBg(raw)
      : await sharp(raw).resize({ height: 900, fit: 'inside', withoutEnlargement: true }).png().toBuffer();
    writeFileSync(`public/v2/vars/${String(job.n).padStart(2, '0')}.png`, out);
    console.log(`✓ #${job.n} перегенеровано (${(out.length / 1024) | 0}kb)`);
    break;
  }
}
console.log('done');
