import React, { Suspense } from 'react';
import { Platform, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { Travel } from '@/types/types';
import type { TravelSectionLink } from '@/components/travel/sectionLinks';

import { TravelHeroSection } from './TravelDetailsSections';
import type { AnchorsMap } from './TravelDetailsTypes';

type TravelDetailsCriticalShellProps = {
  travel?: Travel;
  isMobile: boolean;
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
  deferredContent: React.ReactNode;
  mainAriaLabel: string;
};

export default function TravelDetailsCriticalShell({
  travel,
  isMobile,
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
  sliderReady,
  lcpLoaded,
  onFirstImageLoad,
  sectionLinks,
  onQuickJump,
  deferHeroExtras,
  deferredContent,
  mainAriaLabel,
}: TravelDetailsCriticalShellProps) {
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
          {Platform.OS === 'web' && (
            <View
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
                  <>
                    <View collapsable={false}>
                      <TravelHeroSection
                        travel={travel}
                        anchors={anchors}
                        isMobile={isMobile}
                        renderSlider={Platform.OS !== 'web' ? true : sliderReady && lcpLoaded}
                        onFirstImageLoad={onFirstImageLoad}
                        sectionLinks={sectionLinks}
                        onQuickJump={onQuickJump}
                        deferExtras={deferHeroExtras}
                      />
                    </View>

                    {deferredContent}
                  </>
                ) : (
                  <View />
                )}
              </View>
            </View>
          </ScrollView>
        </View>
      </SafeAreaView>
    </View>
  );
}
