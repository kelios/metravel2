import { View, Text, TouchableOpacity, Platform } from 'react-native'
import type { SharedValue } from 'react-native-reanimated'
import Feather from '@expo/vector-icons/Feather'
import type { SliderImage } from './types'
import Arrow from './Arrow'
import Dot from './Dot'
import { translate as i18nT } from '@/i18n'


const isWeb = Platform.OS === 'web'

interface SliderOverlaysProps {
  images: SliderImage[]
  styles: Record<string, any>
  colors: { text: string; [k: string]: any }
  currentIndex: number
  containerW: number
  reduceMotion: boolean
  x: SharedValue<number>
  showArrows: boolean
  showDots: boolean
  hideArrowsOnMobile?: boolean
  isMobile: boolean
  isTablet: boolean
  insets: { left: number; right: number }
  navOffset: number
  dismissSwipeHint: () => void
  enablePrefetch: () => void
  goPrev: () => void
  goNext: () => void
}

function SliderOverlays({
  images,
  styles,
  colors,
  currentIndex,
  containerW,
  reduceMotion,
  x,
  showArrows,
  showDots,
  hideArrowsOnMobile,
  isMobile,
  isTablet,
  insets,
  navOffset,
  dismissSwipeHint,
  enablePrefetch,
  goPrev,
  goNext,
}: SliderOverlaysProps) {
  return (
    <>
      {/* Navigation arrows */}
      {showArrows && images.length > 1 && !(isMobile && hideArrowsOnMobile) && (
        <>
          {isWeb ? (
            // Web arrows (TouchableOpacity + Feather icon)
            <>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={i18nT('travel:components.travel.sliderParts.SliderOverlays.previous_slide_0743e7c4')}
                onPress={() => {
                  dismissSwipeHint()
                  enablePrefetch()
                  goPrev()
                }}
                activeOpacity={0.9}
                style={[styles.navBtn, { left: navOffset }]}
                {...({ className: 'slider-nav-btn' } as any)}
              >
                <View style={styles.arrowIconContainer}>
                  <Feather
                    name="chevron-left"
                    size={isMobile ? 16 : isTablet ? 18 : 20}
                    color="rgba(255,255,255,0.95)"
                    style={styles.arrowIcon}
                  />
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={i18nT('travel:components.travel.sliderParts.SliderOverlays.next_slide_1cfb465a')}
                onPress={() => {
                  dismissSwipeHint()
                  enablePrefetch()
                  goNext()
                }}
                activeOpacity={0.9}
                style={[styles.navBtn, { right: navOffset }]}
                {...({ className: 'slider-nav-btn' } as any)}
              >
                <View style={styles.arrowIconContainer}>
                  <Feather
                    name="chevron-right"
                    size={isMobile ? 16 : isTablet ? 18 : 20}
                    color="rgba(255,255,255,0.95)"
                    style={styles.arrowIcon}
                  />
                </View>
              </TouchableOpacity>
            </>
          ) : (
            // Native arrows (animated)
            <>
              <Arrow
                dir="left"
                onPress={() => {
                  dismissSwipeHint()
                  enablePrefetch()
                  goPrev()
                }}
                isMobile={isMobile}
                isTablet={isTablet}
                hideArrowsOnMobile={hideArrowsOnMobile}
                insets={insets}
                dismissSwipeHint={dismissSwipeHint}
                colors={colors}
                styles={styles}
              />
              <Arrow
                dir="right"
                onPress={() => {
                  dismissSwipeHint()
                  enablePrefetch()
                  goNext()
                }}
                isMobile={isMobile}
                isTablet={isTablet}
                hideArrowsOnMobile={hideArrowsOnMobile}
                insets={insets}
                dismissSwipeHint={dismissSwipeHint}
                colors={colors}
                styles={styles}
              />
            </>
          )}
        </>
      )}

      {/* Counter (Instagram-style 1/N) */}
      {images.length > 1 && (
        <View style={[styles.counter, isMobile && styles.counterMobile, { pointerEvents: 'none' }]}>
          <View style={styles.counterContainer}>
            <Text style={styles.counterText}>
              {currentIndex + 1}/{images.length}
            </Text>
          </View>
        </View>
      )}

      {/* Pagination dots */}
      {showDots && images.length > 1 && (
        <View style={[styles.dots, isMobile && styles.dotsMobile, { pointerEvents: 'none' }]}>
          <View style={styles.dotsContainer}>
            {isWeb ? (
              // Web: static dots
              images.map((_, i) => (
                <View
                  key={i}
                  style={[styles.dot, i === currentIndex && styles.dotActive]}
                />
              ))
            ) : (
              // Native: animated dots
              images.map((_, i) => (
                <View key={i} style={styles.dotWrap}>
                  <Dot
                    i={i}
                    x={x}
                    containerW={containerW}
                    total={images.length}
                    reduceMotion={reduceMotion}
                    dotStyle={styles.dot}
                  />
                </View>
              ))
            )}
          </View>
        </View>
      )}
    </>
  )
}

export default SliderOverlays
