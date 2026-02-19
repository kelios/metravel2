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
import { extractArticleIdFromParam, fetchArticle, fetchArticleBySlug } from '@/api/articles'
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
  const routeParam = Array.isArray(params.id) ? String(params.id[0] ?? '') : String(params.id ?? '')
  const numericId = useMemo(() => extractArticleIdFromParam(routeParam), [routeParam])
  const normalizedSlug = useMemo(() => {
    const base = String(routeParam || '').trim().split('#')[0].split('?')[0]
    if (!/%[0-9A-Fa-f]{2}/.test(base)) return base
    try {
      return decodeURIComponent(base)
    } catch {
      return base
    }
  }, [routeParam])

  const [article, setArticle] = useState<Article | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setIsLoading(true)
      setErrorMessage(null)
      setArticle(null)

      try {
        let loadedArticle: Article | null = null

        if (numericId) {
          try {
            loadedArticle = await fetchArticle(numericId, { throwOnError: true })
          } catch (primaryError) {
            if (normalizedSlug && normalizedSlug !== String(numericId)) {
              loadedArticle = await fetchArticleBySlug(normalizedSlug, { throwOnError: true })
            } else {
              throw primaryError
            }
          }
        } else if (normalizedSlug) {
          loadedArticle = await fetchArticleBySlug(normalizedSlug, { throwOnError: true })
        }

        if (!loadedArticle?.id) {
          throw new Error('Статья не найдена')
        }

        if (!cancelled) {
          setArticle(loadedArticle)
        }
      } catch (error: any) {
        if (!cancelled) {
          setErrorMessage(error?.message || 'Не удалось загрузить статью')
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [numericId, normalizedSlug])

  if (isLoading) {
    return <ActivityIndicator />
  }

  if (!article || errorMessage) {
    return (
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView style={styles.container} contentContainerStyle={styles.centerContent}>
          <Title style={styles.errorTitle}>Статья не найдена</Title>
          <SafeHtml html={errorMessage || 'Проверьте ссылку на статью.'} />
        </ScrollView>
      </SafeAreaView>
    )
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
                      articleId={article.id as number}
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
    centerContent: {
      flexGrow: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 24,
    },
    errorTitle: {
      textAlign: 'center',
      marginBottom: 12,
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
