// components/travel/PointList.tsx
import React, { useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  Platform,
} from 'react-native';
// ✅ УЛУЧШЕНИЕ: Импорт утилит для оптимизации изображений
import { optimizeImageUrl, buildVersionedImageUrl } from '@/utils/imageOptimization';
import { DESIGN_TOKENS } from '@/constants/designSystem';
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
  const styles = useMemo(() => createStyles(colors), [colors]);

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

/* ============================= styles ============================= */

// ✅ УЛУЧШЕНИЕ: Функция создания стилей с динамическими цветами для поддержки тем
const createStyles = (colors: ReturnType<typeof useThemedColors>) => StyleSheet.create<any>({
  wrapper: { width: '100%', marginTop: DESIGN_TOKENS.spacing.lg },

  // ✅ ИСПРАВЛЕНИЕ: Современная кнопка переключения с улучшенной интерактивностью и единой палитрой
  toggle: {
    backgroundColor: colors.surface,
    borderRadius: DESIGN_TOKENS.radii.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    marginBottom: DESIGN_TOKENS.spacing.md,
    minHeight: 48,
    ...Platform.select({
      web: {
        transition: 'background-color 0.2s ease, border-color 0.2s ease',
        cursor: 'pointer' as any,
      },
    }),
  },
  togglePressed: { 
    backgroundColor: colors.backgroundSecondary,
    borderColor: colors.border,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: DESIGN_TOKENS.spacing.sm,
    paddingVertical: DESIGN_TOKENS.spacing.md,
    paddingHorizontal: DESIGN_TOKENS.spacing.lg,
  },
  toggleText: { 
    fontSize: DESIGN_TOKENS.typography.sizes.md, 
    fontWeight: '500', 
    color: colors.text,
    letterSpacing: -0.1,
  },
  toggleTextSm: { 
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    letterSpacing: 0,
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
    color: colors.primaryText,
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
    color: colors.primaryText,
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
  horizontalScroll: {
    width: '100%',
    ...Platform.select({
      web: {
        overflowX: 'auto' as any,
        overflowY: 'hidden' as any,
        WebkitOverflowScrolling: 'touch' as any,
      },
    }),
  },
  horizontalListContent: {
    flexDirection: 'row' as any,
    gap: DESIGN_TOKENS.spacing.md,
    paddingBottom: DESIGN_TOKENS.spacing.md,
    paddingHorizontal: 4,
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
  colHorizontal: {
    width: 320,
    flexShrink: 0,
  },

  // ✅ УЛУЧШЕНИЕ: Матовая карточка без границ, только тени
  card: {
    backgroundColor: colors.surface,
    borderRadius: DESIGN_TOKENS.radii.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.borderLight,
    display: 'flex' as any,
    flexDirection: 'column' as any,
    ...Platform.select({
      web: {
        transition: 'border-color 0.2s ease',
        height: '100%',
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

  // View mode toggle bar
  viewModeBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DESIGN_TOKENS.spacing.xs,
    marginBottom: DESIGN_TOKENS.spacing.md,
    alignSelf: 'flex-end',
  },
  viewModeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: DESIGN_TOKENS.spacing.sm,
    borderRadius: DESIGN_TOKENS.radii.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...Platform.select({
      web: {
        cursor: 'pointer' as any,
        transition: 'all 0.2s ease',
      },
    }),
  },
  viewModeBtnActive: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  viewModeBtnText: {
    fontSize: DESIGN_TOKENS.typography.sizes.xs,
    fontWeight: '500',
    color: colors.textMuted,
  },
  viewModeBtnTextActive: {
    color: colors.primary,
    fontWeight: '600',
  },

  // Vertical list view
  verticalListWrap: {
    gap: DESIGN_TOKENS.spacing.xs,
  },
  listRow: {
    backgroundColor: colors.surface,
    borderRadius: DESIGN_TOKENS.radii.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    overflow: 'hidden',
    ...Platform.select({
      web: {
        transition: 'border-color 0.2s ease',
      },
    }),
  },
  listRowPressable: {
    flexDirection: 'row',
    alignItems: 'stretch',
    ...Platform.select({
      web: { cursor: 'pointer' as any },
    }),
  },
  listRowThumb: {
    width: 80,
    minHeight: 80,
    backgroundColor: colors.backgroundSecondary,
    position: 'relative',
    overflow: 'hidden',
  },
  listRowThumbPlaceholder: {
    width: 80,
    minHeight: 80,
    backgroundColor: colors.backgroundTertiary,
  },
  listRowInfo: {
    flex: 1,
    paddingVertical: DESIGN_TOKENS.spacing.sm,
    paddingHorizontal: DESIGN_TOKENS.spacing.md,
    gap: 4,
    justifyContent: 'center',
  },
  listRowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DESIGN_TOKENS.spacing.sm,
  },
  listRowBullet: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  listRowBulletText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primaryText,
  },
  listRowTitle: {
    flex: 1,
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    fontWeight: '600',
    color: colors.text,
    lineHeight: 18,
  },
  listRowCoordChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: DESIGN_TOKENS.spacing.xs,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: colors.backgroundSecondary,
  },
  listRowCoordText: {
    fontSize: 11,
    color: colors.textMuted,
    fontFamily: Platform.select({
      web: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
      default: undefined,
    }),
  },
  listRowCategory: {
    fontSize: 11,
    color: colors.textMuted,
  },
  listRowActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  listRowIconBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 28,
    height: 28,
    borderRadius: 7,
    backgroundColor: colors.backgroundSecondary ?? colors.surface,
    ...Platform.select({
      web: { cursor: 'pointer' as any },
    }),
  },
  listRowMapChip: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: colors.backgroundSecondary,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderLight,
    ...Platform.select({
      web: { cursor: 'pointer' as any },
    }),
  },
  listRowMapChipText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textMuted,
  },
  listRowAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: 'transparent',
    marginLeft: 'auto' as any,
    ...Platform.select({
      web: { cursor: 'pointer' as any },
    }),
  },
  listRowAddBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.primary,
  },
});
