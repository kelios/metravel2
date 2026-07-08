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
import { appendReturnToParam } from '@/utils/navigationReturnPath'
import {
  buildResponsiveImagePropsFromMedia,
  getMediaLqipUrl,
} from '@/utils/travelMediaVariants'

import { getResponsiveCardValues } from './enhancedCardResponsiveValues'
import { TRAVEL_CARD_IMAGE_HEIGHT } from './utils/listTravelConstants'
import TravelListItemCountriesList from './TravelListItemCountriesList'
import TravelListItemEngagementMetrics from './TravelListItemEngagementMetrics'
import TravelListItemSelectableOverlay from './TravelListItemSelectableOverlay'
import { createTravelListItemStyles } from './travelListItemStyles'
import {
  isLikelyWatermarked,
  normalizeOwnerIds,
  resolveDisplayTravelYear,
  resolveTravelAuthorDisplayName,
  resolveTravelAuthorName,
} from './travelListItemHelpers'
import { useTravelListItemNavigation } from './useTravelListItemNavigation'

const PLACEHOLDER_BLURHASH = 'LEHL6nWB2yk8pyo0adR*.7kCMdnj'
const EMPTY_STYLE = {} as const
const TOUCH_GHOST_CLICK_GUARD_MS = 500
const VIEW_ICON_SIZE = Platform.OS === 'web' ? 11 : 10
const FAVORITE_ICON_SIZE = Platform.OS === 'web' ? 18 : 16
const IS_WEB = Platform.OS === 'web' || typeof document !== 'undefined'
const ANDROID_RIPPLE =
  Platform.OS === 'android' ? { color: 'rgba(17,24,39,0.06)' } : undefined
