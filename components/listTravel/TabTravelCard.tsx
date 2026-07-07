import { memo, useMemo } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { StyleSheet, Platform, View, Text } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useResponsive } from '@/hooks/useResponsive';
import { useThemedColors } from '@/hooks/useTheme';
import UnifiedTravelCard from '@/components/ui/UnifiedTravelCard';
import { formatViewCount } from '@/components/travel/utils/travelHelpers';

import { createTabCardTemplate, MOBILE_CARD_WIDTH } from './recommendationsCardTemplate';

const ICON_MARGIN_STYLE = { marginRight: 4 } as const;
const VIEW_ICON_SIZE = Platform.OS === 'web' ? 13 : 12;

export type TabTravelCardBadge = {
  icon: keyof typeof Feather.glyphMap;
  backgroundColor: string;
  iconColor: string;
};

export type TabTravelCardItem = {
  id: string | number;
  title?: string | null;
  imageUrl?: string | null;
  city?: string | null;
  country?: string | null;
  views?: number | string | null;
};

type Props = {
  item: TabTravelCardItem;
  onPress: () => void;
  badge?: TabTravelCardBadge;
  testID?: string;
  style?: StyleProp<ViewStyle>;
  layout?: 'horizontal' | 'grid';
  width?: number;
  contentMinHeight?: number;
  imageHeight?: number;
  mediaFit?: 'contain' | 'cover';
  webTouchAction?: string;
};

function TabTravelCard({
  item,
  onPress,
  badge,
  testID,
  style,
  layout = 'horizontal',
  width,
  contentMinHeight,
  imageHeight,
  mediaFit = 'contain',
  webTouchAction,
}: Props) {
  // ✅ УЛУЧШЕНИЕ: поддержка тем через useThemedColors
  const colors = useThemedColors();
  const { isPhone, isLargePhone } = useResponsive();
  const isMobile = isPhone || isLargePhone;
  const tabCardTemplate = useMemo(() => createTabCardTemplate(colors), [colors]);
  const styles = useMemo(() => createStyles(tabCardTemplate), [tabCardTemplate]);
  const resolvedWebTouchAction = useMemo(
    () => webTouchAction ?? (Platform.OS === 'web' && layout === 'horizontal' ? 'pan-x pan-y' : undefined),
    [layout, webTouchAction]
  );
  const resolvedTestID = useMemo(
    () => testID ?? `tab-travel-card-${String(item?.id ?? 'unknown')}`,
    [item?.id, testID]
  );

  const title = item?.title || 'Без названия';

  const location = useMemo(() => {
    return [item?.city, item?.country].filter(Boolean).join(', ');
  }, [item?.city, item?.country]);

  const views = Number(item?.views) || 0;
  const viewsBadge = useMemo(() => {
    if (views <= 0) return null;
    return (
      <View style={styles.viewsBadge} testID={`${resolvedTestID}-views`} pointerEvents="none">
        <Feather name="eye" size={VIEW_ICON_SIZE} color="#fff" />
        <Text style={styles.viewsBadgeText} numberOfLines={1}>
          {formatViewCount(views)}
        </Text>
      </View>
    );
  }, [resolvedTestID, styles.viewsBadge, styles.viewsBadgeText, views]);

  const contentSlot = useMemo(() => {
    return (
      <View
        testID={`${resolvedTestID}-content`}
        style={[
          styles.content,
          { backgroundColor: colors.surface },
          typeof contentMinHeight === 'number' ? { minHeight: contentMinHeight } : null
        ]}
      >
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
          {title}
        </Text>

        <View style={styles.locationRow}>
          <Feather name="map-pin" size={12} color={colors.textMuted} style={ICON_MARGIN_STYLE} />
          <Text style={[styles.locationText, { color: colors.textMuted }]} numberOfLines={1}>
            {location || ' '}
          </Text>
        </View>
      </View>
    );
  }, [colors, contentMinHeight, location, resolvedTestID, styles.content, styles.locationRow, styles.locationText, styles.title, title]);

  return (
    <UnifiedTravelCard
      title={title}
      imageUrl={item?.imageUrl || null}
      onPress={onPress}
      metaText={location || ' '}
      badge={badge}
      mediaFit={mediaFit}
      heroTitleOverlay={false}
      contentSlot={contentSlot}
      bottomRightSlot={viewsBadge}
      width={
        typeof width === 'number'
          ? width
          : layout === 'grid'
            ? undefined
            : isMobile
              ? MOBILE_CARD_WIDTH
              : (tabCardTemplate.container as any)?.width
      }
      imageHeight={typeof imageHeight === 'number' ? imageHeight : Platform.OS === 'web' ? 168 : 150}
      testID={resolvedTestID}
      style={[layout === 'grid' ? styles.containerGrid : styles.container, style]}
      webTouchAction={resolvedWebTouchAction}
      mediaProps={{
        blurBackground: true,
        allowCriticalWebBlur: true,
      }}
    />
  );
}

const createStyles = (template: ReturnType<typeof createTabCardTemplate>) => StyleSheet.create({
  container: {
    ...template.container,
    flexShrink: 0,
    marginRight: 16,
    ...Platform.select({
      web: {
        cursor: 'pointer',
      } as any,
      default: {},
    }),
  },

  containerGrid: {
    ...template.container,
    width: '100%',
    marginRight: 0,
    ...Platform.select({
      web: {
        cursor: 'pointer',
      } as any,
      default: {},
    }),
  },

  content: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    minHeight: 64,
  },

  title: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 18,
    letterSpacing: -0.2,
    minHeight: 36,
  },

  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 18,
  },

  locationText: {
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },

  viewsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 3,
    paddingHorizontal: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },

  viewsBadgeText: {
    color: '#fff',
    fontSize: Platform.OS === 'web' ? 12 : 11,
    lineHeight: Platform.OS === 'web' ? 16 : 14,
    fontWeight: '600',
  },

});

export default memo(TabTravelCard);
