import React, { useMemo } from 'react';
import { Animated, Platform, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import CompactSideBarTravel from '@/components/travel/CompactSideBarTravel';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useSafeAreaInsetsSafe } from '@/hooks/useSafeAreaInsetsSafe';
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

const WEB_SR_ONLY_HEADING_STYLE = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0,0,0,0)',
  whiteSpace: 'nowrap',
  borderWidth: 0,
} as const;

type TravelDetailsCriticalShellProps = {
  travel?: Travel;
  isMobile: boolean;
  screenWidth: number;
  wrapperStyle: any;
  styles: any;
  skeletonPhase: 'loading' | 'fading' | 'hidden';
  skeletonFallback: React.ReactNode;
  scrollRef: React.RefObject<any>;
  scrollViewStyle: any;
  scrollEventHandler: any;
  handleContentSizeChange: (...args: any[]) => void;
  handleLayout: (...args: any[]) => void;
  contentHorizontalPadding: number;
  anchors: AnchorsMap;
  onFirstImageLoad: () => void;
  sectionLinks: TravelSectionLink[];
  onQuickJump: (key: string) => void;
  deferHeroExtras: boolean;
  forceOpenKey: string | null;
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
  scrollRef,
  scrollViewStyle,
  scrollEventHandler,
  handleContentSizeChange,
  handleLayout,
  contentHorizontalPadding,
  anchors,
  onFirstImageLoad,
  sectionLinks,
  onQuickJump,
  deferHeroExtras,
  forceOpenKey,
  activeSection,
  closeMenu,
  onNavigate,
  menuWidthNum,
  animatedX,
  sideMenuPlatformStyles,
  deferredContent,
  mainAriaLabel,
}: TravelDetailsCriticalShellProps) {
  const insets = useSafeAreaInsetsSafe();
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
        flex: 1,
        minHeight: 0,
        maxHeight: 'inherit' as const,
        overflowY: 'hidden' as const,
        overflowX: 'hidden' as const,
        display: 'flex' as const,
        flexDirection: 'column' as const,
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

  const scrollContentStyle = useMemo(
    () => [
      styles.scrollContent,
      isMobile
        ? {
            paddingBottom: Math.max(
              DESIGN_TOKENS.spacing.xxl,
              (insets.bottom || 0) + 112,
            ),
          }
        : null,
    ],
    [styles.scrollContent, isMobile, insets.bottom]
  );

  const mainContainerStyle = useMemo(
    () => [styles.mainContainer, isMobile && styles.mainContainerMobile],
    [styles.mainContainer, styles.mainContainerMobile, isMobile]
  );

  const contentWrapperStyle = useMemo(
    () => [styles.contentWrapper, { paddingHorizontal: contentHorizontalPadding }],
    [styles.contentWrapper, contentHorizontalPadding]
  );

  const contentColumn = travel ? (
    <TravelDetailsHeroDeferredColumn
      travel={travel}
      anchors={anchors}
      isMobile={isMobile}
      onFirstImageLoad={onFirstImageLoad}
      sectionLinks={sectionLinks}
      onQuickJump={onQuickJump}
      deferHeroExtras={deferHeroExtras}
      forceOpenKey={forceOpenKey}
      deferredContent={deferredContent}
      activeKey={activeSection ?? undefined}
    />
  ) : null;

  return (
    <View
      testID="travel-details-page"
      {...(Platform.OS === 'web' ? ({ 'data-testid': 'travel-details-page' } as any) : null)}
      id="travel-main-content"
      role="main"
      aria-label={mainAriaLabel}
      style={wrapperStyle}
    >
      <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
        <View style={mainContainerStyle}>
          {showSkeletonOverlay && (
            <TravelDetailsSkeletonOverlay
              skeletonFallback={skeletonFallback}
              skeletonPhase={skeletonPhase}
            />
          )}

          <ScrollView
            testID="travel-details-scroll"
            {...(Platform.OS === 'web' ? ({ 'data-testid': 'travel-details-scroll' } as any) : null)}
            ref={scrollRef as any}
            contentContainerStyle={scrollContentStyle}
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
                style={contentWrapperStyle}
                collapsable={false}
              >
                {Platform.OS === 'web' && travel ? (
                  <h1 style={WEB_SR_ONLY_HEADING_STYLE as any}>{travel.name}</h1>
                ) : null}
                {travel && showDesktopSidebar ? (
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
                      {contentColumn}
                    </View>
                  </View>
                ) : travel ? (
                  contentColumn
                ) : null}
              </View>
            </View>
          </ScrollView>
        </View>
      </SafeAreaView>
    </View>
  );
}
