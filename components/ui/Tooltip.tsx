import React, { useState, useRef, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  type LayoutRectangle,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { DESIGN_TOKENS } from '@/constants/designSystem';

export interface TooltipProps {
  content: string;
  children: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number;
  maxWidth?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * Tooltip компонент для подсказок
 * 
 * Особенности:
 * - Показывается при hover (web) или long press (mobile)
 * - Автоматическое позиционирование
 * - Настраиваемая задержка
 * - Accessibility support
 * 
 * @example
 * <Tooltip content="Это подсказка">
 *   <Button label="Hover me" />
 * </Tooltip>
 */
function Tooltip({
  content,
  children,
  position = 'top',
  delay = 500,
  maxWidth = 200,
  style,
}: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const [layout, setLayout] = useState<LayoutRectangle | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showTooltip = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      setVisible(true);
    }, delay);
  };

  const hideTooltip = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setVisible(false);
  };

  const handleLayout = (event: any) => {
    setLayout(event.nativeEvent.layout);
  };

  return (
    <View style={[styles.container, style]} onLayout={handleLayout}>
      <Pressable
        onHoverIn={Platform.OS === 'web' ? showTooltip : undefined}
        onHoverOut={Platform.OS === 'web' ? hideTooltip : undefined}
        onLongPress={Platform.OS !== 'web' ? showTooltip : undefined}
        onPressOut={Platform.OS !== 'web' ? hideTooltip : undefined}
        accessible={true}
        accessibilityHint={content}
      >
        {children}
      </Pressable>

      {visible && (
        <View
          style={[
            styles.tooltip,
            { maxWidth },
            positionStyles[position],
          ]}
          accessibilityLiveRegion="polite"
        >
          <Text style={styles.tooltipText}>{content}</Text>
          <View style={[styles.arrow, arrowStyles[position]]} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  tooltip: {
    position: 'absolute',
    backgroundColor: DESIGN_TOKENS.colors.text,
    paddingVertical: DESIGN_TOKENS.spacing.xs,
    paddingHorizontal: DESIGN_TOKENS.spacing.sm,
    borderRadius: DESIGN_TOKENS.radii.sm,
    zIndex: DESIGN_TOKENS.zIndex.popover,
    ...Platform.select({
      web: {
        // @ts-ignore
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
      },
      default: {
        shadowColor: DESIGN_TOKENS.colors.text,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 4,
      },
    }),
  },
  tooltipText: {
    color: DESIGN_TOKENS.colors.surface,
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    lineHeight: 20,
  },
  arrow: {
    position: 'absolute',
    width: 0,
    height: 0,
    borderStyle: 'solid',
  },
});

const positionStyles: Record<'top' | 'bottom' | 'left' | 'right', ViewStyle> = {
  top: {
    bottom: '100%',
    left: '50%',
    marginBottom: DESIGN_TOKENS.spacing.xs,
    ...Platform.select({
      web: {
        // @ts-ignore
        transform: 'translateX(-50%)',
      },
    }),
  },
  bottom: {
    top: '100%',
    left: '50%',
    marginTop: DESIGN_TOKENS.spacing.xs,
    ...Platform.select({
      web: {
        // @ts-ignore
        transform: 'translateX(-50%)',
      },
    }),
  },
  left: {
    right: '100%',
    top: '50%',
    marginRight: DESIGN_TOKENS.spacing.xs,
    ...Platform.select({
      web: {
        // @ts-ignore
        transform: 'translateY(-50%)',
      },
    }),
  },
  right: {
    left: '100%',
    top: '50%',
    marginLeft: DESIGN_TOKENS.spacing.xs,
    ...Platform.select({
      web: {
        // @ts-ignore
        transform: 'translateY(-50%)',
      },
    }),
  },
};

const arrowStyles: Record<'top' | 'bottom' | 'left' | 'right', ViewStyle> = {
  top: {
    top: '100%',
    left: '50%',
    marginLeft: -4,
    borderLeftWidth: 4,
    borderRightWidth: 4,
    borderTopWidth: 4,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: DESIGN_TOKENS.colors.text,
  },
  bottom: {
    bottom: '100%',
    left: '50%',
    marginLeft: -4,
    borderLeftWidth: 4,
    borderRightWidth: 4,
    borderBottomWidth: 4,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: DESIGN_TOKENS.colors.text,
  },
  left: {
    left: '100%',
    top: '50%',
    marginTop: -4,
    borderTopWidth: 4,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: DESIGN_TOKENS.colors.text,
  },
  right: {
    right: '100%',
    top: '50%',
    marginTop: -4,
    borderTopWidth: 4,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderRightColor: DESIGN_TOKENS.colors.text,
  },
};

export default memo(Tooltip);
