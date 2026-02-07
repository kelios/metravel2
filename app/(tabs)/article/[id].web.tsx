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
import { fetchArticle } from '@/api/articles'
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

  const seo = useMemo(() => {
    const title = article?.name ? `${article.name} | MeTravel` : 'MeTravel'
    const description = stripToDescription(article?.description)
    const canonical = buildCanonicalUrl(`/article/${id}`)
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
  }, [article, id])

  // ⚠️ CRITICAL: InstantSEO must render from the FIRST render, not after async data loads.
  // react-helmet-async has a race condition on direct page loads: if a Helmet instance
  // mounts late (after requestAnimationFrame), meta tags are committed as empty.
  const seoBlock = isFocused ? (
    <InstantSEO
      headKey={`article-${id}`}
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

  if (!article) {
    return <>{seoBlock}<ActivityIndicator /></>
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
