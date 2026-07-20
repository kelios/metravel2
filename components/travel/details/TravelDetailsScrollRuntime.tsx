import React, { Suspense, useMemo } from 'react'
import { Platform, View } from 'react-native'

import type { TravelSectionLink } from '@/components/travel/sectionLinks'
import ReadingProgressBar from '@/components/ui/ReadingProgressBar'
import TravelSectionsSheet from '@/components/travel/TravelSectionsSheet'
import { useThemedColors } from '@/hooks/useTheme'
import type { Travel } from '@/types/types'

import TravelStickyActions from './TravelStickyActions'
import { useTravelDetailsDeferredScroll } from './TravelDetailsDeferredScrollContext'
import { getTravelDetailsShellStyles } from './TravelDetailsShellStyles'
import {
  shouldShowTravelReadingProgress,
  shouldShowTravelSectionsSheet,
  shouldShowTravelStickyActions,
} from './travelDetailsPostLcpRuntimeModel'

type TravelDetailsScrollRuntimeProps = {
  criticalChromeReady: boolean
  isMobile: boolean
  onNavigate: (key: string) => void
  screenWidth: number
  scrollToComments: () => void
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
  sectionLinks,
  travel,
}: TravelDetailsScrollRuntimeProps) {
  const { activeSection, contentHeight, scrollY, viewportHeight } =
    useTravelDetailsDeferredScroll()
  const themedColors = useThemedColors()
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
  const showStickyActions = shouldShowTravelStickyActions(isMobile)

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
