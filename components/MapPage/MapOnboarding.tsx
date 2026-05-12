import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import Feather from '@expo/vector-icons/Feather'
import type { ComponentProps } from 'react'

import { useThemedColors, type ThemedColors } from '@/hooks/useTheme'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import Button from '@/components/ui/Button'

type FeatherIconName = ComponentProps<typeof Feather>['name']

const IS_WEB = Platform.OS === 'web'
const ONBOARDING_STORAGE_KEY = 'metravel_map_onboarding_completed'
const ONBOARDING_DELAY_MS = 800
const TOOLTIP_GAP_PX = 12
const FALLBACK_VIEWPORT_WIDTH = 800
const FALLBACK_VIEWPORT_HEIGHT = 600
const TOOLTIP_MAX_WIDTH = 320
const TOOLTIP_LEFT_MIN = 8
const MOBILE_WEB_ONBOARDING_MAX_WIDTH = 767

let _restartCb: (() => void) | null = null

function ignoreOnboardingStorageError() {
  return
}

/** Call from settings / menu to re-show the onboarding tour. */
export function restartMapOnboarding(): void {
  if (IS_WEB && typeof localStorage !== 'undefined') {
    try {
      localStorage.removeItem(ONBOARDING_STORAGE_KEY)
    } catch {
      ignoreOnboardingStorageError()
    }
  }
  _restartCb?.()
}

function getViewportWidth() {
  return typeof window !== 'undefined' ? window.innerWidth : FALLBACK_VIEWPORT_WIDTH
}

function getViewportHeight() {
  return typeof window !== 'undefined' ? window.innerHeight : FALLBACK_VIEWPORT_HEIGHT
}

async function loadOnboardingCompleted(): Promise<boolean> {
  try {
    if (IS_WEB) {
      if (typeof localStorage === 'undefined') return false
      return localStorage.getItem(ONBOARDING_STORAGE_KEY) === 'true'
    }
    const v = await AsyncStorage.getItem(ONBOARDING_STORAGE_KEY)
    return !!v
  } catch {
    return false
  }
}

function isMobileWebViewport() {
  if (!IS_WEB || typeof window === 'undefined') return false
  if (typeof window.matchMedia === 'function') {
    return window.matchMedia(`(max-width: ${MOBILE_WEB_ONBOARDING_MAX_WIDTH}px)`).matches
  }
  const documentWidth =
    typeof document !== 'undefined' ? document.documentElement?.clientWidth ?? 0 : 0
  return Math.min(getViewportWidth(), documentWidth || Number.MAX_SAFE_INTEGER) <= MOBILE_WEB_ONBOARDING_MAX_WIDTH
}

function saveOnboardingCompleted() {
  try {
    if (IS_WEB) {
      localStorage.setItem(ONBOARDING_STORAGE_KEY, 'true')
    } else {
      void AsyncStorage.setItem(ONBOARDING_STORAGE_KEY, 'true')
    }
  } catch {
    ignoreOnboardingStorageError()
  }
}

type TooltipPosition = 'bottom' | 'top' | 'left' | 'right'

interface OnboardingStep {
  title: string
  description: string
  icon: FeatherIconName
  targetTestID?: string
  placement: TooltipPosition
}

const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    title: 'Карта путешествий',
    description:
      'Здесь отображаются интересные места и маршруты от других путешественников. Перемещайте и масштабируйте карту.',
    icon: 'map',
    targetTestID: 'map-panel',
    placement: 'bottom',
  },
  {
    title: 'Настройте фильтры',
    description: 'Используйте фильтры по категориям и радиусу, чтобы найти подходящие места.',
    icon: 'filter',
    targetTestID: 'map-panel-tab-filters',
    placement: 'bottom',
  },
  {
    title: 'Список мест',
    description:
      'Переключитесь на вкладку «Список», чтобы увидеть все найденные места с расстояниями.',
    icon: 'list',
    targetTestID: 'map-panel-tab-travels',
    placement: 'bottom',
  },
  {
    title: 'Стройте маршруты',
    description:
      'Переключитесь в режим маршрута, чтобы проложить путь между точками на карте.',
    icon: 'navigation',
    targetTestID: 'filters-panel-header',
    placement: 'bottom',
  },
]

