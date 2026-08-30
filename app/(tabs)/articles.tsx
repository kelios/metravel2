import {ActivityIndicator, StyleSheet, View, Platform, ScrollView, RefreshControl} from 'react-native'
import ArticleListItem from '@/components/article/ArticleListItem'
import {useEffect, useMemo, useState} from 'react'
import {Articles} from '@/types/types'
import { SkeletonLoader } from '@/components/ui/SkeletonLoader'
import {fetchArticles} from '@/api/articles'
import PaginationComponent from '@/components/ui/PaginationComponent'
import {useLocalSearchParams, useRouter, type Href} from 'expo-router'
import ErrorDisplay from '@/components/ui/ErrorDisplay'
import EmptyState from '@/components/ui/EmptyState'
import ContributionBanner from '@/components/common/ContributionBanner'
import EmailSubscriptionForm from '@/components/common/EmailSubscriptionForm'
import { useThemedColors } from '@/hooks/useTheme'
import { FlashList } from '@shopify/flash-list'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { queryConfigs } from '@/utils/reactQueryConfig'
import { queryKeys } from '@/queryKeys'
import { useIsFocused } from 'expo-router'
import { webTouchScrollStyle } from '@/utils'
import InstantSEO from '@/components/seo/LazyInstantSEO'
import { buildCanonicalUrl, buildOgImageUrl, DEFAULT_OG_IMAGE_PATH } from '@/utils/seo'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAndroidBackHandler } from '@/hooks/useAndroidBackHandler'
import { buildArticlesHrefFromSource, normalizeArticleListSourceHref } from '@/utils/articleNavigation'
import { translate as i18nT } from '@/i18n'
import { DESIGN_TOKENS } from '@/constants/designSystem'

const getArticlesPageTitleStyle = (colors: ReturnType<typeof useThemedColors>) => ({
  fontSize: `${DESIGN_TOKENS.typography.scale.h1.fontSize}px`,
  lineHeight: `${DESIGN_TOKENS.typography.scale.h1.lineHeight}px`,
  letterSpacing: `${DESIGN_TOKENS.typography.scale.h1.letterSpacing}px`,
  fontWeight: DESIGN_TOKENS.typography.scale.h1.fontWeight,
  flexGrow: 0,
  flexShrink: 0,
  flexBasis: 'auto' as const,
  width: '100%',
  margin: 0,
  paddingTop: DESIGN_TOKENS.spacing.sm,
  paddingRight: DESIGN_TOKENS.spacing.md,
  paddingBottom: DESIGN_TOKENS.spacing.sm,
  paddingLeft: DESIGN_TOKENS.spacing.md,
  boxSizing: 'border-box' as const,
  color: colors.text,
  backgroundColor: colors.surface,
  textAlign: 'center' as const,
})


