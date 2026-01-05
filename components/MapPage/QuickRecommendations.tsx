/**
 * QuickRecommendations - быстрые рекомендации популярных мест рядом
 */

import React, { useMemo, useRef, useCallback, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';
import { getDistanceInfo } from '@/utils/distanceCalculator';


interface Props {
  places: any[];
  userLocation: { latitude: number; longitude: number } | null;
  transportMode?: 'car' | 'bike' | 'foot';
  onPlaceSelect: (place: any) => void;
  maxItems?: number;
}

/**
 * Парсит координаты из строки
 */
function parseCoord(coord?: string): { lat: number; lng: number } | null {
  if (!coord) return null;
  const parts = coord.split(',').map(s => parseFloat(s.trim()));
  if (parts.length !== 2 || !Number.isFinite(parts[0]) || !Number.isFinite(parts[1])) {
    return null;
  }
  return { lat: parts[0], lng: parts[1] };
}

export const QuickRecommendations: React.FC<Props> = ({
  places,
  userLocation,
  transportMode = 'car',
  onPlaceSelect,
  maxItems = 3,
}) => {
  const colors = useThemedColors();
  const styles = useMemo(() => getStyles(colors), [colors]);

  const scrollRef = useRef<ScrollView | null>(null);
  const [scrollX, setScrollX] = useState(0);

  const onWheel = useCallback(
    (e: any) => {
      if (Platform.OS !== 'web') return;
      const dx = e?.nativeEvent?.deltaX;
      const dy = e?.nativeEvent?.deltaY;
      const deltaX = typeof dx === 'number' ? dx : 0;
      const deltaY = typeof dy === 'number' ? dy : 0;
      const delta = deltaX !== 0 ? deltaX : deltaY;
      if (delta === 0) return;

      e?.preventDefault?.();
      e?.stopPropagation?.();
      scrollRef.current?.scrollTo({ x: Math.max(0, scrollX + delta), animated: false });
    },
    [scrollX]
  );

  // Фильтруем и сортируем места
  const topPlaces = useMemo(() => {
    if (!userLocation || !places.length) return [];

    // Добавляем расстояние к каждому месту
    const placesWithDistance = places
      .map(place => {
        const coords = parseCoord(place.coord);
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

  return (
    <View
      style={styles.container}
      {...(Platform.OS === 'web' ? ({ onWheelCapture: onWheel } as any) : ({} as any))}
    >
      <View style={styles.header}>
        <MaterialIcons name="star" size={20} color={colors.primary} />
        <Text style={styles.title}>Популярное рядом</Text>
      </View>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        onScroll={(e) => setScrollX(e.nativeEvent.contentOffset.x)}
        scrollEventThrottle={16}
      >
        {topPlaces.map((place, index) => (
          <Pressable
            key={place.id ?? `place-${index}`}
            style={({ pressed }) => [
              styles.card,
              pressed && styles.cardPressed,
            ]}
            onPress={() => onPlaceSelect(place)}
            accessibilityRole="button"
            accessibilityLabel={`Открыть ${place.address || 'место'}`}
          >
            <View style={styles.cardHeader}>
              <Text style={styles.placeName} numberOfLines={2}>{place.address}</Text>
              {place.rating > 0 && (
                <View style={styles.ratingBadge}>
                  <MaterialIcons name="star" size={14} color={colors.warning} />
                  <Text style={styles.ratingText}>{place.rating.toFixed(1)}</Text>
                </View>
              )}
            </View>
            <View style={styles.infoRow}>
              <View style={styles.infoBadge}>
                <MaterialIcons name="place" size={14} color={colors.primary} />
                <Text style={styles.infoText}>{place.distanceText}</Text>
              </View>
              <View style={styles.infoBadge}>
                <MaterialIcons
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
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
};

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
    scrollContent: {
      paddingHorizontal: 8,
      gap: 12,
    },
    card: {
      width: 220,
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 14,
      ...colors.shadows.medium,
      borderWidth: 1,
      borderColor: colors.border,
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
      color: colors.primary,
      letterSpacing: 0.2,
    },
  });

