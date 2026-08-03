// __tests__/fixtures/prodMediaManifest.ts
//
// Реальный срез media-манифеста с прода metravel.by (2026-08-03, travel 544),
// снятый после деплоя #1202. Нужен для проверки паритета URL в #1203: набор
// адресов, которые фронт запрашивает, не должен измениться при переходе с
// разбора `variants` на готовые `src`/`srcset`/`sizes_hint`.
//
// Важные свойства этого среза, ради которых он и зафиксирован:
//   - URL идут w-only: ни `q=`, ни `fit=` в них больше нет, поэтому определить
//     режим кадрирования по самому адресу невозможно (#1173 иначе возвращается);
//   - `srcset_cover` (8 ступеней) и `srcset_contain` (3) — разные наборы;
//   - у точки маршрута `srcset_contain` пуст: contain-слот для неё покрытия не
//     имеет, и фолбэк обязан это пережить.

import type { TravelMediaImage } from '@/types/types'

export const PROD_COVER: TravelMediaImage = {
  "id": 544,
  "alt": "Тропа ведьм (Harzer Hexenstieg): как пройти маршрут и как это выглядит на самом деле",
  "width": 1024,
  "height": 768,
  "aspect_ratio": 1.333333,
  "dominant_color": "#919187",
  "blurhash": "L:IF3ue-oeof_4WBWBj[-;ogayj[",
  "lqip_url": null,
  "variants": {
    "thumb_96": "/travel-image/544/conversions/26d572d144174803a61fe96f2d7aa142.webp?w=96",
    "thumb_160": "/travel-image/544/conversions/26d572d144174803a61fe96f2d7aa142.webp?w=160",
    "thumb_320": "/travel-image/544/conversions/26d572d144174803a61fe96f2d7aa142.webp?w=320",
    "card_480": "/travel-image/544/conversions/26d572d144174803a61fe96f2d7aa142.webp?w=480",
    "card_640": "/travel-image/544/conversions/26d572d144174803a61fe96f2d7aa142.webp?w=640",
    "card_720": "/travel-image/544/conversions/26d572d144174803a61fe96f2d7aa142.webp?w=720",
    "card_800": "/travel-image/544/conversions/26d572d144174803a61fe96f2d7aa142.webp?w=800",
    "card_960": "/travel-image/544/conversions/26d572d144174803a61fe96f2d7aa142.webp?w=960",
    "hero_1280": "/travel-image/544/conversions/26d572d144174803a61fe96f2d7aa142.webp?w=1280",
    "print_1600": "/travel-image/544/conversions/26d572d144174803a61fe96f2d7aa142.webp?w=1600",
    "print_2500": "/travel-image/544/conversions/26d572d144174803a61fe96f2d7aa142.webp?w=2500",
    "original": "/travel-image/544/conversions/26d572d144174803a61fe96f2d7aa142.webp"
  },
  "src": "/travel-image/544/conversions/26d572d144174803a61fe96f2d7aa142.webp?w=640",
  "src_cover": "/travel-image/544/conversions/26d572d144174803a61fe96f2d7aa142.webp?w=640",
  "src_contain": "/travel-image/544/conversions/26d572d144174803a61fe96f2d7aa142.webp?w=1280",
  "src_print": "/travel-image/544/conversions/26d572d144174803a61fe96f2d7aa142.webp?w=2500",
  "srcset": "/travel-image/544/conversions/26d572d144174803a61fe96f2d7aa142.webp?w=96 96w, /travel-image/544/conversions/26d572d144174803a61fe96f2d7aa142.webp?w=160 160w, /travel-image/544/conversions/26d572d144174803a61fe96f2d7aa142.webp?w=320 320w, /travel-image/544/conversions/26d572d144174803a61fe96f2d7aa142.webp?w=480 480w, /travel-image/544/conversions/26d572d144174803a61fe96f2d7aa142.webp?w=640 640w, /travel-image/544/conversions/26d572d144174803a61fe96f2d7aa142.webp?w=720 720w, /travel-image/544/conversions/26d572d144174803a61fe96f2d7aa142.webp?w=800 800w, /travel-image/544/conversions/26d572d144174803a61fe96f2d7aa142.webp?w=960 960w",
  "srcset_cover": "/travel-image/544/conversions/26d572d144174803a61fe96f2d7aa142.webp?w=96 96w, /travel-image/544/conversions/26d572d144174803a61fe96f2d7aa142.webp?w=160 160w, /travel-image/544/conversions/26d572d144174803a61fe96f2d7aa142.webp?w=320 320w, /travel-image/544/conversions/26d572d144174803a61fe96f2d7aa142.webp?w=480 480w, /travel-image/544/conversions/26d572d144174803a61fe96f2d7aa142.webp?w=640 640w, /travel-image/544/conversions/26d572d144174803a61fe96f2d7aa142.webp?w=720 720w, /travel-image/544/conversions/26d572d144174803a61fe96f2d7aa142.webp?w=800 800w, /travel-image/544/conversions/26d572d144174803a61fe96f2d7aa142.webp?w=960 960w",
  "srcset_contain": "/travel-image/544/conversions/26d572d144174803a61fe96f2d7aa142.webp?w=720 720w, /travel-image/544/conversions/26d572d144174803a61fe96f2d7aa142.webp?w=960 960w, /travel-image/544/conversions/26d572d144174803a61fe96f2d7aa142.webp?w=1280 1280w",
  "srcset_print": "/travel-image/544/conversions/26d572d144174803a61fe96f2d7aa142.webp?w=1600 1600w, /travel-image/544/conversions/26d572d144174803a61fe96f2d7aa142.webp?w=2500 2500w",
  "sizes_hint": "(max-width: 768px) calc(100vw - 24px), 640px",
  "sizes_hint_cover": "(max-width: 768px) calc(100vw - 24px), 640px",
  "sizes_hint_contain": "(max-width: 768px) 100vw, 1280px",
  "sizes_hint_print": "2500px",
  "storage_policy": {
    "version": 1,
    "profile": "travel",
    "master_width": 2500,
    "master_quality": 85
  },
  "updated_at": "2026-07-25T21:28:39.185284+00:00"
} as TravelMediaImage

