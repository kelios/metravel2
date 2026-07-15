import React, { useCallback, useMemo, useState } from 'react'
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import Feather from '@expo/vector-icons/Feather'

import type { Travel } from '@/types/types'
import { openExternalUrl } from '@/utils/externalLinks'
import { useAuth } from '@/context/AuthContext'
import { useUserProfileCached } from '@/hooks/useUserProfileCached'
import { normalizeProfileName, resolveProfileFullName } from '@/api/user'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useResponsive } from '@/hooks/useResponsive'
import { useThemedColors } from '@/hooks/useTheme'
import ImageCardMedia from '@/components/ui/ImageCardMedia'
import { normalizeAvatarUrl } from '@/utils/mediaUrl'
import { routes } from '@/utils/routes'
import SubscribeButton from '@/components/ui/SubscribeButton'
import { getTravelLabel } from '@/utils/pluralize'
import { useUserAchievements } from '@/hooks/useAchievementsApi'
import RankBar from '@/components/achievements/RankBar'
import BadgeMedal from '@/components/achievements/BadgeMedal'
import BadgeDetailSheet, { type BadgeDetail } from '@/components/achievements/BadgeDetailSheet'
import VerifiedBadge from '@/components/profile/VerifiedBadge'
import { translate as i18nT } from '@/i18n'


const STRICT_PLACEHOLDER = /^[.\s·•]+$/
const LOOSE_PLACEHOLDER = /^[.\s·•]{4,}$/

function cleanName(value: unknown, placeholder: RegExp, prefixKey: 'strict' | 'loose'): string {
  if (typeof value !== 'string') return ''
  const trimmed = value.trim()
  const prefixes = i18nT(
    prefixKey === 'strict'
      ? 'travel:components.travel.AuthorCard.placeholderPrefixes.strict'
      : 'travel:components.travel.AuthorCard.placeholderPrefixes.loose'
  ).split('|')
  const normalized = trimmed.toLocaleLowerCase()
  if (
    !trimmed ||
    placeholder.test(trimmed) ||
    prefixes.some((prefix) => normalized.startsWith(prefix.trim().toLocaleLowerCase()))
  ) return ''
  return trimmed
}

function resolveAuthorName(travel: any): string {
  const user = travel?.user
  if (user) {
    const fullName = resolveProfileFullName(user)
    if (fullName) return fullName
    const name = normalizeProfileName(user.name)
    if (name) return name
  }
  const direct =
    travel?.author_name || travel?.authorName || travel?.owner_name || travel?.ownerName
  const directClean = cleanName(direct, STRICT_PLACEHOLDER, 'strict')
  if (directClean) return directClean
  return cleanName(travel?.userName, LOOSE_PLACEHOLDER, 'loose')
}

function resolveAuthorId(travel: any): number | string | null {
  const direct = travel?.user?.id ?? travel?.userId ?? travel?.user_id
  if (direct != null) return direct

  const raw = travel?.userIds
  if (Array.isArray(raw) && raw.length > 0) return raw[0]
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) return raw
  if (typeof raw === 'string' && raw.trim()) {
    const n = Number(raw.split(',')[0].trim())
    if (Number.isFinite(n) && n > 0) return n
  }
  return null
}

export function hasResolvableAuthor(travel: any): boolean {
  return Boolean(resolveAuthorName(travel) || resolveAuthorId(travel) != null)
}

function resolveAuthorCountry(profile: any, travel: any): string {
  const raw =
    profile?.countryName ||
    profile?.country_name ||
    profile?.country ||
    travel?.user?.countryName ||
    travel?.user?.country_name ||
    travel?.user?.country ||
    ''
  const value = String(raw).trim().toLowerCase()
  if (!value || value === 'null' || value === 'undefined') return ''
  return String(raw).trim()
}

function resolveSocials(profile: any) {
  if (!profile) return []
  const items = [
    { key: 'youtube', label: i18nT('travel:components.travel.AuthorCard.youtube_4c46f92a'), url: profile.youtube },
    { key: 'instagram', label: i18nT('travel:components.travel.AuthorCard.instagram_9542d897'), url: profile.instagram },
    { key: 'twitter', label: i18nT('travel:components.travel.AuthorCard.twitter_78c022fd'), url: profile.twitter },
    { key: 'vk', label: i18nT('travel:components.travel.AuthorCard.vk_29add94b'), url: profile.vk },
  ]
  return items.filter((s) => String(s.url ?? '').trim())
}

function getAvatarSize(isMobile: boolean, isTablet: boolean): number {
  if (isMobile) return 64
  if (isTablet) return 72
  return Platform.OS === 'web' ? 96 : 80
}

interface AuthorAchievementsProps {
  userId: number | string
  ownerName?: string
  styles: ReturnType<typeof createStyles>
  colors: ReturnType<typeof useThemedColors>
}

