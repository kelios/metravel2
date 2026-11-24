import { useCallback } from 'react'

import { useLocaleRevision } from '@/i18n/useLocaleRevision'
import { useAdventRegionStore } from '@/stores/adventRegionStore'
import type { AdventRegion } from '@/types/advent'
import { defaultAdventRegion } from '@/utils/advent/adventVariants'

/**
 * Выбранный вариант адвента (#3486): сохранённый выбор, а до него — регион по
 * языку интерфейса. Выбор общий для всех дверец календаря.
 */
export function useAdventRegion(): [AdventRegion, (region: AdventRegion) => void] {
  const locale = useLocaleRevision()
  const stored = useAdventRegionStore((state) => state.region)
  const setStored = useAdventRegionStore((state) => state.setRegion)
  const setRegion = useCallback((region: AdventRegion) => setStored(region), [setStored])
  return [stored ?? defaultAdventRegion(locale), setRegion]
}
