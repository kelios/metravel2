import { useCallback, useMemo, useState } from 'react'
import { View, Text, StyleSheet, Pressable, Platform, Image } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import type { AuthorEngagementItem, AuthorEngagementMetric } from '@/api/authorEngagement'
import Button from '@/components/ui/Button'
import EmptyState from '@/components/ui/EmptyState'
import { SkeletonLoader } from '@/components/ui/SkeletonLoader'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useThemedColors } from '@/hooks/useTheme'
import { useResponsive } from '@/hooks/useResponsive'
import { globalFocusStyles } from '@/styles/globalFocus'
import { optimizeImageUrl } from '@/utils/imageOptimization'
import { formatDate } from '@/i18n/format'
import { translate as i18nT } from '@/i18n'

const METRIC_TITLE_KEYS: Record<AuthorEngagementMetric, string> = {
  favorites: 'profile:components.profile.ProfileEngagementDetailList.title.favorites',
  wishlist: 'profile:components.profile.ProfileEngagementDetailList.title.wishlist',
  visited: 'profile:components.profile.ProfileEngagementDetailList.title.visited',
  planned: 'profile:components.profile.ProfileEngagementDetailList.title.planned',
}

const METRIC_ICONS: Record<AuthorEngagementMetric, React.ComponentProps<typeof Feather>['name']> = {
  favorites: 'heart',
  wishlist: 'bookmark',
  visited: 'check-circle',
  planned: 'calendar',
}

/** Внутренний путь маршрута; всё, что не начинается с одного `/`, не навигируем. */
const resolveTravelHref = (item: AuthorEngagementItem): string | null => {
  const { url, slug, id } = item.travel
  if (url.startsWith('/') && !url.startsWith('//')) return url
  if (slug) return `/travels/${slug}`
  return id ? `/travels/${id}` : null
}

const resolveDisplayName = (item: AuthorEngagementItem): string => {
  if (item.identityHidden) {
    return i18nT('profile:components.profile.ProfileEngagementDetailList.hiddenUser')
  }
  const full = [item.user.firstName, item.user.lastName].filter(Boolean).join(' ').trim()
  return full || i18nT('sharedStatic:user.fallbackName')
}

const resolveInitials = (name: string): string =>
  name
    .split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()

function EngagementRow({
  item,
  isCompact,
  styles,
  colors,
  onOpenProfile,
  onOpenTravel,
}: {
  item: AuthorEngagementItem
  isCompact: boolean
  styles: ReturnType<typeof createStyles>
  colors: ReturnType<typeof useThemedColors>
  onOpenProfile: (userId: number) => void
  onOpenTravel: (href: string) => void
}) {
  const [avatarError, setAvatarError] = useState(false)

  const displayName = resolveDisplayName(item)
  const initials = resolveInitials(displayName)
  const travelHref = resolveTravelHref(item)
  const travelName =
    item.travel.name ||
    i18nT('profile:components.profile.ProfileEngagementDetailList.untitledTravel')
  const canOpenProfile = !item.identityHidden && item.user.id !== null
  const occurredLabel = item.occurredAt
    ? formatDate(item.occurredAt, { day: 'numeric', month: 'long', year: 'numeric' })
    : ''

  return (
    <View style={styles.row} testID={`engagement-row-${item.id}`}>
      <Pressable
        style={[styles.userCell, canOpenProfile ? globalFocusStyles.focusable : null]}
        onPress={canOpenProfile ? () => onOpenProfile(item.user.id as number) : undefined}
        disabled={!canOpenProfile}
        accessibilityRole={canOpenProfile ? 'button' : undefined}
        accessibilityLabel={
          canOpenProfile
            ? i18nT('profile:components.profile.ProfileEngagementDetailList.openProfile', {
                value1: displayName,
              })
            : displayName
        }
        {...(canOpenProfile ? Platform.select({ web: { cursor: 'pointer' } }) : null)}
      >
        <View style={styles.avatar}>
          {item.user.avatar && !avatarError ? (
            <Image
              source={{
                uri:
                  optimizeImageUrl(item.user.avatar, { width: 80, quality: 70, fit: 'cover' }) ??
                  item.user.avatar,
              }}
              style={styles.avatarImage}
              onError={() => setAvatarError(true)}
              accessibilityIgnoresInvertColors
            />
          ) : item.identityHidden ? (
            <Feather name="eye-off" size={16} color={colors.textMuted} />
          ) : initials ? (
            <Text style={styles.avatarInitials}>{initials}</Text>
          ) : (
            <Feather name="user" size={16} color={colors.primaryDark} />
          )}
        </View>
        <View style={styles.userText}>
          <Text style={styles.userName} numberOfLines={1}>
            {displayName}
          </Text>
          {item.identityHidden ? (
            <Text style={styles.userHint} numberOfLines={1}>
              {i18nT('profile:components.profile.ProfileEngagementDetailList.hiddenUserHint')}
            </Text>
          ) : null}
        </View>
      </Pressable>

      <Pressable
        style={[
          styles.travelCell,
          isCompact ? styles.travelCellCompact : null,
          travelHref ? globalFocusStyles.focusable : null,
        ]}
        onPress={travelHref ? () => onOpenTravel(travelHref) : undefined}
        disabled={!travelHref}
        accessibilityRole={travelHref ? 'link' : undefined}
        accessibilityLabel={
          travelHref
            ? i18nT('profile:components.profile.ProfileEngagementDetailList.openTravel', {
                value1: travelName,
              })
            : travelName
        }
        {...(travelHref ? Platform.select({ web: { cursor: 'pointer' } }) : null)}
      >
        <Text style={styles.travelName} numberOfLines={2}>
          {travelName}
        </Text>
        {occurredLabel ? <Text style={styles.travelDate}>{occurredLabel}</Text> : null}
      </Pressable>
    </View>
  )
}