export default function TabOneScreen() {
  const initialPage = 0
  const isFocused = useIsFocused()
  const router = useRouter()
  const colors = useThemedColors()
  const styles = useMemo(() => getStyles(colors), [colors])
  const pageTitleStyle = useMemo(() => getArticlesPageTitleStyle(colors), [colors])
  const pageTitle = i18nT('shared:app.tabs.articles.stati_o_puteshestviyah_marshrutah_i_sovetah__d7db8d4c')
  const pageHeading = pageTitle.replace(/\s*\|\s*MeTravel\s*$/i, '')

  const webPageHeading = Platform.OS === 'web' ? (
    <h1 style={pageTitleStyle}>{pageHeading}</h1>
  ) : null

  const itemsPerPageOptions = [10, 20, 30, 50, 100]
  const [currentPage, setCurrentPage] = useState(initialPage)
  const [itemsPerPage, setItemsPerPage] = useState(itemsPerPageOptions[2])

  // 👇 безопасно получаем user_id
  const params = useLocalSearchParams()
  const user_id = typeof params.user_id === 'string' ? params.user_id : undefined
  const sourceHref = useMemo(() => normalizeArticleListSourceHref(params.from), [params.from])
  const articleListReturnHref = useMemo(() => buildArticlesHrefFromSource(sourceHref), [sourceHref])

  useAndroidBackHandler(undefined, {
    resolveBack: sourceHref
      ? () => {
          router.dismissTo(sourceHref as Href)
          return true
        }
      : undefined,
  })

  useEffect(() => {
    setCurrentPage(0)
  }, [itemsPerPage, user_id])

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage)
  }

  const {
    data: articles,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useQuery<Articles>({
    queryKey: queryKeys.articles({ page: currentPage, itemsPerPage, user_id }),
    queryFn: ({ signal }) =>
      fetchArticles(currentPage, itemsPerPage, { user_id }, { signal, throwOnError: true }) as any,
    placeholderData: keepPreviousData,
    ...queryConfigs.paginated,
    refetchOnMount: false,
  })

  // ✅ ИСПРАВЛЕНИЕ: Обработка состояний загрузки и ошибок
  if (isLoading && !articles) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
        <View style={styles.container}>
          <View style={styles.content}>
            {webPageHeading}
            <View style={{ padding: 16 }}>
              {Platform.OS !== 'web' && (
                <SkeletonLoader width={200} height={32} borderRadius={4} style={{ marginBottom: 24 }} />
              )}
              {Array.from({ length: 5 }).map((_, index) => (
                <View key={index} style={{ marginBottom: 16 }}>
                  <SkeletonLoader width="100%" height={120} borderRadius={12} />
                </View>
              ))}
            </View>
          </View>
        </View>
      </SafeAreaView>
    )
  }

  if (isError && !articles) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
        <View style={styles.container}>
          <View style={styles.content}>
            {webPageHeading}
            <ErrorDisplay
              message={error instanceof Error ? error.message : i18nT('shared:app.tabs.articles.ne_udalos_zagruzit_stati_0e12241c')}
              onRetry={() => refetch()}
              variant="error"
            />
          </View>
        </View>
      </SafeAreaView>
    )
  }

  if (!articles || !articles.data || articles.data.length === 0) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
        <View style={styles.container}>
          <View style={styles.content}>
            {webPageHeading}
            <EmptyState
              icon="file-text"
              title={i18nT('shared:app.tabs.articles.statey_poka_net_11eef9a2')}
              description={user_id ? i18nT('shared:app.tabs.articles.u_etogo_polzovatelya_poka_net_opublikovannyh_09fa84d1') : i18nT('shared:app.tabs.articles.poka_net_opublikovannyh_statey_76359aa9')}
              variant="empty"
            />
          </View>
        </View>
      </SafeAreaView>
    )
  }

  return (
      <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
        {isFocused && (
          <InstantSEO
            headKey="articles"
            title={pageTitle}
            description={i18nT('shared:app.tabs.articles.stati_puteshestvennikov_na_platforme_metrave_74ef2809')}
            canonical={buildCanonicalUrl('/articles')}
            image={buildOgImageUrl(DEFAULT_OG_IMAGE_PATH)}
            ogType="website"
            robots="noindex, nofollow"
          />
        )}
        <View style={styles.container}>
          <View style={styles.content}>
            {webPageHeading}
            {isError && (
              <ErrorDisplay
                message={error instanceof Error ? error.message : i18nT('shared:app.tabs.articles.ne_udalos_zagruzit_stati_0e12241c')}
                onRetry={() => refetch()}
                variant="warning"
              />
            )}
            {isFetching && (
              <View style={styles.loadingOverlay}>
                <ActivityIndicator size="small" color={colors.primaryDark} />
              </View>
            )}
            {Platform.OS === 'web' ? (
              <ScrollView
                style={[{ flex: 1, alignSelf: 'stretch' }, webTouchScrollStyle]}
                refreshControl={
                  <RefreshControl refreshing={isFetching} onRefresh={() => refetch()} />
                }
              >
                {articles?.data?.map((item: any, index: number) => (
                  <ArticleListItem
                    key={item?.id ? String(item.id) : String(index)}
                    article={item}
                    returnHref={articleListReturnHref}
                  />
                ))}
                <EmailSubscriptionForm source="article" clientOnly />
                <ContributionBanner variant="articles" />
              </ScrollView>
            ) : (
              <FlashList
                data={articles?.data}
                renderItem={({ item }: any) => (
                  <ArticleListItem article={item} returnHref={articleListReturnHref} />
                )}
                keyExtractor={(item: any, index: number) => (item?.id ? String(item.id) : String(index))}
                {...({ estimatedItemSize: 120 } as any)}
                ListFooterComponent={
                  <>
                    <EmailSubscriptionForm source="article" clientOnly />
                    <ContributionBanner variant="articles" />
                  </>
                }
                refreshing={isFetching}
                onRefresh={() => refetch()}
                drawDistance={600}
                style={{ flex: 1, alignSelf: 'stretch' }}
              />
            )}
            <PaginationComponent
              currentPage={currentPage}
              itemsPerPage={itemsPerPage}
              itemsPerPageOptions={itemsPerPageOptions}
              onPageChange={handlePageChange}
              onItemsPerPageChange={setItemsPerPage}
              totalItems={articles?.total ?? 0}
            />
          </View>
        </View>
      </SafeAreaView>
  )
}

const getStyles = (colors: ReturnType<typeof useThemedColors>) => {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.background,
    },
    container: {
      flex: 1,
      flexDirection: 'row',
      width: '100%',
      backgroundColor: colors.background,
    },
    content: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      width: '100%',
      backgroundColor: colors.surface,
    },
    centerContent: {
      justifyContent: 'center',
      alignItems: 'center',
    },
    loadingOverlay: {
      padding: 16,
      alignItems: 'center',
      backgroundColor: colors.surface,
    },
  })
}
