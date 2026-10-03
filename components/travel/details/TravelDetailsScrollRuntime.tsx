import React, { Suspense, useMemo } from 'react'
import { View } from 'react-native'

import type { TravelSectionLink } from '@/components/travel/sectionLinks'
import ReadingProgressBar from '@/components/ui/ReadingProgressBar'
import TravelSectionsSheet from '@/components/travel/TravelSectionsSheet'
import { useThemedColors } from '@/hooks/useTheme'
import type { Travel } from '@/types/types'

import TravelStickyActionsSlot from './TravelStickyActionsSlot'
import { useTravelDetailsDeferredScroll } from './TravelDetailsDeferredScrollContext'
import { getTravelDetailsShellStyles } from './TravelDetailsShellStyles'
import {
  shouldShowTravelReadingProgress,
  shouldShowTravelSectionsSheet,
  shouldShowTravelStickyActions,
} from './travelDetailsPostLcpRuntimeModel'

/**
 * #2118: слой рантайм-хрома детали.
 * - `scroll` — то, что живёт в потоке статьи (лист разделов);
 * - `viewport` — то, что привязано к окну: полоска прогресса чтения и бар
 *   «Действия с путешествием». На native `position: absolute` относится к
 *   ближайшему родителю, а внутри ScrollView это колонка контента высотой во
 *   всю статью: бар стоял на y ≈ 57 800 (замер iPhone 17 Pro), полоска — в низу
 *   статьи. Поэтому этот слой монтируется вне ScrollView (`viewportOverlay`
 *   критической оболочки);
 * - `all` — web: окно держат портал бара (#2117) и `position: fixed` полоски.
 */
export type TravelDetailsRuntimeLayer = 'all' | 'scroll' | 'viewport'

type TravelDetailsScrollRuntimeProps = {
  criticalChromeReady: boolean
  layer?: TravelDetailsRuntimeLayer
  isMobile: boolean
  onNavigate: (key: string) => void
  screenWidth: number
  scrollToComments: () => void
  sectionLinks: TravelSectionLink[]
  travel: Travel
}

// #1499: выбор web/native переехал в платформенную пару
// `TravelStickyActionsSlot(.web).tsx` — статический импорт для native-ветки
// оставлял `TravelStickyActions` со всем поддеревом в стартовом графе web.
const TravelStickyActionsComponent = TravelStickyActionsSlot

function TravelDetailsScrollRuntime({
  criticalChromeReady,
  layer = 'all',
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

  const showScrollLayer = layer !== 'viewport'
  const showViewportLayer = layer !== 'scroll'
  const showReadingProgress = showViewportLayer && shouldShowTravelReadingProgress({
    contentHeight,
    criticalChromeReady,
    viewportHeight,
  })
  const showSectionsSheet = showScrollLayer && shouldShowTravelSectionsSheet({
    criticalChromeReady,
    screenWidth,
    sectionLinks,
  })
  const showStickyActions = showViewportLayer && shouldShowTravelStickyActions(isMobile)

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
