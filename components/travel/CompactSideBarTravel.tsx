import React, { memo, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  DeviceEventEmitter,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native'
import { useRouter } from 'expo-router'
import Feather from '@expo/vector-icons/Feather'

import { Text } from '@/ui/paper'
import type { Travel } from '@/types/types'
import {
  buildTravelSectionLinks,
  type TravelSectionLink,
} from '@/components/travel/sectionLinks'
import WeatherWidget from '@/components/home/WeatherWidget'
import { METRICS } from '@/constants/layout'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useTheme, useThemedColors } from '@/hooks/useTheme'
import ImageCardMedia from '@/components/ui/ImageCardMedia'
import Button from '@/components/ui/Button'
import SubscribeButton from '@/components/ui/SubscribeButton'
import { SectionSkeleton } from '@/components/ui/SectionSkeleton'
import { useUserProfileCached } from '@/hooks/useUserProfileCached'
import { globalFocusStyles } from '@/styles/globalFocus'
import {
  buildTravelRouteDownloadPath,
  downloadTravelRouteFileBlob,
} from '@/api/travelRoutes'
import { downloadBlobOnWeb } from '@/utils/downloadUrlOnWeb'
import { normalizeAvatarUrl } from '@/utils/mediaUrl'
import { openExternalUrlInNewTab } from '@/utils/externalLinks'
import { useTravelRouteFiles } from '@/hooks/useTravelRouteFiles'
import { useAuthStore } from '@/stores/authStore'
import TravelPdfExportControl from '@/components/travel/TravelPdfExportControl'

if (Platform.OS === 'web') {
  require('./CompactSideBarTravel.web.css')
}

const SIDEBAR_WEATHER_RESERVE_HEIGHT = 188
const ROUTE_FILE_EXTS = new Set(['gpx', 'kml'])
const DIVIDER_BEFORE_KEYS = new Set(['recommendation', 'plus', 'map', 'popular'])
const DIVIDER_SKIP_PREV = new Set(['description', 'recommendation'])

function webOnly<T extends object>(props: T): T | {} {
  return Platform.OS === 'web' ? props : {}
}

function resolveOwnerId(travel: any): number | string | null {
  const raw = travel?.userIds
  if (Array.isArray(raw) && raw.length > 0) return raw[0] ?? null
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) return raw
  if (typeof raw === 'string') {
    const first = raw.split(',').map((v) => v.trim()).find(Boolean)
    if (!first) return null
    const n = Number(first)
    return Number.isFinite(n) && n > 0 ? n : first
  }
  const direct = travel?.userId ?? travel?.user?.id ?? null
  if (direct == null) return null
  return typeof direct === 'string' ? direct.trim() || null : direct
}

function resolveAvatar(profile: any, travel: any): string {
  const raw =
    profile?.avatar ??
    travel?.user?.avatar ??
    travel?.avatar ??
    travel?.userAvatar ??
    travel?.user_avatar ??
    travel?.authorAvatar ??
    travel?.author_avatar ??
    null
  return raw ? normalizeAvatarUrl(String(raw)) || '' : ''
}

function pickRouteFile(files: any[]) {
  return (
    files.find((file) => {
      const ext = String(file.ext ?? file.original_name?.split('.').pop() ?? '')
        .toLowerCase()
        .replace(/^\./, '')
      return ROUTE_FILE_EXTS.has(ext)
    }) ?? null
  )
}

