# RESEARCH — база знань для scene builder (layering & gridding)

Мета: перейти від «моноліту, що імітує стадії» до **композиційної системи**:
`GRID → окремі об'єкти (кожен у PNG) → групи → шари (3) → композит`, керованої
**по групах/шарах** (z вперед-назад, hide, nudge) — як движки будують сцени.

Це підсумок ресерчу по 4 напрямках (движки / бібліотеки / Blender+MCP / піксель-арт
workflow). Головний висновок винесено в кінець.

---

## 1. Універсальна модель сцени (те, що збіглося скрізь)

Твоя інтуїція = стандартна модель 2D-движків і піксель-арту. Три незалежні осі:

### Плани (наші «3 шари»)
Майже універсальна конвенція: **Background / Midground / Foreground**
(іноді +static/sky четвертим). BG — за дією (небо/дальня стіна), MG — «ігровий»
план (персонаж, стільці, парти), FG — те, що спереду (колона/розмита рослина, рамкує кадр).

### Grid (спочатку — як ти й казав)
Об'єкти чіпляються до сітки. Два стандарти:
- **Orthogonal (квадрат):** `px = col*tile_w`, `py = row*tile_h`. Просто, швидко.
- **Isometric (ромб):** `x = (col-row)*TILE_W/2`, `y = (col+row)*TILE_H/2`, `TILE_H≈TILE_W/2`.
  Дає «несправжню» 3D-глибину.
