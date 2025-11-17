// components/travel/PointList.tsx
import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Platform,
  useWindowDimensions,
  Pressable,
  Text,
  FlatList,
  ListRenderItemInfo,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Image as ExpoImage } from 'expo-image';
import {
  MapPinned,
  ChevronUp,
  ChevronDown,
  Copy,
  Send,
  Map,
  Link as LinkIcon,
} from 'lucide-react-native';
// ✅ УЛУЧШЕНИЕ: Импорт утилит для оптимизации изображений
import { optimizeImageUrl, buildVersionedImageUrl, getOptimalImageSize } from '@/utils/imageOptimization';

type Point = {
  id: string;
  travelImageThumbUrl?: string;
  updated_at?: string;
  address: string;
  coord: string;
  categoryName?: string;
  description?: string;
};

type PointListProps = { points: Point[] };

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
  } catch {}
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
                                                }: {
  point: Point;
  isMobile: boolean;
  responsive: Responsive;
  onCopy: (coordStr: string) => void;
  onShare: (coordStr: string) => void;
  onOpenMap: (coordStr: string) => void;
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
      onMouseEnter={() => !isMobile && setHovered(true)}
      onMouseLeave={() => !isMobile && setHovered(false)}
    >
      <Pressable 
        onPress={openMapFromLink} 
        style={styles.cardPressable}
        accessibilityRole="button"
        accessibilityLabel={`Открыть место: ${point.address}`}
      >
        <View 
          style={[
            styles.imageWrap, 
            { 
              minHeight: responsive.imageMinHeight,
              ...(responsive.aspectRatio && Platform.OS === 'web' ? {
                aspectRatio: responsive.aspectRatio,
              } : {}),
            }
          ]}
        >
          {imgUri && !imageError ? (
            <ExpoImage
              source={{ uri: imgUri }}
              style={styles.image}
              contentFit="cover"
              cachePolicy="memory-disk"
              transition={120}
              priority="low"
              onError={handleImageError}
            />
          ) : (
            <View style={[styles.noImage, { minHeight: responsive.imageMinHeight }]}>
              <Map size={48} color="#fff" />
              <Text style={styles.noImageText} numberOfLines={3}>
                {point.address}
              </Text>
            </View>
          )}

          {/* ✅ РЕДИЗАЙН: Современные кнопки действий */}
          {showActions && (
            <View pointerEvents="box-none" style={styles.actionsWrap}>
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
                  <LinkIcon size={18} color="#fff" />
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
                  <Copy size={18} color="#fff" />
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
                  <Send size={18} color="#fff" />
                </Pressable>
              </View>
            </View>
          )}

          {/* ✅ РЕДИЗАЙН: Информационная панель - всегда видима, но улучшенная */}
          <View style={styles.infoPanel}>
            <View style={styles.infoContent}>
              {/* Заголовок */}
              <Text 
                style={[styles.addressText, { fontSize: responsive.titleSize }]} 
                numberOfLines={2}
              >
                {point.address}
              </Text>

              {/* Координаты */}
              <Pressable 
                style={styles.coordButton}
                onPress={(e) => {
                  e.stopPropagation();
                  openMapFromLink();
                }}
                accessibilityLabel={`Координаты: ${point.coord}`}
                accessibilityRole="button"
              >
                <MapPinned size={14} color="#fff" />
                <Text style={[styles.coordText, { fontSize: responsive.coordSize }]} numberOfLines={1}>
                  {point.coord}
                </Text>
              </Pressable>

              {/* Категория */}
              {!!point.categoryName && (
                <View style={styles.categoryBadge}>
                  <Text style={styles.categoryText} numberOfLines={1}>
                    {point.categoryName.split(',')[0]?.trim()}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>
      </Pressable>
    </View>
  );
});

/* ---------------- list ---------------- */

