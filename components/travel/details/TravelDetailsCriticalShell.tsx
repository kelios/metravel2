import React, { Suspense, useEffect, useLayoutEffect, useMemo } from 'react';
import { Animated, Platform, ScrollView, View } from 'react-native';
import type {
  LayoutChangeEvent,
  ScrollViewProps,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { lazyWithRetry } from '@/utils/chunkReload';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { LAYOUT } from '@/constants/layout';
import { useSafeAreaInsetsSafe } from '@/hooks/useSafeAreaInsetsSafe';
import { useThemedColors } from '@/hooks/useTheme';
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

// The travel name is the page's single semantic <h1>. It follows the hero and
// its metadata, matching the SSG article order without inserting a new block
// above the gallery.
// The current SSG shell starts with a visible `.ssg-travel-h1`; on hydration it
// is demoted to a same-class div until shell teardown. Legacy cached pages may
// also carry `<h1 data-ssg-travel-h1>`, which the same effect removes.
// Sub-nav sits at index 1 of the native sticky ScrollView children
// (hero, sub-nav, content).
const STICKY_NAV_INDICES = [1];

// Desktop-only left sidebar. It renders solely when width resolves to a desktop
// breakpoint (shouldShowTravelDetailsDesktopSidebar); the hydration-safe
// useResponsive reports width=0 on SSR + first client render, so isMobile=true
// and the sidebar is never on the synchronous first-paint path on any platform.
// Loading it lazily therefore keeps its subtree (author/weather widgets, route
// GPX/KML download utils) out of the eager travel-route chunk without changing
// first-screen output; the fixed-width column below reserves its space so the
// Suspense fallback introduces no CLS.
const CompactSideBarTravelLazy = lazyWithRetry(
  () => import('@/components/travel/CompactSideBarTravel'),
  { name: 'CompactSideBarTravel' },
);

// Serif — только desktop web; mobile web = системный sans, как на устройстве.
const MOBILE_WEB_SANS_FONT = {
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", system-ui, sans-serif',
} as const;

const TRAVEL_HEADING_WEB_FONT_FAMILY =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

const WEB_VISIBLE_HEADING_STYLE = {
  // Exact parity with `.ssg-travel-h1` avoids a handoff shift at shell teardown.
  margin: '0 0 14px',
  fontFamily: TRAVEL_HEADING_WEB_FONT_FAMILY,
  fontWeight: '700',
  lineHeight: 1.25,
  letterSpacing: '-0.02em',
  maxWidth: 760,
} as const;

const useWebLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

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
  nativeScrollDepthHandler?: ScrollViewProps['onMomentumScrollEnd'];
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
  nativeScrollDepthHandler,
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
  const colors = useThemedColors();

  // Drop legacy sr-only headings once the real React H1 has mounted. The current
  // SSG title is a visible normal-flow H1, so demote it to a same-class div
  // until shell teardown: this preserves geometry without leaving two H1s in
  // the hydrated DOM.
  useWebLayoutEffect(() => {
    if (Platform.OS !== 'web' || !travel) return;
    const stale = document.querySelectorAll('h1[data-ssg-travel-h1]');
    stale.forEach((node) => node.parentNode?.removeChild(node));

    document.querySelectorAll('#ssg-skeleton h1.ssg-travel-h1').forEach((node) => {
      const placeholder = document.createElement('div');
      placeholder.className = node.className;
      placeholder.textContent = node.textContent;
      node.parentNode?.replaceChild(placeholder, node);
    });
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

  const pageTitle = Platform.OS === 'web' && travel ? (
    <h1
      data-testid="travel-details-title"
      style={{
        ...WEB_VISIBLE_HEADING_STYLE,
        color: colors.text,
        fontSize: isMobile ? 28 : 34,
      } as any}
    >
      {travel.name}
    </h1>
  ) : null;

  const contentColumn = travel ? (
    Platform.OS === 'web' ? (
      <>
        <TravelDetailsHeroBlock
          travel={travel}
          anchors={anchors}
          isMobile={isMobile}
          deferHeroExtras={deferHeroExtras}
          onFirstImageLoad={onFirstImageLoad}
          onQuickJump={onQuickJump}
          sectionLinks={sectionLinks}
          activeKey={activeSection ?? undefined}
        />
        {pageTitle}
        <TravelDetailsContentBlock
          travel={travel}
          isMobile={isMobile}
          anchors={anchors}
          forceOpenKey={forceOpenKey}
        />
        {deferredContent}
      </>
    ) : (
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
    )
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

          <Animated.ScrollView
            testID="travel-details-scroll"
            {...(Platform.OS === 'web' ? ({ 'data-testid': 'travel-details-scroll' } as any) : null)}
            ref={scrollRef as any}
            contentContainerStyle={scrollContentStyle}
            keyboardShouldPersistTaps="handled"
            onScroll={scrollEventHandler}
            onScrollEndDrag={nativeScrollDepthHandler}
            onMomentumScrollEnd={nativeScrollDepthHandler}
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
                          <Suspense fallback={null}>
                            <CompactSideBarTravelLazy
                              travel={travel}
                              isMobile={isMobile}
                              refs={anchors}
                              links={sectionLinks}
                              closeMenu={closeMenu}
                              onNavigate={onNavigate}
                              activeSection={activeSection ?? undefined}
                            />
                          </Suspense>
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
            )}
          </Animated.ScrollView>
        </View>
      </SafeAreaView>
    </View>
  );
}
