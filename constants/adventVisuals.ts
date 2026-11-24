import type { ImageRequireSource } from 'react-native'

/** Advent-only imports: do not pull this illustration pack into the global header. */
export const ADVENT_VISUAL_ASSETS = {
  facade: require('@/assets/advent/2026/winter-house.webp') as ImageRequireSource,
  frost: [
    require('@/assets/advent/2026/frost-1.webp') as ImageRequireSource,
    require('@/assets/advent/2026/frost-2.webp') as ImageRequireSource,
    require('@/assets/advent/2026/frost-3.webp') as ImageRequireSource,
    require('@/assets/advent/2026/frost-4.webp') as ImageRequireSource,
  ],
} as const

/** Область фасада, которую покрывает картинка: доли ширины и высоты исходника 900×1350. */
export type AdventFacadeRegion = { x: number; y: number; width: number; height: number }

/** Облегчённая производная фасада для кропа окна (#3488). */
export type AdventFacadeSource = { key: string; source: ImageRequireSource; region: AdventFacadeRegion }

/** Высота исходника `winter-house.webp` в пикселях: границы полос заданы по нарезке. */
const FACADE_H = 1350
const band = (key: string, source: ImageRequireSource, topPx: number, heightPx: number): AdventFacadeSource => ({
  key,
  source,
  region: { x: 0, y: topPx / FACADE_H, width: 1, height: heightPx / FACADE_H },
})

/**
 * Кропы баннера главной (#3488). Полный фасад (239 КБ) нужен только дому и листу
 * дверцы; баннеру хватает части картинки:
 * - `small` — весь фасад в 480 px по ширине: маленькое окно 120 px на desktop;
 * - `bands` — полосы фасада в полном разрешении по ряду окон и крыша: кроп во всю
 *   ширину телефона, где уменьшенная копия заметно мылит. Кроп сам берёт самую
 *   узкую полосу, внутри которой целиком лежит его область (`pickAdventFacadeSource`).
 * Пиксельные границы полос совпадают с нарезкой файлов (см. `PROMPT.md`).
 */
export const ADVENT_FACADE_BANNER_SOURCES = {
  small: {
    key: 'small',
    source: require('@/assets/advent/2026/winter-house-small.webp') as ImageRequireSource,
    region: { x: 0, y: 0, width: 1, height: 1 },
  } satisfies AdventFacadeSource,
  bands: [
    band('roof', require('@/assets/advent/2026/winter-house-roof.webp') as ImageRequireSource, 0, 445),
    band('row-1', require('@/assets/advent/2026/winter-house-row-1.webp') as ImageRequireSource, 50, 216),
    band('row-2', require('@/assets/advent/2026/winter-house-row-2.webp') as ImageRequireSource, 229, 217),
    band('row-3', require('@/assets/advent/2026/winter-house-row-3.webp') as ImageRequireSource, 414, 216),
    band('row-4', require('@/assets/advent/2026/winter-house-row-4.webp') as ImageRequireSource, 595, 216),
    band('row-5', require('@/assets/advent/2026/winter-house-row-5.webp') as ImageRequireSource, 780, 216),
    band('row-6', require('@/assets/advent/2026/winter-house-row-6.webp') as ImageRequireSource, 964, 216),
  ] as readonly AdventFacadeSource[],
} as const

/** Fixed pigments of the approved illustration, independent of the surrounding UI theme. */
export const ADVENT_ART_COLORS = {
  closedGlass: 'rgba(49, 77, 94, 0.26)',
  closedDim: 'rgba(13, 25, 34, 0.34)',
  openedGlow: 'rgba(244, 193, 121, 0.44)',
  moonlight: 'rgba(229, 244, 255, 0.36)',
  moonlightClear: 'rgba(229, 244, 255, 0)',
  numberBackground: 'rgba(250, 243, 227, 0.93)',
  numberText: '#433c35',
  numberBorder: '#a7a096',
  todayBorder: '#b48838',
  todayRing: '#f5da94',
  /** Золото рамок, бирки награды и искр (#3482). */
  gold: '#c9973f',
  goldDeep: '#9a6f24',
  sparkle: '#fff3cf',
  unwrapGlow: 'rgba(245, 218, 148, 0.46)',
  /** Ночное небо фасада: подложка открытки, грамоты и баннера главной. */
  night: '#16222d',
  nightSoft: 'rgba(22, 34, 45, 0.72)',
  nightText: '#f7eedc',
  nightTextMuted: 'rgba(247, 238, 220, 0.78)',
  /** Ошибка на ночной подложке: ≈9:1 к `night` (#3488). */
  nightDanger: '#f2b8ad',
  /** Наведение на контурную кнопку на `night`: светлая подпись остаётся ≈9:1. */
  nightHover: 'rgba(201, 151, 63, 0.2)',
} as const

/** Тёплая «бумага» листа дверцы (#3482): своя пара на светлую и тёмную тему. */
export const ADVENT_PAPER_COLORS = {
  light: { paper: '#fcf5e8', edge: '#ecdcbc', ink: '#3d3328', inkMuted: '#6b5b48', gold: '#8a6119', success: '#3e6650', tag: '#f6e7c6' },
  dark: { paper: '#2a2219', edge: '#4d3f2b', ink: '#f3e9d8', inkMuted: '#cdbfa8', gold: '#e2b866', success: '#9cc7a8', tag: '#3a2f20' },
} as const

export const ADVENT_FROST_OPACITY = 0.68

export type AdventPaperPalette = (typeof ADVENT_PAPER_COLORS)['light'] | (typeof ADVENT_PAPER_COLORS)['dark']
