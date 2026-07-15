import React, { memo, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  View,
  useWindowDimensions,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import Feather from '@expo/vector-icons/Feather'

import { Text } from '@/ui/paper'
import type { Travel } from '@/types/types'
// WeatherWidget is non-critical sidebar chrome and already rendered inside a
// <Suspense fallback={<WidgetFallback/>}>. Load it lazily so its JS (weather
// model + UI) is split out of the eager desktop bundle instead of bloating
// __common and inflating hydration TBT on desktop.
const WeatherWidget = React.lazy(() => import('@/components/home/WeatherWidget'))
import {
  buildTravelSectionLinks,
  type TravelSectionLink,
} from '@/components/travel/sectionLinks'
import { METRICS } from '@/constants/layout'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useTheme, useThemedColors } from '@/hooks/useTheme'
import { useUserProfileCached } from '@/hooks/useUserProfileCached'
import { downloadTravelRouteFile } from '@/utils/travelRouteDownload'
import { useTravelRouteFiles } from '@/hooks/useTravelRouteFiles'
import { useAuthStore } from '@/stores/authStore'
import { appendReturnToParam, normalizeInternalReturnPath } from '@/utils/navigationReturnPath'

import {
  SIDEBAR_WEATHER_RESERVE_HEIGHT,
  emitOpenSection,
  parseViews,
  pickRouteFile,
  resolveAvatar,
  resolveOwnerId,
  shouldShowDivider,
  webOnly,
} from './compactSideBar/helpers'
import { createStyles } from './compactSideBar/styles'
import { AuthorBlock } from './compactSideBar/parts/AuthorBlock'
import { NavRow } from './compactSideBar/parts/NavRow'
import { WeatherPlaceholder } from './compactSideBar/parts/WeatherPlaceholder'
import { WidgetFallback } from './compactSideBar/parts/WidgetFallback'
import { translate as i18nT } from '@/i18n'


if (Platform.OS === 'web') {
  require('./CompactSideBarTravel.web.css')
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
  const searchParams = useLocalSearchParams<{
    returnTo?: string | string[]
    from?: string | string[]
  }>()
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
  const returnToPath = useMemo(
    () => normalizeInternalReturnPath(searchParams.returnTo ?? searchParams.from),
    [searchParams.returnTo, searchParams.from],
  )

  const userName = (travel as any).userName || ''
  const whenLine = [(travel as any).monthName || '', (travel as any).year ?? '']
    .map((v) => (v == null ? '' : String(v)))
    .filter(Boolean)
    .join(' ')
  const views = parseViews(travel)

  const notifyUnavailable = useCallback((label: string) => {
    if ((Platform.OS === 'web')) {
      try {
        window.alert?.(i18nT('travel:components.travel.CompactSideBarTravel.razdel_nedostupen_52d85d28'))
      } catch {
        /* noop */
      }
      return
    }
    Alert.alert?.(i18nT('travel:components.travel.CompactSideBarTravel.nedostupno_d9fa1777'), i18nT('travel:components.travel.CompactSideBarTravel.razdel_value1_nedostupen_7285035f', { value1: label }))
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
      const label = navLinks.find((l) => l.key === key)?.label ?? i18nT('travel:components.travel.CompactSideBarTravel.sectionFallback')
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

  const handleWriteToAuthor = useCallback(() => {
    if (authorUserId) goInternal(`/messages?userId=${encodeURIComponent(authorUserId)}`)
  }, [authorUserId, goInternal])

  const handleEdit = useCallback(() => {
    if (canEdit) goInternal(appendReturnToParam(`/travel/${travel.id}/`, returnToPath))
  }, [canEdit, goInternal, returnToPath, travel.id])

  const [isRouteDownloading, setIsRouteDownloading] = useState(false)
  const handleDownloadRoute = useCallback(async () => {
    const travelId = (travel as any)?.id
    if (!travelId || isRouteDownloading || !supportedRouteFile) {
      if (!supportedRouteFile) notifyUnavailable(i18nT('travel:components.travel.CompactSideBarTravel.skachat_marshrut_4c1eda2d'))
      return
    }
    setIsRouteDownloading(true)
    try {
      const started = await downloadTravelRouteFile(travelId, supportedRouteFile)
      if (!started) {
        notifyUnavailable(i18nT('travel:components.travel.CompactSideBarTravel.skachat_marshrut_4c1eda2d'))
      }
    } catch {
      notifyUnavailable(i18nT('travel:components.travel.CompactSideBarTravel.skachat_marshrut_4c1eda2d'))
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
                accessibilityLabel={i18nT('travel:components.travel.CompactSideBarTravel.zakryt_menyu_3aadf09e')}
                hitSlop={8}
                {...webOnly({ role: 'button', 'aria-label': i18nT('travel:components.travel.CompactSideBarTravel.zakryt_menyu_3aadf09e') } as any)}
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
              style={({ pressed }) => [styles.link, pressed && styles.linkPressed, isRouteDownloading && { opacity: 0.6 }]}
              onPress={handleDownloadRoute}
              disabled={isRouteDownloading}
              accessibilityRole="button"
              accessibilityLabel={i18nT('travel:components.travel.CompactSideBarTravel.skachat_marshrut_4c1eda2d')}
              accessibilityState={{ disabled: isRouteDownloading, busy: isRouteDownloading }}
              {...webOnly({
                'data-sidebar-link': true,
                role: 'button',
                'aria-label': i18nT('travel:components.travel.CompactSideBarTravel.skachat_marshrut_4c1eda2d'),
              } as any)}
            >
              <View style={styles.activeIndicator} />
              <View style={styles.linkLeft}>
                {isRouteDownloading ? (
                  <ActivityIndicator
                    size="small"
                    color={mutedText}
                    style={{ width: (Platform.OS === 'web') && isTablet ? 20 : 18 }}
                  />
                ) : (
                  <Feather
                    name="download"
                    size={(Platform.OS === 'web') && isTablet ? 20 : 18}
                    color={mutedText}
                  />
                )}
                <Text
                  style={[
                    styles.linkTxt,
                    isTablet && { fontSize: DESIGN_TOKENS.typography.sizes.sm },
                    { color: mutedText },
                  ]}
                >
                  {isRouteDownloading ? i18nT('travel:components.travel.CompactSideBarTravel.skachivanie_cab4e4f1') : i18nT('travel:components.travel.CompactSideBarTravel.skachat_marshrut_4c1eda2d')}
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
            accessibilityLabel={i18nT('travel:components.travel.CompactSideBarTravel.zakryt_menyu_3aadf09e')}
            {...webOnly({ role: 'button', 'aria-label': i18nT('travel:components.travel.CompactSideBarTravel.zakryt_menyu_3aadf09e') } as any)}
          >
            <Feather name="x" size={20} color={colors.textInverse} />
            <Text style={[styles.closeTxt, { color: colors.textInverse }]}>{i18nT('travel:components.travel.CompactSideBarTravel.zakryt_250cc0ad')}</Text>
          </Pressable>
        </View>
      )}
    </View>
  )
}

export default memo(CompactSideBarTravel)
