import React, { memo } from 'react';
import { Text, Platform } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';
import CardActionPressable from '@/components/ui/CardActionPressable';

interface GroupClearButtonProps {
  onPress: () => void;
  count: number;
  colors: ReturnType<typeof useThemedColors>;
}

const GroupClearButton = memo(({ onPress, count, colors }: GroupClearButtonProps) => (
  <CardActionPressable
    onPress={onPress}
    title={`Очистить ${count} выбранных`}
    style={{
      paddingHorizontal: DESIGN_TOKENS.spacing.xs,
      paddingVertical: 2,
      borderRadius: DESIGN_TOKENS.radii.pill,
      backgroundColor: colors.dangerSoft,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      ...(Platform.OS === 'web' ? { cursor: 'pointer' } : {}),
    }}
    accessibilityRole="button"
    accessibilityLabel={`Очистить ${count} выбранных`}
  >
    <Feather name="x" size={12} color={colors.danger} />
    <Text style={{
      fontSize: DESIGN_TOKENS.typography.sizes.xs,
      color: colors.danger,
      fontWeight: DESIGN_TOKENS.typography.weights.medium as any,
    }} numberOfLines={1}>
      Очистить
    </Text>
  </CardActionPressable>
));

GroupClearButton.displayName = 'GroupClearButton';

export default GroupClearButton;

