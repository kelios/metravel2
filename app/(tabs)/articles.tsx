import {ActivityIndicator, Dimensions, SafeAreaView, StyleSheet, View} from 'react-native'
import ArticleListItem from '@/components/ArticleListItem'
import {useEffect, useMemo, useState} from 'react'
import {Articles} from '@/src/types/types'
import { SkeletonLoader } from '@/components/SkeletonLoader'
import {fetchArticles} from '@/src/api/articles'
import {DataTable} from '@/src/ui/paper'
import {useLocalSearchParams} from 'expo-router'
import ErrorDisplay from '@/components/ErrorDisplay'
import EmptyState from '@/components/EmptyState'
import { useThemedColors } from '@/hooks/useTheme'
import { FlashList } from '@shopify/flash-list'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { queryConfigs } from '@/src/utils/reactQueryConfig'

export default function TabOneScreen() {
  const initialPage = 0
  const windowWidth = Dimensions.get('window').width
  const colors = useThemedColors()
  const styles = useMemo(() => getStyles(windowWidth, colors), [windowWidth, colors])

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
    queryKey: ['articles', { page: currentPage, itemsPerPage, user_id }],
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
            <FlashList
              data={articles?.data}
              renderItem={({ item }: any) => <ArticleListItem article={item} />}
              keyExtractor={(item: any, index: number) => (item?.id ? String(item.id) : String(index))}
              refreshing={isFetching}
              onRefresh={() => refetch()}
              drawDistance={Dimensions.get('window').width > 900 ? 900 : 600}
              style={{ flex: 1, alignSelf: 'stretch' }}
            />
            <View style={styles.containerPaginator}>
              <DataTable>
                <DataTable.Pagination
                    page={currentPage}
                    numberOfPages={Math.ceil(articles?.total / itemsPerPage) ?? 20}
                    onPageChange={(page) => handlePageChange(page)}
                    label={`${currentPage + 1} of ${Math.ceil(
                        articles?.total / itemsPerPage,
                    )}`}
                    showFastPaginationControls
                    numberOfItemsPerPageList={itemsPerPageOptions}
                    numberOfItemsPerPage={itemsPerPage}
                    onItemsPerPageChange={setItemsPerPage}
                    style={{ flexWrap: 'nowrap' }}
                />
              </DataTable>
            </View>
          </View>
        </View>
      </SafeAreaView>
  )
}

const getStyles = (windowWidth: number, colors: ReturnType<typeof useThemedColors>) => {
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
      backgroundColor: 'white',
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
    containerPaginator: {
      marginTop: 10,
      paddingHorizontal: 10,
      backgroundColor: colors.surface,
      color: colors.text,
      paddingBottom: windowWidth > 500 ? '7%' : '20%',
    },
  })
}
