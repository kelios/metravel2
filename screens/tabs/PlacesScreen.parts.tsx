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
import { translate as i18nT } from '@/i18n'


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
        label: i18nT('map:screens.tabs.PlacesScreen_parts.google_1ed2bb53'),
        icon: 'map-pin' as const,
        onPress: () => openUrl(buildGoogleMapsUrl(coord)),
        accessibilityLabel: i18nT('map:screens.tabs.PlacesScreen_parts.otkryt_tochku_v_google_maps_e92ad312'),
        title: i18nT('map:screens.tabs.PlacesScreen_parts.google_maps_21ccdb93'),
      },
      {
        key: 'apple',
        label: i18nT('map:screens.tabs.PlacesScreen_parts.apple_11b09cc1'),
        icon: 'map' as const,
        onPress: () => openUrl(buildAppleMapsUrl(coord)),
        accessibilityLabel: i18nT('map:screens.tabs.PlacesScreen_parts.otkryt_tochku_v_apple_maps_4f8a4d4c'),
        title: i18nT('map:screens.tabs.PlacesScreen_parts.apple_maps_f07affbe'),
      },
      {
        key: 'organic',
        label: i18nT('map:screens.tabs.PlacesScreen_parts.organic_17020c34'),
        icon: 'compass' as const,
        onPress: () => openUrl(buildOrganicMapsUrl(coord, place.title)),
        accessibilityLabel: i18nT('map:screens.tabs.PlacesScreen_parts.otkryt_tochku_v_organic_maps_58bf3ebf'),
        title: i18nT('map:screens.tabs.PlacesScreen_parts.organic_maps_e6811b80'),
      },
      {
        key: 'waze',
        label: i18nT('map:screens.tabs.PlacesScreen_parts.waze_70400860'),
        icon: 'navigation' as const,
        onPress: () => openUrl(buildWazeUrl(coord)),
        accessibilityLabel: i18nT('map:screens.tabs.PlacesScreen_parts.otkryt_tochku_v_waze_f566b9af'),
        title: i18nT('map:screens.tabs.PlacesScreen_parts.waze_70400860'),
      },
      {
        key: 'yandex-maps',
        label: i18nT('map:screens.tabs.PlacesScreen_parts.yandeks_karty_7cc978d3'),
        icon: 'map' as const,
        onPress: () => openUrl(buildYandexMapsUrl(coord)),
        accessibilityLabel: i18nT('map:screens.tabs.PlacesScreen_parts.otkryt_tochku_v_yandeks_kartah_dc0d96b1'),
        title: i18nT('map:screens.tabs.PlacesScreen_parts.yandeks_karty_7cc978d3'),
      },
      {
        key: 'yandex',
        label: i18nT('map:screens.tabs.PlacesScreen_parts.yandeks_navi_3ac1bd0a'),
        icon: 'navigation-2' as const,
        onPress: () => openUrl(buildYandexNaviUrl(coord)),
        accessibilityLabel: i18nT('map:screens.tabs.PlacesScreen_parts.otkryt_tochku_v_yandeks_navigatore_43357804'),
        title: i18nT('map:screens.tabs.PlacesScreen_parts.yandeks_navigator_8d74e5ee'),
      },
      {
        key: 'osm',
        label: i18nT('map:screens.tabs.PlacesScreen_parts.osm_ed588289'),
        icon: 'map' as const,
        onPress: () => openUrl(buildOpenStreetMapUrl(coord)),
        accessibilityLabel: i18nT('map:screens.tabs.PlacesScreen_parts.otkryt_tochku_v_openstreetmap_2749d390'),
        title: i18nT('map:screens.tabs.PlacesScreen_parts.openstreetmap_b86b5aff'),
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
      void showToast({ type: 'success', text1: i18nT('map:screens.tabs.PlacesScreen_parts.koordinaty_skopirovany_c418ae29'), position: 'bottom' })
    } catch {
      void showToast({ type: 'error', text1: i18nT('map:screens.tabs.PlacesScreen_parts.ne_udalos_skopirovat_koordinaty_3d38f60d'), position: 'bottom' })
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
      void showToast({ type: 'info', text1: i18nT('map:screens.tabs.PlacesScreen_parts.voydite_chtoby_sohranit_tochku_cbf7d9b3'), position: 'bottom' })
      return
    }
    if (isAdding || !normalizedCoord) return

    // #334 toggle parity: a second tap on an already-saved point removes it.
    if (isSaved) {
      setIsAdding(true)
      try {
        await removeSaved()
        void showToast({ type: 'success', text1: i18nT('map:screens.tabs.PlacesScreen_parts.tochka_ubrana_iz_moih_tochek_87df65a9'), position: 'bottom' })
      } catch {
        void showToast({ type: 'error', text1: i18nT('map:screens.tabs.PlacesScreen_parts.ne_udalos_ubrat_tochku_542a3a58'), position: 'bottom' })
      } finally {
        setIsAdding(false)
      }
      return
    }

    const categoryName = place.category || undefined
    const payload: Record<string, unknown> = {
      name: place.address || place.title || i18nT('map:screens.tabs.PlacesScreen_parts.tochka_a9619593'),
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
      void showToast({ type: 'success', text1: i18nT('map:screens.tabs.PlacesScreen_parts.tochka_dobavlena_v_moi_tochki_c854cbfa'), position: 'bottom' })
    } catch {
      void showToast({ type: 'error', text1: i18nT('map:screens.tabs.PlacesScreen_parts.ne_udalos_sohranit_tochku_be4fcb92'), position: 'bottom' })
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
          [
            ...(normalizedCoord
              ? [
                  {
                    key: 'open-map',
                    label: i18nT('map:screens.tabs.PlacesScreen_parts.na_karte_d98b1d80'),
                    icon: 'map-pin' as const,
                    onPress: () => onOpenMap(place),
                    accessibilityLabel: i18nT('map:screens.tabs.PlacesScreen_parts.otkryt_mesto_na_karte_abcb0a9d'),
                    title: i18nT('map:screens.tabs.PlacesScreen_parts.otkryt_na_karte_6b6df4a9'),
                  },
                ]
              : []),
            ...(place.urlTravel
              ? [
                  {
                    key: 'article',
                    label: i18nT('map:screens.tabs.PlacesScreen_parts.statya_28264f10'),
                    icon: 'book-open' as const,
                    onPress: () => onOpenTravel(place),
                    title: i18nT('map:screens.tabs.PlacesScreen_parts.otkryt_statyu_6f4d1411'),
                  },
                ]
              : []),
          ]
        }
        onCopyCoord={normalizedCoord ? handleCopyCoord : undefined}
        onShare={normalizedCoord ? handleShare : undefined}
        onAddPoint={normalizedCoord ? handleAddPoint : undefined}
        addLabel={isSaved ? i18nT('map:screens.tabs.PlacesScreen_parts.v_tochkah_53f65e25') : i18nT('map:screens.tabs.PlacesScreen_parts.moi_tochki_df71d705')}
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
