import React, { useEffect, useMemo } from 'react';
import { Animated, Platform, ScrollView, View } from 'react-native';
import type {
  LayoutChangeEvent,
  ScrollViewProps,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import CompactSideBarTravel from '@/components/travel/CompactSideBarTravel';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { LAYOUT } from '@/constants/layout';
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
import TravelDetailsHeroDeferredColumn, {
  TravelDetailsContentBlock,
  TravelDetailsHeroBlock,
} from './TravelDetailsHeroDeferredColumn';
import TravelHeroStickyNavNative from './TravelHeroStickyNavNative';

// The travel name is the page's single semantic <h1>. On wider web layouts it
// is visible above the gallery so the first screen identifies the route; mobile
// keeps it sr-only because the compact app header already shows that context.
// The SSG step also injects its own sr-only `<h1 data-ssg-travel-h1>` plus a
// visible `.ssg-travel-h1` placeholder; both are torn down on mount (see effect
// below) so the hydrated page keeps exactly one heading.
// Sub-nav sits at index 1 of the native sticky ScrollView children
// (hero, sub-nav, content).
const STICKY_NAV_INDICES = [1];

// Serif — только desktop web; mobile web = системный sans, как на устройстве.
const MOBILE_WEB_SANS_FONT = {
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", system-ui, sans-serif',
} as const;

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
  wrapperStyle: StyleProp<ViewStyle>;
  // Shared travel-details StyleSheet object; typed loosely as it is threaded
  // untyped through the container/view-model layers.
  styles: any;
  skeletonPhase: 'loading' | 'fading' | 'hidden';
  skeletonFallback: React.ReactNode;
  scrollRef: React.RefObject<ScrollView | null>;
  scrollViewStyle: StyleProp<ViewStyle>;
  scrollEventHandler: ScrollViewProps['onScroll'];
  handleContentSizeChange: (width: number, height: number) => void;
  handleLayout: (event: LayoutChangeEvent) => void;
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
  sideMenuPlatformStyles: StyleProp<ViewStyle>;
  deferredContent: React.ReactNode;
  mainAriaLabel: string;
  topNotice?: React.ReactNode;
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
  topNotice,
}: TravelDetailsCriticalShellProps) {
  const insets = useSafeAreaInsetsSafe();

  // Drop the SSG-injected sr-only heading once the real React <h1> has mounted.
  // The visible `.ssg-travel-h1` belongs to the fixed SSG shell and must remain
  // until that shell is torn down; removing it early shifts the crawlable SSG
  // article underneath and is counted as CLS even while the overlay is visible.
  useEffect(() => {
    if (Platform.OS !== 'web' || !travel) return;
    const stale = document.querySelectorAll('h1[data-ssg-travel-h1]');
    stale.forEach((node) => node.parentNode?.removeChild(node));
  }, [travel]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const root = document.getElementById('root');
    if (!root) return;

    // The outer SSG shell cannot reliably observe Safari's replaced LCP image.
    // Signal only after React's own first-screen skeleton has lifted.
    if (travel && skeletonPhase !== 'loading') {
      root.setAttribute('data-travel-details-ready', 'true');
    } else {
      root.removeAttribute('data-travel-details-ready');
    }

    return () => {
      root.removeAttribute('data-travel-details-ready');
    };
  }, [skeletonPhase, travel]);

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
      // Web already reserves the bottom dock via `--mt-dock-h` in scrollContent;
      // only native needs an explicit reserve for safe-area + the sticky bar.
      isMobile && Platform.OS !== 'web'
        ? {
            paddingBottom: Math.max(
              DESIGN_TOKENS.spacing.xxl,
              (insets.bottom || 0) + (LAYOUT?.tabBarHeight ?? 56) + 132,
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
    () => [
      styles.contentWrapper,
      { paddingHorizontal: contentHorizontalPadding },
      Platform.OS === 'web' && isMobile ? (MOBILE_WEB_SANS_FONT as any) : null,
    ],
    [styles.contentWrapper, contentHorizontalPadding, isMobile]
  );

  // Native (iOS/Android) has no `position: sticky`; the sub-nav is pinned via the
  // ScrollView's `stickyHeaderIndices`, which only works on a DIRECT child. On
  // mobile-native single-column layout we therefore hoist the sub-nav out of the
  // hero and render hero / sticky-nav / content as three direct ScrollView
  // children. Web and desktop keep the existing nested CSS-sticky column (#341).
  const useNativeStickyNav =
    !!travel && isMobile && Platform.OS !== 'web' && !showDesktopSidebar;

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

  const pageTitle = Platform.OS === 'web' && travel ? (
    <h1
      data-testid="travel-details-title"
      style={(
        isMobile
          ? WEB_SR_ONLY_HEADING_STYLE
          : {
              ...styles.pageTitle,
              // React DOM treats numeric lineHeight as a unitless multiplier;
              // RN tokens express it in pixels, so preserve that contract.
              lineHeight: `${DESIGN_TOKENS.typography.scale.h1.lineHeight}px`,
            }
      ) as any}
    >
      {travel.name}
    </h1>
  ) : null;

  const nativeStickyChildren =
    useNativeStickyNav && travel
      ? [
          <View key="hero" style={contentWrapperStyle} collapsable={false}>
            {topNotice}
            <TravelDetailsHeroBlock
              travel={travel}
              anchors={anchors}
              isMobile={isMobile}
              deferHeroExtras={deferHeroExtras}
              onFirstImageLoad={onFirstImageLoad}
              onQuickJump={onQuickJump}
              sectionLinks={sectionLinks}
              activeKey={activeSection ?? undefined}
              suppressHeroQuickJumps
            />
          </View>,
          <TravelHeroStickyNavNative
            key="sticky-nav"
            sectionLinks={sectionLinks}
            onQuickJump={onQuickJump}
            contentHorizontalPadding={contentHorizontalPadding}
            activeKey={activeSection ?? undefined}
          />,
          <View key="content" style={contentWrapperStyle} collapsable={false}>
            <TravelDetailsContentBlock
              travel={travel}
              isMobile={isMobile}
              anchors={anchors}
              forceOpenKey={forceOpenKey}
            />
            {deferredContent}
          </View>,
        ]
      : null;

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
            stickyHeaderIndices={useNativeStickyNav ? STICKY_NAV_INDICES : undefined}
            onContentSizeChange={handleContentSizeChange}
            onLayout={handleLayout}
          >
            {useNativeStickyNav ? (
              nativeStickyChildren
            ) : (
              <View style={styles.contentOuter} collapsable={false}>
                <View
                  style={contentWrapperStyle}
                  collapsable={false}
                >
                  {topNotice}
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
                        {pageTitle}
                        {contentColumn}
                      </View>
                    </View>
                  ) : travel ? (
                    <>
                      {pageTitle}
                      {contentColumn}
                    </>
                  ) : null}
                </View>
              </View>
            )}
          </ScrollView>
        </View>
      </SafeAreaView>
    </View>
  );
}
