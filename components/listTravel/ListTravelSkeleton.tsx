import React, { useMemo, useEffect, useRef } from 'react';
import { View, StyleSheet, Platform, useWindowDimensions, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { calculateColumns } from './utils/listTravelHelpers';

// ✅ B4.1: Импорт CSS анимации для web (автоматически игнорируется на native)
if (Platform.OS === 'web') {
  require('./shimmerAnimation.web');
}

// ✅ B4.1: Цвета для shimmer анимации
const SHIMMER_COLORS = {
  base: '#e8e7e5',      // Светло-серый базовый
  highlight: '#f5f5f4', // Светлый для shimmer
  shadow: '#d6d5d3',    // Темнее для контраста
};

// ✅ B4.1: Компонент с shimmer анимацией
function ShimmerPlaceholder({ style, children }: { style?: any; children?: React.ReactNode }) {
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(animatedValue, {
          toValue: 0,
          duration: 1500,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [animatedValue]);

  const opacity = animatedValue.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.3, 0.7, 0.3],
  });

  if (Platform.OS === 'web') {
    // Web: используем CSS анимацию для лучшей производительности
    return (
      <View style={[style, styles.shimmerBase, { overflow: 'hidden' }]}>
        <View style={styles.shimmerGradient} />
        {children}
      </View>
    );
  }

  // Native: используем Animated для shimmer
  return (
    <Animated.View style={[style, { opacity }]}>
      {children || <View style={styles.shimmerBase} />}
    </Animated.View>
  );
}