const PointList: React.FC<PointListProps> = ({ points }) => {
  const safePoints = useMemo(() => (Array.isArray(points) ? points : []), [points]);
  const { width } = useWindowDimensions();
  // ✅ УЛУЧШЕНИЕ: Более точные брейкпоинты для адаптивности
  const isMobile = width < 640;
  const isTablet = width >= 640 && width < 1024;
  const isDesktop = width >= 1024;
  const isLargeDesktop = width >= 1440;

  const [showList, setShowList] = useState(false);

  // ✅ УЛУЧШЕНИЕ: Пропорциональные карточки с фиксированным aspect ratio
  const responsive: Responsive = useMemo(
    () => {
      // Используем aspect ratio вместо фиксированной высоты для пропорциональности
      // Aspect ratio 4:3 (1.33) - стандартное соотношение для карточек
      const aspectRatio = 4 / 3;
      
      // Адаптивная высота изображения (будет вычисляться на основе ширины и aspect ratio)
      // Но оставляем минимальную высоту для мобильных
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

      // Адаптивный размер заголовка
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

      // Адаптивный размер координат
      const coordSize = isMobile ? 12 : isTablet ? 13 : 14;

      return {
        imageMinHeight,
        titleSize,
        coordSize,
        aspectRatio, // Добавляем aspect ratio
      };
    },
    [isMobile, isTablet, isDesktop, isLargeDesktop, width]
  );

  const onCopy = useCallback(async (coordStr: string) => {
    try {
      if (Platform.OS === 'web' && (navigator as any)?.clipboard) {
        await (navigator as any).clipboard.writeText(coordStr);
      } else {
        await Clipboard.setStringAsync(coordStr);
      }
    } catch {}
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
      } catch {}
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
    if (width >= 1440) return 3; // Большие десктопы
    if (width >= 1024) return 3; // Десктопы
    if (width >= 768) return 2;  // Планшеты
    return 1; // Мобильные
  }, [width]);

  const keyExtractor = useCallback((item: Point) => item.id, []);
  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<Point>) => (
      <View
        style={[
          styles.col,
          numColumns === 3 ? styles.col3 : numColumns === 2 ? styles.col2 : styles.col1,
        ]}
      >
        <PointCard
          point={item}
          isMobile={isMobile}
          responsive={responsive}
          onCopy={onCopy}
          onShare={onShare}
          onOpenMap={onOpenMap}
        />
      </View>
    ),
    [isMobile, numColumns, onCopy, onOpenMap, onShare, responsive]
  );

  return (
    <View style={styles.wrapper}>
      <Pressable
        onPress={() => setShowList((p) => !p)}
        style={({ pressed }) => [styles.toggle, pressed && styles.togglePressed]}
      >
        <View style={styles.toggleRow}>
          <MapPinned size={22} color="#334155" />
          <Text style={[styles.toggleText, isMobile && styles.toggleTextSm]}>
            {showList ? 'Скрыть координаты мест' : 'Показать координаты мест'}
          </Text>
          {showList ? <ChevronUp size={18} color="#334155" /> : <ChevronDown size={18} color="#334155" />}
        </View>
      </Pressable>

      {showList && (
        <FlatList
          key={`cols-${numColumns}`}            // ← фикс "Changing numColumns..."
          data={safePoints}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          numColumns={numColumns}
          removeClippedSubviews
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

const styles = StyleSheet.create({
  wrapper: { width: '100%', marginTop: 16 },

  // ✅ УЛУЧШЕНИЕ: Современная кнопка переключения с улучшенной интерактивностью
  toggle: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.08)',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
    ...Platform.select({
      web: {
        transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        cursor: 'pointer' as any,
        ':hover': {
          borderColor: '#ff9f5a',
          shadowOpacity: 0.12,
          shadowRadius: 14,
          transform: 'translateY(-1px)',
          backgroundColor: '#fffefb',
        } as any,
        ':active': {
          transform: 'translateY(0)',
        } as any,
      },
    }),
  },
  togglePressed: { 
    backgroundColor: '#fffefb',
    borderColor: '#ff9f5a',
    transform: [{ scale: 0.98 }],
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  toggleText: { 
    fontSize: 16, 
    fontWeight: '600', 
    color: '#1f2937',
    letterSpacing: -0.3,
  },
  toggleTextSm: { 
    fontSize: 15,
    letterSpacing: -0.2,
  },

  listContent: { 
    paddingBottom: 28,
    paddingHorizontal: Platform.select({
      web: 0,
      default: 8,
    }),
  },
  columnWrap: { 
    justifyContent: 'flex-start',
    alignItems: 'stretch',
    gap: 20,
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
    marginBottom: 20,
    ...Platform.select({
      web: {
        display: 'flex' as any,
        flexDirection: 'column' as any,
        height: '100%',
      },
    }),
  },
  col3: { 
    width: Platform.select({
      web: 'calc(33.333% - 14px)' as any,
      default: '32%',
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

  // ✅ УЛУЧШЕНИЕ: Пропорциональная карточка с фиксированным соотношением сторон
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    // ✅ УЛУЧШЕНИЕ: Одинаковая высота для всех карточек в строке
    display: 'flex' as any,
    flexDirection: 'column' as any,
    ...Platform.select({
      web: {
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        willChange: 'transform, box-shadow',
        height: '100%',
        ':hover': {
          transform: 'translateY(-6px) scale(1.01)',
          shadowOpacity: 0.18,
          shadowRadius: 24,
          shadowOffset: { width: 0, height: 8 },
          borderColor: 'rgba(255,159,90,0.3)',
        } as any,
        ':active': {
          transform: 'translateY(-2px) scale(0.99)',
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
    backgroundColor: '#f8fafc',
    // ✅ УЛУЧШЕНИЕ: Пропорциональное соотношение сторон для всех карточек
    ...Platform.select({
      web: {
        aspectRatio: '4/3',
      },
    }),
  },
  image: { 
    width: '100%', 
    height: '100%', 
    minHeight: 240,
    display: 'block',
    backgroundColor: '#f3f4f6',
    objectFit: 'cover' as any,
    ...Platform.select({
      web: {
        transition: 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
        willChange: 'transform',
        ':hover': {
          transform: 'scale(1.05)',
        } as any,
      },
    }),
  },

  // ✅ УЛУЧШЕНИЕ: Улучшенный placeholder с градиентом и лучшей типографикой
  noImage: {
    width: '100%',
    ...Platform.select({
      default: {
        backgroundColor: '#ff9f5a',
      },
      web: {
        backgroundColor: 'transparent',
        backgroundImage: 'linear-gradient(135deg, #ff9f5a 0%, #ff6b35 50%, #ff8c42 100%)' as any,
        backgroundSize: '200% 200%',
        // ✅ ИСПРАВЛЕНИЕ: animation убрано из StyleSheet, используется CSS через style элемент
      },
    }),
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    paddingVertical: 40,
    paddingHorizontal: 24,
    minHeight: 240,
  },
  noImageText: {
    marginTop: 16,
    maxWidth: '85%',
    textAlign: 'center',
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
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
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.65)',
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
    backgroundColor: 'rgba(255,255,255,0.12)',
    ...Platform.select({
      web: {
        transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        cursor: 'pointer' as any,
        ':hover': {
          backgroundColor: 'rgba(255,159,90,0.9)',
          transform: 'scale(1.15) rotate(5deg)',
          boxShadow: '0 4px 12px rgba(255,159,90,0.4)',
        } as any,
        ':active': {
          transform: 'scale(1.05)',
        } as any,
      },
    }),
  },

  // ✅ УЛУЧШЕНИЕ: Информационная панель с улучшенным градиентом и читаемостью
  infoPanel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    // ✅ ИСПРАВЛЕНИЕ: Используем backgroundColor для мобильных, backgroundImage для web
    ...Platform.select({
      web: {
        backgroundColor: 'transparent',
        backgroundImage: 'linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.75) 50%, rgba(0,0,0,0.4) 80%, transparent 100%)' as any,
      },
      default: {},
    }),
    ...Platform.select({
      default: {
        backgroundColor: 'rgba(0,0,0,0.75)',
      },
    }),
    paddingTop: 36,
    paddingBottom: 16,
    paddingHorizontal: 18,
  },
  infoContent: {
    gap: 10,
  },
  addressText: { 
    color: '#fff', 
    fontWeight: '700', 
    lineHeight: 24,
    letterSpacing: -0.4,
    textShadow: '0 2px 8px rgba(0,0,0,0.4)',
  },
  coordButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    ...Platform.select({
      web: {
        transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        cursor: 'pointer' as any,
        ':hover': {
          backgroundColor: 'rgba(255,159,90,0.9)',
          borderColor: 'rgba(255,255,255,0.3)',
          transform: 'translateY(-1px)',
          boxShadow: '0 4px 12px rgba(255,159,90,0.3)',
        } as any,
      },
    }),
  },
  coordText: {
    color: '#fff',
    fontWeight: '600',
    fontFamily: Platform.select({
      web: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
      default: undefined,
    }),
    letterSpacing: 0.4,
    fontSize: 13,
    textShadow: '0 1px 3px rgba(0,0,0,0.3)',
  },
  // ✅ УЛУЧШЕНИЕ: Современный бейдж категории с улучшенной видимостью
  categoryBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#ff9f5a',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.25)',
    ...Platform.select({
      web: {
        boxShadow: '0 2px 8px rgba(255,159,90,0.4)',
        transition: 'all 0.2s ease',
        ':hover': {
          transform: 'scale(1.05)',
          boxShadow: '0 4px 12px rgba(255,159,90,0.5)',
        } as any,
      },
    }),
  },
  categoryText: { 
    color: '#fff', 
    fontWeight: '700', 
    fontSize: 12,
    letterSpacing: 0.3,
    textShadow: '0 1px 3px rgba(0,0,0,0.2)',
  },
});
