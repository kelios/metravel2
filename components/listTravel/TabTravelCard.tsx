import React, { memo, useMemo } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { StyleSheet, Platform, View, Text } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useResponsive } from '@/hooks/useResponsive';
import { useThemedColors } from '@/hooks/useTheme';
import UnifiedTravelCard from '@/components/ui/UnifiedTravelCard';

import { TAB_CARD_TEMPLATE, MOBILE_CARD_WIDTH } from './recommendationsCardTemplate';

export type TabTravelCardBadge = {
  icon: keyof typeof MaterialIcons.glyphMap;
  backgroundColor: string;
  iconColor: string;
};

export type TabTravelCardItem = {
  id: string | number;
  title?: string | null;
  imageUrl?: string | null;
  city?: string | null;
  country?: string | null;
};

type Props = {
  item: TabTravelCardItem;
  onPress: () => void;
  badge?: TabTravelCardBadge;
  testID?: string;
  style?: StyleProp<ViewStyle>;
  layout?: 'horizontal' | 'grid';
  contentMinHeight?: number;
};

function TabTravelCard({ item, onPress, badge, testID, style, layout = 'horizontal', contentMinHeight }: Props) {
  // ✅ УЛУЧШЕНИЕ: поддержка тем через useThemedColors
  const colors = useThemedColors();
  const { isPhone, isLargePhone } = useResponsive();
  const isMobile = isPhone || isLargePhone;

  const title = item?.title || 'Без названия';

  const location = useMemo(() => {
    return [item?.city, item?.country].filter(Boolean).join(', ');
  }, [item?.city, item?.country]);

  const contentSlot = useMemo(() => {
    return (
      <View
        testID={testID ? `${testID}-content` : `tab-travel-card-content-${String(item?.id ?? 'unknown')}`}
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
          <MaterialIcons name="place" size={12} color={colors.textMuted} style={{ marginRight: 4 }} />
          <Text style={[styles.locationText, { color: colors.textMuted }]} numberOfLines={1}>
            {location || ' '}
          </Text>
        </View>
      </View>
    );
  }, [colors, contentMinHeight, item?.id, location, testID, title]);

  return (
    <UnifiedTravelCard
      title={title}
      imageUrl={item?.imageUrl || null}
      onPress={onPress}
      metaText={location || ' '}
      badge={badge}
      mediaFit={Platform.OS === 'web' ? 'cover' : 'contain'}
      heroTitleOverlay={false}
      contentSlot={contentSlot}
      width={layout === 'grid' ? undefined : (isMobile ? MOBILE_CARD_WIDTH : (TAB_CARD_TEMPLATE.container as any)?.width)}
      imageHeight={Platform.OS === 'web' ? 168 : 150}
      testID={testID}
      style={[layout === 'grid' ? styles.containerGrid : styles.container, style]}
      mediaProps={{
        blurBackground: true,
      }}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    ...TAB_CARD_TEMPLATE.container,
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
    ...TAB_CARD_TEMPLATE.container,
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

});

export default memo(TabTravelCard);
