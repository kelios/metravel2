import React, { Suspense, useMemo } from 'react';
import { Animated, Platform, View } from 'react-native';

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
const CompactSideBarTravel = withLazy(() => import('@/components/travel/CompactSideBarTravel'));
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
  closeMenu: () => void;
  onNavigate: (key: string) => void;
  activeSection: string | null;
  forceOpenKey: string | null;
  scrollY: Animated.Value;
  contentHeight: number;
  viewportHeight: number;
  scrollViewRef: React.RefObject<any>;
  menuWidthNum: number;
  animatedX: Animated.Value;
  sideMenuPlatformStyles: any;
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
  closeMenu,
  onNavigate,
  activeSection,
  forceOpenKey,
  scrollY,
  contentHeight,
  viewportHeight,
  scrollViewRef,
  menuWidthNum,
  animatedX,
  sideMenuPlatformStyles,
  criticalChromeReady,
  scrollToMapSection,
  scrollToComments,
}: TravelDetailsPostLcpRuntimeProps) {
  const themedColors = useThemedColors();
  const styles = useMemo(() => getTravelDetailsShellStyles(themedColors), [themedColors]);

  const sideMenuContainerStyle = useMemo(
    () => ({
      width: menuWidthNum,
      ...Platform.select({
        web: {
          position: 'sticky',
          top: 80,
          alignSelf: 'flex-start',
          maxHeight: 'calc(100vh - 100px)',
          overflowY: 'auto',
          overflowX: 'hidden',
        } as any,
      }),
    }),
    [menuWidthNum]
  );

  const sideMenuAnimatedStyle = useMemo(
    () => [
      styles.sideMenuBase,
      sideMenuPlatformStyles,
      {
        transform: [{ translateX: animatedX }],
        width: '100%' as any,
        zIndex: 1000,
        backgroundColor: themedColors.surface,
        borderRightColor: themedColors.border,
      },
    ],
    [styles.sideMenuBase, sideMenuPlatformStyles, animatedX, themedColors.surface, themedColors.border]
  );

  return (
    <>
      {!isMobile && screenWidth >= METRICS.breakpoints.largeTablet && (
        <View style={sideMenuContainerStyle}>
          <Animated.View testID="travel-details-side-menu" style={sideMenuAnimatedStyle}>
            <Suspense fallback={<SectionSkeleton lines={8} />}>
              <CompactSideBarTravel
                travel={travel}
                isMobile={isMobile}
                refs={anchors}
                links={sectionLinks}
                closeMenu={closeMenu}
                onNavigate={onNavigate}
                activeSection={activeSection}
              />
            </Suspense>
          </Animated.View>
        </View>
      )}

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
