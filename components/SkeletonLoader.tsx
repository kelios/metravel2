import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { LIGHT_MODERN_DESIGN_TOKENS as TOKENS } from '@/constants/lightModernDesignTokens';

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
 * ✅ ИСПРАВЛЕНИЕ: Высоты должны совпадать с реальными карточками
 */
export const TravelCardSkeleton: React.FC = () => {
  // ✅ FIX: Унифицированная высота изображения с реальными карточками и учетом маленьких экранов
  const imageHeight = 220;
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
  const isWeb = Platform.OS === 'web';

  // На web делаем сетку по колонкам, чтобы скелетоны совпадали с реальными карточками
  if (isWeb) {
    const itemWidth = `${100 / columns}%`;

    return (
      <>
        {Array.from({ length: count }).map((_, index) => (
          <View key={index} style={{ width: itemWidth } as any}>
            <TravelCardSkeleton />
          </View>
        ))}
      </>
    );
  }

  // На native оставляем простой вертикальный список
  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <TravelCardSkeleton key={index} />
      ))}
    </>
  );
};

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: TOKENS.colors.skeleton,
    // Современные скелетоны - очень светлые
  },

  // Современная карточка скелетона
  card: {
    width: '100%',
    maxWidth: '100%',
    borderRadius: TOKENS.radii.lg,
    backgroundColor: TOKENS.colors.surface,
    overflow: 'hidden',
    // Высота теперь определяется содержимым, чтобы совпадать с реальной карточкой
    borderWidth: Platform.OS === 'web' ? 1 : 0,
    borderColor: TOKENS.colors.border,
    // Минимальные тени
    ...(Platform.OS === 'web'
      ? { boxShadow: TOKENS.shadows.subtle } as any
      : TOKENS.shadowsNative.subtle
    ),
  },

  image: {
    marginBottom: 0,
  },

  // Упрощенный контент скелетона
  content: {
    padding: TOKENS.card.padding.desktop,
    gap: TOKENS.card.gap,
    backgroundColor: TOKENS.colors.surface,
  },

  marginBottom: {
    marginBottom: TOKENS.spacing.xs,
  },

  marginBottomLarge: {
    marginBottom: TOKENS.spacing.sm,
  },

  // Упрощенная мета-информация скелетона
  metaRow: {
    flexDirection: 'row',
    gap: TOKENS.spacing.md,
    marginTop: TOKENS.spacing.sm,
  },

  // Упрощенный контейнер списка
  listContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Platform.select({ default: TOKENS.spacing.md, web: TOKENS.spacing.lg }),
    padding: Platform.select({ default: TOKENS.spacing.md, web: TOKENS.spacing.lg }),
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
        background: linear-gradient(90deg, ${TOKENS.colors.skeleton} 0%, ${TOKENS.colors.skeletonHighlight} 50%, ${TOKENS.colors.skeleton} 100%);
        background-size: 200% 100%;
        animation: skeleton-pulse 2s ease-in-out infinite;
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

