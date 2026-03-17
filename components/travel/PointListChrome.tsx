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
  hiddenPreviewCount,
  onPress,
  previewPoints,
  styles,
}: {
  hiddenPreviewCount: number;
  onPress: () => void;
  previewPoints: Array<Pick<PointLike, 'id' | 'address' | 'coord'>>;
  styles: Record<string, any>;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={styles.previewContainer}
      accessibilityRole="button"
      accessibilityLabel="Показать все точки маршрута"
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
    </Pressable>
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

export const PointListExpandedContent = React.memo(function PointListExpandedContent({
  addingPointId,
  buildMapUrl,
  buildOsmUrl,
  buildYandexMapsUrl,
  colors,
  getCategoryLabel,
  getImageUrl,
  handleAddPoint,
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
  buildYandexMapsUrl: (coordStr: string) => string;
  colors: {
    primary: string;
    textMuted: string;
  };
  getCategoryLabel: (raw: PointLike['categoryName'] | null | undefined) => string;
  getImageUrl: (url?: string, updatedAt?: string) => string | undefined;
  handleAddPoint: (point: PointLike) => void | Promise<void>;
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
        {safePoints.map((item, idx) => {
          const isAdding = addingPointId === item.id;
          const addDisabled = false;
          const categoryLabel = getCategoryLabel(item.categoryName).split(',')[0]?.trim();
          const imageUrl = getImageUrl(item.travelImageThumbUrl, item.updated_at);
          return (
            <PointListRow
              key={item.id}
              point={{
                id: item.id,
                address: item.address,
                coord: item.coord,
              }}
              categoryLabel={categoryLabel || undefined}
              imageUrl={imageUrl}
              index={idx}
              onCopy={onCopy}
              onShare={onShare}
              onOpenMap={onOpenMap}
              onOpenGoogleMap={() => void openExternal(buildMapUrl(item.coord))}
              onOpenYandexMap={() => void openExternal(buildYandexMapsUrl(item.coord))}
              onOpenOsmMap={() => void openExternal(buildOsmUrl(item.coord))}
              onAddPoint={() => {
                void handleAddPoint(item);
              }}
              addButtonLoading={isAdding}
              addButtonDisabled={addDisabled}
              onCardPress={onPointCardPress ? () => onPointCardPress(item) : undefined}
              colors={colors}
              styles={styles}
            />
          );
        })}
      </View>
    ) : shouldRenderWebCardsMode ? (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator
        contentContainerStyle={styles.horizontalListContent}
        style={styles.horizontalScroll}
      >
        {safePoints.map((item) => (
          <React.Fragment key={keyExtractor(item)}>
            {renderItem({ item })}
          </React.Fragment>
        ))}
      </ScrollView>
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
