/**
 * Skeleton loaders для компонентов страницы деталей путешествия
 * Улучшают воспринимаемую производительность вместо пустых экранов
 */

import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { SkeletonLoader } from '@/components/SkeletonLoader';

/**
 * Skeleton для текстового описания
 */
export const DescriptionSkeleton: React.FC = () => {
  return (
    <View style={styles.descriptionContainer}>
      <SkeletonLoader width="85%" height={24} borderRadius={4} style={styles.marginBottom} />
      <SkeletonLoader width="100%" height={18} borderRadius={4} style={styles.marginBottom} />
      <SkeletonLoader width="95%" height={18} borderRadius={4} style={styles.marginBottom} />
      <SkeletonLoader width="90%" height={18} borderRadius={4} style={styles.marginBottom} />
      <SkeletonLoader width="100%" height={18} borderRadius={4} style={styles.marginBottom} />
      <SkeletonLoader width="88%" height={18} borderRadius={4} style={styles.marginBottom} />
      <SkeletonLoader width="92%" height={20} borderRadius={4} style={styles.marginBottom} />
      <SkeletonLoader width="80%" height={18} borderRadius={4} />
    </View>
  );
};

/**
 * Skeleton для карты
 */
export const MapSkeleton: React.FC = () => {
  return (
    <View style={styles.mapContainer}>
      <SkeletonLoader width="100%" height={400} borderRadius={12} />
    </View>
  );
};

/**
 * Skeleton для списка точек маршрута
 */
export const PointListSkeleton: React.FC = () => {
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
    <View style={styles.videoContainer}>
      <SkeletonLoader width="100%" height={400} borderRadius={12} />
    </View>
  );
};

/**
 * Универсальный skeleton для секций
 */
export const SectionSkeleton: React.FC<{ lines?: number }> = ({ lines = 4 }) => {
  return (
    <View style={styles.sectionContainer}>
      {Array.from({ length: lines }).map((_, index) => (
        <SkeletonLoader
          key={index}
          width={index === 0 ? '85%' : index === lines - 1 ? '70%' : '100%'}
          height={18}
          borderRadius={4}
          style={index < lines - 1 ? styles.marginBottom : undefined}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  descriptionContainer: {
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    width: '100%',
  },
  mapContainer: {
    width: '100%',
    marginBottom: 16,
  },
  pointListContainer: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  pointCard: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  pointContent: {
    paddingTop: 8,
  },
  travelListContainer: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  travelCard: {
    width: '100%',
    maxWidth: 300,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  videoContainer: {
    width: '100%',
    marginBottom: 16,
  },
  sectionContainer: {
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    width: '100%',
  },
  marginBottom: {
    marginBottom: 8,
  },
});

