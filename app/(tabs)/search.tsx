import { memo, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { StyleSheet, View, Platform } from 'react-native'
import { usePathname, useRouter } from 'expo-router'
import { useIsFocused } from 'expo-router'

import InstantSEO from '@/components/seo/LazyInstantSEO'
import ErrorBoundary from '@/components/ui/ErrorBoundary'
import ErrorDisplay from '@/components/ui/ErrorDisplay'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useThemedColors } from '@/hooks/useTheme'
import { useAuth } from '@/context/AuthContext'
import { buildCanonicalUrl, buildOgImageUrl, DEFAULT_OG_IMAGE_PATH } from '@/utils/seo'
import SearchPageSkeleton from '@/components/listTravel/SearchPageSkeleton'
import ListTravel from '@/components/listTravel/ListTravelRoute'
import { trackContentCreateCtaClicked } from '@/utils/growthFunnelAnalytics'
import { translate as i18nT } from '@/i18n'


function SearchScreen() {
  const pathname = usePathname()
  const router = useRouter()
  const isFocused = useIsFocused()
  const colors = useThemedColors()
  const { isAuthenticated } = useAuth()
  const pageHeading = i18nT('seoStatic:search.heading')
  const [canRenderList, setCanRenderList] = useState(Platform.OS !== 'web')

  useEffect(() => {
    if (Platform.OS !== 'web') return
    setCanRenderList(true)
  }, [])

  const handleCreateTravelPress = useCallback(() => {
    trackContentCreateCtaClicked({
      contentType: 'route',
      source: 'search_toolbar',
      authState: 'authenticated',
      intent: 'create-travel',
      action: 'create',
    })
    router.push('/travel/new' as any)
  }, [router])

  const createTravelAction = useMemo(() => {
    if (!isAuthenticated || Platform.OS === 'web') return undefined

    return {
      accessibilityHint: i18nT('shared:app.tabs.search.otkryvaet_master_sozdaniya_novogo_marshruta_1167875d'),
      iconName: 'plus' as const,
      label: i18nT('shared:app.tabs.search.sozdat_marshrut_eaa135a8'),
      onPress: handleCreateTravelPress,
      testID: 'create-travel-toolbar-button',
    }
  }, [handleCreateTravelPress, isAuthenticated])

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
          title={i18nT('seoStatic:root.search.title')}
          description={i18nT('seoStatic:root.search.description')}
          canonical={buildCanonicalUrl(pathname || '/search')}
          image={buildOgImageUrl(DEFAULT_OG_IMAGE_PATH)}
          ogType="website"
        />
      )}
      <View style={styles.container} testID="search-container">
        {Platform.OS === 'web' && <h1 style={styles.srOnly as any}>{pageHeading}</h1>}
        <ErrorBoundary
          fallback={
            <View style={styles.errorContainer}>
              <ErrorDisplay
                message={i18nT('shared:app.tabs.search.ne_udalos_zagruzit_poisk_puteshestviy_7798f9dd')}
                onRetry={() => router.replace((pathname || '/search') as any)}
                variant="error"
              />
            </View>
          }
        >
          {canRenderList ? (
            <Suspense fallback={<SearchPageSkeleton />}>
              <ListTravel primaryAction={createTravelAction} />
            </Suspense>
          ) : (
            <SearchPageSkeleton />
          )}
        </ErrorBoundary>
      </View>
    </>
  )
}


export default memo(SearchScreen)