export function ProfileEngagementDetailList({
  metric,
  items,
  total,
  isLoading,
  isError,
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
  onRetry,
  onOpenProfile,
  onOpenTravel,
}: {
  metric: AuthorEngagementMetric
  items: AuthorEngagementItem[]
  total: number
  isLoading: boolean
  isError: boolean
  hasNextPage: boolean
  isFetchingNextPage: boolean
  onLoadMore: () => void
  onRetry: () => void
  onOpenProfile: (userId: number) => void
  onOpenTravel: (href: string) => void
}) {
  const colors = useThemedColors()
  const { isMobile, width } = useResponsive()
  const isCompact = isMobile || width < 640
  const styles = useMemo(() => createStyles(colors, isCompact), [colors, isCompact])

  const handleLoadMore = useCallback(() => {
    if (!isFetchingNextPage) onLoadMore()
  }, [isFetchingNextPage, onLoadMore])

  const body = (() => {
    if (isLoading) {
      return (
        <View style={styles.loadingWrap} testID="engagement-detail-loading">
          <SkeletonLoader width="100%" height={56} borderRadius={DESIGN_TOKENS.radii.md} />
          <SkeletonLoader width="100%" height={56} borderRadius={DESIGN_TOKENS.radii.md} />
          <SkeletonLoader width="100%" height={56} borderRadius={DESIGN_TOKENS.radii.md} />
        </View>
      )
    }

    if (isError) {
      return (
        <View testID="engagement-detail-error">
          <EmptyState
            icon="alert-circle"
            variant="error"
            iconSize={32}
            title={i18nT('profile:components.profile.ProfileEngagementDetailList.error.title')}
            description={i18nT(
              'profile:components.profile.ProfileEngagementDetailList.error.description',
            )}
            action={{
              label: i18nT('profile:components.profile.ProfileEngagementDetailList.error.retry'),
              onPress: onRetry,
            }}
          />
        </View>
      )
    }

    if (items.length === 0) {
      return (
        <View testID="engagement-detail-empty">
          <EmptyState
            icon={METRIC_ICONS[metric]}
            variant="empty"
            iconSize={32}
            title={i18nT('profile:components.profile.ProfileEngagementDetailList.empty.title')}
            description={i18nT(
              'profile:components.profile.ProfileEngagementDetailList.empty.description',
            )}
          />
        </View>
      )
    }

    return (
      <View style={styles.rows}>
        {items.map((item) => (
          <EngagementRow
            key={item.id}
            item={item}
            isCompact={isCompact}
            styles={styles}
            colors={colors}
            onOpenProfile={onOpenProfile}
            onOpenTravel={onOpenTravel}
          />
        ))}
        {hasNextPage ? (
          <Button
            label={
              isFetchingNextPage
                ? i18nT('profile:components.profile.ProfileEngagementDetailList.loadingMore')
                : i18nT('profile:components.profile.ProfileEngagementDetailList.loadMore')
            }
            onPress={handleLoadMore}
            variant="ghost"
            size="md"
            disabled={isFetchingNextPage}
            style={styles.loadMoreButton}
            testID="engagement-detail-load-more"
          />
        ) : null}
      </View>
    )
  })()

  return (
    <View style={styles.section} testID="profile-engagement-detail">
      <View style={styles.header}>
        <Text style={styles.title}>{i18nT(METRIC_TITLE_KEYS[metric])}</Text>
        <Text style={styles.subtitle}>
          {i18nT('profile:components.profile.ProfileEngagementDetailList.subtitle')}
        </Text>
        {!isLoading && !isError && total > 0 ? (
          <View style={styles.totalChip}>
            <Text style={styles.totalChipText}>
              {i18nT('profile:components.profile.ProfileEngagementDetailList.total', {
                value1: total,
              })}
            </Text>
          </View>
        ) : null}
      </View>
      {body}
    </View>
  )
}

