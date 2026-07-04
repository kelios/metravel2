import React, { useCallback, useMemo } from 'react'

import { getDistanceInfo } from '@/utils/distanceCalculator'
import {
  useAddressListItemActions,
  buildMapUrl,
  openExternal,
} from '@/hooks/useAddressListItemActions'
import {
  buildAppleMapsUrl,
  buildOpenStreetMapUrl,
  buildOrganicMapsUrl,
  buildWazeUrl,
  buildYandexMapsUrl,
  buildYandexNaviUrl,
} from '@/components/MapPage/Map/mapLinks'
import { NAVIGATION_ACTION_LABELS } from '@/components/navigation/navigationActionMeta'

import { buildPlaceTitleParts } from '@/components/MapPage/Map/placeTitle'

import AddressListItemCard from './AddressListItemCard'
import { isWebPlatform, type Props } from './constants'
import {
  addVersion,
  getNativeCardWidth,
  getNativeCardImageHeight,
  getWebCardWidth,
  parseCoord,
} from './utils'

export type { Props }

const AddressListItem: React.FC<Props> = ({
  travel,
  onPress,
  isMobile = false,
  userLocation,
  transportMode = 'car',
  isFavorite = false,
  onToggleFavorite,
  onBuildRoute,
  screenWidth,
}) => {
  const { address, coord, travelImageThumbUrl, articleUrl, urlTravel } = travel

  // Reverse-geocoded points arrive with a raw address as their label. Derive a
  // clean title (POI name / first meaningful segment) + secondary address line,
  // reusing the same logic the marker popup uses so the two paths never diverge.
  const placeTitle = useMemo(
    () => buildPlaceTitleParts({ name: (travel as Record<string, unknown>).name, address }),
    [travel, address],
  )

  const width = screenWidth

  const {
    categories,
    isAddingPoint,
    pointAdded,
    isAuthenticated,
    authReady,
    openTelegram,
    openArticle,
    handleAddPoint,
  } = useAddressListItemActions(travel)

  // #584 — both platforms now render the same photo-dominant PlaceListCard.
  // Web keeps the capped/centered card width; native uses an explicit sheet
  // width minus the PLACE_CARD_STYLE margins so recycled rows cannot shrink to
  // an image's intrinsic width.
  const webCardWidth = useMemo(() => getWebCardWidth(width), [width])
  const nativeCardWidth = useMemo(() => getNativeCardWidth(width), [width])
  const cardWidth = isWebPlatform() ? webCardWidth : nativeCardWidth
  const cardImageHeight = useMemo(
    () =>
      isWebPlatform()
        ? Math.round(Math.max(128, Math.min(188, webCardWidth * 0.48)))
        : getNativeCardImageHeight(width),
    [webCardWidth, width],
  )

  const handleMainPress = useCallback(() => {
    if (onPress) onPress()
    else openArticle()
  }, [onPress, openArticle])

  const travelUpdatedAt = (travel as Record<string, unknown>).updated_at as
    | string
    | undefined
  const imgUri = useMemo(() => {
    if (!travelImageThumbUrl) return null
    return addVersion(travelImageThumbUrl, travelUpdatedAt)
  }, [travelImageThumbUrl, travelUpdatedAt])

  const distanceInfo = useMemo(() => {
    const parsed = parseCoord(coord)
    if (!parsed || !userLocation) return null
    return getDistanceInfo(
      { lat: userLocation.latitude, lng: userLocation.longitude },
      { lat: parsed.lat, lng: parsed.lon },
      transportMode,
    )
  }, [coord, userLocation, transportMode])

  const webMapActions = useMemo(() => {
    if (!coord || !isWebPlatform()) return []
    return [
      {
        key: 'google',
        label: NAVIGATION_ACTION_LABELS.google,
        icon: 'map-pin' as const,
        onPress: () => openExternal(buildMapUrl(coord)),
        title: 'Открыть в Google Maps',
      },
      {
        key: 'apple',
        label: NAVIGATION_ACTION_LABELS.apple,
        icon: 'map' as const,
        onPress: () => openExternal(buildAppleMapsUrl(coord)),
        title: 'Открыть в Apple Maps',
      },
      {
        key: 'organic',
        label: NAVIGATION_ACTION_LABELS.organic,
        icon: 'compass' as const,
        onPress: () => openExternal(buildOrganicMapsUrl(coord)),
        title: 'Открыть в Organic Maps',
      },
      {
        key: 'waze',
        label: NAVIGATION_ACTION_LABELS.waze,
        icon: 'navigation' as const,
        onPress: () => openExternal(buildWazeUrl(coord)),
        title: 'Проложить маршрут в Waze',
      },
      {
        key: 'yandex-maps',
        label: NAVIGATION_ACTION_LABELS['yandex-maps'],
        icon: 'map' as const,
        onPress: () => openExternal(buildYandexMapsUrl(coord)),
        title: 'Открыть в Яндекс Картах',
      },
      {
        key: 'yandex',
        label: NAVIGATION_ACTION_LABELS.yandex,
        icon: 'navigation-2' as const,
        onPress: () => openExternal(buildYandexNaviUrl(coord)),
        title: 'Проложить маршрут в Яндекс.Навигаторе',
      },
      {
        key: 'osm',
        label: NAVIGATION_ACTION_LABELS.osm,
        icon: 'map' as const,
        onPress: () => openExternal(buildOpenStreetMapUrl(coord)),
        title: 'Открыть в OpenStreetMap',
      },
    ]
  }, [coord])

  const isNativeMobile = !isWebPlatform() && isMobile

  // Native nav-apps set, identical to the map popup + travel-points «Навигация и
  // действия» sheet (Google / Apple / Organic / Waze / Яндекс Карты / Яндекс Нави
  // / OSM). On native `webMapActions` is empty by design, so without this the
  // popup-aligned card had no «Навигация» tile. PlaceListCard folds these
  // `mapActions` into the shared ActionListSheet on the compact/popup-aligned card.
  const nativeMapActions = useMemo(() => {
    if (!coord || isWebPlatform()) return []
    return [
      {
        key: 'google',
        label: NAVIGATION_ACTION_LABELS.google,
        icon: 'map-pin' as const,
        onPress: () => openExternal(buildMapUrl(coord)),
        title: 'Открыть в Google Maps',
      },
      {
        key: 'apple',
        label: NAVIGATION_ACTION_LABELS.apple,
        icon: 'map' as const,
        onPress: () => openExternal(buildAppleMapsUrl(coord)),
        title: 'Открыть в Apple Maps',
      },
      {
        key: 'organic',
        label: NAVIGATION_ACTION_LABELS.organic,
        icon: 'compass' as const,
        onPress: () => openExternal(buildOrganicMapsUrl(coord)),
        title: 'Открыть в Organic Maps',
      },
      {
        key: 'waze',
        label: NAVIGATION_ACTION_LABELS.waze,
        icon: 'navigation' as const,
        onPress: () => openExternal(buildWazeUrl(coord)),
        title: 'Проложить маршрут в Waze',
      },
      {
        key: 'yandex-maps',
        label: NAVIGATION_ACTION_LABELS['yandex-maps'],
        icon: 'map' as const,
        onPress: () => openExternal(buildYandexMapsUrl(coord)),
        title: 'Открыть в Яндекс Картах',
      },
      {
        key: 'yandex',
        label: NAVIGATION_ACTION_LABELS.yandex,
        icon: 'navigation-2' as const,
        onPress: () => openExternal(buildYandexNaviUrl(coord)),
        title: 'Проложить маршрут в Яндекс Навигаторе',
      },
      {
        key: 'osm',
        label: NAVIGATION_ACTION_LABELS.osm,
        icon: 'map' as const,
        onPress: () => openExternal(buildOpenStreetMapUrl(coord)),
        title: 'Открыть в OpenStreetMap',
      },
    ]
  }, [coord])

  const routeAction = useMemo(
    () =>
      isNativeMobile && onBuildRoute
        ? {
            key: 'route',
            label: 'Маршрут',
            icon: 'navigation' as const,
            onPress: onBuildRoute,
            accessibilityLabel: 'Построить маршрут сюда',
            title: 'Построить маршрут сюда',
          }
        : null,
    [isNativeMobile, onBuildRoute],
  )

  const inlineActions = useMemo(
    () => [
      ...(articleUrl || urlTravel
        ? [
            {
              key: 'article',
              label: 'Открыть',
              icon: 'book-open' as const,
              onPress: openArticle,
              accessibilityLabel: 'Открыть страницу',
              title: 'Открыть страницу',
            },
          ]
        : []),
    ],
    [articleUrl, openArticle, urlTravel],
  )

  return (
    <AddressListItemCard
      travel={travel}
      address={address}
      title={placeTitle.title}
      subtitle={placeTitle.subtitle}
      coord={coord}
      imgUri={imgUri}
      categories={categories}
      urlTravel={urlTravel}
      articleUrl={articleUrl}
      isFavorite={isFavorite}
      onToggleFavorite={onToggleFavorite}
      quickActions={routeAction ? [routeAction] : []}
      onPress={onPress}
      transportMode={transportMode}
      distanceInfo={distanceInfo}
      webMapActions={isWebPlatform() ? webMapActions : nativeMapActions}
      inlineActions={inlineActions}
      handleMainPress={handleMainPress}
      openArticle={openArticle}
      openTelegram={openTelegram}
      handleAddPoint={handleAddPoint}
      authReady={authReady}
      isAuthenticated={isAuthenticated}
      isAddingPoint={isAddingPoint}
      pointAdded={pointAdded}
      cardImageHeight={cardImageHeight}
      cardWidth={cardWidth}
    />
  )
}

export default React.memo(AddressListItem)
