import React, { memo } from 'react';
import { Pressable, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import type { ThemedColors } from '@/hooks/useTheme';

type AccountMenuSectionProps = {
  title: string;
  expanded: boolean;
  onToggle: () => void;
  colors: ThemedColors;
  styles: {
    sectionHeader: any;
    sectionHeaderActive: any;
    sectionHeaderText: any;
    sectionDivider: any;
  };
  children: React.ReactNode;
};

/**
 * Collapsible section for AccountMenu.
 * Reduces code duplication for travels, account, navigation, theme, documents sections.
 */
function AccountMenuSection({
  title,
  expanded,
  onToggle,
  colors,
  styles,
  children,
}: AccountMenuSectionProps) {
  return (
    <>
      <View style={styles.sectionDivider} />
      <Pressable
        onPress={onToggle}
        style={({ hovered, pressed }) => [
          styles.sectionHeader,
          (hovered || pressed) && styles.sectionHeaderActive,
        ]}
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityState={{ expanded }}
      >
        <Text style={styles.sectionHeaderText}>{title}</Text>
        <Feather
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={14}
          color={colors.textMuted}
        />
      </Pressable>
      {expanded && children}
    </>
  );
}

export default memo(AccountMenuSection);
