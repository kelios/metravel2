import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, Platform, Animated } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';
import { useTipAnimation } from '@/hooks/useStepTransition';
import { ContextualTip } from '@/utils/contextualTips';

interface ContextualTipCardProps {
  tip: ContextualTip;
  onActionPress?: () => void;
  delay?: number;
}

/**
 * ✅ ФАЗА 2: Компонент для отображения контекстной подсказки
 * Показывает умные советы в зависимости от состояния формы
 * С анимацией появления
 */
const ContextualTipCard: React.FC<ContextualTipCardProps> = ({ tip, onActionPress, delay = 0 }) => {
  const colors = useThemedColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  // ✅ ФАЗА 2: Анимация появления подсказки
  const { animatedStyle } = useTipAnimation(true, delay);

  const getIconName = (): keyof typeof Feather.glyphMap => {
    switch (tip.type) {
      case 'success': return 'check-circle';
      case 'warning': return 'alert-circle';
      case 'tip': return 'zap';
      case 'info':
      default: return 'info';
    }
  };

  const getColorScheme = () => {
    switch (tip.type) {
      case 'success':
        return {
          background: colors.successSoft || 'rgba(122, 157, 138, 0.06)',
          icon: colors.success,
          border: colors.success + '20',
        };
      case 'warning':
        return {
          background: colors.warningSoft || 'rgba(184, 144, 112, 0.06)',
          icon: colors.warning,
          border: colors.warning + '20',
        };
      case 'tip':
        return {
          background: colors.primarySoft,
          icon: colors.primary,
          border: colors.primary + '20',
        };
      case 'info':
      default:
        return {
          background: colors.primarySoft,
          icon: colors.primary,
          border: colors.primary + '20',
        };
    }
  };

  const colorScheme = getColorScheme();

  return (
    <Animated.View style={[styles.card, { backgroundColor: colorScheme.background, borderColor: colorScheme.border }, animatedStyle]}>
      <View style={styles.iconWrapper}>
        <Feather name={getIconName()} size={20} color={colorScheme.icon} />
      </View>

      <View style={styles.content}>
        <Text style={styles.title}>{tip.title}</Text>
        <Text style={styles.message}>{tip.message}</Text>

        {tip.action && onActionPress && (
          <Pressable
            onPress={onActionPress}
            style={({ pressed }) => [
              styles.actionButton,
              { backgroundColor: colorScheme.icon + '10' },
              pressed && { opacity: 0.7 }
            ]}
            accessibilityRole="button"
            accessibilityLabel={tip.action.label}
            {...Platform.select({ web: { cursor: 'pointer' } })}
          >
            <Text style={[styles.actionText, { color: colorScheme.icon }]}>{tip.action.label}</Text>
            <Feather name="arrow-right" size={14} color={colorScheme.icon} />
          </Pressable>
        )}
      </View>
    </Animated.View>
  );
};

const createStyles = (colors: ReturnType<typeof useThemedColors>) => StyleSheet.create({
  card: {
    flexDirection: 'row',
    padding: DESIGN_TOKENS.spacing.md,
    borderRadius: DESIGN_TOKENS.radii.md,
    borderWidth: 1,
    marginBottom: DESIGN_TOKENS.spacing.sm,
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)' } as any)
      : {}),
  },
  iconWrapper: {
    marginRight: DESIGN_TOKENS.spacing.sm,
    paddingTop: 2,
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    fontWeight: '700',
    color: colors.text,
    marginBottom: DESIGN_TOKENS.spacing.xxs,
  },
  message: {
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    color: colors.textMuted,
    lineHeight: 20,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DESIGN_TOKENS.spacing.xxs,
    alignSelf: 'flex-start',
    marginTop: DESIGN_TOKENS.spacing.sm,
    paddingVertical: DESIGN_TOKENS.spacing.xs,
    paddingHorizontal: DESIGN_TOKENS.spacing.sm,
    borderRadius: DESIGN_TOKENS.radii.sm,
  },
  actionText: {
    fontSize: DESIGN_TOKENS.typography.sizes.xs,
    fontWeight: '600',
  },
});

export default React.memo(ContextualTipCard);

