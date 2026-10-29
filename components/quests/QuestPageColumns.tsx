import { lazy, Suspense, useMemo, type ReactNode } from 'react'
import { Platform, StyleSheet, View } from 'react-native'

import { getAffiliateOffers, type AffiliateOfferContext } from '@/components/affiliate/affiliateConfig'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useBreakpoints } from '@/hooks/useResponsive'
import { breakpointLayoutProps, breakpointStyle } from '@/utils/breakpointLayout'
import { webViewStyle } from '@/utils/webProps'
import { QUEST_PAGE_COLUMNS_LAYOUT, QUEST_PAGE_COLUMNS_MIN_WIDTH } from './questPageColumnsLayout'

const QuestAffiliatePromotion = lazy(() => import('./QuestAffiliatePromotion'))

export type QuestPageColumnsProps = {
  children: ReactNode
  affiliateContext?: AffiliateOfferContext
  /** A caller-owned advertising provider replaces, never accompanies, generic offers. */
  promotion?: ReactNode
  hasPromotion?: boolean
  readingWidth?: number
}

/** One advertising mount: a right rail on wide screens and an inline section below. */
export function QuestPageColumns({ children, affiliateContext, promotion, hasPromotion, readingWidth }: QuestPageColumnsProps) {
  const { width } = useBreakpoints()
  const isWide = width >= QUEST_PAGE_COLUMNS_MIN_WIDTH
  const { city, country, countryCode, travelId } = affiliateContext ?? {}
  const hasCustomPromotion = promotion !== undefined
  const showPromotion = useMemo(() => (
    hasCustomPromotion ? (hasPromotion ?? Boolean(promotion))
      : getAffiliateOffers({ city, country, countryCode, travelId }).length > 0
  ), [hasCustomPromotion, hasPromotion, promotion, city, country, countryCode, travelId])

  return (
    <View
      style={[styles.columns, breakpointStyle(QUEST_PAGE_COLUMNS_LAYOUT, 'columns', isWide)]}
      {...breakpointLayoutProps(QUEST_PAGE_COLUMNS_LAYOUT, 'columns')}
      testID="quest-page-columns"
    >
      <View
        style={breakpointStyle(QUEST_PAGE_COLUMNS_LAYOUT, 'main', isWide)}
        {...breakpointLayoutProps(QUEST_PAGE_COLUMNS_LAYOUT, 'main')}
        testID="quest-page-main"
      >
        {readingWidth === undefined ? children : <View style={[styles.reading, { maxWidth: readingWidth }]}>{children}</View>}
      </View>
      {showPromotion ? (
        <View
          style={[styles.promotion, breakpointStyle(QUEST_PAGE_COLUMNS_LAYOUT, 'promotion', isWide)]}
          {...breakpointLayoutProps(QUEST_PAGE_COLUMNS_LAYOUT, 'promotion')}
          testID="quest-page-promotion"
        >
          {hasCustomPromotion ? promotion : (
            <Suspense fallback={null}><QuestAffiliatePromotion {...affiliateContext} /></Suspense>
          )}
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  columns: { width: '100%', minWidth: 0 },
  reading: { width: '100%', minWidth: 0, alignSelf: 'center' },
  promotion: {
    ...Platform.select({ web: webViewStyle({ position: 'sticky', top: DESIGN_TOKENS.spacing.lg }) }),
  },
})
