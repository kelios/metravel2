import React, { useEffect, useRef } from 'react';
import {
  Platform,
  Pressable,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

type CardActionPressableProps = {
  accessibilityLabel?: string;
  accessibilityHint?: string;
  title?: string;
  onPress?: () => void;
  onLongPress?: () => void;
  onHoverIn?: () => void;
  onHoverOut?: () => void;
  disabled?: boolean;
  accessibilityRole?: 'button' | 'radio' | 'checkbox';
  accessibilityState?: { checked?: boolean; selected?: boolean; disabled?: boolean; expanded?: boolean; busy?: boolean };
  style?: StyleProp<ViewStyle> | ((state: PressableStateCallbackType) => StyleProp<ViewStyle>);
  testID?: string;
  children: React.ReactNode;
};

export const applyWebTooltipAttributes = (
  node: {
    setAttribute?: (name: string, value: string) => void;
    removeAttribute?: (name: string) => void;
  } | null | undefined,
  tooltipText?: string | null,
) => {
  if (!node?.setAttribute) return;

  if (tooltipText) {
    node.setAttribute('title', tooltipText);
    node.setAttribute('data-tooltip', tooltipText);
    return;
  }

  node.removeAttribute?.('title');
  node.removeAttribute?.('data-tooltip');
};

const CardActionPressable = ({
  accessibilityLabel,
  accessibilityHint,
  title,
  onPress,
  onLongPress,
  onHoverIn,
  onHoverOut,
  disabled = false,
  accessibilityRole = 'button',
  accessibilityState,
  style,
  testID,
  children,
}: CardActionPressableProps) => {
  const webRef = useRef<any>(null);
  const safeChildren = React.Children.toArray(children).filter((child) => typeof child !== 'string');
  const tooltipText = title ?? accessibilityLabel;

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

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    applyWebTooltipAttributes(webRef.current, tooltipText);
  }, [tooltipText]);

  return (
    <Pressable
      ref={webRef}
      style={style}
      accessibilityRole={accessibilityRole}
      {...(accessibilityLabel ? { accessibilityLabel } : {})}
      accessibilityHint={accessibilityHint}
      accessibilityState={accessibilityState ?? { disabled }}
      disabled={disabled}
      onPress={activate}
      onLongPress={onLongPress}
      onHoverIn={onHoverIn}
      onHoverOut={onHoverOut}
      testID={testID}
      {...({ 'data-card-action': 'true' } as any)}
    >
      {safeChildren}
    </Pressable>
  );
};

export default React.memo(CardActionPressable);
