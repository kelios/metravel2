import React, { memo } from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import Button, { type ButtonProps } from '@/components/ui/Button';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useResponsive } from '@/hooks/useResponsive';

export type ToolAction = {
  key: string;
  /** Осмысленный текст действия: подпись на desktop и accessibilityLabel в icon-only режиме. */
  label: string;
  /**
   * Короткая подпись для compact-режима (mobile web / Android / iPhone).
   *
   * Нужна там, где иконка НЕ «говорящая» и одна на несколько действий: три
   * кнопки с одинаковым `download` (GPX / KML / оригинал) в icon-only виде
   * неразличимы — TestFlight 1.0.5 (8), «иконки непонятные что они значат».
   * `docs/DESIGN_SYSTEM.md` для такого случая прямо требует подпись.
   *
   * Слово должно быть коротким (`GPX`, `KML`, `Оригинал`), а полное название
   * действия по-прежнему уходит в `accessibilityLabel`. Без этого поля
   * поведение прежнее — icon-only.
   */
  compactLabel?: string;
  icon: React.ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: ButtonProps['variant'];
  testID?: string;
};

type ToolActionsRowProps = {
  actions: ToolAction[];
  size?: ButtonProps['size'];
  style?: StyleProp<ViewStyle>;
  /**
   * Принудительный режим. По умолчанию берётся из вьюпорта: mobile web и Android
   * получают icon-only, desktop — icon + подпись.
   */
  compact?: boolean;
  /**
   * Кнопки делят ширину ряда: одна занимает его целиком, две — поровну. Это
   * раскладка блока, где действия — главное содержимое (блок «Файл маршрута»,
   * #2053), а не ряд инструментов рядом с полем.
   */
  fill?: boolean;
};

/**
 * Ряд второстепенных инструментов рядом с полем/секцией (диктовка, импорт,
 * вставка, копирование и т.п.).
 *
 * Шаблон один для всех поверхностей:
 * - desktop web — icon + подпись;
 * - mobile web, Android и iPhone — icon-only 44/48dp в ОДНУ строку, подпись
 *   уходит в accessibilityLabel;
 * - действие с `compactLabel` остаётся подписанным и на телефоне: короткое
 *   слово рядом с иконкой.
 *
 * Подписанная кнопка (обычная или с `compactLabel`) не сжимается уже своей
 * подписи: не хватает ширины — ряд переносит кнопку, а подпись длиннее ряда
 * встаёт в две строки. Сжатие ради одной строки превращало подпись в «G.», а на
 * 320dp — в пустую кнопку с одной иконкой (#2053). Одной строкой держится
 * только icon-only ряд: его кнопки фиксированного размера.
 *
 * Так вспомогательные действия не съедают экран телефона тремя полноразмерными
 * кнопками с подписями. Первичное действие шага (Сохранить/Далее) сюда не
 * кладём: у него подпись обязательна на любой ширине.
 */
function ToolActionsRow({ actions, size = 'sm', style, compact, fill = false }: ToolActionsRowProps) {
  const { isHydrated, isMobile } = useResponsive();
  const isCompact = compact ?? (isHydrated && isMobile);
  const visibleActions = actions.filter(Boolean);
  const iconOnlyRow = isCompact && visibleActions.every((action) => !action.compactLabel);

  if (visibleActions.length === 0) return null;

  return (
    <View style={[styles.row, iconOnlyRow && styles.rowIconOnly, style]}>
      {visibleActions.map((action) => {
        const compactLabelled = isCompact && !!action.compactLabel;
        const iconOnly = isCompact && !compactLabelled;
        return (
          <Button
            key={action.key}
            size={size}
            variant={action.variant ?? 'outline'}
            label={compactLabelled ? (action.compactLabel as string) : action.label}
            // Полное название действия остаётся именем кнопки для VoiceOver и
            // TalkBack даже тогда, когда видимая подпись сокращена до «GPX».
            accessibilityLabel={action.label}
            icon={action.icon}
            iconOnly={iconOnly}
            labelNumberOfLines={2}
            loading={action.loading}
            disabled={action.disabled}
            onPress={action.onPress}
            testID={action.testID}
            style={[
              iconOnly
                ? styles.compactButton
                : compactLabelled
                  ? styles.compactLabelledButton
                  : styles.button,
              fill && styles.fillButton,
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: DESIGN_TOKENS.spacing.xs,
  },
  rowIconOnly: {
    // Icon-only ряд обязан оставаться одной строкой: перенос вернул бы ту же
    // «лестницу» из кнопок, из-за которой шаблон и появился.
    flexWrap: 'nowrap',
  },
  // Подписанная кнопка шириной не меньше своей подписи: `flexShrink: 0`, а
  // потолок — ширина ряда, дальше подпись переносится на вторую строку.
  button: {
    flexShrink: 0,
    maxWidth: '100%',
    justifyContent: 'center',
    paddingVertical: DESIGN_TOKENS.spacing.xs,
  },
  compactButton: {
    flexGrow: 0,
    flexShrink: 0,
    minWidth: Platform.OS === 'android' ? 48 : DESIGN_TOKENS.touchTarget.minWidth,
    minHeight: Platform.OS === 'android' ? 48 : DESIGN_TOKENS.touchTarget.minHeight,
  },
  // Подписанная кнопка в compact-ряду: ширину задаёт короткое слово, поэтому
  // floor тач-таргета держит только высота. Узкие горизонтальные паддинги
  // перебивают `sizeStyles.sm` кнопки (они применяются раньше `style`).
  compactLabelledButton: {
    flexGrow: 0,
    flexShrink: 0,
    maxWidth: '100%',
    paddingHorizontal: DESIGN_TOKENS.spacing.xs,
    minHeight: Platform.OS === 'android' ? 48 : DESIGN_TOKENS.touchTarget.minHeight,
  },
  // Ширину кнопки задаёт ряд, поэтому горизонтальный паддинг минимальный: место
  // остаётся подписи, и две кнопки дольше помещаются в одну строку.
  fillButton: {
    flexGrow: 1,
    paddingHorizontal: DESIGN_TOKENS.spacing.xs,
  },
});

export default memo(ToolActionsRow);
