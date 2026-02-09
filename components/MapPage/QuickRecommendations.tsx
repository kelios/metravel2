/**
 * QuickRecommendations - быстрые рекомендации популярных мест рядом
 */

import React, { useMemo, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Platform } from 'react-native';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';
import { getDistanceInfo } from '@/utils/distanceCalculator';
import { parseCoordinateString } from '@/utils/coordinates';
import MapIcon from './MapIcon';
import CardActionPressable from '@/components/ui/CardActionPressable';
import ImageCardMedia from '@/components/ui/ImageCardMedia';


interface Props {
  places: any[];
  userLocation: { latitude: number; longitude: number } | null;
  transportMode?: 'car' | 'bike' | 'foot';
  onPlaceSelect: (place: any) => void;
  maxItems?: number;
}

export const QuickRecommendations: React.FC<Props> = React.memo(({
  places,
  userLocation,
  transportMode = 'car',
  onPlaceSelect,
  maxItems = 3,
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
      .filter((item): item is NonNullable<typeof item> => item !== null);

    // Сортируем по рейтингу и расстоянию
    // Сначала по рейтингу (если есть), потом по расстоянию
    return placesWithDistance
      .sort((a, b) => {
        // Если есть рейтинги, сначала сортируем по ним
        if (a.rating > 0 || b.rating > 0) {
          if (a.rating !== b.rating) {
            return b.rating - a.rating;
          }
        }
        // Потом по расстоянию
        return a.distance - b.distance;
      })
      .slice(0, maxItems);
  }, [places, userLocation, transportMode, maxItems]);

  if (!topPlaces.length) {
    return null;
  }

  const cards = topPlaces.map((place, index) => {
    const thumbUrl = place.travelImageThumbUrl || place.travel_image_thumb_url || null;
    return (
    <CardActionPressable
      key={place.id ?? `place-${index}`}
      style={({ pressed }) => [
        styles.card,
        Platform.OS === 'web' && styles.cardWeb,
        pressed && styles.cardPressed,
      ]}
      onPress={() => onPlaceSelect(place)}
      accessibilityLabel={`Открыть ${place.address || 'место'}`}
    >
      {thumbUrl ? (
        <View style={styles.cardImage}>
          <ImageCardMedia
            src={thumbUrl}
            alt={place.address || 'Место'}
            fit="contain"
            blurBackground
            blurRadius={12}
            loading="lazy"
            priority="low"
            style={StyleSheet.absoluteFillObject}
          />
        </View>
      ) : (
        <View style={[styles.cardImage, styles.cardImagePlaceholder]} />
      )}
      <View style={styles.cardBody}>
      <View style={styles.cardHeader}>
        <Text style={styles.placeName} numberOfLines={2}>{place.address}</Text>
        {place.rating > 0 && (
          <View style={styles.ratingBadge}>
            <MapIcon name="star" size={14} color={colors.warning} />
            <Text style={styles.ratingText}>{place.rating.toFixed(1)}</Text>
          </View>
        )}
      </View>
      <View style={styles.infoRow}>
        <View style={styles.infoBadge}>
          <MapIcon name="place" size={14} color={colors.primary} />
          <Text style={styles.infoText}>{place.distanceText}</Text>
        </View>
        <View style={styles.infoBadge}>
          <MapIcon
            name={
              transportMode === 'car'
                ? 'directions-car'
                : transportMode === 'bike'
                ? 'directions-bike'
                : 'directions-walk'
            }
            size={14}
            color={colors.accent}
          />
          <Text style={styles.infoText}>{place.travelTimeText}</Text>
        </View>
      </View>

      {place.categoryName && (
        <View style={styles.categoryBadge}>
          <Text style={styles.categoryText} numberOfLines={1}>{place.categoryName.split(',')[0].trim()}</Text>
        </View>
      )}
      </View>
    </CardActionPressable>
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
    cardImage: {
      width: '100%',
      height: 100,
      backgroundColor: colors.backgroundSecondary,
    },
    cardImagePlaceholder: {
      height: 100,
    },
    cardBody: {
      padding: 14,
    },
    cardPressed: {
      opacity: 0.7,
      transform: [{ scale: 0.98 }],
    },
    cardHeader: {
      marginBottom: 10,
    },
    placeName: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 6,
      lineHeight: 20,
    },
    ratingBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: colors.warningLight,
      alignSelf: 'flex-start',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
    },
    ratingText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.text,
    },
    infoRow: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 8,
    },
    infoBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: colors.backgroundSecondary,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
    },
    infoText: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.textMuted,
    },
    categoryBadge: {
      backgroundColor: colors.primaryLight,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
      alignSelf: 'flex-start',
    },
    categoryText: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.primaryText,
      letterSpacing: 0.2,
    },
  });
