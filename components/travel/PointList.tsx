// components/travel/PointList.tsx
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Linking,
  Platform,
  Pressable,
  Text,
  ListRenderItemInfo,
  ActivityIndicator,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import Feather from '@expo/vector-icons/Feather';
import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import { FlashList } from '@shopify/flash-list';
// ✅ УЛУЧШЕНИЕ: Импорт утилит для оптимизации изображений
import { optimizeImageUrl, buildVersionedImageUrl, getOptimalImageSize } from '@/utils/imageOptimization';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { globalFocusStyles } from '@/styles/globalFocus'; // ✅ ИСПРАВЛЕНИЕ: Импорт focus-стилей
import UnifiedTravelCard from '@/components/ui/UnifiedTravelCard';
import { useResponsive } from '@/hooks/useResponsive';
import ImageCardMedia from '@/components/ui/ImageCardMedia';
import { useThemedColors } from '@/hooks/useTheme'; // ✅ РЕДИЗАЙН: Темная тема
import { useAuth } from '@/context/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { userPointsApi } from '@/src/api/userPoints';
import { fetchFilters } from '@/src/api/misc';
import { showToast } from '@/src/utils/toast';
import type { ImportedPoint } from '@/types/userPoints';
import { PointStatus } from '@/types/userPoints';
import {
  createCategoryNameToIdsMap,
  normalizeCategoryDictionary,
  resolveCategoryIdsByNames as mapResolveCategoryIds,
  CategoryDictionaryItem,
} from '@/src/utils/userPointsCategories';
import { getPointCategoryIds, getPointCategoryNames } from '@/src/utils/travelPointMeta';

type Point = {
  id: string;
  travelImageThumbUrl?: string;
  updated_at?: string;
  address: string;
  coord: string;
  categoryName?: string | { name?: string } | Array<string | { name?: string }>;
  category?: string | number;
  category_id?: string | number;
  categoryIds?: Array<string | number>;
  category_ids?: Array<string | number>;
  categories?: Array<string | number | Record<string, unknown>>;
  description?: string;
  articleUrl?: string;
  urlTravel?: string;
};

type PointListProps = {
  points: Point[];
  baseUrl?: string;
  travelName?: string;
  onPointCardPress?: (point: Point) => void;
};

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

const buildOrganicMapsUrl = (coordStr: string) => {
  const p = parseCoord(coordStr);
  if (!p) return '';
  const { lat, lon } = p;
  return `https://omaps.app/${lat},${lon}`;
};

const DEFAULT_TRAVEL_POINT_COLOR = '#ff922b';
const DEFAULT_TRAVEL_POINT_STATUS = PointStatus.PLANNING;

const openExternal = async (url: string) => {
  if (!url) return;
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.open(url, '_blank', 'noopener,noreferrer');
    return;
  }
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
                                                  onOpenOrganic,
                                                  onAddPoint,
                                                  addButtonLoading,
                                                  colors,
                                                  styles,
                                                  onCardPress,
                                                }: {
  point: Point;
  isMobile: boolean;
  responsive: Responsive;
  onCopy: (coordStr: string) => void;
  onShare: (coordStr: string) => void;
  onOpenMap: (coordStr: string) => void;
  onOpenOrganic: (coordStr: string) => void;
  onAddPoint?: () => void;
  addButtonLoading?: boolean;
  addButtonDisabled?: boolean;
  onCardPress?: () => void;
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
        onPress={onCardPress ?? openMapFromLink} 
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
                  {...(Platform.OS === 'web'
                    ? ({ title: 'Открыть в Google Maps' } as any)
                    : ({ accessibilityRole: 'button' } as any))}
                >
                  <Feather name="map-pin" size={18} color={colors.textOnDark} />
                </Pressable>
                <Pressable
                  style={styles.actionBtn}
                  onPress={(e) => {
                    e.stopPropagation();
                    onOpenOrganic(point.coord);
                  }}
                  accessibilityLabel="Открыть в Organic Maps"
                  {...(Platform.OS === 'web'
                    ? ({ title: 'Открыть в Organic Maps' } as any)
                    : ({ accessibilityRole: 'button' } as any))}
                >
                  <Feather name="navigation" size={18} color={colors.textOnDark} />
                </Pressable>
                <Pressable
                  style={styles.actionBtn}
                  onPress={(e) => {
                    e.stopPropagation();
                    onCopy(point.coord);
                  }}
                  accessibilityLabel="Скопировать координаты"
                  {...(Platform.OS === 'web'
                    ? ({ title: 'Скопировать координаты' } as any)
                    : ({ accessibilityRole: 'button' } as any))}
                >
                  <Feather name="clipboard" size={18} color={colors.textOnDark} />
                </Pressable>
                <Pressable
                  style={styles.actionBtn}
                  onPress={(e) => {
                    e.stopPropagation();
                    onShare(point.coord);
                  }}
                  accessibilityLabel="Поделиться"
                  {...(Platform.OS === 'web'
                    ? ({ title: 'Поделиться в Telegram' } as any)
                    : ({ accessibilityRole: 'button' } as any))}
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
              {...(Platform.OS === 'web'
                ? ({ title: 'Открыть координаты в Google Maps' } as any)
                : ({ accessibilityRole: 'button' } as any))}
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
          {onAddPoint && (
            <AddToPointsButton
              onPress={(e) => {
                e.stopPropagation();
                onAddPoint();
              }}
              loading={Boolean(addButtonLoading)}
              disabled={Boolean(addButtonDisabled)}
              colors={colors}
              styles={styles}
              isWide={false}
            />
          )}
        </View>
      </Pressable>
    </View>
  );
});

