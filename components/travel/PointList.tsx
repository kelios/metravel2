// components/travel/PointList.tsx
import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  Linking,
  Platform,
  Pressable,
  Text,
  FlatList,
  ListRenderItemInfo,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Feather } from '@expo/vector-icons';
// ✅ УЛУЧШЕНИЕ: Импорт утилит для оптимизации изображений
import { optimizeImageUrl, buildVersionedImageUrl, getOptimalImageSize } from '@/utils/imageOptimization';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { globalFocusStyles } from '@/styles/globalFocus'; // ✅ ИСПРАВЛЕНИЕ: Импорт focus-стилей
import PopupContentComponent from '@/components/MapPage/PopupContentComponent';
import { useResponsive } from '@/hooks/useResponsive';
import ImageCardMedia from '@/components/ui/ImageCardMedia';
import { useThemedColors } from '@/hooks/useTheme'; // ✅ РЕДИЗАЙН: Темная тема

type Point = {
  id: string;
  travelImageThumbUrl?: string;
  updated_at?: string;
  address: string;
  coord: string;
  categoryName?: string;
  description?: string;
};

type PointListProps = { points: Point[]; baseUrl?: string };

type Responsive = {
  imageMinHeight: number;
  titleSize: number;
  coordSize: number;
  aspectRatio?: number;
};

/* ---------------- helpers ---------------- */

// ✅ УЛУЧШЕНИЕ: Используем новые утилиты для оптимизации изображений
const getOptimizedImageUrl = (url?: string, updatedAt?: string) => {
  if (!url) return undefined;
  
  // Создаем версионированный URL
  const versionedUrl = buildVersionedImageUrl(url, updatedAt);
  
  // Оптимальный размер для изображений точек на карте (960x640 для десктопа)
  const optimalSize = getOptimalImageSize(960, 640);
  
  return optimizeImageUrl(versionedUrl, {
    width: optimalSize.width,
    height: optimalSize.height,
    format: 'webp',
    quality: 82,
    fit: 'cover',
  }) || versionedUrl;
};

const parseCoord = (coordStr: string): { lat: number; lon: number } | null => {
  if (!coordStr) return null;
  const cleaned = coordStr.replace(/;/g, ',').replace(/\s+/g, '');
  const [latStr, lonStr] = cleaned.split(',').map((s) => s.trim());
  const lat = Number(latStr);
  const lon = Number(lonStr);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return { lat, lon };
};

const buildMapUrl = (coordStr: string) => {
  const p = parseCoord(coordStr);
  if (!p) return '';
  const { lat, lon } = p;
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;
};

const openExternal = async (url: string) => {
  try {
    const can = await Linking.canOpenURL(url);
    if (can) await Linking.openURL(url);
  } catch (error) {
    // ✅ FIX-009: Логируем ошибки открытия ссылок (не критично)
    if (__DEV__) {
      const { devWarn } = require('@/src/utils/logger');
      devWarn('Error opening URL:', error);
    }
  }
};

// ✅ РЕДИЗАЙН: Компонент удален - заменен на встроенные кнопки в карточке

/* ---------------- card ---------------- */

