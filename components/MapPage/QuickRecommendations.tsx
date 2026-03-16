/**
 * QuickRecommendations - быстрые рекомендации популярных мест рядом
 */

import React, { useMemo, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Platform } from 'react-native';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';
import { getDistanceInfo } from '@/utils/distanceCalculator';
import { parseCoordinateString } from '@/utils/coordinates';
import MapIcon from './MapIcon';
import PlaceListCard from '@/components/places/PlaceListCard';


interface Props {
  places: any[];
  userLocation: { latitude: number; longitude: number } | null;
  transportMode?: 'car' | 'bike' | 'foot';
  onPlaceSelect: (place: any) => void;
  maxItems?: number;
  radiusKm?: number;
  isLoading?: boolean;
}

const SkeletonCard: React.FC<{ colors: ThemedColors }> = ({ colors }) => (
  <View style={{
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  }}>
    <View style={{ width: '100%', height: 100, backgroundColor: colors.backgroundSecondary }} />
    <View style={{ padding: 14, gap: 10 }}>
      <View style={{ width: '80%', height: 16, backgroundColor: colors.backgroundSecondary, borderRadius: 4 }} />
      <View style={{ width: '50%', height: 12, backgroundColor: colors.backgroundSecondary, borderRadius: 4 }} />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ width: 60, height: 24, backgroundColor: colors.backgroundSecondary, borderRadius: 8 }} />
        <View style={{ width: 60, height: 24, backgroundColor: colors.backgroundSecondary, borderRadius: 8 }} />
      </View>
    </View>
  </View>
);

export const QuickRecommendations: React.FC<Props> = React.memo(({
  places,
  userLocation,
  transportMode = 'car',
  onPlaceSelect,
  maxItems = 3,
  radiusKm,
  isLoading = false,
}) => {
  const colors = useThemedColors();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const scrollRef = useRef<ScrollView | null>(null);

  // Фильтруем и сортируем места
  const topPlaces = useMemo(() => {
    if (!userLocation || !places.length) return [];

    // Добавляем расстояние к каждому месту
    const placesWithDistance = places
      .map(place => {
        const coords = parseCoordinateString(place.coord ?? '');
        if (!coords) return null;

        const distanceInfo = getDistanceInfo(
          { lat: userLocation.latitude, lng: userLocation.longitude },
          coords,
          transportMode
        );

        if (!distanceInfo) return null;

        // Рейтинг по умолчанию 0 если не указан
        const rating = place.rating ?? 0;

        return {
          ...place,
          distance: distanceInfo.distance,
          distanceText: distanceInfo.distanceText,
          travelTimeText: distanceInfo.travelTimeText,
          rating,
        };
      })
      .filter((item): item is NonNullable<typeof item> => {
        if (item === null) return false;
        // Фильтруем по радиусу поиска — показываем только места в пределах радиуса
        if (radiusKm != null && item.distance > radiusKm) return false;
        return true;
      });

    // Сортируем по расстоянию (ближайшие первыми), затем по рейтингу при равном расстоянии
    return placesWithDistance
      .sort((a, b) => {
        const distDiff = a.distance - b.distance;
        if (Math.abs(distDiff) > 1) return distDiff;
        // При примерно равном расстоянии — по рейтингу
        return b.rating - a.rating;
      })
      .slice(0, maxItems);
  }, [places, userLocation, transportMode, maxItems, radiusKm]);

  // Show skeleton while loading
  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <MapIcon name="star" size={20} color={colors.primary} />
          <Text style={styles.title}>Популярное рядом</Text>
        </View>
        <View style={styles.webCards}>
          <SkeletonCard colors={colors} />
          <SkeletonCard colors={colors} />
        </View>
      </View>
    );
  }

  if (!topPlaces.length) {
    return null;
  }

  const cards = topPlaces.map((place, index) => {
    const thumbUrl = place.travelImageThumbUrl || place.travel_image_thumb_url || null;
    const categoryName = typeof place.categoryName === 'string'
      ? place.categoryName.split(',')[0].trim()
      : '';
    const travelModeLabel = transportMode === 'car'
      ? 'Авто'
      : transportMode === 'bike'
      ? 'Велосипед'
      : 'Пешком';
    const badges = [place.distanceText, `${travelModeLabel} ${place.travelTimeText}`];

    return (
      <PlaceListCard
        key={place.id ?? `place-${index}`}
        title={place.address || 'Место'}
        imageUrl={thumbUrl}
        categoryLabel={categoryName || undefined}
        badges={badges}
        onCardPress={() => onPlaceSelect(place)}
        imageHeight={100}
        style={[
          styles.card,
          Platform.OS === 'web' && styles.cardWeb,
        ]}
      />
    );
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <MapIcon name="star" size={20} color={colors.primary} />
        <Text style={styles.title}>Популярное рядом</Text>
      </View>
      {Platform.OS === 'web' ? (
        <View style={styles.webCards}>
          {cards}
        </View>
      ) : (
        <ScrollView
          ref={scrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          nestedScrollEnabled={true}
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
        >
          {cards}
        </ScrollView>
      )}
    </View>
  );
});

const getStyles = (colors: ThemedColors) =>
  StyleSheet.create({
    container: {
      marginVertical: 12,
      marginHorizontal: 8,
    },
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
    webCards: {
      paddingHorizontal: 8,
      gap: 12,
    },
    scrollContent: {
      paddingHorizontal: 8,
      gap: 12,
      flexDirection: 'row',
      flexWrap: 'nowrap',
    },
    scroll: {
      ...Platform.select({
        web: {
          overflowX: 'auto',
          overflowY: 'hidden',
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          touchAction: 'pan-x',
        } as any,
        default: {},
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
    cardWeb: {
      width: '100%',
    },
  });
