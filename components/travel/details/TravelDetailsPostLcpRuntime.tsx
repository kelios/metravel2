import React, { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';

import { useThemedColors } from '@/hooks/useTheme';
import { SectionSkeleton } from '@/components/ui/SectionSkeleton';
import type { Travel } from '@/types/types';
import type { TravelSectionLink } from '@/components/travel/sectionLinks';
import ScrollToTopButton from '@/components/ui/ScrollToTopButton';
import ReadingProgressBar from '@/components/ui/ReadingProgressBar';
import TravelSectionsSheet from '@/components/travel/TravelSectionsSheet';

import type { AnchorsMap } from './TravelDetailsTypes';
import { getTravelDetailsShellStyles } from './TravelDetailsShellStyles';
import TravelStickyActions from './TravelStickyActions';
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

  const deferredSectionsContent = (
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
    )
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
        <ScrollToTopButton scrollViewRef={scrollViewRef} scrollY={scrollY} threshold={300} />
      )}

      {showStickyActions && (
        <TravelStickyActions
          travel={travel}
          scrollY={scrollY}
          scrollToComments={scrollToComments}
        />
      )}
    </>
  );
}
