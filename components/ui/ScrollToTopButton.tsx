// Кнопка "Наверх" с анимацией и прогресс-баром
import React, { useState, useEffect, useMemo, useRef } from 'react'
import { Pressable, StyleSheet, Animated, Platform } from 'react-native'
import Feather from '@expo/vector-icons/Feather'
import { useThemedColors } from '@/hooks/useTheme'
import { useBreakpoints } from '@/hooks/useResponsive'
import { globalFocusStyles } from '@/styles/globalFocus'
import { translate as i18nT } from '@/i18n'
 // ✅ ИСПРАВЛЕНИЕ: Импорт focus-стилей

interface ScrollToTopButtonProps {
  scrollViewRef?: React.RefObject<any>
  flatListRef?: React.RefObject<any>
  scrollY?: Animated.Value
  threshold?: number
  forceVisible?: boolean
  // Extra space added to the bottom offset so the button can clear an overlay
  // (e.g. the travel-details sticky action bar). Defaults to 0 — no change elsewhere.
  bottomOffset?: number
}

function ScrollToTopButton({
  scrollViewRef,
  flatListRef,
  scrollY,
  threshold = 300,
  forceVisible,
  bottomOffset = 0,
}: ScrollToTopButtonProps) {
  const colors = useThemedColors()
  const { isPhone, isLargePhone } = useBreakpoints()
  const isMobile = isPhone || isLargePhone
  const shouldUseNativeDriver = false
  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          position: Platform.OS === 'web' ? ('fixed' as any) : 'absolute',
          bottom: (Platform.select({ web: 96, default: 80 }) ?? 80) + bottomOffset,
          // Парити mobile web ↔ Android: на телефоне обе платформы 16px от края;
          // десктоп-web сохраняет более широкий отступ.
          right: isMobile ? 16 : 24,
          zIndex: 1000,
        },
        button: {
          width: 48,
          height: 48,
          minWidth: 48, // ✅ ИСПРАВЛЕНИЕ: Минимальная ширина для touch-целей
          minHeight: 48, // ✅ ИСПРАВЛЕНИЕ: Минимальная высота для touch-целей
          borderRadius: 999,
          justifyContent: 'center',
          alignItems: 'center',
          ...(Platform.OS === 'web'
            ? ({
                boxShadow: colors.boxShadows.medium,
                transition: 'all 0.2s ease',
                // @ts-ignore -- CSS pseudo-selector :hover is web-only, not in RN style types
                ':hover': {
                  backgroundColor: colors.primaryDark, // Темнее primary для hover
                  transform: 'translateY(-2px) scale(1.05)',
                },
              } as any)
            : Platform.OS === 'android'
              ? { elevation: 4 }
              : colors.shadows.medium),
        },
      }),
    [colors, bottomOffset, isMobile],
  )
  const [isVisible, setIsVisible] = useState(false)
  const fadeAnim = useRef(new Animated.Value(0)).current
  const scaleAnim = useRef(new Animated.Value(0.8)).current
  const lastScrollValue = useRef(0)
  const isVisibleRef = useRef(false)

  useEffect(() => {
    isVisibleRef.current = isVisible
  }, [isVisible])

  useEffect(() => {
    if (typeof forceVisible === 'boolean') {
      setIsVisible(forceVisible)
      return
    }

    if (!scrollY) return

    const listener = scrollY.addListener(({ value }) => {
      if (Math.abs(value - lastScrollValue.current) < 5) {
        return
      }

      lastScrollValue.current = value
      const nextVisible = value > threshold

      if (nextVisible !== isVisibleRef.current) {
        setIsVisible(nextVisible)
      }
    })

    return () => {
      scrollY.removeListener(listener)
    }
  }, [forceVisible, scrollY, threshold])

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: isVisible ? 1 : 0,
        duration: 200,
        useNativeDriver: shouldUseNativeDriver,
      }),
      Animated.spring(scaleAnim, {
        toValue: isVisible ? 1 : 0.8,
        useNativeDriver: shouldUseNativeDriver,
        tension: 100,
        friction: 8,
      }),
    ]).start()
  }, [fadeAnim, isVisible, scaleAnim, shouldUseNativeDriver])

  const scrollToTop = () => {
    if (scrollViewRef?.current) {
      scrollViewRef.current.scrollTo({ y: 0, animated: true })
    } else if (flatListRef?.current) {
      // ✅ УЛУЧШЕНИЕ: Улучшенная прокрутка для FlatList
      try {
        flatListRef.current.scrollToOffset({ offset: 0, animated: true })
      } catch {
        // Fallback для веб-версии
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          window.scrollTo({ top: 0, behavior: 'smooth' })
        }
      }
    } else if (Platform.OS === 'web' && typeof window !== 'undefined') {
      // Fallback для веб-версии без ref
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  if (!isVisible) return null

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: fadeAnim,
          transform: [{ scale: scaleAnim }],
        },
      ]}
    >
      <Pressable
        style={[
          styles.button,
          globalFocusStyles.focusable,
          { backgroundColor: colors.primary },
        ]} // ✅ Динамический цвет
        onPress={scrollToTop}
        accessibilityRole="button"
        accessibilityLabel={i18nT('shared:components.ui.ScrollToTopButton.prokrutit_naverh_e45f94ac')}
        accessibilityHint={i18nT('shared:components.ui.ScrollToTopButton.prokruchivaet_stranitsu_k_nachalu_9999e79e')}
        {...Platform.select({
          web: {
            cursor: 'pointer',
            // @ts-ignore -- aria-label is a web-only ARIA attribute not in RN Pressable types
            'aria-label': i18nT('shared:components.ui.ScrollToTopButton.prokrutit_naverh_e45f94ac'),
            // @ts-ignore -- tabIndex is a web-only attribute not in RN Pressable types
            tabIndex: 0,
          },
        })}
        testID="scroll-to-top-button"
      >
        <Feather name="arrow-up" size={20} color={colors.textOnPrimary} />
      </Pressable>
    </Animated.View>
  )
}

export default React.memo(ScrollToTopButton)
