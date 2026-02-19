import { useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  StyleSheet,
  SafeAreaView,
  ScrollView,
} from 'react-native'
import { Stack, useLocalSearchParams } from 'expo-router'
import { useIsFocused } from '@react-navigation/native'
import { Article } from '@/types/types'
import { Card, Title } from '@/ui/paper'
import { extractArticleIdFromParam, fetchArticle, fetchArticleBySlug } from '@/api/articles'
import { SafeHtml } from '@/components/article/SafeHtml'
import { useThemedColors } from '@/hooks/useTheme'
import InstantSEO from '@/components/seo/LazyInstantSEO'
import { buildCanonicalUrl } from '@/utils/seo'
import { stripToDescription } from '@/components/travel/utils/travelHelpers'

export default function ArticleDetails() {
  const colors = useThemedColors()
  const styles = useMemo(() => createStyles(colors), [colors])
  const isFocused = useIsFocused()

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

  const seo = useMemo(() => {
    const title = article?.name ? `${article.name} | MeTravel` : 'MeTravel'
    const description = stripToDescription(article?.description)
    const canonicalKey = article?.id || routeKey
    const canonical = canonicalKey ? buildCanonicalUrl(`/article/${canonicalKey}`) : buildCanonicalUrl('/articles')
    const image = article?.article_image_thumb_url || undefined
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
    return { title, description, canonical, image, jsonLd }
  }, [article, routeKey])

  // ⚠️ CRITICAL: InstantSEO must render from the FIRST render, not after async data loads.
  // react-helmet-async has a race condition on direct page loads: if a Helmet instance
  // mounts late (after requestAnimationFrame), meta tags are committed as empty.
  const seoBlock = isFocused ? (
    <InstantSEO
      headKey={`article-${routeKey || 'unknown'}`}
      title={seo.title}
      description={seo.description}
      canonical={seo.canonical}
      image={seo.image}
      ogType="article"
      additionalTags={
        seo.jsonLd ? (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(seo.jsonLd) }}
          />
        ) : undefined
      }
    />
  ) : null

  if (isLoading) {
    return <>{seoBlock}<ActivityIndicator /></>
  }

  if (!article || errorMessage) {
    return (
      <>
        {seoBlock}
        <SafeAreaView style={{ flex: 1 }}>
          <ScrollView style={styles.container} contentContainerStyle={styles.centerContent}>
            <Title style={styles.errorTitle}>Статья не найдена</Title>
            <SafeHtml html={errorMessage || 'Проверьте ссылку на статью.'} />
          </ScrollView>
        </SafeAreaView>
      </>
    )
  }

  return (
    <>
      {seoBlock}
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
      justifyContent: 'center',
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
      margin: 20,
      elevation: 5,
      backgroundColor: colors.surface,
      borderRadius: 10,
      maxWidth: 800,
      borderWidth: 1,
      borderColor: colors.border,
    },
  })