const PointCard = React.memo(function PointCard({
                                                  point,
                                                  isMobile,
                                                  responsive,
                                                  onCopy,
                                                  onShare,
                                                  onOpenMap,
                                                  colors,
                                                  styles,
                                                }: {
  point: Point;
  isMobile: boolean;
  responsive: Responsive;
  onCopy: (coordStr: string) => void;
  onShare: (coordStr: string) => void;
  onOpenMap: (coordStr: string) => void;
  colors: ReturnType<typeof useThemedColors>;
  styles: ReturnType<typeof createStyles>;
}) {
  const [hovered, setHovered] = useState(false);
  const [imageError, setImageError] = useState(false);
  const imgUri = getOptimizedImageUrl(point.travelImageThumbUrl, point.updated_at);

  const openMapFromLink = useCallback(() => onOpenMap(point.coord), [onOpenMap, point.coord]);
  const showActions = isMobile || hovered;
  
  const handleImageError = useCallback(() => {
    setImageError(true);
  }, []);

  return (
    <View
      style={styles.card}
      {...(Platform.OS === 'web'
        ? ({
            onMouseEnter: () => !isMobile && setHovered(true),
            onMouseLeave: () => !isMobile && setHovered(false),
          } as any)
        : null)}
    >
      <Pressable 
        onPress={openMapFromLink} 
        style={[styles.cardPressable, globalFocusStyles.focusable]} // ✅ ИСПРАВЛЕНИЕ: Добавлен focus-индикатор
        accessibilityRole="button"
        accessibilityLabel={`Открыть место: ${point.address}`}
      >
        <View 
          style={[
            styles.imageWrap,
            { 
              height: responsive.imageMinHeight,
            }
          ]}
        >
          {imgUri && !imageError ? (
            <ImageCardMedia
              src={imgUri}
              alt={point.address}
              fit="contain"
              blurBackground
              blurRadius={16}
              priority="low"
              loading={Platform.OS === 'web' ? 'lazy' : 'lazy'}
              onError={handleImageError}
              style={StyleSheet.absoluteFill}
            />
          ) : (
            <View style={[styles.noImage, { minHeight: responsive.imageMinHeight }]}>
              <Feather name="map" size={48} color={colors.textOnPrimary} />
              <Text style={styles.noImageText} numberOfLines={3}>
                {point.address}
              </Text>
            </View>
          )}

          {/* ✅ РЕДИЗАЙН: Современные кнопки действий */}
          {showActions && (
            <View
              style={[
                styles.actionsWrap,
                { pointerEvents: 'box-none' } as any,
              ]}
            >
              <View style={styles.actionsRow}>
                <Pressable
                  style={styles.actionBtn}
                  onPress={(e) => {
                    e.stopPropagation();
                    openMapFromLink();
                  }}
                  accessibilityLabel="Открыть в картах"
                  accessibilityRole="button"
                >
                  <Feather name="external-link" size={18} color={colors.textOnDark} />
                </Pressable>
                <Pressable
                  style={styles.actionBtn}
                  onPress={(e) => {
                    e.stopPropagation();
                    onCopy(point.coord);
                  }}
                  accessibilityLabel="Скопировать координаты"
                  accessibilityRole="button"
                >
                  <Feather name="copy" size={18} color={colors.textOnDark} />
                </Pressable>
                <Pressable
                  style={styles.actionBtn}
                  onPress={(e) => {
                    e.stopPropagation();
                    onShare(point.coord);
                  }}
                  accessibilityLabel="Поделиться"
                  accessibilityRole="button"
                >
                  <Feather name="send" size={18} color={colors.textOnDark} />
                </Pressable>
              </View>
            </View>
          )}

          {/* Нижний оверлей в том же стиле, что и попап */}
          <View style={styles.overlayBottom}>
            <Text
              style={[styles.overlayTitle, { fontSize: responsive.titleSize }]}
              numberOfLines={2}
            >
              {point.address}
            </Text>

            <Pressable
              style={[styles.overlayCoordRow, globalFocusStyles.focusable]}
              onPress={(e) => {
                e.stopPropagation();
                openMapFromLink();
              }}
              accessibilityLabel={`Координаты: ${point.coord}`}
              accessibilityRole="button"
            >
              <Feather name="map-pin" size={14} color={colors.textOnDark} />
              <Text
                style={[styles.overlayCoordText, { fontSize: responsive.coordSize }]}
                numberOfLines={1}
              >
                {point.coord}
              </Text>
            </Pressable>

            {!!point.categoryName && (
              <View style={styles.overlayCategoryRow}>
                <View style={styles.overlayCategoryChip}>
                  <Text style={styles.overlayCategoryText} numberOfLines={1}>
                    {point.categoryName.split(',')[0]?.trim()}
                  </Text>
                </View>
              </View>
            )}
          </View>
        </View>
      </Pressable>
    </View>
  );
});

