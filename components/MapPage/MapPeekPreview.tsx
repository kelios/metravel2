/**
 * MapPeekPreview - превью топ-3 мест в collapsed состоянии Bottom Sheet
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Platform } from 'react-native';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';
import { getDistanceInfo } from '@/utils/distanceCalculator';
import MapIcon from './MapIcon';
import Button from '@/components/ui/Button';

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

  // Топ-3 места
  const topPlaces = useMemo(() => {
    return places.slice(0, 3);
  }, [places]);

  if (!topPlaces.length) {
    return (
      <View style={styles.container}>
        <Text style={styles.emptyText}>Мест не найдено</Text>
        <Button
          label="Изменить фильтры"
          icon={<MapIcon name="expand-less" size={20} color={colors.primary} />}
          onPress={onExpandPress}
          variant="ghost"
          size="sm"
          style={styles.expandButton}
        />
      </View>
    );
  }

  return (
    <View
      style={styles.container}
      {...(Platform.OS === 'web' ? ({ onWheelCapture: onWheel } as any) : ({} as any))}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        ref={scrollRef}
        onScroll={(e) => setScrollX(e.nativeEvent.contentOffset.x)}
        scrollEventThrottle={16}
        style={styles.scroll}
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
                    <MapIcon name="place" size={12} color={colors.primary} />
                    <Text style={styles.distanceText}>{distanceInfo.distanceText}</Text>
                  </View>
                  <View style={styles.timeBadge}>
                    <MapIcon
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
        <Button
          label={`Ещё ${places.length - 3}`}
          icon={<MapIcon name="expand-less" size={20} color={colors.primary} />}
          onPress={onExpandPress}
          variant="ghost"
          size="sm"
          style={styles.moreButton}
        />
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
    scroll: {
      ...(Platform.OS === 'web'
        ? ({
            overflowX: 'auto',
            overflowY: 'hidden',
          } as any)
        : null),
    },
    emptyText: {
      fontSize: 14,
      color: colors.textMuted,
      textAlign: 'center',
      marginBottom: 12,
    },
    expandButton: {
      alignSelf: 'center',
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
      alignSelf: 'center',
      marginTop: 12,
    },
  });
