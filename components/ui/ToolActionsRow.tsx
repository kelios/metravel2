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
   * Слово должно быть коротким (`GPX`, `KML`, `Оригинал`): ряд остаётся одной
   * строкой, а полное название действия по-прежнему уходит в
   * `accessibilityLabel`. Без этого поля поведение прежнее — icon-only.
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
 *   слово рядом с иконкой, ряд по-прежнему одна строка.
 *
 * Так вспомогательные действия не съедают экран телефона тремя полноразмерными
 * кнопками с подписями. Первичное действие шага (Сохранить/Далее) сюда не
 * кладём: у него подпись обязательна на любой ширине.
 */
function ToolActionsRow({ actions, size = 'sm', style, compact }: ToolActionsRowProps) {
  const { isHydrated, isMobile } = useResponsive();
  const isCompact = compact ?? (isHydrated && isMobile);
  const visibleActions = actions.filter(Boolean);

  if (visibleActions.length === 0) return null;

  return (
    <View style={[styles.row, isCompact && styles.rowCompact, style]}>
      {visibleActions.map((action) => {
        const compactLabelled = isCompact && !!action.compactLabel;
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
            iconOnly={isCompact && !compactLabelled}
            loading={action.loading}
            disabled={action.disabled}
            onPress={action.onPress}
            testID={action.testID}
            style={
              isCompact
                ? compactLabelled
                  ? styles.compactLabelledButton
                  : styles.compactButton
                : styles.button
            }
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
  rowCompact: {
    // Icon-only ряд обязан оставаться одной строкой: перенос вернул бы ту же
    // «лестницу» из кнопок, из-за которой шаблон и появился.
    flexWrap: 'nowrap',
  },
  button: {
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
  // floor тач-таргета держит только высота. `flexShrink: 1` и узкие
  // горизонтальные паддинги (перебивают `sizeStyles.sm` кнопки, они применяются
  // раньше `style`) оставляют ряд одной строкой и на 320dp.
  compactLabelledButton: {
    flexGrow: 0,
    flexShrink: 1,
    paddingHorizontal: DESIGN_TOKENS.spacing.xs,
    minHeight: Platform.OS === 'android' ? 48 : DESIGN_TOKENS.touchTarget.minHeight,
  },
});

export default memo(ToolActionsRow);
