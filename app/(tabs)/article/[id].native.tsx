import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  StyleSheet,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native'
import Feather from '@expo/vector-icons/Feather'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Article } from '@/types/types'
import IframeRenderer, { iframeModel } from '@native-html/iframe-plugin'
import RenderHTML from 'react-native-render-html'
import { WebView } from 'react-native-webview'
import { Card, Title } from '@/ui/paper'
import { extractArticleIdFromParam, fetchArticle, fetchArticleBySlug } from '@/api/articles'
import { SafeHtml } from '@/components/article/SafeHtml'
import { useResponsive } from '@/hooks/useResponsive'
import { useThemedColors } from '@/hooks/useTheme'
import { useAndroidBackHandler } from '@/hooks/useAndroidBackHandler'
import { handleRichTextLinkPress } from '@/utils/internalLinks'
import { normalizeArticleReturnHref } from '@/utils/articleNavigation'

export default function ArticleDetails() {
  const { width } = useResponsive()
  const colors = useThemedColors()
  const styles = useMemo(() => createStyles(colors), [colors])
  const router = useRouter()

  const params = useLocalSearchParams()
  const routeParam = Array.isArray(params.id) ? String(params.id[0] ?? '') : String(params.id ?? '')
  const returnHref = useMemo(() => normalizeArticleReturnHref(params.from), [params.from])
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

  const handleBack = useCallback(() => {
    if (returnHref) {
      if (router.canGoBack()) {
        router.back()
        return
      }
      router.replace(returnHref)
      return
    }
    if (router.canGoBack()) {
      router.back()
      return
    }
    router.replace('/articles')
  }, [returnHref, router])

  const handleAndroidBack = useCallback(() => {
    if (!returnHref) return false
    if (router.canGoBack()) {
      router.back()
      return true
    }
    router.replace(returnHref)
    return true
  }, [returnHref, router])

  useAndroidBackHandler(handleAndroidBack)

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
    return (
      <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
        <Stack.Screen options={{ headerTitle: 'Статья', headerBackVisible: false }} />
        <ArticleBackButton colors={colors} onPress={handleBack} styles={styles} />
        <ActivityIndicator style={styles.loader} color={colors.primary} />
      </SafeAreaView>
    )
  }

  if (!article || errorMessage) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
        <Stack.Screen options={{ headerTitle: 'Статья не найдена', headerBackVisible: false }} />
        <ArticleBackButton colors={colors} onPress={handleBack} styles={styles} />
        <ScrollView style={styles.container} contentContainerStyle={styles.centerContent}>
          <Title style={styles.errorTitle}>Статья не найдена</Title>
          <SafeHtml html={errorMessage || 'Проверьте ссылку на статью.'} />
        </ScrollView>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
      <Stack.Screen options={{ headerTitle: article.name, headerBackVisible: false }} />
      <ArticleBackButton colors={colors} onPress={handleBack} styles={styles} />
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
        {article.description && (
          <Card style={styles.card}>
            <Card.Content>
              <Title>{article.name}</Title>
              {Platform.select({
                web: (
                  <SafeHtml html={article.description} style={{ marginTop: 16 }} />
                ),
                default: (
                  <RenderHTML
                    source={{ html: article.description }}
                    contentWidth={width - 50}
                    renderers={{ iframe: IframeRenderer }}
                    customHTMLElementModels={{ iframe: iframeModel }}
                    WebView={WebView}
                    defaultWebViewProps={{}}
                    renderersProps={{
                      iframe: {
                        scalesPageToFit: true,
                        webViewProps: {
                          allowsFullScreen: true,
                        },
                      },
                      a: {
                        // Внутренние ссылки открываем в приложении, внешние — в браузере
                        onPress: (_event: any, href: string) => handleRichTextLinkPress(href),
                      },
                    }}
                    baseStyle={{ color: colors.text }}
                    tagsStyles={{
                      p: { marginTop: 15, marginBottom: 0 },
                      a: { color: colors.primary },
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
            </Card.Content>
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

function ArticleBackButton({
  colors,
  onPress,
  styles,
}: {
  colors: ReturnType<typeof useThemedColors>
  onPress: () => void
  styles: ReturnType<typeof createStyles>
}) {
  return (
    <View style={styles.topBar}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel="Вернуться назад"
        style={({ pressed }) => [styles.backButton, pressed && styles.backButtonPressed]}
      >
        <Feather name="arrow-left" size={18} color={colors.text} />
        <Text style={styles.backButtonText}>Назад</Text>
      </Pressable>
    </View>
  )
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.background,
    },
    loader: {
      flex: 1,
    },
    topBar: {
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 4,
      backgroundColor: colors.background,
    },
    backButton: {
      minHeight: 40,
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderRadius: 20,
      paddingHorizontal: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    backButtonPressed: {
      opacity: 0.82,
    },
    backButtonText: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '700',
    },
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
