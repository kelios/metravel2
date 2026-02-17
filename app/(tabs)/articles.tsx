import {ActivityIndicator, SafeAreaView, StyleSheet, View, Platform, ScrollView, RefreshControl} from 'react-native'
import ArticleListItem from '@/components/article/ArticleListItem'
import {useEffect, useMemo, useState} from 'react'
import {Articles} from '@/types/types'
import { SkeletonLoader } from '@/components/ui/SkeletonLoader'
import {fetchArticles} from '@/api/articles'
import PaginationComponent from '@/components/ui/PaginationComponent'
import {useLocalSearchParams} from 'expo-router'
import ErrorDisplay from '@/components/ui/ErrorDisplay'
import EmptyState from '@/components/ui/EmptyState'
import { useThemedColors } from '@/hooks/useTheme'
import { FlashList } from '@shopify/flash-list'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { queryConfigs } from '@/utils/reactQueryConfig'
import { queryKeys } from '@/queryKeys'
import { useIsFocused } from '@react-navigation/native'
import InstantSEO from '@/components/seo/LazyInstantSEO'
import { buildCanonicalUrl, buildOgImageUrl, DEFAULT_OG_IMAGE_PATH } from '@/utils/seo'

export default function TabOneScreen() {
  const initialPage = 0
  const isFocused = useIsFocused()
  const colors = useThemedColors()
  const styles = useMemo(() => getStyles(colors), [colors])

  const itemsPerPageOptions = [10, 20, 30, 50, 100]
  const [currentPage, setCurrentPage] = useState(initialPage)
  const [itemsPerPage, setItemsPerPage] = useState(itemsPerPageOptions[2])

  // 👇 безопасно получаем user_id
  const params = useLocalSearchParams()
  const user_id = typeof params.user_id === 'string' ? params.user_id : undefined

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
      <SafeAreaView style={{ flex: 1 }}>
        <View style={styles.container}>
          <View style={styles.content}>
            <View style={{ padding: 16 }}>
              <SkeletonLoader width={200} height={32} borderRadius={4} style={{ marginBottom: 24 }} />
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
      <SafeAreaView style={{ flex: 1 }}>
        <View style={styles.container}>
          <View style={styles.content}>
            <ErrorDisplay
              message={error instanceof Error ? error.message : 'Не удалось загрузить статьи'}
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
      <SafeAreaView style={{ flex: 1 }}>
        <View style={styles.container}>
          <View style={styles.content}>
            <EmptyState
              icon="file-text"
              title="Статей пока нет"
              description={user_id ? "У этого пользователя пока нет опубликованных статей" : "Пока нет опубликованных статей"}
              variant="empty"
            />
          </View>
        </View>
      </SafeAreaView>
    )
  }

  return (
      <SafeAreaView style={{ flex: 1 }}>
        {isFocused && (
          <InstantSEO
            headKey="articles"
            title="Статьи | Metravel"
            description="Статьи путешественников на платформе Metravel — советы, истории и полезные материалы."
            canonical={buildCanonicalUrl('/articles')}
            image={buildOgImageUrl(DEFAULT_OG_IMAGE_PATH)}
            ogType="website"
          />
        )}
        <View style={styles.container}>
          <View style={styles.content}>
            {isError && (
              <ErrorDisplay
                message={error instanceof Error ? error.message : 'Не удалось загрузить статьи'}
                onRetry={() => refetch()}
                variant="warning"
              />
            )}
            {isFetching && (
              <View style={styles.loadingOverlay}>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            )}
            {Platform.OS === 'web' ? (
              <ScrollView
                style={{ flex: 1, alignSelf: 'stretch' }}
                refreshControl={
                  <RefreshControl refreshing={isFetching} onRefresh={() => refetch()} />
                }
              >
                {articles?.data?.map((item: any, index: number) => (
                  <ArticleListItem key={item?.id ? String(item.id) : String(index)} article={item} />
                ))}
              </ScrollView>
            ) : (
              <FlashList
                data={articles?.data}
                renderItem={({ item }: any) => <ArticleListItem article={item} />}
                keyExtractor={(item: any, index: number) => (item?.id ? String(item.id) : String(index))}
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