function parseViews(travel: any): number | null {
  const raw = travel?.countUnicIpView
  if (raw == null) return null
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

function emitOpenSection(key: string) {
  if (Platform.OS === 'web') {
    window.dispatchEvent(new CustomEvent('open-section', { detail: { key } }))
  } else {
    DeviceEventEmitter.emit('open-section', key)
  }
}

function attachWebTitle(title: string) {
  if (!(Platform.OS === 'web')) return undefined
  return (el: any) => {
    if (el instanceof HTMLElement) el.setAttribute('title', title)
  }
}

const WidgetFallback = () => {
  const colors = useThemedColors()
  const styles = useMemo(() => createStyles(colors), [colors])
  return (
    <View style={styles.fallback}>
      <ActivityIndicator size="small" color={colors.primary} />
    </View>
  )
}

const WeatherPlaceholder = memo(function WeatherPlaceholder() {
  return (
    <View
      style={weatherPlaceholderStyle}
      {...webOnly({ 'data-sidebar-weather-placeholder': true } as any)}
    >
      <SectionSkeleton lines={2} height={18} />
      <View style={{ height: 14 }} />
      <SectionSkeleton lines={3} height={56} />
    </View>
  )
})

const weatherPlaceholderStyle = {
  position: 'absolute' as const,
  inset: 0 as any,
  minHeight: SIDEBAR_WEATHER_RESERVE_HEIGHT,
  width: '100%' as const,
  paddingTop: 10,
  pointerEvents: 'none' as const,
}

type SideBarProps = {
  refs: Record<string, React.RefObject<View>>
  travel: Travel
  isMobile: boolean
  onNavigate: (key: string) => void
  closeMenu: () => void
  activeSection?: string
  links?: TravelSectionLink[]
}

function CompactSideBarTravel({
  refs,
  travel,
  isMobile,
  onNavigate,
  closeMenu,
  activeSection: externalActiveSection,
  links,
}: SideBarProps) {
  const { width } = useWindowDimensions()
  const isTablet =
    width >= METRICS.breakpoints.tablet && width < METRICS.breakpoints.largeTablet

  const router = useRouter()
  const { isDark } = useTheme()
  const colors = useThemedColors()
  const styles = useMemo(() => createStyles(colors), [colors])
  const textColor = colors.text
  const mutedText = isDark ? colors.textMuted : colors.textSecondary

  const isSuperuser = useAuthStore((s) => s.isSuperuser)
  const storedUserId = useAuthStore((s) => s.userId)

  const [deferredEnabled, setDeferredEnabled] = useState(!(Platform.OS === 'web') || isMobile)
  const enableDeferred = useCallback(() => setDeferredEnabled(true), [])

  useEffect(() => {
    setDeferredEnabled(!(Platform.OS === 'web') || isMobile)
  }, [isMobile, travel?.id])

  const travelOwnerId = useMemo(() => resolveOwnerId(travel), [travel])
  const authorUserId =
    travelOwnerId != null ? String(travelOwnerId).trim() || null : null

  const shouldLoadAuthorImmediately = (Platform.OS === 'web') && !isMobile
  const { profile: authorProfile } = useUserProfileCached(travelOwnerId, {
    enabled:
      !!travelOwnerId && (deferredEnabled || shouldLoadAuthorImmediately),
  })

  const { data: routeFiles = [] } = useTravelRouteFiles((travel as any)?.id, {
    enabled: deferredEnabled && !!(travel as any)?.id,
  })

  const avatarUri = useMemo(
    () => resolveAvatar(authorProfile, travel),
    [authorProfile, travel],
  )

  const supportedRouteFile = useMemo(() => pickRouteFile(routeFiles as any[]), [routeFiles])
  const hasDownloadableRoute = !!supportedRouteFile

  const [localActive, setLocalActive] = useState('')
  const isExternallyControlled = externalActiveSection !== undefined
  const currentActive = isExternallyControlled ? externalActiveSection! : localActive

  const [weatherSettled, setWeatherSettled] = useState(!(Platform.OS === 'web'))
  const handleWeatherSettled = useCallback(() => setWeatherSettled(true), [])
  useEffect(() => {
    if ((Platform.OS === 'web')) setWeatherSettled(false)
  }, [travel?.id])

  const navLinks = useMemo(
    () => (Array.isArray(links) && links.length ? links : buildTravelSectionLinks(travel)),
    [links, travel],
  )

  const isOwn =
    !!authorUserId && !!storedUserId && String(storedUserId) === String(authorUserId)
  const canEdit = isSuperuser || isOwn

  const userName = (travel as any).userName || ''
  const whenLine = [(travel as any).monthName || '', (travel as any).year ?? '']
    .map((v) => (v == null ? '' : String(v)))
    .filter(Boolean)
    .join(' ')
  const views = parseViews(travel)

  const notifyUnavailable = useCallback((label: string) => {
    if ((Platform.OS === 'web')) {
      try {
        window.alert?.('Раздел недоступен')
      } catch {
        /* noop */
      }
      return
    }
    Alert.alert?.('Недоступно', `Раздел «${label}» недоступен`)
  }, [])

  const isSectionAvailable = useCallback(
    (key: string) => {
      if ((Platform.OS === 'web')) return true
      return !!(key && refs?.[key]?.current)
    },
    [refs],
  )

  const handleNavLinkPress = useCallback(
    (key: string) => {
      const label = navLinks.find((l) => l.key === key)?.label ?? 'Раздел'
      if (!isSectionAvailable(key)) {
        notifyUnavailable(label)
        return
      }
      if (!isExternallyControlled) setLocalActive(key)
      emitOpenSection(key)
      try {
        onNavigate(key)
      } catch {
        notifyUnavailable(label)
        return
      }
      if (isMobile) closeMenu()
    },
    [
      closeMenu,
      isExternallyControlled,
      isMobile,
      isSectionAvailable,
      navLinks,
      notifyUnavailable,
      onNavigate,
    ],
  )

  const goInternal = useCallback(
    (url: string) => {
      if (!url || !url.startsWith('/')) return
      router.push(url as any)
    },
    [router],
  )

  const handleOpenAuthorProfile = useCallback(() => {
    if (authorUserId) goInternal(`/user/${authorUserId}`)
  }, [authorUserId, goInternal])

  const handleUserTravels = useCallback(() => {
    if (authorUserId) goInternal(`/search?user_id=${encodeURIComponent(authorUserId)}`)
  }, [authorUserId, goInternal])

  const handleWriteToAuthor = useCallback(() => {
    if (authorUserId) goInternal(`/messages?userId=${encodeURIComponent(authorUserId)}`)
  }, [authorUserId, goInternal])

  const handleEdit = useCallback(() => {
    if (canEdit) goInternal(`/travel/${travel.id}/`)
  }, [canEdit, goInternal, travel.id])

  const [isRouteDownloading, setIsRouteDownloading] = useState(false)
  const handleDownloadRoute = useCallback(async () => {
    const travelId = (travel as any)?.id
    if (!travelId || isRouteDownloading || !supportedRouteFile) {
      if (!supportedRouteFile) notifyUnavailable('Скачать маршрут')
      return
    }
    setIsRouteDownloading(true)
    try {
      const ext = String(supportedRouteFile.ext || 'gpx').replace(/^\./, '')
      const filename =
        supportedRouteFile.original_name || `route-${supportedRouteFile.id}.${ext}`

      if ((Platform.OS === 'web') && typeof window !== 'undefined') {
        const response = await downloadTravelRouteFileBlob(travelId, supportedRouteFile.id)
        const blob = new Blob([response.text], {
          type: response.contentType || 'application/octet-stream',
        })
        if (!downloadBlobOnWeb(blob, response.filename || filename)) {
          notifyUnavailable('Скачать маршрут')
        }
        return
      }
      const url =
        String(supportedRouteFile.download_url ?? '').trim() ||
        buildTravelRouteDownloadPath(travelId, supportedRouteFile.id)
      await openExternalUrlInNewTab(url, {
        allowRelative: true,
        baseUrl: (process.env.EXPO_PUBLIC_API_URL as string) || undefined,
      })
    } catch {
      notifyUnavailable('Скачать маршрут')
    } finally {
      setIsRouteDownloading(false)
    }
  }, [isRouteDownloading, notifyUnavailable, supportedRouteFile, travel])

  const menuPaddingBottom = isMobile ? 80 : (Platform.OS === 'web') ? 20 : 32
  const menuContentStyle = useMemo(
    () => ({ paddingBottom: menuPaddingBottom, paddingLeft: 10, paddingRight: 10 }),
    [menuPaddingBottom],
  )

  return (
    <View
      style={[styles.root, { backgroundColor: colors.background }]}
      onPointerEnter={(Platform.OS === 'web') ? enableDeferred : undefined}
      onTouchStart={enableDeferred}
      onFocus={(Platform.OS === 'web') ? enableDeferred : undefined}
      {...webOnly({
        'data-sidebar-menu': true,
        'data-sidebar-deferred-ready': deferredEnabled,
      } as any)}
    >
      <View style={styles.menuFrame}>
        <ScrollView
          testID="travel-details-sidebar-menu"
          style={[styles.menu, { width: '100%' }]}
          contentContainerStyle={menuContentStyle}
          showsVerticalScrollIndicator
          nestedScrollEnabled
        >
          {isMobile && (
            <View style={styles.closeTopBar}>
              <Pressable
                onPress={closeMenu}
                style={({ pressed }) => [
                  styles.closeTopBtn,
                  pressed && styles.closeTopBtnPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Закрыть меню"
                hitSlop={8}
                {...webOnly({ role: 'button', 'aria-label': 'Закрыть меню' } as any)}
              >
                <Feather name="x" size={20} color={textColor} />
              </Pressable>
            </View>
          )}

          <AuthorBlock
            styles={styles}
            colors={colors}
            textColor={textColor}
            mutedText={mutedText}
            avatarUri={avatarUri}
            userName={userName}
            authorUserId={authorUserId}
            canEdit={canEdit}
            isOwn={isOwn}
            travel={travel}
            whenLine={whenLine}
            views={views}
            onOpenProfile={handleOpenAuthorProfile}
            onEdit={handleEdit}
            onWrite={handleWriteToAuthor}
            onUserTravels={handleUserTravels}
          />

          {navLinks.map((link, index) => (
            <NavRow
              key={link.key}
              link={link}
              showDividerAbove={shouldShowDivider(navLinks, index)}
              active={currentActive === link.key}
              isTablet={isTablet}
              textColor={textColor}
              mutedText={mutedText}
              colors={colors}
              styles={styles}
              onPress={handleNavLinkPress}
            />
          ))}

          {hasDownloadableRoute && (
            <Pressable
              style={({ pressed }) => [styles.link, pressed && styles.linkPressed]}
              onPress={handleDownloadRoute}
              accessibilityRole="button"
              accessibilityLabel="Скачать маршрут"
              {...webOnly({
                'data-sidebar-link': true,
                role: 'button',
                'aria-label': 'Скачать маршрут',
              } as any)}
            >
              <View style={styles.activeIndicator} />
              <View style={styles.linkLeft}>
                <Feather
                  name="download"
                  size={(Platform.OS === 'web') && isTablet ? 20 : 18}
                  color={mutedText}
                />
                <Text
                  style={[
                    styles.linkTxt,
                    isTablet && { fontSize: DESIGN_TOKENS.typography.sizes.sm },
                    { color: mutedText },
                  ]}
                >
                  {isRouteDownloading ? 'Скачивание...' : 'Скачать маршрут'}
                </Text>
              </View>
            </Pressable>
          )}

          <View
            style={
              (Platform.OS === 'web') && !isMobile
                ? {
                    minHeight: SIDEBAR_WEATHER_RESERVE_HEIGHT,
                    width: '100%',
                    position: 'relative',
                  }
                : null
            }
            {...webOnly({ 'data-sidebar-weather-shell': true } as any)}
          >
            {!weatherSettled && (Platform.OS === 'web') && !isMobile && <WeatherPlaceholder />}
            <Suspense fallback={<WidgetFallback />}>
              <WeatherWidget
                points={travel.travelAddress as any}
                countryName={travel.countryName}
                onSettled={handleWeatherSettled}
              />
            </Suspense>
          </View>
        </ScrollView>
      </View>

      {isMobile && (
        <View style={styles.closeBar}>
          <Pressable
            onPress={closeMenu}
            style={({ pressed }) => [styles.closeBtn, pressed && styles.closeBtnPressed]}
            accessibilityRole="button"
            accessibilityLabel="Закрыть меню"
            {...webOnly({ role: 'button', 'aria-label': 'Закрыть меню' } as any)}
          >
            <Feather name="x" size={20} color={colors.textInverse} />
            <Text style={[styles.closeTxt, { color: colors.textInverse }]}>Закрыть</Text>
          </Pressable>
        </View>
      )}
    </View>
  )
}

function shouldShowDivider(links: TravelSectionLink[], index: number) {
  if (index === 0) return false
  const cur = links[index].key
  const prev = links[index - 1]?.key
  if (!DIVIDER_BEFORE_KEYS.has(cur)) return false
  if (cur === 'map' || cur === 'popular') return true
  return !DIVIDER_SKIP_PREV.has(prev)
}

type NavRowProps = {
  link: TravelSectionLink
  showDividerAbove: boolean
  active: boolean
  isTablet: boolean
  textColor: string
  mutedText: string
  colors: ReturnType<typeof useThemedColors>
  styles: ReturnType<typeof createStyles>
  onPress: (key: string) => void
}

const NavRow = memo(function NavRow({
  link,
  showDividerAbove,
  active,
  isTablet,
  textColor,
  mutedText,
  colors,
  styles,
  onPress,
}: NavRowProps) {
  const { key, icon, label, meta } = link
  const iconSize = (Platform.OS === 'web') && isTablet ? 20 : 18
  const handlePress = useCallback(() => onPress(key), [key, onPress])

  return (
    <>
      {showDividerAbove && (
        <View
          style={styles.linkDivider}
          {...webOnly({ 'data-link-divider': true } as any)}
        />
      )}
      <Pressable
        style={({ pressed }) => [
          styles.link,
          active && styles.linkActive,
          pressed && styles.linkPressed,
        ]}
        onPress={handlePress}
        android_ripple={{ color: colors.primarySoft }}
        accessibilityRole="button"
        accessibilityLabel={label}
        {...webOnly({
          'data-sidebar-link': true,
          'data-active': active ? 'true' : 'false',
          'aria-pressed': active,
          'aria-current': active ? 'page' : undefined,
          role: 'button',
          'aria-label': label,
        } as any)}
      >
        <View
          style={[
            styles.activeIndicator,
            active && styles.activeIndicatorActive,
            { pointerEvents: 'none' },
          ]}
        />
        <View style={styles.linkLeft} {...webOnly({ 'data-icon': true } as any)}>
          <Feather name={icon as any} size={iconSize} color={active ? textColor : mutedText} />
          <Text
            style={[
              styles.linkTxt,
              isTablet && { fontSize: DESIGN_TOKENS.typography.sizes.sm },
              active && styles.linkTxtActive,
              { color: active ? textColor : mutedText },
            ]}
            {...webOnly({ 'data-link-text': true } as any)}
          >
            {label}
          </Text>
        </View>
        {meta ? (
          <View style={styles.linkMetaPill}>
            <Text style={[styles.linkMetaText, { color: mutedText }]}>{meta}</Text>
          </View>
        ) : null}
      </Pressable>
    </>
  )
})

type AuthorBlockProps = {
  styles: ReturnType<typeof createStyles>
  colors: ReturnType<typeof useThemedColors>
  textColor: string
  mutedText: string
  avatarUri: string
  userName: string
  authorUserId: string | null
  canEdit: boolean
  isOwn: boolean
  travel: Travel
  whenLine: string
  views: number | null
  onOpenProfile: () => void
  onEdit: () => void
  onWrite: () => void
  onUserTravels: () => void
}

const AuthorBlock = memo(function AuthorBlock({
  styles,
  colors,
  textColor,
  mutedText,
  avatarUri,
  userName,
  authorUserId,
  canEdit,
  isOwn,
  travel,
  whenLine,
  views,
  onOpenProfile,
  onEdit,
  onWrite,
  onUserTravels,
}: AuthorBlockProps) {
  const showSubscribeAndWrite = !isOwn && !!authorUserId
  const displayName = userName || 'Пользователь'
  const editTitleRef = useMemo(() => attachWebTitle('Редактировать'), [])
  const writeTitleRef = useMemo(() => attachWebTitle('Написать автору'), [])

  return (
    <View
      style={[styles.card, { backgroundColor: colors.surface }]}
      {...webOnly({ 'data-sidebar-card': true } as any)}
    >
      <View style={styles.cardRow}>
        <View style={styles.avatarWrap} {...webOnly({ 'data-sidebar-avatar': true } as any)}>
          {avatarUri ? (
            <ImageCardMedia
              src={avatarUri}
              alt={displayName}
              width={styles.avatar.width as any}
              height={styles.avatar.height as any}
              borderRadius={styles.avatar.borderRadius as any}
              fit="contain"
              blurBackground
              allowCriticalWebBlur
              priority="low"
              loading="lazy"
              style={styles.avatar}
            />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]} />
          )}
        </View>

        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={styles.userRow}>
            <Pressable
              onPress={onOpenProfile}
              disabled={!authorUserId}
              accessibilityRole={authorUserId ? 'button' : undefined}
              accessibilityLabel={
                authorUserId ? `Открыть профиль автора ${displayName}` : undefined
              }
              style={({ pressed }) => [
                styles.userNameWrap,
                globalFocusStyles.focusable,
                pressed && authorUserId ? { opacity: 0.9 } : null,
              ]}
              {...webOnly(
                authorUserId
                  ? ({
                      cursor: 'pointer',
                      role: 'button',
                      'aria-label': `Открыть профиль автора ${displayName}`,
                      'data-author-name': true,
                      title: `Открыть профиль автора ${displayName}`,
                    } as any)
                  : {},
              )}
            >
              <Text style={[styles.userName, { color: textColor }]} numberOfLines={1}>
                <Text style={[styles.userNamePrimary, { color: textColor }]}>
                  {displayName}
                </Text>
              </Text>
            </Pressable>

            <View style={styles.actionsRow}>
              {canEdit && (
                <Pressable
                  onPress={onEdit}
                  accessibilityRole="button"
                  accessibilityLabel="Редактировать путешествие"
                  style={({ pressed }) => [
                    styles.actionBtn,
                    globalFocusStyles.focusable,
                    pressed && styles.actionBtnPressed,
                  ]}
                  ref={editTitleRef}
                  {...webOnly({
                    'data-action-btn': true,
                    role: 'button',
                    'aria-label': 'Редактировать путешествие',
                  } as any)}
                >
                  <Feather name="edit" size={18} color={textColor} />
                </Pressable>
              )}

              {(Platform.OS === 'web') && (
                <TravelPdfExportControl
                  travel={travel}
                  mutedText={mutedText}
                  actionBtnStyle={styles.actionBtn}
                  actionBtnPressedStyle={styles.actionBtnPressed}
                  actionBtnDisabledStyle={styles.actionBtnDisabled}
                />
              )}

              {showSubscribeAndWrite && (
                <>
                  <SubscribeButton
                    targetUserId={authorUserId!}
                    iconOnly
                    style={[styles.actionBtn, globalFocusStyles.focusable]}
                  />
                  <Pressable
                    onPress={onWrite}
                    accessibilityRole="button"
                    accessibilityLabel={`Написать автору ${displayName}`}
                    style={({ pressed }) => [
                      styles.actionBtn,
                      globalFocusStyles.focusable,
                      pressed && styles.actionBtnPressed,
                    ]}
                    ref={writeTitleRef}
                    {...webOnly({
                      'data-action-btn': true,
                      role: 'button',
                      'aria-label': `Написать автору ${displayName}`,
                    } as any)}
                  >
                    <Feather name="mail" size={18} color={textColor} />
                  </Pressable>
                </>
              )}
            </View>
          </View>

          {(whenLine || views != null) && (
            <View style={styles.metaRow}>
              {whenLine ? (
                <View style={styles.metaPill}>
                  <Feather name="calendar" size={14} color={mutedText} />
                  <Text
                    style={[styles.metaText, { color: mutedText }]}
                    numberOfLines={1}
                  >
                    {whenLine}
                  </Text>
                </View>
              ) : null}
              {views != null && (
                <View
                  style={styles.metaPill}
                  accessibilityRole={(Platform.OS === 'web') ? undefined : 'text'}
                  accessibilityLabel={`${views.toLocaleString('ru-RU')} просмотров`}
                  {...webOnly({
                    'aria-label': `${views.toLocaleString('ru-RU')} просмотров`,
                  } as any)}
                >
                  <Feather name="eye" size={14} color={mutedText} />
                  <Text
                    style={[styles.metaText, { color: mutedText }]}
                    numberOfLines={1}
                  >
                    {views.toLocaleString('ru-RU')}
                  </Text>
                </View>
              )}
            </View>
          )}

          {userName ? (
            <View style={styles.allTravelsWrap}>
              <Button
                label="Все путешествия автора"
                onPress={onUserTravels}
                variant="secondary"
                size="sm"
                fullWidth
                accessibilityLabel="Все путешествия автора"
                style={styles.allTravelsButton}
                labelStyle={styles.allTravelsButtonLabel}
                labelNumberOfLines={2}
                {...webOnly({ testID: 'open-author-travels' } as any)}
              />
            </View>
          ) : null}
        </View>
      </View>
    </View>
  )
})

export default memo(CompactSideBarTravel)

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.surface,
      ...((Platform.OS === 'web')
        ? {
            position: 'relative' as any,
            display: 'flex' as any,
            flexDirection: 'column' as any,
            minHeight: 0 as any,
          }
        : {}),
    },
    menuFrame: {
      flex: 1,
      minHeight: 0,
      ...((Platform.OS === 'web')
        ? {
            height: '100%' as any,
            maxHeight: '100%' as any,
            overflow: 'hidden' as any,
          }
        : {}),
    },
    menu: {
      paddingTop: 16,
      alignSelf: 'flex-start',
      ...((Platform.OS === 'web')
        ? {
            maxWidth: 350,
            flex: 1,
            height: '100%' as any,
            maxHeight: '100%' as any,
            minHeight: 0 as any,
            overflowY: 'auto' as any,
            overflowX: 'hidden' as any,
            overscrollBehavior: 'contain' as any,
            width: '100%',
            alignSelf: 'stretch' as any,
          }
        : {}),
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: DESIGN_TOKENS.radii.md,
      padding: 14,
      marginBottom: (Platform.OS === 'web') ? 8 : 10,
      borderWidth: 1,
      borderColor: colors.borderLight,
      width: '100%',
      maxWidth: '100%',
      overflow: 'hidden' as const,
    },
    cardRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: (Platform.OS === 'web') ? DESIGN_TOKENS.spacing.xs : DESIGN_TOKENS.spacing.sm,
    },
    avatarWrap: {
      marginRight: DESIGN_TOKENS.spacing.sm,
      alignItems: 'center',
      justifyContent: 'center',
      ...((Platform.OS === 'web') ? ({ position: 'relative' as any }) : {}),
    },
    avatar: {
      width: (Platform.OS === 'web') ? 44 : 50,
      height: (Platform.OS === 'web') ? 44 : 50,
      borderRadius: (Platform.OS === 'web') ? 22 : 25,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    avatarPlaceholder: {
      backgroundColor: colors.backgroundSecondary,
      borderColor: colors.borderLight,
    },
    userRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 2,
    },
    actionsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: DESIGN_TOKENS.spacing.xs,
      marginLeft: 'auto',
      flexShrink: 0,
      alignSelf: 'center',
    },
    actionBtn: {
      width: (Platform.OS === 'web') ? 40 : 42,
      height: (Platform.OS === 'web') ? 40 : 42,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceMuted,
      borderWidth: 1,
      borderColor: colors.borderLight,
      ...((Platform.OS === 'web')
        ? ({
            cursor: 'pointer' as any,
            transition: 'background-color 0.15s ease, border-color 0.15s ease' as any,
            ':hover': {
              backgroundColor: colors.backgroundSecondary,
              borderColor: colors.border,
            } as any,
          } as any)
        : {}),
    },
    actionBtnPressed: { opacity: 0.85, backgroundColor: colors.backgroundSecondary },
    actionBtnDisabled: { opacity: 0.4, backgroundColor: colors.backgroundSecondary },
    userNameWrap: { flexGrow: 1, flexShrink: 1, minWidth: 0 },
    userName: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.text,
      fontFamily: 'Georgia',
      flexShrink: 1,
      lineHeight: (Platform.OS === 'web') ? 19 : 20,
      letterSpacing: -0.2,
    },
    userNamePrimary: { fontWeight: '800', color: colors.text },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'nowrap',
      columnGap: 10,
      marginTop: 6,
    },
    metaPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      flexShrink: 1,
      minWidth: 0,
    },
    metaText: {
      fontSize: (Platform.OS === 'web') ? 12 : 13,
      color: colors.textMuted,
      fontFamily: 'Georgia',
      fontWeight: '500',
      lineHeight: (Platform.OS === 'web') ? 18 : 20,
      flexShrink: 1,
    },
    link: {
      position: 'relative',
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: (Platform.OS === 'web') ? 38 : 40,
      paddingVertical: (Platform.OS === 'web') ? 8 : 10,
      paddingHorizontal: 12,
      paddingLeft: (Platform.OS === 'web') ? 16 : 18,
      borderRadius: 12,
      marginBottom: (Platform.OS === 'web') ? 2 : 4,
      width: '100%',
      maxWidth: '100%',
      justifyContent: 'space-between',
      backgroundColor: 'transparent',
      ...((Platform.OS === 'web')
        ? {
            cursor: 'pointer' as any,
            transition: 'background-color 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            ':hover': { backgroundColor: colors.backgroundSecondary } as any,
          }
        : {}),
    },
    linkLeft: { flexDirection: 'row', alignItems: 'center', flexShrink: 1, minWidth: 0 },
    activeIndicator: {
      position: 'absolute',
      left: 0,
      top: '50%',
      marginTop: (Platform.OS === 'web') ? -9 : -12,
      height: (Platform.OS === 'web') ? 18 : 24,
      width: 3,
      borderRadius: 999,
      backgroundColor: 'transparent',
      ...((Platform.OS === 'web') ? { transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)' } : {}),
    },
    activeIndicatorActive: { backgroundColor: colors.primary, width: 4 },
    linkPressed: { backgroundColor: colors.primarySoft },
    linkActive: { backgroundColor: colors.primaryLight },
    linkTxt: {
      marginLeft: 10,
      fontSize: (Platform.OS === 'web') ? 14 : 15,
      fontFamily: 'Georgia',
      color: colors.text,
      fontWeight: '500',
      lineHeight: (Platform.OS === 'web') ? 20 : 22,
      ...((Platform.OS === 'web') ? ({ transition: 'color 0.2s ease' } as any) : {}),
    },
    linkTxtActive: { color: colors.primaryText, fontWeight: '700' },
    linkMetaPill: {
      marginLeft: (Platform.OS === 'web') ? 8 : 10,
      paddingHorizontal: (Platform.OS === 'web') ? 6 : 8,
      paddingVertical: (Platform.OS === 'web') ? 2 : 3,
      borderRadius: 999,
      backgroundColor: colors.surfaceMuted,
      flexShrink: 1,
      maxWidth: (Platform.OS === 'web') ? 120 : 140,
    },
    linkMetaText: {
      fontSize: (Platform.OS === 'web') ? 12 : 14,
      color: colors.textMuted,
      fontFamily: 'Georgia',
      fontWeight: '600',
      lineHeight: (Platform.OS === 'web') ? 16 : 18,
      flexWrap: 'wrap',
    },
    linkDivider: {
      height: 1,
      backgroundColor: colors.borderLight,
      marginVertical: (Platform.OS === 'web') ? 10 : 16,
      marginHorizontal: 12,
      ...((Platform.OS === 'web')
        ? ({
            backgroundImage: `linear-gradient(90deg, transparent, ${colors.border}, transparent)`,
            backgroundRepeat: 'no-repeat',
          } as any)
        : {}),
    },
    allTravelsWrap: { marginTop: DESIGN_TOKENS.spacing.xs, width: '100%' },
    allTravelsButton: {
      borderRadius: 999,
      backgroundColor: colors.surfaceMuted,
      borderColor: colors.borderLight,
    },
    allTravelsButtonLabel: {
      color: colors.textSecondary,
      fontWeight: '600',
      textAlign: 'center',
    },
    closeBar: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: colors.primaryDark,
      paddingVertical: DESIGN_TOKENS.spacing.lg,
      alignItems: 'center',
    },
    closeBtn: { flexDirection: 'row', alignItems: 'center' },
    closeBtnPressed: { opacity: 0.7 },
    closeTxt: {
      color: colors.textOnDark,
      fontSize: DESIGN_TOKENS.typography.sizes.md,
      fontFamily: 'Georgia',
      marginLeft: 8,
    },
    closeTopBar: {
      alignItems: 'flex-end',
      marginBottom: DESIGN_TOKENS.spacing.sm,
      paddingRight: 4,
    },
    closeTopBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 4,
      paddingHorizontal: 8,
      borderRadius: 999,
      backgroundColor: colors.surfaceMuted,
    },
    closeTopBtnPressed: { opacity: 0.7 },
    fallback: { paddingVertical: 40, alignItems: 'center' },
  })
