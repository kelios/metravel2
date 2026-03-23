import React, { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';

import { METRICS } from '@/constants/layout';
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
const isTestEnv =
  typeof process !== 'undefined' && process.env?.JEST_WORKER_ID !== undefined;

type DeferredSectionsComponentType = React.ComponentType<{
  travel: Travel;
  isMobile: boolean;
  forceOpenKey: string | null;
  anchors: AnchorsMap;
  scrollY: any;
  viewportHeight: number;
  scrollToMapSection: () => void;
}>;

let deferredSectionsLoader: Promise<DeferredSectionsComponentType> | null = null;

const loadDeferredSections = async (): Promise<DeferredSectionsComponentType> => {
  if (!deferredSectionsLoader) {
    deferredSectionsLoader = import('@/components/travel/details/TravelDetailsDeferred').then(
      (m) => m.TravelDeferredSections,
    );
  }
  return deferredSectionsLoader;
};

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
    useState<DeferredSectionsComponentType | null>(() => {
      if (!isTestEnv) return null;
      const mod = require('@/components/travel/details/TravelDetailsDeferred');
      return mod.TravelDeferredSections as DeferredSectionsComponentType;
    });

  useEffect(() => {
    if (DeferredSectionsComponent) return;

    let cancelled = false;

    void loadDeferredSections()
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

  return (
    <>
      {contentHeight > viewportHeight && criticalChromeReady && (
        <ReadingProgressBar
          scrollY={scrollY}
          contentHeight={contentHeight}
          viewportHeight={viewportHeight}
        />
      )}

      {screenWidth < METRICS.breakpoints.largeTablet && sectionLinks.length > 0 && criticalChromeReady && (
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

      {criticalChromeReady && (
        <ScrollToTopButton scrollViewRef={scrollViewRef} scrollY={scrollY} threshold={300} />
      )}

      {isMobile && (
        <TravelStickyActions
          travel={travel}
          scrollY={scrollY}
          scrollToComments={scrollToComments}
        />
      )}
    </>
  );
}
