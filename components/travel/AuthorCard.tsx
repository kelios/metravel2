import React, { useCallback, useMemo } from 'react'
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import Feather from '@expo/vector-icons/Feather'

import type { Travel } from '@/types/types'
import { openExternalUrl } from '@/utils/externalLinks'
import { useAuth } from '@/context/AuthContext'
import { useUserProfileCached } from '@/hooks/useUserProfileCached'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useResponsive } from '@/hooks/useResponsive'
import { useThemedColors } from '@/hooks/useTheme'
import ImageCardMedia from '@/components/ui/ImageCardMedia'
import { normalizeAvatarUrl } from '@/utils/mediaUrl'
import { routes } from '@/utils/routes'
import SubscribeButton from '@/components/ui/SubscribeButton'
import { getTravelLabel } from '@/services/pdf-export/utils/pluralize'

const STRICT_PLACEHOLDER = /^[.\s·•]+$|^Автор|^Пользователь|^User/i
const LOOSE_PLACEHOLDER = /^[.\s·•]{4,}$|^Автор|^Пользователь|^User|^Anonymous/i

function cleanName(value: unknown, placeholder: RegExp): string {
  if (typeof value !== 'string') return ''
  const trimmed = value.trim()
  if (!trimmed || placeholder.test(trimmed)) return ''
  return trimmed
}

function resolveAuthorName(travel: any): string {
  const user = travel?.user
  if (user) {
    const firstName = (user.first_name || user.name || '').toString().trim()
    if (firstName) {
      const lastName = (user.last_name || '').toString().trim()
      return lastName ? `${firstName} ${lastName}` : firstName
    }
  }
  const direct =
    travel?.author_name || travel?.authorName || travel?.owner_name || travel?.ownerName
  const directClean = cleanName(direct, STRICT_PLACEHOLDER)
  if (directClean) return directClean
  return cleanName(travel?.userName, LOOSE_PLACEHOLDER)
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
    { key: 'youtube', label: 'YouTube', url: profile.youtube },
    { key: 'instagram', label: 'Instagram', url: profile.instagram },
    { key: 'twitter', label: 'Twitter', url: profile.twitter },
    { key: 'vk', label: 'VK', url: profile.vk },
  ]
  return items.filter((s) => String(s.url ?? '').trim())
}

