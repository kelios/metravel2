import React, { memo } from 'react';
import { Platform } from 'react-native';
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
      width: 26,
      height: 26,
      borderRadius: DESIGN_TOKENS.radii.pill,
      backgroundColor: colors.brandSoft,
      alignItems: 'center',
      justifyContent: 'center',
      ...(Platform.OS === 'web' ? { cursor: 'pointer' } : {}),
    }}
    accessibilityRole="button"
    accessibilityLabel={`Очистить ${count} выбранных`}
  >
    <Feather name="x" size={14} color={colors.brandText} />
  </CardActionPressable>
));

GroupClearButton.displayName = 'GroupClearButton';

export default GroupClearButton;
