# Icon & art generation — промпт-спека для AI-картинок MeTravel

Turnkey-вход для генерации **растровых арт-ассетов** (PNG) под MeTravel —
для специальных UI-иллюстраций, квестов и контента/маркетинга. Обычные production UI-действия
используют существующие примитивы и Feather icons; AI-растр не заменяет их по умолчанию. Спека провайдеро-независимая: финальный
промпт собирается по схеме ниже и шлётся в выбранную image-модель (выбор модели — за
владельцем). Источник палитры — `constants/modernMattePalette.ts` (light-тема).

Картинку MeTravel-бренда узнают по **матовости, тёплой оранжевой доминанте и мягкому
свету** — не глянец, не неон, не агрессивные градиенты. Та же философия, что в палитре.

---

## 1. Схема сборки промпта

```
<BASE_STYLE>, <STYLE_PRESET>, <PALETTE>, <SUBJECT>. <FRAMING>. <NEGATIVE>
```

- `BASE_STYLE` — общий бренд-якорь (раздел 2).
- `STYLE_PRESET` — техника отрисовки по типу ассета (раздел 3).
- `PALETTE` — цвета из бренд-палитры (раздел 4).
- `SUBJECT` — что именно на иконке (конкретика задачи).
- `FRAMING` + `NEGATIVE` — общие (разделы 5, 6); подбираются по типу ассета (раздел 7).

Готовый промпт сохраняем рядом с отслеживаемым ассетом в `PROMPT.md`; конкретный prompt
ссылается на эту каноническую спеку и фиксирует subject, overrides, output slot и точный
финальный текст. Коммит-сообщение или история чата не считаются единственным источником
для воспроизводимости.

---

## 2. BASE_STYLE (общий бренд-якорь)

```
modern matte travel iconography for MeTravel, warm and friendly, soft diffused lighting,
clean tasteful design, cohesive icon-set look, crisp edges, high detail but not busy
```

Технически: один `seed`-диапазон и одни настройки на весь прогон серии, чтобы свет, толщина
линии и ракурс не «прыгали» между иконками одного набора.

---

## 3. STYLE_PRESET (по типу ассета)

| preset | когда | фрагмент |
|--------|-------|----------|
| `flat-line` | UI-глифы, табы, действия | `flat line icon, even 2px stroke weight, rounded line caps, single accent color, minimal, geometric` |
| `duotone` | акцентные UI-иконки, пустые состояния | `duotone icon, two-tone fill, soft shapes, gentle depth, no harsh outlines` |
| `soft-3d` | app-иконка, hero-декор, награды | `soft 3D clay-render icon, gentle bevel, matte surface, soft ambient occlusion, tasteful highlight` |
| `engraving` | книжный/контентный декор (как badge-эмблемы) | `fine woodcut engraving on aged paper, thin ink line, vintage emblem, ribbon banner` |
| `illustration` | контент/маркетинг, обложки, соцсети | `warm flat illustration, soft gradients within shapes, storybook travel mood, no outline` |

Не смешивать пресеты в одном наборе — иначе ассеты не выглядят семьёй.

---

## 4. PALETTE (бренд-цвета, light-тема)

| роль | hex | как использовать |
|------|-----|------------------|
| brand (доминанта) | `#f5842c` | основной акцент, тёплый оранжевый — «птица»-логотип |
| brandDark | `#e07020` | тени/глубина оранжевого |
| brandText | `#b35900` | контурная/тёмная деталь на светлом |
| brandLight | `#fff8f3` | тёплый кремовый фон (если фон НЕ прозрачный) |
| primary | `#7a9d8f` | матовый серо-зелёный (природа/маршрут) |
| accent | `#8a9aa8` | матовый серо-голубой (вода/небо) |
| success | `#527d66` · warning `#7d7250` · danger `#9a6363` · info `#557588` | функциональные состояния |
| ink/нейтраль | `#3a3a3a` / `#636363` | линии, текст-подобные детали |

Правило: **одна доминанта на иконку** (обычно `brand`), 1–2 поддерживающих из палитры.
Не вводить цвета вне палитры; не делать неон/кислоту. Для dark-варианта брать dark-секцию
из `modernMattePalette.ts` (brand `#f0a060`).

---

## 5. FRAMING (по умолчанию)

```
perfectly centered, front-on, isolated on a fully transparent background,
square 1:1 composition, subject fills ~80% of the frame, no drop shadow baked in,
generous even padding
```

Переопределения по типу — раздел 7.

---