const MOBILE_WEB_ONBOARDING_STEPS: OnboardingStep[] = [
  {
    title: 'С чего начать',
    description:
      'Нажмите «Найти места рядом», чтобы сразу получить подборку ближайших мест. После этого можно уточнить радиус и категории в панели поиска.',
    icon: 'search',
    targetTestID: 'map-mobile-find-nearby',
    placement: 'bottom',
  },
]

interface Rect {
  top: number
  left: number
  width: number
  height: number
}

function getTargetRect(testID: string | undefined): Rect | null {
  if (!IS_WEB || !testID || typeof document === 'undefined') return null
  const el = document.querySelector(`[data-testid="${testID}"]`)
  if (!el) return null
  const r = el.getBoundingClientRect()
  return { top: r.top, left: r.left, width: r.width, height: r.height }
}

function tooltipPosition(
  rect: Rect | null,
  placement: TooltipPosition,
): { top?: number; left?: number; bottom?: number; right?: number } {
  if (!rect) return {}
  switch (placement) {
    case 'bottom':
      return {
        top: rect.top + rect.height + TOOLTIP_GAP_PX,
        left: Math.max(
          TOOLTIP_LEFT_MIN,
          Math.min(rect.left, getViewportWidth() - TOOLTIP_MAX_WIDTH),
        ),
      }
    case 'top':
      return {
        bottom: getViewportHeight() - rect.top + TOOLTIP_GAP_PX,
        left: Math.max(TOOLTIP_LEFT_MIN, rect.left),
      }
    case 'left':
      return {
        top: rect.top,
        right: getViewportWidth() - rect.left + TOOLTIP_GAP_PX,
      }
    case 'right':
      return { top: rect.top, left: rect.left + rect.width + TOOLTIP_GAP_PX }
    default:
      return {}
  }
}

interface MapOnboardingProps {
  onComplete?: () => void
  mobileWebCoachmark?: boolean
}

