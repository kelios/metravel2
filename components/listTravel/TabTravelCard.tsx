import React, { memo, useMemo } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { METRICS } from '@/constants/layout';
import { useResponsive } from '@/hooks/useResponsive';

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
};

function TabTravelCard({ item, onPress, badge, testID, style }: Props) {
  const { isPhone, isLargePhone } = useResponsive();
  const isMobile = isPhone || isLargePhone;

  const location = useMemo(() => {
    return [item?.city, item?.country].filter(Boolean).join(', ');
  }, [item?.city, item?.country]);

  return (
    <Pressable
      onPress={onPress}
      style={[styles.container, isMobile && styles.containerMobile, style]}
      accessibilityRole="button"
      accessibilityLabel={item?.title ?? 'Открыть'}
      testID={testID}
    >
      <View style={styles.imageContainer}>
        {item?.imageUrl ? (
          <ExpoImage
            source={{ uri: item.imageUrl }}
            style={styles.image}
            contentFit="cover"
            cachePolicy="memory-disk"
            transition={200}
          />
        ) : (
          <View style={styles.imagePlaceholder}>
            <MaterialIcons name="route" size={28} color="#9ca3af" />
          </View>
        )}

        <LinearGradient colors={['transparent', 'rgba(0,0,0,0.75)']} style={StyleSheet.absoluteFill} />

        {badge && (
          <View style={[styles.badge, { backgroundColor: badge.backgroundColor }]}>
            <MaterialIcons name={badge.icon as any} size={14} color={badge.iconColor} />
          </View>
        )}
      </View>

      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={2}>
          {item?.title || 'Без названия'}
        </Text>
        {!!location && (
          <View style={styles.metaRow}>
            <MaterialIcons name="place" size={12} color="#475569" style={{ marginRight: 4 }} />
            <Text style={styles.metaText} numberOfLines={1}>
              {location}
            </Text>
          </View>
        )}
      </View>
    </Pressable>
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
  containerMobile: {
    width: MOBILE_CARD_WIDTH,
  },
  imageContainer: {
    ...TAB_CARD_TEMPLATE.imageContainer,
  },
  image: {
    ...TAB_CARD_TEMPLATE.image,
  },
  imagePlaceholder: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 999,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(15, 23, 42, 0.12)',
  },
  content: {
    ...TAB_CARD_TEMPLATE.content,
  },
  title: {
    ...TAB_CARD_TEMPLATE.title,
  },
  metaRow: {
    ...TAB_CARD_TEMPLATE.metaRow,
  },
  metaText: {
    ...TAB_CARD_TEMPLATE.metaText,
  },
});

export default memo(TabTravelCard);