## 6. NEGATIVE (исключения — обязательно)

```
no text, no letters, no numbers, no watermark, no photo, no realistic skin, no clutter,
no harsh neon, no aggressive gradient, not cropped, no opaque background (unless required),
no busy background scenery, no multiple disconnected objects
```

> Текст/подписи внутри картинки НЕ генерим — подпись добавляет интерфейс/верстка.

---

## 7. Типы ассетов и оверрайды

### A. UI-глиф (в интерфейсе)
- preset: `flat-line` или `duotone`. Доминанта = одна (обычно `brand` или нейтраль `#3a3a3a`).
- FRAMING: квадрат, прозрачный фон, ~90% заполнение, оптический баланс под мелкий размер.
- Выход: PNG прозрачный, `≥256×256`, плюс варианты `@1x/@2x/@3x` (см. раздел 8).
- Замечание: для одноцветных линейных глифов часто **дешевле SVG-компонент**, чем растр —
  если иконка одноцветная и плоская, предложить SVG-путь (как `BelarusOutlineIcon`).

### B. App-иконка / адаптив / favicon
- preset: `soft-3d` (фирменная «птица» на оранжевом) либо плоский логотип.
- FRAMING: **непрозрачный** фирменный фон допустим для `icon.png`; для `adaptive foreground`
  и `monochrome` — прозрачный, мотив в безопасной зоне (центр ~66%, Android обрежет до круга).
- Выход: набор размеров (раздел 8). `monochrome-icon` — силуэт в alpha, генерится скриптом.
- ⚠️ `app.json` — в do-not-touch: путей не менять без явного запроса, изменения — диффом.

### C. Квесты / маркетинг / декоративный контент
- preset: `illustration` или `engraving`.
- FRAMING: под слот (1:1, 4:3 квест-обложка, 16:9 hero/соцсети); прозрачный — только если
  ассет ляжет поверх фона, иначе `brandLight`/тёплый фон.
- Выход: PNG/WEBP под слот; использовать существующий media-компонент конкретной фичи.
- Для опубликованных travel/article cover, rich-text, gallery и point media этот illustration
  preset запрещён: там нужны реальные licensed/local фото или фотореалистичные generated
  raster images по `AGENTS.md` и `docs/RULES.md`.

---

## 8. Выход и постобработка

- Базовый формат: **PNG, прозрачный фон** (контент-арт — допускается WEBP/JPG, если фон есть).
- Размеры: генерировать в большом (`≥1024²` для app/hero, `≥512²` для иконок), затем даунскейл.
  - UI-глиф: `@1x`=24/32, `@2x`, `@3x` (имя `name.png` / `name@2x.png` / `name@3x.png`).
  - App-набор: `icon` 1024², `adaptive-icon` 1024² (foreground), `favicon` 60–64², `monochrome` 1024² alpha.
- Постобработка без внешних деп: pure-Node PNG как в `scripts/generate-monochrome-icon.js`
  (zlib, без `sharp`/`jimp`) — автокроп, выбивание фона до alpha, монохром-вариант, даунскейл.
- Прозрачность строго чистая (без полупрозрачного «ореола»), иначе на тёмной теме рамка вылезет.

---

## 9. Размещение в проекте

| тип | каталог | имя |
|-----|---------|-----|
| UI-глиф | `assets/icons/<группа>/` | `name.png`, `name@2x.png`, `name@3x.png` |
| App-иконка | `assets/images/` / `assets/icons/` | `icon.png`, `adaptive-icon.png`, `monochrome-icon.png`, `logo_yellow_<size>x<size>.png` |
| Контент-арт | `assets/travel/` · `assets/quests/<id>/` · `assets/images/<кампания>/` | по соседям |
| Web-статик | `public/assets/` | по соседям |

`assetBundlePatterns` в `app.json` уже покрывает `assets/images/*`, `assets/icons/*`,
`assets/travel/*` — новые подпапки внутри них бандлятся автоматически.

---

## 10. Консистентность

- Один STYLE_PRESET + один `seed`-прогон на серию → ассеты выглядят семьёй.
- Доминанта `brand #f5842c`, поддержка из палитры; без цветов вне `modernMattePalette.ts`.
- Стандартные UI-иконки бери из существующих primitives и `@expo/vector-icons/Feather`.
  Растровый арт подключай через существующий media-компонент конкретной фичи; не создавай
  PNG/SVG-дубль стандартного глифа без отдельной причины.
- Без текста/цифр в картинке.
</content>
</invoke>
