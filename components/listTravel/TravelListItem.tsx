import React, { memo, useCallback, useMemo, useRef } from 'react'
import { ActivityIndicator, Platform, Pressable, Text, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'
import { router } from 'expo-router'

import type { Travel } from '@/types/types'
import OptimizedFavoriteButton from '@/components/travel/OptimizedFavoriteButton'
import TravelStatusButton from '@/components/travel/TravelStatusButton'
import { resolveTravelUrl } from '@/utils/subscriptionsHelpers'
import { routes } from '@/utils/routes'
import UnifiedTravelCard from '@/components/ui/UnifiedTravelCard'
import { isIOSSafariUserAgent } from '@/components/ui/ImageCardMedia'
import CardActionPressable from '@/components/ui/CardActionPressable'
import { useThemedColors } from '@/hooks/useTheme'
import { globalFocusStyles } from '@/styles/globalFocus'
import { formatViewCount } from '@/components/travel/utils/travelHelpers'
import { hasAnyTravelEngagementStats } from '@/utils/travelEngagementStats'

import { getResponsiveCardValues } from './enhancedTravelCardStyles'
import { TRAVEL_CARD_IMAGE_HEIGHT } from './utils/listTravelConstants'
import TravelListItemCountriesList from './TravelListItemCountriesList'
import TravelListItemEngagementMetrics from './TravelListItemEngagementMetrics'
import TravelListItemSelectableOverlay from './TravelListItemSelectableOverlay'
import { createTravelListItemStyles } from './travelListItemStyles'
import {
  hasPetCompanion,
  isLikelyWatermarked,
  normalizeOwnerIds,
  resolveTravelAuthorDisplayName,
  resolveTravelAuthorName,
} from './travelListItemHelpers'
import { useTravelListItemNavigation } from './useTravelListItemNavigation'

const PLACEHOLDER_BLURHASH = 'LEHL6nWB2yk8pyo0adR*.7kCMdnj'
const EMPTY_STYLE = {} as const
const NEW_BADGE_MAX_DAYS = 7
const POPULAR_VIEWS_THRESHOLD = 1000
const TOUCH_GHOST_CLICK_GUARD_MS = 500
const VIEW_ICON_SIZE = Platform.OS === 'web' ? 11 : 10
const BADGE_ICON_SIZE = Platform.OS === 'web' ? 10 : 9
const FAVORITE_ICON_SIZE = Platform.OS === 'web' ? 18 : 16
const IS_WEB = Platform.OS === 'web' || typeof document !== 'undefined'
const ANDROID_RIPPLE =
  Platform.OS === 'android' ? { color: 'rgba(17,24,39,0.06)' } : undefined

const POINTER_EVENTS_BOX_NONE = { pointerEvents: 'box-none' } as any
const ANCHOR_FILL_STYLE = {
  display: 'block',
  width: '100%',
  height: '100%',
} as any

function stopEvent(e: any) {
  e?.stopPropagation?.()
  e?.preventDefault?.()
}

function extractOwnerIds(travel: any): string[] {
  return normalizeOwnerIds(
    travel?.userIds ??
      travel?.userId ??
      travel?.user_id ??
      travel?.ownerId ??
      travel?.owner_id ??
      travel?.user?.id ??
      '',
  )
}

function computePopularityFlags(travel: any, views: number) {
  const createdAt = travel?.created_at ?? travel?.updated_at
  let isNew = false
  if (createdAt) {
    const createdDate = new Date(createdAt)
    if (!isNaN(createdDate.getTime())) {
      const days = (Date.now() - createdDate.getTime()) / 86_400_000
      isNew = days >= 0 && days <= NEW_BADGE_MAX_DAYS
    }
  }
  return { isPopular: views > POPULAR_VIEWS_THRESHOLD, isNew }
}

type Props = {
  travel: Travel
  currentUserId?: string | null
  isSuperuser?: boolean
  isMetravel?: boolean
  onDeletePress?: (id: number) => void
  isFirst?: boolean
  isSingle?: boolean
  selectable?: boolean
  isSelected?: boolean
  onToggle?: () => void
  isMobile?: boolean
  cardWidth?: number
  imageHeight?: number
  viewportWidth?: number
  hideAuthor?: boolean
  visualVariant?: 'default' | 'home-featured'
  webTouchAction?: string
  isDeleting?: boolean
}

function TravelListItem({
  travel,
  currentUserId,
  isSuperuser,
  isMetravel = false,
  onDeletePress,
  isFirst = false,
  isSingle = false,
  selectable = false,
  isSelected = false,
  onToggle,
  isMobile = false,
  cardWidth,
  imageHeight,
  viewportWidth,
  hideAuthor = false,
  visualVariant = 'default',
  webTouchAction,
  isDeleting = false,
}: Props) {
  const colors = useThemedColors()
  const styles = useMemo(() => createTravelListItemStyles(colors), [colors])

  const {
    id,
    slug,
    travel_image_thumb_url: thumbUrl,
    name,
    countryName = '',
    userName,
    countUnicIpView = 0,
  } = travel

  const title = name?.trim() || 'Без названия'
  const views = Number(countUnicIpView) || 0
  const viewsFormatted = formatViewCount(views)
  const travelKey = slug?.trim() || String(id)
  const cardTestId = selectable
    ? `travel-card-selectable-${travelKey}`
    : `travel-card-${travelKey}`

  const authorName = useMemo(
    () => resolveTravelAuthorName(travel, userName),
    [travel, userName],
  )
  const authorDisplayName = useMemo(
    () => resolveTravelAuthorDisplayName(authorName),
    [authorName],
  )

  const ownerIds = useMemo(() => extractOwnerIds(travel), [travel])
  const authorUserId = ownerIds[0] || null

  const canEdit = useMemo(() => {
    if (isSuperuser) return true
    if (!currentUserId || !ownerIds.length) return false
    return ownerIds.includes(String(currentUserId).trim())
  }, [isSuperuser, currentUserId, ownerIds])

  const travelUrl = useMemo(
    () =>
      resolveTravelUrl({
        id: Number(id) || 0,
        slug,
        url: typeof (travel as any)?.url === 'string' ? (travel as any).url : undefined,
      } as any),
    [id, slug, travel],
  )

  const {
    anchorRef,
    navigationUrl,
    handlePress,
    handlePointerEnter,
    isNavigable,
  } = useTravelListItemNavigation({
    id,
    slug,
    travelUrl,
    isMetravel,
    selectable,
    onToggle,
  })

  const isMobileSafariFirstCard = useMemo(() => {
    if (!IS_WEB || !isMobile || !isFirst || typeof navigator === 'undefined') {
      return false
    }
    return isIOSSafariUserAgent(
      String(navigator.userAgent || ''),
      navigator.maxTouchPoints,
    )
  }, [isFirst, isMobile])

  const countries = useMemo(
    () =>
      countryName
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean),
    [countryName],
  )

  const petFriendly = useMemo(
    () => hasPetCompanion(travel.companions),
    [travel.companions],
  )

  const engagementStats = travel.engagementStats
  const hasEngagementStats = hasAnyTravelEngagementStats(engagementStats)

  const effectiveWidth =
    typeof cardWidth === 'number'
      ? cardWidth
      : typeof viewportWidth === 'number'
        ? viewportWidth
        : isMobile
          ? 375
          : 1024

  const responsiveValues = useMemo(
    () => getResponsiveCardValues(effectiveWidth),
    [effectiveWidth],
  )

  const popularityFlags = useMemo(
    () => computePopularityFlags(travel, views),
    [travel, views],
  )

  const lastSelectableTouchAtRef = useRef(0)

  const handleAuthorPress = useCallback(
    (e?: any) => {
      if (!authorUserId) return
      stopEvent(e)
      router.push(routes.user(authorUserId))
    },
    [authorUserId],
  )

  const handleSelectableWebActivate = useCallback(
    (event: any, source: 'click' | 'touch' | 'key' = 'click') => {
      const now = Date.now()
      if (source === 'click' && now - lastSelectableTouchAtRef.current < TOUCH_GHOST_CLICK_GUARD_MS) {
        stopEvent(event)
        return
      }
      if (source === 'touch') lastSelectableTouchAtRef.current = now
      stopEvent(event)
      handlePress()
    },
    [handlePress],
  )

  const handleEdit = useCallback(
    (e?: any) => {
      stopEvent(e)
      router.push(`/travel/${id}`)
    },
    [id],
  )

  const handleDelete = useCallback(
    (e?: any) => {
      stopEvent(e)
      onDeletePress?.(id)
    },
    [id, onDeletePress],
  )

  const handleAnchorClick = useCallback(
    (e: any) => {
      if (!isNavigable) return
      e.stopPropagation()
      const openInNewWindow =
        e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey
      if (openInNewWindow) return
      e.preventDefault()
      handlePress()
    },
    [isNavigable, handlePress],
  )

  const handleAnchorKeyDown = useCallback(
    (e: any) => {
      if (!isNavigable) return
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        handlePress()
      }
    },
    [isNavigable, handlePress],
  )

  const a11yLabel =
    `Путешествие: ${title}` +
    (countries.length ? `. Страны: ${countries.join(', ')}` : '') +
    (views > 0 ? `. Просмотров: ${viewsFormatted}` : '')

  const hasAuthorMeta = !hideAuthor && authorDisplayName !== ''
  const hasRating = travel.rating != null && travel.rating > 0
  const hasContentInfo =
    hasAuthorMeta ||
    countries.length > 0 ||
    views > 0 ||
    hasRating ||
    hasEngagementStats ||
    popularityFlags.isPopular ||
    popularityFlags.isNew ||
    petFriendly

  const selectableWebHandlers = useMemo(() => {
    if (!IS_WEB || !selectable) return EMPTY_STYLE as any
    return {
      role: 'checkbox',
      tabIndex: 0 as const,
      'aria-checked': isSelected,
      'aria-label': a11yLabel,
      onClick: (e: any) => handleSelectableWebActivate(e, 'click'),
      onTouchStart: (e: any) => e.stopPropagation?.(),
      onTouchEnd: (e: any) => handleSelectableWebActivate(e, 'touch'),
      onKeyDown: (e: any) => {
        if (e.key === 'Enter' || e.key === ' ') handleSelectableWebActivate(e, 'key')
      },
      onMouseDown: (e: any) => e.stopPropagation?.(),
    } as any
  }, [selectable, isSelected, a11yLabel, handleSelectableWebActivate])

  const nativeCardProps = IS_WEB
    ? undefined
    : {
        onPress: handlePress,
        android_ripple: ANDROID_RIPPLE,
        accessibilityState: selectable ? { selected: isSelected } : undefined,
        accessibilityLabel: a11yLabel,
        accessibilityRole: 'button' as const,
        accessibilityHint: selectable
          ? 'Двойное нажатие для выбора'
          : 'Двойное нажатие для просмотра деталей',
      }

  const selectableOverlay = selectable ? (
    <TravelListItemSelectableOverlay
      isWeb={IS_WEB}
      isSelected={isSelected}
      handlePress={handlePress}
      handleSelectableWebActivate={handleSelectableWebActivate}
      styles={styles}
      colors={{ textOnPrimary: colors.textOnPrimary }}
    />
  ) : null

  const rightTopSlot = (
    <View
      style={[styles.favoriteButtonContainer, POINTER_EVENTS_BOX_NONE, { flexDirection: 'column', gap: 6 }]}
      {...(IS_WEB && {
        onClick: stopEvent,
        onMouseDown: (e: any) => e.stopPropagation(),
      })}
    >
      <OptimizedFavoriteButton
        id={id}
        type="travel"
        title={title}
        imageUrl={thumbUrl}
        url={travelUrl}
        country={countries[0]}
        size={FAVORITE_ICON_SIZE}
      />
      <TravelStatusButton
        travelId={id}
        travelTitle={title}
        travelUrl={travelUrl}
        travelImageUrl={thumbUrl}
        travelCountry={countries[0]}
        travelYear={travel.year}
        travelMonthName={travel.monthName}
        compact
      />
    </View>
  )

  const leftTopSlot = canEdit ? (
    <View style={styles.adminActionsContainer} testID="admin-actions">
      <CardActionPressable
        accessibilityLabel="Редактировать"
        title="Редактировать"
        onPress={handleEdit}
        style={styles.adminBtn}
        disabled={isDeleting}
        accessibilityState={{ disabled: isDeleting }}
      >
        <Feather name="edit-2" size={14} color={colors.text} />
      </CardActionPressable>
      <View style={styles.adminDivider} />
      <CardActionPressable
        accessibilityLabel={isDeleting ? 'Маршрут удаляется' : 'Удалить'}
        title={isDeleting ? 'Удаляется…' : 'Удалить'}
        onPress={handleDelete}
        style={styles.adminBtn}
        testID="delete-button"
        disabled={isDeleting}
        accessibilityState={{ disabled: isDeleting, busy: isDeleting }}
      >
        {isDeleting ? (
          <ActivityIndicator size="small" color={colors.danger} />
        ) : (
          <Feather name="trash-2" size={14} color={colors.danger} />
        )}
      </CardActionPressable>
    </View>
  ) : null

  const topRowItems: React.ReactNode[] = []
  if (countries.length > 0) {
    topRowItems.push(
      <TravelListItemCountriesList
        key="countries"
        countries={countries}
        styles={styles}
        iconColor={colors.textSecondary}
      />,
    )
  }
  if (hasAuthorMeta) {
    if (countries.length > 0) {
      topRowItems.push(<View key="author-dot" style={styles.metaDot} />)
    }
    topRowItems.push(
      IS_WEB ? (
        <View
          key="author"
          onClick={handleAuthorPress as any}
          style={{ flexShrink: 1, minWidth: 0 }}
          {...(authorUserId
            ? ({
                role: 'button',
                tabIndex: 0,
                'aria-label': `Открыть профиль автора ${authorDisplayName}`,
              } as any)
            : null)}
        >
          <Text style={styles.metaTxt} numberOfLines={1}>
            {authorDisplayName}
          </Text>
        </View>
      ) : (
        <Pressable
          key="author"
          onPress={handleAuthorPress}
          style={({ pressed }) => [
            { flexShrink: 1, minWidth: 0 },
            pressed && authorUserId ? { opacity: 0.85 } : null,
          ]}
          accessibilityRole="button"
          accessibilityLabel={`Автор: ${authorDisplayName}`}
        >
          <Text style={styles.metaTxt} numberOfLines={1}>
            {authorDisplayName}
          </Text>
        </Pressable>
      ),
    )
  }
  if (views > 0) {
    if (countries.length > 0 || hasAuthorMeta) {
      topRowItems.push(<View key="views-dot" style={styles.metaDot} />)
    }
    topRowItems.push(
      <View key="views" style={styles.metaBoxViews} testID="views-meta">
        <Feather name="eye" size={VIEW_ICON_SIZE} color={colors.textMuted} />
        <Text style={styles.metaTxtViews} numberOfLines={1}>
          {viewsFormatted}
        </Text>
      </View>,
    )
  }

  const contentSlot = hasContentInfo ? (
    <View style={styles.metaRow}>
      <View style={styles.metaInfoTopRow}>{topRowItems}</View>
      <View style={styles.metaBadgesRow}>
        {hasEngagementStats && (
          <TravelListItemEngagementMetrics
            engagementStats={engagementStats}
            styles={styles}
            iconColor={colors.textMuted}
          />
        )}
        {hasRating && (
          <View style={styles.metaRating} testID="rating-meta">
            <Text style={styles.metaRatingStar}>★</Text>
            <Text style={styles.metaRatingValue}>{travel.rating!.toFixed(1)}</Text>
          </View>
        )}
        {popularityFlags.isPopular && (
          <View style={[styles.statusBadge, styles.statusBadgePopular]}>
            <Feather name="trending-up" size={BADGE_ICON_SIZE} color={colors.warningDark} />
          </View>
        )}
        {popularityFlags.isNew && (
          <View style={[styles.statusBadge, styles.statusBadgeNew]}>
            <Feather name="star" size={BADGE_ICON_SIZE} color={colors.success} />
          </View>
        )}
        {petFriendly && (
          <View
            style={[styles.statusBadge, styles.statusBadgePetFriendly]}
            accessibilityLabel="Путешествие с питомцем"
            {...(IS_WEB ? ({ title: 'Путешествие с питомцем' } as any) : null)}
          >
            <Text style={styles.petFriendlyEmoji}>🐾</Text>
          </View>
        )}
      </View>
    </View>
  ) : null

  const cardStyle = [
    styles.card,
    visualVariant === 'home-featured' && styles.cardHomeFeatured,
    isDeleting && ({ opacity: 0.6 } as any),
    IS_WEB && ({ height: '100%' } as any),
    IS_WEB && ({ borderRadius: responsiveValues.borderRadius } as any),
    globalFocusStyles.focusable,
    Platform.OS === 'android' && styles.androidOptimized,
    isSingle && styles.single,
    selectable && isSelected && styles.selected,
  ]

  const card = (
    <UnifiedTravelCard
      title={title}
      imageUrl={thumbUrl && !isLikelyWatermarked(thumbUrl) ? thumbUrl : null}
      onPress={handlePress}
      width={IS_WEB ? undefined : cardWidth}
      mediaFit="contain"
      visualVariant={visualVariant === 'home-featured' ? 'featured' : 'default'}
      heroTitleOverlay
      testID={cardTestId}
      style={cardStyle}
      imageHeight={typeof imageHeight === 'number' ? imageHeight : TRAVEL_CARD_IMAGE_HEIGHT}
      contentPosition="belowMedia"
      insetMedia={false}
      leftTopSlot={leftTopSlot}
      rightTopSlot={selectable ? null : rightTopSlot}
      containerOverlaySlot={selectableOverlay}
      contentSlot={contentSlot}
      webHoverScale={!isMobile && IS_WEB}
      webAsView={IS_WEB}
      webPressableProps={IS_WEB && selectable ? selectableWebHandlers : undefined}
      webTouchAction={webTouchAction ?? (selectable ? 'manipulation' : undefined)}
      mediaProps={{
        placeholderBlurhash: PLACEHOLDER_BLURHASH,
        blurBackground: true,
        allowCriticalWebBlur: IS_WEB,
        revealOnLoadOnly: isMobileSafariFirstCard,
        recyclingKey: travelKey,
        priority: IS_WEB ? (isFirst ? 'high' : 'low') : 'normal',
        loading: IS_WEB ? (isFirst ? 'eager' : 'lazy') : 'lazy',
        prefetch: IS_WEB ? isFirst : false,
      }}
      {...nativeCardProps}
    />
  )

  const wrappedCard =
    IS_WEB && !selectable ? (
      <a
        ref={anchorRef}
        href={isNavigable ? navigationUrl : undefined}
        style={visualVariant === 'home-featured' ? ANCHOR_FILL_STYLE : (EMPTY_STYLE as any)}
        data-testid="travel-card-link"
        role={isNavigable ? undefined : 'group'}
        tabIndex={isNavigable ? undefined : -1}
        aria-disabled={!isNavigable}
        onPointerEnter={handlePointerEnter}
        onClick={handleAnchorClick}
        onKeyDown={handleAnchorKeyDown}
      >
        {card}
      </a>
    ) : (
      card
    )

  return (
    <View
      style={[
        styles.wrap,
        IS_WEB && typeof cardWidth === 'number' && { width: '100%' },
      ]}
    >
      {wrappedCard}
    </View>
  )
}

function areEqual(prev: Props, next: Props) {
  // React Query keeps travel object references stable across renders, so a
  // changed reference means the underlying data changed — re-render rather than
  // diffing an allowlist that silently drops slug/companions/year/user/etc.
  if (prev.travel !== next.travel) return false
  return (
    prev.currentUserId === next.currentUserId &&
    prev.onToggle === next.onToggle &&
    prev.onDeletePress === next.onDeletePress &&
    prev.isSuperuser === next.isSuperuser &&
    prev.isMetravel === next.isMetravel &&
    prev.isFirst === next.isFirst &&
    prev.isSingle === next.isSingle &&
    prev.selectable === next.selectable &&
    prev.isSelected === next.isSelected &&
    prev.visualVariant === next.visualVariant &&
    prev.hideAuthor === next.hideAuthor &&
    prev.isMobile === next.isMobile &&
    prev.cardWidth === next.cardWidth &&
    prev.imageHeight === next.imageHeight &&
    prev.viewportWidth === next.viewportWidth &&
    prev.webTouchAction === next.webTouchAction &&
    prev.isDeleting === next.isDeleting
  )
}

export default memo(TravelListItem, areEqual)
