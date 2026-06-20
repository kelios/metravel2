import { memo, Suspense, useEffect, useMemo, useState } from 'react'
import { StyleSheet, View, Platform } from 'react-native'
import { usePathname, useRouter } from 'expo-router'
import { useIsFocused } from 'expo-router'

import InstantSEO from '@/components/seo/LazyInstantSEO'
import ErrorBoundary from '@/components/ui/ErrorBoundary'
import ErrorDisplay from '@/components/ui/ErrorDisplay'
import FloatingActionButton from '@/components/ui/FloatingActionButton'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useThemedColors } from '@/hooks/useTheme'
import { useAuth } from '@/context/AuthContext'
import { buildCanonicalUrl, buildOgImageUrl, DEFAULT_OG_IMAGE_PATH } from '@/utils/seo'
import SearchPageSkeleton from '@/components/listTravel/SearchPageSkeleton'
import ListTravel from '@/components/listTravel/ListTravelRoute'

/** SEO metadata */
const PAGE_HEADING = 'Поиск маршрутов и идей путешествий по Беларуси'
const SEO_TITLE = `${PAGE_HEADING} | Metravel`
const SEO_DESCRIPTION = 'Ищите путешествия по странам, категориям и сложности. Фильтруйте маршруты и сохраняйте лучшие идеи в свою книгу путешествий.'

function SearchScreen() {
  const pathname = usePathname()
  const router = useRouter()
  const isFocused = useIsFocused()
  const colors = useThemedColors()
  const { isAuthenticated } = useAuth()
  const [canRenderList, setCanRenderList] = useState(Platform.OS !== 'web')

  useEffect(() => {
    if (Platform.OS !== 'web') return
    setCanRenderList(true)
  }, [])

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
            clipPath: 'inset(50%)',
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
          title={SEO_TITLE}
          description={SEO_DESCRIPTION}
          canonical={buildCanonicalUrl(pathname || '/search')}
          image={buildOgImageUrl(DEFAULT_OG_IMAGE_PATH)}
          ogType="website"
        />
      )}
      <View style={styles.container} testID="search-container">
        {Platform.OS === 'web' && <h1 style={styles.srOnly as any}>{PAGE_HEADING}</h1>}
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
          {canRenderList ? (
            <Suspense fallback={<SearchPageSkeleton />}>
              <ListTravel />
            </Suspense>
          ) : (
            <SearchPageSkeleton />
          )}
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
