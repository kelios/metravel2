// components/travel/PointList.tsx
import React, { useCallback, useMemo } from 'react';
import {
  View,
} from 'react-native';
// ✅ УЛУЧШЕНИЕ: Импорт утилит для оптимизации изображений
import { optimizeImageUrl, buildVersionedImageUrl } from '@/utils/imageOptimization';
import { globalFocusStyles } from '@/styles/globalFocus'; // ✅ ИСПРАВЛЕНИЕ: Импорт focus-стилей
import { useResponsive } from '@/hooks/useResponsive';
import {
  PointListExpandedContent,
  PointListPreview,
  PointListToggleButton,
  PointListViewModeBar,
} from '@/components/travel/PointListChrome';
import PointListCardRenderer from '@/components/travel/PointListCardRenderer';
import { useThemedColors } from '@/hooks/useTheme'; // ✅ РЕДИЗАЙН: Темная тема
import { openExternalUrlInNewTab } from '@/utils/externalLinks';
import { usePointListAddPointModel } from '@/components/travel/hooks/usePointListAddPointModel';
import { createPointListItemModel } from '@/components/travel/hooks/createPointListItemModel';
import { usePointListCategoryDictionaryModel } from '@/components/travel/hooks/usePointListCategoryDictionaryModel';
import { usePointListDisplayModel } from '@/components/travel/hooks/usePointListDisplayModel';
import { usePointListExternalActionsModel } from '@/components/travel/hooks/usePointListExternalActionsModel';
import {
  usePointListResponsiveModel,
} from '@/components/travel/hooks/usePointListResponsiveModel';
import { createPointListStyles } from '@/components/travel/PointList.styles';

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

/* ---------------- helpers ---------------- */

