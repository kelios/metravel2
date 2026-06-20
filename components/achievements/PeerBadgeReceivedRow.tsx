import { memo } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';
import type { PeerBadgeReceived } from '@/api/achievements';
import BadgeMedal from '@/components/achievements/BadgeMedal';

interface Props {
  items: PeerBadgeReceived[];
  size?: number;
  title?: string | null;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

function PeerBadgeReceivedRow({ items, size = 56, title = 'От сообщества', testID, style }: Props) {
  const colors = useThemedColors();
  const styles = getStyles(colors, size);

  if (items.length === 0) return null;

  return (
    <View style={style} testID={testID}>
      {title ? <Text style={styles.heading}>{title}</Text> : null}
      <View style={styles.row}>
        {items.map((item) => (
          <View key={item.badge.id} style={styles.item}>
            <View style={styles.medalBox}>
              <BadgeMedal badge={item.badge} size={size} earned />
              <View style={styles.countPill}>
                <Text style={styles.countText}>{item.count}</Text>
              </View>
            </View>
            <Text style={styles.name} numberOfLines={2}>
              {item.badge.name}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const getStyles = (colors: ReturnType<typeof useThemedColors>, size: number) =>
  StyleSheet.create({
    heading: {
      fontSize: DESIGN_TOKENS.typography.sizes.sm,
      fontWeight: '700',
      color: colors.text,
      marginBottom: DESIGN_TOKENS.spacing.sm,
    },
    row: { flexDirection: 'row', flexWrap: 'wrap', gap: DESIGN_TOKENS.spacing.md },
    item: { alignItems: 'center', width: size + 8 },
    medalBox: { width: size, height: size },
    countPill: {
      position: 'absolute',
      top: -4,
      right: -8,
      minWidth: 22,
      height: 22,
      borderRadius: 999,
      paddingHorizontal: 6,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
      borderWidth: 2,
      borderColor: colors.surface,
    },
    countText: {
      color: colors.textOnPrimary,
      fontSize: 11,
      fontWeight: '800',
    },
    name: {
      marginTop: DESIGN_TOKENS.spacing.xs,
      fontSize: DESIGN_TOKENS.typography.sizes.xs,
      color: colors.textMuted,
      textAlign: 'center',
      maxWidth: size + 8,
    },
  });

export default memo(PeerBadgeReceivedRow);
