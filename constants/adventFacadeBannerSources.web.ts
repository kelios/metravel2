import type { ImageRequireSource } from 'react-native'

import type { AdventFacadeBannerSources, AdventFacadeSource } from './adventVisuals'

/** Высота исходника `winter-house.webp` в пикселях: границы полос заданы по нарезке. */
const FACADE_H = 1350
const band = (key: string, source: ImageRequireSource, topPx: number, heightPx: number): AdventFacadeSource => ({
  key,
  source,
  region: { x: 0, y: topPx / FACADE_H, width: 1, height: heightPx / FACADE_H },
})

/**
 * Кропы баннера главной на web (#3488). Полный фасад (239 КБ) нужен только дому
 * и листу дверцы; баннеру хватает части картинки:
 * - `desktop` — весь фасад в 480 px по ширине: маленькое окно 120 px;
 * - `phone` — полосы фасада в полном разрешении по ряду окон и крыша: кроп во всю
 *   ширину телефона, где уменьшенная копия заметно мылит. Кроп сам берёт самую
 *   узкую полосу, внутри которой целиком лежит его область (`pickAdventFacadeSource`).
 * Пиксельные границы полос совпадают с нарезкой файлов (см. `assets/advent/2026/PROMPT.md`).
 * Native-пара — `adventFacadeBannerSources.ts`.
 */
export const ADVENT_FACADE_BANNER_SOURCES: AdventFacadeBannerSources = {
  desktop: [
    {
      key: 'small',
      source: require('@/assets/advent/2026/winter-house-small.webp') as ImageRequireSource,
      region: { x: 0, y: 0, width: 1, height: 1 },
    },
  ],
  phone: [
    band('roof', require('@/assets/advent/2026/winter-house-roof.webp') as ImageRequireSource, 0, 445),
    band('row-1', require('@/assets/advent/2026/winter-house-row-1.webp') as ImageRequireSource, 50, 216),
    band('row-2', require('@/assets/advent/2026/winter-house-row-2.webp') as ImageRequireSource, 229, 217),
    band('row-3', require('@/assets/advent/2026/winter-house-row-3.webp') as ImageRequireSource, 414, 216),
    band('row-4', require('@/assets/advent/2026/winter-house-row-4.webp') as ImageRequireSource, 595, 216),
    band('row-5', require('@/assets/advent/2026/winter-house-row-5.webp') as ImageRequireSource, 780, 216),
    band('row-6', require('@/assets/advent/2026/winter-house-row-6.webp') as ImageRequireSource, 964, 216),
  ],
}
