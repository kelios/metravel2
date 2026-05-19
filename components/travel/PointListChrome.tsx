import React from 'react';
import Feather from '@expo/vector-icons/Feather';
import { FlashList } from '@shopify/flash-list';
import {
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';

import PointListRow from '@/components/travel/PointListRow';

type PointLike = {
  id: string;
  address: string;
  coord: string;
  categoryName?: string | { name?: string } | Array<string | { name?: string }>;
  travelImageThumbUrl?: string;
  updated_at?: string;
};

const getPointsLabel = (count: number) => {
  const mod10 = count % 10;
  const mod100 = count % 100;

  if (mod10 === 1 && mod100 !== 11) return 'точка';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'точки';
  return 'точек';
};

export const PointListToggleButton = React.memo(function PointListToggleButton({
  colors,
  globalFocusStyle,
  onPress,
  shouldShowToggleTextCompact,
  showList,
  styles,
  toggleLabel,
}: {
  colors: {
    text: string;
  };
  globalFocusStyle: any;
  onPress: () => void;
  shouldShowToggleTextCompact: boolean;
  showList: boolean;
  styles: Record<string, any>;
  toggleLabel: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.toggle, pressed && styles.togglePressed, globalFocusStyle]}
      accessibilityRole="button"
      accessibilityLabel={toggleLabel}
      accessibilityState={{ expanded: showList }}
    >
      <View style={styles.toggleRow}>
        {[
          <Feather key="icon" name="map-pin" size={22} color={colors.text} />,
          <Text key="text" style={[styles.toggleText, shouldShowToggleTextCompact && styles.toggleTextSm]}>
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
  );
});

export const PointListPreview = React.memo(function PointListPreview({
  colors,
  hiddenPreviewCount,
  onPress,
  pointsCount,
  previewPoints,
  styles,
}: {
  colors: {
    primary: string;
    textMuted: string;
  };
  hiddenPreviewCount: number;
  onPress: () => void;
  pointsCount: number;
  previewPoints: Array<Pick<PointLike, 'id' | 'address' | 'coord'>>;
  styles: Record<string, any>;
}) {
  const pointsLabel = `${pointsCount} ${getPointsLabel(pointsCount)}`;

  return (
    <Pressable
      onPress={onPress}
      style={styles.previewContainer}
      accessibilityRole="button"
      accessibilityLabel={`Открыть список точек, всего ${pointsLabel}`}
    >
      {previewPoints.map((pt, idx) => (
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
      {hiddenPreviewCount > 0 && (
        <Text style={styles.previewMore}>
          + ещё {hiddenPreviewCount}
        </Text>
      )}
      <View style={styles.previewFooter}>
        <View style={styles.previewFooterLead}>
          <Feather name="list" size={14} color={colors.primary} />
          <Text style={styles.previewFooterText}>
            Открыть список: {pointsLabel}
          </Text>
        </View>
        <Feather name="chevron-right" size={16} color={colors.primary} />
      </View>
    </Pressable>
  );
});

export const PointListStatus = React.memo(function PointListStatus({
  isInteractiveOpen,
  pointCount,
  showList,
  styles,
  viewMode,
}: {
  isInteractiveOpen: boolean;
  pointCount: number;
  showList: boolean;
  styles: Record<string, any>;
  viewMode: 'cards' | 'list';
}) {
  const pointsLabel = `${pointCount} ${getPointsLabel(pointCount)}`;

  const title = showList
    ? (viewMode === 'list' ? 'Быстрый список точек' : 'Карточки точек')
    : 'Точки маршрута';
  const description = showList
    ? (
      isInteractiveOpen
        ? 'Клик по точке открывает её детали, остальные кнопки остаются вторичными.'
        : 'Клик по точке сразу открывает координаты на карте, кнопки рядом дают быстрые действия.'
    )
    : 'Раскройте список, чтобы выбрать точку быстрее, чем искать её вручную на карте.';

  return (
    <View style={styles.statusCard} testID="point-list-status">
      <View style={styles.statusHeader}>
        <View style={styles.statusTextWrap}>
          <Text style={styles.statusTitle}>{title}</Text>
          <Text style={styles.statusHint}>{description}</Text>
        </View>
        <View style={styles.statusBadge}>
          <Text style={styles.statusBadgeText}>{pointsLabel}</Text>
        </View>
      </View>
    </View>
  );
});

export const PointListViewModeBar = React.memo(function PointListViewModeBar({
  colors,
  onSelect,
  styles,
  viewMode,
}: {
  colors: {
    primary: string;
    textMuted: string;
  };
  onSelect: (mode: 'cards' | 'list') => void;
  styles: Record<string, any>;
  viewMode: 'cards' | 'list';
}) {
  return (
    <View style={styles.viewModeBar}>
      <Pressable
        onPress={() => onSelect('cards')}
        style={[styles.viewModeBtn, viewMode === 'cards' && styles.viewModeBtnActive]}
        accessibilityRole="button"
        accessibilityLabel="Карточки"
        accessibilityState={{ selected: viewMode === 'cards' }}
      >
        <Feather name="grid" size={16} color={viewMode === 'cards' ? colors.primary : colors.textMuted} />
        <Text style={[styles.viewModeBtnText, viewMode === 'cards' && styles.viewModeBtnTextActive]}>
          Карточки
        </Text>
      </Pressable>
      <Pressable
        onPress={() => onSelect('list')}
        style={[styles.viewModeBtn, viewMode === 'list' && styles.viewModeBtnActive]}
        accessibilityRole="button"
        accessibilityLabel="Список"
        accessibilityState={{ selected: viewMode === 'list' }}
      >
        <Feather name="list" size={16} color={viewMode === 'list' ? colors.primary : colors.textMuted} />
        <Text style={[styles.viewModeBtnText, viewMode === 'list' && styles.viewModeBtnTextActive]}>
          Список
        </Text>
      </Pressable>
    </View>
  );
});

type WebPointListRowProps = {
  item: PointLike;
  index: number;
  isAdding: boolean;
  getCategoryLabel: (raw: PointLike['categoryName'] | null | undefined) => string;
  getImageUrl: (url?: string, updatedAt?: string) => string | undefined;
  buildMapUrl: (coordStr: string) => string;
  buildOsmUrl: (coordStr: string) => string;
  buildWazeUrl?: (coordStr: string) => string;
  buildYandexMapsUrl: (coordStr: string) => string;
  buildYandexNaviUrl?: (coordStr: string) => string;
  openExternal: (url: string) => void | Promise<void>;
  onCopy: (coordStr: string) => void | Promise<void>;
  onShare: (coordStr: string) => void | Promise<void>;
  onOpenMap: (coordStr: string) => void | Promise<void>;
  handleAddPoint: (point: PointLike) => void | Promise<void>;
  onPointCardPress?: (point: PointLike) => void;
  colors: { primary: string; textMuted: string };
  styles: Record<string, any>;
};

const WebPointListRow = React.memo(function WebPointListRow({
  item,
  index,
  isAdding,
  getCategoryLabel,
  getImageUrl,
  buildMapUrl,
  buildOsmUrl,
  buildWazeUrl,
  buildYandexMapsUrl,
  buildYandexNaviUrl,
  openExternal,
  onCopy,
  onShare,
  onOpenMap,
  handleAddPoint,
  onPointCardPress,
  colors,
  styles,
}: WebPointListRowProps) {
  const categoryLabel = getCategoryLabel(item.categoryName).split(',')[0]?.trim();
  const imageUrl = getImageUrl(item.travelImageThumbUrl, item.updated_at);

  return (
    <PointListRow
      point={{ id: item.id, address: item.address, coord: item.coord }}
      categoryLabel={categoryLabel || undefined}
      imageUrl={imageUrl}
      index={index}
      onCopy={onCopy}
      onShare={onShare}
      onOpenMap={onOpenMap}
      onOpenGoogleMap={() => void openExternal(buildMapUrl(item.coord))}
      onOpenYandexMap={() => void openExternal(buildYandexMapsUrl(item.coord))}
      onOpenOsmMap={() => void openExternal(buildOsmUrl(item.coord))}
      onOpenWaze={buildWazeUrl ? () => void openExternal(buildWazeUrl(item.coord)) : undefined}
      onOpenYandexNavi={
        buildYandexNaviUrl ? () => void openExternal(buildYandexNaviUrl(item.coord)) : undefined
      }
      onAddPoint={() => {
        void handleAddPoint(item);
      }}
      addButtonLoading={isAdding}
      addButtonDisabled={false}
      onCardPress={onPointCardPress ? () => onPointCardPress(item) : undefined}
      colors={colors}
      styles={styles}
    />
  );
});

const RenderItemSlot = React.memo(function RenderItemSlot({
  renderItem,
  item,
}: {
  renderItem: ({ item }: { item: PointLike }) => React.ReactElement;
  item: PointLike;
}) {
  return renderItem({ item });
});

export const PointListExpandedContent = React.memo(function PointListExpandedContent({
  addingPointId,
  buildMapUrl,
  buildOsmUrl,
  buildWazeUrl,
  buildYandexMapsUrl,
  buildYandexNaviUrl,
  colors,
  getCategoryLabel,
  getImageUrl,
  handleAddPoint,
  isWebGrid,
  keyExtractor,
  numColumns,
  onCopy,
  onOpenMap,
  onPointCardPress,
  onShare,
  openExternal,
  renderItem,
  safePoints,
  shouldRenderNativeList,
  shouldRenderWebCardsMode,
  shouldRenderWebListMode,
  styles,
}: {
  addingPointId: string | null;
  buildMapUrl: (coordStr: string) => string;
  buildOsmUrl: (coordStr: string) => string;
  buildWazeUrl?: (coordStr: string) => string;
  buildYandexMapsUrl: (coordStr: string) => string;
  buildYandexNaviUrl?: (coordStr: string) => string;
  colors: {
    primary: string;
    textMuted: string;
  };
  getCategoryLabel: (raw: PointLike['categoryName'] | null | undefined) => string;
  getImageUrl: (url?: string, updatedAt?: string) => string | undefined;
  handleAddPoint: (point: PointLike) => void | Promise<void>;
  isWebGrid?: boolean;
  keyExtractor: (item: PointLike) => string;
  numColumns: number;
  onCopy: (coordStr: string) => void | Promise<void>;
  onOpenMap: (coordStr: string) => void | Promise<void>;
  onPointCardPress?: (point: PointLike) => void;
  onShare: (coordStr: string) => void | Promise<void>;
  openExternal: (url: string) => void | Promise<void>;
  renderItem: ({ item }: { item: PointLike }) => React.ReactElement;
  safePoints: PointLike[];
  shouldRenderNativeList: boolean;
  shouldRenderWebCardsMode: boolean;
  shouldRenderWebListMode: boolean;
  styles: Record<string, any>;
}) {
  return Platform.OS === 'web' ? (
    shouldRenderWebListMode ? (
      <View style={styles.verticalListWrap}>
        {safePoints.map((item, idx) => (
          <WebPointListRow
            key={item.id}
            item={item}
            index={idx}
            isAdding={addingPointId === item.id}
            getCategoryLabel={getCategoryLabel}
            getImageUrl={getImageUrl}
            buildMapUrl={buildMapUrl}
            buildOsmUrl={buildOsmUrl}
            buildWazeUrl={buildWazeUrl}
            buildYandexMapsUrl={buildYandexMapsUrl}
            buildYandexNaviUrl={buildYandexNaviUrl}
            openExternal={openExternal}
            onCopy={onCopy}
            onShare={onShare}
            onOpenMap={onOpenMap}
            handleAddPoint={handleAddPoint}
            onPointCardPress={onPointCardPress}
            colors={colors}
            styles={styles}
          />
        ))}
      </View>
    ) : shouldRenderWebCardsMode ? (
      isWebGrid ? (
        <View style={styles.webGridWrap}>
          {safePoints.map((item) => (
            <RenderItemSlot key={keyExtractor(item)} renderItem={renderItem} item={item} />
          ))}
        </View>
      ) : (
        <ScrollView
          testID="travel-points-rail"
          horizontal
          showsHorizontalScrollIndicator
          contentContainerStyle={styles.horizontalListContent}
          style={styles.horizontalScroll}
        >
          {safePoints.map((item) => (
            <RenderItemSlot key={keyExtractor(item)} renderItem={renderItem} item={item} />
          ))}
        </ScrollView>
      )
    ) : null
  ) : (
    shouldRenderNativeList ? <FlashList
      key={`cols-${numColumns}`}
      data={safePoints as any}
      renderItem={renderItem as any}
      numColumns={numColumns as any}
      keyExtractor={keyExtractor as any}
      {...({ estimatedItemSize: 200 } as any)}
      contentContainerStyle={styles.listContent as any}
      {...(numColumns > 1 ? ({ columnWrapperStyle: styles.columnWrap } as any) : null)}
    /> : null
  );
});
