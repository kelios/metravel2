// components/travel/PointList.tsx
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Linking,
  Platform,
  Pressable,
  Text,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import Feather from '@expo/vector-icons/Feather';
import { FlashList } from '@shopify/flash-list';
// ✅ УЛУЧШЕНИЕ: Импорт утилит для оптимизации изображений
import { optimizeImageUrl, buildVersionedImageUrl, getOptimalImageSize } from '@/utils/imageOptimization';
import { DESIGN_COLORS, DESIGN_TOKENS } from '@/constants/designSystem';
import { globalFocusStyles } from '@/styles/globalFocus'; // ✅ ИСПРАВЛЕНИЕ: Импорт focus-стилей
import PlaceListCard from '@/components/places/PlaceListCard';
import { useResponsive } from '@/hooks/useResponsive';
import ImageCardMedia from '@/components/ui/ImageCardMedia';
import CardActionPressable from '@/components/ui/CardActionPressable';
import { useThemedColors } from '@/hooks/useTheme'; // ✅ РЕДИЗАЙН: Темная тема
import { useAuth } from '@/context/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { userPointsApi } from '@/api/userPoints';
import { fetchFilters } from '@/api/misc';
import { showToast } from '@/utils/toast';
import type { ImportedPoint } from '@/types/userPoints';
import { PointStatus } from '@/types/userPoints';
import {
  createCategoryNameToIdsMap,
  normalizeCategoryDictionary,
  resolveCategoryIdsByNames as mapResolveCategoryIds,
  CategoryDictionaryItem,
} from '@/utils/userPointsCategories';
import { getPointCategoryIds, getPointCategoryNames } from '@/utils/travelPointMeta';

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

const buildAppleMapsUrl = (coordStr: string) => {
  const p = parseCoord(coordStr);
  if (!p) return '';
  const { lat, lon } = p;
  return `https://maps.apple.com/?q=${encodeURIComponent(`${lat},${lon}`)}`;
};

const buildYandexMapsUrl = (coordStr: string) => {
  const p = parseCoord(coordStr);
  if (!p) return '';
  const { lat, lon } = p;
  return `https://yandex.ru/maps/?pt=${encodeURIComponent(`${lon},${lat}`)}&z=16&l=map`;
};

const buildOsmUrl = (coordStr: string) => {
  const p = parseCoord(coordStr);
  if (!p) return '';
  const { lat, lon } = p;
  return `https://www.openstreetmap.org/?mlat=${encodeURIComponent(String(lat))}&mlon=${encodeURIComponent(String(lon))}#map=16/${encodeURIComponent(String(lat))}/${encodeURIComponent(String(lon))}`;
};

const DEFAULT_TRAVEL_POINT_COLOR = DESIGN_COLORS.travelPoint;
const DEFAULT_TRAVEL_POINT_STATUS = PointStatus.PLANNING;

const normalizeCategoryNameToString = (
  raw: Point['categoryName'] | null | undefined
): string => {
  if (Array.isArray(raw)) {
    return raw
      .map((v) => (typeof v === 'object' ? String((v as any)?.name ?? '') : String(v ?? '')))
      .map((v) => v.trim())
      .filter(Boolean)
      .join(', ');
  }
  if (raw && typeof raw === 'object') {
    return String((raw as any)?.name ?? '').trim();
  }
  return String(raw ?? '').trim();
};

const getCountryFromAddress = (address?: string | null) => {
  const addr = String(address ?? '').trim();
  if (!addr) return '';
  return (
    addr
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean)
      .slice(-1)[0] ?? ''
  );
};

const stripCountryFromCategoryNames = (names: string[], address?: string | null) => {
  const countryCandidate = getCountryFromAddress(address);
  if (!countryCandidate) return names;
  return names.filter((p) => p.localeCompare(countryCandidate, undefined, { sensitivity: 'accent' }) !== 0);
};

