import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';

import type { RoutePoint } from '@/api/plannedTrips';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';

interface Props {
  route: RoutePoint[];
  activeIndex?: number | null;
  readonly?: boolean;
  onEditPoint?: (index: number) => void;
  onAddPointFromMap?: (coords: { lat: number; lng: number }) => void;
}

export default function TripPlanRouteMap({ route, readonly }: Props) {
  const colors = useThemedColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const pointsWithCoordinates = route.filter((point) => point.coordinates).length;

  return (
    <View style={styles.wrap} testID="trip-plan-route-map">
      <View style={styles.iconBox}>
        <Feather name="map" size={18} color={colors.primaryDark} />
      </View>
      <View style={styles.copy}>
        <Text style={styles.title}>Карта маршрута</Text>
        <Text style={styles.text}>
          {readonly
            ? `В маршруте ${pointsWithCoordinates} точек с координатами.`
            : 'На web можно добавлять точки кликом по карте. В приложении добавьте координаты в форме ниже.'}
        </Text>
      </View>
    </View>
  );
}

const createStyles = (colors: ThemedColors) =>
  StyleSheet.create({
    wrap: {
      minHeight: 124,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 14,
      backgroundColor: colors.surfaceMuted,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    iconBox: {
      width: 38,
      height: 38,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
    },
    copy: { flex: 1, gap: 4 },
    title: { fontSize: 15, fontWeight: '700', color: colors.text },
    text: { fontSize: 13, lineHeight: 18, color: colors.textSecondary },
  });
