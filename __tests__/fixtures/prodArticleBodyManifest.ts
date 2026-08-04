// __tests__/fixtures/prodArticleBodyManifest.ts
//
// Реальный срез `media.article_body` с прода metravel.by (2026-08-04), нужный для
// #1256: тело статьи перестаёт собирать медиа-URL само и берёт готовые адреса.
//
// Здесь ровно три класса, которые ведут себя по-разному, — и каждый зафиксирован
// потому, что на нём уже ломались прошлые заходы:
//
//   - `ARTICLE_BODY_DESCRIPTION_IMAGE` — канонический ключ семейства
//     `travel-description-image`. Лестница `srcset` идёт w-only (ни `q=`, ни `fit=`),
//     а мастер 1920 лежит только в `variants.hero_1920` и в `srcset` не попадает:
//     просить его нельзя, чтение производных fail-closed (#1215).
//
//   - `ARTICLE_BODY_ADDRESS_IMAGE` — ключ ЧУЖОГО семейства в теле статьи. Манифест
//     помечает его профилем `article_body` и обещает ступень 1600, хотя реальный
//     профиль ключа — `routePoint` с верхней производной 960. Замер прода
//     2026-08-04: `w=800`/`w=960` → 200 `immutable`, `w=1600` → **400** и на
//     family-роуте, и на `/media-resize/legacy/`. Подставлять такую ступень нельзя —
//     это регресс #1233 (30 фото в 5 статьях не отрисовывались).
//
//   - `ARTICLE_BODY_LEGACY_UPLOAD` — legacy-класс `uploads/**`. Готовых производных
//     у него нет вовсе: `srcset` пуст, а `src` ведёт прямо в бакет, который
//     игнорирует `?w=` и отдаёт мастер (141 354 B против 7 820 B на `?w=320`
//     через свой роут, #1176). Такой элемент обязан уходить в фолбэк целиком.

import type { TravelMediaImage } from '@/types/types'

const descriptionImageBase =
  'https://metravel.by/travel-description-image/3754ddddf8064823b12ea9f4b7863e6e.jpg.webp'
const addressImageBase =
  'https://metravel.by/address-image/15601/conversions/db981e7dac4f45cb840ae19a5722ed22.webp'

const srcsetOf = (base: string, widths: readonly number[]): string =>
  widths.map((width) => `${base}?w=${width} ${width}w`).join(', ')

export const ARTICLE_BODY_DESCRIPTION_IMAGE_URL = descriptionImageBase
export const ARTICLE_BODY_ADDRESS_IMAGE_URL = addressImageBase
export const ARTICLE_BODY_LEGACY_UPLOAD_URL =
  'https://metravelprod.s3.eu-north-1.amazonaws.com/uploads/1591620319350_original.jpg'

/** Ступени, которые манифест реально перечисляет обоим первопартийным ключам. */
export const ARTICLE_BODY_MANIFEST_WIDTHS = [320, 480, 640, 800, 960, 1600] as const

export const ARTICLE_BODY_DESCRIPTION_IMAGE: TravelMediaImage = {
  id: 0,
  alt: 'Указатель START / ZIEL Harzer-Hexen-Stieg с ведьмой на метле',
  width: null,
  height: null,
  aspect_ratio: null,
  dominant_color: null,
  blurhash: null,
  lqip_url: null,
  variants: {
    content_320: `${descriptionImageBase}?w=320`,
    content_480: `${descriptionImageBase}?w=480`,
    content_640: `${descriptionImageBase}?w=640`,
    content_800: `${descriptionImageBase}?w=800`,
    content_960: `${descriptionImageBase}?w=960`,
    content_1600: `${descriptionImageBase}?w=1600`,
    hero_1920: `${descriptionImageBase}?w=1920`,
    original: descriptionImageBase,
  },
  src: `${descriptionImageBase}?w=1600`,
  src_cover: null,
  src_contain: `${descriptionImageBase}?w=1600`,
  src_print: null,
  srcset: srcsetOf(descriptionImageBase, ARTICLE_BODY_MANIFEST_WIDTHS),
  srcset_cover: null,
  srcset_contain: srcsetOf(descriptionImageBase, ARTICLE_BODY_MANIFEST_WIDTHS),
  srcset_print: null,
  sizes_hint: '(max-width: 768px) 100vw, 1280px',
  sizes_hint_cover: '(max-width: 768px) calc(100vw - 24px), 640px',
  sizes_hint_contain: '(max-width: 768px) 100vw, 1280px',
  sizes_hint_print: null,
  storage_policy: {
    version: 1,
    profile: 'article_body',
    master_width: 1920,
    master_quality: 85,
  },
  updated_at: '2026-08-03T16:03:25.203599+00:00',
} as TravelMediaImage

export const ARTICLE_BODY_ADDRESS_IMAGE: TravelMediaImage = {
  id: 6,
  alt: null,
  width: null,
  height: null,
  aspect_ratio: null,
  dominant_color: null,
  blurhash: null,
  lqip_url: null,
  variants: {
    content_320: `${addressImageBase}?w=320`,
    content_960: `${addressImageBase}?w=960`,
    content_1600: `${addressImageBase}?w=1600`,
    original: addressImageBase,
  },
  src: `${addressImageBase}?w=1600`,
  src_cover: null,
  src_contain: `${addressImageBase}?w=1600`,
  src_print: null,
  srcset: srcsetOf(addressImageBase, ARTICLE_BODY_MANIFEST_WIDTHS),
  srcset_cover: null,
  srcset_contain: srcsetOf(addressImageBase, ARTICLE_BODY_MANIFEST_WIDTHS),
  srcset_print: null,
  sizes_hint: '(max-width: 768px) 100vw, 1280px',
  sizes_hint_cover: '(max-width: 768px) calc(100vw - 24px), 640px',
  sizes_hint_contain: '(max-width: 768px) 100vw, 1280px',
  sizes_hint_print: null,
  storage_policy: {
    version: 1,
    profile: 'article_body',
    master_width: 1920,
    master_quality: 85,
  },
  updated_at: '2026-07-20T19:26:09.841361+00:00',
} as TravelMediaImage

export const ARTICLE_BODY_LEGACY_UPLOAD: TravelMediaImage = {
  id: 0,
  alt: 'Лабрадор',
  width: null,
  height: null,
  aspect_ratio: null,
  dominant_color: null,
  blurhash: null,
  lqip_url: null,
  variants: { original: ARTICLE_BODY_LEGACY_UPLOAD_URL },
  src: ARTICLE_BODY_LEGACY_UPLOAD_URL,
  src_cover: null,
  src_contain: null,
  src_print: null,
  srcset: null,
  srcset_cover: null,
  srcset_contain: null,
  srcset_print: null,
  sizes_hint: '(max-width: 768px) calc(100vw - 24px), 640px',
  sizes_hint_cover: '(max-width: 768px) calc(100vw - 24px), 640px',
  sizes_hint_contain: '(max-width: 768px) 100vw, 1280px',
  sizes_hint_print: null,
  storage_policy: null,
  updated_at: '2026-07-30T14:26:17.952514+00:00',
} as TravelMediaImage

/** Тело статьи целиком: три класса в том порядке, в каком они идут в разметке. */
export const PROD_ARTICLE_BODY_GROUP = {
  cover: ARTICLE_BODY_DESCRIPTION_IMAGE,
  gallery: [
    ARTICLE_BODY_DESCRIPTION_IMAGE,
    ARTICLE_BODY_ADDRESS_IMAGE,
    ARTICLE_BODY_LEGACY_UPLOAD,
  ],
}
