import React, { memo, useMemo } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { StyleSheet, Platform, View, Text } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useResponsive } from '@/hooks/useResponsive';
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
};

function TabTravelCard({ item, onPress, badge, testID, style, layout = 'horizontal' }: Props) {
  const { isPhone, isLargePhone } = useResponsive();
  const isMobile = isPhone || isLargePhone;

  const title = item?.title || 'Без названия';

  const location = useMemo(() => {
    return [item?.city, item?.country].filter(Boolean).join(', ');
  }, [item?.city, item?.country]);

  return (
    <UnifiedTravelCard
      title={title}
      imageUrl={item?.imageUrl || null}
      onPress={onPress}
      metaText={location || ' '}
      badge={badge}
      mediaFit="contain"
      width={layout === 'grid' ? undefined : (isMobile ? MOBILE_CARD_WIDTH : (TAB_CARD_TEMPLATE.container as any)?.width)}
      imageHeight={Platform.OS === 'web' ? 200 : 180}
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
});

export default memo(TabTravelCard);