export const PROD_GALLERY_ITEM: TravelMediaImage = {
  "id": 3567,
  "alt": "Медиатека - 99 из 2185.JPG",
  "width": 768,
  "height": 1024,
  "aspect_ratio": 0.75,
  "dominant_color": "#3a3530",
  "blurhash": "LA8;AA-;M}V@0Laexat79ZIUWAR*",
  "lqip_url": null,
  "variants": {
    "thumb_96": "/gallery/544/gallery/92b330643a0e4b38b056b0d394ce21db.JPG?w=96",
    "thumb_160": "/gallery/544/gallery/92b330643a0e4b38b056b0d394ce21db.JPG?w=160",
    "thumb_320": "/gallery/544/gallery/92b330643a0e4b38b056b0d394ce21db.JPG?w=320",
    "card_480": "/gallery/544/gallery/92b330643a0e4b38b056b0d394ce21db.JPG?w=480",
    "card_640": "/gallery/544/gallery/92b330643a0e4b38b056b0d394ce21db.JPG?w=640",
    "card_720": "/gallery/544/gallery/92b330643a0e4b38b056b0d394ce21db.JPG?w=720",
    "card_800": "/gallery/544/gallery/92b330643a0e4b38b056b0d394ce21db.JPG?w=800",
    "card_960": "/gallery/544/gallery/92b330643a0e4b38b056b0d394ce21db.JPG?w=960",
    "hero_1280": "/gallery/544/gallery/92b330643a0e4b38b056b0d394ce21db.JPG?w=1280",
    "print_1600": "/gallery/544/gallery/92b330643a0e4b38b056b0d394ce21db.JPG?w=1600",
    "print_2500": "/gallery/544/gallery/92b330643a0e4b38b056b0d394ce21db.JPG?w=2500",
    "original": "/gallery/544/gallery/92b330643a0e4b38b056b0d394ce21db.JPG"
  },
  "src": "/gallery/544/gallery/92b330643a0e4b38b056b0d394ce21db.JPG?w=640",
  "src_cover": "/gallery/544/gallery/92b330643a0e4b38b056b0d394ce21db.JPG?w=640",
  "src_contain": "/gallery/544/gallery/92b330643a0e4b38b056b0d394ce21db.JPG?w=1280",
  "src_print": "/gallery/544/gallery/92b330643a0e4b38b056b0d394ce21db.JPG?w=2500",
  "srcset": "/gallery/544/gallery/92b330643a0e4b38b056b0d394ce21db.JPG?w=96 96w, /gallery/544/gallery/92b330643a0e4b38b056b0d394ce21db.JPG?w=160 160w, /gallery/544/gallery/92b330643a0e4b38b056b0d394ce21db.JPG?w=320 320w, /gallery/544/gallery/92b330643a0e4b38b056b0d394ce21db.JPG?w=480 480w, /gallery/544/gallery/92b330643a0e4b38b056b0d394ce21db.JPG?w=640 640w, /gallery/544/gallery/92b330643a0e4b38b056b0d394ce21db.JPG?w=720 720w, /gallery/544/gallery/92b330643a0e4b38b056b0d394ce21db.JPG?w=800 800w, /gallery/544/gallery/92b330643a0e4b38b056b0d394ce21db.JPG?w=960 960w",
  "srcset_cover": "/gallery/544/gallery/92b330643a0e4b38b056b0d394ce21db.JPG?w=96 96w, /gallery/544/gallery/92b330643a0e4b38b056b0d394ce21db.JPG?w=160 160w, /gallery/544/gallery/92b330643a0e4b38b056b0d394ce21db.JPG?w=320 320w, /gallery/544/gallery/92b330643a0e4b38b056b0d394ce21db.JPG?w=480 480w, /gallery/544/gallery/92b330643a0e4b38b056b0d394ce21db.JPG?w=640 640w, /gallery/544/gallery/92b330643a0e4b38b056b0d394ce21db.JPG?w=720 720w, /gallery/544/gallery/92b330643a0e4b38b056b0d394ce21db.JPG?w=800 800w, /gallery/544/gallery/92b330643a0e4b38b056b0d394ce21db.JPG?w=960 960w",
  "srcset_contain": "/gallery/544/gallery/92b330643a0e4b38b056b0d394ce21db.JPG?w=720 720w, /gallery/544/gallery/92b330643a0e4b38b056b0d394ce21db.JPG?w=960 960w, /gallery/544/gallery/92b330643a0e4b38b056b0d394ce21db.JPG?w=1280 1280w",
  "srcset_print": "/gallery/544/gallery/92b330643a0e4b38b056b0d394ce21db.JPG?w=1600 1600w, /gallery/544/gallery/92b330643a0e4b38b056b0d394ce21db.JPG?w=2500 2500w",
  "sizes_hint": "(max-width: 768px) calc(100vw - 24px), 640px",
  "sizes_hint_cover": "(max-width: 768px) calc(100vw - 24px), 640px",
  "sizes_hint_contain": "(max-width: 768px) 100vw, 1280px",
  "sizes_hint_print": "2500px",
  "storage_policy": {
    "version": 1,
    "profile": "travel",
    "master_width": 2500,
    "master_quality": 85
  },
  "updated_at": "2026-07-22T19:44:59.584031+00:00"
} as TravelMediaImage

