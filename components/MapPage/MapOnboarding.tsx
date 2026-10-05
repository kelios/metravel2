import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DeviceEventEmitter, Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import Feather from '@expo/vector-icons/Feather'
import type { ComponentProps } from 'react'

import { useThemedColors, type ThemedColors } from '@/hooks/useTheme'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import Button from '@/components/ui/Button'
import { translate as i18nT } from '@/i18n'


type FeatherIconName = ComponentProps<typeof Feather>['name']

const IS_WEB = Platform.OS === 'web'
const ONBOARDING_STORAGE_KEY = 'metravel_map_onboarding_completed'
const ONBOARDING_DELAY_MS = 800
const TOOLTIP_GAP_PX = 12
const FALLBACK_VIEWPORT_WIDTH = 800
const FALLBACK_VIEWPORT_HEIGHT = 600
const TOOLTIP_MAX_WIDTH = 320
const TOOLTIP_SIDE_MARGIN = 12
const TOOLTIP_LEFT_MIN = TOOLTIP_SIDE_MARGIN
const MOBILE_WEB_ONBOARDING_MAX_WIDTH = 767

let _restartCb: (() => void) | null = null
// #2251 — the tour mounts late (`shouldLoadOnboarding`, up to a second on web):
// a «Подсказки» press before that is kept and replayed on mount, not lost.
let _restartPending = false

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
  if (_restartCb) _restartCb()
  else _restartPending = true
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

