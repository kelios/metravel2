import { Suspense, lazy, memo, useMemo, useState, useEffect } from 'react'
import { StyleSheet, View, Platform } from 'react-native'
import { usePathname, useRouter } from 'expo-router'
import { useIsFocused } from '@react-navigation/native'

import InstantSEO from '@/components/seo/LazyInstantSEO'
import ErrorBoundary from '@/components/ui/ErrorBoundary'
import ErrorDisplay from '@/components/ui/ErrorDisplay'
import FloatingActionButton from '@/components/ui/FloatingActionButton'
import { ProgressiveContent } from '@/components/ui/ProgressiveContent'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useThemedColors } from '@/hooks/useTheme'
import { useAuth } from '@/context/AuthContext'
import { buildCanonicalUrl, buildOgImageUrl, DEFAULT_OG_IMAGE_PATH } from '@/utils/seo'
import { SearchPageSkeleton } from '@/components/listTravel/SearchPageSkeleton'

const ListTravel = lazy(() => import('@/components/listTravel/ListTravelBase'))

function SearchScreen() {
  const pathname = usePathname()
  const router = useRouter()
  const isFocused = useIsFocused()
  const colors = useThemedColors()
  const { isAuthenticated } = useAuth()

  // Hydration state for progressive content
  const [hydrated, setHydrated] = useState(Platform.OS !== 'web')
  useEffect(() => {
    if (Platform.OS === 'web') setHydrated(true)
  }, [])

  const title = 'Поиск маршрутов и идей путешествий по Беларуси | Metravel'
  const description =
    'Ищите путешествия по странам, категориям и сложности. Фильтруйте маршруты и сохраняйте лучшие идеи в свою книгу путешествий.'

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
      }),
    [colors],
  )

  return (
    <>
      {isFocused && Platform.OS === 'web' && (
        <InstantSEO
          headKey="travel-search"
          title={title}
          description={description}
          canonical={buildCanonicalUrl(pathname || '/search')}
          image={buildOgImageUrl(DEFAULT_OG_IMAGE_PATH)}
          ogType="website"
        />
      )}
      <View style={styles.container} testID="search-container">
        {Platform.OS === 'web' && <h1 style={styles.srOnly as any}>{title}</h1>}
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
          <ProgressiveContent
            isReady={hydrated}
            skeleton={<SearchPageSkeleton />}
            testID="search-progressive"
          >
            <Suspense fallback={<SearchPageSkeleton />}>
              <ListTravel />
            </Suspense>
          </ProgressiveContent>
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

export default memo(SearchScreen)