// ✅ УЛУЧШЕНИЕ: Используем новые утилиты для оптимизации изображений
const getOptimizedImageUrl = (url?: string, updatedAt?: string) => {
  if (!url) return undefined;
  
  // Создаем версионированный URL
  const versionedUrl = buildVersionedImageUrl(url, updatedAt);
  
  return optimizeImageUrl(versionedUrl, {
    width: 480,
    height: 320,
    format: 'webp',
    quality: 60,
    fit: 'contain',
    dpr: 1,
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

const openExternal = async (url: string) => {
  if (!url) return;
  try {
    await openExternalUrlInNewTab(url, {
      onError: (error) => {
        if (__DEV__) {
          const { devWarn } = require('@/utils/logger');
          devWarn('Error opening URL:', error);
        }
      },
    });
  } catch (error) {
    if (__DEV__) {
      const { devWarn } = require('@/utils/logger');
      devWarn('Error opening URL:', error);
    }
  }
};

// ✅ РЕДИЗАЙН: Компонент удален - заменен на встроенные кнопки в карточке

/* ---------------- list ---------------- */

const PointList: React.FC<PointListProps> = ({ points, baseUrl, travelName, onPointCardPress }) => {
  const colors = useThemedColors(); // ✅ РЕДИЗАЙН: Темная тема
  const safePoints = useMemo(() => (Array.isArray(points) ? points : []), [points]);
  const { width, isPhone, isLargePhone, isTablet } = useResponsive();
  const isMobile = isPhone || isLargePhone;
  const isLargeDesktop = width >= 1440;
  const {
    hiddenPreviewCount,
    previewPoints,
    setShowList,
    setViewMode,
    shouldRenderNativeList,
    shouldRenderWebCardsMode,
    shouldRenderWebListMode,
    shouldShowPreview,
    shouldShowToggleTextCompact,
    shouldShowViewModeBar,
    showList,
    toggleLabel,
    viewMode,
  } = usePointListDisplayModel({
    isMobile,
    points: safePoints,
  });

  // ✅ УЛУЧШЕНИЕ: Мемоизация стилей с динамическими цветами
  const styles = useMemo(() => createPointListStyles(colors), [colors]);

  const { numColumns, responsive } = usePointListResponsiveModel({
    isLargeDesktop,
    isMobile,
    isTablet,
    width,
  });

  const { categoryIdToName, categoryNameToIds } = usePointListCategoryDictionaryModel();
  const { addingPointId, handleAddPoint } = usePointListAddPointModel({
    baseUrl,
    categoryIdToName,
    categoryNameToIds,
    travelName,
  });
  const { onCopy, onOpenArticle, onOpenMap, onShare } = usePointListExternalActionsModel({
    baseUrl,
    buildMapUrl,
    openExternal,
  });

  const keyExtractor = useCallback((item: Point) => item.id, []);
  const renderItem = useCallback(
    ({ item }: { item: Point }) => {
      const itemModel = createPointListItemModel({
        addingPointId,
        baseUrl,
        buildAppleMapsUrl,
        buildMapUrl,
        buildOsmUrl,
        buildYandexMapsUrl,
        getCategoryLabel: normalizeCategoryNameToString,
        getImageUrl: getOptimizedImageUrl,
        item,
        onAddPoint: handleAddPoint,
        onCopy,
        onOpenArticle,
        onOpenMap,
        onPointCardPress,
        onShare,
        openExternal,
      });

      return (
        <PointListCardRenderer
          colors={colors}
          isMobile={isMobile}
          item={item}
          itemModel={itemModel}
          numColumns={numColumns}
          onCopy={onCopy}
          onOpenMap={onOpenMap}
          onOpenGoogleMap={() => void openExternal(buildMapUrl(item.coord))}
          onOpenAppleMap={() => void openExternal(buildAppleMapsUrl(item.coord))}
          onOpenYandexMap={() => void openExternal(buildYandexMapsUrl(item.coord))}
          onOpenOsmMap={() => void openExternal(buildOsmUrl(item.coord))}
          onPointCardPress={onPointCardPress}
          onShare={onShare}
          responsive={responsive}
          styles={styles}
        />
      );
    },
    [
      addingPointId,
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
      <PointListToggleButton
        colors={colors}
        globalFocusStyle={globalFocusStyles.focusable}
        onPress={() => setShowList((p) => !p)}
        shouldShowToggleTextCompact={shouldShowToggleTextCompact}
        showList={showList}
        styles={styles}
        toggleLabel={toggleLabel}
      />

      {/* P2-5: Компактное превью первых 3 точек когда список свёрнут */}
      {shouldShowPreview && (
        <PointListPreview
          hiddenPreviewCount={hiddenPreviewCount}
          onPress={() => setShowList(true)}
          previewPoints={previewPoints}
          styles={styles}
        />
      )}

      {shouldShowViewModeBar && (
        <PointListViewModeBar
          colors={colors}
          onSelect={setViewMode}
          styles={styles}
          viewMode={viewMode}
        />
      )}

      {showList && (
        <PointListExpandedContent
          addingPointId={addingPointId}
          buildMapUrl={buildMapUrl}
          buildOsmUrl={buildOsmUrl}
          buildYandexMapsUrl={buildYandexMapsUrl}
          colors={colors}
          getCategoryLabel={normalizeCategoryNameToString}
          getImageUrl={getOptimizedImageUrl}
          handleAddPoint={handleAddPoint}
          keyExtractor={keyExtractor}
          numColumns={numColumns}
          onCopy={onCopy}
          onOpenMap={onOpenMap}
          onPointCardPress={onPointCardPress}
          onShare={onShare}
          openExternal={openExternal}
          renderItem={renderItem}
          safePoints={safePoints}
          shouldRenderNativeList={shouldRenderNativeList}
          shouldRenderWebCardsMode={shouldRenderWebCardsMode}
          shouldRenderWebListMode={shouldRenderWebListMode}
          styles={styles}
        />
      )}
    </View>
  );
};

export default React.memo(PointList);