const stripCountryFromCategoryIds = (
  ids: string[],
  address: string | null | undefined,
  idToNameMap: Map<string, string>
) => {
  const countryCandidate = getCountryFromAddress(address);
  if (!countryCandidate) return ids;
  return ids.filter((id) => {
    const idText = String(id ?? '').trim();
    const name = String(idToNameMap.get(idText) ?? '').trim();
    if (!name) {
      if (!idText) return true;
      return idText.localeCompare(countryCandidate, undefined, { sensitivity: 'accent' }) !== 0;
    }
    return name.localeCompare(countryCandidate, undefined, { sensitivity: 'accent' }) !== 0;
  });
};

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
      const { devWarn } = require('@/utils/logger');
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
                                                  onAddPoint,
                                                  addButtonLoading,
                                                  addButtonDisabled,
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

  const ActionIcon = useCallback(
    ({
      accessibilityLabel,
      title,
      onPress,
      icon,
    }: {
      accessibilityLabel: string;
      title?: string;
      onPress: () => void;
      icon: React.ReactNode;
    }) => {
      return (
        <CardActionPressable
          style={styles.actionBtn}
          onPress={onPress}
          accessibilityLabel={accessibilityLabel}
          title={title ?? accessibilityLabel}
        >
          {icon}
        </CardActionPressable>
      );
    },
    [styles.actionBtn]
  );

  const ActionChip = useCallback(
    ({
      label,
      title,
      onPress,
    }: {
      label: string;
      title?: string;
      onPress: () => void;
    }) => {
      return (
        <CardActionPressable
          style={styles.mapChip}
          onPress={onPress}
          accessibilityLabel={label}
          title={title ?? label}
        >
          <Text style={styles.mapChipText}>{label}</Text>
        </CardActionPressable>
      );
    },
    [styles.mapChip, styles.mapChipText]
  );

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
            <View style={[styles.noImage, { minHeight: responsive.imageMinHeight }]} />
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
                <ActionIcon
                  accessibilityLabel="Скопировать координаты"
                  title="Скопировать координаты"
                  onPress={() => onCopy(point.coord)}
                  icon={<Feather name="clipboard" size={18} color={colors.textOnDark} />}
                />
                <ActionIcon
                  accessibilityLabel="Поделиться"
                  title="Поделиться в Telegram"
                  onPress={() => onShare(point.coord)}
                  icon={<Feather name="send" size={18} color={colors.textOnDark} />}
                />
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

            <CardActionPressable
              style={[styles.overlayCoordRow, globalFocusStyles.focusable]}
              onPress={openMapFromLink}
              accessibilityLabel={`Координаты: ${point.coord}`}
              title="Открыть координаты в Google Maps"
            >
              <Feather name="map-pin" size={14} color={colors.textOnDark} />
              <Text
                style={[styles.overlayCoordText, { fontSize: responsive.coordSize }]}
                numberOfLines={1}
              >
                {point.coord}
              </Text>
            </CardActionPressable>

            <View style={styles.overlayMapChipsRow}>
              <ActionChip label="Google" title="Открыть в Google Maps" onPress={() => void openExternal(buildMapUrl(point.coord))} />
              <ActionChip label="Apple" title="Открыть в Apple Maps" onPress={() => void openExternal(buildAppleMapsUrl(point.coord))} />
              <ActionChip label="Яндекс" title="Открыть в Яндекс Картах" onPress={() => void openExternal(buildYandexMapsUrl(point.coord))} />
              <ActionChip label="OSM" title="Открыть в OpenStreetMap" onPress={() => void openExternal(buildOsmUrl(point.coord))} />
            </View>

            {!!point.categoryName && (
              <View style={styles.overlayCategoryRow}>
                <View style={styles.overlayCategoryChip}>
                  <Text style={styles.overlayCategoryText} numberOfLines={1}>
                    {normalizeCategoryNameToString(point.categoryName).split(',')[0]?.trim()}
                  </Text>
                </View>
              </View>
            )}
          </View>
          {onAddPoint && (
            <AddToPointsButton
              onPress={onAddPoint}
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
      <CardActionPressable
        onPress={onPress}
        disabled={disabled || loading}
        accessibilityLabel="Мои точки"
        style={({ pressed }) => [
          globalFocusStyles.focusable,
          styles.addButton,
          pressed && !disabled && !loading && styles.addButtonPressed,
          (disabled || loading) && styles.addButtonDisabled,
          isWide && styles.addButtonFullWidth,
        ]}
      >
        {loading ? (
          <ActivityIndicator size="small" color={colors.textOnPrimary} />
        ) : (
          <View style={styles.addButtonRow}>
            <Feather name="plus-circle" size={16} color={colors.textOnPrimary} />
            <Text style={[styles.addButtonText, { color: colors.textOnPrimary }]}>
              Мои точки
            </Text>
          </View>
        )}
      </CardActionPressable>
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
  const pointsCount = safePoints.length;
  const countLabel = pointsCount > 0 ? ` (${pointsCount})` : '';
  const toggleLabel = showList
    ? `Скрыть координаты мест${countLabel}`
    : `Показать координаты мест${countLabel}`;

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
  const categoryIdToName = useMemo(() => {
    const map = new Map<string, string>();
    for (const entry of siteCategoryDictionary) {
      const id = String(entry.id ?? '').trim();
      const name = String(entry.name ?? '').trim();
      if (!id || !name) continue;
      map.set(id, name);
    }
    return map;
  }, [siteCategoryDictionary]);

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
      const rawNames = getPointCategoryNames(point);
      const cleanedNames = stripCountryFromCategoryNames(rawNames, point.address);
      const categoryIdsFromNames = mapResolveCategoryIds(cleanedNames, categoryNameToIds);
      const combinedIds = Array.from(
        new Set<string>([...categoryIdsFromPoint, ...categoryIdsFromNames])
      );
      const filteredIds = stripCountryFromCategoryIds(
        combinedIds,
        point.address,
        categoryIdToName
      );

      const rawCategoryName = Array.isArray(point.categoryName)
        ? point.categoryName.join(', ')
        : typeof point.categoryName === 'object'
        ? String((point.categoryName as any).name ?? '')
        : String(point.categoryName ?? '').trim();
      const cleanedCategoryName = stripCountryFromCategoryNames(
        rawCategoryName
          ? rawCategoryName
              .split(',')
              .map((p) => p.trim())
              .filter(Boolean)
          : [],
        point.address
      ).join(', ');
      const categoryNameString = cleanedCategoryName || undefined;

      const payload: Partial<ImportedPoint> = {
        name: point.address || travelName || 'Точка маршрута',
        address: point.address,
        description: point.description,
        latitude: coords.lat,
        longitude: coords.lon,
        color: DEFAULT_TRAVEL_POINT_COLOR,
        status: DEFAULT_TRAVEL_POINT_STATUS,
        category: categoryNameString,
      };

      if (point.travelImageThumbUrl) {
        payload.photo = point.travelImageThumbUrl;
      }

      if (filteredIds.length > 0) {
        payload.categoryIds = filteredIds;
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
      categoryIdToName,
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
    ({ item }: { item: Point }) => {
      const isAdding = addingPointId === item.id;
      const addDisabled = !authReady;
      const handleAddPointClick = (event?: any) => {
        event?.stopPropagation?.();
        void handleAddPoint(item);
      };

      return (
        <View
          style={[
            styles.col,
            numColumns === 2 ? styles.col2 : styles.col1,
          ]}
        >
          {Platform.OS === 'web' ? (
            <PlaceListCard
              title={item.address}
              imageUrl={getOptimizedImageUrl(item.travelImageThumbUrl, item.updated_at)}
              categoryLabel={normalizeCategoryNameToString(item.categoryName) || undefined}
              coord={item.coord}
              onCardPress={onPointCardPress ? () => onPointCardPress(item) : () => onOpenMap(item.coord)}
              onMediaPress={onPointCardPress ? undefined : () => onOpenArticle(item)}
              onCopyCoord={item.coord ? () => onCopy(item.coord) : undefined}
              onShare={item.coord ? () => onShare(item.coord) : undefined}
              mapActions={
                item.coord
                  ? [
                      {
                        key: 'google',
                        label: 'Google',
                        icon: 'map-pin',
                        onPress: () => void openExternal(buildMapUrl(item.coord)),
                        title: 'Открыть в Google Maps',
                      },
                      {
                        key: 'apple',
                        label: 'Apple',
                        icon: 'map',
                        onPress: () => void openExternal(buildAppleMapsUrl(item.coord)),
                        title: 'Открыть в Apple Maps',
                      },
                      {
                        key: 'yandex',
                        label: 'Яндекс',
                        icon: 'navigation',
                        onPress: () => void openExternal(buildYandexMapsUrl(item.coord)),
                        title: 'Открыть в Яндекс Картах',
                      },
                      {
                        key: 'osm',
                        label: 'OSM',
                        icon: 'map',
                        onPress: () => void openExternal(buildOsmUrl(item.coord)),
                        title: 'Открыть в OpenStreetMap',
                      },
                    ]
                  : []
              }
              inlineActions={
                item.articleUrl || item.urlTravel || baseUrl
                  ? [
                      {
                        key: 'article',
                        label: 'Статья',
                        icon: 'book-open',
                        onPress: () => onOpenArticle(item),
                        title: 'Открыть статью',
                      },
                    ]
                  : []
              }
              onAddPoint={handleAddPointClick}
              addDisabled={addDisabled}
              isAdding={isAdding}
              imageHeight={180}
              width={300}
              style={{ margin: DESIGN_TOKENS.spacing.sm }}
              testID={`travel-point-card-${item.id}`}
            />
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
              onCardPress={onPointCardPress ? () => onPointCardPress(item) : undefined}
              onAddPoint={() => {
                void handleAddPoint(item);
              }}
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
        accessibilityLabel={toggleLabel}
        accessibilityState={{ expanded: showList }}
      >
        <View style={styles.toggleRow}>
          {[
            <Feather key="icon" name="map-pin" size={22} color={colors.text} />,
            <Text key="text" style={[styles.toggleText, isMobile && styles.toggleTextSm]}>
              {toggleLabel}
            </Text>,
            showList ? (
              <Feather key="chevron" name="chevron-up" size={18} color={colors.text} />
            ) : (
              <Feather key="chevron" name="chevron-down" size={18} color={colors.text} />
            ),
          ]}
        </View>
      </Pressable>

      {/* P2-5: Компактное превью первых 3 точек когда список свёрнут */}
      {!showList && safePoints.length > 0 && (
        <Pressable
          onPress={() => setShowList(true)}
          style={styles.previewContainer}
          accessibilityRole="button"
          accessibilityLabel="Показать все точки маршрута"
        >
          {safePoints.slice(0, 3).map((pt, idx) => (
            <View key={pt.id} style={styles.previewRow}>
              <View style={styles.previewBullet}>
                <Text style={styles.previewBulletText}>{idx + 1}</Text>
              </View>
              <View style={styles.previewTextWrap}>
                <Text style={styles.previewAddress} numberOfLines={1}>
                  {pt.address || 'Без адреса'}
                </Text>
                {pt.coord ? (
                  <Text style={styles.previewCoord} numberOfLines={1}>
                    {pt.coord}
                  </Text>
                ) : null}
              </View>
            </View>
          ))}
          {safePoints.length > 3 && (
            <Text style={styles.previewMore}>
              + ещё {safePoints.length - 3}
            </Text>
          )}
        </Pressable>
      )}

      {showList && (
        Platform.OS === 'web' ? (
          <ScrollView
            contentContainerStyle={[styles.listContent, numColumns > 1 && styles.columnWrap]}
          >
            {safePoints.map((item, index) => (
              <React.Fragment key={keyExtractor(item)}>
                {renderItem({ item } as any)}
              </React.Fragment>
            ))}
          </ScrollView>
        ) : (
          <FlashList
            key={`cols-${numColumns}`}
            data={safePoints as any}
            renderItem={renderItem as any}
            numColumns={numColumns as any}
            keyExtractor={keyExtractor as any}
            contentContainerStyle={styles.listContent as any}
            {...(numColumns > 1 ? ({ columnWrapperStyle: styles.columnWrap } as any) : null)}
          />
        )
      )}
    </View>
  );
};

export default React.memo(PointList);

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

  // P2-5: Стили превью точек
  previewContainer: {
    backgroundColor: colors.surface,
    borderRadius: DESIGN_TOKENS.radii.sm,
    borderWidth: 1,
    borderColor: colors.borderLight,
    paddingVertical: DESIGN_TOKENS.spacing.sm,
    paddingHorizontal: DESIGN_TOKENS.spacing.md,
    marginBottom: DESIGN_TOKENS.spacing.md,
    gap: DESIGN_TOKENS.spacing.xs,
    ...Platform.select({
      web: { cursor: 'pointer' as any },
    }),
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DESIGN_TOKENS.spacing.sm,
    paddingVertical: 4,
  },
  previewBullet: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewBulletText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
  },
  previewTextWrap: {
    flex: 1,
    gap: 1,
  },
  previewAddress: {
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    fontWeight: '500',
    color: colors.text,
  },
  previewCoord: {
    fontSize: 11,
    color: colors.textMuted,
  },
  previewMore: {
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    fontWeight: '600',
    color: colors.primary,
    textAlign: 'center',
    paddingTop: DESIGN_TOKENS.spacing.xs,
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
    backgroundColor: colors.backgroundTertiary,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    minHeight: 240,
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
    padding: 4,
    ...Platform.select({
      web: {
        backdropFilter: 'blur(12px) saturate(180%)',
        WebkitBackdropFilter: 'blur(12px) saturate(180%)',
        boxShadow: '0 4px 10px rgba(0,0,0,0.12)',
      },
    }),
  },
  actionBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.overlayLight,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderLight,
    ...Platform.select({
      web: {
        transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        cursor: 'pointer' as any,
        ':hover': {
          backgroundColor: colors.surface,
          transform: 'scale(1.06)',
          boxShadow: (colors.boxShadows as any)?.medium ?? '0 4px 10px rgba(0,0,0,0.16)',
        } as any,
        ':active': {
          transform: 'scale(1.02)',
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
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderLight,
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
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderLight,
  },
  overlayCoordText: {
    color: colors.textOnDark,
    fontWeight: '500',
    fontFamily: Platform.select({
      web: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
      default: undefined,
    }),
    letterSpacing: 0.2,
  },
  overlayMapChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: DESIGN_TOKENS.spacing.xs,
    marginTop: DESIGN_TOKENS.spacing.xxs,
  },
  mapChip: {
    paddingHorizontal: DESIGN_TOKENS.spacing.sm,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderLight,
    ...Platform.select({
      web: {
        cursor: 'pointer' as any,
        transition: 'all 0.2s ease',
        ':hover': {
          borderColor: colors.border,
          backgroundColor: colors.backgroundSecondary,
        } as any,
      },
    }),
  },
  mapChipText: {
    color: colors.text,
    fontSize: DESIGN_TOKENS.typography.sizes.xs,
    fontWeight: '600',
    letterSpacing: -0.2,
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
    fontWeight: '500',
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