export const MapOnboarding: React.FC<MapOnboardingProps> = ({
  onComplete,
  mobileWebCoachmark: mobileWebCoachmarkProp,
}) => {
  const colors = useThemedColors()
  const styles = useMemo(() => getStyles(colors), [colors])
  const [mobileWebCoachmark] = useState(
    () => mobileWebCoachmarkProp ?? isMobileWebViewport(),
  )
  const steps = useMemo(
    () => (mobileWebCoachmark ? MOBILE_WEB_ONBOARDING_STEPS : ONBOARDING_STEPS),
    [mobileWebCoachmark],
  )
  const [currentStep, setCurrentStep] = useState(0)
  const [visible, setVisible] = useState(false)
  const [targetRect, setTargetRect] = useState<Rect | null>(null)
  const rafRef = useRef(0)
  const openTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Register restart callback
  useEffect(() => {
    _restartCb = () => {
      setCurrentStep(0)
      setVisible(true)
    }
    return () => {
      _restartCb = null
    }
  }, [])

  // Auto-show on first visit for native and mobile web; desktop web stays manual.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const completed = await loadOnboardingCompleted()
      if (cancelled || completed) return
      if (IS_WEB && !mobileWebCoachmark) return
      openTimerRef.current = setTimeout(() => {
        if (!cancelled) setVisible(true)
      }, ONBOARDING_DELAY_MS)
    })()
    return () => {
      cancelled = true
      if (openTimerRef.current) {
        clearTimeout(openTimerRef.current)
        openTimerRef.current = null
      }
    }
  }, [mobileWebCoachmark])

  // Re-measure target when step changes
  useEffect(() => {
    if (!visible) return
    const measure = () => {
      const step = steps[currentStep]
      setTargetRect(getTargetRect(step?.targetTestID))
    }
    rafRef.current = requestAnimationFrame(measure)
    return () => cancelAnimationFrame(rafRef.current)
  }, [visible, currentStep, steps])

  const handleComplete = useCallback(() => {
    saveOnboardingCompleted()
    setVisible(false)
    onComplete?.()
  }, [onComplete])

  const handleNext = useCallback(() => {
    if (currentStep < steps.length - 1) {
      setCurrentStep((prev) => prev + 1)
    } else {
      handleComplete()
    }
  }, [currentStep, handleComplete, steps.length])

  if (!visible) return null

  const step = steps[currentStep]
  const isLastStep = currentStep === steps.length - 1
  const pos = tooltipPosition(targetRect, step.placement)

  return (
    <View style={[styles.overlay, { pointerEvents: 'auto' }]}>
      <Pressable
        style={styles.backdrop}
        onPress={handleComplete}
        accessibilityRole="button"
        accessibilityLabel="Закрыть подсказку"
        testID="onboarding-backdrop"
      />

      {targetRect && IS_WEB && (
        <View
          style={[
            styles.spotlight,
            {
              top: targetRect.top - 4,
              left: targetRect.left - 4,
              width: targetRect.width + 8,
              height: targetRect.height + 8,
              pointerEvents: 'none',
            },
          ]}
        />
      )}

      <View
        style={[styles.card, targetRect ? ({ position: 'absolute', ...pos } as any) : null]}
      >
        {targetRect && step.placement === 'bottom' && <View style={styles.arrowUp} />}

        <View style={styles.cardHeader}>
          <View style={styles.iconCircle}>
            <Feather name={step.icon} size={20} color={colors.primary} />
          </View>
          <Text style={styles.title}>{step.title}</Text>
        </View>

        <Text style={styles.description}>{step.description}</Text>

        <View style={styles.footer}>
          <View style={styles.stepsIndicator}>
            {steps.map((_, index) => (
              <View
                key={index}
                style={[styles.stepDot, index === currentStep && styles.stepDotActive]}
              />
            ))}
          </View>

          <View style={styles.actions}>
            <Button
              label="Пропустить"
              onPress={handleComplete}
              variant="ghost"
              size="sm"
              testID="onboarding-skip"
            />
            <Button
              label={isLastStep ? 'Готово' : 'Далее'}
              onPress={handleNext}
              variant="primary"
              size="sm"
              testID="onboarding-next"
            />
          </View>
        </View>
      </View>
    </View>
  )
}

const getStyles = (colors: ThemedColors) =>
  StyleSheet.create({
    overlay: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 10000,
      justifyContent: 'center',
      alignItems: 'center',
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0, 0, 0, 0.45)',
    },
    spotlight: {
      position: 'absolute',
      borderRadius: 8,
      borderWidth: 2,
      borderColor: colors.primary,
      backgroundColor: 'transparent',
      zIndex: 10001,
      ...(IS_WEB ? ({ boxShadow: '0 0 0 9999px rgba(0,0,0,0.45)' } as any) : null),
    },
    arrowUp: {
      position: 'absolute',
      top: -8,
      left: 24,
      width: 0,
      height: 0,
      borderLeftWidth: 8,
      borderRightWidth: 8,
      borderBottomWidth: 8,
      borderLeftColor: 'transparent',
      borderRightColor: 'transparent',
      borderBottomColor: colors.surface,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: DESIGN_TOKENS.radii.lg,
      padding: 16,
      maxWidth: 340,
      width: '90%',
      zIndex: 10002,
      ...(IS_WEB
        ? ({ boxShadow: colors.boxShadows.heavy } as any)
        : { ...colors.shadows.heavy, elevation: 8 }),
    },
    cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
    iconCircle: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.primaryLight,
      justifyContent: 'center',
      alignItems: 'center',
    },
    title: { fontSize: 16, fontWeight: '700', color: colors.text, flex: 1 },
    description: { fontSize: 14, lineHeight: 20, color: colors.textMuted, marginBottom: 12 },
    footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    stepsIndicator: { flexDirection: 'row', gap: 4 },
    stepDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.border },
    stepDotActive: { backgroundColor: colors.primary, width: 16 },
    actions: { flexDirection: 'row', gap: 8 },
  })

export default React.memo(MapOnboarding)
