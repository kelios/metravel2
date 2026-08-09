import { useMemo } from 'react';
import { View, Pressable, StyleSheet, Platform, ViewStyle } from 'react-native';
import { useThemedColors } from '@/hooks/useTheme';
import { translate as i18nT } from '@/i18n'


interface ToggleProps {
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  style?: ViewStyle;
  /**
   * Если Toggle вложен в строку, которая сама несёт role="switch"
   * (см. FiltersPanelMapSettings), делаем его презентационным, чтобы не было
   * вложенных switch (a11y-антипаттерн): без role и без aria-checked.
   */
  presentational?: boolean;
}

export const Toggle: React.FC<ToggleProps> = ({
  value,
  onValueChange,
  disabled = false,
  style,
  presentational = false,
}) => {
  const colors = useThemedColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  // RN Web прокидывает aria-* напрямую в DOM, в отличие от accessibilityState
  // (checked НЕ маппится в aria-checked в react-native-web Expo 55).
  const ariaProps = presentational
    ? ({ 'aria-hidden': true, accessibilityElementsHidden: true } as any)
    : ({
        accessibilityRole: 'switch',
        accessibilityState: { checked: value, disabled },
        accessibilityLabel: value ? i18nT('shared:components.ui.Toggle.vklyucheno_f9570372') : i18nT('shared:components.ui.Toggle.vyklyucheno_b3b084c0'),
        'aria-checked': value,
        'aria-disabled': disabled || undefined,
      } as any);

  return (
    <Pressable
      style={[styles.toggle, style]}
      onPress={(e: any) => {
        if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
        if (!disabled) onValueChange(!value);
      }}
      focusable={!presentational}
      {...ariaProps}
    >
      <View
        style={[
          styles.toggleTrack,
          value && styles.toggleTrackActive,
          disabled && styles.toggleTrackDisabled,
        ]}
      >
        <View
          style={[
            styles.thumb,
            value && styles.thumbActive
          ]}
        />
      </View>
    </Pressable>
  );
};

const createStyles = (colors: any) => StyleSheet.create({
  /**
   * Тач-таргет переключателя — прозрачная рамка вокруг видимой дорожки.
   * Сама дорожка остаётся 44×24: `hitSlop` здесь не помог бы, потому что строка
   * настроек обтягивает переключатель вплотную и срезает добор (#1274,
   * тот же приём, что `MAP_TOOLBAR_TOUCH_TARGET_SIZE` на тулбаре карты).
   */
  toggle: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /** Видимая дорожка: размер и вид прежние. */
  toggleTrack: {
    width: 44,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.borderLight ?? colors.border,
    padding: 2,
    justifyContent: 'center',
    transition: Platform.OS === 'web' ? 'background-color 0.2s' : undefined,
  } as any,
  toggleTrackActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  toggleTrackDisabled: {
    opacity: 0.5,
  },
  thumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.surface,
    ...(Platform.OS === 'web'
      ? ({ boxShadow: 'none', transition: 'transform 0.2s' } as any)
      : { shadowColor: 'transparent', shadowOpacity: 0, shadowRadius: 0, elevation: 0 }),
  },
  thumbActive: {
    transform: [{ translateX: 20 }],
  },
});
