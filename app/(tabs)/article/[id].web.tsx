import { useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  StyleSheet,
  ScrollView,
} from 'react-native'
import { Stack, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Article } from '@/types/types'
import { Card, Title } from '@/ui/paper'
import ArticleActivationCtaSection from '@/components/article/ArticleActivationCtaSection'
import ArticleAuthorBanner from '@/components/article/ArticleAuthorBanner'
import { extractArticleIdFromParam, fetchArticle, fetchArticleBySlug } from '@/api/articles'
import { SafeHtml } from '@/components/article/SafeHtml'
import { useFavorites } from '@/context/FavoritesContext'
import { useThemedColors } from '@/hooks/useTheme'
import InstantSEO from '@/components/seo/LazyInstantSEO'
import { buildCanonicalUrl } from '@/utils/seo'
import { stripToDescription } from '@/components/travel/utils/travelHelpers'
import { resolveServerRichTextHtml } from '@/utils/serverSafeHtml'
import { webTouchScrollStyle } from '@/utils'

export default function ArticleDetails() {
  const colors = useThemedColors()
  const styles = useMemo(() => createStyles(colors), [colors])
  const { addToHistory } = useFavorites()

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
  const routeKey = useMemo(() => {
    if (numericId) return String(numericId)
    return normalizedSlug
  }, [numericId, normalizedSlug])

  const [article, setArticle] = useState<Article | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const articlePath = useMemo(() => {
    if (article?.slug) return `/article/${article.slug}`
    if (routeKey) return `/article/${routeKey}`
    if (article?.id) return `/article/${article.id}`
    return undefined
  }, [article?.id, article?.slug, routeKey])

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

  const seo = useMemo(() => {
    const hasResolvedArticle = Boolean(article?.id) && !errorMessage
    const title = hasResolvedArticle && article?.name
      ? `${article.name} | MeTravel`
      : 'Статья не найдена | Metravel'
    const description = hasResolvedArticle
      ? stripToDescription(article?.description)
      : 'Статья не найдена. Проверьте ссылку или вернитесь к списку статей Metravel.'
    const canonicalKey = article?.id || routeKey
    const canonical = hasResolvedArticle && canonicalKey
      ? buildCanonicalUrl(`/article/${canonicalKey}`)
      : buildCanonicalUrl('/articles')
    const image = hasResolvedArticle ? article?.article_image_thumb_url || undefined : undefined
    const jsonLd = article ? {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: article.name,
      description,
      ...(canonical ? { url: canonical } : {}),
      ...(article.article_image_thumb_url ? { image: article.article_image_thumb_url } : {}),
      publisher: {
        '@type': 'Organization',
        name: 'MeTravel',
        url: 'https://metravel.by',
      },
    } : null
    const robots = hasResolvedArticle ? undefined : 'noindex, nofollow'
    return { title, description, canonical, image, jsonLd, robots }
  }, [article, errorMessage, routeKey])

  // ⚠️ CRITICAL: InstantSEO must render from the FIRST render, not after async data loads.
  // react-helmet-async has a race condition on direct page loads: if a Helmet instance
  // mounts late (after requestAnimationFrame), meta tags are committed as empty.
  const seoBlock = (
    <InstantSEO
      headKey={`article-${routeKey || 'unknown'}`}
      title={seo.title}
      description={seo.description}
      canonical={seo.canonical}
      image={seo.image}
      ogType="article"
      robots={seo.robots}
      additionalTags={
        seo.jsonLd ? (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(seo.jsonLd) }}
          />
        ) : undefined
      }
    />
  )

  if (isLoading) {
    return <>{seoBlock}<ActivityIndicator /></>
  }

  if (!article || errorMessage) {
    return (
      <>
        {seoBlock}
        <SafeAreaView style={{ flex: 1 }}>
          <ScrollView style={[styles.container, webTouchScrollStyle]} contentContainerStyle={styles.centerContent}>
            <Title style={styles.errorTitle}>Статья не найдена</Title>
            <SafeHtml html={errorMessage || 'Проверьте ссылку на статью.'} />
          </ScrollView>
        </SafeAreaView>
      </>
    )
  }

  // #709: canonical rich_text.description.safe_html с бэка, description — fallback
  const articleContent = resolveServerRichTextHtml(article.rich_text?.description, article.description)

  return (
    <>
      {seoBlock}
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView style={[styles.container, webTouchScrollStyle]} contentContainerStyle={styles.contentContainer}>
          <Stack.Screen options={{ headerTitle: article.name }} />
          {articleContent.html && (
            <Card style={styles.card}>
              <Card.Content>
                <h1 style={{ fontSize: 18, fontWeight: '700', margin: 0 } as any}>{article.name}</h1>
                <ArticleAuthorBanner article={article} />
                <SafeHtml html={articleContent.html} serverSanitized={articleContent.serverSanitized} style={{ marginTop: 16 }} />
                <ArticleActivationCtaSection article={article} redirectPath={articlePath} />
              </Card.Content>
            </Card>
          )}
        </ScrollView>
      </SafeAreaView>
    </>
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
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 24,
    },
    centerContent: {
      flexGrow: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 24,
      gap: 12,
    },
    errorTitle: {
      textAlign: 'center',
    },
    card: {
      width: '100%',
      elevation: 5,
      backgroundColor: colors.surface,
      borderRadius: 10,
      maxWidth: 960,
      borderWidth: 1,
      borderColor: colors.border,
    },
  })