function AuthorAchievements({ userId, ownerName, styles, colors }: AuthorAchievementsProps) {
  const { data } = useUserAchievements(userId)
  const [selected, setSelected] = useState<BadgeDetail | null>(null)

  if (!data) return null
  if (data.earned.length === 0 && data.rank.totalPoints === 0) return null

  const topBadges = data.earned.slice(0, 3)

  return (
    <View style={styles.achievementsBlock}>
      <RankBar rank={data.rank} compact titlePrefix={i18nT('travel:components.travel.AuthorCard.uroven_ffdcb900')} />
      {topBadges.length > 0 && (
        <>
          <View style={styles.badgesHeaderRow}>
            <Feather name="award" size={13} color={colors.textMuted} />
            <Text style={styles.badgesHeaderText}>{i18nT('travel:components.travel.AuthorCard.znachki_avtora_19b1ed31')}</Text>
          </View>
          <View style={styles.badgesRow}>
            {topBadges.map((ub) => (
              <BadgeMedal
                key={ub.badge.id}
                badge={ub.badge}
                size={40}
                earned
                showLabel
                onPress={() =>
                  setSelected({
                    badge: ub.badge,
                    earned: true,
                    userBadgeId: ub.id,
                    earnedAt: ub.earnedAt,
                    progress: null,
                  })
                }
              />
            ))}
          </View>
        </>
      )}

      <BadgeDetailSheet
        visible={selected != null}
        onClose={() => setSelected(null)}
        detail={selected}
        ownerName={ownerName}
      />
    </View>
  )
}

interface AuthorCardProps {
  travel: Travel
  onViewAuthorTravels?: () => void
}

