import { memo } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { DESIGN_TOKENS } from '@/constants/designSystem';
import type { Badge } from '@/api/achievements';
import BadgeMedal from '@/components/achievements/BadgeMedal';

export interface BadgeGridItem {
  badge: Badge;
  earned: boolean;
  progress?: { current: number; threshold: number } | null;
}

interface Props {
  items: BadgeGridItem[];
  size?: number;
  showLabels?: boolean;
  /** Показать описание значка («за что») под названием. */
  showDescriptions?: boolean;
  onBadgePress?: (badge: Badge) => void;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

function BadgeGrid({
  items,
  size = 72,
  showLabels = true,
  showDescriptions = false,
  onBadgePress,
  testID,
  style,
}: Props) {
  return (
    <View style={[styles.grid, style]} testID={testID}>
      {items.map((item) => (
        <BadgeMedal
          key={item.badge.id}
          badge={item.badge}
          size={size}
          earned={item.earned}
          progress={item.earned ? null : item.progress ?? null}
          showLabel={showLabels}
          showDescription={showDescriptions}
          onPress={onBadgePress ? () => onBadgePress(item.badge) : undefined}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: DESIGN_TOKENS.spacing.md,
  },
});

export default memo(BadgeGrid);
