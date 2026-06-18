import React, { useCallback, useEffect, useMemo, useState } from 'react'

import { METRICS } from '@/constants/layout'
import { useThemedColors } from '@/hooks/useTheme'
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

import AddressListItemNative from './AddressListItemNative'
import AddressListItemWeb from './AddressListItemWeb'
import { isWebPlatform, type Props } from './constants'
import { getStyles } from './styles'
import { addVersion, getCardHeight, getWebCardWidth, parseCoord } from './utils'

export type { Props }

const AddressListItem: React.FC<Props> = ({
  travel,
  isMobile: isMobileProp,
  onPress,
  onHidePress,
  userLocation,
  transportMode = 'car',
  isFavorite = false,
  onToggleFavorite,
  screenWidth,
}) => {
  const { address, coord, travelImageThumbUrl, articleUrl, urlTravel } = travel

  const [imgLoaded, setImgLoaded] = useState(false)
  const [hovered, setHovered] = useState(false)
  const colors = useThemedColors()
  const styles = useMemo(() => getStyles(colors), [colors])

  const width = screenWidth
  const isPhone = width >= METRICS.breakpoints.phone && width < METRICS.breakpoints.largePhone
  const isLargePhone =
    width >= METRICS.breakpoints.largePhone && width < METRICS.breakpoints.tablet
  const isMobile = isMobileProp ?? (isPhone || isLargePhone)
  const isSmallScreen = isPhone
  const isTablet = width > 480 && width <= METRICS.breakpoints.largeTablet

  const {
    categories,
    isAddingPoint,
    pointAdded,
    isAuthenticated,
    authReady,
    copyCoords,
    openTelegram,
    openMap,
    openArticle,
    handleAddPoint,
  } = useAddressListItemActions(travel)

  const webCardWidth = useMemo(() => getWebCardWidth(width), [width])
  const webCardImageHeight = useMemo(
    () => Math.round(Math.max(128, Math.min(188, webCardWidth * 0.48))),
    [webCardWidth],
  )

  const showOverlays = isMobile || hovered
  const showActionIcons = !isMobile && showOverlays
  const iconSize = isSmallScreen ? 20 : 22
  const iconButtonSize = isSmallScreen ? 40 : 48
  const titleFontSize = isSmallScreen ? 16 : isTablet ? 17 : 18
  const coordFontSize = isSmallScreen ? 12 : 13
  const height = getCardHeight(width)

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

  useEffect(() => {
    setImgLoaded(!imgUri)
  }, [imgUri])

  useEffect(() => () => setHovered(false), [])

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
    if (!coord) return []
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

  if (isWebPlatform()) {
    return (
      <AddressListItemWeb
        travel={travel}
        address={address}
        coord={coord}
        imgUri={imgUri}
        categories={categories}
        urlTravel={urlTravel}
        articleUrl={articleUrl}
        isFavorite={isFavorite}
        onToggleFavorite={onToggleFavorite}
        onPress={onPress}
        transportMode={transportMode}
        distanceInfo={distanceInfo}
        webMapActions={webMapActions}
        handleMainPress={handleMainPress}
        openArticle={openArticle}
        openTelegram={openTelegram}
        handleAddPoint={handleAddPoint}
        authReady={authReady}
        isAuthenticated={isAuthenticated}
        isAddingPoint={isAddingPoint}
        pointAdded={pointAdded}
        webCardImageHeight={webCardImageHeight}
        webCardWidth={webCardWidth}
      />
    )
  }

  return (
    <AddressListItemNative
      address={address}
      coord={coord}
      imgUri={imgUri}
      categories={categories}
      colors={colors}
      styles={styles}
      isMobile={isMobile}
      isFavorite={isFavorite}
      onToggleFavorite={onToggleFavorite}
      onHidePress={onHidePress}
      imgLoaded={imgLoaded}
      setImgLoaded={setImgLoaded}
      hovered={hovered}
      setHovered={setHovered}
      height={height}
      iconSize={iconSize}
      iconButtonSize={iconButtonSize}
      titleFontSize={titleFontSize}
      coordFontSize={coordFontSize}
      showOverlays={showOverlays}
      showActionIcons={showActionIcons}
      distanceInfo={distanceInfo}
      handleMainPress={handleMainPress}
      openArticle={openArticle}
      openMap={openMap}
      openTelegram={openTelegram}
      copyCoords={copyCoords}
      handleAddPoint={handleAddPoint}
      authReady={authReady}
      isAuthenticated={isAuthenticated}
      isAddingPoint={isAddingPoint}
      pointAdded={pointAdded}
    />
  )
}

export default React.memo(AddressListItem)
