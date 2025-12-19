import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { METRICS } from '@/constants/layout';
import { useResponsive } from '@/hooks/useResponsive';

interface RouteStatsProps {
  distance: number | null; // в метрах
  pointsCount: number;
  mode: 'car' | 'bike' | 'foot';
}

export default function RouteStats({ distance, pointsCount, mode }: RouteStatsProps) {
  const { isPhone, isLargePhone } = useResponsive();
  const isMobile = isPhone || isLargePhone;

  // Приблизительное время в пути (в часах)
  const estimatedTime = React.useMemo(() => {
    if (!distance) return null;
    const speeds = { car: 60, bike: 20, foot: 5 }; // км/ч
    const speed = speeds[mode];
    const hours = (distance / 1000) / speed;
    return hours;
  }, [distance, mode]);

  const formatDistance = (meters: number) => {
    if (meters < 1000) return `${Math.round(meters)} м`;
    return `${(meters / 1000).toFixed(1)} км`;
  };

  const formatTime = (hours: number) => {
    if (hours < 1) return `${Math.round(hours * 60)} мин`;
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    if (m === 0) return `${h} ч`;
    return `${h} ч ${m} мин`;
  };

  if (!distance && pointsCount === 0) return null;

  return (
    <View style={[styles.container, isMobile && styles.containerMobile]}>
      <View style={styles.header}>
        <Feather name="bar-chart-2" size={16} color="#667085" />
        <Text style={styles.title}>Статистика маршрута</Text>
      </View>
      <View style={styles.stats}>
        {distance !== null && (
          <View style={styles.statItem}>
            <Feather name="map" size={14} color="#ff9f5a" />
            <View style={styles.statContent}>
              <Text style={styles.statValue}>{formatDistance(distance)}</Text>
              <Text style={styles.statLabel}>Расстояние</Text>
            </View>
          </View>
        )}
        {estimatedTime !== null && (
          <View style={styles.statItem}>
            <Feather name="clock" size={14} color="#25a562" />
            <View style={styles.statContent}>
              <Text style={styles.statValue}>{formatTime(estimatedTime)}</Text>
              <Text style={styles.statLabel}>Время в пути</Text>
            </View>
          </View>
        )}
        <View style={styles.statItem}>
          <Feather name="map-pin" size={14} color="#2b6cb0" />
          <View style={styles.statContent}>
            <Text style={styles.statValue}>{pointsCount}</Text>
            <Text style={styles.statLabel}>
              {pointsCount === 1 ? 'Точка' : pointsCount < 5 ? 'Точки' : 'Точек'}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 12,
  },
  containerMobile: {
    padding: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1b1f23',
  },
  stats: {
    gap: 10,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  statContent: {
    flex: 1,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1b1f23',
  },
  statLabel: {
    fontSize: 11,
    color: '#667085',
    marginTop: 2,
  },
});

