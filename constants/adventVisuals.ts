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
} as const

export const ADVENT_FROST_OPACITY = 0.68
