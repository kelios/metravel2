import React, { memo, useCallback, useMemo } from 'react'
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import Feather from '@expo/vector-icons/Feather'

import ImageCardMedia from '@/components/ui/ImageCardMedia'
import { resolveTravelAuthorName } from '@/components/listTravel/travelListItemHelpers'
import { resolveAvatar, resolveOwnerId } from '@/components/travel/compactSideBar/helpers'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useThemedColors } from '@/hooks/useTheme'
import type { Travel } from '@/types/types'
import { getTravelLabel } from '@/utils/pluralize'
import { routes } from '@/utils/routes'

const AVATAR_SIZE = 44

type TravelAuthorQuickLinkProps = {
  travel: Travel
}

function TravelAuthorQuickLink({ travel }: TravelAuthorQuickLinkProps) {
  const router = useRouter()
  const colors = useThemedColors()
  const styles = useMemo(() => createStyles(colors), [colors])

  const authorName = useMemo(
    () => resolveTravelAuthorName(travel, (travel as any)?.userName),
    [travel],
  )
  const authorUserId = useMemo(() => resolveOwnerId(travel), [travel])
  const avatarUri = useMemo(() => resolveAvatar(null, travel), [travel])
  const travelsCount =
    typeof (travel as any).userTravelsCount === 'number'
      ? (travel as any).userTravelsCount
      : null

  const displayName = authorName || (authorUserId ? 'Автор путешествия' : '')
  const canOpenAuthor = authorUserId != null

  const openProfile = useCallback(() => {
    if (!authorUserId) return
    router.push(routes.user(authorUserId))
  }, [authorUserId, router])

  const openAuthorTravels = useCallback(() => {
    if (!authorUserId) return
    router.push(`/search?user_id=${encodeURIComponent(String(authorUserId))}` as any)
  }, [authorUserId, router])

  if (!displayName) return null

  const countLine =
    travelsCount != null
      ? `${travelsCount} ${getTravelLabel(travelsCount)}`
      : canOpenAuthor
        ? 'Профиль автора'
        : ''

  return (
    <View
      testID="travel-author-quick-link"
      {...(Platform.OS === 'web' ? ({ 'data-testid': 'travel-author-quick-link' } as any) : null)}
      accessibilityLabel={`Автор путешествия ${displayName}`}
      style={styles.container}
    >
      <Pressable
        onPress={openProfile}
        disabled={!canOpenAuthor}
        accessibilityRole={canOpenAuthor ? 'button' : undefined}
        accessibilityLabel={canOpenAuthor ? `Открыть профиль автора ${displayName}` : undefined}
        style={({ pressed }) => [
          styles.profileButton,
          pressed && canOpenAuthor ? styles.pressed : null,
        ]}
      >
        {avatarUri ? (
          <ImageCardMedia
            src={avatarUri}
            alt={displayName}
            width={AVATAR_SIZE}
            height={AVATAR_SIZE}
            borderRadius={AVATAR_SIZE / 2}
            fit="contain"
            blurBackground
            allowCriticalWebBlur
            priority="low"
            loading="lazy"
            style={styles.avatar}
          />
        ) : (
          <View style={styles.avatarPlaceholder} />
        )}

        <View style={styles.textColumn}>
          <Text style={styles.label} numberOfLines={1}>
            Автор путешествия
          </Text>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>
              {displayName}
            </Text>
            {canOpenAuthor ? (
              <Feather name="chevron-right" size={16} color={colors.textMuted} />
            ) : null}
          </View>
          {!!countLine && (
            <Text style={styles.meta} numberOfLines={1}>
              {countLine}
            </Text>
          )}
        </View>
      </Pressable>

      {canOpenAuthor ? (
        <Pressable
          onPress={openAuthorTravels}
          accessibilityRole="button"
          accessibilityLabel={`Открыть все путешествия автора ${displayName}`}
          style={({ pressed }) => [styles.travelsButton, pressed ? styles.pressed : null]}
        >
          <Feather name="map" size={16} color={colors.primaryText} />
          <Text style={styles.travelsButtonText} numberOfLines={2}>
            Все путешествия
          </Text>
        </Pressable>
      ) : null}
    </View>
  )
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    container: {
      width: '100%',
      marginTop: DESIGN_TOKENS.spacing.md,
      marginBottom: DESIGN_TOKENS.spacing.sm,
      padding: DESIGN_TOKENS.spacing.sm,
      borderRadius: DESIGN_TOKENS.radii.md,
      borderWidth: 1,
      borderColor: colors.borderLight,
      backgroundColor: colors.surface,
      flexDirection: 'row',
      alignItems: 'center',
      gap: DESIGN_TOKENS.spacing.sm,
    },
    profileButton: {
      flex: 1,
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: DESIGN_TOKENS.spacing.sm,
      ...Platform.select({
        web: {
          cursor: 'pointer' as any,
        },
      }),
    },
    avatar: {
      width: AVATAR_SIZE,
      height: AVATAR_SIZE,
      borderRadius: AVATAR_SIZE / 2,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    avatarPlaceholder: {
      width: AVATAR_SIZE,
      height: AVATAR_SIZE,
      borderRadius: AVATAR_SIZE / 2,
      backgroundColor: colors.backgroundSecondary,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    textColumn: {
      flex: 1,
      minWidth: 0,
      gap: 2,
    },
    label: {
      color: colors.textMuted,
      fontSize: DESIGN_TOKENS.typography.sizes.xs,
      fontWeight: '700',
    },
    nameRow: {
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
    },
    name: {
      flexShrink: 1,
      color: colors.text,
      fontSize: 17,
      lineHeight: 22,
      fontWeight: '800',
    },
    meta: {
      color: colors.textSecondary,
      fontSize: DESIGN_TOKENS.typography.sizes.sm,
      fontWeight: '500',
    },
    travelsButton: {
      minHeight: 44,
      maxWidth: 108,
      flexShrink: 0,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      paddingHorizontal: DESIGN_TOKENS.spacing.xs,
      paddingVertical: DESIGN_TOKENS.spacing.xs,
      borderRadius: DESIGN_TOKENS.radii.sm,
      borderWidth: 1,
      borderColor: colors.borderLight,
      backgroundColor: colors.primarySoft,
      ...Platform.select({
        web: {
          cursor: 'pointer' as any,
        },
      }),
    },
    travelsButtonText: {
      color: colors.primaryText,
      fontSize: DESIGN_TOKENS.typography.sizes.xs,
      lineHeight: 16,
      fontWeight: '800',
      textAlign: 'center',
    },
    pressed: {
      opacity: 0.86,
      transform: [{ scale: 0.99 }],
    },
  })

export default memo(TravelAuthorQuickLink)