type AddToPointsButtonProps = {
  onPress: () => void;
  loading: boolean;
  disabled: boolean;
  colors: ReturnType<typeof useThemedColors>;
  styles: ReturnType<typeof createStyles>;
  isWide?: boolean;
};

const AddToPointsButton = React.memo(function AddToPointsButton({
  onPress,
  loading,
  disabled,
  colors,
  styles,
  isWide = false,
}: AddToPointsButtonProps) {
  return (
    <View style={[styles.addButtonContainer, isWide && styles.addButtonContainerWide]}>
      <Pressable
        onPress={onPress}
        disabled={disabled || loading}
        accessibilityLabel="Добавить в мои точки"
        style={({ pressed }) => [
          styles.addButton,
          pressed && !disabled && !loading && styles.addButtonPressed,
          (disabled || loading) && styles.addButtonDisabled,
          isWide && styles.addButtonFullWidth,
        ]}
        {...globalFocusStyles.focusable}
      >
        {loading ? (
          <ActivityIndicator size="small" color={colors.textOnPrimary} />
        ) : (
          <View style={styles.addButtonRow}>
            <Feather name="plus-circle" size={16} color={colors.textOnPrimary} />
            <Text style={[styles.addButtonText, { color: colors.textOnPrimary }]}>
              Добавить в мои точки
            </Text>
          </View>
        )}
      </Pressable>
    </View>
  );
});

/* ---------------- list ---------------- */

