/**
 * MapPeekPreview - превью топ-3 мест в collapsed состоянии Bottom Sheet
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Platform } from 'react-native';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';
import { getDistanceInfo } from '@/utils/distanceCalculator';
import { parseCoordinateString } from '@/utils/coordinates';
import ImageCardMedia from '@/components/ui/ImageCardMedia';
import Feather from '@expo/vector-icons/Feather';
import MapIcon from './MapIcon';
import Button from '@/components/ui/Button';
import CardActionPressable from '@/components/ui/CardActionPressable';

interface MapPeekPreviewProps {
  places: any[];
  userLocation: { latitude: number; longitude: number } | null;
  transportMode?: 'car' | 'bike' | 'foot';
  onPlacePress: (place: any) => void;
  onExpandPress: () => void;
}

export const MapPeekPreview: React.FC<MapPeekPreviewProps> = React.memo(({
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

  // Топ-5 мест
  const topPlaces = useMemo(() => {
    return places.slice(0, 5);
  }, [places]);

  if (!topPlaces.length) {
    return (
      <View style={styles.emptyContainer}>
        <Button
          label="Мест не найдено — изменить фильтры"
          icon={<MapIcon name="expand-less" size={16} color={colors.textMuted} />}
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
          const coords = parseCoordinateString(place.coord ?? '');
          const distanceInfo =
            coords && userLocation
              ? getDistanceInfo(
                  { lat: userLocation.latitude, lng: userLocation.longitude },
                  coords,
                  transportMode
                )
              : null;

          const thumbUrl = place.travelImageThumbUrl || null;

          return (
            <CardActionPressable
              key={place.id || index}
              style={styles.placeCard}
              onPress={() => onPlacePress(place)}
              accessibilityHint="Открыть на карте"
            >
              <View style={styles.cardRow}>
                <View style={styles.thumbnail}>
                  {thumbUrl ? (
                    <ImageCardMedia
                      src={thumbUrl}
                      fit="cover"
                      loading="lazy"
                      priority="low"
                      cachePolicy="memory-disk"
                      style={StyleSheet.absoluteFillObject}
                    />
                  ) : (
                    <Feather name="map-pin" size={16} color={colors.primary} />
                  )}
                </View>
                <View style={styles.cardContent}>
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
                </View>
              </View>
            </CardActionPressable>
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
});

const getStyles = (colors: ThemedColors) =>
  StyleSheet.create({
    container: {
      paddingVertical: 4,
    },
    emptyContainer: {
      paddingVertical: 2,
      alignItems: 'center',
    },
    scrollContent: {
      paddingRight: 16,
      gap: 10,
    },
    scroll: {
      ...(Platform.OS === 'web'
        ? ({
            overflowX: 'auto',
            overflowY: 'hidden',
            WebkitOverflowScrolling: 'touch',
            touchAction: 'pan-x',
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
      padding: 8,
      minWidth: 132,
      maxWidth: 220,
      borderWidth: 1,
      borderColor: colors.border,
    },
    cardRow: {
      flexDirection: 'row',
      gap: 8,
    },
    thumbnail: {
      width: 36,
      height: 36,
      borderRadius: 8,
      overflow: 'hidden',
      backgroundColor: colors.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    cardContent: {
      flex: 1,
      minWidth: 0,
      gap: 5,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
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
      fontSize: 12,
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
      paddingHorizontal: 7,
      paddingVertical: 3,
      borderRadius: 8,
    },
    distanceText: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.primaryText,
    },
    timeBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: colors.accentLight,
      paddingHorizontal: 7,
      paddingVertical: 3,
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
