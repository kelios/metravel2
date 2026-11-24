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

/**
 * Облегчённые копии фасада для баннера главной (#3488): `phone` — кроп во всю
 * ширину телефона, `desktop` — окно 120 px. Сами копии — только в web-бандле
 * (`adventFacadeBannerSources.web.ts`); на native фасад уже в приложении и
 * баннер кадрирует его, лишние ~316 КБ картинок в сборку не попадают.
 */
export type AdventFacadeBannerSources = {
  phone: readonly AdventFacadeSource[]
  desktop: readonly AdventFacadeSource[]
}

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
