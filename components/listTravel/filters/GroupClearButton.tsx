import { memo } from 'react';
import { Platform } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';
import CardActionPressable from '@/components/ui/CardActionPressable';
import { translate as i18nT } from '@/i18n'


interface GroupClearButtonProps {
  onPress: () => void;
  count: number;
  colors: ReturnType<typeof useThemedColors>;
}

const GroupClearButton = memo(({ onPress, count, colors }: GroupClearButtonProps) => (
  <CardActionPressable
    onPress={onPress}
    title={i18nT('travel:components.listTravel.filters.GroupClearButton.ochistit_value1_vybrannyh_72bd2495', { value1: count })}
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
    accessibilityLabel={i18nT('travel:components.listTravel.filters.GroupClearButton.ochistit_value1_vybrannyh_72bd2495', { value1: count })}
  >
    <Feather name="x" size={14} color={colors.brandText} />
  </CardActionPressable>
));

GroupClearButton.displayName = 'GroupClearButton';

export default GroupClearButton;
