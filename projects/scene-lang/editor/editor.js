/* scene-lang editor — layered pixel-art scene builder (Konva).
 *
 * Model (see ../RESEARCH.md):
 *   GRID  → place OBJECTS (each a generated PNG) → GROUPS → 3 LAYERS (planes)
 *   → composite. Control by layer/group: z front/back, hide, nudge, move-plane.
 *
 * Vocabulary borrowed from Godot: planes ≈ CanvasLayer, z within a plane ≈
 * z_index/move_child, groups ≈ add_to_group, y-sort ≈ y_sort_enabled.
 */
(function () {
  'use strict';

  // ---- config -------------------------------------------------------------
  const STAGE_W = 640, STAGE_H = 384;
  const PX = 4;                       // one "pixel-art pixel" = PX screen px
  const PLANES = ['background', 'midground', 'foreground'];
  const PLANE_LABEL = { background: 'BG', midground: 'MID', foreground: 'FG' };

  const state = {
    orientation: 'orthogonal',
    tile: 32,
    snap: true,
    autoYsort: false,
    activePlane: 'midground',
    selected: null,
    seq: 0,
  };

  // ---- Konva setup --------------------------------------------------------
  const stage = new Konva.Stage({ container: 'stage', width: STAGE_W, height: STAGE_H });
  const bgFill = new Konva.Layer({ listening: false });
  bgFill.add(new Konva.Rect({ x: 0, y: 0, width: STAGE_W, height: STAGE_H, fill: '#0c0e13' }));
  const gridLayer = new Konva.Layer({ listening: false });
  const planeLayers = {};
  PLANES.forEach((p) => { planeLayers[p] = new Konva.Layer(); });
  const uiLayer = new Konva.Layer({ listening: false });
  stage.add(bgFill, gridLayer, planeLayers.background, planeLayers.midground,
    planeLayers.foreground, uiLayer);

  const selectRect = new Konva.Rect({
    stroke: '#6ad0ff', strokeWidth: 1, dash: [4, 3], listening: false, visible: false,
  });
  uiLayer.add(selectRect);

  // ---- iso helpers --------------------------------------------------------
  function isoOrigin() { return { ox: STAGE_W / 2, oy: 60 }; }
  function cellToScreen(col, row) {
    const t = state.tile;
    if (state.orientation === 'orthogonal') return { x: col * t, y: row * t };
    const { ox, oy } = isoOrigin();
    return { x: ox + (col - row) * (t / 2), y: oy + (col + row) * (t / 4) };
  }
  function screenToCell(x, y) {
    const t = state.tile;
    if (state.orientation === 'orthogonal') return { col: x / t, row: y / t };
    const { ox, oy } = isoOrigin();
    const a = (x - ox) / (t / 2), b = (y - oy) / (t / 4);
    return { col: (a + b) / 2, row: (b - a) / 2 };
  }
  function snapPoint(x, y) {
    const c = screenToCell(x, y);
    const col = Math.round(c.col), row = Math.round(c.row);
    const s = cellToScreen(col, row);
    return { x: s.x, y: s.y, col, row };
  }

  // ---- grid rendering -----------------------------------------------------
  function drawGrid() {
    gridLayer.destroyChildren();
    const t = state.tile;
    const stroke = '#242a36';
    if (state.orientation === 'orthogonal') {
      for (let x = 0; x <= STAGE_W; x += t)
        gridLayer.add(new Konva.Line({ points: [x, 0, x, STAGE_H], stroke, strokeWidth: 1 }));
      for (let y = 0; y <= STAGE_H; y += t)
        gridLayer.add(new Konva.Line({ points: [0, y, STAGE_W, y], stroke, strokeWidth: 1 }));
    } else {
      const cols = 16, rows = 16;
      for (let c = 0; c <= cols; c++) {
        const a = cellToScreen(c, 0), b = cellToScreen(c, rows);
        gridLayer.add(new Konva.Line({ points: [a.x, a.y, b.x, b.y], stroke, strokeWidth: 1 }));
      }
      for (let r = 0; r <= rows; r++) {
        const a = cellToScreen(0, r), b = cellToScreen(cols, r);
        gridLayer.add(new Konva.Line({ points: [a.x, a.y, b.x, b.y], stroke, strokeWidth: 1 }));
      }
    }
    gridLayer.batchDraw();
  }

  // ---- pixel-art sprite generators ---------------------------------------
  // A tiny pixel canvas API: draw at "pixel-art" resolution, scaled by PX.
  function makeCanvas(pw, ph) {
    const c = document.createElement('canvas');
    c.width = pw * PX; c.height = ph * PX;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    const put = (x, y, col) => { ctx.fillStyle = col; ctx.fillRect(x * PX, y * PX, PX, PX); };
    const rect = (x, y, w, h, col) => { for (let i = 0; i < w; i++) for (let j = 0; j < h; j++) put(x + i, y + j, col); };
    return { c, ctx, put, rect, pw, ph };
  }
  function outline(cv, col) {
    // 1px dark outline around opaque pixels
    const { ctx, c } = cv, img = ctx.getImageData(0, 0, c.width, c.height);
    const on = (x, y) => x >= 0 && y >= 0 && x < c.width && y < c.height &&
      img.data[(y * c.width + x) * 4 + 3] > 0;
    ctx.fillStyle = col;
    for (let y = 0; y < cv.ph; y++) for (let x = 0; x < cv.pw; x++) {
      const px = x * PX, py = y * PX;
      if (on(px, py)) continue;
      if (on(px - PX, py) || on(px + PX, py) || on(px, py - PX) || on(px, py + PX))
        ctx.fillRect(px, py, PX, PX);
    }
  }

  const OUTLINE = '#0a0d13';
  const GEN = {
    desk(p) {
      const cv = makeCanvas(16, 12);
      const top = p.metal ? '#9aa6b4' : '#a97a4c', leg = p.metal ? '#6b7686' : '#7c5734';
      cv.rect(1, 3, 14, 3, top);           // desktop
      cv.rect(2, 2, 14, 1, p.metal ? '#c3ccd8' : '#c79a63'); // highlight
      cv.rect(2, 6, 2, 6, leg); cv.rect(12, 6, 2, 6, leg);   // legs
      outline(cv, OUTLINE); return cv.c;
    },
    chair(p) {
      const cv = makeCanvas(10, 12);
      const m = p.metal ? '#8b97a6' : '#8a5f39';
      cv.rect(2, 1, 2, 6, m);              // back
      cv.rect(2, 6, 6, 2, m);             // seat
      cv.rect(2, 8, 1, 4, m); cv.rect(7, 8, 1, 4, m); // legs
      outline(cv, OUTLINE); return cv.c;
    },
    window(p) {
      const cv = makeCanvas(14, 18);
      cv.rect(0, 0, 14, 18, '#6f7a86');   // frame
      cv.rect(1, 1, 12, 16, '#d7ecff');   // glass
      for (let y = 1; y < 17; y += 3) cv.rect(1, y, 12, 1, '#eaf6ff'); // light streaks
      cv.rect(6, 1, 1, 16, '#6f7a86'); cv.rect(1, 8, 12, 1, '#6f7a86'); // mullions
      outline(cv, OUTLINE); return cv.c;
    },
    plant(p) {
      const cv = makeCanvas(10, 12);
      cv.rect(3, 8, 4, 4, '#6b4a2a');     // pot
      cv.rect(2, 9, 6, 1, '#523a22');
      const g = ['#3c7a2a', '#4f9a34', '#2f5f22'];
      for (let i = 0; i < 14; i++) {
        const x = 1 + ((i * 5) % 8), y = 2 + ((i * 3) % 6);
        cv.rect(x, y, 1, 2, g[i % 3]);
      }
      outline(cv, OUTLINE); return cv.c;
    },
    lamp(p) {
      const cv = makeCanvas(8, 14);
      cv.rect(3, 10, 2, 4, '#4a4f5a');    // stand
      cv.rect(1, 11, 6, 1, '#3a3f48');    // base
      cv.rect(1, 4, 6, 5, '#ffd97a');     // shade (light)
      cv.rect(2, 3, 4, 1, '#fff0b8');
      outline(cv, OUTLINE); return cv.c;
    },
    character(p) {
      const cv = makeCanvas(10, 18);
      cv.rect(3, 1, 4, 4, '#12151d');     // head
      cv.rect(2, 5, 6, 8, '#171b26');     // body
      cv.rect(2, 13, 2, 5, '#12151d'); cv.rect(6, 13, 2, 5, '#12151d'); // legs
      cv.rect(2, 5, 1, 7, '#3a4d6b');     // rim light (left)
      outline(cv, OUTLINE); return cv.c;
    },
  };
  const OBJECT_TYPES = [
    { type: 'desk', label: 'Парта', params: { metal: true } },
    { type: 'chair', label: 'Стілець', params: { metal: true } },
    { type: 'window', label: 'Вікно', params: {} },
    { type: 'plant', label: 'Рослина', params: {} },
    { type: 'lamp', label: 'Світло', params: {} },
    { type: 'character', label: 'Персонаж', params: {} },
  ];

  // ---- objects ------------------------------------------------------------
  function addObject(type, params, cell) {
    const canvas = GEN[type](params || {});
    const w = canvas.width, h = canvas.height;
    const node = new Konva.Image({
      image: canvas, width: w, height: h, draggable: true,
      name: 'object', imageSmoothingEnabled: false,
    });
    node.setAttrs({ objType: type, params: params || {}, group: '', cellCol: 0, cellRow: 0 });
    // place: anchor feet (bottom-center) to a grid point
    const start = cell || snapPoint(STAGE_W / 2, STAGE_H * 0.6);
    positionByFeet(node, start.x, start.y);
    node.setAttrs({ cellCol: start.col, cellRow: start.row });

    planeLayers[state.activePlane].add(node);
    wireNode(node);
    select(node);
    if (state.autoYsort) ySortPlane(state.activePlane);
    planeLayers[state.activePlane].batchDraw();
    refreshGroups();
    return node;
  }
  function feetOf(node) { return { x: node.x() + node.width() / 2, y: node.y() + node.height() }; }
  function positionByFeet(node, fx, fy) { node.position({ x: fx - node.width() / 2, y: fy - node.height() }); }

  function wireNode(node) {
    node.on('mousedown tap', () => select(node));
    node.on('dragmove', () => updateSelectRect());
    node.on('dragend', () => {
      const f = feetOf(node);
      if (state.snap) {
        const s = snapPoint(f.x, f.y);
        positionByFeet(node, s.x, s.y);
        node.setAttrs({ cellCol: s.col, cellRow: s.row });
      } else {
        const c = screenToCell(f.x, f.y);
        node.setAttrs({ cellCol: Math.round(c.col), cellRow: Math.round(c.row) });
      }
      if (state.autoYsort) ySortPlane(node.getLayer().name() || currentPlaneOf(node));
      updateSelectRect(); updateInspector(); node.getLayer().batchDraw();
    });
  }

  function currentPlaneOf(node) {
    const layer = node.getLayer();
    return PLANES.find((p) => planeLayers[p] === layer);
  }

  // ---- selection ----------------------------------------------------------
  function select(node) {
    state.selected = node;
    updateSelectRect(); updateInspector();
  }
  function deselect() { state.selected = null; selectRect.visible(false); uiLayer.batchDraw(); updateInspector(); }
  function updateSelectRect() {
    const n = state.selected;
    if (!n) { selectRect.visible(false); uiLayer.batchDraw(); return; }
    const r = n.getClientRect();
    selectRect.setAttrs({ x: r.x - 1, y: r.y - 1, width: r.width + 2, height: r.height + 2, visible: true });
    uiLayer.batchDraw();
  }
  stage.on('mousedown', (e) => { if (e.target === stage) deselect(); });

  // ---- z-order / plane / hide --------------------------------------------
  function moveToPlane(node, plane) {
    node.moveTo(planeLayers[plane]);
    Object.values(planeLayers).forEach((l) => l.batchDraw());
    updateSelectRect(); updateInspector(); refreshGroups();
  }
  function ySortPlane(plane) {
    const nodes = planeLayers[plane].find('.object');
    nodes.slice().sort((a, b) => feetOf(a).y - feetOf(b).y)
      .forEach((n, i) => n.zIndex(i));
    planeLayers[plane].batchDraw();
  }

  // ---- groups -------------------------------------------------------------
  function allObjects() {
    return PLANES.flatMap((p) => planeLayers[p].find('.object'));
  }
  function refreshGroups() {
    const box = document.getElementById('groups');
    const names = [...new Set(allObjects().map((n) => n.getAttr('group')).filter(Boolean))];
    if (!names.length) { box.innerHTML = '<div class="hint">Груп поки немає</div>'; return; }
    box.innerHTML = '';
    names.forEach((name) => {
      const members = allObjects().filter((n) => n.getAttr('group') === name);
      const anyVisible = members.some((n) => n.visible());
      const el = document.createElement('div');
      el.className = 'layer-item';
      el.innerHTML = `<div class="layer-head"><span>${name} <span class="pill">${members.length}</span></span></div>`;
      const row = document.createElement('div'); row.className = 'row'; row.style.marginTop = '6px';
      const hide = document.createElement('button');
      hide.textContent = anyVisible ? 'Сховати' : 'Показати';
      hide.onclick = () => { members.forEach((n) => n.visible(!anyVisible)); Object.values(planeLayers).forEach((l) => l.batchDraw()); updateSelectRect(); refreshGroups(); };
      const toBg = document.createElement('button'); toBg.textContent = '→BG';
      toBg.onclick = () => { members.forEach((n) => n.moveTo(planeLayers.background)); Object.values(planeLayers).forEach((l) => l.batchDraw()); };
      const toFg = document.createElement('button'); toFg.textContent = '→FG';
      toFg.onclick = () => { members.forEach((n) => n.moveTo(planeLayers.foreground)); Object.values(planeLayers).forEach((l) => l.batchDraw()); };
      row.append(hide, toBg, toFg); el.append(row); box.append(el);
    });
  }

  // ---- inspector ----------------------------------------------------------
  function updateInspector() {
    const box = document.getElementById('inspector');
    const n = state.selected;
    if (!n) { box.innerHTML = '<div class="hint">Нічого не обрано</div>'; return; }
    const plane = currentPlaneOf(n);
    box.innerHTML = '';
    const info = document.createElement('div');
    info.innerHTML = `<label class="field">тип <span>${n.getAttr('objType')}</span></label>
      <label class="field">клітинка <span>${n.getAttr('cellCol')}, ${n.getAttr('cellRow')}</span></label>
      <label class="field">шар <span>${PLANE_LABEL[plane]}</span></label>`;
    box.append(info);

    const planeRow = document.createElement('div'); planeRow.className = 'row';
    PLANES.forEach((p) => {
      const b = document.createElement('button'); b.textContent = PLANE_LABEL[p];
      if (p === plane) b.classList.add('on');
      b.onclick = () => moveToPlane(n, p);
      planeRow.append(b);
    });
    box.append(document.createTextNode(''), planeRow);

    const zRow = document.createElement('div'); zRow.className = 'row';
    const mk = (t, fn) => { const b = document.createElement('button'); b.textContent = t; b.onclick = () => { fn(); n.getLayer().batchDraw(); updateSelectRect(); }; return b; };
    zRow.append(
      mk('◀ назад', () => n.moveDown()),
      mk('вперед ▶', () => n.moveUp()),
      mk('⤓ в кінець', () => n.moveToBottom()),
      mk('⤒ наверх', () => n.moveToTop()),
    );
    box.append(zRow);

    const actRow = document.createElement('div'); actRow.className = 'row';
    const hideB = document.createElement('button'); hideB.textContent = n.visible() ? 'Сховати' : 'Показати';
    hideB.onclick = () => { n.visible(!n.visible()); n.getLayer().batchDraw(); hideB.textContent = n.visible() ? 'Сховати' : 'Показати'; updateSelectRect(); };
    const dupB = document.createElement('button'); dupB.textContent = 'Дублювати';
    dupB.onclick = () => { const c = addObject(n.getAttr('objType'), n.getAttr('params'), { x: feetOf(n).x + state.tile, y: feetOf(n).y, col: n.getAttr('cellCol') + 1, row: n.getAttr('cellRow') }); c.setAttr('group', n.getAttr('group')); refreshGroups(); };
    const delB = document.createElement('button'); delB.textContent = 'Видалити'; delB.style.color = 'var(--danger)';
    delB.onclick = () => { const l = n.getLayer(); n.destroy(); deselect(); l.batchDraw(); refreshGroups(); };
    const pngB = document.createElement('button'); pngB.textContent = 'PNG об\'єкт';
    pngB.onclick = () => downloadURI(n.toDataURL({ pixelRatio: 1 }), `${n.getAttr('objType')}.png`);
    actRow.append(hideB, dupB, pngB, delB);
    box.append(actRow);

    const grp = document.createElement('div'); grp.style.marginTop = '8px';
    grp.innerHTML = '<div class="tag">група (tag)</div>';
    const gi = document.createElement('input'); gi.type = 'text'; gi.value = n.getAttr('group') || '';
    gi.placeholder = 'напр. desk-set';
    gi.onchange = () => { n.setAttr('group', gi.value.trim()); refreshGroups(); };
    grp.append(gi); box.append(grp);
  }

  // ---- layers panel -------------------------------------------------------
  function buildLayersPanel() {
    const box = document.getElementById('layers'); box.innerHTML = '';
    // draw back-to-front but list front-to-back for intuitive stacking
    [...PLANES].reverse().forEach((p) => {
      const layer = planeLayers[p];
      const el = document.createElement('div');
      el.className = 'layer-item' + (state.activePlane === p ? ' active' : '');
      el.innerHTML = `<div class="layer-head"><span>${PLANE_LABEL[p]} <span class="tag">${p}</span></span></div>`;
      const row = document.createElement('div'); row.className = 'row'; row.style.marginTop = '6px';
      const act = document.createElement('button'); act.textContent = 'Активний';
      if (state.activePlane === p) act.classList.add('on');
      act.onclick = () => { state.activePlane = p; buildLayersPanel(); };
      const vis = document.createElement('button'); vis.textContent = layer.visible() ? '👁 вид.' : '⃠ прих.';
      vis.onclick = () => { layer.visible(!layer.visible()); layer.batchDraw(); vis.textContent = layer.visible() ? '👁 вид.' : '⃠ прих.'; };
      const png = document.createElement('button'); png.textContent = 'PNG';
      png.onclick = () => exportLayerPNG(p);
      row.append(act, vis, png); el.append(row);
      const cnt = document.createElement('div'); cnt.className = 'hint';
      cnt.textContent = `${layer.find('.object').length} об'єктів`;
      el.append(cnt);
      box.append(el);
    });
  }

  // ---- export -------------------------------------------------------------
  function downloadURI(uri, name) {
    const a = document.createElement('a'); a.href = uri; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
  }
  function exportLayerPNG(plane) {
    // render just this plane on transparent bg
    const others = {};
    PLANES.forEach((p) => { others[p] = planeLayers[p].visible(); if (p !== plane) planeLayers[p].visible(false); });
    const gridVis = gridLayer.visible(), bgVis = bgFill.visible(), selVis = selectRect.visible();
    gridLayer.visible(false); bgFill.visible(false); selectRect.visible(false);
    stage.draw();
    const uri = stage.toDataURL({ pixelRatio: 1 });
    PLANES.forEach((p) => planeLayers[p].visible(others[p]));
    gridLayer.visible(gridVis); bgFill.visible(bgVis); selectRect.visible(selVis);
    stage.draw();
    downloadURI(uri, `layer_${PLANE_LABEL[plane]}.png`);
  }
  function exportComposite() {
    const gridVis = gridLayer.visible(), selVis = selectRect.visible();
    gridLayer.visible(false); selectRect.visible(false); stage.draw();
    const uri = stage.toDataURL({ pixelRatio: 1 });
    gridLayer.visible(gridVis); selectRect.visible(selVis); stage.draw();
    downloadURI(uri, 'scene.png');
  }
  function exportSceneJSON() {
    const scene = {
      grid: { orientation: state.orientation, tile: state.tile },
      planes: PLANES.map((p) => ({ name: p, visible: planeLayers[p].visible() })),
      objects: PLANES.flatMap((p) => planeLayers[p].find('.object').map((n, i) => ({
        type: n.getAttr('objType'), params: n.getAttr('params'),
        cell: [n.getAttr('cellCol'), n.getAttr('cellRow')],
        plane: p, group: n.getAttr('group') || '', z: i, visible: n.visible(),
      }))),
    };
    downloadURI('data:application/json,' + encodeURIComponent(JSON.stringify(scene, null, 2)), 'scene.json');
  }
  function loadScene(scene) {
    PLANES.forEach((p) => planeLayers[p].destroyChildren());
    state.orientation = scene.grid?.orientation || 'orthogonal';
    state.tile = scene.grid?.tile || 32;
    (scene.objects || []).forEach((o) => {
      const s = cellToScreen(o.cell[0], o.cell[1]);
      state.activePlane = o.plane || 'midground';
      const n = addObject(o.type, o.params, { x: s.x, y: s.y, col: o.cell[0], row: o.cell[1] });
      n.setAttr('group', o.group || '');
      if (o.visible === false) n.visible(false);
    });
    (scene.planes || []).forEach((pl) => { if (planeLayers[pl.name]) planeLayers[pl.name].visible(pl.visible !== false); });
    syncGridButtons(); drawGrid(); buildLayersPanel(); refreshGroups(); deselect();
    Object.values(planeLayers).forEach((l) => l.batchDraw());
  }

  // ---- UI wiring ----------------------------------------------------------
  function buildPalette() {
    const box = document.getElementById('palette'); box.innerHTML = '';
    OBJECT_TYPES.forEach((o) => {
      const b = document.createElement('button'); b.className = 'obj-btn';
      const preview = GEN[o.type](o.params);
      const scaled = document.createElement('canvas');
      scaled.width = 40; scaled.height = 40;
      const sx = scaled.getContext('2d'); sx.imageSmoothingEnabled = false;
      const s = Math.min(40 / preview.width, 40 / preview.height);
      const dw = preview.width * s, dh = preview.height * s;
      sx.drawImage(preview, (40 - dw) / 2, (40 - dh) / 2, dw, dh);
      b.append(scaled);
      const lbl = document.createElement('span'); lbl.textContent = o.label; lbl.style.fontSize = '11px';
      b.append(lbl);
      b.onclick = () => addObject(o.type, o.params);
      box.append(b);
    });
  }
  function syncGridButtons() {
    document.getElementById('grid-ortho').classList.toggle('on', state.orientation === 'orthogonal');
    document.getElementById('grid-iso').classList.toggle('on', state.orientation === 'isometric');
  }
  function reSnapAll() {
    allObjects().forEach((n) => {
      const s = cellToScreen(n.getAttr('cellCol'), n.getAttr('cellRow'));
      positionByFeet(n, s.x, s.y);
    });
    Object.values(planeLayers).forEach((l) => l.batchDraw());
  }

  document.getElementById('grid-ortho').onclick = () => { state.orientation = 'orthogonal'; syncGridButtons(); drawGrid(); reSnapAll(); updateSelectRect(); };
  document.getElementById('grid-iso').onclick = () => { state.orientation = 'isometric'; syncGridButtons(); drawGrid(); reSnapAll(); updateSelectRect(); };
  const tileEl = document.getElementById('tile');
  tileEl.oninput = () => { state.tile = +tileEl.value; document.getElementById('tileval').textContent = tileEl.value; drawGrid(); reSnapAll(); updateSelectRect(); };
  const snapEl = document.getElementById('snap');
  snapEl.onclick = () => { state.snap = !state.snap; snapEl.classList.toggle('on', state.snap); snapEl.textContent = 'Snap: ' + (state.snap ? 'ON' : 'OFF'); };
  document.getElementById('ysort').onclick = () => ySortPlane(state.activePlane);
  document.getElementById('autoysort').onchange = (e) => { state.autoYsort = e.target.checked; };
  document.getElementById('export-scene').onclick = exportSceneJSON;
  document.getElementById('export-composite').onclick = exportComposite;
  document.getElementById('clear').onclick = () => { PLANES.forEach((p) => planeLayers[p].destroyChildren()); deselect(); Object.values(planeLayers).forEach((l) => l.batchDraw()); buildLayersPanel(); refreshGroups(); };
  const importFile = document.getElementById('import-file');
  document.getElementById('import-scene').onclick = () => importFile.click();
  importFile.onchange = () => { const f = importFile.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => { try { loadScene(JSON.parse(r.result)); } catch (err) { alert('Bad JSON: ' + err.message); } }; r.readAsText(f); };

  window.addEventListener('keydown', (e) => {
    const n = state.selected; if (!n) return;
    if (e.key === 'Delete' || e.key === 'Backspace') { const l = n.getLayer(); n.destroy(); deselect(); l.batchDraw(); refreshGroups(); e.preventDefault(); return; }
    const step = e.shiftKey ? state.tile : PX;
    const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
    if (d) { n.move({ x: d[0], y: d[1] }); const c = screenToCell(feetOf(n).x, feetOf(n).y); n.setAttrs({ cellCol: Math.round(c.col), cellRow: Math.round(c.row) }); updateSelectRect(); updateInspector(); n.getLayer().batchDraw(); e.preventDefault(); }
  });

  // ---- boot ---------------------------------------------------------------
  function demoScene() {
    // a small starter room echoing the video's classroom vibe
    state.activePlane = 'background';
    addObject('window', {}, gridSnap(3, 3)); addObject('window', {}, gridSnap(6, 3));
    state.activePlane = 'midground';
    ['desk', 'chair'].forEach((t, i) => addObject(t, { metal: true }, gridSnap(9 + i * 2, 8)));
    addObject('character', {}, gridSnap(13, 9));
    state.activePlane = 'foreground';
    addObject('plant', {}, gridSnap(2, 11)); addObject('lamp', {}, gridSnap(16, 10));
    state.activePlane = 'midground';
    deselect();
  }
  function gridSnap(col, row) { const s = cellToScreen(col, row); return { x: s.x, y: s.y, col, row }; }

  drawGrid(); buildPalette(); buildLayersPanel(); refreshGroups();
  demoScene(); buildLayersPanel(); refreshGroups();
  Object.values(planeLayers).forEach((l) => l.batchDraw());

  // expose for headless QA / scripting
  window.SceneLang = { state, addObject, loadScene, exportSceneJSON, exportLayerPNG,
    exportComposite, select, deselect, stage, planeLayers, ySortPlane };
})();
