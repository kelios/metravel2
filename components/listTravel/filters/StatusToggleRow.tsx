import { memo } from 'react';
import { Platform, Pressable, Text } from 'react-native';

import FilterCheckbox from './FilterCheckbox';
import type { createModernFiltersStyles } from './modernFiltersStyles';

type ModernFiltersStyles = ReturnType<typeof createModernFiltersStyles>;

/**
 * react-native-web 0.21 не форвардит `accessibilityState` в DOM (whitelist в
 * `modules/forwardedProps`), поэтому строка с `role="checkbox"` без явного
 * `aria-checked` читается скринридером и e2e как «не отмечена». Тем же
 * whitelist'ом отсекается и `title`, так что подсказка уходит в
 * `accessibilityHint` — единственный канал, который реально доезжает до
 * пользователя (iOS/Android). Отдаём web-пропы типизированным объектом, а не
 * кастом в `any`: guard-type-debt считает такой каст новым долгом файла.
 */
const webCheckboxProps = (checked: boolean): { 'aria-checked'?: boolean } =>
  Platform.OS === 'web' ? { 'aria-checked': checked } : {};

interface StatusToggleRowProps {
  label: string;
  /** Пояснение, что именно сужает переключатель: уходит в accessibilityHint. */
  hint?: string;
  checked: boolean;
  onToggle: () => void;
  styles: ModernFiltersStyles;
  checkColor: string;
  testID?: string;
}

/**
 * Строка-переключатель статуса публикации в панели фильтров
 * (черновики / опубликованные / на модерации). Все три взаимоисключающие:
 * onSelect в useListTravelFilters снимает соседние ключи.
 */
const StatusToggleRow = memo(({
  label,
  hint,
  checked,
  onToggle,
  styles,
  checkColor,
  testID,
}: StatusToggleRowProps) => (
  <Pressable
    testID={testID}
    onPress={onToggle}
    style={({ hovered, pressed }) => [
      styles.moderationRow,
      checked && styles.moderationRowSelected,
      (hovered || pressed) && styles.moderationRowPressed,
    ]}
    accessibilityRole="checkbox"
    accessibilityLabel={label}
    accessibilityHint={hint}
    accessibilityState={{ checked }}
    {...webCheckboxProps(checked)}
  >
    <FilterCheckbox
      checked={checked}
      checkboxStyle={styles.checkbox}
      checkboxCheckedStyle={styles.checkboxChecked}
      checkColor={checkColor}
    />
    <Text style={[styles.moderationLabel, checked && styles.moderationLabelSelected]}>
      {label}
    </Text>
  </Pressable>
));

StatusToggleRow.displayName = 'StatusToggleRow';

export default StatusToggleRow;
