// Headless QA: load the editor in Chromium, exercise it, screenshot.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const dir = path.dirname(fileURLToPath(import.meta.url));
const url = 'file://' + path.join(dir, 'index.html');
const shot = (p) => path.join(dir, 'stills', p);

const errors = [];
const browser = await chromium.launch({ executablePath: process.env.PW_EXE });
const page = await browser.newPage({ viewport: { width: 1160, height: 620 } });
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(400);

// 1) initial (orthogonal demo scene)
await page.screenshot({ path: shot('editor_1_ortho.png') });

// sanity: how many objects rendered?
const objCount = await page.evaluate(() => window.SceneLang
  ? ['background','midground','foreground'].reduce((a,p)=>a+window.SceneLang.planeLayers[p].find('.object').length,0) : -1);
console.log('objects:', objCount);

// 2) switch to isometric grid
await page.click('#grid-iso');
await page.waitForTimeout(300);
await page.screenshot({ path: shot('editor_2_iso.png') });

// 3) select an object (the character) and show inspector; verify PNG exports
const exportOk = await page.evaluate(() => {
  const objs = window.SceneLang.planeLayers.midground.find('.object');
  const ch = objs.find(o => o.getAttr('objType') === 'character') || objs[0];
  window.SceneLang.select(ch);
  const objPng = ch.toDataURL({ pixelRatio: 1 });
  // per-layer composite via stage
  const comp = window.SceneLang.stage.toDataURL({ pixelRatio: 1 });
  return { objPng: objPng.startsWith('data:image/png') && objPng.length > 200,
           comp: comp.startsWith('data:image/png') && comp.length > 500 };
});
console.log('export png ok:', JSON.stringify(exportOk));
await page.waitForTimeout(200);
await page.screenshot({ path: shot('editor_3_selected.png') });

// 4) back to ortho, hide FG layer, add a couple objects, export scene JSON to console
await page.click('#grid-ortho');
await page.waitForTimeout(200);
const json = await page.evaluate(() => {
  window.SceneLang.state.activePlane = 'midground';
  window.SceneLang.addObject('plant', {});
  window.SceneLang.ySortPlane('midground');
  // build a JSON snapshot without triggering a download
  const PL = ['background','midground','foreground'];
  return JSON.stringify({
    grid: { orientation: window.SceneLang.state.orientation, tile: window.SceneLang.state.tile },
    objects: PL.flatMap(p => window.SceneLang.planeLayers[p].find('.object').map(n => ({
      type: n.getAttr('objType'), cell: [n.getAttr('cellCol'), n.getAttr('cellRow')], plane: p })))
  });
});
await page.screenshot({ path: shot('editor_4_final.png') });
console.log('scene json:', json);

console.log('ERRORS:', errors.length ? errors : 'none');
await browser.close();
process.exit(errors.length ? 1 : 0);
