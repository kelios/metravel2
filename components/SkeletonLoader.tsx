import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { DESIGN_TOKENS } from '@/constants/designSystem';

interface SkeletonLoaderProps {
  width?: number | string;
  height?: number | string;
  borderRadius?: number;
  style?: any;
}

/**
 * Компонент skeleton loader для улучшения воспринимаемой производительности
 * Показывает placeholder во время загрузки вместо спиннера
 * ✅ УЛУЧШЕНИЕ: Мягкие оттенки с градиентом для лучшей выразительности
 */
export const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({
  width = '100%',
  height = 20,
  borderRadius = 4,
  style,
}) => {
  return (
    <View
      {...(Platform.OS === 'web' ? { className: 'skeleton-pulse' } : {})}
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
  // Адаптивная высота изображения
  const imageHeight = Platform.select({ default: 180, web: 200 });
  const titleHeight = Platform.select({ default: 14, web: 16 });
  const metaHeight = Platform.select({ default: 11, web: 12 });
  
  return (
    <View style={styles.card}>
      {/* Изображение с aspectRatio 16/9 */}
      <SkeletonLoader width="100%" height={imageHeight} borderRadius={12} style={styles.image} />
      <View style={styles.content}>
        {/* Заголовок - 2 строки */}
        <SkeletonLoader width="90%" height={titleHeight} style={styles.marginBottom} />
        <SkeletonLoader width="75%" height={titleHeight} style={styles.marginBottomLarge} />
        {/* Метаинформация */}
        <View style={styles.metaRow}>
          <SkeletonLoader width="30%" height={metaHeight} />
          <SkeletonLoader width="25%" height={metaHeight} />
        </View>
      </View>
    </View>
  );
};

/**
 * Skeleton для списка путешествий
 */
export const TravelListSkeleton: React.FC<{ count?: number; columns?: number }> = ({ count = 6, columns = 1 }) => {
  // Для одной колонки используем 100%, для нескольких - вычисляем с учетом gap
  const widthPct = columns > 1 ? `${Math.floor(100 / columns) - 2}%` : '100%';

  return (
    <View style={styles.listContainer}>
      {Array.from({ length: count }).map((_, index) => (
        <View key={index} style={{ width: widthPct as any }}>
           <TravelCardSkeleton />
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: DESIGN_TOKENS.colors.backgroundSecondary,
    // ✅ УЛУЧШЕНИЕ: Более выразительный цвет с легким градиентом
    // ✅ FIX: Анимация применяется через className, а не через inline стили
  },
  card: {
    width: '100%',
    borderRadius: DESIGN_TOKENS.radii.lg,
    backgroundColor: DESIGN_TOKENS.colors.surface,
    overflow: 'hidden',
    marginBottom: 16,
    // ✅ УЛУЧШЕНИЕ: Убрана граница, используется только тень
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
      web: {
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
      },
    }),
  },
  image: {
    marginBottom: 0,
  },
  content: {
    padding: Platform.select({ default: 14, web: 20 }),
    gap: 8,
  },
  marginBottom: {
    marginBottom: 4,
  },
  marginBottomLarge: {
    marginBottom: 12,
  },
  metaRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 8,
  },
  listContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Platform.select({ default: 16, web: 20 }),
    padding: Platform.select({ default: 12, web: 16 }),
  },
});

// CSS анимация для веб (добавить в глобальные стили)
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const styleId = 'skeleton-loader-styles';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      .skeleton-pulse {
        background: linear-gradient(90deg, ${DESIGN_TOKENS.colors.backgroundSecondary} 0%, #e8e7e5 50%, ${DESIGN_TOKENS.colors.backgroundSecondary} 100%);
        background-size: 200% 100%;
        animation: skeleton-pulse 1.5s ease-in-out infinite;
      }
      @keyframes skeleton-pulse {
        0% {
          background-position: 200% 0;
        }
        100% {
          background-position: -200% 0;
        }
      }
      @keyframes pulse {
        0%, 100% {
          opacity: 1;
        }
        50% {
          opacity: 0.6;
        }
      }
    `;
    document.head.appendChild(style);
  }
}