/* ---------------- list ---------------- */

const PointList: React.FC<PointListProps> = ({ points, baseUrl }) => {
  const colors = useThemedColors(); // ✅ РЕДИЗАЙН: Темная тема
  const safePoints = useMemo(() => (Array.isArray(points) ? points : []), [points]);
  const { width, isPhone, isLargePhone, isTablet } = useResponsive();
  const isMobile = isPhone || isLargePhone;
  const isLargeDesktop = width >= 1440;

  const [showList, setShowList] = useState(false);

  // ✅ УЛУЧШЕНИЕ: Мемоизация стилей с динамическими цветами
  const styles = useMemo(() => createStyles(colors), [colors]);

  // ✅ УЛУЧШЕНИЕ: Пропорциональные карточки с фиксированным aspect ratio
  const responsive: Responsive = useMemo(
    () => {
      const aspectRatio = 4 / 3;

      let imageMinHeight = 240; // мобильные по умолчанию
      if (isLargeDesktop) {
        imageMinHeight = 400;
      } else if (width >= 1200) {
        imageMinHeight = 360;
      } else if (width >= 1024) {
        imageMinHeight = 320;
      } else if (width >= 768) {
        imageMinHeight = 280;
      } else if (width >= 640) {
        imageMinHeight = 260;
      } else {
        imageMinHeight = 240;
      }

      let titleSize = 14;
      if (isLargeDesktop) {
        titleSize = 19;
      } else if (width >= 1200) {
        titleSize = 18;
      } else if (width >= 1024) {
        titleSize = 17;
      } else if (width >= 768) {
        titleSize = 16;
      } else if (width >= 640) {
        titleSize = 15;
      } else {
        titleSize = 14;
      }

      const coordSize = isMobile ? 12 : isTablet ? 13 : 14;

      return {
        imageMinHeight,
        titleSize,
        coordSize,
        aspectRatio, // Добавляем aspect ratio
      };
    },
    [isMobile, isTablet, isLargeDesktop, width]
  );

  const onCopy = useCallback(async (coordStr: string) => {
    try {
      if (Platform.OS === 'web' && (navigator as any)?.clipboard) {
        await (navigator as any).clipboard.writeText(coordStr);
      } else {
        await Clipboard.setStringAsync(coordStr);
      }
    } catch {
      // ignore clipboard failures
    }
  }, []);

  // ✅ исправленный Telegram share
  const onShare = useCallback(async (coordStr: string) => {
    const mapUrl = buildMapUrl(coordStr);
    const text = `📍 Координаты: ${coordStr}`;

    // 1) пытаемся открыть приложение Telegram
    const tgDeepLinks = [
      `tg://msg_url?url=${encodeURIComponent(mapUrl)}&text=${encodeURIComponent(text)}`,
      `tg://share?text=${encodeURIComponent(`${text}\n${mapUrl}`)}`,
    ];

    for (const deeplink of tgDeepLinks) {
      try {
        const can = await Linking.canOpenURL(deeplink);
        if (can) {
          await Linking.openURL(deeplink);
          return;
        }
      } catch {
        // ignore deep link failures
      }
    }

    // 2) веб-фолбэк
    const webShare = `https://t.me/share/url?url=${encodeURIComponent(mapUrl)}&text=${encodeURIComponent(text)}`;
    openExternal(webShare);
  }, []);

  const onOpenMap = useCallback((coordStr: string) => {
    const url = buildMapUrl(coordStr);
    if (url) openExternal(url);
  }, []);

  // ✅ УЛУЧШЕНИЕ: Более плавные переходы между количеством колонок
  const numColumns = useMemo(() => {
    if (width >= 1024) return 2; // Десктопы и большие экраны: 2 колонки, чтобы карточки были крупнее
    if (width >= 768) return 2;  // Планшеты: 2 колонки
    return 1; // Мобильные: одна карточка в ряд
  }, [width]);

  const keyExtractor = useCallback((item: Point) => item.id, []);
  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<Point>) => (
      <View
        style={[
          styles.col,
          numColumns === 2 ? styles.col2 : styles.col1,
        ]}
      >
        {Platform.OS === 'web' ? (
          <div style={{ padding: DESIGN_TOKENS.spacing.sm, width: '100%' }}>
            <PopupContentComponent
              travel={{
                address: item.address,
                coord: item.coord,
                travelImageThumbUrl: item.travelImageThumbUrl,
                updated_at: item.updated_at,
                categoryName: item.categoryName,
                description: item.description,
                articleUrl: baseUrl,
                urlTravel: baseUrl,
              }}
            />
          </div>
        ) : (
          <PointCard
            point={item}
            isMobile={isMobile}
            responsive={responsive}
            onCopy={onCopy}
            onShare={onShare}
            onOpenMap={onOpenMap}
            colors={colors}
            styles={styles}
          />
        )}
      </View>
    ),
    [baseUrl, colors, isMobile, numColumns, onCopy, onOpenMap, onShare, responsive, styles]
  );

  return (
    <View style={styles.wrapper}>
      <Pressable
        onPress={() => setShowList((p) => !p)}
        style={({ pressed }) => [styles.toggle, pressed && styles.togglePressed, globalFocusStyles.focusable]} // ✅ ИСПРАВЛЕНИЕ: Добавлен focus-индикатор
        accessibilityRole="button"
        accessibilityLabel={showList ? 'Скрыть координаты мест' : 'Показать координаты мест'}
        accessibilityState={{ expanded: showList }}
      >
        <View style={styles.toggleRow}>
          {[
            <Feather key="icon" name="map-pin" size={22} color={colors.text} />,
            <Text key="text" style={[styles.toggleText, isMobile && styles.toggleTextSm]}>
              {showList ? 'Скрыть координаты мест' : 'Показать координаты мест'}
            </Text>,
            showList ? (
              <Feather key="chevron" name="chevron-up" size={18} color={colors.text} />
            ) : (
              <Feather key="chevron" name="chevron-down" size={18} color={colors.text} />
            ),
          ]}
        </View>
      </Pressable>

      {showList && (
        <FlatList
          key={`cols-${numColumns}`}            // ← фикс "Changing numColumns..."
          data={safePoints}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          numColumns={numColumns}
          removeClippedSubviews={Platform.OS !== 'web'}
          windowSize={7}
          initialNumToRender={numColumns * 3}
          maxToRenderPerBatch={numColumns * 3}
          updateCellsBatchingPeriod={16}
          contentContainerStyle={styles.listContent}
          columnWrapperStyle={numColumns > 1 ? styles.columnWrap : undefined}
        />
      )}
    </View>
  );
};

