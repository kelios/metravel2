import React, { Suspense, useMemo } from 'react';
import { Animated, Platform, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import CompactSideBarTravel from '@/components/travel/CompactSideBarTravel';
import type { Travel } from '@/types/types';
import type { TravelSectionLink } from '@/components/travel/sectionLinks';
import {
  getTravelDetailsDesktopContentColumnStyle,
  getTravelDetailsDesktopLayoutStyle,
  getTravelDetailsDesktopSidebarContainerStyle,
  shouldShowTravelDetailsDesktopSidebar,
  shouldShowTravelDetailsSkeletonOverlay,
} from '@/components/travel/details/travelDetailsCriticalShellModel';

import type { AnchorsMap } from './TravelDetailsTypes';
import TravelDetailsSkeletonOverlay from './TravelDetailsSkeletonOverlay';
import TravelDetailsHeroDeferredColumn from './TravelDetailsHeroDeferredColumn';

type TravelDetailsCriticalShellProps = {
  travel?: Travel;
  isMobile: boolean;
  screenWidth: number;
  wrapperStyle: any;
  styles: any;
  skeletonPhase: 'loading' | 'fading' | 'hidden';
  skeletonFallback: React.ReactNode;
  travelDetailSkeleton: React.ReactNode;
  scrollRef: React.RefObject<any>;
  scrollViewStyle: any;
  scrollEventHandler: any;
  handleContentSizeChange: (...args: any[]) => void;
  handleLayout: (...args: any[]) => void;
  contentHorizontalPadding: number;
  anchors: AnchorsMap;
  sliderReady: boolean;
  lcpLoaded: boolean;
  onFirstImageLoad: () => void;
  sectionLinks: TravelSectionLink[];
  onQuickJump: (key: string) => void;
  deferHeroExtras: boolean;
  activeSection: string | null;
  closeMenu: () => void;
  onNavigate: (key: string) => void;
  menuWidthNum: number;
  animatedX: Animated.Value;
  sideMenuPlatformStyles: any;
  deferredContent: React.ReactNode;
  mainAriaLabel: string;
};

export default function TravelDetailsCriticalShell({
  travel,
  isMobile,
  screenWidth,
  wrapperStyle,
  styles,
  skeletonPhase,
  skeletonFallback,
  travelDetailSkeleton,
  scrollRef,
  scrollViewStyle,
  scrollEventHandler,
  handleContentSizeChange,
  handleLayout,
  contentHorizontalPadding,
  anchors,
  sliderReady: _sliderReady,
  lcpLoaded,
  onFirstImageLoad,
  sectionLinks,
  onQuickJump,
  deferHeroExtras,
  activeSection,
  closeMenu,
  onNavigate,
  menuWidthNum,
  animatedX,
  sideMenuPlatformStyles,
  deferredContent,
  mainAriaLabel,
}: TravelDetailsCriticalShellProps) {
  const showDesktopSidebar = shouldShowTravelDetailsDesktopSidebar(isMobile, screenWidth);
  const showSkeletonOverlay = shouldShowTravelDetailsSkeletonOverlay(travel);

  const desktopLayoutStyle = useMemo(
    () => getTravelDetailsDesktopLayoutStyle(),
    []
  );

  const desktopSidebarContainerStyle = useMemo(
    () => getTravelDetailsDesktopSidebarContainerStyle(menuWidthNum),
    [menuWidthNum]
  );

  const desktopSidebarAnimatedStyle = useMemo(
    () => [
      styles.sideMenuBase,
      sideMenuPlatformStyles,
      {
        position: 'relative' as const,
        top: 0,
        maxHeight: 'none' as const,
        overflowY: 'visible' as const,
        transform: [{ translateX: animatedX }],
        width: '100%' as any,
        zIndex: 1000,
      },
    ],
    [styles.sideMenuBase, sideMenuPlatformStyles, animatedX]
  );

  const desktopContentColumnStyle = useMemo(
    () => getTravelDetailsDesktopContentColumnStyle(),
    []
  );

  return (
    <View
      testID="travel-details-page"
      {...(Platform.OS === 'web' ? ({ 'data-testid': 'travel-details-page' } as any) : null)}
      id="travel-main-content"
      role="main"
      aria-label={mainAriaLabel}
      style={wrapperStyle}
    >
      <SafeAreaView style={styles.safeArea}>
        <View style={[styles.mainContainer, isMobile && styles.mainContainerMobile]}>
          {showSkeletonOverlay && (
            <TravelDetailsSkeletonOverlay
              skeletonFallback={skeletonFallback}
              skeletonPhase={skeletonPhase}
              travelDetailSkeleton={travelDetailSkeleton}
            />
          )}

          <ScrollView
            testID="travel-details-scroll"
            {...(Platform.OS === 'web' ? ({ 'data-testid': 'travel-details-scroll' } as any) : null)}
            ref={scrollRef as any}
            contentContainerStyle={[styles.scrollContent]}
            keyboardShouldPersistTaps="handled"
            onScroll={scrollEventHandler}
            scrollEventThrottle={Platform.OS === 'web' ? 64 : 48}
            style={scrollViewStyle}
            nestedScrollEnabled
            onContentSizeChange={handleContentSizeChange}
            onLayout={handleLayout}
          >
            <View style={styles.contentOuter} collapsable={false}>
              <View
                style={[styles.contentWrapper, { paddingHorizontal: contentHorizontalPadding }]}
                collapsable={false}
              >
                {travel ? (
                  showDesktopSidebar ? (
                    <View style={desktopLayoutStyle} collapsable={false}>
                      <View style={desktopSidebarContainerStyle}>
                        <Animated.View
                          testID="travel-details-side-menu"
                          {...(Platform.OS === 'web' ? ({ 'data-testid': 'travel-details-side-menu' } as any) : null)}
                          style={desktopSidebarAnimatedStyle}
                        >
                          <CompactSideBarTravel
                            travel={travel}
                            isMobile={isMobile}
                            refs={anchors}
                            links={sectionLinks}
                            closeMenu={closeMenu}
                            onNavigate={onNavigate}
                            activeSection={activeSection ?? undefined}
                          />
                        </Animated.View>
                      </View>

                      <View style={desktopContentColumnStyle} collapsable={false}>
                        <TravelDetailsHeroDeferredColumn
                          travel={travel}
                          anchors={anchors}
                          isMobile={isMobile}
                          lcpLoaded={lcpLoaded}
                          onFirstImageLoad={onFirstImageLoad}
                          sectionLinks={sectionLinks}
                          onQuickJump={onQuickJump}
                          deferHeroExtras={deferHeroExtras}
                          deferredContent={deferredContent}
                        />
                      </View>
                    </View>
                  ) : (
                    <TravelDetailsHeroDeferredColumn
                      travel={travel}
                      anchors={anchors}
                      isMobile={isMobile}
                      lcpLoaded={lcpLoaded}
                      onFirstImageLoad={onFirstImageLoad}
                      sectionLinks={sectionLinks}
                      onQuickJump={onQuickJump}
                      deferHeroExtras={deferHeroExtras}
                      deferredContent={deferredContent}
                    />
                  )
                ) : (
                  <Suspense fallback={skeletonFallback}>{travelDetailSkeleton}</Suspense>
                )}
              </View>
            </View>
          </ScrollView>
        </View>
      </SafeAreaView>
    </View>
  );
}
