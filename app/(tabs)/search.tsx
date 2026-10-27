import { memo, Suspense, useCallback, useMemo } from 'react'
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
import ListTravel from '@/components/listTravel/SearchListTravelRoute'
import { trackContentCreateCtaClicked } from '@/utils/growthFunnelAnalytics'
import { translate as i18nT } from '@/i18n'
import { useResponsiveWidth } from '@/hooks/useResponsive'
import { isAiAssistantEnabled } from '@/utils/aiAssistantConfig'
import UIButton from '@/components/ui/Button'
import Feather from '@expo/vector-icons/Feather'
import { staticRouteMetadata } from '@/utils/seoRoutes/routeMetadata'


function SearchScreen() {
  const pathname = usePathname()
  const router = useRouter()
  const isFocused = useIsFocused()
  const colors = useThemedColors()
  const { isAuthenticated } = useAuth()
  const viewportWidth = useResponsiveWidth()
  const pageHeading = i18nT('seoStatic:search.heading')
  const canRenderList = Platform.OS !== 'web' || viewportWidth > 0
  // #2460: кнопка «Спросить ассистента» — только под фича-флагом.
  const assistantEnabled = isAiAssistantEnabled()
  const handleAskAssistantPress = useCallback(() => {
    router.push('/assistant')
  }, [router])

  const handleCreateTravelPress = useCallback(() => {
    trackContentCreateCtaClicked({
      contentType: 'route',
      source: 'search_toolbar',
      authState: 'authenticated',
      intent: 'create-travel',
      action: 'create',
      mode: 'full',
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
        assistantCta: {
          flexDirection: 'row',
          justifyContent: 'flex-end',
          paddingHorizontal: DESIGN_TOKENS.spacing.md,
          paddingTop: DESIGN_TOKENS.spacing.xs,
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
        {assistantEnabled ? (
          <View style={styles.assistantCta}>
            <UIButton
              variant="soft"
              size="sm"
              label={i18nT('aiAssistStatic:ask.searchCta')}
              icon={<Feather name="message-circle" size={16} color={colors.primaryDark} />}
              onPress={handleAskAssistantPress}
              testID="search-ask-assistant"
            />
          </View>
        ) : null}
        <ErrorBoundary
          fallback={
            <View style={styles.errorContainer}>
              <ErrorDisplay
                message={i18nT('shared:app.tabs.search.loadError')}
                onRetry={() => router.replace((pathname || '/search') as any)}
                variant="error"
              />
            </View>
          }
        >
          {canRenderList ? (
            <Suspense fallback={<SearchPageSkeleton initialViewportWidth={Platform.OS === 'web' ? viewportWidth : undefined} />}>
              <ListTravel
                enabled={isFocused}
                initialViewportWidth={Platform.OS === 'web' ? viewportWidth : undefined}
                primaryAction={createTravelAction}
              />
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

// #2740: head статического HTML объявляет маршрут (Expo SDK 58 пишет его из
// generateMetadata, helmet в экспорт больше не попадает); значения — общая таблица
// utils/seoRoutes/staticRoutes.js, та же, что у SSG-генератора.
export function generateMetadata() {
  return staticRouteMetadata('/search')
}
