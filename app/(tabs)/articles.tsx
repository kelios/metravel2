import {ActivityIndicator, Dimensions, FlatList, SafeAreaView, StyleSheet,} from 'react-native'
import ArticleListItem from '@/components/ArticleListItem'
import React, {useEffect, useState} from 'react'
import {Articles} from '@/src/types/types'
import {fetchArticles} from '@/src/api/articles'
import {View} from '@/components/Themed'
import {DataTable} from 'react-native-paper'
import {useLocalSearchParams} from 'expo-router'
import ErrorDisplay from '@/components/ErrorDisplay'
import EmptyState from '@/components/EmptyState'

export default function TabOneScreen() {
  const initialPage = 0
  const windowWidth = Dimensions.get('window').width
  const styles = getStyles(windowWidth)

  const isMobile = windowWidth <= 768

  const [articles, setArticles] = useState<Articles | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const itemsPerPageOptions = [10, 20, 30, 50, 100]
  const [currentPage, setCurrentPage] = useState(initialPage)
  const [itemsPerPage, setItemsPerPage] = useState(itemsPerPageOptions[2])

  // 👇 безопасно получаем user_id
  const params = useLocalSearchParams()
  const user_id = typeof params.user_id === 'string' ? params.user_id : undefined

  // 👇 загрузка данных при пагинации или изменении user_id
  useEffect(() => {
    fetchMore()
  }, [currentPage, itemsPerPage])

  useEffect(() => {
    setCurrentPage(0)
  }, [itemsPerPage, user_id])

  const fetchMore = async () => {
    if (isLoading) return
    setIsLoading(true)
    setError(null)
    try {
    const newData = await fetchArticles(currentPage, itemsPerPage, {
      user_id,
    })
    setArticles(newData)
    } catch (err: any) {
      const errorMessage = err?.message || 'Не удалось загрузить статьи'
      setError(errorMessage)
      console.error('Ошибка загрузки статей:', err)
    } finally {
    setIsLoading(false)
    }
  }

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage)
  }

  // ✅ ИСПРАВЛЕНИЕ: Обработка состояний загрузки и ошибок
  if (isLoading && !articles) {
    return (
      <SafeAreaView style={{ flex: 1 }}>
        <View style={styles.container}>
          <View style={[styles.content, styles.centerContent]}>
            <ActivityIndicator size="large" color="#4a8c8c" />
          </View>
        </View>
      </SafeAreaView>
    )
  }

  if (error && !articles) {
    return (
      <SafeAreaView style={{ flex: 1 }}>
        <View style={styles.container}>
          <View style={styles.content}>
            <ErrorDisplay
              message={error}
              onRetry={fetchMore}
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
            {error && (
              <ErrorDisplay
                message={error}
                onRetry={fetchMore}
                onDismiss={() => setError(null)}
                variant="warning"
              />
            )}
            {isLoading && (
              <View style={styles.loadingOverlay}>
                <ActivityIndicator size="small" color="#4a8c8c" />
              </View>
            )}
            <FlatList
                data={articles?.data}
                renderItem={({ item }) => <ArticleListItem article={item} />}
                keyExtractor={(item, index) => index.toString()}
                refreshing={isLoading}
                onRefresh={fetchMore}
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

const getStyles = (windowWidth: number) => {
  return StyleSheet.create({
    container: {
      flex: 1,
      flexDirection: 'row',
      width: '100%',
      backgroundColor: 'white',
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
      backgroundColor: 'rgba(255, 255, 255, 0.9)',
    },
    containerPaginator: {
      marginTop: 10,
      paddingHorizontal: 10,
      backgroundColor: 'white',
      color: 'black',
      paddingBottom: windowWidth > 500 ? '7%' : '20%',
    },
  })
}
