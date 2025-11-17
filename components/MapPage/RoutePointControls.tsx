import React from 'react';
import { View, Text, StyleSheet, Pressable, useWindowDimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';

interface RoutePointControlsProps {
  routePoints: [number, number][];
  onRemovePoint: (index: number) => void;
  onClearRoute: () => void;
}

export default function RoutePointControls({ 
  routePoints, 
  onRemovePoint, 
  onClearRoute 
}: RoutePointControlsProps) {
  const { width } = useWindowDimensions();
  const isMobile = width <= 768;

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
            <Feather name="x" size={14} color="#d94b4b" />
            <Text style={styles.clearText}>Очистить</Text>
          </Pressable>
        )}
      </View>
      
      <View style={styles.pointsList}>
        {routePoints.map((point, index) => (
          <View key={index} style={styles.pointItem}>
            <View style={[styles.pointMarker, index === 0 ? styles.pointMarkerStart : styles.pointMarkerEnd]}>
              <Text style={styles.pointNumber}>{index === 0 ? 'S' : 'E'}</Text>
            </View>
            <View style={styles.pointInfo}>
              <Text style={styles.pointLabel}>
                {index === 0 ? 'Старт' : 'Финиш'}
              </Text>
              <Text style={styles.pointCoords} numberOfLines={1}>
                {point[1].toFixed(4)}, {point[0].toFixed(4)}
              </Text>
            </View>
            <Pressable
              onPress={() => onRemovePoint(index)}
              style={styles.removeButton}
              accessibilityRole="button"
              accessibilityLabel={`Удалить точку ${index + 1}`}
            >
              <Feather name="x-circle" size={18} color="#d94b4b" />
            </Pressable>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#e0e0e0',
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
    color: '#1b1f23',
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#fff5f5',
  },
  clearText: {
    fontSize: 12,
    color: '#d94b4b',
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
    backgroundColor: '#f8f9fa',
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
    backgroundColor: '#25a562',
  },
  pointMarkerEnd: {
    backgroundColor: '#d94b4b',
  },
  pointNumber: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  pointInfo: {
    flex: 1,
  },
  pointLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1b1f23',
    marginBottom: 2,
  },
  pointCoords: {
    fontSize: 11,
    color: '#667085',
  },
  removeButton: {
    padding: 4,
  },
});

