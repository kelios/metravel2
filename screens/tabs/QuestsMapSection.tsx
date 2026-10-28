import React, { useMemo } from 'react'
import { ActivityIndicator, Platform, Pressable, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import Feather from '@expo/vector-icons/Feather'
import { useRouter } from 'expo-router'

import Map from '@/components/MapPage/Map'
import type { MapMovePayload, MapProps } from '@/components/MapPage/Map/types'
import type { ThemedColors } from '@/hooks/useTheme'
import { translate as i18nT } from '@/i18n'
import { buildCanonicalUrl } from '@/utils/seo'

import {
  NEARBY_ID,
  getAverageQuestMapPointCenter,
  resolveQuestMapCenter,
  type MapPoint,
  type QuestCatalogCity,
  type QuestMapArea,
} from './QuestsScreen.helpers'
import { getQuestsMapStyles } from './QuestsMapSection.styles'
import type { QuestMeta } from './questsShared'

type QuestsMapSectionProps = {
  loadingStyle: StyleProp<ViewStyle>
  colors: ThemedColors
  screenWidth: number
  screenHeight?: number
  dataLoaded: boolean
  quests: QuestMeta[]
  cities: QuestCatalogCity[]
  selectedCityId: string | null
  searchTerm: string
  /** Срез без своего города (дети, вело, тема, страна, личные): центр по его квестам. */
  centerOnQuests: boolean
  userLoc: { lat: number; lng: number } | null
  activeMapAreaCenter: QuestMapArea | null
  showMapAreaSearch: boolean
  onSearchMapArea: () => void
  onUserLocationChange: (loc: { latitude: number; longitude: number } | null) => void
  onMapMove: (center: MapMovePayload) => void
}

/**
 * Режим карты каталога (#2389): точки, центр и сама карта нужны только после
 * переключения на карту, поэтому живут отдельным чанком, а не в `/quests`.
 */
export default function QuestsMapSection({
  loadingStyle,
  colors,
  screenWidth,
  screenHeight,
  dataLoaded,
  quests,
  cities,
  selectedCityId,
  searchTerm,
  centerOnQuests,
  userLoc,
  activeMapAreaCenter,
  showMapAreaSearch,
  onSearchMapArea,
  onUserLocationChange,
  onMapMove,
}: QuestsMapSectionProps) {
  const router = useRouter()
  const styles = useMemo(
    () => getQuestsMapStyles(colors, screenWidth, screenHeight),
    [colors, screenWidth, screenHeight],
  )

  const mapPoints = useMemo<MapPoint[]>(() => {
    if (!dataLoaded) return []
    if (!searchTerm && !selectedCityId) return []

    return quests
      .filter((q) => Number.isFinite(q.lat) && Number.isFinite(q.lng) && !!q.id)
      .map((q) => {
        const citySegmentRaw = q.cityId || selectedCityId || ''
        const citySegment = encodeURIComponent(String(citySegmentRaw || 'city'))
        const questSegment = encodeURIComponent(String(q.id))
        const questUrl = buildCanonicalUrl(`/quests/${citySegment}/${questSegment}`)

        const coverUri = typeof q.cover === 'string' ? q.cover : ''
        return {
          id: q.id,
          coord: `${q.lat},${q.lng}`,
          address: q.title,
          travelImageThumbUrl: coverUri,
          categoryName: i18nT('quests:screens.tabs.QuestsScreen.kvest_1033726e'),
          articleUrl: questUrl,
          urlTravel: questUrl,
          questMeta: {
            id: q.id,
            title: q.title,
            cityId: q.cityId ?? String(citySegmentRaw || ''),
            cityName: q.cityName,
            countryName: q.countryName,
            points: q.points,
            durationMin: q.durationMin,
            difficulty: q.difficulty,
            tags: q.tags,
            petFriendly: q.petFriendly,
            cover: coverUri || undefined,
          },
        }
      })
  }, [dataLoaded, selectedCityId, quests, searchTerm])

  const mapCenter = useMemo(() => {
    const virtualFilterCenter = centerOnQuests ? getAverageQuestMapPointCenter(mapPoints) : null
    const selectedCity = virtualFilterCenter
      ? { lat: virtualFilterCenter.latitude, lng: virtualFilterCenter.longitude }
      : cities.find((c) => c.id === selectedCityId)
    return resolveQuestMapCenter({
      searchTerm,
      mapPoints,
      activeMapAreaCenter,
      userLoc,
      selectedCity,
    })
  }, [cities, mapPoints, searchTerm, selectedCityId, centerOnQuests, userLoc, activeMapAreaCenter])

  const openQuestFromPoint = (point?: { questMeta?: MapPoint['questMeta'] }) => {
    const meta = point?.questMeta
    if (!meta?.cityId || !meta?.id) return
    router.push(`/quests/${meta.cityId}/${meta.id}`)
  }

  const mapProps: MapProps = {
    travel: { data: mapPoints as unknown as NonNullable<MapProps['travel']>['data'] },
    coordinates: mapCenter,
    userLocation: userLoc ? { latitude: userLoc.lat, longitude: userLoc.lng } : null,
    pointsOnly: true,
    mode: 'radius',
    showRadiusCircle: false,
    routePoints: [],
    transportMode: 'foot',
    onMapClick: () => {},
    setRouteDistance: () => {},
    setFullRouteCoords: () => {},
    onUserLocationChange,
    onMapMove,
  }

  const mapLoading = (
    <View style={loadingStyle}>
      <ActivityIndicator color={colors.primary} />
    </View>
  )

  return (
    <>
      {dataLoaded && selectedCityId === NEARBY_ID && !userLoc && !activeMapAreaCenter && (
        <View style={styles.geoBanner} testID="quests-geo-banner">
          <Feather name="map-pin" size={13} color={colors.warning} />
          <Text style={styles.geoBannerText}>
            {i18nT('quests:screens.tabs.QuestsContentPanel.geolokatsiya_otklyuchena_pokazyvaem_vse_kves_48d7a8ae')}
          </Text>
        </View>
      )}

      {/* Карта-исследование: держим карту живой всегда после загрузки.
          Ноль квестов = нет маркеров, но карта видна и интерактивна —
          пользователь двигает область и повторяет «Искать в этой области». */}
      {dataLoaded ? (
        <View style={styles.mapContainer}>
          {showMapAreaSearch && (
            <Pressable
              style={styles.mapSearchAreaBtn}
              onPress={onSearchMapArea}
              accessibilityRole="button"
              accessibilityLabel={i18nT('quests:screens.tabs.QuestsContentPanel.iskat_v_etoy_oblasti_2dbf958f')}
              testID="quests-map-search-area"
            >
              <Feather name="search" size={15} color={colors.textOnPrimary} />
              <Text style={styles.mapSearchAreaBtnText}>
                {i18nT('quests:screens.tabs.QuestsContentPanel.iskat_v_etoy_oblasti_2dbf958f')}
              </Text>
            </Pressable>
          )}
          {/* `Map` resolves to Map.web on web; this section is itself the lazy
              boundary (#2389), so a second React.lazy here would only add a suspend. */}
          {Platform.OS === 'web' ? (
            <Map {...mapProps} />
          ) : (
            <Map {...mapProps} onMarkerSelect={openQuestFromPoint} />
          )}
        </View>
      ) : (
        mapLoading
      )}
    </>
  )
}