function getAvatarSize(isMobile: boolean, isTablet: boolean): number {
  if (isMobile) return 64
  if (isTablet) return 72
  return Platform.OS === 'web' ? 96 : 80
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

  const showActions = !!userId && !isOwnTravel
  const showInlineCta = !isMobile && !!userId
  const showBottomCta = isMobile && !!userId

  return (
    <View style={[styles.container, isMobile && styles.containerMobile]}>
      <View style={[styles.content, isMobile && styles.contentMobile]}>
        <View style={styles.mainRow}>
          <Pressable
            style={styles.avatarSection}
            onPress={handleOpenAuthorProfile}
            accessibilityRole={userId ? 'button' : undefined}
            accessibilityLabel={
              userId ? `Открыть профиль автора${userName ? ` ${userName}` : ''}` : undefined
            }
            disabled={!userId}
          >
            {avatarUri ? (
              <ImageCardMedia
                src={avatarUri}
                alt={userName || 'Автор'}
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
              <Pressable
                onPress={handleOpenAuthorProfile}
                disabled={!userId}
                accessibilityRole={userId ? 'button' : undefined}
                accessibilityLabel={userId ? `Открыть профиль автора ${userName}` : undefined}
                style={({ pressed }) => (pressed && userId ? styles.pressedDim : null)}
              >
                <Text style={[styles.authorName, isMobile && styles.authorNameMobile]}>
                  {userName}
                </Text>
              </Pressable>
            )}

            {!!authorCountryName && (
              <View style={styles.locationRow}>
                <Feather name="map-pin" size={14} color={colors.textMuted} />
                <Text style={styles.locationText}>{authorCountryName}</Text>
              </View>
            )}

            {socials.length > 0 && (
              <View style={styles.socialsRow}>
                {socials.map((s) => (
                  <Pressable
                    key={s.key}
                    onPress={() => openExternalUrl(String(s.url))}
                    accessibilityRole="link"
                    accessibilityLabel={`Открыть ${s.label}`}
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

            {showActions && (
              <View style={styles.authorActionsRow}>
                <SubscribeButton targetUserId={userId!} size="sm" />
                <Pressable
                  onPress={handleWriteToAuthor}
                  accessibilityRole="button"
                  accessibilityLabel={`Написать автору${userName ? ` ${userName}` : ''}`}
                  style={({ pressed }) => [
                    styles.messageButton,
                    pressed && styles.messageButtonPressed,
                  ]}
                >
                  <Feather name="mail" size={14} color={colors.primary} />
                  <Text style={styles.messageButtonText}>Написать</Text>
                </Pressable>
              </View>
            )}
          </View>
        </View>

        {showInlineCta && (
          <View style={styles.ctaInlineRow}>
            <Pressable
              style={({ pressed }) => [
                styles.viewButtonInline,
                pressed && styles.viewButtonPressed,
              ]}
              onPress={handleViewAuthorTravels}
              accessibilityRole="button"
              accessibilityLabel="Все путешествия автора"
            >
              <Text style={styles.viewButtonInlineText} numberOfLines={1}>
                Все путешествия автора
              </Text>
            </Pressable>
          </View>
        )}
      </View>

      {showBottomCta && <View style={styles.divider} />}

      {showBottomCta && (
        <View style={styles.ctaBottomRow}>
          <Pressable
            style={({ pressed }) => [
              styles.viewButtonBottom,
              styles.viewButtonBottomPrimary,
              pressed && styles.viewButtonPressed,
            ]}
            onPress={handleViewAuthorTravels}
            accessibilityRole="button"
            accessibilityLabel="Все путешествия автора"
          >
            <View style={styles.ctaBottomButtonContent}>
              <Feather name="map" size={14} color={colors.primary} />
              <Text style={[styles.viewButtonBottomText, styles.viewButtonBottomTextPrimary]}>
                Все путешествия
              </Text>
            </View>
          </Pressable>

          {!isOwnTravel && (
            <Pressable
              onPress={handleWriteToAuthor}
              accessibilityRole="button"
              accessibilityLabel={`Написать автору${userName ? ` ${userName}` : ''}`}
              style={({ pressed }) => [
                styles.viewButtonBottom,
                styles.viewButtonBottomSecondary,
                pressed && styles.viewButtonPressed,
              ]}
            >
              <View style={styles.ctaBottomButtonContent}>
                <Feather name="mail" size={14} color={colors.textSecondary} />
                <Text style={styles.viewButtonBottomText}>Написать</Text>
              </View>
            </Pressable>
          )}
        </View>
      )}
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
    containerMobile: { padding: 16 },
    content: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 18,
    },
    contentMobile: {
      flexDirection: 'column',
      alignItems: 'flex-start',
      gap: 14,
      width: '100%',
    },
    mainRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      minWidth: 0,
      width: '100%',
      gap: 18,
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
    avatarMobile: { width: 52, height: 52, borderRadius: 26, borderWidth: 2.5 },
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
    authorActionsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: DESIGN_TOKENS.spacing.xs,
    },
    messageButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 14,
      paddingVertical: 7,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.borderLight,
      backgroundColor: colors.primarySoft,
      alignSelf: 'flex-start',
      ...Platform.select({
        web: {
          cursor: 'pointer' as any,
          transition: 'all 0.15s ease' as any,
          ':hover': { backgroundColor: colors.primarySoft, borderColor: colors.primary } as any,
        },
      }),
    },
    messageButtonPressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
    messageButtonText: {
      fontSize: DESIGN_TOKENS.typography.sizes.sm,
      fontWeight: '600',
      color: colors.primary,
    },
    ctaInlineRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: DESIGN_TOKENS.spacing.sm,
      marginLeft: 'auto',
      flexShrink: 0,
    },
    viewButtonInline: {
      marginLeft: 'auto',
      flexShrink: 0,
      paddingVertical: Platform.OS === 'web' ? 12 : 10,
      paddingHorizontal: Platform.OS === 'web' ? 16 : 14,
      borderRadius: 999,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderLight,
      ...Platform.select({
        web: {
          cursor: 'pointer' as any,
          transition: 'background-color 0.2s ease, border-color 0.2s ease' as any,
          ':hover': {
            backgroundColor: colors.backgroundSecondary,
            borderColor: colors.border,
          } as any,
        },
      }),
    },
    viewButtonInlineText: {
      fontSize: 14,
      fontWeight: '600',
      letterSpacing: -0.2,
      color: colors.textSecondary,
    },
    viewButtonPressed: { backgroundColor: colors.backgroundSecondary, transform: [{ scale: 0.98 }] },
    divider: {
      width: '100%',
      height: 1,
      marginTop: DESIGN_TOKENS.spacing.md,
      marginBottom: DESIGN_TOKENS.spacing.sm,
      opacity: 0.6,
      backgroundColor: colors.borderLight,
    },
    ctaBottomRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: DESIGN_TOKENS.spacing.md,
    },
    ctaBottomButtonContent: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: DESIGN_TOKENS.spacing.xs,
    },
    viewButtonBottom: {
      flex: 1,
      minWidth: 0,
      paddingVertical: DESIGN_TOKENS.spacing.sm,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: DESIGN_TOKENS.radii.md,
      ...Platform.select({
        web: {
          cursor: 'pointer' as any,
          transition: 'background-color 0.15s ease' as any,
          ':hover': { backgroundColor: colors.backgroundSecondary } as any,
        },
      }),
    },
    viewButtonBottomPrimary: { backgroundColor: colors.primarySoft },
    viewButtonBottomSecondary: { backgroundColor: colors.surface, borderColor: colors.surface },
    viewButtonBottomText: {
      fontSize: DESIGN_TOKENS.typography.sizes.md,
      fontWeight: '600',
      letterSpacing: -0.2,
      color: colors.textSecondary,
    },
    viewButtonBottomTextPrimary: { color: colors.primary, fontWeight: '700' },
  })

export default React.memo(AuthorCard)