const createStyles = (colors: ReturnType<typeof useThemedColors>, isCompact: boolean) =>
  StyleSheet.create({
    section: {
      marginHorizontal: isCompact ? DESIGN_TOKENS.spacing.sm : DESIGN_TOKENS.spacing.md,
      marginBottom: DESIGN_TOKENS.spacing.md,
      padding: isCompact ? DESIGN_TOKENS.spacing.sm : DESIGN_TOKENS.spacing.md,
      borderRadius: DESIGN_TOKENS.radii.lg,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderLight,
      gap: isCompact ? DESIGN_TOKENS.spacing.sm : DESIGN_TOKENS.spacing.md,
    },
    header: {
      gap: DESIGN_TOKENS.spacing.xxs,
      alignItems: 'flex-start',
    },
    title: {
      ...DESIGN_TOKENS.typography.scale.h3,
      ...(isCompact ? { fontSize: 20, lineHeight: 26 } : null),
      color: colors.text,
    },
    subtitle: {
      fontSize: isCompact
        ? DESIGN_TOKENS.typography.sizes.xs
        : DESIGN_TOKENS.typography.sizes.sm,
      color: colors.textMuted,
      lineHeight: isCompact ? 18 : 20,
      // `header` выравнивает детей по `flex-start`, поэтому на native Text
      // получает hug-ширину и длинный подзаголовок обрезается без многоточия
      // (на Android хвост «отметки» не отрисовывался). Растягиваем по ширине
      // шапки — тогда текст переносится, как на web.
      alignSelf: 'stretch',
    },
    totalChip: {
      paddingHorizontal: DESIGN_TOKENS.spacing.sm,
      paddingVertical: 6,
      borderRadius: DESIGN_TOKENS.radii.pill,
      backgroundColor: colors.backgroundSecondary,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    totalChipText: {
      fontSize: DESIGN_TOKENS.typography.sizes.xs,
      color: colors.textSecondary,
      fontWeight: DESIGN_TOKENS.typography.weights.medium as never,
    },
    loadingWrap: {
      gap: DESIGN_TOKENS.spacing.xs,
    },
    rows: {
      gap: DESIGN_TOKENS.spacing.xs,
    },
    row: {
      flexDirection: isCompact ? 'column' : 'row',
      alignItems: isCompact ? 'stretch' : 'center',
      gap: isCompact ? DESIGN_TOKENS.spacing.xxs : DESIGN_TOKENS.spacing.sm,
      paddingVertical: DESIGN_TOKENS.spacing.xs,
      paddingHorizontal: DESIGN_TOKENS.spacing.xs,
      borderRadius: DESIGN_TOKENS.radii.md,
      backgroundColor: colors.backgroundSecondary,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    userCell: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: DESIGN_TOKENS.spacing.xs,
      flex: isCompact ? undefined : 1,
      minWidth: 0,
      minHeight: DESIGN_TOKENS.touchTarget.minHeight,
    },
    avatar: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    avatarImage: {
      width: '100%',
      height: '100%',
      resizeMode: 'cover',
    },
    avatarInitials: {
      fontSize: 13,
      fontWeight: '700' as const,
      color: colors.primaryText,
    },
    userText: {
      flex: 1,
      minWidth: 0,
    },
    userName: {
      fontSize: DESIGN_TOKENS.typography.sizes.sm,
      fontWeight: DESIGN_TOKENS.typography.weights.semibold as never,
      color: colors.text,
    },
    userHint: {
      fontSize: DESIGN_TOKENS.typography.sizes.xs,
      color: colors.textMuted,
    },
    travelCell: {
      flex: isCompact ? undefined : 1,
      minWidth: 0,
      justifyContent: 'center',
      minHeight: DESIGN_TOKENS.touchTarget.minHeight,
    },
    travelCellCompact: {
      paddingLeft: 44,
    },
    travelName: {
      fontSize: DESIGN_TOKENS.typography.sizes.sm,
      color: colors.primaryDark,
      fontWeight: DESIGN_TOKENS.typography.weights.medium as never,
    },
    travelDate: {
      fontSize: DESIGN_TOKENS.typography.sizes.xs,
      color: colors.textMuted,
    },
    loadMoreButton: {
      alignSelf: 'center',
      marginTop: DESIGN_TOKENS.spacing.xs,
    },
  })

export default ProfileEngagementDetailList
