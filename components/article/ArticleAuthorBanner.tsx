import React, { memo, useCallback, useMemo } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'
import { useRouter, type Href } from 'expo-router'

import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme'
import type { Article } from '@/types/types'

const STRICT_PLACEHOLDER = /^[.\s·•]+$|^Автор|^Пользователь|^User/i
const LOOSE_PLACEHOLDER = /^[.\s·•]{4,}$|^Автор|^Пользователь|^User|^Anonymous/i

function cleanName(value: unknown, placeholder: RegExp): string {
  if (typeof value !== 'string') return ''
  const trimmed = value.trim()
  if (!trimmed || placeholder.test(trimmed)) return ''
  return trimmed
}

function normalizeAuthorId(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return String(value)
  }

  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null

  const first = trimmed.split(',')[0]?.trim()
  if (!first) return null
  const numeric = Number(first)
  if (Number.isFinite(numeric) && numeric > 0) return String(numeric)
  return encodeURIComponent(first)
}

export function resolveArticleAuthor(article: Article): {
  name: string
  userId: string | null
} {
  const rec = article as Record<string, unknown>
  const user = rec.user && typeof rec.user === 'object'
    ? (rec.user as Record<string, unknown>)
    : null

  const firstName = cleanName(user?.first_name, STRICT_PLACEHOLDER)
  const lastName = cleanName(user?.last_name, STRICT_PLACEHOLDER)
  const userObjectName = firstName
    ? [firstName, lastName].filter(Boolean).join(' ')
    : cleanName(user?.name, STRICT_PLACEHOLDER)

  const directName =
    userObjectName ||
    cleanName(rec.author_name, STRICT_PLACEHOLDER) ||
    cleanName(rec.authorName, STRICT_PLACEHOLDER) ||
    cleanName(rec.owner_name, STRICT_PLACEHOLDER) ||
    cleanName(rec.ownerName, STRICT_PLACEHOLDER) ||
    cleanName(rec.user_name, LOOSE_PLACEHOLDER) ||
    cleanName(rec.userName, LOOSE_PLACEHOLDER)

  const userIds = rec.userIds ?? rec.user_ids
  const userIdsFirst = Array.isArray(userIds) ? userIds[0] : userIds
  const userId =
    normalizeAuthorId(user?.id) ||
    normalizeAuthorId(rec.userId) ||
    normalizeAuthorId(rec.user_id) ||
    normalizeAuthorId(rec.authorId) ||
    normalizeAuthorId(rec.author_id) ||
    normalizeAuthorId(rec.ownerId) ||
    normalizeAuthorId(rec.owner_id) ||
    normalizeAuthorId(userIdsFirst)

  return { name: directName, userId }
}

type ArticleAuthorBannerProps = {
  article: Article
}

function ArticleAuthorBanner({ article }: ArticleAuthorBannerProps) {
  const router = useRouter()
  const colors = useThemedColors()
  const styles = useMemo(() => createStyles(colors), [colors])
  const author = useMemo(() => resolveArticleAuthor(article), [article])

  const handleOpenAuthorTravels = useCallback(() => {
    if (!author.userId) return
    router.push(`/search?user_id=${author.userId}` as Href)
  }, [author.userId, router])

  if (!author.name && !author.userId) return null

  const authorName = author.name || 'Автор путешествия'
  const content = (
    <>
      <View style={styles.iconWrap}>
        <Feather name="user" size={18} color={colors.primaryDark} />
      </View>
      <View style={styles.copy}>
        <Text style={styles.label}>Автор путешествия</Text>
        <Text style={styles.name} numberOfLines={2}>
          {authorName}
        </Text>
      </View>
      {!!author.userId && (
        <View style={styles.action}>
          <Feather name="map" size={15} color={colors.primaryDark} />
          <Text style={styles.actionText}>Путешествия автора</Text>
        </View>
      )}
    </>
  )

  if (!author.userId) {
    return (
      <View style={styles.container} accessibilityLabel={`Автор путешествия ${authorName}`}>
        {content}
      </View>
    )
  }

  return (
    <Pressable
      onPress={handleOpenAuthorTravels}
      accessibilityRole="button"
      accessibilityLabel={`Открыть путешествия автора ${authorName}`}
      style={({ pressed }) => [styles.container, pressed && styles.pressed]}
    >
      {content}
    </Pressable>
  )
}

const createStyles = (colors: ThemedColors) =>
  StyleSheet.create({
    container: {
      width: '100%',
      marginTop: DESIGN_TOKENS.spacing.md,
      marginBottom: DESIGN_TOKENS.spacing.sm,
      paddingVertical: DESIGN_TOKENS.spacing.md,
      paddingHorizontal: DESIGN_TOKENS.spacing.md,
      borderRadius: DESIGN_TOKENS.radii.md,
      borderWidth: 1,
      borderColor: colors.primaryAlpha30,
      backgroundColor: colors.primarySoft,
      flexDirection: 'row',
      alignItems: 'center',
      gap: DESIGN_TOKENS.spacing.sm,
      flexWrap: 'wrap',
    },
    pressed: {
      opacity: 0.84,
    },
    iconWrap: {
      width: 38,
      height: 38,
      borderRadius: DESIGN_TOKENS.radii.full,
      borderWidth: 1,
      borderColor: colors.primaryAlpha30,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    copy: {
      flex: 1,
      minWidth: 160,
      gap: 2,
    },
    label: {
      color: colors.textSecondary,
      fontSize: DESIGN_TOKENS.typography.sizes.xs,
      lineHeight: 16,
      fontWeight: '700',
      textTransform: 'uppercase',
    },
    name: {
      color: colors.text,
      fontSize: DESIGN_TOKENS.typography.sizes.lg,
      lineHeight: 24,
      fontWeight: '800',
    },
    action: {
      minHeight: 34,
      borderRadius: DESIGN_TOKENS.radii.full,
      borderWidth: 1,
      borderColor: colors.primaryAlpha30,
      backgroundColor: colors.surface,
      paddingHorizontal: DESIGN_TOKENS.spacing.sm,
      flexDirection: 'row',
      alignItems: 'center',
      gap: DESIGN_TOKENS.spacing.xs,
    },
    actionText: {
      color: colors.primaryDark,
      fontSize: DESIGN_TOKENS.typography.sizes.sm,
      lineHeight: 18,
      fontWeight: '800',
    },
  })

export default memo(ArticleAuthorBanner)
