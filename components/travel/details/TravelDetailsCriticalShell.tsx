import React, { Suspense, useMemo } from 'react';
import { Animated, Platform, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DESIGN_TOKENS } from '@/constants/designSystem';
import { METRICS } from '@/constants/layout';
import CompactSideBarTravel from '@/components/travel/CompactSideBarTravel';
import type { Travel } from '@/types/types';
import type { TravelSectionLink } from '@/components/travel/sectionLinks';

import { TravelHeroSection } from './TravelDetailsSections';
import type { AnchorsMap } from './TravelDetailsTypes';

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
  const showDesktopSidebar = !isMobile && screenWidth >= METRICS.breakpoints.largeTablet;
  const showSkeletonOverlay = Platform.OS === 'web' && Boolean(travel);

  const desktopLayoutStyle = useMemo(
    () => ({
      width: '100%' as const,
      flexDirection: 'row' as const,
      alignItems: 'flex-start' as const,
      gap: DESIGN_TOKENS.spacing.lg,
    }),
    []
  );

  const desktopSidebarContainerStyle = useMemo(
    () => ({
      width: menuWidthNum,
      flexShrink: 0,
      position: 'sticky' as const,
      top: 0,
      alignSelf: 'flex-start' as const,
      maxHeight: '100vh',
      overflowY: 'auto' as const,
      overflowX: 'hidden' as const,
    }),
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
    () => ({
      flex: 1,
      minWidth: 0,
    }),
    []
  );

  return (
    <View
      testID="travel-details-page"
      id="travel-main-content"
      role="main"
      aria-label={mainAriaLabel}
      style={wrapperStyle}
    >
      <SafeAreaView style={styles.safeArea}>
        <View style={[styles.mainContainer, isMobile && styles.mainContainerMobile]}>
          {showSkeletonOverlay && (
            <View
              testID="travel-details-skeleton-overlay"
              collapsable={false}
              style={{
                position: 'absolute',
                inset: 0,
                zIndex: skeletonPhase === 'hidden' ? -1 : 50,
                opacity: skeletonPhase === 'loading' ? 1 : 0,
                visibility: skeletonPhase === 'hidden' ? 'hidden' : 'visible',
                transition: 'opacity 200ms ease-out',
                contain: 'strict',
                pointerEvents: 'none',
              } as any}
              aria-hidden={skeletonPhase !== 'loading'}
            >
              {skeletonPhase !== 'hidden' && (
                <Suspense fallback={skeletonFallback}>{travelDetailSkeleton}</Suspense>
              )}
            </View>
          )}

          <ScrollView
            testID="travel-details-scroll"
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
                          style={desktopSidebarAnimatedStyle}
                        >
                          <CompactSideBarTravel
                            travel={travel}
                            isMobile={isMobile}
                            refs={anchors}
                            links={sectionLinks}
                            closeMenu={closeMenu}
                            onNavigate={onNavigate}
                            activeSection={activeSection}
                          />
                        </Animated.View>
                      </View>

                      <View style={desktopContentColumnStyle} collapsable={false}>
                        <View collapsable={false}>
                          <TravelHeroSection
                            travel={travel}
                            anchors={anchors}
                            isMobile={isMobile}
                            renderSlider={Platform.OS !== 'web' ? true : lcpLoaded}
                            onFirstImageLoad={onFirstImageLoad}
                            sectionLinks={sectionLinks}
                            onQuickJump={onQuickJump}
                            deferExtras={deferHeroExtras}
                          />
                        </View>

                        {deferredContent}
                      </View>
                    </View>
                  ) : (
                    <>
                      <View collapsable={false}>
                        <TravelHeroSection
                          travel={travel}
                          anchors={anchors}
                          isMobile={isMobile}
                          renderSlider={Platform.OS !== 'web' ? true : lcpLoaded}
                          onFirstImageLoad={onFirstImageLoad}
                          sectionLinks={sectionLinks}
                          onQuickJump={onQuickJump}
                          deferExtras={deferHeroExtras}
                        />
                      </View>

                      {deferredContent}
                    </>
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
