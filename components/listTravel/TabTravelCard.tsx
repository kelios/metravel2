import React, { memo, useMemo } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { StyleSheet, Platform, View, Text } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useResponsive } from '@/hooks/useResponsive';
import { useThemedColors } from '@/hooks/useTheme';
import UnifiedTravelCard from '@/components/ui/UnifiedTravelCard';

import { createTabCardTemplate, MOBILE_CARD_WIDTH } from './recommendationsCardTemplate';

const ICON_MARGIN_STYLE = { marginRight: 4 } as const;

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
  const tabCardTemplate = useMemo(() => createTabCardTemplate(colors), [colors]);
  const styles = useMemo(() => createStyles(tabCardTemplate), [tabCardTemplate]);

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
          <Feather name="map-pin" size={12} color={colors.textMuted} style={ICON_MARGIN_STYLE} />
          <Text style={[styles.locationText, { color: colors.textMuted }]} numberOfLines={1}>
            {location || ' '}
          </Text>
        </View>
      </View>
    );
  }, [colors, contentMinHeight, item?.id, location, styles.content, styles.locationRow, styles.locationText, styles.title, testID, title]);

  return (
    <UnifiedTravelCard
      title={title}
      imageUrl={item?.imageUrl || null}
      onPress={onPress}
      metaText={location || ' '}
      badge={badge}
      mediaFit="contain"
      heroTitleOverlay={false}
      contentSlot={contentSlot}
      width={layout === 'grid' ? undefined : (isMobile ? MOBILE_CARD_WIDTH : (tabCardTemplate.container as any)?.width)}
      imageHeight={Platform.OS === 'web' ? 168 : 150}
      testID={testID}
      style={[layout === 'grid' ? styles.containerGrid : styles.container, style]}
      mediaProps={{
        blurBackground: true,
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

});

export default memo(TabTravelCard);
