import React, { useMemo, useRef } from 'react'
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native'

import { getMapPointKey } from '@/hooks/map/useMapTravels'
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme'
import { getDistanceInfo } from '@/utils/distanceCalculator'
import { parseCoordinateString } from '@/utils/coordinates'
import MapIcon from './MapIcon'
import PlaceListCard from '@/components/places/PlaceListCard'

const IS_WEB = Platform.OS === 'web'
const DEFAULT_MAX_ITEMS = 3
const DISTANCE_TIE_THRESHOLD_KM = 1

const TRANSPORT_LABEL: Record<'car' | 'bike' | 'foot', string> = {
  car: 'Авто',
  bike: 'Велосипед',
  foot: 'Пешком',
}

interface Props {
  places: any[]
  userLocation: { latitude: number; longitude: number } | null
  transportMode?: 'car' | 'bike' | 'foot'
  onPlaceSelect: (place: any) => void
  maxItems?: number
  radiusKm?: number
  isLoading?: boolean
}

const SkeletonCard: React.FC<{ styles: ReturnType<typeof getStyles> }> = ({ styles }) => (
  <View style={styles.skeletonCard}>
    <View style={styles.skeletonImage} />
    <View style={styles.skeletonBody}>
      <View style={styles.skeletonChip} />
      <View style={styles.skeletonLineWide} />
      <View style={styles.skeletonLineMid} />
      <View style={styles.skeletonRow}>
        <View style={styles.skeletonBadgeSm} />
        <View style={styles.skeletonBadgeLg} />
      </View>
    </View>
  </View>
)

export const QuickRecommendations: React.FC<Props> = React.memo(
  ({
    places,
    userLocation,
    transportMode = 'car',
    onPlaceSelect,
    maxItems = DEFAULT_MAX_ITEMS,
    radiusKm,
    isLoading = false,
  }) => {
    const colors = useThemedColors()
    const styles = useMemo(() => getStyles(colors), [colors])
    const scrollRef = useRef<ScrollView | null>(null)

    const topPlaces = useMemo(() => {
      if (!userLocation || !places.length) return []

      const withDistance = places
        .map((place) => {
          const coords = parseCoordinateString(place.coord ?? '')
          if (!coords) return null
          const distanceInfo = getDistanceInfo(
            { lat: userLocation.latitude, lng: userLocation.longitude },
            coords,
            transportMode,
          )
          if (!distanceInfo) return null
          return {
            ...place,
            distance: distanceInfo.distance,
            distanceText: distanceInfo.distanceText,
            travelTimeText: distanceInfo.travelTimeText,
            rating: place.rating ?? 0,
          }
        })
        .filter((item): item is NonNullable<typeof item> => {
          if (item === null) return false
          if (radiusKm != null && item.distance > radiusKm) return false
          return true
        })

      return withDistance
        .sort((a, b) => {
          const distDiff = a.distance - b.distance
          if (Math.abs(distDiff) > DISTANCE_TIE_THRESHOLD_KM) return distDiff
          return b.rating - a.rating
        })
        .slice(0, maxItems)
    }, [places, userLocation, transportMode, maxItems, radiusKm])

    if (isLoading) {
      return (
        <View style={styles.container}>
          <View style={styles.header}>
            <MapIcon name="star" size={20} color={colors.primary} />
            <Text style={styles.title}>Популярное рядом</Text>
          </View>
          <View style={styles.webCards}>
            <SkeletonCard styles={styles} />
            <SkeletonCard styles={styles} />
          </View>
        </View>
      )
    }

    if (!topPlaces.length) return null

    const cards = topPlaces.map((place, index) => {
      const thumbUrl = place.travelImageThumbUrl || place.travel_image_thumb_url || null
      const categoryName =
        typeof place.categoryName === 'string' ? place.categoryName.split(',')[0].trim() : ''
      const badges = [
        place.distanceText,
        `${TRANSPORT_LABEL[transportMode]} ${place.travelTimeText}`,
      ]
      return (
        <PlaceListCard
          key={getMapPointKey(place, index)}
          title={place.address || 'Место'}
          imageUrl={thumbUrl}
          categoryLabel={categoryName || undefined}
          relatedTravelUrl={place.urlTravel}
          relatedTravelCountry={typeof place.countryName === 'string' ? place.countryName : undefined}
          relatedTravelCity={typeof place.cityName === 'string' ? place.cityName : undefined}
          badges={badges}
          onCardPress={() => onPlaceSelect(place)}
          imageHeight={IS_WEB ? 156 : 148}
          titleLayout="content"
          titleNumberOfLines={3}
          style={[styles.card, IS_WEB && styles.cardWeb]}
        />
      )
    })

    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <MapIcon name="star" size={20} color={colors.primary} />
          <Text style={styles.title}>Популярное рядом</Text>
        </View>
        {IS_WEB ? (
          <View style={styles.webCards}>{cards}</View>
        ) : (
          <ScrollView
            ref={scrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            nestedScrollEnabled
            scrollEnabled
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
          >
            {cards}
          </ScrollView>
        )}
      </View>
    )
  },
)

const getStyles = (colors: ThemedColors) =>
  StyleSheet.create({
    container: { marginVertical: 12, marginHorizontal: 8 },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 12,
      paddingHorizontal: 8,
    },
    title: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
      letterSpacing: -0.3,
    },
    webCards: { paddingHorizontal: 8, gap: 12 },
    scrollContent: { paddingHorizontal: 8, gap: 12 },
    scroll: {
      ...Platform.select({
        web: {
          overflowX: 'auto',
          overflowY: 'hidden',
          WebkitOverflowScrolling: 'touch',
          overscrollBehaviorX: 'contain',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          touchAction: 'pan-x pan-y',
        } as any,
      }),
    },
    card: {
      width: 220,
      backgroundColor: colors.surface,
      borderRadius: 16,
      overflow: 'hidden',
      ...colors.shadows.medium,
      borderWidth: 1,
      borderColor: colors.border,
    },
    cardWeb: { width: '100%' },
    skeletonCard: {
      width: '100%',
      backgroundColor: colors.surface,
      borderRadius: 16,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.border,
    },
    skeletonImage: {
      width: '100%',
      height: 156,
      backgroundColor: colors.backgroundSecondary,
    },
    skeletonBody: { padding: 14, gap: 10 },
    skeletonChip: {
      width: '36%',
      height: 24,
      backgroundColor: colors.backgroundSecondary,
      borderRadius: 999,
    },
    skeletonLineWide: {
      width: '82%',
      height: 18,
      backgroundColor: colors.backgroundSecondary,
      borderRadius: 6,
    },
    skeletonLineMid: {
      width: '62%',
      height: 18,
      backgroundColor: colors.backgroundSecondary,
      borderRadius: 6,
    },
    skeletonRow: { flexDirection: 'row', gap: 8 },
    skeletonBadgeSm: {
      width: 60,
      height: 24,
      backgroundColor: colors.backgroundSecondary,
      borderRadius: 8,
    },
    skeletonBadgeLg: {
      width: 104,
      height: 24,
      backgroundColor: colors.backgroundSecondary,
      borderRadius: 8,
    },
  })
