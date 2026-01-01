/**
 * Skeleton loaders для компонентов страницы деталей путешествия
 * Улучшают воспринимаемую производительность вместо пустых экранов
 */

import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { SkeletonLoader } from '@/components/SkeletonLoader';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';
import ReservedSpace from '@/components/ReservedSpace';

/**
 * Skeleton для текстового описания
 */
export const DescriptionSkeleton: React.FC = () => {
  const colors = useThemedColors();
  const lineH = 18;
  const lines = 8;
  const gap = 8;
  const reservedH = lines * lineH + Math.max(0, lines - 1) * gap;

  const styles = useMemo(() => StyleSheet.create({
    descriptionContainer: {
      padding: DESIGN_TOKENS.spacing.lg,
      backgroundColor: colors.surface,
      borderRadius: 12,
      width: '100%',
    },
  }), [colors.surface]);

  return (
    <View style={styles.descriptionContainer}>
      <ReservedSpace testID="travel-details-description-reserved" height={reservedH} />
    </View>
  );
};

/**
 * Skeleton для карты
 */
export const MapSkeleton: React.FC = () => {
  return (
    <View style={{ width: '100%', marginBottom: DESIGN_TOKENS.spacing.lg }}>
      <SkeletonLoader width="100%" height={400} borderRadius={12} />
    </View>
  );
};

/**
 * Skeleton для списка точек маршрута
 */
export const PointListSkeleton: React.FC = () => {
  const colors = useThemedColors();

  const styles = useMemo(() => StyleSheet.create({
    pointListContainer: {
      width: '100%',
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: DESIGN_TOKENS.spacing.md,
    },
    pointCard: {
      width: '100%',
      maxWidth: 400,
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: DESIGN_TOKENS.spacing.md,
      marginBottom: 12,
    },
    pointContent: {
      paddingTop: 8,
    },
    marginBottom: {
      marginBottom: 8,
    },
  }), [colors.surface]);

  return (
    <View style={styles.pointListContainer}>
      {Array.from({ length: 3 }).map((_, index) => (
        <View key={index} style={styles.pointCard}>
          <SkeletonLoader width="100%" height={200} borderRadius={12} style={styles.marginBottom} />
          <View style={styles.pointContent}>
            <SkeletonLoader width="80%" height={18} borderRadius={4} style={styles.marginBottom} />
            <SkeletonLoader width="60%" height={14} borderRadius={4} />
          </View>
        </View>
      ))}
    </View>
  );
};

/**
 * Skeleton для списка похожих путешествий
 */
export const TravelListSkeleton: React.FC<{ count?: number }> = ({ count = 3 }) => {
  const colors = useThemedColors();

  const styles = useMemo(() => StyleSheet.create({
    travelListContainer: {
      width: '100%',
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: DESIGN_TOKENS.spacing.md,
    },
    travelCard: {
      width: '100%',
      maxWidth: 300,
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: DESIGN_TOKENS.spacing.md,
      marginBottom: 12,
    },
    marginBottom: {
      marginBottom: 8,
    },
  }), [colors.surface]);

  return (
    <View style={styles.travelListContainer}>
      {Array.from({ length: count }).map((_, index) => (
        <View key={index} style={styles.travelCard}>
          <SkeletonLoader width="100%" height={160} borderRadius={12} style={styles.marginBottom} />
          <SkeletonLoader width="85%" height={18} borderRadius={4} style={styles.marginBottom} />
          <SkeletonLoader width="60%" height={14} borderRadius={4} />
        </View>
      ))}
    </View>
  );
};

/**
 * Skeleton для видео YouTube
 */
export const VideoSkeleton: React.FC = () => {
  return (
    <View style={{ width: '100%', marginBottom: DESIGN_TOKENS.spacing.lg }}>
      <SkeletonLoader width="100%" height={400} borderRadius={12} />
    </View>
  );
};

/**
 * Универсальный skeleton для секций
 */
export const SectionSkeleton: React.FC<{ lines?: number }> = ({ lines = 4 }) => {
  const colors = useThemedColors();
  const lineH = 18;
  const gap = 8;
  const reservedH = lines * lineH + Math.max(0, lines - 1) * gap;

  const styles = useMemo(() => StyleSheet.create({
    sectionContainer: {
      padding: DESIGN_TOKENS.spacing.lg,
      backgroundColor: colors.surface,
      borderRadius: 12,
      width: '100%',
    },
  }), [colors.surface]);

  return (
    <View style={styles.sectionContainer}>
      <ReservedSpace testID="travel-details-section-reserved" height={reservedH} />
    </View>
  );
};