const PointList: React.FC<PointListProps> = ({ points, baseUrl, travelName, onPointCardPress }) => {
  const colors = useThemedColors(); // ✅ РЕДИЗАЙН: Темная тема
  const safePoints = useMemo(() => (Array.isArray(points) ? points : []), [points]);
  const { width, isPhone, isLargePhone, isTablet } = useResponsive();
  const isMobile = isPhone || isLargePhone;
  const isLargeDesktop = width >= 1440;

  const [showList, setShowList] = useState(false);
  const [siteCategoryDictionary, setSiteCategoryDictionary] = useState<CategoryDictionaryItem[]>([]);
  const [addingPointId, setAddingPointId] = useState<string | null>(null);
  const { isAuthenticated, authReady } = useAuth();
  const queryClient = useQueryClient();

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

  useEffect(() => {
    let active = true;
    const loadDictionary = async () => {
      try {
        const data = await fetchFilters();
        const raw = (data as any)?.categoryTravelAddress ?? (data as any)?.category_travel_address;
        if (!active) return;
        setSiteCategoryDictionary(normalizeCategoryDictionary(raw));
      } catch {
        if (active) {
          setSiteCategoryDictionary([]);
        }
      }
    };
    loadDictionary();
    return () => {
      active = false;
    };
  }, []);

  const categoryNameToIds = useMemo(
    () => createCategoryNameToIdsMap(siteCategoryDictionary),
    [siteCategoryDictionary]
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
    const text = `Координаты: ${coordStr}`;

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

  const onOpenOrganic = useCallback((coordStr: string) => {
    const url = buildOrganicMapsUrl(coordStr);
    if (url) openExternal(url);
  }, []);

  const onOpenArticle = useCallback(
    (point: Point) => {
      const url = String(point.articleUrl || point.urlTravel || baseUrl || '').trim();
      if (!url) return;
      openExternal(url);
    },
    [baseUrl]
  );

  const handleAddPoint = useCallback(
    async (point: Point) => {
      if (!authReady) return;
      if (addingPointId === point.id) return;
      if (!isAuthenticated) {
        void showToast({
          type: 'info',
          text1: 'Авторизуйтесь, чтобы сохранять точки',
          position: 'bottom',
        });
        return;
      }

      if (!point.coord) {
        void showToast({
          type: 'info',
          text1: 'У точки нет координат',
          position: 'bottom',
        });
        return;
      }

      const coords = parseCoord(point.coord);
      if (!coords) {
        void showToast({
          type: 'info',
          text1: 'Невозможно распознать координаты',
          position: 'bottom',
        });
        return;
      }

      const categoryIdsFromPoint = getPointCategoryIds(point);
      const categoryIdsFromNames = mapResolveCategoryIds(
        getPointCategoryNames(point),
        categoryNameToIds
      );
      const combinedIds = Array.from(
        new Set<string>([...categoryIdsFromPoint, ...categoryIdsFromNames])
      );

      const rawCategoryName = Array.isArray(point.categoryName)
        ? point.categoryName.join(', ')
        : typeof point.categoryName === 'object'
        ? String((point.categoryName as any).name ?? '')
        : String(point.categoryName ?? '').trim();
      const categoryNameString = rawCategoryName || undefined;

      const payload: Partial<ImportedPoint> = {
        name: point.address || travelName || 'Точка маршрута',
        address: point.address,
        description: point.description,
        latitude: coords.lat,
        longitude: coords.lon,
        color: DEFAULT_TRAVEL_POINT_COLOR,
        status: DEFAULT_TRAVEL_POINT_STATUS,
        category: categoryNameString,
        categoryName: categoryNameString,
      };

      if (combinedIds.length > 0) {
        payload.categoryIds = combinedIds;
      }

      const tags: Record<string, unknown> = {};
      if (baseUrl) {
        tags.travelUrl = baseUrl;
      }
      if (point.articleUrl) {
        tags.articleUrl = point.articleUrl;
      }
      if (travelName) {
        tags.travelName = travelName;
      }
      if (Object.keys(tags).length > 0) {
        payload.tags = tags;
      }

      setAddingPointId(point.id);
      try {
        await userPointsApi.createPoint(payload);
        void showToast({
          type: 'success',
          text1: 'Точка добавлена в «Мои точки»',
          position: 'bottom',
        });
        void queryClient.invalidateQueries({ queryKey: ['userPointsAll'] });
      } catch (error) {
        if (__DEV__) {
          console.error('Не удалось добавить точку из маршрута в мои точки', error);
        }
        void showToast({
          type: 'error',
          text1: 'Не удалось сохранить точку',
          position: 'bottom',
        });
      } finally {
        setAddingPointId(null);
      }
    },
    [
      addingPointId,
      authReady,
      baseUrl,
      categoryNameToIds,
      isAuthenticated,
      queryClient,
      travelName,
    ]
  );

  // ✅ УЛУЧШЕНИЕ: Более плавные переходы между количеством колонок
  const numColumns = useMemo(() => {
    if (width >= 1024) return 2; // Десктопы и большие экраны: 2 колонки, чтобы карточки были крупнее
    if (width >= 768) return 2;  // Планшеты: 2 колонки
    return 1; // Мобильные: одна карточка в ряд
  }, [width]);

  const keyExtractor = useCallback((item: Point) => item.id, []);
  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<Point>) => {
      const isAdding = addingPointId === item.id;
      const addDisabled = !authReady;
      const handleAddPointClick = (event?: any) => {
        event?.stopPropagation?.();
        handleAddPoint(item);
      };

      return (
        <View
          style={[
            styles.col,
            numColumns === 2 ? styles.col2 : styles.col1,
          ]}
      >
        {Platform.OS === 'web' ? (
            <UnifiedTravelCard
              title={item.address}
              imageUrl={getOptimizedImageUrl(item.travelImageThumbUrl, item.updated_at)}
              metaText={item.categoryName}
              onPress={onPointCardPress ? () => onPointCardPress(item) : undefined}
            onMediaPress={() => onOpenArticle(item)}
            imageHeight={180}
            width={300}
            contentSlot={
              <View style={{ gap: 8 }}>
                <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>
                  {item.address}
                </Text>

                {!!item.coord && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <Text
                      numberOfLines={1}
                      style={{
                        fontSize: 12,
                        fontWeight: '600',
                        color: colors.textMuted,
                        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace' as any,
                      }}
                    >
                      {item.coord}
                    </Text>

                    <Pressable
                      accessibilityLabel="Скопировать координаты"
                      onPress={(e) => {
                        e?.stopPropagation?.();
                        void onCopy(item.coord);
                      }}
                      {...({ 'data-card-action': 'true', title: 'Скопировать координаты' } as any)}
                    >
                      <Feather name="clipboard" size={16} color={colors.textMuted} />
                    </Pressable>

                    <Pressable
                      accessibilityLabel="Поделиться в Telegram"
                      onPress={(e) => {
                        e?.stopPropagation?.();
                        void onShare(item.coord);
                      }}
                      {...({ 'data-card-action': 'true', title: 'Поделиться в Telegram' } as any)}
                    >
                      <Feather name="send" size={16} color={colors.textMuted} />
                    </Pressable>
                  </View>
                )}

                {(!!item.categoryName || !!item.articleUrl || !!item.urlTravel || !!baseUrl) && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    {!!item.categoryName && (
                      <Text style={{ fontSize: 12, color: colors.textMuted }} numberOfLines={1}>
                        {item.categoryName}
                      </Text>
                    )}

                    {!!item.coord && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                        <Pressable
                          accessibilityLabel="Открыть в Google Maps"
                          onPress={(e) => {
                            e?.stopPropagation?.();
                            onOpenMap(item.coord);
                          }}
                          {...({ 'data-card-action': 'true', title: 'Открыть в Google Maps' } as any)}
                        >
                          <FontAwesome5 name="google" brand size={16} color={colors.textMuted} />
                        </Pressable>

                        <Pressable
                          accessibilityLabel="Открыть в Organic Maps"
                          onPress={(e) => {
                            e?.stopPropagation?.();
                            onOpenOrganic(item.coord);
                          }}
                          {...({ 'data-card-action': 'true', title: 'Открыть в Organic Maps' } as any)}
                        >
                          <Feather name="navigation" size={16} color={colors.textMuted} />
                        </Pressable>

                        {(!!item.articleUrl || !!item.urlTravel || !!baseUrl) && (
                          <Pressable
                            accessibilityLabel="Открыть статью"
                            onPress={(e) => {
                              e?.stopPropagation?.();
                              onOpenArticle(item);
                            }}
                            {...({ 'data-card-action': 'true', title: 'Открыть статью' } as any)}
                          >
                            <Feather name="book-open" size={16} color={colors.textMuted} />
                          </Pressable>
                        )}
                      </View>
                    )}
                  </View>
                )}

                <AddToPointsButton
                  onPress={handleAddPointClick}
                  loading={isAdding}
                  disabled={addDisabled}
                  colors={colors}
                  styles={styles}
                  isWide
                />
              </View>
            }
            mediaProps={{
              blurBackground: true,
              blurRadius: 16,
              loading: 'lazy',
              priority: 'low',
            }}
            style={{ margin: DESIGN_TOKENS.spacing.sm }}
          />
        ) : (
            <PointCard
              point={item}
              isMobile={isMobile}
              responsive={responsive}
              onCopy={onCopy}
              onShare={onShare}
              onOpenMap={onOpenMap}
              onOpenOrganic={onOpenOrganic}
              colors={colors}
              styles={styles}
              onCardPress={onPointCardPress ? () => onPointCardPress(item) : undefined}
              onAddPoint={() => handleAddPoint(item)}
            addButtonLoading={isAdding}
            addButtonDisabled={addDisabled}
          />
          )}
        </View>
      );
    },
    [
      addingPointId,
      authReady,
      baseUrl,
      colors,
      handleAddPoint,
      isMobile,
      numColumns,
      onCopy,
      onOpenArticle,
      onOpenMap,
      onOpenOrganic,
      onPointCardPress,
      onShare,
      responsive,
      styles,
    ]
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
        <FlashList
          key={`cols-${numColumns}`}
          data={safePoints}
          estimatedItemSize={300}
          renderItem={renderItem}
          numColumns={numColumns}
          keyExtractor={keyExtractor}
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
  addButtonContainer: {
    marginTop: DESIGN_TOKENS.spacing.md,
  },
  addButtonContainerWide: {
    width: '100%',
  },
  addButton: {
    backgroundColor: colors.primary,
    borderRadius: DESIGN_TOKENS.radii.lg,
    paddingVertical: DESIGN_TOKENS.spacing.sm,
    paddingHorizontal: DESIGN_TOKENS.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: DESIGN_TOKENS.spacing.xs,
    ...Platform.select({
      web: {
        cursor: 'pointer' as any,
        transition: 'all 0.2s ease',
      },
    }),
  },
  addButtonPressed: {
    transform: [{ scale: 0.98 }],
  },
  addButtonDisabled: {
    opacity: 0.65,
  },
  addButtonFullWidth: {
    width: '100%',
  },
  addButtonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DESIGN_TOKENS.spacing.xs,
  },
  addButtonText: {
    fontWeight: '600',
    letterSpacing: -0.2,
    color: colors.textOnPrimary,
  },
});
