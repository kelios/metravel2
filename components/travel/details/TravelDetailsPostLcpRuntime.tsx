import React, { Suspense, useMemo } from 'react';
import { View } from 'react-native';

import { METRICS } from '@/constants/layout';
import { useThemedColors } from '@/hooks/useTheme';
import { SectionSkeleton } from '@/components/ui/SectionSkeleton';
import type { Travel } from '@/types/types';
import type { TravelSectionLink } from '@/components/travel/sectionLinks';

import type { AnchorsMap } from './TravelDetailsTypes';
import { getTravelDetailsShellStyles } from './TravelDetailsShellStyles';
import { withLazy } from './TravelDetailsLazy';

const ScrollToTopButton = withLazy(() => import('@/components/ui/ScrollToTopButton'));
const ReadingProgressBar = withLazy(() => import('@/components/ui/ReadingProgressBar'));
const TravelSectionsSheet = withLazy(() => import('@/components/travel/TravelSectionsSheet'));
const TravelStickyActions = withLazy(() => import('@/components/travel/details/TravelStickyActions'));
const TravelDeferredSections = withLazy(() =>
  import('@/components/travel/details/TravelDetailsDeferred').then((m) => ({
    default: m.TravelDeferredSections,
  }))
);

type TravelDetailsPostLcpRuntimeProps = {
  travel: Travel;
  isMobile: boolean;
  screenWidth: number;
  anchors: AnchorsMap;
  sectionLinks: TravelSectionLink[];
  onNavigate: (key: string) => void;
  activeSection: string | null;
  forceOpenKey: string | null;
  scrollY: any;
  contentHeight: number;
  viewportHeight: number;
  scrollViewRef: React.RefObject<any>;
  criticalChromeReady: boolean;
  scrollToMapSection: () => void;
  scrollToComments: () => void;
};

const PLACEHOLDER_STYLE = { flex: 1 } as const;

export default function TravelDetailsPostLcpRuntime({
  travel,
  isMobile,
  screenWidth,
  anchors,
  sectionLinks,
  onNavigate,
  activeSection,
  forceOpenKey,
  scrollY,
  contentHeight,
  viewportHeight,
  scrollViewRef,
  criticalChromeReady,
  scrollToMapSection,
  scrollToComments,
}: TravelDetailsPostLcpRuntimeProps) {
  const themedColors = useThemedColors();
  const styles = useMemo(() => getTravelDetailsShellStyles(themedColors), [themedColors]);

  const deferredSectionsContent = (
    <Suspense fallback={<SectionSkeleton style={PLACEHOLDER_STYLE} />}>
      <TravelDeferredSections
        travel={travel}
        isMobile={isMobile}
        forceOpenKey={forceOpenKey}
        anchors={anchors}
        scrollY={scrollY}
        viewportHeight={viewportHeight}
        scrollToMapSection={scrollToMapSection}
      />
    </Suspense>
  );

  return (
    <>
      {contentHeight > viewportHeight && criticalChromeReady && (
        <Suspense fallback={null}>
          <ReadingProgressBar
            scrollY={scrollY}
            contentHeight={contentHeight}
            viewportHeight={viewportHeight}
          />
        </Suspense>
      )}

      {screenWidth < METRICS.breakpoints.largeTablet && sectionLinks.length > 0 && criticalChromeReady && (
        <View style={styles.sectionTabsContainer}>
          <Suspense fallback={null}>
            <TravelSectionsSheet
              links={sectionLinks}
              activeSection={activeSection}
              onNavigate={onNavigate}
              testID="travel-sections-sheet-wrapper"
            />
          </Suspense>
        </View>
      )}

      {deferredSectionsContent}

      {criticalChromeReady && (
        <Suspense fallback={null}>
          <ScrollToTopButton scrollViewRef={scrollViewRef} scrollY={scrollY} threshold={300} />
        </Suspense>
      )}

      {isMobile && (
        <Suspense fallback={null}>
          <TravelStickyActions
            travel={travel}
            scrollY={scrollY}
            scrollToComments={scrollToComments}
          />
        </Suspense>
      )}
    </>
  );
}
