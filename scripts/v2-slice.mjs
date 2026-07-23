// Нарізка GPT-аркушів на окремі спрайти: маска «не-білого» → морфологічне
// розширення → звʼязні компоненти → злиття боксів → кроп + білий фон в альфу.
// Запуск: node scripts/v2-slice.mjs <вхідна-папка> <вихідна-папка-в-public>
import sharp from 'sharp';
import path from 'node:path';
import fs from 'node:fs';

const [inDir, outRel] = process.argv.slice(2);
if (!inDir || !outRel) {
  console.error('usage: node scripts/v2-slice.mjs <in-dir> <public-relative-out>');
  process.exit(1);
}
const outDir = path.join(process.cwd(), 'public', outRel);
fs.mkdirSync(outDir, { recursive: true });

const DS = 4; // даунскейл для маски
const DILATE = 0; // радіус розширення (у даунскейл-пікселях) — клеїть пунктири
const MIN_AREA = 42 * 42; // мінімальна площа спрайта у fullres-пікселях

function buildMask(data, w, h) {
  // «чорнило» = не майже-білий
  const m = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const r = data[i * 3], g = data[i * 3 + 1], b = data[i * 3 + 2];
    if (Math.min(r, g, b) < 236) m[i] = 1;
  }
  return m;
}

function dilate(m, w, h, rad) {
  const out = new Uint8Array(m);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!m[y * w + x]) continue;
      for (let dy = -rad; dy <= rad; dy++) {
        for (let dx = -rad; dx <= rad; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx >= 0 && ny >= 0 && nx < w && ny < h) out[ny * w + nx] = 1;
        }
      }
    }
  }
  return out;
}

function components(m, w, h) {
  const seen = new Uint8Array(w * h);
  const boxes = [];
  const qx = new Int32Array(w * h);
  const qy = new Int32Array(w * h);
  for (let sy = 0; sy < h; sy++) {
    for (let sx = 0; sx < w; sx++) {
      const si = sy * w + sx;
      if (!m[si] || seen[si]) continue;
      let head = 0, tail = 0;
      qx[tail] = sx; qy[tail] = sy; tail++;
      seen[si] = 1;
      let x0 = sx, x1 = sx, y0 = sy, y1 = sy, area = 0;
      while (head < tail) {
        const x = qx[head], y = qy[head]; head++;
        area++;
        if (x < x0) x0 = x; if (x > x1) x1 = x;
        if (y < y0) y0 = y; if (y > y1) y1 = y;
        for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const ni = ny * w + nx;
          if (m[ni] && !seen[ni]) { seen[ni] = 1; qx[tail] = nx; qy[tail] = ny; tail++; }
        }
      }
      boxes.push({ x0, y0, x1, y1, area });
    }
  }
  return boxes;
}

function mergeBoxes(boxes, gap) {
  let merged = true;
  while (merged) {
    merged = false;
    outer: for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i], b = boxes[j];
        if (a.x0 - gap <= b.x1 && b.x0 - gap <= a.x1 && a.y0 - gap <= b.y1 && b.y0 - gap <= a.y1) {
          a.x0 = Math.min(a.x0, b.x0); a.y0 = Math.min(a.y0, b.y0);
          a.x1 = Math.max(a.x1, b.x1); a.y1 = Math.max(a.y1, b.y1);
          a.area += b.area;
          boxes.splice(j, 1);
          merged = true;
          break outer;
        }
      }
    }
  }
  return boxes;
}

const files = fs.readdirSync(inDir).filter((f) => f.endsWith('.png') && !f.includes('(1)')).sort();
let sheet = 0;
for (const f of files) {
  const img = sharp(path.join(inDir, f));
  const meta = await img.metadata();
  const W = meta.width, H = meta.height;
  const dw = Math.ceil(W / DS), dh = Math.ceil(H / DS);
  const small = await sharp(path.join(inDir, f)).resize(dw, dh).removeAlpha().raw().toBuffer();
  let mask = buildMask(small, dw, dh);
  mask = dilate(mask, dw, dh, DILATE);
  let boxes = components(mask, dw, dh)
    .map((b) => ({ x0: b.x0 * DS, y0: b.y0 * DS, x1: (b.x1 + 1) * DS, y1: (b.y1 + 1) * DS, area: b.area * DS * DS }))
    .filter((b) => b.area > MIN_AREA);
  boxes = mergeBoxes(boxes, 2);
  boxes.sort((a, b) => (a.y0 - b.y0) || (a.x0 - b.x0));

  const full = await sharp(path.join(inDir, f)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let n = 0;
  for (const b of boxes) {
    const pad = 6;
    const x0 = Math.max(0, b.x0 - pad), y0 = Math.max(0, b.y0 - pad);
    const x1 = Math.min(W, b.x1 + pad), y1 = Math.min(H, b.y1 + pad);
    const cw = x1 - x0, ch = y1 - y0;
    if (cw < 30 || ch < 30) continue;
    // Кроп із raw. Прозорість — ЛИШЕ фон, досяжний з країв кадру (flood fill):
    // білки очей, сорочки та інші білі деталі ВСЕРЕДИНІ контуру лишаються.
    const buf = Buffer.alloc(cw * ch * 4);
    const nearWhite = new Uint8Array(cw * ch);
    for (let y = 0; y < ch; y++) {
      for (let x = 0; x < cw; x++) {
        const si = ((y0 + y) * W + (x0 + x)) * 4;
        const di = (y * cw + x) * 4;
        const r = full.data[si], g = full.data[si + 1], bl = full.data[si + 2];
        buf[di] = r; buf[di + 1] = g; buf[di + 2] = bl;
        buf[di + 3] = 255;
        const mn = Math.min(r, g, bl);
        if (mn > 232) nearWhite[y * cw + x] = 1;
      }
    }
    // BFS від рамки кропу по майже-білому
    const reach = new Uint8Array(cw * ch);
    const fqx = new Int32Array(cw * ch);
    const fqy = new Int32Array(cw * ch);
    let fh = 0, ft = 0;
    const push = (x, y) => {
      const i = y * cw + x;
      if (nearWhite[i] && !reach[i]) { reach[i] = 1; fqx[ft] = x; fqy[ft] = y; ft++; }
    };
    for (let x = 0; x < cw; x++) { push(x, 0); push(x, ch - 1); }
    for (let y = 0; y < ch; y++) { push(0, y); push(cw - 1, y); }
    while (fh < ft) {
      const x = fqx[fh], y = fqy[fh]; fh++;
      if (x > 0) push(x - 1, y);
      if (x < cw - 1) push(x + 1, y);
      if (y > 0) push(x, y - 1);
      if (y < ch - 1) push(x, y + 1);
    }
    for (let i = 0; i < cw * ch; i++) {
      if (!reach[i]) continue;
      const mn = Math.min(buf[i * 4], buf[i * 4 + 1], buf[i * 4 + 2]);
      buf[i * 4 + 3] = mn > 246 ? 0 : Math.round(((246 - mn) / 14) * 255);
    }
    await sharp(buf, { raw: { width: cw, height: ch, channels: 4 } })
      .png({ compressionLevel: 9 })
      .toFile(path.join(outDir, `s${sheet}-${String(n).padStart(2, '0')}.png`));
    n++;
  }
  console.log(`sheet ${sheet} (${f}): ${n} sprites`);
  sheet++;
}
console.log('out:', outDir);
