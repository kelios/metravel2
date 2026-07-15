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
import { selectPlural, translate as i18nT } from '@/i18n'


type PointLike = {
  id: string;
  address: string;
  coord: string;
  categoryName?: string | { name?: string } | Array<string | { name?: string }>;
  travelImageThumbUrl?: string;
  updated_at?: string;
};

const getPointsLabel = (count: number) => {
  return selectPlural(count, {
    one: i18nT('travel:components.travel.PointListChrome.tochka_b56842ff'),
    few: i18nT('travel:components.travel.PointListChrome.tochki_2fec67ae'),
    many: i18nT('travel:components.travel.PointListChrome.tochek_fe4d794f'),
    other: i18nT('travel:components.travel.PointListChrome.tochek_fe4d794f'),
  });
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
    primaryDark: string;
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
      accessibilityLabel={i18nT('travel:components.travel.PointListChrome.otkryt_spisok_tochek_vsego_value1_09ce7a60', { value1: pointsLabel })}
    >
      {previewPoints.map((pt, idx) => (
        <View key={pt.id} style={styles.previewRow}>
          <View style={styles.previewBullet}>
            <Text style={styles.previewBulletText}>{idx + 1}</Text>
          </View>
          <View style={styles.previewTextWrap}>
            <Text style={styles.previewAddress} numberOfLines={1}>
              {pt.address || i18nT('travel:common.noAddress')}
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
          {i18nT('travel:components.travel.PointListChrome.esche_11f20093')}{hiddenPreviewCount}
        </Text>
      )}
      <View style={styles.previewFooter}>
        <View style={styles.previewFooterLead}>
          <Feather name="list" size={14} color={colors.primaryDark} />
          <Text style={styles.previewFooterText}>
            {i18nT('travel:components.travel.PointListChrome.otkryt_spisok_872269f1')}{pointsLabel}
          </Text>
        </View>
        <Feather name="chevron-right" size={16} color={colors.primaryDark} />
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
    ? (viewMode === 'list' ? i18nT('travel:components.travel.PointListChrome.bystryy_spisok_tochek_ed47b401') : i18nT('travel:components.travel.PointListChrome.kartochki_tochek_0ff485ae'))
    : i18nT('travel:components.travel.PointListChrome.tochki_marshruta_aa73107a');
  const description = showList
    ? (
      isInteractiveOpen
        ? i18nT('travel:components.travel.PointListChrome.klik_po_tochke_otkryvaet_ee_detali_ostalnye__14fd857e')
        : i18nT('travel:components.travel.PointListChrome.klik_po_tochke_srazu_otkryvaet_koordinaty_na_2fc23e85')
    )
    : i18nT('travel:components.travel.PointListChrome.raskroyte_spisok_chtoby_vybrat_tochku_bystre_f9dbc826');

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
    primaryDark: string;
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
        accessibilityLabel={i18nT('travel:components.travel.PointListChrome.kartochki_681d872e')}
        accessibilityState={{ selected: viewMode === 'cards' }}
      >
        <Feather name="grid" size={16} color={viewMode === 'cards' ? colors.primary : colors.textMuted} />
        <Text style={[styles.viewModeBtnText, viewMode === 'cards' && styles.viewModeBtnTextActive]}>
          {i18nT('travel:components.travel.PointListChrome.kartochki_681d872e')}</Text>
      </Pressable>
      <Pressable
        onPress={() => onSelect('list')}
        style={[styles.viewModeBtn, viewMode === 'list' && styles.viewModeBtnActive]}
        accessibilityRole="button"
        accessibilityLabel={i18nT('travel:components.travel.PointListChrome.spisok_8a652c54')}
        accessibilityState={{ selected: viewMode === 'list' }}
      >
        <Feather name="list" size={16} color={viewMode === 'list' ? colors.primary : colors.textMuted} />
        <Text style={[styles.viewModeBtnText, viewMode === 'list' && styles.viewModeBtnTextActive]}>
          {i18nT('travel:components.travel.PointListChrome.spisok_8a652c54')}</Text>
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
  onCopy: (coordStr: string) => void | Promise<void>;
  onShare: (coordStr: string) => void | Promise<void>;
  onOpenMap: (coordStr: string) => void | Promise<void>;
  handleAddPoint: (point: PointLike) => void | Promise<void>;
  onPointCardPress?: (point: PointLike) => void;
  colors: { primary: string; primaryDark: string; textMuted: string };
  styles: Record<string, any>;
};

const WebPointListRow = React.memo(function WebPointListRow({
  item,
  index,
  isAdding,
  getCategoryLabel,
  getImageUrl,
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
  renderItem,
  safePoints,
  shouldRenderNativeList,
  shouldRenderWebCardsMode,
  shouldRenderWebListMode,
  styles,
}: {
  addingPointId: string | null;
  colors: {
    primary: string;
    primaryDark: string;
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
  renderItem: ({ item }: { item: PointLike }) => React.ReactElement;
  safePoints: PointLike[];
  shouldRenderNativeList: boolean;
  shouldRenderWebCardsMode: boolean;
  shouldRenderWebListMode: boolean;
  styles: Record<string, any>;
}) {
  const [visibleCount, setVisibleCount] = React.useState(20);
  const visiblePoints = React.useMemo(
    () => (safePoints.length > visibleCount ? safePoints.slice(0, visibleCount) : safePoints),
    [safePoints, visibleCount],
  );
  const remaining = safePoints.length - visibleCount;
  const onShowMore = React.useCallback(() => setVisibleCount((c) => c + 20), []);
  const showMoreButton =
    remaining > 0 ? (
      <Pressable
        onPress={onShowMore}
        style={({ pressed }) => [styles.toggle, pressed && styles.togglePressed]}
        accessibilityRole="button"
        accessibilityLabel={i18nT('travel:components.travel.PointListChrome.pokazat_esche_value1_tochek_f428791c', { value1: remaining })}
      >
        <View style={styles.toggleRow}>
          <Feather name="chevron-down" size={16} color={colors.primaryDark} />
          <Text style={styles.toggleText}>{i18nT('travel:components.travel.PointListChrome.pokazat_esche_value1_c2826eb5', { value1: remaining })}</Text>
        </View>
      </Pressable>
    ) : null;

  return Platform.OS === 'web' ? (
    shouldRenderWebListMode ? (
      <View style={styles.verticalListWrap}>
        {visiblePoints.map((item, idx) => (
          <WebPointListRow
            key={item.id}
            item={item}
            index={idx}
            isAdding={addingPointId === item.id}
            getCategoryLabel={getCategoryLabel}
            getImageUrl={getImageUrl}
            onCopy={onCopy}
            onShare={onShare}
            onOpenMap={onOpenMap}
            handleAddPoint={handleAddPoint}
            onPointCardPress={onPointCardPress}
            colors={colors}
            styles={styles}
          />
        ))}
        {showMoreButton}
      </View>
    ) : shouldRenderWebCardsMode ? (
      isWebGrid ? (
        <>
          <View style={styles.webGridWrap}>
            {visiblePoints.map((item) => (
              <RenderItemSlot key={keyExtractor(item)} renderItem={renderItem} item={item} />
            ))}
          </View>
          {showMoreButton}
        </>
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
