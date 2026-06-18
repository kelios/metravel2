import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, Animated, Platform, StyleSheet, Text, View } from 'react-native'
import { usePathname } from 'expo-router'

import InstantSEO from '@/components/seo/LazyInstantSEO'
import ErrorBoundary from '@/components/ui/ErrorBoundary'
import ErrorDisplay from '@/components/ui/ErrorDisplay'
import Home from '@/components/home/Home'
import { HomePageSkeleton } from '@/components/home/HomePageSkeleton'
import { useThemedColors } from '@/hooks/useTheme'
import { buildCanonicalUrl, buildOgImageUrl } from '@/utils/seo'

const SEO_TITLE = 'Идеи поездок на выходные и книга путешествий | Metravel'
const SEO_DESCRIPTION =
  'Подбирайте маршруты по расстоянию и формату отдыха, сохраняйте поездки с фото и заметками и собирайте личную книгу путешествий в PDF.'
// Тематическое hero-изображение для соцсетей (1200×630) вместо generic-логотипа.
const HOME_OG_IMAGE_PATH = '/og-home.jpg'
const HOME_OG_IMAGE_WIDTH = 1200
const HOME_OG_IMAGE_HEIGHT = 630
const TRANSITION_MS = 200
const IS_WEB = Platform.OS === 'web'

function renderHomeSeo(canonical: string) {
  return (
    <InstantSEO
      headKey="home"
      title={SEO_TITLE}
      description={SEO_DESCRIPTION}
      canonical={canonical}
      image={buildOgImageUrl(HOME_OG_IMAGE_PATH)}
      imageWidth={HOME_OG_IMAGE_WIDTH}
      imageHeight={HOME_OG_IMAGE_HEIGHT}
      imageAlt="Metravel — идеи путешествий на выходные"
      ogType="website"
    />
  )
}

function normalizePath(raw: string | null | undefined) {
  const v = String(raw ?? '').trim()
  if (v === '' || v === '/') return '/'
  return v.startsWith('/') ? v : `/${v}`
}

function HomeScreen() {
  const pathname = usePathname()
  const colors = useThemedColors()
  const styles = useMemo(() => createStyles(colors), [colors])

  // On web, start as false so SSR and first client render produce the same
  // neutral output. Prevents hydration mismatch when URL is /travels/* but
  // index tab renders during SSR with pathname='/'.
  const [hydrated, setHydrated] = useState(!IS_WEB)
  useEffect(() => {
    if (IS_WEB) setHydrated(true)
  }, [])

  // After hydration, check the real browser URL. Avoid relying on router
  // pathname: it can briefly report '/' while navigating to /travels/*.
  const isHomePath = useMemo(() => {
    if (!IS_WEB) return true
    if (!hydrated) return false
    if (typeof window !== 'undefined') {
      const loc = String(window.location?.pathname ?? '').trim()
      if (loc === '' || loc === '/' || loc === '/index') return true
    }
    return false
  }, [hydrated])

  const canonical = useMemo(() => buildCanonicalUrl(normalizePath(pathname)), [pathname])

  const shouldRenderSeo = useMemo(() => {
    if (!IS_WEB) return false
    if (isHomePath) return true
    // SSR/first render fallback: keep meta tags on home route before
    // window.location-based verification is possible.
    return !hydrated && (pathname === '/' || pathname === '/index' || pathname === '')
  }, [hydrated, isHomePath, pathname])

  const [contentReady, setContentReady] = useState(false)
  const [errorBoundaryRetryKey, setErrorBoundaryRetryKey] = useState(0)
  const fadeAnim = useRef<Animated.Value | null>(null)
  if (!IS_WEB && fadeAnim.current == null) {
    fadeAnim.current = new Animated.Value(0)
  }

  const handleHomeRetry = useCallback(() => {
    setContentReady(false)
    setErrorBoundaryRetryKey((v) => v + 1)
    fadeAnim.current?.setValue(0)
  }, [])

  useEffect(() => {
    if (IS_WEB || !contentReady || !fadeAnim.current) return
    Animated.timing(fadeAnim.current, {
      toValue: 1,
      duration: TRANSITION_MS,
      useNativeDriver: true,
    }).start()
  }, [contentReady])

  const handleContentReady = useCallback(() => setContentReady(true), [])
  const canMountContent = hydrated
  const shouldShowSkeleton = !canMountContent || (!IS_WEB && !contentReady)

  if (!isHomePath) {
    return shouldRenderSeo ? renderHomeSeo(canonical) : null
  }

  return (
    <>
      {shouldRenderSeo && renderHomeSeo(canonical)}
      <View style={styles.container}>
        {/* The single level-1 semantic heading is the visible hero title in
            HomeHeroBookLayout. This sr-only line carries the longer SEO phrasing
            for screen readers/crawlers as a level-2 heading to avoid duplicates. */}
        {IS_WEB && React.createElement('h2', { style: styles.srOnly as any }, SEO_TITLE)}

        <ErrorBoundary
          key={errorBoundaryRetryKey}
          fallback={
            <View style={styles.errorContainer}>
              <ErrorDisplay
                message="Не удалось загрузить главную страницу"
                onRetry={handleHomeRetry}
                variant="error"
              />
            </View>
          }
        >
          <View style={styles.contentWrapper}>
            {shouldShowSkeleton && (
              <View
                style={styles.skeletonLayer}
                testID="home-skeleton-layer"
              >
                <HomePageSkeleton />
                {!IS_WEB && <SlowLoadHint colors={colors} />}
              </View>
            )}

            {canMountContent && (
              <ContentLayer
                style={styles.contentLayer}
                webStyle={null}
                fadeAnim={fadeAnim.current}
              >
                <HomeWithReadyCallback onReady={handleContentReady} />
              </ContentLayer>
            )}
          </View>
        </ErrorBoundary>
      </View>
    </>
  )
}

