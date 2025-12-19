import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Platform, ViewStyle, StyleProp } from 'react-native';
import { LIGHT_MODERN_DESIGN_TOKENS as TOKENS } from '@/constants/lightModernDesignTokens';
import { BREAKPOINTS, TRAVEL_CARD_IMAGE_HEIGHT, TRAVEL_CARD_WEB_HEIGHT, TRAVEL_CARD_WEB_MOBILE_HEIGHT } from '@/components/listTravel/utils/listTravelConstants';
import { useResponsive } from '@/hooks/useResponsive';

interface SkeletonLoaderProps {
  testID?: string;
  width?: number | string;
  height?: number | string;
  borderRadius?: number;
  style?: any;
}

type SkeletonVariant = 'detailed' | 'reserve';

/**
 * Компонент skeleton loader для улучшения воспринимаемой производительности
 * Показывает placeholder во время загрузки вместо спиннера
 * ✅ УЛУЧШЕНИЕ: Мягкие оттенки с градиентом для лучшей выразительности
 */
export const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({
  testID,
  width = '100%',
  height = 20,
  borderRadius = 4,
  style,
}) => {
  const [reduceMotion, setReduceMotion] = React.useState(false);

  React.useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;

    const media = window.matchMedia('(prefers-reduced-motion: reduce)');

    const update = () => setReduceMotion(!!media.matches);
    update();

    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', update);
      return () => media.removeEventListener('change', update);
    }

    media.addListener(update);
    return () => media.removeListener(update);
  }, []);

  return (
    <View
      testID={testID}
      {...(Platform.OS === 'web' && !reduceMotion ? { className: 'skeleton-pulse' } : {})}
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
  const { width, isPhone, isLargePhone } = useResponsive();
  const isMobile = isPhone || isLargePhone;

  // ✅ FIX: Унифицированная высота изображения с реальными карточками и учетом маленьких экранов
  const imageHeight = TRAVEL_CARD_IMAGE_HEIGHT;
  const titleHeight = Platform.select({ default: 14, web: 16 });
  const metaHeight = Platform.select({ default: 11, web: 12 });

  const cardHeight =
    Platform.OS === 'web'
      ? width > 0 && width < BREAKPOINTS.MOBILE
        ? TRAVEL_CARD_WEB_MOBILE_HEIGHT
        : TRAVEL_CARD_WEB_HEIGHT
      : undefined;
  
  return (
    <View testID="travel-card-skeleton" style={[styles.card, cardHeight != null ? ({ height: cardHeight } as any) : null]}>
      <SkeletonLoader
        testID="travel-card-skeleton-image"
        width="100%"
        height={imageHeight}
        borderRadius={12}
        style={styles.image}
      />
      <View style={styles.content}>
        <SkeletonLoader width="90%" height={titleHeight} style={styles.marginBottom} />
        <SkeletonLoader width="75%" height={titleHeight} style={styles.marginBottomLarge} />
        <View style={styles.metaRow}>
          <SkeletonLoader width="30%" height={metaHeight} />
          <SkeletonLoader width="25%" height={metaHeight} />
        </View>
      </View>
    </View>
  );
};

export const TravelCardReserveSkeleton: React.FC = () => {
  const { width } = useResponsive();

  const effectiveWidth =
    Platform.OS === 'web' && width === 0 && typeof window !== 'undefined' ? window.innerWidth : width;

  const cardHeight =
    Platform.OS === 'web'
      ? effectiveWidth > 0 && effectiveWidth < BREAKPOINTS.MOBILE
        ? TRAVEL_CARD_WEB_MOBILE_HEIGHT
        : TRAVEL_CARD_WEB_HEIGHT
      : 320;

  return (
    <View testID="travel-card-skeleton" style={[styles.card, { height: cardHeight } as any]}>
      <SkeletonLoader testID="travel-card-skeleton-image" width="100%" height={cardHeight} borderRadius={12} />
    </View>
  );
};

/**
 * Skeleton для списка путешествий
 */
export const TravelListSkeleton: React.FC<{
  count?: number;
  columns?: number;
  rowStyle?: StyleProp<ViewStyle>;
  variant?: SkeletonVariant;
}> = ({ count = 6, columns = 1, rowStyle, variant = 'detailed' }) => {
  const isWeb = Platform.OS === 'web';
  const itemsCount = Math.max(0, count ?? 0);

  if (itemsCount === 0) {
    return null;
  }

  // На web делаем сетку по колонкам, чтобы скелетоны совпадали с реальными карточками
  if (isWeb) {
    const cols = Math.max(1, columns || 1);

    // Important: match real card slot sizing used in listTravel/RightColumn.tsx
    // Real cards on desktop use flexBasis/minWidth/maxWidth (not percentage width).
    const itemContainerStyle =
      cols <= 1
        ? ({
            flex: 1,
            width: '100%',
            maxWidth: '100%',
            minWidth: 0,
            flexBasis: '100%',
          } as any)
        : ({
            flexGrow: 0,
            flexShrink: 0,
            flexBasis: 320,
            minWidth: 320,
            maxWidth: 360,
          } as any);

    const rowsCount = Math.ceil(itemsCount / cols);

    return (
      <>
        {Array.from({ length: rowsCount }).map((_, rowIndex) => (
          <View
            key={`skeleton-row-${rowIndex}`}
            style={[rowStyle, { flexDirection: 'row', flexWrap: 'nowrap' } as any]}
          >
            {Array.from({ length: cols }).map((__, colIndex) => {
              const index = rowIndex * cols + colIndex;
              if (index >= itemsCount) return null;
              return (
                <View key={`skeleton-${rowIndex}-${colIndex}`} style={itemContainerStyle}>
                  {variant === 'reserve' ? <TravelCardReserveSkeleton /> : <TravelCardSkeleton />}
                </View>
              );
            })}
          </View>
        ))}
      </>
    );
  }

  // На native оставляем простой вертикальный список
  return (
    <>
      {Array.from({ length: itemsCount }).map((_, index) => (
        variant === 'reserve' ? <TravelCardReserveSkeleton key={index} /> : <TravelCardSkeleton key={index} />
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
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 10,
    gap: 4,
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
