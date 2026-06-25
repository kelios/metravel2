import React, { Suspense, useMemo } from 'react'
import { Platform, View } from 'react-native'

import type { TravelSectionLink } from '@/components/travel/sectionLinks'
import ReadingProgressBar from '@/components/ui/ReadingProgressBar'
import ScrollToTopButton from '@/components/ui/ScrollToTopButton'
import TravelSectionsSheet from '@/components/travel/TravelSectionsSheet'
import { useSafeAreaInsetsSafe } from '@/hooks/useSafeAreaInsetsSafe'
import { useThemedColors } from '@/hooks/useTheme'
import type { Travel } from '@/types/types'

import TravelStickyActions from './TravelStickyActions'
import { useTravelDetailsDeferredScroll } from './TravelDetailsDeferredScrollContext'
import { getTravelDetailsShellStyles } from './TravelDetailsShellStyles'
import {
  shouldShowTravelReadingProgress,
  shouldShowTravelScrollToTop,
  shouldShowTravelSectionsSheet,
  shouldShowTravelStickyActions,
} from './travelDetailsPostLcpRuntimeModel'

type TravelDetailsScrollRuntimeProps = {
  criticalChromeReady: boolean
  isMobile: boolean
  onNavigate: (key: string) => void
  screenWidth: number
  scrollToComments: () => void
  scrollViewRef: React.RefObject<any>
  sectionLinks: TravelSectionLink[]
  travel: Travel
}

const TravelStickyActionsLazy = React.lazy(() => import('./TravelStickyActions'))
const TravelStickyActionsComponent =
  Platform.OS === 'web' ? TravelStickyActionsLazy : TravelStickyActions

function TravelDetailsScrollRuntime({
  criticalChromeReady,
  isMobile,
  onNavigate,
  screenWidth,
  scrollToComments,
  scrollViewRef,
  sectionLinks,
  travel,
}: TravelDetailsScrollRuntimeProps) {
  const { activeSection, contentHeight, scrollY, viewportHeight } =
    useTravelDetailsDeferredScroll()
  const themedColors = useThemedColors()
  const insets = useSafeAreaInsetsSafe()
  const styles = useMemo(() => getTravelDetailsShellStyles(themedColors), [themedColors])

  const showReadingProgress = shouldShowTravelReadingProgress({
    contentHeight,
    criticalChromeReady,
    viewportHeight,
  })
  const showSectionsSheet = shouldShowTravelSectionsSheet({
    criticalChromeReady,
    screenWidth,
    sectionLinks,
  })
  const showScrollToTop = shouldShowTravelScrollToTop(criticalChromeReady)
  const showStickyActions = shouldShowTravelStickyActions(isMobile)
  const scrollToTopBottomOffset =
    showStickyActions && Platform.OS !== 'web' ? insets.bottom + 56 : 0

  return (
    <>
      {showReadingProgress && (
        <ReadingProgressBar
          scrollY={scrollY}
          contentHeight={contentHeight}
          viewportHeight={viewportHeight}
        />
      )}

      {showSectionsSheet && (
        <View style={styles.sectionTabsContainer}>
          <TravelSectionsSheet
            links={sectionLinks}
            activeSection={activeSection ?? ''}
            onNavigate={onNavigate}
            testID="travel-sections-sheet-wrapper"
          />
        </View>
      )}

      {showScrollToTop && (
        <ScrollToTopButton
          scrollViewRef={scrollViewRef}
          scrollY={scrollY}
          threshold={300}
          bottomOffset={scrollToTopBottomOffset}
        />
      )}

      {showStickyActions && (
        <Suspense fallback={null}>
          <TravelStickyActionsComponent
            travel={travel}
            scrollY={scrollY}
            scrollToComments={scrollToComments}
          />
        </Suspense>
      )}
    </>
  )
}

export default React.memo(TravelDetailsScrollRuntime)
