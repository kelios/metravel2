import { StyleSheet } from 'react-native'
import { useMemo } from 'react'

import { useThemedColors, type ThemedColors } from '@/hooks/useTheme'
import { createTravelDetailsLayoutStyles } from './styles/travelDetailsLayoutStyles'
import { createTravelDetailsNavStyles } from './styles/travelDetailsNavStyles'
import { createTravelDetailsSectionHeaderStyles } from './styles/travelDetailsSectionHeaderStyles'
import { createTravelDetailsHeroMediaStyles } from './styles/travelDetailsHeroMediaStyles'
import { createTravelDetailsInsightStyles } from './styles/travelDetailsInsightStyles'
import { createTravelDetailsMiscStyles } from './styles/travelDetailsMiscStyles'

// HEADER_OFFSET_* отсюда НЕ реэкспортируются: этот путь не читал ни один
// модуль, а второй публичный путь к одному числу — ровно та половина проблемы
// #1712, из-за которой числа и разъезжаются. Владелец — TravelDetailsStyleFragments,
// наружу их отдаёт TravelDetailsShellStyles, откуда их берёт useTravelDetailsLayout.
export {
  COMPACT_SPACING,
  COMPACT_TYPOGRAPHY,
  FLUID_TYPOGRAPHY,
} from './TravelDetailsStyleFragments'

/* -------------------- styles -------------------- */
export const getTravelDetailsStyles = (colors: ThemedColors) =>
  StyleSheet.create({
    ...createTravelDetailsLayoutStyles(colors),
    ...createTravelDetailsNavStyles(colors),
    ...createTravelDetailsSectionHeaderStyles(colors),
    ...createTravelDetailsHeroMediaStyles(colors),
    ...createTravelDetailsInsightStyles(colors),
    ...createTravelDetailsMiscStyles(colors),
  })

export const useTravelDetailsStyles = () => {
  const colors = useThemedColors()
  return useMemo(() => getTravelDetailsStyles(colors), [colors])
}
