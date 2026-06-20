# Badge image generation — промпт-спека для AI-пайплайна (BE-A8)

Turnkey-вход для backend-пайплайна `generate_badge_images` (BE-A8). Бэк собирает
финальный промпт по схеме ниже из полей `Badge` (`name`, `tier`, `category`, `slug`)
и шлёт в выбранную image-модель. Цель — **единый стиль: премиум объёмные металлик-медали**
(решение владельца, см. [ACHIEVEMENTS_DESIGN.md](ACHIEVEMENTS_DESIGN.md) §7).

Выбор конкретной модели/провайдера — за владельцем бэка. Спека провайдеро-независимая.

---

## 1. Схема сборки промпта

```
<BASE_STYLE>, <CATEGORY_MOTIF>, <TIER_MATERIAL>, <SUBJECT>. <FRAMING>. <NEGATIVE>
```

- `BASE_STYLE` — общий для всех (раздел 2).
- `CATEGORY_MOTIF` — центральный мотив по `category.slug` (раздел 4).
- `TIER_MATERIAL` — материал/цвет по `tier` (раздел 3).
- `SUBJECT` — конкретика значка из таблицы (раздел 6) или дефолт = `name`.
- `FRAMING` + `NEGATIVE` — общие (разделы 2, 5).

`image_prompt` модели сохраняется в `Badge.image_prompt` (для воспроизводимости/перегена).

---

## 2. BASE_STYLE (общий фрагмент)

```
premium 3D award medal, single centered circular medallion, glossy beveled metal rim,
soft studio lighting with a gentle top highlight and subtle rim reflection, embossed
relief emblem in the center, tasteful and modern, game-achievement icon style,
high detail, crisp edges
```

**FRAMING (обязательно для консистентности):**
```
perfectly centered, front-on view, isolated on a fully transparent background,
square 1:1 composition, the medallion fills ~80% of the frame, no drop shadow baked in
```

Технически: один и тот же `seed`-диапазон/настройки на весь прогон, чтобы свет и ракурс
не «прыгали» между значками.

---

## 3. TIER_MATERIAL (по `Badge.tier`)

| tier | фрагмент материала |
|------|--------------------|
| `bronze` | `forged bronze with warm copper-brown patina, #CD7F32 tones` |
| `silver` | `polished sterling silver, cool grey-white sheen, #AEB6BF tones` |
| `gold` | `bright polished gold, warm yellow gleam, #F2C037 tones` |
| `platinum` | `iridescent platinum with cool cyan reflections, #5BD0E0 tones` |
| `legendary` | `mythic violet-chrome metal with prismatic glow and faint magic sparks, #B06BE6 tones` |
| `none` | `neutral brushed steel, #9AA5B1 tones` |

(Цвета совпадают с `TIER_VISUALS` во фронте — `components/achievements/badgeVisuals.ts`,
чтобы сгенеренная медаль и процедурный фолбэк были одной палитры.)

---

## 4. CATEGORY_MOTIF (по `Badge.category.slug`)

| category | центральный эмблемный мотив |
|----------|------------------------------|
| `onboarding` | `a shining star emblem` |
| `writer` | `a quill pen writing emblem` |
| `theme` | `an emblem matching the activity (see subject)` |
| `quests` | `a route flag / map-pin quest emblem` |
| `social` | `a heart emblem with subtle radiating lines` |
| `geo` | `a globe emblem with latitude lines` |
| `monthly` | `a calendar-with-upward-arrow emblem` |
| (иное) | `a laurel-wreath award emblem` |

Для тематических (`theme`) мотив уточняется по `slug` (хайкер → горный компас/ботинок,
вело → велосипед, авто → авто/руль, водник → волна/якорь, городской → силуэт города).

---

## 5. NEGATIVE (исключения — обязательно)

```
no text, no letters, no numbers, no watermark, no background scenery, no photo,
not flat, no multiple medals, no hands, no frame border, not cropped, no opaque background
```

