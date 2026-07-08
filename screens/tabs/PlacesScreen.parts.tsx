import React from 'react'
import {
  ActivityIndicator,
  Pressable,
  type StyleProp,
  Text,
  View,
  type ViewStyle,
  useWindowDimensions,
} from 'react-native'
import Feather from '@expo/vector-icons/Feather'
import * as Clipboard from 'expo-clipboard'

import {
  buildAppleMapsUrl,
  buildGoogleMapsUrl,
  buildOpenStreetMapUrl,
  buildOrganicMapsUrl,
  buildTelegramShareUrl,
  buildWazeUrl,
  buildYandexMapsUrl,
  buildYandexNaviUrl,
} from '@/components/MapPage/Map/mapLinks'
import PlaceListCard from '@/components/places/PlaceListCard'
import { DESIGN_COLORS, DESIGN_TOKENS } from '@/constants/designSystem'
import { useSavedPointToggle } from '@/hooks/map/useSavedPointToggle'
import { type ThemedColors } from '@/hooks/useTheme'
import { useAuthStore } from '@/stores/authStore'
import { PointStatus } from '@/types/userPoints'
import { openExternalUrlInNewTab } from '@/utils/externalLinks'
import { type CatalogPlace } from '@/utils/placesCatalog'
import { normalizeRelatedTravelRoute } from '@/utils/relatedTravel'
import { showToast } from '@/utils/toast'

import { type PlacesStyles } from './PlacesScreen.styles'
import { PRESSED_OPACITY } from './PlacesScreen.helpers'