export default function ListTravelSkeleton() {
    const { width, height } = useWindowDimensions();
    
    const columns = useMemo(() => calculateColumns(width), [width]);
    const isMobile = width < 768;

    const blocks = useMemo(() => {
      // Скелетон должен визуально занимать примерно ту же высоту, что и реальный список,
      // чтобы футер не «уезжал» вниз на пустом экране.
      const searchAndSpacing = isMobile ? 120 : 160; // search + отступы
      const cardApproxHeight = width < 768 ? 320 + 24 : 360 + 24; // карточка + gap
      const available = Math.max(0, height - searchAndSpacing);
      const rows = Math.max(2, Math.ceil(available / cardApproxHeight));
      const count = Math.max(6, rows * Math.max(1, columns));
      return Array.from({ length: count });
    }, [columns, height, isMobile, width]);

    // ✅ B4.1: Адаптивные отступы как в реальных карточках
    const contentPadding = useMemo(() => {
      if (width < 360) return 16;  // XS: компактные устройства
      if (width < 480) return 26; // SM: чуть уже карточки на очень маленьких телефонах
      if (width < 768) return 26; // Mobile: стандартные телефоны — синхронизировано с реальными карточками
      if (width < 1024) return 20;
      if (width < 1440) return 24;
      if (width < 1920) return 32;
      return 40;
    }, [width]);

    const gapSize = useMemo(() => {
      if (width < 360) return 8;
      if (width < 480) return 10;
      if (width < 768) return 12;
      if (width < 1024) return 14;
      return 16;
    }, [width]);

    // ✅ Width-based максимальная ширина skeleton-карточки на web-мобайле
    const mobileCardMaxWidth = useMemo(() => {
      if (width >= 768) return undefined;

      let horizontalPadding = 26;
      if (width < 360) {
        horizontalPadding = 16;
      }

      const availableWidth = width - horizontalPadding * 2;
      const innerMargin = 12;
      const rawWidth = availableWidth - innerMargin * 2;

      const MIN_WIDTH = 280;
      const MAX_WIDTH = 360;

      return Math.max(MIN_WIDTH, Math.min(rawWidth, MAX_WIDTH));
    }, [width]);

    return (
        <View style={styles.wrapper} accessibilityRole="progressbar" accessibilityLabel="Загрузка путешествий">
            {/* Filter Row Skeleton */}
            <View style={[styles.filterRow, isMobile && styles.filterRowMobile]}>
                {!isMobile && (
                  <View style={styles.sidebarSkeleton}>
                     {Array.from({ length: 5 }).map((_, i) => (
                        <ShimmerPlaceholder key={i} style={styles.filterGroupSkeleton} />
                     ))}
                  </View>
                )}
                
                <View style={[styles.mainContentSkeleton, { paddingHorizontal: contentPadding }]}>
                   {/* Search Bar Skeleton */}
                   <ShimmerPlaceholder style={styles.searchBarSkeleton} />

                   {/* Grid Skeleton - точное соответствие реальной сетке */}
                   <View style={[styles.grid, { 
                     columnGap: gapSize, // Горизонтальные отступы между колонками
                     rowGap: width < 768 ? 20 : 24, // Вертикальные отступы между рядами (синхронизировано с ItemSeparator)
                   }]}>
                       {blocks.map((_, index) => (
                           <View 
                             key={`skeleton-${index}`} 
                             style={[
                               styles.cardWrapper,
                               { 
                                 width: columns === 1 ? '100%' : `${(100 / columns) - (gapSize * (columns - 1) / columns)}%`,
                               }
                             ]}
                           >
                               <View
                                 style={[
                                   styles.card,
                                   width < 768 && mobileCardMaxWidth != null && {
                                     // ✅ Ограничиваем ширину skeleton-карточки на основе ширины экрана и центрируем
                                     maxWidth: mobileCardMaxWidth,
                                     alignSelf: 'center',
                                     width: '100%',
                                   },
                                 ]}
                               >
                                   {/* Изображение */}
                                   <ShimmerPlaceholder style={styles.imagePlaceholder} />
                                   
                                   {/* Контент карточки */}
                                   <View style={styles.contentBlock}>
                                       {/* Теги стран */}
                                       <View style={styles.tagsRow}>
                                           <ShimmerPlaceholder style={styles.tag} />
                                           <ShimmerPlaceholder style={[styles.tag, { width: 60 }]} />
                                       </View>
                                       
                                       {/* Заголовок */}
                                       <View style={styles.titleBlock}>
                                           <ShimmerPlaceholder style={styles.titleLine} />
                                           <ShimmerPlaceholder style={[styles.titleLine, { width: '70%' }]} />
                                       </View>
                                       
                                       {/* Мета информация */}
                                       <View style={styles.metaBlock}>
                                           <View style={styles.metaRow}>
                                               <ShimmerPlaceholder style={styles.metaItem} />
                                               <ShimmerPlaceholder style={styles.metaItem} />
                                           </View>
                                       </View>
                                   </View>
                               </View>
                           </View>
                       ))}
                   </View>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    wrapper: {
        flex: 1,
        backgroundColor: '#f5f5f5', // ✅ Светло-серый фон для соответствия дизайну страницы
        width: '100%',
        ...Platform.select({
          web: {
            minHeight: '100vh',
          } as any,
          default: {},
        }),
    },
    filterRow: {
        flexDirection: 'row',
        maxWidth: 1600,
        marginHorizontal: 'auto',
        width: '100%',
        paddingTop: Platform.select({ default: 20, web: 40 }), // ✅ B4.1: Увеличены отступы
        gap: Platform.select({ default: 0, web: 40 }),
    },
    filterRowMobile: {
        flexDirection: 'column',
        paddingTop: 16,
        gap: 20, // ✅ B4.1: Увеличен gap
    },
    sidebarSkeleton: {
        width: Platform.select({ default: 260, web: 300 }),
        paddingLeft: Platform.select({ default: 16, web: 20 }),
        gap: 28, // ✅ B4.1: Увеличен gap
    },
    filterGroupSkeleton: {
        height: 100,
        backgroundColor: SHIMMER_COLORS.base,
        borderRadius: 12,
    },
    mainContentSkeleton: {
        flex: 1,
    },
    searchBarSkeleton: {
        height: 48, // ✅ B4.1: Увеличена высота
        borderRadius: 24,
        backgroundColor: SHIMMER_COLORS.base,
        marginBottom: 40, // ✅ B4.1: Увеличен отступ
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    cardWrapper: {
        // marginBottom удален - отступы создаются через gap в grid (синхронизировано с реальными карточками)
    },
    card: {
        borderRadius: 16, // ✅ Мобильное значение (синхронизировано с реальными карточками)
        backgroundColor: '#ffffff', // ✅ Белый фон как у реальных карточек
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.04)', // ✅ Легкая граница как у реальных карточек
        ...Platform.select({
            ios: {
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.12,
                shadowRadius: 16,
            },
            android: {
                elevation: 4,
            },
            web: {
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
                boxSizing: 'border-box' as any,
            },
        }),
    },
    imagePlaceholder: {
        width: '100%',
        height: 220, // ✅ Фиксированная высота 220px для всех платформ (синхронизировано с реальными карточками)
        backgroundColor: SHIMMER_COLORS.base,
        borderRadius: 16, // ✅ Мобильное значение (в браузере Platform = 'web')
    },
    contentBlock: {
        padding: 12, // ✅ Мобильное значение (в браузере Platform = 'web')
        paddingTop: 10,
        gap: 8, // ✅ Синхронизировано с реальными карточками
    },
    tagsRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 4,
    },
    tag: {
        height: 24,
        width: 80,
        backgroundColor: SHIMMER_COLORS.base,
        borderRadius: 12,
    },
    titleBlock: {
        gap: 6,
        marginBottom: 8,
    },
    titleLine: {
        height: 20, // ✅ B4.1: Высота как у реального заголовка
        width: '100%',
        backgroundColor: SHIMMER_COLORS.base,
        borderRadius: 6,
    },
    metaBlock: {
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: 'rgba(0,0,0,0.06)',
    },
    metaRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 12,
    },
    metaItem: {
        height: 16,
        width: 80,
        backgroundColor: SHIMMER_COLORS.base,
        borderRadius: 8,
    },
    // ✅ B4.1: Shimmer анимация для web
    shimmerBase: {
        backgroundColor: SHIMMER_COLORS.base,
        position: 'relative',
    },
    shimmerGradient: {
        ...Platform.select({
            web: {
                position: 'absolute' as any,
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: `linear-gradient(
                    90deg,
                    transparent 0%,
                    ${SHIMMER_COLORS.highlight} 50%,
                    transparent 100%
                )` as any,
                animation: 'shimmer 2s infinite' as any,
                '@keyframes shimmer': {
                    '0%': { transform: 'translateX(-100%)' },
                    '100%': { transform: 'translateX(100%)' },
                } as any,
            },
        }),
    },
});

