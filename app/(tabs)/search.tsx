/**
 * SearchScreen - Optimized for instant perceived performance
 * 
 * Pattern: YouTube-style skeleton → content transition
 * - Skeleton renders instantly on first paint (no delays)
 * - Data loads in background while skeleton is visible
 * - Web sidebar navigation sections remain accessible during loading
 * - Smooth fade transition when content is ready
 * - No empty screens or heavy first render
 */
import { Suspense, lazy, memo, useCallback, useMemo, useState, useEffect, useRef } from 'react'
import { StyleSheet, View, Platform, Animated } from 'react-native'
import { usePathname, useRouter } from 'expo-router'
import { useIsFocused } from '@react-navigation/native'

import InstantSEO from '@/components/seo/LazyInstantSEO'
import ErrorBoundary from '@/components/ui/ErrorBoundary'
import ErrorDisplay from '@/components/ui/ErrorDisplay'
import FloatingActionButton from '@/components/ui/FloatingActionButton'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useThemedColors } from '@/hooks/useTheme'
import { useAuth } from '@/context/AuthContext'
import { buildCanonicalUrl, buildOgImageUrl, DEFAULT_OG_IMAGE_PATH } from '@/utils/seo'
import { SearchPageSkeleton } from '@/components/listTravel/SearchPageSkeleton'

/** Lazy load main content - data fetching starts immediately inside ListTravelBase */
const ListTravel = lazy(() => import('@/components/listTravel/ListTravelBase'))

/** SEO metadata */
const SEO_TITLE = 'Поиск маршрутов и идей путешествий по Беларуси | Metravel'
const SEO_DESCRIPTION = 'Ищите путешествия по странам, категориям и сложности. Фильтруйте маршруты и сохраняйте лучшие идеи в свою книгу путешествий.'

/** Transition duration for skeleton → content fade */
const TRANSITION_MS = 200

function SearchScreen() {
  const pathname = usePathname()
  const router = useRouter()
  const isFocused = useIsFocused()
  const colors = useThemedColors()
  const { isAuthenticated } = useAuth()

  // Track content ready state for smooth transition
  // Start with skeleton visible, transition to content when Suspense resolves
  const [contentReady, setContentReady] = useState(false)
  const fadeAnim = useRef(new Animated.Value(0)).current

  // Handle sidebar section navigation (scroll to filter section when clicked in skeleton)
  const handleSectionPress = useCallback((sectionKey: string) => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const element = document.querySelector(`[data-filter-section="${sectionKey}"]`)
      element?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [])

  // Animate content fade-in when ready
  useEffect(() => {
    if (contentReady) {
      if (Platform.OS === 'web') {
        // CSS handles transition on web
        return
      }
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: TRANSITION_MS,
        useNativeDriver: true,
      }).start()
    }
  }, [contentReady, fadeAnim])

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: colors.background,
        },
        errorContainer: {
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          padding: DESIGN_TOKENS.spacing.lg,
        },
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
        contentWrapper: {
          flex: 1,
          position: 'relative' as const,
        },
        skeletonLayer: {
          ...StyleSheet.absoluteFillObject,
          zIndex: 1,
        },
        contentLayer: {
          flex: 1,
        },
      }),
    [colors],
  )

  // Web-specific styles for CSS transitions
  const webSkeletonStyle = Platform.OS === 'web' ? {
    opacity: contentReady ? 0 : 1,
    pointerEvents: contentReady ? 'none' as const : 'auto' as const,
    transition: `opacity ${TRANSITION_MS}ms ease-out`,
  } : {}

  const webContentStyle = Platform.OS === 'web' ? {
    opacity: contentReady ? 1 : 0,
    transition: `opacity ${TRANSITION_MS}ms ease-out`,
  } : {}

  return (
    <>
      {isFocused && Platform.OS === 'web' && (
        <InstantSEO
          headKey="travel-search"
          title={SEO_TITLE}
          description={SEO_DESCRIPTION}
          canonical={buildCanonicalUrl(pathname || '/search')}
          image={buildOgImageUrl(DEFAULT_OG_IMAGE_PATH)}
          ogType="website"
        />
      )}
      <View style={styles.container} testID="search-container">
        {Platform.OS === 'web' && <h1 style={styles.srOnly as any}>{SEO_TITLE}</h1>}
        <ErrorBoundary
          fallback={
            <View style={styles.errorContainer}>
              <ErrorDisplay
                message="Не удалось загрузить поиск путешествий"
                onRetry={() => router.replace((pathname || '/search') as any)}
                variant="error"
              />
            </View>
          }
        >
          <View style={styles.contentWrapper}>
            {/* Skeleton layer - visible instantly, fades out when content ready */}
            {!contentReady && (
              <View 
                style={[styles.skeletonLayer, webSkeletonStyle as any]}
                testID="search-skeleton-layer"
              >
                <SearchPageSkeleton 
                  showSidebarNavigation={Platform.OS === 'web'}
                  onSectionPress={handleSectionPress}
                />
              </View>
            )}

            {/* Content layer - renders behind skeleton, fades in when ready */}
            {Platform.OS === 'web' ? (
              <View style={[styles.contentLayer, webContentStyle as any]}>
                <Suspense 
                  fallback={<SearchPageSkeleton showSidebarNavigation={false} />}
                >
                  <ListTravelWithReadyCallback onReady={() => setContentReady(true)} />
                </Suspense>
              </View>
            ) : (
              <Animated.View style={[styles.contentLayer, { opacity: fadeAnim }]}>
                <Suspense fallback={<SearchPageSkeleton />}>
                  <ListTravelWithReadyCallback onReady={() => setContentReady(true)} />
                </Suspense>
              </Animated.View>
            )}
          </View>
        </ErrorBoundary>

        {isAuthenticated && Platform.OS !== 'web' && (
          <FloatingActionButton
            icon="plus"
            label="Создать маршрут"
            onPress={() => router.push('/travel/new' as any)}
            testID="fab-create-travel"
          />
        )}
      </View>
    </>
  )
}

/** Wrapper that signals when ListTravel has mounted and is ready */
const ListTravelWithReadyCallback = memo<{ onReady: () => void }>(({ onReady }) => {
  const hasSignaled = useRef(false)
  
  useEffect(() => {
    if (!hasSignaled.current) {
      hasSignaled.current = true
      // Signal ready on next frame to ensure render is complete
      requestAnimationFrame(() => onReady())
    }
  }, [onReady])

  return <ListTravel />
})

ListTravelWithReadyCallback.displayName = 'ListTravelWithReadyCallback'

export default memo(SearchScreen)