export const PlaceCard = React.memo(function PlaceCard({
  place,
  styles,
  onOpenMap,
  onOpenTravel,
  containerStyle,
  priority = false,
}: {
  place: CatalogPlace
  styles: PlacesStyles
  onOpenMap: (place: CatalogPlace) => void
  onOpenTravel: (place: CatalogPlace) => void
  containerStyle?: StyleProp<ViewStyle>
  // Above-the-fold cards (first viewport row(s)) decode eagerly with high
  // priority so the first screen shows sharp photos instead of blur on load.
  priority?: boolean
}) {
  const { width: viewportWidth } = useWindowDimensions()
  const isMobileCard = viewportWidth < 760
  const compactCardWidth =
    isMobileCard
      ? Math.max(0, viewportWidth - DESIGN_TOKENS.spacing.lg * 2)
      : undefined
  const imageUrl = place.travelImageLandscapeUrl || place.imageUrl || place.travelImageThumbUrl || null
  const relatedTravelUrl = normalizeRelatedTravelRoute(place.urlTravel)
  const addressBadge = place.address && place.address !== place.country ? place.address : null
  const mapActions = React.useMemo(() => {
    const coord = String(place.coord ?? '').trim()
    if (!coord) return []
    const openUrl = (url: string) => {
      if (!url) return
      void openExternalUrlInNewTab(url)
    }
    return [
      {
        key: 'google',
        label: 'Google',
        icon: 'map-pin' as const,
        onPress: () => openUrl(buildGoogleMapsUrl(coord)),
        accessibilityLabel: 'Открыть точку в Google Maps',
        title: 'Google Maps',
      },
      {
        key: 'apple',
        label: 'Apple',
        icon: 'map' as const,
        onPress: () => openUrl(buildAppleMapsUrl(coord)),
        accessibilityLabel: 'Открыть точку в Apple Maps',
        title: 'Apple Maps',
      },
      {
        key: 'organic',
        label: 'Organic',
        icon: 'compass' as const,
        onPress: () => openUrl(buildOrganicMapsUrl(coord, place.title)),
        accessibilityLabel: 'Открыть точку в Organic Maps',
        title: 'Organic Maps',
      },
      {
        key: 'waze',
        label: 'Waze',
        icon: 'navigation' as const,
        onPress: () => openUrl(buildWazeUrl(coord)),
        accessibilityLabel: 'Открыть точку в Waze',
        title: 'Waze',
      },
      {
        key: 'yandex-maps',
        label: 'Яндекс Карты',
        icon: 'map' as const,
        onPress: () => openUrl(buildYandexMapsUrl(coord)),
        accessibilityLabel: 'Открыть точку в Яндекс Картах',
        title: 'Яндекс Карты',
      },
      {
        key: 'yandex',
        label: 'Яндекс Нави',
        icon: 'navigation-2' as const,
        onPress: () => openUrl(buildYandexNaviUrl(coord)),
        accessibilityLabel: 'Открыть точку в Яндекс Навигаторе',
        title: 'Яндекс Навигатор',
      },
      {
        key: 'osm',
        label: 'OSM',
        icon: 'map' as const,
        onPress: () => openUrl(buildOpenStreetMapUrl(coord)),
        accessibilityLabel: 'Открыть точку в OpenStreetMap',
        title: 'OpenStreetMap',
      },
    ]
  }, [place.coord, place.title])

  // ─── Popup-parity actions (mirror the map PlacePopupCard) ───
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const authReady = useAuthStore((s) => s.authReady)

  const normalizedCoord = React.useMemo(() => {
    const parts = String(place.coord ?? '')
      .replace(/;/g, ',')
      .split(',')
      .map((v) => v.trim())
    if (parts.length < 2) return null
    const lat = Number(parts[0])
    const lng = Number(parts[1])
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
    return { lat, lng }
  }, [place.coord])

  const { isSaved, removeSaved, createPoint } = useSavedPointToggle({
    coord: normalizedCoord,
    enabled: isAuthenticated,
  })
  const [isAdding, setIsAdding] = React.useState(false)

  const handleCopyCoord = React.useCallback(async () => {
    const coord = String(place.coord ?? '').trim()
    if (!coord) return
    try {
      await Clipboard.setStringAsync(coord)
      void showToast({ type: 'success', text1: 'Координаты скопированы', position: 'bottom' })
    } catch {
      void showToast({ type: 'error', text1: 'Не удалось скопировать координаты', position: 'bottom' })
    }
  }, [place.coord])

  const handleShare = React.useCallback(() => {
    const coord = String(place.coord ?? '').trim()
    if (!coord) return
    const url = buildTelegramShareUrl(coord)
    if (!url) return
    void openExternalUrlInNewTab(url)
  }, [place.coord])

  const handleAddPoint = React.useCallback(async () => {
    if (!authReady) return
    if (!isAuthenticated) {
      void showToast({ type: 'info', text1: 'Войдите, чтобы сохранить точку', position: 'bottom' })
      return
    }
    if (isAdding || !normalizedCoord) return

    // #334 toggle parity: a second tap on an already-saved point removes it.
    if (isSaved) {
      setIsAdding(true)
      try {
        await removeSaved()
        void showToast({ type: 'success', text1: 'Точка убрана из моих точек', position: 'bottom' })
      } catch {
        void showToast({ type: 'error', text1: 'Не удалось убрать точку', position: 'bottom' })
      } finally {
        setIsAdding(false)
      }
      return
    }

    const categoryName = place.category || undefined
    const payload: Record<string, unknown> = {
      name: place.address || place.title || 'Точка',
      address: place.address,
      latitude: normalizedCoord.lat,
      longitude: normalizedCoord.lng,
      color: DESIGN_COLORS.travelPoint,
      status: PointStatus.PLANNING,
      category: categoryName,
      categoryName,
    }
    const photo = place.travelImageThumbUrl || imageUrl
    if (photo) payload.photo = photo

    setIsAdding(true)
    try {
      await createPoint(payload)
      void showToast({ type: 'success', text1: 'Точка добавлена в мои точки', position: 'bottom' })
    } catch {
      void showToast({ type: 'error', text1: 'Не удалось сохранить точку', position: 'bottom' })
    } finally {
      setIsAdding(false)
    }
  }, [
    authReady,
    isAuthenticated,
    isAdding,
    isSaved,
    normalizedCoord,
    removeSaved,
    createPoint,
    place.address,
    place.title,
    place.category,
    place.travelImageThumbUrl,
    imageUrl,
  ])

  // The grid sizing (flexBasis/min/maxWidth) MUST live on this outer wrapper —
  // it is the direct flex child of `cardsGrid`. UnifiedTravelCard always renders
  // its own `CardWrapper` View around the styled container, so passing the grid
  // style down to the card would land it one level too deep and collapse every
  // card to a full-width single column. The card fills this wrapper instead.
  return (
    <View style={[styles.card, containerStyle]}>
      <PlaceListCard
        title={place.title}
        imageUrl={imageUrl}
        categoryLabel={place.category}
        coord={place.coord}
        badges={[
          ...(addressBadge ? [addressBadge] : []),
          ...(place.country ? [place.country] : []),
        ]}
        relatedTravelUrl={relatedTravelUrl}
        relatedTravelCountry={place.country}
        onCardPress={() => onOpenMap(place)}
        onMediaPress={() => onOpenMap(place)}
        mapActions={mapActions}
        inlineActions={
          place.urlTravel
            ? [
                {
                  key: 'article',
                  label: 'Статья',
                  icon: 'book-open',
                  onPress: () => onOpenTravel(place),
                  title: 'Открыть статью',
                },
              ]
            : []
        }
        onCopyCoord={normalizedCoord ? handleCopyCoord : undefined}
        onShare={normalizedCoord ? handleShare : undefined}
        onAddPoint={normalizedCoord ? handleAddPoint : undefined}
        addLabel={isSaved ? 'В точках' : 'Мои точки'}
        addDisabled={!authReady || !normalizedCoord || isAdding}
        isAdding={isAdding}
        imageHeight={isMobileCard ? 240 : 280}
        eagerImage={priority}
        width={compactCardWidth}
        compact
        popupAligned
        titleLayout="content"
        titleNumberOfLines={2}
        style={styles.cardFill}
        testID={`places-card-${place.id}`}
      />
    </View>
  )
})