function AuthorCard({ travel, onViewAuthorTravels }: AuthorCardProps) {
  const router = useRouter()
  const { isPhone, isLargePhone, isTablet } = useResponsive()
  const isMobile = isPhone || isLargePhone
  const colors = useThemedColors()
  const styles = useMemo(() => createStyles(colors), [colors])

  const userName = useMemo(() => resolveAuthorName(travel), [travel])
  const userId = useMemo(() => resolveAuthorId(travel), [travel])
  const travelsCount =
    typeof (travel as any).userTravelsCount === 'number'
      ? (travel as any).userTravelsCount
      : null

  const { profile: authorProfile } = useUserProfileCached(userId, { enabled: !!userId })
  const authorCountryName = useMemo(
    () => resolveAuthorCountry(authorProfile, travel),
    [authorProfile, travel],
  )
  const socials = useMemo(() => resolveSocials(authorProfile), [authorProfile])

  const { userId: currentUserId } = useAuth()
  const isOwnTravel =
    currentUserId != null && userId != null && String(currentUserId) === String(userId)

  const avatarSize = getAvatarSize(isMobile, isTablet)
  const avatarBorderRadius = Math.round(avatarSize / 2)
  const avatarUri = useMemo(() => {
    const raw = authorProfile?.avatar || (travel as any)?.user?.avatar
    return raw ? normalizeAvatarUrl(raw) || '' : ''
  }, [authorProfile?.avatar, travel])

  const handleOpenAuthorProfile = useCallback(() => {
    if (!userId) return
    router.push(routes.user(userId))
  }, [router, userId])

  const handleViewAuthorTravels = useCallback(() => {
    if (onViewAuthorTravels) {
      onViewAuthorTravels()
      return
    }
    if (userId) router.push(`/search?user_id=${encodeURIComponent(userId)}` as any)
  }, [userId, onViewAuthorTravels, router])

  const handleWriteToAuthor = useCallback(() => {
    if (!userId) return
    router.push(routes.messages(userId))
  }, [userId, router])

  if (!userName && !authorCountryName && !userId) return null

  const hasUser = !!userId
  const canSubscribe = hasUser && !isOwnTravel
  const showActionsRow = hasUser

  return (
    <View style={[styles.container, isMobile && styles.containerMobile]}>
      <View style={[styles.content, isMobile && styles.contentMobile]}>
        <View style={styles.mainRow}>
          <Pressable
            style={styles.avatarSection}
            onPress={handleOpenAuthorProfile}
            accessibilityRole={userId ? 'button' : undefined}
            accessibilityLabel={
              userId ? i18nT('travel:components.travel.AuthorCard.otkryt_profil_avtora_value1_c93e9aca', { value1: userName ? ` ${userName}` : '' }) : undefined
            }
            disabled={!userId}
          >
            {avatarUri ? (
              <ImageCardMedia
                src={avatarUri}
                alt={userName || i18nT('travel:components.travel.AuthorCard.authorFallback')}
                width={avatarSize}
                height={avatarSize}
                borderRadius={avatarBorderRadius}
                fit="contain"
                blurBackground
                allowCriticalWebBlur
                priority="high"
                loading="eager"
                style={[styles.avatar, isMobile && styles.avatarMobile]}
              />
            ) : (
              <View style={[styles.avatarPlaceholder, isMobile && styles.avatarMobile]} />
            )}
          </Pressable>

          <View style={styles.infoSection}>
            {!!userName && (
              <View style={styles.nameRow}>
                <Pressable
                  onPress={handleOpenAuthorProfile}
                  disabled={!userId}
                  accessibilityRole={userId ? 'button' : undefined}
                  accessibilityLabel={userId ? i18nT('travel:components.travel.AuthorCard.otkryt_profil_avtora_value1_0da4a86a', { value1: userName }) : undefined}
                  style={({ pressed }) => (pressed && userId ? styles.pressedDim : null)}
                >
                  <Text style={[styles.authorName, isMobile && styles.authorNameMobile]}>
                    {userName}
                  </Text>
                </Pressable>
                <VerifiedBadge
                  isVerified={authorProfile?.is_verified}
                  organizerStatus={authorProfile?.organizer_status}
                />
              </View>
            )}

            {!!authorCountryName && (
              <View style={styles.locationRow}>
                <Feather name="map-pin" size={14} color={colors.textMuted} />
                <Text style={styles.locationText}>{authorCountryName}</Text>
              </View>
            )}

            {showActionsRow && (
              <View style={styles.authorActionsRow}>
                {canSubscribe && (
                  <SubscribeButton
                    targetUserId={userId!}
                    size="sm"
                    iconOnly={isMobile}
                    style={isMobile ? styles.subscribeIconButton : styles.subscribeButton}
                  />
                )}

                {!isOwnTravel && (
                  <Pressable
                    onPress={handleWriteToAuthor}
                    accessibilityRole="button"
                    accessibilityLabel={i18nT('travel:components.travel.AuthorCard.napisat_avtoru_value1_94fdaf86', { value1: userName ? ` ${userName}` : '' })}
                    style={({ pressed }) => [
                      styles.actionButton,
                      isMobile && styles.actionButtonIconOnly,
                      styles.actionButtonAccent,
                      pressed && styles.actionButtonPressed,
                    ]}
                  >
                    <Feather name="mail" size={15} color={colors.primaryDark} />
                    {!isMobile && <Text style={styles.actionButtonAccentText}>{i18nT('travel:components.travel.AuthorCard.napisat_85d7a13d')}</Text>}
                  </Pressable>
                )}

                <Pressable
                  onPress={handleViewAuthorTravels}
                  accessibilityRole="button"
                  accessibilityLabel={i18nT('travel:components.travel.AuthorCard.vse_puteshestviya_avtora_c1a08fb2')}
                  style={({ pressed }) => [
                    styles.actionButton,
                    isMobile && styles.actionButtonIconOnly,
                    pressed && styles.actionButtonPressed,
                  ]}
                >
                  <Feather name="map" size={15} color={colors.textSecondary} />
                  {!isMobile && (
                    <Text style={styles.actionButtonText} numberOfLines={1}>
                      {i18nT('travel:components.travel.AuthorCard.vse_puteshestviya_12f54fe6')}</Text>
                  )}
                </Pressable>
              </View>
            )}

            {socials.length > 0 && (
              <View style={styles.socialsRow}>
                {socials.map((s) => (
                  <Pressable
                    key={s.key}
                    onPress={() => openExternalUrl(String(s.url))}
                    accessibilityRole="link"
                    accessibilityLabel={i18nT('travel:components.travel.AuthorCard.otkryt_value1_2165b58d', { value1: s.label })}
                    style={({ pressed }) => [
                      styles.socialChip,
                      pressed && styles.socialChipPressed,
                    ]}
                  >
                    <Text style={styles.socialChipText}>{s.label}</Text>
                  </Pressable>
                ))}
              </View>
            )}

            {travelsCount !== null && (
              <View style={styles.statsRow}>
                <Feather name="map" size={16} color={colors.textMuted} />
                <Text style={styles.statsText}>
                  {travelsCount} {getTravelLabel(travelsCount)}
                </Text>
              </View>
            )}

            {userId != null && (
              <AuthorAchievements
                userId={userId}
                ownerName={userName || undefined}
                styles={styles}
                colors={colors}
              />
            )}
          </View>
        </View>
      </View>
    </View>
  )
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    container: {
      width: '100%',
      backgroundColor: colors.surface,
      borderRadius: DESIGN_TOKENS.radii.md,
      padding: Platform.OS === 'web' ? 28 : 20,
      borderWidth: 1,
      borderColor: colors.borderLight,
      ...(Platform.OS === 'web' ? ({ boxShadow: '0 1px 4px rgba(0,0,0,0.04)' } as any) : null),
    },
    containerMobile: { padding: 12 },
    content: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 18,
    },
    contentMobile: {
      flexDirection: 'column',
      alignItems: 'flex-start',
      gap: 10,
      width: '100%',
    },
    mainRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      minWidth: 0,
      width: '100%',
      gap: Platform.OS === 'web' ? 18 : 12,
    },
    avatarSection: { alignItems: 'center', justifyContent: 'center' },
    avatar: {
      width: Platform.OS === 'web' ? 76 : 56,
      height: Platform.OS === 'web' ? 76 : 56,
      borderRadius: Platform.OS === 'web' ? 38 : 28,
      borderWidth: 3,
      borderColor: colors.borderLight,
      ...(Platform.OS === 'web' ? ({ boxShadow: '0 2px 8px rgba(0,0,0,0.08)' } as any) : null),
    },
    avatarMobile: { width: 48, height: 48, borderRadius: 24, borderWidth: 2 },
    avatarPlaceholder: {
      width: Platform.OS === 'web' ? 72 : 56,
      height: Platform.OS === 'web' ? 72 : 56,
      borderRadius: Platform.OS === 'web' ? 36 : 28,
      backgroundColor: colors.backgroundSecondary,
      borderWidth: 1,
      borderColor: colors.borderLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    infoSection: { flex: 1, gap: DESIGN_TOKENS.spacing.sm },
    pressedDim: { opacity: 0.85 },
    nameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 6,
    },
    authorName: {
      fontSize: Platform.OS === 'web' ? 20 : 17,
      fontWeight: '700',
      color: colors.text,
      letterSpacing: -0.3,
      lineHeight: Platform.OS === 'web' ? 26 : 22,
    },
    authorNameMobile: { fontSize: 17 },
    locationRow: { flexDirection: 'row', alignItems: 'center', gap: DESIGN_TOKENS.spacing.xs },
    locationText: {
      fontSize: DESIGN_TOKENS.typography.sizes.md,
      color: colors.textSecondary,
      fontWeight: '500',
    },
    socialsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: DESIGN_TOKENS.spacing.xs,
    },
    socialChip: {
      paddingHorizontal: 12,
      paddingVertical: 5,
      borderRadius: DESIGN_TOKENS.radii.sm,
      backgroundColor: colors.primarySoft,
      borderWidth: 1,
      borderColor: colors.borderLight,
      ...Platform.select({
        web: {
          cursor: 'pointer' as any,
          transition: 'all 0.15s ease' as any,
          ':hover': {
            backgroundColor: colors.primaryLight,
            transform: 'translateY(-1px)',
            boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
          } as any,
        },
      }),
    },
    socialChipPressed: { backgroundColor: colors.backgroundTertiary, transform: [{ scale: 0.98 }] },
    socialChipText: { fontSize: 12, fontWeight: '500', color: colors.primaryText },
    statsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: DESIGN_TOKENS.spacing.xs,
      marginTop: 4,
    },
    statsText: {
      fontSize: DESIGN_TOKENS.typography.sizes.sm,
      color: colors.textSecondary,
      fontWeight: '600',
    },
    achievementsBlock: {
      marginTop: DESIGN_TOKENS.spacing.xs,
      gap: DESIGN_TOKENS.spacing.sm,
    },
    badgesHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
    },
    badgesHeaderText: {
      fontSize: DESIGN_TOKENS.typography.sizes.xs,
      fontWeight: '700',
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    badgesRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      flexWrap: 'wrap',
      gap: DESIGN_TOKENS.spacing.sm,
    },
    authorActionsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: DESIGN_TOKENS.spacing.sm,
      marginTop: 2,
    },
    subscribeButton: { flexShrink: 1 },
    subscribeIconButton: {
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.borderLight,
      backgroundColor: colors.surface,
    },
    actionButtonIconOnly: {
      width: 44,
      height: 44,
      paddingHorizontal: 0,
      paddingVertical: 0,
    },
    actionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      minWidth: 0,
      flexShrink: 1,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.borderLight,
      backgroundColor: colors.surface,
      ...Platform.select({
        web: {
          cursor: 'pointer' as any,
          transition: 'all 0.15s ease' as any,
          ':hover': { backgroundColor: colors.backgroundSecondary, borderColor: colors.border } as any,
        },
      }),
    },
    actionButtonAccent: {
      backgroundColor: colors.primarySoft,
    },
    actionButtonPressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
    actionButtonText: {
      fontSize: DESIGN_TOKENS.typography.sizes.sm,
      fontWeight: '600',
      letterSpacing: -0.2,
      color: colors.textSecondary,
    },
    actionButtonAccentText: {
      fontSize: DESIGN_TOKENS.typography.sizes.sm,
      fontWeight: '700',
      color: colors.primaryText,
    },
  })

export default React.memo(AuthorCard)