function ContentLayer({
  style,
  webStyle,
  fadeAnim,
  children,
}: {
  style: any
  webStyle: any
  fadeAnim: Animated.Value | null
  children: React.ReactNode
}) {
  if (IS_WEB) {
    return <View style={[style, webStyle]}>{children}</View>
  }
  return <Animated.View style={[style, { opacity: fadeAnim ?? 1 }]}>{children}</Animated.View>
}

// Native-only: if the home skeleton stays up longer than SLOW_LOAD_MS, surface a
// gentle "Загружаем…" hint so a slow device doesn't feel frozen. The component is
// only mounted while the skeleton layer is shown, so the timer is torn down as
// soon as content becomes ready.
const SLOW_LOAD_MS = 4500

const SlowLoadHint = React.memo<{ colors: ReturnType<typeof useThemedColors> }>(({ colors }) => {
  const [show, setShow] = useState(false)
  useEffect(() => {
    const id = setTimeout(() => setShow(true), SLOW_LOAD_MS)
    return () => clearTimeout(id)
  }, [])

  if (!show) return null

  return (
    <View style={slowLoadStyles.wrap} pointerEvents="none">
      <View style={[slowLoadStyles.pill, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <ActivityIndicator size="small" color={colors.primary} />
        <Text style={[slowLoadStyles.text, { color: colors.textMuted }]}>Загружаем…</Text>
      </View>
    </View>
  )
})
SlowLoadHint.displayName = 'SlowLoadHint'

const slowLoadStyles = StyleSheet.create({
  wrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 120,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1,
  },
  text: {
    fontSize: 14,
    fontWeight: '600',
  },
})

const HomeWithReadyCallback = React.memo<{ onReady: () => void }>(({ onReady }) => {
  const hasSignaled = useRef(false)
  useEffect(() => {
    if (hasSignaled.current) return
    hasSignaled.current = true
    requestAnimationFrame(() => onReady())
  }, [onReady])
  return <Home />
})
HomeWithReadyCallback.displayName = 'HomeWithReadyCallback'

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    srOnly: Platform.select({
      web: {
        position: 'absolute' as const,
        width: 1,
        height: 1,
        padding: 0,
        margin: -1,
        overflow: 'hidden' as const,
        clip: 'rect(0,0,0,0)',
        whiteSpace: 'nowrap',
        borderWidth: 0,
      },
      default: { display: 'none' as const },
    }) as any,
    errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
    contentWrapper: { flex: 1, position: 'relative' as const },
    skeletonLayer: { ...StyleSheet.absoluteFillObject, zIndex: 1 },
    contentLayer: { flex: 1 },
  })

export default React.memo(HomeScreen)
