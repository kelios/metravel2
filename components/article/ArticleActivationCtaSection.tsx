import React, { memo, useCallback, useMemo, useState } from 'react'
import { Platform, StyleSheet, Text, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'
import { useRouter } from 'expo-router'

import Button from '@/components/ui/Button'
import { useAuth } from '@/context/AuthContext'
import { useFavorites } from '@/context/FavoritesContext'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme'
import type { Article } from '@/types/types'
import { buildRegistrationHref } from '@/utils/authNavigation'
import { saveGuestFavoriteIntent } from '@/utils/guestFavoriteIntent'
import {
  trackContentCreateCtaClicked,
  trackFavoriteIntentGuest,
  trackRegisterCtaClicked,
} from '@/utils/growthFunnelAnalytics'

type ArticleActivationCtaSectionProps = {
  article: Article
  redirectPath?: string
}

const ARTICLE_SOURCE = 'article_detail'
const ADD_PLACE_PATH = '/travel/new'

const getArticleUrl = (article: Article, redirectPath?: string) => {
  if (redirectPath) return redirectPath
  if (article.slug) return `/article/${article.slug}`
  if (article.id) return `/article/${article.id}`
  return '/articles'
}

function ArticleActivationCtaSection({ article, redirectPath }: ArticleActivationCtaSectionProps) {
  const router = useRouter()
  const { isAuthenticated } = useAuth()
  const { addFavorite, isFavorite } = useFavorites()
  const colors = useThemedColors()
  const styles = useMemo(() => createStyles(colors), [colors])
  const [isSaving, setIsSaving] = useState(false)

  const articleId = article.id ?? article.slug ?? article.name
  const articleUrl = getArticleUrl(article, redirectPath)
  const favoriteSaved = isFavorite(articleId, 'article')
  const authState = isAuthenticated ? 'authenticated' : 'guest'

  const handleSaveArticle = useCallback(async () => {
    if (favoriteSaved || isSaving) return

    if (!isAuthenticated) {
      trackFavoriteIntentGuest({
        itemType: 'article',
        itemId: articleId,
        source: ARTICLE_SOURCE,
        url: articleUrl,
      })
      trackRegisterCtaClicked({ source: ARTICLE_SOURCE, intent: 'favorite_article', authState: 'guest' })
      void saveGuestFavoriteIntent({
        id: String(articleId),
        type: 'article',
        title: article.name,
        imageUrl: article.article_image_thumb_url,
        url: articleUrl,
        source: ARTICLE_SOURCE,
      })
      router.push(buildRegistrationHref({ redirect: articleUrl, intent: 'favorite' }) as never)
      return
    }

    setIsSaving(true)
    try {
      await addFavorite({
        id: articleId,
        type: 'article',
        title: article.name,
        imageUrl: article.article_image_thumb_url,
        url: articleUrl,
      })
    } finally {
      setIsSaving(false)
    }
  }, [
    addFavorite,
    article.article_image_thumb_url,
    article.name,
    articleId,
    articleUrl,
    favoriteSaved,
    isAuthenticated,
    isSaving,
    router,
  ])

  const handleAddPlace = useCallback(() => {
    trackContentCreateCtaClicked({
      contentType: 'route',
      source: ARTICLE_SOURCE,
      authState,
      intent: 'add-place',
      action: isAuthenticated ? 'create' : 'register',
    })

    if (!isAuthenticated) {
      trackRegisterCtaClicked({ source: ARTICLE_SOURCE, intent: 'add-place', authState: 'guest' })
      router.push(buildRegistrationHref({ redirect: ADD_PLACE_PATH, intent: 'add-place' }) as never)
      return
    }

    router.push(ADD_PLACE_PATH as never)
  }, [authState, isAuthenticated, router])

  return (
    <View
      style={styles.container}
      accessibilityLabel="Сохраните идею поездки"
      accessibilityRole={Platform.OS === 'web' ? ('region' as any) : undefined}
    >
      <View style={styles.iconWrap}>
        <Feather name="bookmark" size={20} color={colors.primaryDark} />
      </View>
      <View style={styles.copy}>
        <Text
          style={styles.heading}
          accessibilityRole={Platform.OS === 'web' ? ('heading' as any) : undefined}
          aria-level={2 as any}
        >
          Сохраните идею поездки
        </Text>
        <Text style={styles.subtitle}>
          Вернитесь к статье позже или добавьте своё место на карту путешественников.
        </Text>
      </View>
      <View style={styles.actions}>
        <Button
          label={favoriteSaved ? 'Статья сохранена' : 'Сохранить статью'}
          onPress={handleSaveArticle}
          variant="primary"
          size="md"
          loading={isSaving}
          disabled={favoriteSaved}
          fullWidth
          icon={<Feather name={favoriteSaved ? 'check' : 'heart'} size={16} color={colors.textOnPrimary} />}
          accessibilityLabel={favoriteSaved ? 'Статья уже сохранена' : 'Сохранить статью в избранное'}
        />
        <Button
          label="Добавить место"
          onPress={handleAddPlace}
          variant="outline"
          size="md"
          fullWidth
          icon={<Feather name="plus" size={16} color={colors.primary} />}
          accessibilityLabel="Добавить место на карту"
        />
      </View>
    </View>
  )
}

const createStyles = (colors: ThemedColors) =>
  StyleSheet.create({
    container: {
      width: '100%',
      marginTop: DESIGN_TOKENS.spacing.lg,
      padding: DESIGN_TOKENS.spacing.lg,
      borderWidth: 1,
      borderColor: colors.primaryAlpha30,
      borderRadius: DESIGN_TOKENS.radii.lg,
      backgroundColor: colors.surface,
      gap: DESIGN_TOKENS.spacing.md,
    },
    iconWrap: {
      width: 40,
      height: 40,
      borderRadius: DESIGN_TOKENS.radii.full,
      backgroundColor: colors.primarySoft,
      borderWidth: 1,
      borderColor: colors.primaryAlpha30,
      alignItems: 'center',
      justifyContent: 'center',
    },
    copy: {
      gap: DESIGN_TOKENS.spacing.xs,
    },
    heading: {
      color: colors.text,
      fontSize: DESIGN_TOKENS.typography.sizes.xl,
      lineHeight: 26,
      fontWeight: '800',
    },
    subtitle: {
      color: colors.textSecondary,
      fontSize: DESIGN_TOKENS.typography.sizes.md,
      lineHeight: 22,
    },
    actions: {
      flexDirection: 'row',
      gap: DESIGN_TOKENS.spacing.sm,
      flexWrap: 'wrap',
    },
  })

export default memo(ArticleActivationCtaSection)
