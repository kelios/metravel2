import { useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  StyleSheet,
  SafeAreaView,
  Platform,
  ScrollView,
} from 'react-native'
import { Stack, useLocalSearchParams } from 'expo-router'
import { Article } from '@/types/types'
import ArticleRatingSection from '@/components/article/ArticleRatingSection'
import IframeRenderer, { iframeModel } from '@native-html/iframe-plugin'
import RenderHTML from 'react-native-render-html'
import { Card, Title } from '@/ui/paper'
import { fetchArticle } from '@/api/articles'
import { SafeHtml } from '@/components/article/SafeHtml'
import { useResponsive } from '@/hooks/useResponsive'
import { useThemedColors } from '@/hooks/useTheme'

export default function ArticleDetails() {
  const { width } = useResponsive()
  const colors = useThemedColors()
  const styles = useMemo(() => createStyles(colors), [colors])

  const NativeWebView = useMemo(() => {
    if (Platform.OS === 'web') return null
    return require('react-native-webview').WebView
  }, [])

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
        <ScrollView
            style={styles.container}
            contentContainerStyle={styles.contentContainer}
        >
          <Stack.Screen options={{ headerTitle: article.name }} />
          {article.description && (
              <Card style={styles.card}>
                <Card.Content>
                  <Title>{article.name}</Title>
                  {Platform.select({
                    web: (
                        <SafeHtml 
                            html={article.description}
                            style={{ marginTop: 16 }}
                        />
                    ),
                    default: (
                        <RenderHTML
                            source={{ html: article.description }}
                            contentWidth={width - 50}
                            renderers={{ iframe: IframeRenderer }}
                            customHTMLElementModels={{ iframe: iframeModel }}
                            WebView={NativeWebView as any}
                            defaultWebViewProps={{}}
                            renderersProps={{
                              iframe: {
                                scalesPageToFit: true,
                                webViewProps: {
                                  allowsFullScreen: true,
                                },
                              },
                            }}
                            tagsStyles={{
                              p: { marginTop: 15, marginBottom: 0 },
                              iframe: {
                                height: 1500,
                                width: 680,
                                overflow: 'hidden',
                                marginTop: 15,
                                borderRadius: 5,
                                marginHorizontal: 0,
                              },
                            }}
                        />
                    ),
                  })}
                  <ArticleRatingSection
                      articleId={id}
                      initialRating={article.rating}
                      initialCount={article.rating_count}
                      initialUserRating={article.user_rating}
                  />
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
