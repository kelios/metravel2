import type { AdventShareKind } from '@/utils/advent/adventShare'

export type AdventCardArtwork = 'departure' | 'lanterns' | 'trail' | 'rail' | 'christmas' | 'fortune'

/** Every exported card has an illustrated background, including cards without personal statistics. */
export const ADVENT_CARD_ARTWORK: Record<AdventShareKind, AdventCardArtwork> = {
  progress: 'trail',
  year: 'rail',
  postcard: 'christmas',
  title: 'departure',
  fortune: 'fortune',
}
