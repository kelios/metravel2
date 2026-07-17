import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  StyleSheet,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native'
import Feather from '@expo/vector-icons/Feather'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Article } from '@/types/types'
import ArticleActivationCtaSection from '@/components/article/ArticleActivationCtaSection'
import ArticleNextStepSection from '@/components/article/ArticleNextStepSection'
import ArticleAuthorBanner from '@/components/article/ArticleAuthorBanner'
import StableContent from '@/components/travel/StableContent'
import { Card, Title } from '@/ui/paper'
import { extractArticleIdFromParam, fetchArticle, fetchArticleBySlug } from '@/api/articles'
import { SafeHtml } from '@/components/article/SafeHtml'
import { useFavorites } from '@/context/FavoritesContext'
import { useResponsive } from '@/hooks/useResponsive'
import { useThemedColors } from '@/hooks/useTheme'
import { useContentScrollAnalytics } from '@/hooks/useContentScrollAnalytics'
import { useAndroidBackHandler } from '@/hooks/useAndroidBackHandler'
import { normalizeArticleReturnHref } from '@/utils/articleNavigation'
import { resolveServerRichTextHtml } from '@/utils/serverSafeHtml'
import { translate as i18nT } from '@/i18n'


export default function ArticleDetails() {
  const { width } = useResponsive()
  const colors = useThemedColors()
  const styles = useMemo(() => createStyles(colors), [colors])
  const router = useRouter()
  const { addToHistory } = useFavorites()

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
  const articlePath = useMemo(() => {
    if (article?.slug) return `/article/${article.slug}`
    if (numericId) return `/article/${numericId}`
    if (normalizedSlug) return `/article/${normalizedSlug}`
    if (article?.id) return `/article/${article.id}`
    return undefined
  }, [article?.id, article?.slug, normalizedSlug, numericId])
  const handleContentScroll = useContentScrollAnalytics({
    source: 'article_detail',
    contentType: 'article',
    contentId: article?.id ?? normalizedSlug,
  })

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
          throw new Error(i18nT('shared:app.tabs.article.id.statya_ne_naydena_fda21643'))
        }

        if (!cancelled) {
          setArticle(loadedArticle)
        }
      } catch (error: any) {
        if (!cancelled) {
          setErrorMessage(error?.message || i18nT('sharedStatic:article.loadFailed'))
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

  useEffect(() => {
    if (!article || !articlePath) return

    void addToHistory({
      id: article.id ?? article.slug ?? articlePath,
      type: 'article',
      title: article.name,
      imageUrl: article.article_image_thumb_url || article.article_image_thumb_small_url,
      url: articlePath,
    })
  }, [addToHistory, article, articlePath])

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
        <Stack.Screen options={{ headerTitle: i18nT('shared:app.tabs.article.id.statya_319c91fe'), headerBackVisible: false }} />
        <ArticleBackButton colors={colors} onPress={handleBack} styles={styles} />
        <ActivityIndicator style={styles.loader} color={colors.primaryDark} />
      </SafeAreaView>
    )
  }

  if (!article || errorMessage) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
        <Stack.Screen options={{ headerTitle: i18nT('shared:app.tabs.article.id.statya_ne_naydena_fda21643'), headerBackVisible: false }} />
        <ArticleBackButton colors={colors} onPress={handleBack} styles={styles} />
        <ScrollView style={styles.container} contentContainerStyle={styles.centerContent}>
          <Title style={styles.errorTitle}>{i18nT('shared:app.tabs.article.id.statya_ne_naydena_fda21643')}</Title>
          <SafeHtml html={errorMessage || i18nT('sharedStatic:article.checkLink')} />
        </ScrollView>
      </SafeAreaView>
    )
  }

  // #709: canonical rich_text.description.safe_html с бэка, description — fallback
  const articleContent = resolveServerRichTextHtml(article.rich_text?.description, article.description)

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
      {/* Нативный header скрыт: заголовок и «Назад» дают собственный бар (правильная
          логика возврата, #573/#616) + один in-body <Title>. Иначе тройной заголовок. */}
      <Stack.Screen options={{ headerShown: false }} />
      <ArticleBackButton colors={colors} onPress={handleBack} styles={styles} />
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        onScroll={handleContentScroll}
        scrollEventThrottle={48}
      >
        {articleContent.html && (
          <Card style={styles.card}>
            <Card.Content>
              <Title>{article.name}</Title>
              <ArticleAuthorBanner article={article} />
              <ArticleNextStepSection articleId={article.id ?? article.slug} />
              <View style={styles.richTextWrap}>
                <StableContent
                  html={articleContent.html}
                  serverSanitized={articleContent.serverSanitized}
                  contentWidth={Math.max(width - 50, 240)}
                />
              </View>
              <ArticleActivationCtaSection article={article} redirectPath={articlePath} />
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
        accessibilityLabel={i18nT('shared:app.tabs.article.id.vernutsya_nazad_83adf0e0')}
        style={({ pressed }) => [styles.backButton, pressed && styles.backButtonPressed]}
      >
        <Feather name="arrow-left" size={18} color={colors.text} />
        <Text style={styles.backButtonText}>{i18nT('shared:app.tabs.article.id.nazad_0a43c186')}</Text>
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
    richTextWrap: {
      marginTop: 16,
    },
  })