export function SkeletonGrid({
  styles,
  isCompact,
  isWide,
}: {
  styles: PlacesStyles
  isCompact: boolean
  isWide: boolean
}) {
  const count = isCompact ? 4 : isWide ? 6 : 4
  return (
    <View style={styles.cardsGrid}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={[styles.card, styles.cardInner, styles.skeletonCard]}>
          <View style={styles.skeletonImage} />
          <View style={styles.skeletonBody}>
            <View style={[styles.skeletonLine, { width: '45%', height: 20 }]} />
            <View style={[styles.skeletonLine, { width: '70%', height: 14 }]} />
            <View style={[styles.skeletonLine, { width: '55%', height: 14 }]} />
            <View style={[styles.skeletonLine, { width: '100%', height: 1 }]} />
            <View style={styles.skeletonActions}>
              <View style={[styles.skeletonLine, { flex: 1, height: 36, borderRadius: DESIGN_TOKENS.radii.sm }]} />
              <View style={[styles.skeletonLine, { flex: 1, height: 36, borderRadius: DESIGN_TOKENS.radii.sm }]} />
            </View>
          </View>
        </View>
      ))}
    </View>
  )
}

export function StateBlock({
  styles,
  colors,
  icon,
  title,
  description,
  actionLabel,
  onAction,
  pending = false,
  pendingLabel,
}: {
  styles: PlacesStyles
  colors: ThemedColors
  icon: React.ComponentProps<typeof Feather>['name']
  title: string
  description: string
  actionLabel: string
  onAction: () => void
  pending?: boolean
  pendingLabel?: string
}) {
  return (
    <View style={styles.stateBlock}>
      <View style={styles.stateIconWrap}>
        <Feather name={icon} size={28} color={colors.textMuted} />
      </View>
      <Text style={styles.stateTitle}>{title}</Text>
      <Text style={styles.stateText}>{description}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: pending, busy: pending }}
        disabled={pending}
        onPress={onAction}
        style={({ pressed }) => [
          styles.stateAction,
          pending && styles.stateActionPending,
          pressed && !pending && PRESSED_OPACITY,
        ]}
      >
        {pending ? (
          <View style={styles.stateActionPendingRow}>
            <ActivityIndicator size="small" color={colors.textOnPrimary} />
            <Text style={styles.stateActionText}>{pendingLabel ?? actionLabel}</Text>
          </View>
        ) : (
          <Text style={styles.stateActionText}>{actionLabel}</Text>
        )}
      </Pressable>
    </View>
  )
}