> Текст/цифры НЕ генерим внутри картинки — подпись и тир рисует фронт (`BadgeMedal`).

---

## 6. Стартовый набор (25 значков) — SUBJECT по slug

Слаги ориентировочные — сверить с фактическими в `seed_badges.py`.

### Онбординг (category=onboarding)
| slug | tier | SUBJECT |
|------|------|---------|
| welcome | bronze | `a friendly welcome star` |
| profile-ready | bronze | `a checkmark over a person silhouette` |
| first-steps | bronze | `a single footprint with a small flag` |
| first-quest | bronze | `a flag at a trail start` |

### Автор (category=writer, criteria=published_travels)
| slug | tier | SUBJECT |
|------|------|---------|
| author-1 | bronze | `a quill with one small laurel sprig` |
| author-2 | silver | `a quill with paired laurel sprigs` |
| author-3 | gold | `a quill crossed with an open book` |
| author-4 | platinum | `a radiant quill with a star` |
| author-5 | legendary | `a glowing legendary quill crowned with laurels` |

### Тематические (category=theme)
| slug | tier(s) | SUBJECT |
|------|---------|---------|
| hiker | bronze/silver/gold | `a mountain peak with a hiking compass` |
| cyclist | bronze/silver/gold | `a stylized bicycle` |
| roadtripper | bronze/silver/gold | `a classic car with a winding road` |
| water-traveler | bronze/silver/gold | `a cresting wave with an anchor` |
| city-explorer | bronze/silver/gold | `a compact city skyline silhouette` |

### Квесты (category=quests, criteria=completed_quests)
| slug | tier | SUBJECT |
|------|------|---------|
| quest-starter | bronze | `a single route flag` |
| quest-seeker | silver | `a map with a dashed route and pin` |
| quest-master | gold | `crossed route flags with a star` |
| quest-legend | legendary | `a glowing trophy over a route map` |
| city-conqueror | gold | `a city gate emblem with a crown` |

### Социальные (category=social)
| slug | tier | SUBJECT |
|------|------|---------|
| first-feedback | bronze | `a heart with a single spark` |
| crowd-favorite | silver | `a heart with radiating applause lines` |
| idol | gold | `a heart crowned with laurels` |

### Гео (category=geo, criteria=countries)
| slug | tier | SUBJECT |
|------|------|---------|
| two-countries | bronze | `a globe with two pins` |
| five-countries | gold | `a globe with five pins and a route` |
| ten-countries | platinum | `a globe wrapped by a traveler's route` |

### Phase-2 месячные (category=monthly)
| slug | tier | SUBJECT |
|------|------|---------|
| active-month | silver | `a calendar with three checkmarks and an upward arrow` |
| hiker-of-month | silver | `a calendar with a mountain and upward arrow` |

---

## 7. Выход и постобработка (BE-A8)

- Формат: **PNG, прозрачный фон**, квадрат, **≥512×512** (для retina ≥2x при отрисовке ~64–72px).
- Постобработка: автокроп до медали + центрирование + (если модель добавила фон) выбивание
  фона до alpha; даунскейл-варианты по необходимости.
- Заливка: `Badge.image` → S3 `achievements/badges/<slug>/<uuid>.png`
  (callable `badge_image_upload_to` уже в `achievements/models.py`), `image_status='ready'`.
- Идемпотентность: `ready` пропускать без `--regenerate`; при сбое → `failed` + ретрай.

---

## 8. Консистентность с фронтом

Картинки `image_url` отдаются как есть; `BadgeMedal` рисует их `fit=contain` в круглой
рамке с tier-кольцом. Поэтому:
- Фон строго прозрачный (иначе квадрат вылезет за круг).
- Палитра тира — как в разделе 3 (совпадает с `TIER_VISUALS`), чтобы кольцо фронта и
  металл медали не конфликтовали.
- Без текста/цифр в картинке — подпись/тир добавляет фронт.
