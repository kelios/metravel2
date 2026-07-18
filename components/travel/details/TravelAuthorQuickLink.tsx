import React, { memo, useCallback, useMemo } from 'react'
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import Feather from '@expo/vector-icons/Feather'

import ImageCardMedia from '@/components/ui/ImageCardMedia'
import SubscribeButton from '@/components/ui/SubscribeButton'
import { resolveTravelAuthorName } from '@/components/listTravel/travelListItemHelpers'
import { resolveAvatar, resolveOwnerId } from '@/components/travel/compactSideBar/helpers'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useUserProfileCached } from '@/hooks/useUserProfileCached'
import { useThemedColors } from '@/hooks/useTheme'
import { globalFocusStyles } from '@/styles/globalFocus'
import type { Travel } from '@/types/types'
import { openExternalUrl } from '@/utils/externalLinks'
import { routes } from '@/utils/routes'
import { translate as i18nT } from '@/i18n'

const AVATAR_SIZE = 44
const AUTHOR_ACTIONS_MAX_WIDTH = 148

type FeatherIconName = React.ComponentProps<typeof Feather>['name']
type AuthorSocialKey = 'youtube' | 'instagram' | 'twitter' | 'vk'
type AuthorSocialProfile = Partial<Record<AuthorSocialKey, string | null | undefined>>
type AuthorSocialLink = {
  key: AuthorSocialKey
  label: string
  url: string
  icon: FeatherIconName
}

const SOCIAL_ICON_BY_KEY: Record<AuthorSocialKey, FeatherIconName> = {
  youtube: 'youtube',
  instagram: 'instagram',
  twitter: 'twitter',
  vk: 'external-link',
}

function setWebNodeTitle(node: unknown, title: string) {
  if (Platform.OS !== 'web' || !node) return
  const element = node as { setAttribute?: (name: string, value: string) => void }
  element.setAttribute?.('title', title)
}

