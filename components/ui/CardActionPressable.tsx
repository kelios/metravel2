import React from 'react';
import {
  Platform,
  Pressable,
  View,
  type PressableStateCallbackType,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

type CardActionPressableProps = {
  accessibilityLabel: string;
  title?: string;
  onPress?: () => void;
  onLongPress?: () => void;
  disabled?: boolean;
  accessibilityRole?: 'button' | 'radio' | 'checkbox';
  accessibilityState?: { checked?: boolean; selected?: boolean; disabled?: boolean; expanded?: boolean; busy?: boolean };
  style?: StyleProp<ViewStyle> | ((state: PressableStateCallbackType) => StyleProp<ViewStyle>);
  testID?: string;
  children: React.ReactNode;
};

const CardActionPressable = ({
  accessibilityLabel,
  title,
  onPress,
  onLongPress,
  disabled = false,
  accessibilityRole = 'button',
  accessibilityState,
  style,
  testID,
  children,
}: CardActionPressableProps) => {
  const safeChildren = React.Children.toArray(children).filter((child) => typeof child !== 'string');

  const activate = (e?: any) => {
    if (disabled) return;
    try {
      e?.preventDefault?.();
      e?.stopPropagation?.();
    } catch {
      // noop
    }
    onPress?.();
  };

  if (Platform.OS === 'web') {
    const resolvedStyle = typeof style === 'function' ? style({ pressed: false } as any) : style;
    const resolvedState = accessibilityState ?? (disabled ? { disabled: true } : undefined);
    const ariaChecked = resolvedState?.checked;
    const ariaSelected = resolvedState?.selected;
    const ariaExpanded = resolvedState?.expanded;
    const ariaBusy = resolvedState?.busy;
    // aria-selected is only valid on tab, option, gridcell, row, treeitem roles.
    // For button/radio roles, use aria-pressed/aria-checked instead.
    const rolesAllowingSelected = new Set(['tab', 'option', 'gridcell', 'row', 'treeitem']);
    const canUseAriaSelected = rolesAllowingSelected.has(accessibilityRole);
    const ariaPressed = !canUseAriaSelected && accessibilityRole === 'button' && ariaSelected !== undefined ? ariaSelected : undefined;
    return (
      <View
        style={resolvedStyle}
        accessibilityRole={accessibilityRole}
        accessibilityLabel={accessibilityLabel}
        accessibilityState={resolvedState}
        {...({
          role: accessibilityRole,
          tabIndex: disabled ? -1 : 0,
          title: title ?? accessibilityLabel,
          'data-testid': testID,
          'aria-disabled': disabled || undefined,
          'aria-checked': ariaChecked !== undefined ? ariaChecked : undefined,
          'aria-selected': canUseAriaSelected && ariaSelected !== undefined ? ariaSelected : undefined,
          'aria-pressed': ariaPressed,
          'aria-expanded': ariaExpanded !== undefined ? ariaExpanded : undefined,
          'aria-busy': ariaBusy !== undefined ? ariaBusy : undefined,
          'data-card-action': 'true',
        } as any)}
        onClick={activate}
        onKeyDown={(e: any) => {
          if (e?.key !== 'Enter' && e?.key !== ' ') return;
          activate(e);
        }}
        testID={testID}
      >
        {safeChildren}
      </View>
    );
  }

  return (
    <Pressable
      style={style}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={accessibilityState ?? { disabled }}
      disabled={disabled}
      onPress={activate}
      onLongPress={onLongPress}
      testID={testID}
      {...({ 'data-card-action': 'true' } as any)}
    >
      {safeChildren}
    </Pressable>
  );
};

export default React.memo(CardActionPressable);
