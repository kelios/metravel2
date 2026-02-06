import { useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  StyleSheet,
  SafeAreaView,
  ScrollView,
} from 'react-native'
import { Stack, useLocalSearchParams } from 'expo-router'
import { Article } from '@/src/types/types'
import { Card, Title } from '@/src/ui/paper'
import { fetchArticle } from '@/src/api/articles'
import { SafeHtml } from '@/components/article/SafeHtml'
import { useThemedColors } from '@/hooks/useTheme'

export default function ArticleDetails() {
  const colors = useThemedColors()
  const styles = useMemo(() => createStyles(colors), [colors])

  const params = useLocalSearchParams()
  const id = typeof params.id === 'string' ? Number(params.id) : undefined

  const [article, setArticle] = useState<Article | null>(null)

  useEffect(() => {
    if (!id) return

    fetchArticle(id)
      .then((articleData) => {
        setArticle(articleData)
      })
      .catch((error) => {
        console.error('Failed to fetch article data:', error)
      })
  }, [id])

  if (!article) {
    return <ActivityIndicator />
  }

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
        <Stack.Screen options={{ headerTitle: article.name }} />
        {article.description && (
          <Card style={styles.card}>
            <Card.Content>
              <Title>{article.name}</Title>
              <SafeHtml html={article.description} style={{ marginTop: 16 }} />
            </Card.Content>
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    contentContainer: {
      flexGrow: 1,
      justifyContent: 'center',
    },
    card: {
      margin: 20,
      elevation: 5,
      backgroundColor: colors.surface,
      borderRadius: 10,
      maxWidth: 800,
      borderWidth: 1,
      borderColor: colors.border,
    },
  })