export default React.memo(PointList);

// ✅ УЛУЧШЕНИЕ: CSS анимация для градиента placeholder (только для web)
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const styleId = 'point-list-gradient-animation';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      @keyframes gradientShift {
        0% {
          background-position: 0% 50%;
        }
        50% {
          background-position: 100% 50%;
        }
        100% {
          background-position: 0% 50%;
        }
      }
    `;
    document.head.appendChild(style);
  }
}

/* ============================= styles ============================= */

// ✅ УЛУЧШЕНИЕ: Функция создания стилей с динамическими цветами для поддержки тем
const createStyles = (colors: ReturnType<typeof useThemedColors>) => StyleSheet.create<any>({
  wrapper: { width: '100%', marginTop: DESIGN_TOKENS.spacing.lg },

  // ✅ ИСПРАВЛЕНИЕ: Современная кнопка переключения с улучшенной интерактивностью и единой палитрой
  toggle: {
    backgroundColor: colors.surface, // ✅ ДИЗАЙН: Динамический цвет фона
    borderRadius: DESIGN_TOKENS.radii.md, // ✅ ИСПРАВЛЕНИЕ: Используем единый радиус
    borderWidth: 1.5,
    borderColor: colors.border, // ✅ ДИЗАЙН: Динамический цвет границы
    marginBottom: DESIGN_TOKENS.spacing.md,
    shadowColor: colors.shadows.medium.shadowColor,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
    minHeight: 48, // ✅ ИСПРАВЛЕНИЕ: Минимальная высота для touch-целей
    ...Platform.select({
      web: {
        transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        cursor: 'pointer' as any,
        ':hover': {
          borderColor: colors.primary, // ✅ ДИЗАЙН: Динамический цвет границы
          shadowOpacity: 0.12,
          shadowRadius: 14,
          transform: 'translateY(-1px)',
          backgroundColor: colors.primarySoft, // ✅ ДИЗАЙН: Динамический цвет фона
        } as any,
        ':active': {
          transform: 'translateY(0)',
        } as any,
      },
    }),
  },
  togglePressed: { 
    backgroundColor: colors.primarySoft, // ✅ ДИЗАЙН: Динамический цвет фона
    borderColor: colors.primary, // ✅ ДИЗАЙН: Динамический цвет границы
    transform: [{ scale: 0.98 }],
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: DESIGN_TOKENS.spacing.md,
    paddingVertical: DESIGN_TOKENS.spacing.lg,
    paddingHorizontal: DESIGN_TOKENS.spacing.xl,
  },
  toggleText: { 
    fontSize: DESIGN_TOKENS.typography.sizes.md, 
    fontWeight: '600', 
    color: colors.text, // ✅ ДИЗАЙН: Динамический цвет текста
    letterSpacing: -0.3,
  },
  toggleTextSm: { 
    fontSize: DESIGN_TOKENS.typography.sizes.md,
    letterSpacing: -0.2,
  },

  listContent: { 
    paddingBottom: DESIGN_TOKENS.spacing.xxl,
    paddingHorizontal: Platform.select({
      web: 0,
      default: 8,
    }),
  },
  columnWrap: { 
    justifyContent: 'flex-start',
    alignItems: 'stretch',
    gap: DESIGN_TOKENS.spacing.md,
    ...Platform.select({
      web: {
        paddingHorizontal: 0,
        display: 'flex' as any,
        flexDirection: 'row' as any,
      },
    }),
  },

  // ✅ УЛУЧШЕНИЕ: Адаптивные колонки с одинаковой высотой карточек
  col: { 
    marginBottom: DESIGN_TOKENS.spacing.md,
    ...Platform.select({
      web: {
        display: 'flex' as any,
        flexDirection: 'column' as any,
        height: '100%',
      },
    }),
  },
  col2: { 
    width: Platform.select({
      web: 'calc(50% - 10px)' as any,
      default: '48%',
    }),
  },
  col1: { 
    width: '100%' 
  },

  // ✅ УЛУЧШЕНИЕ: Матовая карточка без границ, только тени
  card: {
    backgroundColor: colors.surface, // ✅ ДИЗАЙН: Динамический цвет фона
    borderRadius: DESIGN_TOKENS.radii.lg,
    overflow: 'hidden',
    shadowColor: colors.shadows.medium.shadowColor,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    // ✅ УЛУЧШЕНИЕ: Убрана граница, используется только тень
    display: 'flex' as any,
    flexDirection: 'column' as any,
    ...Platform.select({
      web: {
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        height: '100%',
        boxShadow: DESIGN_TOKENS.shadows.card,
        ':hover': {
          transform: 'translateY(-4px)',
          boxShadow: DESIGN_TOKENS.shadows.hover,
        } as any,
        ':active': {
          transform: 'translateY(-1px)',
          boxShadow: DESIGN_TOKENS.shadows.medium,
        } as any,
      },
    }),
  },
  cardPressable: { 
    flex: 1,
    ...Platform.select({
      web: {
        cursor: 'pointer' as any,
      },
    }),
  },

  imageWrap: { 
    position: 'relative', 
    width: '100%',
    overflow: 'hidden',
    backgroundColor: colors.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: { 
    width: '100%',
    height: '100%',
    display: 'block',
    backgroundColor: colors.backgroundTertiary,
    ...Platform.select({
      web: {
        objectFit: 'contain' as any,
        transition: 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
      },
      default: {
        resizeMode: 'contain' as any,
      },
    }),
  },

  // ✅ УЛУЧШЕНИЕ: Улучшенный placeholder с градиентом и лучшей типографикой
  noImage: {
    width: '100%',
    ...Platform.select({
      default: {
        backgroundColor: colors.primary,
      },
      web: {
        backgroundColor: 'transparent',
        backgroundImage:
          (colors.gradients as any)?.primary ??
          `linear-gradient(135deg, ${colors.primary} 0%, ${colors.primaryDark} 50%, ${colors.primary} 100%)` as any,
        backgroundSize: '200% 200%',
        // ✅ ИСПРАВЛЕНИЕ: animation убрано из StyleSheet, используется CSS через style элемент
      },
    }),
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    paddingVertical: 40,
    paddingHorizontal: DESIGN_TOKENS.spacing.xl,
    minHeight: 240,
  },
  noImageText: {
    marginTop: DESIGN_TOKENS.spacing.lg,
    maxWidth: '85%',
    textAlign: 'center',
    color: colors.textOnPrimary,
    fontWeight: '700',
    fontSize: DESIGN_TOKENS.typography.sizes.md,
    lineHeight: 22,
    textShadow: '0 2px 8px rgba(0,0,0,0.2)',
    letterSpacing: -0.2,
  },

  // ✅ УЛУЧШЕНИЕ: Современные кнопки действий с улучшенной видимостью
  actionsWrap: { 
    position: 'absolute', 
    top: 12, 
    right: 12,
    zIndex: 10,
  },
  actionsRow: { 
    flexDirection: 'row', 
    gap: DESIGN_TOKENS.spacing.xs,
    backgroundColor: colors.overlay,
    borderRadius: 14,
    padding: 5,
    ...Platform.select({
      web: {
        backdropFilter: 'blur(12px) saturate(180%)',
        WebkitBackdropFilter: 'blur(12px) saturate(180%)',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      },
    }),
  },
  actionBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.overlayLight,
    ...Platform.select({
      web: {
        transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        cursor: 'pointer' as any,
        ':hover': {
          backgroundColor: colors.primary,
          transform: 'scale(1.15) rotate(5deg)',
          boxShadow: (colors.boxShadows as any)?.medium ?? '0 4px 12px rgba(0,0,0,0.2)',
        } as any,
        ':active': {
          transform: 'scale(1.05)',
        } as any,
      },
    }),
  },

  // Нижний оверлей в том же стиле, что и попап/TravelTmlRound
  overlayBottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 12,
    paddingVertical: DESIGN_TOKENS.spacing.sm,
    backgroundColor: colors.overlay,
    flexDirection: 'column',
    gap: DESIGN_TOKENS.spacing.xs,
  },
  overlayTitle: {
    color: colors.textOnDark,
    fontWeight: '700',
    lineHeight: 20,
    letterSpacing: -0.3,
  },
  overlayCoordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DESIGN_TOKENS.spacing.xs,
    alignSelf: 'flex-start',
    paddingHorizontal: DESIGN_TOKENS.spacing.sm,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: colors.overlayLight,
  },
  overlayCoordText: {
    color: colors.textOnDark,
    fontWeight: '600',
    fontFamily: Platform.select({
      web: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
      default: undefined,
    }),
    letterSpacing: 0.3,
  },
  overlayCategoryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: DESIGN_TOKENS.spacing.xs,
    marginTop: DESIGN_TOKENS.spacing.xxs,
  },
  overlayCategoryChip: {
    paddingHorizontal: DESIGN_TOKENS.spacing.sm,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: colors.overlayLight,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  overlayCategoryText: {
    color: colors.textOnDark,
    fontSize: DESIGN_TOKENS.typography.sizes.xs,
    fontWeight: '600',
  },
});
