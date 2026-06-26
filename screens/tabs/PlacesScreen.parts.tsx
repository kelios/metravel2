import React from 'react'
import {
  ActivityIndicator,
  type StyleProp,
  Text,
  View,
  type ViewStyle,
  useWindowDimensions,
} from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import {
  buildAppleMapsUrl,
  buildGoogleMapsUrl,
  buildOpenStreetMapUrl,
  buildOrganicMapsUrl,
  buildWazeUrl,
  buildYandexMapsUrl,
  buildYandexNaviUrl,
} from '@/components/MapPage/Map/mapLinks'
import PlaceListCard from '@/components/places/PlaceListCard'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { type ThemedColors } from '@/hooks/useTheme'
import { openExternalUrlInNewTab } from '@/utils/externalLinks'
import { type CatalogPlace } from '@/utils/placesCatalog'
import { normalizeRelatedTravelRoute } from '@/utils/relatedTravel'

import { type PlacesStyles } from './PlacesScreen.styles'

export const PlaceCard = React.memo(function PlaceCard({
  place,
  styles,
  colors: _colors,
  onOpenMap,
  onOpenTravel,
  containerStyle,
  priority: _priority = false,
}: {
  place: CatalogPlace
  styles: PlacesStyles
  colors: ThemedColors
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

  return (
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
      imageHeight={isMobileCard ? 260 : 400}
      width={compactCardWidth}
      compact={isMobileCard}
      titleLayout="content"
      titleNumberOfLines={2}
      showAddButton={false}
      style={[styles.card, containerStyle]}
      testID={`places-card-${place.id}`}
    />
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
