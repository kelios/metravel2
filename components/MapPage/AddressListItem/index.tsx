import React, { useCallback, useMemo } from 'react'

import { getDistanceInfo } from '@/utils/distanceCalculator'
import {
  useAddressListItemActions,
  buildMapUrl,
  openExternal,
} from '@/hooks/useAddressListItemActions'
import {
  buildOrganicMapsUrl,
  buildWazeUrl,
  buildYandexNaviUrl,
} from '@/components/MapPage/Map/mapLinks'

import { buildPlaceTitleParts } from '@/components/MapPage/Map/placeTitle'

import AddressListItemCard from './AddressListItemCard'
import { isWebPlatform, type Props } from './constants'
import {
  addVersion,
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
  // Web keeps the capped/centered card width; native stretches full width (no
  // explicit width → fills the sheet minus the PLACE_CARD_STYLE margin) with a
  // taller hero so the photo stays the dominant block.
  const webCardWidth = useMemo(() => getWebCardWidth(width), [width])
  const cardWidth = isWebPlatform() ? webCardWidth : undefined
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
        label: 'Google Maps',
        icon: 'map-pin' as const,
        onPress: () => openExternal(buildMapUrl(coord)),
        title: 'Открыть в Google Maps',
      },
      {
        key: 'organic',
        label: 'Organic Maps',
        icon: 'compass' as const,
        onPress: () => openExternal(buildOrganicMapsUrl(coord)),
        title: 'Открыть в Organic Maps',
      },
      {
        key: 'waze',
        label: 'Waze',
        icon: 'navigation' as const,
        onPress: () => openExternal(buildWazeUrl(coord)),
        title: 'Проложить маршрут в Waze',
      },
      {
        key: 'yandex',
        label: 'Яндекс.Навигатор',
        icon: 'navigation-2' as const,
        onPress: () => openExternal(buildYandexNaviUrl(coord)),
        title: 'Проложить маршрут в Яндекс.Навигаторе',
      },
    ]
  }, [coord])

  const isNativeMobile = !isWebPlatform() && isMobile
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
      webMapActions={webMapActions}
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
