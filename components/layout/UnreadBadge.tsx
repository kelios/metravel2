import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';

type UnreadBadgeProps = {
  count: number;
  maxDisplay?: number;
};

/**
 * Reusable badge for unread message count.
 */
function UnreadBadge({ count, maxDisplay = 99 }: UnreadBadgeProps) {
  const colors = useThemedColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  if (count <= 0) return null;

  const displayText = count > maxDisplay ? `${maxDisplay}+` : String(count);

  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>{displayText}</Text>
    </View>
  );
}

const createStyles = (colors: ThemedColors) =>
  StyleSheet.create({
    badge: {
      position: 'absolute',
      top: -4,
      right: -6,
      backgroundColor: colors.primary,
      borderRadius: 8,
      minWidth: 16,
      height: 16,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 4,
    },
    badgeText: {
      color: colors.textOnPrimary,
      fontSize: 10,
      fontWeight: '700',
    },
  });

export default React.memo(UnreadBadge);
