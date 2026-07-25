# scene-lang editor

Інтерактивний **layered scene builder** у браузері (Konva.js) — реалізує підхід
із `../RESEARCH.md`: **GRID → об'єкти (кожен PNG) → групи → 3 шари → композит**,
керований по шарах/групах.

Self-contained: Konva вендорено локально (`vendor/konva.min.js`), жодних зовнішніх
запитів. Відкрий `index.html` у браузері (або віддай статикою).

```bash
# просто відкрити файл, або:
python3 -m http.server -d projects/scene-lang/editor 8080   # → http://localhost:8080
```

## Можливості

- **Grid — обидва типи з перемикачем:** Orthogonal (квадрат) ↔ Isometric (ромб),
  повзунок розміру клітинки, **Snap** до сітки. Об'єкти прив'язані по **ногах**
  (feet), тож при зміні сітки автоматично переснапуються у свої `(col,row)`.
- **Палітра об'єктів:** парта, стілець, вікно, рослина, світло, персонаж — кожен
  генерується процедурно як піксель-арт-спрайт (окремий canvas/PNG з параметрами).
- **3 шари (плани):** BG / MID / FG. Для кожного: активний (куди додаються об'єкти),
  видимість (hide), лічильник, **експорт шару в прозорий PNG**.
- **Керування об'єктом:** переміщення між планами (BG/MID/FG), z-order у плані
  (назад / вперед / в кінець / наверх), hide, дублювати, видалити, **PNG об'єкта**,
  тег **групи**. Стрілки — nudge (Shift = на клітинку), Del — видалити.
- **Групи:** об'єкти з однаковим тегом керуються разом (сховати / →BG / →FG).
- **Y-sort:** сортування об'єктів у плані по ногах (глибина); є **auto y-sort**.
- **Сцена як дані:** експорт/імпорт **scene.json** (форма з Tiled), експорт
  **композиту в PNG**.

## Модель (словник із Godot)

| Редактор | Godot-аналог |
| -------- | ------------ |
| план (BG/MID/FG) | `CanvasLayer.layer` |
| z у плані | `z_index` / `move_child` |
| група (tag) | `add_to_group` |
| y-sort | `y_sort_enabled` |
| об'єкт | `Sprite2D.texture` (PNG) |

## Формат сцени (`scene.json`)

```jsonc
{
  "grid": { "orientation": "orthogonal|isometric", "tile": 32 },
  "planes": [ { "name": "background", "visible": true }, ... ],
  "objects": [
    { "type": "desk", "params": { "metal": true },
      "cell": [9, 8], "plane": "midground", "group": "desk-set", "z": 0, "visible": true }
  ]
}
```

## QA (headless)

`qa.mjs` вантажить редактор у Chromium (Playwright), клікає контроли, перевіряє
експорт PNG/JSON і робить скріншоти в `stills/`:

```bash
PW_EXE=$(ls /opt/pw-browsers/chromium-*/chrome-linux/chrome | head -1) node qa.mjs
```

## Далі

- Атмосфера по планах (desat/contrast/blur — «повітряна перспектива» з RESEARCH.md).
- Дизеринг-пас і паралакс-камера для анімованого прольоту (kадри → ffmpeg).
- Спільний рендер із Python-конвеєром (Konva-JSON → Pillow-композит) для батч-експорту.
