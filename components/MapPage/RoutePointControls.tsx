import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useResponsive } from '@/hooks/useResponsive';
import type { RoutePoint } from '@/types/route';
import { CoordinateConverter } from '@/utils/coordinateConverter';
import { DESIGN_TOKENS } from '@/constants/designSystem';

interface RoutePointControlsProps {
  routePoints: RoutePoint[];
  onRemovePoint: (id: string) => void;
  onClearRoute: () => void;
}

export default function RoutePointControls({ 
  routePoints, 
  onRemovePoint, 
  onClearRoute 
}: RoutePointControlsProps) {
  const { isPhone, isLargePhone } = useResponsive();
  const isMobile = isPhone || isLargePhone;

  if (routePoints.length === 0) return null;

  return (
    <View style={[styles.container, isMobile && styles.containerMobile]}>
      <View style={styles.header}>
        <Text style={styles.title}>Точки маршрута</Text>
        {routePoints.length > 0 && (
          <Pressable
            onPress={onClearRoute}
            style={styles.clearButton}
            accessibilityRole="button"
            accessibilityLabel="Очистить маршрут"
          >
            <Feather name="x" size={14} color={DESIGN_TOKENS.colors.danger} />
            <Text style={styles.clearText}>Очистить</Text>
          </Pressable>
        )}
      </View>
      
      <View style={styles.pointsList}>
        {routePoints.map((point, index) => {
          const getPointLabel = () => {
            if (point.type === 'start') return 'Старт';
            if (point.type === 'end') return 'Финиш';
            return `Точка ${index}`;
          };

          const getMarkerStyle = () => {
            if (point.type === 'start') return styles.pointMarkerStart;
            if (point.type === 'end') return styles.pointMarkerEnd;
            return styles.pointMarkerWaypoint;
          };

          const getMarkerLabel = () => {
            if (point.type === 'start') return 'S';
            if (point.type === 'end') return 'E';
            return String(index);
          };

          return (
            <View key={point.id} style={styles.pointItem}>
              <View style={[styles.pointMarker, getMarkerStyle()]}>
                <Text style={styles.pointNumber}>{getMarkerLabel()}</Text>
              </View>
              <View style={styles.pointInfo}>
                <Text style={styles.pointLabel}>
                  {getPointLabel()}
                </Text>
                <Text style={styles.pointCoords} numberOfLines={1}>
                  {point.address || CoordinateConverter.formatCoordinates(point.coordinates)}
                </Text>
              </View>
              <Pressable
                onPress={() => onRemovePoint(point.id)}
                style={styles.removeButton}
                accessibilityRole="button"
                accessibilityLabel={`Удалить ${getPointLabel()}`}
              >
                <Feather name="x-circle" size={18} color={DESIGN_TOKENS.colors.danger} />
              </Pressable>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: DESIGN_TOKENS.colors.surface,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    ...DESIGN_TOKENS.shadowsNative.medium,
    borderWidth: 1,
    borderColor: DESIGN_TOKENS.colors.border,
  },
  containerMobile: {
    marginHorizontal: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 13,
    fontWeight: '600',
    color: DESIGN_TOKENS.colors.text,
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: DESIGN_TOKENS.colors.dangerLight,
  },
  clearText: {
    fontSize: 12,
    color: DESIGN_TOKENS.colors.danger,
    fontWeight: '600',
  },
  pointsList: {
    gap: 8,
  },
  pointItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 8,
    backgroundColor: DESIGN_TOKENS.colors.cardMuted,
    borderRadius: 8,
  },
  pointMarker: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pointMarkerStart: {
    backgroundColor: DESIGN_TOKENS.colors.success,
  },
  pointMarkerEnd: {
    backgroundColor: DESIGN_TOKENS.colors.danger,
  },
  pointMarkerWaypoint: {
    backgroundColor: DESIGN_TOKENS.colors.info,
  },
  pointNumber: {
    color: DESIGN_TOKENS.colors.textOnPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  pointInfo: {
    flex: 1,
  },
  pointLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: DESIGN_TOKENS.colors.text,
    marginBottom: 2,
  },
  pointCoords: {
    fontSize: 11,
    color: DESIGN_TOKENS.colors.textMuted,
  },
  removeButton: {
    padding: 4,
  },
});