function resolveAuthorSocials(profile: AuthorSocialProfile | null | undefined): AuthorSocialLink[] {
  if (!profile) return []
  const items: Array<{ key: AuthorSocialKey; label: string; url: unknown }> = [
    {
      key: 'youtube',
      label: i18nT('travel:components.travel.AuthorCard.youtube_4c46f92a'),
      url: profile.youtube,
    },
    {
      key: 'instagram',
      label: i18nT('travel:components.travel.AuthorCard.instagram_9542d897'),
      url: profile.instagram,
    },
    {
      key: 'twitter',
      label: i18nT('travel:components.travel.AuthorCard.twitter_78c022fd'),
      url: profile.twitter,
    },
    {
      key: 'vk',
      label: i18nT('travel:components.travel.AuthorCard.vk_29add94b'),
      url: profile.vk,
    },
  ]

  return items
    .map((item) => ({
      ...item,
      icon: SOCIAL_ICON_BY_KEY[item.key],
      url: String(item.url ?? '').trim(),
    }))
    .filter((item) => item.url)
}

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

  const displayName =
    authorName ||
    (authorUserId
      ? i18nT(
          'travel:components.travel.details.TravelAuthorQuickLink.avtor_puteshestviya_15c44810',
        )
      : '')
  const avatarInitial = useMemo(() => {
    const ch = displayName?.trim().charAt(0)
    return ch ? ch.toUpperCase() : ''
  }, [displayName])
  const canOpenAuthor = authorUserId != null
  const { profile: authorProfile } = useUserProfileCached(authorUserId, { enabled: canOpenAuthor })
  const avatarUri = useMemo(
    () => resolveAvatar(authorProfile, travel),
    [authorProfile, travel],
  )
  const socialLinks = useMemo(() => resolveAuthorSocials(authorProfile), [authorProfile])

  const openProfile = useCallback(() => {
    if (!authorUserId) return
    router.push(routes.user(authorUserId))
  }, [authorUserId, router])

  const openAuthorTravels = useCallback(() => {
    if (!authorUserId) return
    router.push(`/search?user_id=${encodeURIComponent(String(authorUserId))}` as any)
  }, [authorUserId, router])

  const openAuthorMessage = useCallback(() => {
    if (!authorUserId) return
    router.push(routes.messages(authorUserId))
  }, [authorUserId, router])

  const openSocialLink = useCallback((url: string) => {
    void openExternalUrl(url)
  }, [])

  const messageTitle = i18nT(
    'travel:components.travel.compactSideBar.parts.AuthorBlock.napisat_avtoru_value1_191ed8f0',
    { value1: displayName },
  )
  const allTravelsTitle = i18nT(
    'travel:components.travel.details.TravelAuthorQuickLink.vse_puteshestviya_avtora_value1_70446c7a',
    { value1: displayName },
  )
  const setMessageButtonRef = useCallback(
    (node: unknown) => {
      setWebNodeTitle(node, messageTitle)
    },
    [messageTitle],
  )
  const setAllTravelsButtonRef = useCallback(
    (node: unknown) => {
      setWebNodeTitle(node, allTravelsTitle)
    },
    [allTravelsTitle],
  )

  if (!displayName) return null

  return (
    <View
      testID="travel-author-quick-link"
      {...(Platform.OS === 'web' ? ({ 'data-testid': 'travel-author-quick-link' } as any) : null)}
      accessibilityLabel={i18nT(
        'travel:components.travel.details.TravelAuthorQuickLink.avtor_puteshestviya_value1_a6bf3136',
        { value1: displayName },
      )}
      style={styles.container}
    >
      <Pressable
        onPress={openProfile}
        disabled={!canOpenAuthor}
        accessibilityRole={canOpenAuthor ? 'button' : undefined}
        accessibilityLabel={
          canOpenAuthor
            ? i18nT(
                'travel:components.travel.details.TravelAuthorQuickLink.otkryt_profil_avtora_value1_4a96332a',
                { value1: displayName },
              )
            : undefined
        }
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
          <View style={styles.avatarPlaceholder}>
            {avatarInitial ? (
              <Text style={styles.avatarInitial}>{avatarInitial}</Text>
            ) : null}
          </View>
        )}

        <View style={styles.textColumn}>
          <Text style={styles.label} numberOfLines={1}>
            {i18nT(
              'travel:components.travel.details.TravelAuthorQuickLink.avtor_puteshestviya_15c44810',
            )}
          </Text>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>
              {displayName}
            </Text>
            {canOpenAuthor ? (
              <Feather name="chevron-right" size={16} color={colors.textMuted} />
            ) : null}
          </View>
        </View>
      </Pressable>

      {canOpenAuthor ? (
        <View style={styles.actionsColumn}>
          <View style={styles.actionsRow}>
            <SubscribeButton
              targetUserId={authorUserId}
              iconOnly
              style={[styles.actionButton, globalFocusStyles.focusable]}
            />
            <Pressable
              onPress={openAuthorMessage}
              accessibilityRole="button"
              accessibilityLabel={messageTitle}
              hitSlop={6}
              testID="travel-author-message-button"
              ref={setMessageButtonRef as any}
              style={({ pressed }) => [
                styles.actionButton,
                globalFocusStyles.focusable,
                pressed ? styles.pressed : null,
              ]}
            >
              <Feather name="mail" size={19} color={colors.text} />
            </Pressable>
            <Pressable
              onPress={openAuthorTravels}
              accessibilityRole="button"
              accessibilityLabel={i18nT(
                'travel:components.travel.details.TravelAuthorQuickLink.otkryt_vse_puteshestviya_avtora_value1_940ad4dd',
                { value1: displayName },
              )}
              hitSlop={6}
              testID="travel-author-all-travels-button"
              ref={setAllTravelsButtonRef as any}
              style={({ pressed }) => [
                styles.actionButton,
                globalFocusStyles.focusable,
                pressed ? styles.pressed : null,
              ]}
            >
              <Feather name="map" size={20} color={colors.primaryText} />
            </Pressable>
          </View>

          {socialLinks.length > 0 ? (
            <View style={styles.socialActionsRow}>
              {socialLinks.map((social) => {
                const socialTitle = i18nT('travel:components.travel.AuthorCard.otkryt_value1_2165b58d', {
                  value1: social.label,
                })
                return (
                  <Pressable
                    key={social.key}
                    onPress={() => openSocialLink(social.url)}
                    accessibilityRole="link"
                    accessibilityLabel={socialTitle}
                    hitSlop={6}
                    testID={`travel-author-social-${social.key}-button`}
                    ref={((node: unknown) => setWebNodeTitle(node, socialTitle)) as any}
                    style={({ pressed }) => [
                      styles.actionButton,
                      globalFocusStyles.focusable,
                      pressed ? styles.pressed : null,
                    ]}
                  >
                    <Feather name={social.icon} size={19} color={colors.primaryText} />
                  </Pressable>
                )
              })}
            </View>
          ) : null}
        </View>
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
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarInitial: {
      color: colors.textMuted,
      fontSize: 18,
      fontWeight: '800',
      lineHeight: 22,
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
    actionsColumn: {
      flexShrink: 0,
      alignItems: 'flex-end',
      gap: DESIGN_TOKENS.spacing.xxs,
      maxWidth: AUTHOR_ACTIONS_MAX_WIDTH,
    },
    actionsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: DESIGN_TOKENS.spacing.xs,
    },
    socialActionsRow: {
      maxWidth: AUTHOR_ACTIONS_MAX_WIDTH,
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: DESIGN_TOKENS.spacing.xs,
    },
    name: {
      flexShrink: 1,
      color: colors.text,
      fontSize: 17,
      lineHeight: 22,
      fontWeight: '800',
    },
    actionButton: {
      width: 44,
      height: 44,
      minWidth: 44,
      minHeight: 44,
      flexShrink: 0,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 0,
      paddingVertical: 0,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: colors.borderLight,
      backgroundColor: colors.primarySoft,
      ...Platform.select({
        web: {
          cursor: 'pointer' as any,
        },
      }),
    },
    pressed: {
      opacity: 0.86,
      transform: [{ scale: 0.99 }],
    },
  })

export default memo(TravelAuthorQuickLink)
