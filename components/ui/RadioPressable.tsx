import type { KeyboardEvent } from 'react';
import { Platform, Pressable, type PressableProps } from 'react-native';

export type RadioPressableProps = Omit<PressableProps, 'onPress' | 'accessibilityRole'> & {
  onSelect: () => void;
};

/** RNW handles Enter for radios, but only enables Space for button roles. */
export default function RadioPressable({ onSelect, disabled, ...props }: RadioPressableProps) {
  const webKeyboardProps = Platform.OS === 'web' ? {
    'aria-checked': props.accessibilityState?.checked,
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
      if (disabled || (event.key !== ' ' && event.key !== 'Spacebar')) return;
      if (event.target !== event.currentTarget || event.currentTarget.ownerDocument.activeElement !== event.currentTarget) return;
      event.preventDefault();
      if (!event.repeat) onSelect();
    },
  } : {};

  return (
    <Pressable
      {...props}
      disabled={disabled}
      accessibilityRole="radio"
      onPress={onSelect}
      {...webKeyboardProps}
    />
  );
}