- **Tilemap** (сітка дрібних тайлів: підлога/стіни) окремо від **object layer**
  (великі пропси з вільним x/y, прив'язані до сітки). Це і є розділення Tiled-редактора.

### Групи
Споріднені спрайти → **layer group** (напр. «desk» = парта+лампа+папери), щоб
ховати / рухати / переz-ордерити / експортувати їх **разом**. Aseprite-модель:
`layer` (канал) · `group` (папка шарів) · `cel` (пікселі шару в кадрі) · `tag`
(діапазон кадрів) · `blend mode`. Її й треба віддзеркалити.

### Z-order усередині плану = **Y-sort**
План обирається шаром; **усередині** плану сортуємо по **ногах/нижньому краю**
спрайта (вище на екрані = далі = малюється першим). Сортування по top-left —
класична помилка. Для iso — по `(col+row)`.

---

## 2. Словник движків → наша система (Godot як еталон-модель)

Дерево сцени Godot лягає майже 1:1 на твою модель:

| Наше поняття | Godot API | У нас (Python) |
| ------------ | --------- | -------------- |
| Сітка | `TileMapLayer`+`TileSet`, `map_to_local` / або snap `position` | `col,row → px` формула |
| Об'єкт | `Node2D` + `Sprite2D.texture` (PNG) | RGBA-спрайт (numpy/PIL) |
| Група | батьківський `Node2D` / `PackedScene.instantiate()` | dict `{group, children}` |
| Іменована група (tag) | `add_to_group()` / `call_group()` | поле `group` + запити |
| Шар (BG/MG/FG) | **`CanvasLayer.layer`** (int, вище=зверху) | список планів, порядок = z |
| Z усередині шару | **`CanvasItem.z_index`** (−4096…4096) + `z_as_relative` | y-sort + порядок у списку |
| Вперед/назад | `z_index` / `move_child()` / зміна `CanvasLayer.layer` | reorder списку / зміна плану |
| Hide | `visible` / `hide()` | `visible:false` (пропуск у композиті) |
| Глибина по Y | `y_sort_enabled` | сорт по feet-y |
| Паралакс | `Parallax2D` (4.3+) / `ParallaxLayer` | зсув плану × parallax-factor |
| Експорт шару в PNG | `SubViewport.get_texture().get_image().save_png()` | `Image.save()` плану/об'єкта |

**Ключове:** `CanvasLayer` = просторовий z-банд; групи (`add_to_group`) = теги для
вибірки/broadcast. Це **дві різні осі** — і нам потрібні обидві.

---

## 3. Технічні прийоми глибини/атмосфери (для @seaeees-вайбу)

1. **Паралакс:** дальні плани рухаються повільніше (sky ~0–20% швидкості камери,
   mid ~40–70%, fg ≥100%).
2. **Повітряна перспектива (головний статичний cue):** що далі — **менший контраст,
   менша насиченість, значення/відтінок зсунуті до кольору неба/фону**, менше деталей.
   Кожному плану — свій **діапазон значень (value band)**, щоб плани читались окремо.
3. **Дизеринг:** Bayer-матриці / градієнтні рампи для плавних градієнтів обмеженою
   палітрою (небо, туман, світіння). Селективно — інакше «бруд».
4. **Fake DoF (піксель-арт-стиль):** не Gaussian, а **грубший піксель на дальніх
   планах** (як Celeste рендерить далекі гори) + менше деталей; темний/м'який FG рамкує кадр.

---

## 4. Огляд варіантів стека (з tradeoffs)

| Стек | Модель шарів/груп/z | Per-object PNG | Headless у нас | Вердикт |
| ---- | ------------------- | -------------- | -------------- | ------- |
| **Python: Pillow+numpy+ffmpeg** | конвенція (RGBA/план, порядок=z) | `img.save()` | ✅ нативно, 0 GUI | **Рекомендовано** — 1:1 на модель, легко, детерміновано |
| **Godot headless** | ідеальна (CanvasLayer/z_index/groups/y-sort/SubViewport) | ✅ SubViewport | ⚠️ `--headless` **не рендерить**; треба **Xvfb + GL + GDScript** | Чудова *модель*, важкий *рантайм* |
| **Blender headless (bpy)** | Collections→View Layers→File Output | ✅ `film_transparent`, Cycles-CPU | ✅ pip `bpy` cp311 (не 5.2/py3.13) | Працює, але це **3D**; overkill для 2D піксель-арту |
| **Web: Konva.js** | нативна (Stage→Layer→Group→Node) | ✅ `node.toDataURL()` | ✅ і в браузері, і в Node | Найкраще для **інтерактивного редактора** згодом |
| PixiJS / Phaser / pygame | є z/шари | є extract/save | ⚠️ GPU-поліфіли / SDL dummy | не для цього кроку |

### MCP-вердикт
- **BlenderMCP, Godot MCP, Aseprite MCP, Figma MCP** — усі потребують **локального
  GUI-застосунку** на машині користувача. У headless-контейнері **не працюють** як MCP.
  Цінні лише як референс техніки (як драйвити `bpy` / scene tree).
- **Спеціального «2D grid scene-builder MCP» не існує.**
- **Висновок: MCP зараз не потрібен.** Ставити нічого не треба — все робиться
  бібліотеками server-side.

### Aseprite / Tiled — брати як *модель*, не як залежність
- **Aseprite CLI** (`-b --split-layers --save-as`, Lua API) — еталон моделі
  `layers → PNG`, але платний/десктоп, треба компілювати. Відкрита альтернатива — **LibreSprite**.
- **Tiled** — еталон формату `grid + object layers + group hierarchy` (TMX/JSON,
  читається `pytmx`). Формат сцени візьмемо у нього, без самого бінарника.

---

## 5. Рекомендована архітектура (Python-компоситор)

Пере-реалізуємо *модель* Aseprite/Tiled у ~200–300 рядках Python. Стек:
**Pillow** (I/O, `alpha_composite`, NEAREST-апскейл) + **numpy** (процедурне
малювання + атмосфера) + **ffmpeg** (кадри→відео). Словник — з Godot.

### Сцена = JSON (форма з Tiled, не сам формат)
```jsonc
{
  "grid":   { "orientation": "orthogonal", "tile_w": 16, "tile_h": 16, "cols": 40, "rows": 22 },
  "planes": [
    { "name": "background", "parallax": 0.2, "atmosphere": { "desat": 0.6, "contrast": 0.5, "tint": "#223", "blur": 1 } },
    { "name": "midground",  "parallax": 1.0, "atmosphere": {} },
    { "name": "foreground", "parallax": 1.4, "atmosphere": { "darken": 0.3, "blur": 1 } }
  ],
  "objects": [
    { "type": "desk", "params": { "w": 2, "material": "metal" },
      "cell": [5, 12], "anchor": "feet", "group": "desk-set", "plane": "midground" }
  ]
}
```
Керування: **z** = порядок планів + y-sort у плані; **hide** = `visible:false`;
**nudge** = зміна `cell`; **вперед/назад** = зміна `plane` або порядку.

### Конвеєр
1. **Grid → px** (orthogonal зараз, iso-формула — опційно згодом), anchor по ногах.
2. **Генератори об'єктів** — по функції на тип (`draw_desk(params)->RGBA`), з
   конструктивних примітивів + обмежена палітра (рамп shadow/base/highlight),
   1px-контур. Кожен об'єкт — **окремий прозорий PNG**. (Опц. mask+mirror для органіки.)
3. **Композит плану:** y-sort об'єктів → `alpha_composite` за позицією → **atmosphere pass**
   (desat/contrast/tint/blur/dither) numpy'єм.
4. **Фінал:** плани back-to-front → NEAREST-апскейл.
5. **Паралакс+відео:** на кадр зсуваємо кожен план на `parallax*camera_x`,
   переcomposite, кадри → ffmpeg. @seaeees-вайб = сильне розділення value між планами
   + холодніший розмитий BG + темніший FG.

### Запропонована структура
```
projects/scene-lang/builder/
  scene.py        # клас Scene/Plane/Group/Object + завантаження JSON
  objects/        # генератори: desk.py, chair.py, window.py, light.py, char.py
  compose.py      # y-sort, alpha_composite, atmosphere pass, NEAREST upscale
  animate.py      # parallax-камера → кадри → ffmpeg
  scenes/room.json
  out/
```

---

## 6. Відкриті рішення (винести користувачу)

1. **Стек:** Python-компоситор (реком.) / Blender-bpy (3D) / Godot-Xvfb / Web-Konva.
2. **Grid:** orthogonal (реком., фронтальна кімната) чи isometric (fake-3D).
3. **Формат зараз:** batch по JSON-сцені (реком.) чи одразу інтерактивний редактор.
4. **Об'єкти:** конструктивні примітиви (реком.) чи mask+mirror генерація.

Ескалація на потім, якщо знадобиться: Blender-headless для справжнього 3D-блокауту;
Konva-редактор для drag-drop UI; Tiled-JSON імпорт/експорт для сумісності.

### Джерела (ключові)
Godot: canvas_layers, Node2D, PackedScene, Parallax2D · Blender: bpy-as-module,
View Layers/File Output, film_transparent · Pillow `alpha_composite` · Konva
Layer/Group/zIndex/toDataURL · SLYNYRD Pixelblog-23 (parallax) · Pixel Parmesan
(dithering) · Clint Bellanger (iso math) · Tiled TMX/JSON · MaartenGr/Sprite-Generator.
