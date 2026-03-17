import { useMemo } from 'react'
import { Platform } from 'react-native'

import type { TravelSectionLink } from '@/components/travel/sectionLinks'

const HERO_QUICK_JUMP_KEYS = [
  'description',
  'map',
  'points',
  'comments',
  'video',
] as const

export function useTravelHeroExtrasModel(sectionLinks: TravelSectionLink[]) {
  const showQuickJumps = Platform.OS !== 'web'

  const quickJumpLinks = useMemo(() => {
    const linksByKey = new Map(sectionLinks.map((link) => [link.key, link]))
    return HERO_QUICK_JUMP_KEYS.map((key) => linksByKey.get(key)).filter(
      Boolean,
    ) as TravelSectionLink[]
  }, [sectionLinks])

  return {
    quickJumpLinks,
    showQuickJumps,
  }
}