const ANDROID_LIST_IMAGE_PROPS =
  Platform.OS === 'android'
    ? {
        allowDownscaling: true,
        placeholderContentFit: 'contain' as const,
      }
    : undefined

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
  gridColumns?: number
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
  gridColumns,
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
    travel_image_thumb_small_url: thumbSmallUrl,
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
    navigationUrl,
    returnToPath,
    handlePress,
    isNavigable,
  } = useTravelListItemNavigation({
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

  const coverMedia = travel.media?.cover ?? null
  const coverMediaLqip = useMemo(() => getMediaLqipUrl(coverMedia), [coverMedia])
  const coverMediaResponsiveSource = useMemo(() => {
    if (!IS_WEB || !coverMedia) return null
    const targetWidth =
      typeof cardWidth === 'number'
        ? cardWidth
        : visualVariant === 'home-featured'
          ? 480
          : Math.min(effectiveWidth, isMobile ? 640 : 720)

    return buildResponsiveImagePropsFromMedia(coverMedia, {
      maxWidth: Math.max(targetWidth, isFirst ? 720 : 640),
      widths: [160, 320, 480, 640, 720, 960],
      sizes:
        typeof cardWidth === 'number'
          ? `${Math.round(cardWidth)}px`
          : isMobile
            ? '100vw'
            : '(min-width: 1024px) 320px, (min-width: 768px) 33vw, 50vw',
    })
  }, [cardWidth, coverMedia, effectiveWidth, isFirst, isMobile, visualVariant])

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
      router.push(appendReturnToParam(`/travel/${id}`, returnToPath) as any)
    },
    [id, returnToPath],
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

  // Year is shown when the card spans the full row (single-column native grid)
  // or on web (including multi-column grid). Compact native multi-column grids
  // omit it so the meta row stays readable. Invalid/empty year is dropped.
  const showYearContext = IS_WEB || gridColumns === 1
  const displayYear = showYearContext ? resolveDisplayTravelYear(travel.year) : null

  const a11yLabel =
    `Путешествие: ${title}` +
    (countries.length ? `. Страны: ${countries.join(', ')}` : '') +
    (displayYear ? `. Год: ${displayYear}` : '') +
    (views > 0 ? `. Просмотров: ${viewsFormatted}` : '')

  const hasAuthorMeta = !hideAuthor && authorDisplayName !== ''
  const hasRating = travel.rating != null && travel.rating > 0
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
        'data-card-action': 'true',
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

  const adminIconSize = isMobile ? 13 : 14

  const leftTopSlot = canEdit ? (
    <View
      style={[
        styles.adminActionsContainer,
        isMobile && styles.adminActionsContainerMobile,
      ]}
      testID="admin-actions"
    >
      <CardActionPressable
        accessibilityLabel="Редактировать"
        title="Редактировать"
        onPress={handleEdit}
        style={[styles.adminBtn, isMobile && styles.adminBtnMobile]}
        disabled={isDeleting}
        accessibilityState={{ disabled: isDeleting }}
      >
        <Feather name="edit-2" size={adminIconSize} color={colors.text} />
      </CardActionPressable>
      {typeof onDeletePress === 'function' ? (
        <>
          <View style={[styles.adminDivider, isMobile && styles.adminDividerMobile]} />
          <CardActionPressable
            accessibilityLabel={isDeleting ? 'Маршрут удаляется' : 'Удалить'}
            title={isDeleting ? 'Удаляется…' : 'Удалить'}
            onPress={handleDelete}
            style={[styles.adminBtn, isMobile && styles.adminBtnMobile]}
            testID="delete-button"
            disabled={isDeleting}
            accessibilityState={{ disabled: isDeleting, busy: isDeleting }}
          >
            {isDeleting ? (
              <ActivityIndicator size="small" color={colors.danger} />
            ) : (
              <Feather name="trash-2" size={adminIconSize} color={colors.danger} />
            )}
          </CardActionPressable>
        </>
      ) : null}
    </View>
  ) : null

  // On narrow cards the meta row only has room for the country and compact badges.
  // Author is lower-priority in grid cards, while views always live on the media
  // overlay so text groups never collide in the card footer.
  const compactMeta =
    isMobile ||
    (IS_WEB && typeof cardWidth === 'number' && cardWidth < 420)

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
  if (!compactMeta && hasAuthorMeta) {
    if (countries.length > 0) {
      topRowItems.push(<View key="author-dot" style={styles.metaDot} />)
    }
    topRowItems.push(
      IS_WEB ? (
        <View
          key="author"
          onClick={handleAuthorPress as any}
          style={{
            flexShrink: 1,
            minWidth: 0,
            // 44px touch target: расширяем зону нажатия, не меняя визуальный layout
            paddingVertical: 13,
            marginVertical: -13,
            paddingHorizontal: 8,
            marginHorizontal: -8,
          }}
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
          hitSlop={{ top: 13, bottom: 13, left: 8, right: 8 }}
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
  // Views are shown directly on the media for both web and native cards.
  const showViewsOverlay = views > 0 && !selectable
  const viewsOverlaySlot = showViewsOverlay ? (
    <View style={styles.viewsOverlayBadge} testID="views-overlay" pointerEvents="none">
      <Feather name="eye" size={VIEW_ICON_SIZE + 2} color="#fff" />
      <Text style={styles.viewsOverlayText} numberOfLines={1}>
        {viewsFormatted}
      </Text>
    </View>
  ) : null

  // On compact/mobile cards the meta-row author is hidden, so surface the author
  // as a media overlay in the bottom-left corner — paired with the views badge —
  // without growing the card. Desktop keeps the tappable author link in the row.
  const showAuthorOverlay = compactMeta && hasAuthorMeta && !selectable
  const authorOverlaySlot = showAuthorOverlay ? (
    <View style={styles.authorOverlayBadge} testID="author-overlay" pointerEvents="none">
      <Feather name="user" size={VIEW_ICON_SIZE + 2} color="#fff" />
      <Text style={styles.authorOverlayText} numberOfLines={1}>
        {authorDisplayName}
      </Text>
    </View>
  ) : null

  const hasSecondaryMeta =
    topRowItems.length > 0 ||
    hasEngagementStats ||
    hasRating ||
    displayYear != null

  const secondaryMetaSlot = hasSecondaryMeta ? (
    <View style={styles.metaRow}>
      <View style={styles.inlineMetaGroup}>{topRowItems}</View>
      <View style={styles.metaBadgesRow}>
        {displayYear != null && (
          <View style={styles.metaYear} testID="year-meta">
            <Feather name="calendar" size={VIEW_ICON_SIZE} color={colors.textMuted} />
            <Text style={styles.metaYearText}>{displayYear}</Text>
          </View>
        )}
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
      </View>
    </View>
  ) : null

  const contentSlot = (
    <View style={styles.contentStack}>
      <Text style={styles.titleInline} numberOfLines={2} ellipsizeMode="tail">
        {title}
      </Text>
      {secondaryMetaSlot}
    </View>
  )

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
      heroTitleOverlay={false}
      testID={cardTestId}
      style={cardStyle}
      imageHeight={typeof imageHeight === 'number' ? imageHeight : TRAVEL_CARD_IMAGE_HEIGHT}
      contentPosition="belowMedia"
      contentContainerStyle={styles.cardContentContainer}
      insetMedia={false}
      leftTopSlot={leftTopSlot}
      rightTopSlot={!selectable ? rightTopSlot : null}
      bottomLeftSlot={authorOverlaySlot}
      bottomRightSlot={viewsOverlaySlot}
      containerOverlaySlot={selectableOverlay}
      contentSlot={contentSlot}
      webHoverScale={!isMobile && IS_WEB}
      webAsView={IS_WEB}
      webPressableProps={IS_WEB && selectable ? selectableWebHandlers : undefined}
      webTouchAction={webTouchAction ?? (selectable ? 'manipulation' : undefined)}
      nativePressScaleEnabled={Platform.OS !== 'android'}
      mediaProps={{
        placeholderBlurhash: PLACEHOLDER_BLURHASH,
        placeholderSrc:
          coverMediaLqip ??
          (thumbSmallUrl && !isLikelyWatermarked(thumbSmallUrl) ? thumbSmallUrl : null),
        blurBackground: true,
        allowCriticalWebBlur: IS_WEB,
        revealOnLoadOnly: isMobileSafariFirstCard,
        recyclingKey: travelKey,
        priority: IS_WEB ? (isFirst ? 'high' : 'low') : 'normal',
        // Eager on web so FlashList's mounted-ahead cells (~700px before the
        // viewport) start fetching before they scroll in — otherwise lazy <img>
        // defers until visible and the card shows the blurred placeholder first,
        // then snaps to the sharp photo (the "фон, потом картинка" flash on scroll).
        // priority stays 'low' for non-first cards, so fetchPriority is 'auto' and
        // these don't compete with the LCP image; the Safari decode-gated reveal
        // is unaffected (it never keyed off loading).
        loading: IS_WEB ? 'eager' : 'lazy',
        prefetch: IS_WEB ? isFirst : false,
        transition: Platform.OS === 'android' ? 0 : undefined,
        imageProps: ANDROID_LIST_IMAGE_PROPS,
        showLoadingIndicator: Platform.OS !== 'android',
        webResponsiveSource: coverMediaResponsiveSource,
      }}
      {...nativeCardProps}
    />
  )

  const wrappedCard =
    IS_WEB && !selectable ? (
      <a
        href={isNavigable ? navigationUrl : undefined}
        style={visualVariant === 'home-featured' ? ANCHOR_FILL_STYLE : (EMPTY_STYLE as any)}
        data-testid="travel-card-link"
        role={isNavigable ? undefined : 'group'}
        tabIndex={isNavigable ? undefined : -1}
        aria-disabled={!isNavigable}
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
    prev.gridColumns === next.gridColumns &&
    prev.webTouchAction === next.webTouchAction &&
    prev.isDeleting === next.isDeleting
  )
}

export default memo(TravelListItem, areEqual)
