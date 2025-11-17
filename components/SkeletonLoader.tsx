import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';

interface SkeletonLoaderProps {
  width?: number | string;
  height?: number | string;
  borderRadius?: number;
  style?: any;
}

/**
 * Компонент skeleton loader для улучшения воспринимаемой производительности
 * Показывает placeholder во время загрузки вместо спиннера
 */
export const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({
  width = '100%',
  height = 20,
  borderRadius = 4,
  style,
}) => {
  return (
    <View
      style={[
        styles.skeleton,
        {
          width,
          height,
          borderRadius,
        },
        style,
      ]}
    />
  );
};

/**
 * Skeleton для карточки путешествия
 */
export const TravelCardSkeleton: React.FC = () => {
  return (
    <View style={styles.card}>
      <SkeletonLoader width="100%" height="60%" borderRadius={12} />
      <View style={styles.content}>
        <SkeletonLoader width="80%" height={16} style={styles.marginBottom} />
        <SkeletonLoader width="60%" height={14} />
      </View>
    </View>
  );
};

/**
 * Skeleton для списка путешествий
 */
export const TravelListSkeleton: React.FC<{ count?: number }> = ({ count = 6 }) => {
  return (
    <View style={styles.listContainer}>
      {Array.from({ length: count }).map((_, index) => (
        <TravelCardSkeleton key={index} />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: '#e2e8f0',
    // ✅ ИСПРАВЛЕНИЕ: Убираем animation из StyleSheet, используем CSS через style элемент ниже
  },
  card: {
    padding: 8,
    width: '100%',
    aspectRatio: 1,
    borderRadius: 16,
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  content: {
    padding: 14,
    flex: 1,
    justifyContent: 'flex-end',
  },
  marginBottom: {
    marginBottom: 8,
  },
  listContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 8,
  },
});

// CSS анимация для веб (добавить в глобальные стили)
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes pulse {
      0%, 100% {
        opacity: 1;
      }
      50% {
        opacity: 0.5;
      }
    }
  `;
  document.head.appendChild(style);
}

