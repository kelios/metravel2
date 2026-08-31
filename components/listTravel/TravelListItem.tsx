import React, { memo, useCallback, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, Platform, Pressable, Text, View, type ViewStyle } from 'react-native'
import Feather from '@expo/vector-icons/Feather'
import { router } from 'expo-router'

import type { Travel } from '@/types/types'
import FavoriteButton from '@/components/travel/FavoriteButton'
import TravelStatusButton from '@/components/travel/TravelStatusButton'
import { resolveTravelUrl } from '@/utils/subscriptionsHelpers'
import { routes } from '@/utils/routes'
import UnifiedTravelCard from '@/components/ui/UnifiedTravelCard'
import {
  CARD_TOP_SLOT_INSET,
  CARD_TOP_SLOT_Z_INDEX,
  CARD_HOVER_LIFT_SCALE,
  CARD_HOVER_LIFT_Y,
} from '@/components/ui/unifiedTravelCardTokens'
import CardActionPressable from '@/components/ui/CardActionPressable'
import { useThemedColors } from '@/hooks/useTheme'
import { globalFocusStyles } from '@/styles/globalFocus'
import { formatViewCount } from '@/components/travel/utils/travelHelpers'
import { hasAnyTravelEngagementStats } from '@/utils/travelEngagementStats'
import { appendReturnToParam } from '@/utils/navigationReturnPath'
import { isTravelDraft } from '@/utils/travelPublicationStatus'
import {
  buildResponsiveImagePropsFromMedia,
  getMediaPlaceholderData,
  resolveMediaAspectRatio,
} from '@/utils/travelMediaVariants'

import { getResponsiveCardValues } from './enhancedCardResponsiveValues'
import { TRAVEL_CARD_IMAGE_HEIGHT } from './utils/listTravelConstants'
import TravelListItemCountriesList from './TravelListItemCountriesList'
import TravelListItemEngagementMetrics from './TravelListItemEngagementMetrics'
import TravelListItemSelectableOverlay from './TravelListItemSelectableOverlay'
import { createTravelListItemStyles } from './travelListItemStyles'
import {
  buildCoverWidths,
  isLikelyWatermarked,
  normalizeOwnerIds,
  CARD_MEDIA_SLOT_RATIO,
  resolveCoverSlotGeometry,
  resolveDisplayTravelYear,
  resolveTravelAuthorDisplayName,
  resolveTravelAuthorName,
} from './travelListItemHelpers'
import { useTravelListItemNavigation } from './useTravelListItemNavigation'
import { translate as i18nT } from '@/i18n'
import { formatRatingValue } from '@/utils/ratingHelpers'


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

/**
 * Явное качество обложки карточки (#1285).
 *
 * URL готовых `srcset*` манифеста идут w-only, поэтому прокси применял к ним свой
 * дефолт q80. Замер прода 2026-08-06 на обложках главной: `?w=320` 29 590 B против
 * `?w=320&q=70` 23 308 B (−21 %), `?w=640` 95 130 B против 73 350 B (−23 %).
 */
const COVER_QUALITY = 70

const POINTER_EVENTS_BOX_NONE = { pointerEvents: 'box-none' } as any
/**
 * Верхние слоты карточки, поднятые из якоря наружу (#1626). Отступ берётся из
 * общего токена карточки, иначе скопированное число разъехалось бы при первой
 * правке `UnifiedTravelCard`.
 *
 * Отсчёт при этом идёт от РАЗНЫХ боксов: карточка ставит свои слоты внутри
 * медиа-бокса, а поднятые обёртки — от `styles.wrap`, то есть от border-box
 * карточки. Разница — рамка карточки (1 px), поэтому пиксель-в-пиксель совпасть
 * они не обязаны; сдвинуть слоты на другой край карточки правка токена всё
 * равно не даст.
 */
/**
 * Подъём под курсором принадлежит обёртке, а не карточке: поднятые из якоря
 * кнопки карточке больше не потомки, transform её контейнера на них не
 * действует — карточка уезжала бы вверх, оставляя кнопки на месте (замерено:
 * контейнер 340 → 329 px, кнопка 362 → 362). Обёртка содержит и якорь, и
 * кнопки, поэтому переход указателя с карточки на кнопку подъём не срывает.
 *
 * Псевдокласс `:hover` не годится: в обычном объекте стиля react-native-web его
 * молча выбрасывает, а из `StyleSheet.create` правило до узла не доходило —
 * класс `r-:hover-…` в разметке появлялся, `transform` оставался `none`.
 */