export const PROD_ROUTE_POINT: TravelMediaImage = {
  "id": 15109,
  "alt": "Gaststätte zur Harzquerbahn · 103 · Wernigerode · Саксония-Анхальт · Landkreis Harz · Германия",
  "width": 1024,
  "height": 768,
  "aspect_ratio": 1.333333,
  "dominant_color": "#7c6759",
  "blurhash": "LTF~5F%1Mxt7V@%2t7R+00i{ofj[",
  "lqip_url": null,
  "variants": {
    "thumb_320": "/address-image/15109/conversions/5ff1bee04e434e47a34f0fa8c2676530.webp?w=320",
    "card_480": "/address-image/15109/conversions/5ff1bee04e434e47a34f0fa8c2676530.webp?w=480",
    "card_640": "/address-image/15109/conversions/5ff1bee04e434e47a34f0fa8c2676530.webp?w=640",
    "card_800": "/address-image/15109/conversions/5ff1bee04e434e47a34f0fa8c2676530.webp?w=800",
    "card_960": "/address-image/15109/conversions/5ff1bee04e434e47a34f0fa8c2676530.webp?w=960",
    "hero_1200": "/address-image/15109/conversions/5ff1bee04e434e47a34f0fa8c2676530.webp?w=1200",
    "original": "/address-image/15109/conversions/5ff1bee04e434e47a34f0fa8c2676530.webp"
  },
  "src": "/address-image/15109/conversions/5ff1bee04e434e47a34f0fa8c2676530.webp?w=640",
  "src_cover": "/address-image/15109/conversions/5ff1bee04e434e47a34f0fa8c2676530.webp?w=640",
  "src_contain": null,
  "src_print": null,
  "srcset": "/address-image/15109/conversions/5ff1bee04e434e47a34f0fa8c2676530.webp?w=320 320w, /address-image/15109/conversions/5ff1bee04e434e47a34f0fa8c2676530.webp?w=480 480w, /address-image/15109/conversions/5ff1bee04e434e47a34f0fa8c2676530.webp?w=640 640w, /address-image/15109/conversions/5ff1bee04e434e47a34f0fa8c2676530.webp?w=800 800w, /address-image/15109/conversions/5ff1bee04e434e47a34f0fa8c2676530.webp?w=960 960w",
  "srcset_cover": "/address-image/15109/conversions/5ff1bee04e434e47a34f0fa8c2676530.webp?w=320 320w, /address-image/15109/conversions/5ff1bee04e434e47a34f0fa8c2676530.webp?w=480 480w, /address-image/15109/conversions/5ff1bee04e434e47a34f0fa8c2676530.webp?w=640 640w, /address-image/15109/conversions/5ff1bee04e434e47a34f0fa8c2676530.webp?w=800 800w, /address-image/15109/conversions/5ff1bee04e434e47a34f0fa8c2676530.webp?w=960 960w",
  "srcset_contain": null,
  "srcset_print": null,
  "sizes_hint": "(max-width: 768px) calc(100vw - 24px), 640px",
  "sizes_hint_cover": "(max-width: 768px) calc(100vw - 24px), 640px",
  "sizes_hint_contain": "(max-width: 768px) 100vw, 1280px",
  "sizes_hint_print": null,
  "storage_policy": {
    "version": 1,
    "profile": "route_point",
    "master_width": 1200,
    "master_quality": 85
  },
  "updated_at": "2026-07-25T21:28:38.865443+00:00"
} as TravelMediaImage
