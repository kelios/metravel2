/**
 * MapPeekPreview - превью топ-3 мест в collapsed состоянии Bottom Sheet
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';
import { getDistanceInfo } from '@/utils/distanceCalculator';

interface MapPeekPreviewProps {
  places: any[];
  userLocation: { latitude: number; longitude: number } | null;
  transportMode?: 'car' | 'bike' | 'foot';
  onPlacePress: (place: any) => void;
  onExpandPress: () => void;
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

export const MapPeekPreview: React.FC<MapPeekPreviewProps> = ({
  places,
  userLocation,
  transportMode = 'car',
  onPlacePress,
  onExpandPress,
}) => {
  const colors = useThemedColors();
  const styles = useMemo(() => getStyles(colors), [colors]);

  // Топ-3 места
  const topPlaces = useMemo(() => {
    return places.slice(0, 3);
  }, [places]);

  if (!topPlaces.length) {
    return (
      <View style={styles.container}>
        <Text style={styles.emptyText}>Мест не найдено</Text>
        <Pressable style={styles.expandButton} onPress={onExpandPress}>
          <Text style={styles.expandText}>Изменить фильтры</Text>
          <Icon name="expand-less" size={20} color={colors.primary} />
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {topPlaces.map((place, index) => {
          const coords = parseCoord(place.coord);
          const distanceInfo =
            coords && userLocation
              ? getDistanceInfo(
                  { lat: userLocation.latitude, lng: userLocation.longitude },
                  coords,
                  transportMode
                )
              : null;

          return (
            <Pressable
              key={place.id || index}
              style={styles.placeCard}
              onPress={() => onPlacePress(place)}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.placeNumber}>{index + 1}</Text>
                <Text style={styles.placeName} numberOfLines={1}>
                  {place.address || 'Неизвестное место'}
                </Text>
              </View>

              {distanceInfo && (
                <View style={styles.distanceRow}>
                  <View style={styles.distanceBadge}>
                    <Icon name="place" size={12} color={colors.primary} />
                    <Text style={styles.distanceText}>{distanceInfo.distanceText}</Text>
                  </View>
                  <View style={styles.timeBadge}>
                    <Icon
                      name={
                        transportMode === 'car'
                          ? 'directions-car'
                          : transportMode === 'bike'
                          ? 'directions-bike'
                          : 'directions-walk'
                      }
                      size={12}
                      color={colors.accent}
                    />
                    <Text style={styles.timeText}>{distanceInfo.travelTimeText}</Text>
                  </View>
                </View>
              )}
            </Pressable>
          );
        })}
      </ScrollView>

      {places.length > 3 && (
        <Pressable style={styles.moreButton} onPress={onExpandPress}>
          <Text style={styles.moreText}>Ещё {places.length - 3}</Text>
          <Icon name="expand-less" size={20} color={colors.primary} />
        </Pressable>
      )}
    </View>
  );
};

const getStyles = (colors: ThemedColors) =>
  StyleSheet.create({
    container: {
      paddingVertical: 8,
    },
    scrollContent: {
      paddingRight: 16,
      gap: 12,
    },
    emptyText: {
      fontSize: 14,
      color: colors.textMuted,
      textAlign: 'center',
      marginBottom: 12,
    },
    expandButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
    },
    expandText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.primary,
    },
    placeCard: {
      backgroundColor: colors.backgroundSecondary,
      borderRadius: 12,
      padding: 12,
      minWidth: 160,
      maxWidth: 200,
      borderWidth: 1,
      borderColor: colors.border,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 8,
    },
    placeNumber: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: colors.primary,
      color: colors.textOnPrimary,
      fontSize: 12,
      fontWeight: '700',
      textAlign: 'center',
      lineHeight: 24,
    },
    placeName: {
      flex: 1,
      fontSize: 13,
      fontWeight: '600',
      color: colors.text,
    },
    distanceRow: {
      flexDirection: 'row',
      gap: 6,
    },
    distanceBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: colors.primaryLight,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
    },
    distanceText: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.primary,
    },
    timeBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: colors.accentLight,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
    },
    timeText: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.accent,
    },
    moreButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      marginTop: 12,
      paddingVertical: 8,
    },
    moreText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.primary,
    },
  });

