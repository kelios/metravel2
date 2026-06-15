import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { Platform, View } from 'react-native';

import { useThemedColors } from '@/hooks/useTheme';
import { useSafeAreaInsetsSafe } from '@/hooks/useSafeAreaInsetsSafe';
import { SectionSkeleton } from '@/components/ui/SectionSkeleton';
import type { Travel } from '@/types/types';
import type { TravelSectionLink } from '@/components/travel/sectionLinks';
import ScrollToTopButton from '@/components/ui/ScrollToTopButton';
import ReadingProgressBar from '@/components/ui/ReadingProgressBar';
import TravelSectionsSheet from '@/components/travel/TravelSectionsSheet';
import TravelStickyActions from './TravelStickyActions';

import type { AnchorsMap } from './TravelDetailsTypes';
import { getTravelDetailsShellStyles } from './TravelDetailsShellStyles';
import {
  getInitialDeferredSectionsComponent,
  loadDeferredSectionsComponent,
  type DeferredSectionsComponentType,
} from './travelDetailsDeferredLoader';
import {
  shouldShowTravelReadingProgress,
  shouldShowTravelScrollToTop,
  shouldShowTravelSectionsSheet,
  shouldShowTravelStickyActions,
} from './travelDetailsPostLcpRuntimeModel';

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
const TravelStickyActionsLazy = React.lazy(() => import('./TravelStickyActions'));
const TravelStickyActionsComponent = Platform.OS === 'web' ? TravelStickyActionsLazy : TravelStickyActions;

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
  const insets = useSafeAreaInsetsSafe();
  const styles = useMemo(() => getTravelDetailsShellStyles(themedColors), [themedColors]);
  const [DeferredSectionsComponent, setDeferredSectionsComponent] =
    useState<DeferredSectionsComponentType | null>(() => getInitialDeferredSectionsComponent());

  useEffect(() => {
    if (DeferredSectionsComponent) return;

    let cancelled = false;

    void loadDeferredSectionsComponent()
      .then((component) => {
        if (!cancelled) setDeferredSectionsComponent(() => component);
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [DeferredSectionsComponent]);

  const deferredSectionsContent = useMemo(
    () =>
      DeferredSectionsComponent ? (
        <DeferredSectionsComponent
          travel={travel}
          isMobile={isMobile}
          forceOpenKey={forceOpenKey}
          anchors={anchors}
          scrollY={scrollY}
          viewportHeight={viewportHeight}
          scrollToMapSection={scrollToMapSection}
        />
      ) : (
        <View style={PLACEHOLDER_STYLE}>
          <SectionSkeleton />
        </View>
      ),
    [
      DeferredSectionsComponent,
      anchors,
      forceOpenKey,
      isMobile,
      scrollToMapSection,
      scrollY,
      travel,
      viewportHeight,
    ],
  );

  const showReadingProgress = shouldShowTravelReadingProgress({
    contentHeight,
    criticalChromeReady,
    viewportHeight,
  });
  const showSectionsSheet = shouldShowTravelSectionsSheet({
    criticalChromeReady,
    screenWidth,
    sectionLinks,
  });
  const showScrollToTop = shouldShowTravelScrollToTop(criticalChromeReady);
  const showStickyActions = shouldShowTravelStickyActions(isMobile);
  const scrollToTopBottomOffset =
    showStickyActions && Platform.OS !== 'web' ? insets.bottom + 56 : 0;

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

      {deferredSectionsContent}

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
  );
}