function isConsentBannerOpen() {
  if (!IS_WEB || typeof document === 'undefined') return false
  return (
    document.body?.getAttribute('data-consent-banner-open') === 'true' ||
    document.documentElement?.getAttribute('data-consent-banner-open') === 'true'
  )
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

// Desktop tour. Its tab steps point at the panel header tabs
// (`map-panel-tab-*`, MapPanelHeader) — the header renders them on every
// desktop-branch platform; `filters-panel-header` is hidden there (#2217).
// The intro step has no target: it introduces the whole screen, and the
// `map-panel` it used to name was never rendered.
export const getOnboardingSteps = (): OnboardingStep[] => [
  {
    title: i18nT('map:components.MapPage.MapOnboarding.karta_puteshestviy_87500481'),
    description: i18nT('map:components.MapPage.MapOnboarding.zdes_otobrazhayutsya_interesnye_mesta_i_marshruty_7732a21e'),
    icon: 'map',
    placement: 'bottom',
  },
  {
    title: i18nT('map:components.MapPage.MapOnboarding.nastroyte_filtry_11653829'),
    description: i18nT('map:components.MapPage.MapOnboarding.radius_zadaetsya_otdelnoy_knopkoy_pryamo_na_karte_6947594b'),
    icon: 'filter',
    targetTestID: 'map-panel-tab-filters',
    placement: 'bottom',
  },
  {
    title: i18nT('map:components.MapPage.MapOnboarding.spisok_mest_e8c5b25f'),
    description: i18nT('map:components.MapPage.MapOnboarding.otkroyte_vkladku_mesta_chtoby_uvidet_vse_nayden_145b466e'),
    icon: 'list',
    targetTestID: 'map-panel-tab-travels',
    placement: 'bottom',
  },
  {
    title: i18nT('map:components.MapPage.MapOnboarding.stroyte_marshruty_ba7a03e3'),
    description: i18nT('map:components.MapPage.MapOnboarding.pereklyuchites_v_rezhim_marshruta_chtoby_prolozhit_1a9fc39e'),
    icon: 'navigation',
    targetTestID: 'map-panel-tab-route',
    placement: 'bottom',
  },
]

// #2303 — phone tour (`MapMobileLayout` / `MapMobileTopOverlay`), one set for
// mobile web and native phones. The set is chosen by the layout that is drawn,
// not by the platform: native phones used to get the desktop steps aimed at
// `map-panel-tab-*`, which the phone layout never renders, and mobile web aimed
// its only step at `map-mobile-find-nearby`, which nothing rendered. Every
// target here must exist in the phone top overlay —
// `__tests__/components/MapPage/MapOnboarding.phoneTargets.test.tsx`.
export const getPhoneOnboardingSteps = (): OnboardingStep[] => [
  {
    title: i18nT('map:components.MapPage.MapOnboarding.karta_puteshestviy_87500481'),
    description: i18nT('map:components.MapPage.MapOnboarding.zdes_otobrazhayutsya_interesnye_mesta_i_marshruty_7732a21e'),
    icon: 'map',
    placement: 'bottom',
  },
  {
    title: i18nT('map:components.MapPage.MapOnboarding.nastroyte_filtry_11653829'),
    description: i18nT('map:components.MapPage.MapOnboarding.radius_zadaetsya_otdelnoy_knopkoy_pryamo_na_karte_6947594b'),
    icon: 'filter',
    targetTestID: 'map-mobile-filters-button',
    placement: 'bottom',
  },
  {
    title: i18nT('map:components.MapPage.MapOnboarding.spisok_mest_e8c5b25f'),
    description: i18nT('map:components.MapPage.MapOnboarding.knopka_so_spiskom_otkryvaet_vse_naydennye_mesta_4fcd03d2'),
    icon: 'list',
    targetTestID: 'map-mobile-open-list',
    placement: 'bottom',
  },
  {
    title: i18nT('map:components.MapPage.MapOnboarding.stroyte_marshruty_ba7a03e3'),
    description: i18nT('map:components.MapPage.MapOnboarding.pereklyuchites_v_rezhim_marshruta_chtoby_prolozhit_1a9fc39e'),
    icon: 'navigation',
    targetTestID: 'map-mobile-route-button',
    placement: 'bottom',
  },
]

export type MapOnboardingLayout = 'phone' | 'desktop'

interface Rect {
  top: number
  left: number
  width: number
  height: number
}

/** A target in the overlay's own coordinates, plus the overlay's size. */
interface TargetRect extends Rect {
  frameWidth: number
  frameHeight: number
}

/**
 * #2263 — the card and the spotlight are positioned inside the tour overlay,
 * and the overlay is not the viewport: on desktop web it fills the map screen
 * under the site header (64 px down), so a raw `getBoundingClientRect()` put
 * the card that far below its target. The target is measured against the
 * overlay itself (`frame`); without a frame the viewport is the frame.
 */
export function measureInFrame(target: Rect, frame: Rect): TargetRect {
  return {
    top: target.top - frame.top,
    left: target.left - frame.left,
    width: target.width,
    height: target.height,
    frameWidth: frame.width,
    frameHeight: frame.height,
  }
}

function getTargetRect(testID: string | undefined, frame: Element | null): TargetRect | null {
  if (!IS_WEB || !testID || typeof document === 'undefined') return null
  const el = document.querySelector(`[data-testid="${testID}"]`)
  if (!el) return null
  const frameBox = frame?.getBoundingClientRect?.() ?? {
    top: 0,
    left: 0,
    width: getViewportWidth(),
    height: getViewportHeight(),
  }
  return measureInFrame(el.getBoundingClientRect(), frameBox)
}

/**
 * Ширина коачмарка, гарантированно вписанная в текущий вьюпорт с боковыми
 * отступами. На узких экранах (390px) фиксированный maxWidth 340 + absolute
 * left приводил к выходу карточки и кнопки «Готово» за правый край.
 */
function getTooltipWidth(frameWidth = getViewportWidth()) {
  return Math.min(TOOLTIP_MAX_WIDTH, frameWidth - TOOLTIP_SIDE_MARGIN * 2)
}

export function tooltipPosition(
  rect: TargetRect | null,
  placement: TooltipPosition,
): { top?: number; left?: number; bottom?: number; right?: number } {
  if (!rect) return {}
  const tooltipWidth = getTooltipWidth(rect.frameWidth)
  const maxLeft = Math.max(TOOLTIP_LEFT_MIN, rect.frameWidth - tooltipWidth - TOOLTIP_SIDE_MARGIN)
  switch (placement) {
    case 'bottom':
      return {
        top: rect.top + rect.height + TOOLTIP_GAP_PX,
        left: Math.max(TOOLTIP_LEFT_MIN, Math.min(rect.left, maxLeft)),
      }
    case 'top':
      return {
        bottom: rect.frameHeight - rect.top + TOOLTIP_GAP_PX,
        left: Math.max(TOOLTIP_LEFT_MIN, Math.min(rect.left, maxLeft)),
      }
    case 'left':
      return {
        top: rect.top,
        right: rect.frameWidth - rect.left + TOOLTIP_GAP_PX,
      }
    case 'right':
      return { top: rect.top, left: rect.left + rect.width + TOOLTIP_GAP_PX }
    default:
      return {}
  }
}

interface MapOnboardingProps {
  onComplete?: () => void
  /**
   * #2303 — which layout is drawn: picks the step set. Without it the set
   * follows `mobileWebCoachmark` (phone on mobile web, desktop otherwise).
   */
  layout?: MapOnboardingLayout
  /** Mobile-web-only behaviour: auto-open on web, wait for the cookie banner. */
  mobileWebCoachmark?: boolean
  suspendAutoOpen?: boolean
}

export const MapOnboarding: React.FC<MapOnboardingProps> = ({
  onComplete,
  layout,
  mobileWebCoachmark: mobileWebCoachmarkProp,
  suspendAutoOpen = false,
}) => {
  const colors = useThemedColors()
  const styles = useMemo(() => getStyles(colors), [colors])
  const [mobileWebCoachmark] = useState(
    () => mobileWebCoachmarkProp ?? isMobileWebViewport(),
  )
  const resolvedLayout: MapOnboardingLayout = layout ?? (mobileWebCoachmark ? 'phone' : 'desktop')
  const steps = useMemo(
    () => (resolvedLayout === 'phone' ? getPhoneOnboardingSteps() : getOnboardingSteps()),
    [resolvedLayout],
  )
  const [currentStep, setCurrentStep] = useState(0)
  const [visible, setVisible] = useState(false)
  const [consentBannerOpen, setConsentBannerOpen] = useState(isConsentBannerOpen)
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null)
  const overlayRef = useRef<View>(null)
  const rafRef = useRef(0)
  const openTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const shouldSuspendAutoOpen = Boolean(suspendAutoOpen || (mobileWebCoachmark && consentBannerOpen))
  // #2251 — overlays show one at a time (#607, #1008): a manual restart while the
  // cookie banner is open waits for it to close instead of covering it.
  const shown = visible && !shouldSuspendAutoOpen

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

  useEffect(() => {
    if (!IS_WEB || !mobileWebCoachmark || typeof document === 'undefined') return
    const body = document.body
    if (!body) return
    const update = () => setConsentBannerOpen(isConsentBannerOpen())
    update()
    const observer = new MutationObserver(update)
    observer.observe(body, {
      attributes: true,
      attributeFilter: ['data-consent-banner-open'],
    })
    return () => observer.disconnect()
  }, [mobileWebCoachmark])

  useEffect(() => {
    if (!mobileWebCoachmark || !shouldSuspendAutoOpen) return
    if (openTimerRef.current) {
      clearTimeout(openTimerRef.current)
      openTimerRef.current = null
    }
    setVisible(false)
  }, [mobileWebCoachmark, shouldSuspendAutoOpen])

  // #2251 — replay a press made before mount. Declared after the suspend effect:
  // on a mount with the cookie banner open that effect hides the auto-open, and
  // running first it would swallow the replayed manual press too.
  useEffect(() => {
    if (!_restartPending) return
    _restartPending = false
    _restartCb?.()
  }, [])

  // Auto-show on first visit for native and mobile web; desktop web stays manual.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const completed = await loadOnboardingCompleted()
      if (cancelled || completed) return
      if (IS_WEB && !mobileWebCoachmark) return
      if (shouldSuspendAutoOpen) return
      openTimerRef.current = setTimeout(() => {
        if (!cancelled && !(mobileWebCoachmark && isConsentBannerOpen())) setVisible(true)
      }, ONBOARDING_DELAY_MS)
    })()
    return () => {
      cancelled = true
      if (openTimerRef.current) {
        clearTimeout(openTimerRef.current)
        openTimerRef.current = null
      }
    }
  }, [mobileWebCoachmark, shouldSuspendAutoOpen])

  // Публикуем факт открытого онбординга тем же DOM-сигналом, что и cookie-баннер
  // (`data-consent-banner-open`): MapScreen прячет гео-баннер, пока модалка висит,
  // чтобы на первом входе оверлеи показывались по одному, а не стопкой. Web-only.
  useEffect(() => {
    if (!IS_WEB || typeof document === 'undefined') return
    const body = document.body
    if (!body) return
    if (shown) {
      body.setAttribute('data-map-onboarding-open', 'true')
    } else {
      body.removeAttribute('data-map-onboarding-open')
    }
    return () => {
      body.removeAttribute('data-map-onboarding-open')
    }
  }, [shown])

  // Re-measure target when step changes
  useEffect(() => {
    if (!shown) return
    const measure = () => {
      const step = steps[currentStep]
      setTargetRect(getTargetRect(step?.targetTestID, overlayRef.current as unknown as Element | null))
    }
    rafRef.current = requestAnimationFrame(measure)
    return () => cancelAnimationFrame(rafRef.current)
  }, [shown, currentStep, steps])

  const handleComplete = useCallback(() => {
    saveOnboardingCompleted()
    setVisible(false)
    // На native будим Leaflet: пока онбординг висел поверх карты при первом открытии
    // на чистой установке, WebView не дозапросил тайлы под текущий вью (см. F-17b в Map.ios).
    if (!IS_WEB) DeviceEventEmitter.emit('metravel:map-layout-invalidate')
    onComplete?.()
  }, [onComplete])

  const handleNext = useCallback(() => {
    if (currentStep < steps.length - 1) {
      setCurrentStep((prev) => prev + 1)
    } else {
      handleComplete()
    }
  }, [currentStep, handleComplete, steps.length])

  if (!shown) return null

  const step = steps[currentStep]
  const isLastStep = currentStep === steps.length - 1
  const pos = tooltipPosition(targetRect, step.placement)
  // Когда карточка позиционируется абсолютно (привязана к таргету), задаём явную
  // ширину, вписанную во вьюпорт, иначе width:'90%' резолвится от overlay (всё
  // окно) и absolute-left уводит правый край за экран на мобильном.
  const cardWidth = targetRect ? getTooltipWidth(targetRect.frameWidth) : 0
  const cardWidthStyle = targetRect ? ({ width: cardWidth, maxWidth: cardWidth } as const) : null

  return (
    <View ref={overlayRef} style={[styles.overlay, { pointerEvents: 'auto' }]}>
      <Pressable
        style={styles.backdrop}
        onPress={handleComplete}
        accessibilityRole="button"
        accessibilityLabel={i18nT('map:components.MapPage.MapOnboarding.zakryt_podskazku_fba27182')}
        testID="onboarding-backdrop"
      />

      {targetRect && IS_WEB && (
        <View
          testID="onboarding-spotlight"
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
        testID="onboarding-card"
        style={[styles.card, targetRect ? ({ position: 'absolute', ...pos, ...cardWidthStyle } as any) : null]}
      >
        {targetRect && step.placement === 'bottom' && <View style={styles.arrowUp} />}

        <View style={styles.cardHeader}>
          <View style={styles.iconCircle}>
            <Feather name={step.icon} size={20} color={colors.primaryDark} />
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
              label={i18nT('map:components.MapPage.MapOnboarding.propustit_511c8d6e')}
              onPress={handleComplete}
              variant="ghost"
              size="sm"
              testID="onboarding-skip"
            />
            <Button
              label={isLastStep ? i18nT('map:components.MapPage.MapOnboarding.gotovo_bf48fa72') : i18nT('map:components.MapPage.MapOnboarding.dalee_c24ac17e')}
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
    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: 8,
    },
    stepsIndicator: { flexDirection: 'row', gap: 4, flexShrink: 0 },
    stepDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.border },
    stepDotActive: { backgroundColor: colors.primary, width: 16 },
    actions: { flexDirection: 'row', gap: 8, flexShrink: 0 },
  })

export default React.memo(MapOnboarding)
