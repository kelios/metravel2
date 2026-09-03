import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
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

/** Видимый кружок «очистить группу» — размер прежний. */
const CLEAR_BUTTON_SIZE = 26;
/**
 * Тач-таргет — прозрачная рамка вокруг кружка (#1734). Рамка вынесена в
 * отрицательные поля, поэтому шапка группы фильтров не растёт: `hitSlop` тут не
 * помог бы, ряд обтягивает кнопку вплотную и срезает добор.
 */
const CLEAR_BUTTON_TOUCH_SIZE = DESIGN_TOKENS.touchTarget.minWidth;
const CLEAR_BUTTON_TOUCH_INSET = (CLEAR_BUTTON_TOUCH_SIZE - CLEAR_BUTTON_SIZE) / 2;

const styles = StyleSheet.create({
  touchFrame: {
    width: CLEAR_BUTTON_TOUCH_SIZE,
    height: CLEAR_BUTTON_TOUCH_SIZE,
    margin: -CLEAR_BUTTON_TOUCH_INSET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circle: {
    width: CLEAR_BUTTON_SIZE,
    height: CLEAR_BUTTON_SIZE,
    borderRadius: DESIGN_TOKENS.radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

const GroupClearButton = memo(({ onPress, count, colors }: GroupClearButtonProps) => (
  <CardActionPressable
    onPress={onPress}
    title={i18nT('travel:components.listTravel.filters.GroupClearButton.ochistit_value1_vybrannyh_72bd2495', { value1: count })}
    style={styles.touchFrame}
    accessibilityRole="button"
    accessibilityLabel={i18nT('travel:components.listTravel.filters.GroupClearButton.ochistit_value1_vybrannyh_72bd2495', { value1: count })}
  >
    <View style={[styles.circle, { backgroundColor: colors.brandSoft }]}>
      <Feather name="x" size={14} color={colors.brandText} />
    </View>
  </CardActionPressable>
));

GroupClearButton.displayName = 'GroupClearButton';

export default GroupClearButton;