const WRAP_HOVER_LIFT_STYLE: ViewStyle = {
  transform: [{ translateY: CARD_HOVER_LIFT_Y }, { scale: CARD_HOVER_LIFT_SCALE }],
}

const HOISTED_SLOT_BASE: ViewStyle = {
  position: 'absolute',
  top: CARD_TOP_SLOT_INSET,
  zIndex: CARD_TOP_SLOT_Z_INDEX,
}
const HOISTED_RIGHT_SLOT_STYLE: ViewStyle = { ...HOISTED_SLOT_BASE, right: CARD_TOP_SLOT_INSET }
const HOISTED_LEFT_SLOT_STYLE: ViewStyle = { ...HOISTED_SLOT_BASE, left: CARD_TOP_SLOT_INSET }

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
  /**
   * Web cover loading policy. The `eager` default assumes a VIRTUALIZED list
   * (FlashList mounts only the visible window), so a screen that lays cards out
   * with a plain `map()` must pass `lazy` — otherwise the browser starts every
   * cover at once, including rows several screens below the fold. See #1285.
   * The catalog list passes a per-index policy instead (initial first row
   * `eager`; everything else — including first-row remounts after the user has
   * scrolled — `lazy`), so fast flings don't start cover requests that the
   * recycler's next `src` swap immediately cancels. See #1400.
   */
  mediaLoading?: 'lazy' | 'eager'
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
  mediaLoading = 'eager',
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

  const title = name?.trim() || i18nT('travel:common.untitled')
  const views = Number(countUnicIpView) || 0
  const viewsFormatted = formatViewCount(views)
  const travelKey = slug?.trim() || String(id)
  const isDraft = isTravelDraft(travel)
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
      isDraft
        ? `/travel/${id}`
        :
      resolveTravelUrl({
        id: Number(id) || 0,
        slug,
        url: typeof (travel as any)?.url === 'string' ? (travel as any).url : undefined,
      } as any),
    [id, isDraft, slug, travel],
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
  const coverPlaceholder = useMemo(
    () => getMediaPlaceholderData(coverMedia),
    [coverMedia],
  )
  const coverAspectRatio = useMemo(
    () => resolveMediaAspectRatio(coverMedia),
    [coverMedia],
  )
  const baseCoverSlotHeight =
    typeof imageHeight === 'number' ? imageHeight : TRAVEL_CARD_IMAGE_HEIGHT

  // #1487 (пересмотр 2026-08-24): медиа-слот карточки ЕДИНЫЙ квадратный —
  // владелец требует ровную сетку одинаковых карточек, поэтому слот не следует
  // пропорциям конкретной обложки (первый заход так делал и ломал выравнивание
  // рядов каталога). Квадрат — мода прод-обложек (80% — 1:1): на них поле 0%,
  // остаток летербоксится заливкой `dominant_color` (см. CARD_MEDIA_SLOT_RATIO).
  // `imageHeight === 0` по-прежнему прячет медиа-бокс целиком.
  const coverSlotRatio = baseCoverSlotHeight === 0 ? null : CARD_MEDIA_SLOT_RATIO

  // Оценка ширины карточки, когда сетка не сообщила её явно. Она обязана быть
  // оценкой СВЕРХУ: занижение делает ландшафтную обложку мылом (см.
  // `resolveCoverSlotGeometry`).
  //
  // #1487: прежняя константа 480 для `home-featured` перестала быть оценкой
  // сверху. Она держалась на том, что квадратную обложку в ландшафтном боксе
  // ограничивала ВЫСОТА (замер прода: рисовалось 316 px), — адаптивный слот это
  // ограничение снял, и крупная карточка редакционной сетки рисуется на все
  // 643 px, то есть 480 стало занижением и мылом при DPR 1. Общая ветка даёт
  // потолок 720 на desktop (редакционный контейнер упирается в ~1170 px, значит
  // крупная карточка 7/12 ≈ 643) и ширину вьюпорта на мобильном bento.
  const coverSlotWidth =
    typeof cardWidth === 'number'
      ? cardWidth
      : Math.min(effectiveWidth, isMobile ? 640 : 720)

  // Высота слота — производная от его пропорций, а не входной константы: именно
  // её видит `resolveCoverSlotGeometry`, иначе ступень srcSet считалась бы по
  // прежнему ландшафтному боксу и квадратная обложка получила бы мыло.
  const coverSlotHeight =
    coverSlotRatio != null && coverSlotWidth > 0
      ? coverSlotWidth / coverSlotRatio
      : baseCoverSlotHeight

  const coverMediaResponsiveSource = useMemo(() => {
    if (!IS_WEB || !coverMedia) return null
    const slotWidth = coverSlotWidth

    // #1285: слот кадрируется `contain`, поэтому ширину отрисовки задаёт не бокс,
    // а высота бокса на пропорциях кадра. Ступень выбирает браузер по `sizes` ×
    // собственный DPR; лестнице достаточно покрыть потолок DPR 2. Прежний пол
    // (640, а для первой карточки 720) держал в наборе кандидатов, которые слоту
    // не нужны ни на одном DPR.
    const { renderedWidth, maxCoverWidth } = resolveCoverSlotGeometry({
      slotWidth,
      slotHeight: coverSlotHeight,
      aspectRatio: coverAspectRatio,
    })

    return buildResponsiveImagePropsFromMedia(coverMedia, {
      // `maxWidth` задаёт только `src` — фолбэк для случая, когда `srcSet` не
      // применился. Считать его от потолка DPR 2 значит класть туда 960w на слот
      // 408 px: кандидат в лестнице есть, но как запасной вариант он вчетверо
      // тяжелее нужного. Берём ступень слота при DPR 1 — она всегда входит в
      // `widths`, поэтому фолбэк не может увести на неанонсированный файл (#1213).
      maxWidth: renderedWidth ?? maxCoverWidth,
      // Хвост 720/960 оставался в лестнице независимо от `maxWidth`, поэтому на
      // DPR 2 браузер тянул в бокс ~390 px кандидата 960w — 2.95 МБ обложек на
      // страницу выдачи. Столько байт на низкоприоритетных картинках душат
      // fetch следующей страницы, и «Загружаем ещё» висит секундами.
      widths: buildCoverWidths(maxCoverWidth),
      // Пропорции неизвестны — считать ширину отрисовки нечем, поэтому остаётся
      // ровно прежняя подсказка.
      sizes:
        renderedWidth != null
          ? `${renderedWidth}px`
          : typeof cardWidth === 'number'
            ? `${Math.round(cardWidth)}px`
            : isMobile
              ? '100vw'
              : '(min-width: 1024px) 320px, (min-width: 768px) 33vw, 50vw',
      quality: COVER_QUALITY,
    })
  }, [
    cardWidth,
    coverAspectRatio,
    coverMedia,
    coverSlotHeight,
    coverSlotWidth,
    isMobile,
  ])

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
    i18nT('travel:components.listTravel.TravelListItem.a11yTitle', { value1: title }) +
    (isDraft ? i18nT('travel:components.listTravel.TravelListItem.status_chernovik_a0df151f') : '') +
    (countries.length ? i18nT('travel:components.listTravel.TravelListItem.strany_value1_755975ff', { value1: countries.join(', ') }) : '') +
    (displayYear ? i18nT('travel:components.listTravel.TravelListItem.god_value1_e70dda0d', { value1: displayYear }) : '') +
    (views > 0 ? i18nT('travel:components.listTravel.TravelListItem.prosmotrov_value1_aadc926b', { value1: viewsFormatted }) : '')

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
          ? i18nT('travel:components.listTravel.TravelListItem.dvoynoe_nazhatie_dlya_vybora_9401c531')
          : i18nT('travel:components.listTravel.TravelListItem.dvoynoe_nazhatie_dlya_prosmotra_detaley_480a446a'),
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

  // Карточка на web целиком завёрнута в настоящий `<a>`. Кнопки действий и
  // админ-кнопки поэтому поднимаются из карточки наружу — интерактивный контент
  // внутри ссылки невалиден по HTML и ломает Tab-порядок (#1626). В selectable-
  // режиме и на нативе якоря нет, слоты остаются на своём месте в карточке.
  const hoistsActionsOutOfAnchor = IS_WEB && !selectable
  const wrapOwnsHover = hoistsActionsOutOfAnchor && !isMobile
  const [wrapHovered, setWrapHovered] = useState(false)

  const rightTopSlot = (
    <View
      style={[styles.favoriteButtonContainer, POINTER_EVENTS_BOX_NONE, { flexDirection: 'column', gap: 6 }]}
      {...(IS_WEB && {
        // Именно `dataSet`, а не сырой `data-card-action`: react-native-web
        // переносит в DOM только его, а сырой атрибут на `View` до разметки не
        // доходит вовсе — маркер, который читает `closest('[data-card-action]')`,
        // молча отсутствовал.
        dataSet: { cardAction: 'true' },
        onClick: stopEvent,
        onMouseDown: (e: any) => e.stopPropagation(),
      })}
    >
      <FavoriteButton
        variant="overlay"
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
        accessibilityLabel={i18nT('travel:components.listTravel.TravelListItem.redaktirovat_2e33442a')}
        title={i18nT('travel:components.listTravel.TravelListItem.redaktirovat_2e33442a')}
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
            accessibilityLabel={isDeleting ? i18nT('travel:components.listTravel.TravelListItem.marshrut_udalyaetsya_0d0bf1c2') : i18nT('travel:components.listTravel.TravelListItem.udalit_aa22ae90')}
            title={isDeleting ? i18nT('travel:components.listTravel.TravelListItem.udalyaetsya_6e5041bf') : i18nT('travel:components.listTravel.TravelListItem.udalit_aa22ae90')}
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
                'aria-label': i18nT('travel:components.listTravel.TravelListItem.otkryt_profil_avtora_value1_8eda31f4', { value1: authorDisplayName }),
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
          accessibilityLabel={i18nT('travel:components.listTravel.TravelListItem.avtor_value1_1e39f2a9', { value1: authorDisplayName })}
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
      <Feather name="eye" size={VIEW_ICON_SIZE + 2} color={colors.textOnDark} />
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
      <Feather name="user" size={VIEW_ICON_SIZE + 2} color={colors.textOnDark} />
      <Text style={styles.authorOverlayText} numberOfLines={1}>
        {authorDisplayName}
      </Text>
    </View>
  ) : null

  const hasSecondaryMeta =
    topRowItems.length > 0 ||
    isDraft ||
    hasEngagementStats ||
    hasRating ||
    displayYear != null

  const secondaryMetaSlot = hasSecondaryMeta ? (
    <View style={styles.metaRow}>
      <View style={styles.inlineMetaGroup}>{topRowItems}</View>
      <View style={styles.metaBadgesRow}>
        {isDraft && (
          <View style={styles.draftStatusBadge} testID="draft-status-badge">
            <Feather name="edit-3" size={VIEW_ICON_SIZE} color={colors.warningDark} />
            <Text style={styles.draftStatusText}>{i18nT('travel:components.listTravel.TravelListItem.chernovik_c4f08662')}</Text>
          </View>
        )}
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
            <Text style={styles.metaRatingValue}>{formatRatingValue(travel.rating!)}</Text>
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
      imageHeight={baseCoverSlotHeight}
      mediaAspectRatio={coverSlotRatio ?? undefined}
      mediaSlotWidth={coverSlotWidth}
      contentPosition="belowMedia"
      contentContainerStyle={styles.cardContentContainer}
      insetMedia={false}
      leftTopSlot={hoistsActionsOutOfAnchor ? null : leftTopSlot}
      rightTopSlot={hoistsActionsOutOfAnchor || selectable ? null : rightTopSlot}
      bottomLeftSlot={authorOverlaySlot}
      bottomRightSlot={viewsOverlaySlot}
      containerOverlaySlot={selectableOverlay}
      contentSlot={contentSlot}
      webHoverScale={!wrapOwnsHover && !isMobile && IS_WEB}
      webAsView={IS_WEB}
      webNavigationOwner={IS_WEB && !selectable ? 'external' : undefined}
      webPressableProps={IS_WEB && selectable ? selectableWebHandlers : undefined}
      webTouchAction={webTouchAction ?? (selectable ? 'manipulation' : undefined)}
      nativePressScaleEnabled={Platform.OS !== 'android'}
      mediaProps={{
        placeholderBlurhash:
          coverPlaceholder.blurhash ??
          (coverPlaceholder.dominantColor ? undefined : PLACEHOLDER_BLURHASH),
        placeholderColor: coverPlaceholder.dominantColor,
        // Backend data placeholders add no request. Old payloads keep the shared
        // local fallback instead of reviving a second per-card LQIP URL (#1111).
        blurBackground: true,
        allowCriticalWebBlur: IS_WEB,
        // Keep the stable media box visible until the sharp candidate has decoded.
        // This removes the blur -> progressive image flash during fast scrolling
        // and also forces the web backdrop onto the shared <img srcSet> path.
        revealOnLoadOnly: IS_WEB,
        // A web FlashList slot keeps one <img> mounted and rewrites its source.
        // Once a recycled lazy cover enters the browser's native-lazy band,
        // retain it until completion so a 50 ms source swap cannot abort it (#1400).
        retainWebRequestOnRecycle: IS_WEB && mediaLoading === 'lazy',
        recyclingKey: travelKey,
        priority: IS_WEB ? (isFirst ? 'high' : 'low') : 'normal',
        // FlashList mounts only the visible rows plus a short draw-distance, so
        // there `eager` stays bounded to that window and starts the request early
        // enough to finish decoding before the user reaches the row. A plain
        // non-virtualized `map()` layout has no such ceiling — that screen must
        // pass `mediaLoading="lazy"` instead. See #1285.
        loading: IS_WEB ? mediaLoading : 'lazy',
        prefetch: false,
        transition: Platform.OS === 'android' ? 0 : undefined,
        imageProps: ANDROID_LIST_IMAGE_PROPS,
        showLoadingIndicator: Platform.OS !== 'android',
        webResponsiveSource: coverMediaResponsiveSource,
      }}
      {...nativeCardProps}
    />
  )

  const wrappedCard =
    hoistsActionsOutOfAnchor ? (
      <a
        href={isNavigable ? navigationUrl : undefined}
        style={visualVariant === 'home-featured' ? ANCHOR_FILL_STYLE : (EMPTY_STYLE as any)}
        data-testid="travel-card-link"
        role={isNavigable ? undefined : 'group'}
        tabIndex={isNavigable ? undefined : -1}
        aria-label={a11yLabel}
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
        wrapOwnsHover && wrapHovered && WRAP_HOVER_LIFT_STYLE,
      ]}
      {...(wrapOwnsHover && {
        onMouseEnter: () => setWrapHovered(true),
        onMouseLeave: () => setWrapHovered(false),
      })}
    >
      {wrappedCard}
      {/*
        Кнопки карточки живут СНАРУЖИ якоря, а не внутри него (#1626): внутри
        `<a>` они давали три остановки Tab на карточку вместо одной и невалидную
        по HTML вложенность интерактивного контента в ссылку. Обёртка не ловит
        указатель (`box-none`), поэтому клик мимо кнопок по-прежнему достаётся
        ссылке под ней.

        Плата за подъём: обёртки — соседи якоря, а не потомки контейнера
        карточки, поэтому web-hover карточки (`UnifiedTravelCard`,
        `containerHovered`: `translateY(-6px) scale(1.02)`) на них НЕ
        распространяется, и наведение на саму кнопку снимает hover с карточки
        (`mouseleave`, кнопка ей не потомок). Убрать это можно только сменой
        владельца hover в самой карточке — см. #1626 → follow-up.
      */}
      {hoistsActionsOutOfAnchor && leftTopSlot ? (
        <View style={HOISTED_LEFT_SLOT_STYLE} pointerEvents="box-none">
          {leftTopSlot}
        </View>
      ) : null}
      {hoistsActionsOutOfAnchor && rightTopSlot ? (
        <View style={HOISTED_RIGHT_SLOT_STYLE} pointerEvents="box-none">
          {rightTopSlot}
        </View>
      ) : null}
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
    prev.mediaLoading === next.mediaLoading &&
    prev.webTouchAction === next.webTouchAction &&
    prev.isDeleting === next.isDeleting
  )
}

export default memo(TravelListItem, areEqual)
