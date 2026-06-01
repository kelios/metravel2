import { StyleSheet } from 'react-native'
import { useMemo } from 'react'

import { useThemedColors, type ThemedColors } from '@/hooks/useTheme'
import {
  createTravelDetailsDecisionSummaryStyles,
  createTravelDetailsHeroStyles,
  createTravelDetailsMobileInsightStyles,
  createTravelDetailsStatusStyles,
} from './TravelDetailsStyleFragments'
import { createTravelDetailsLayoutStyles } from './styles/travelDetailsLayoutStyles'
import { createTravelDetailsNavStyles } from './styles/travelDetailsNavStyles'
import { createTravelDetailsSectionHeaderStyles } from './styles/travelDetailsSectionHeaderStyles'
import { createTravelDetailsHeroMediaStyles } from './styles/travelDetailsHeroMediaStyles'
import { createTravelDetailsInsightStyles } from './styles/travelDetailsInsightStyles'
import { createTravelDetailsMiscStyles } from './styles/travelDetailsMiscStyles'

export {
  COMPACT_SPACING,
  COMPACT_TYPOGRAPHY,
  FLUID_TYPOGRAPHY,
  HEADER_OFFSET_DESKTOP,
  HEADER_OFFSET_MOBILE,
} from './TravelDetailsStyleFragments'

/* -------------------- styles -------------------- */
export const getTravelDetailsStyles = (colors: ThemedColors) =>
  StyleSheet.create({
    ...createTravelDetailsDecisionSummaryStyles(colors),
    ...createTravelDetailsHeroStyles(colors),
    ...createTravelDetailsMobileInsightStyles(colors),
    ...createTravelDetailsStatusStyles(colors),
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
