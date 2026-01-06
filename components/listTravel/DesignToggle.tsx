// DesignToggle.tsx - Переключатель между классическим и современным дизайном
import React, { memo, useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
} from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { MODERN_DESIGN_TOKENS } from '@/styles/modernRedesign';
import { useThemedColors } from '@/hooks/useTheme';

const { spacing, radii, typography } = MODERN_DESIGN_TOKENS;

interface DesignToggleProps {
  useModernDesign: boolean;
  onToggle: () => void;
  cardVariant: 'classic' | 'minimal' | 'rich' | 'pinterest';
  onCardVariantChange: (variant: 'classic' | 'minimal' | 'rich' | 'pinterest') => void;
}

const DesignToggle: React.FC<DesignToggleProps> = memo(({
  useModernDesign,
  onToggle,
  cardVariant,
  onCardVariantChange,
}) => {
  const themeColors = useThemedColors();
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);

  const cardVariants = [
    { value: 'minimal', label: 'Минимал', icon: 'square' },
    { value: 'rich', label: 'Богатый', icon: 'layers' },
    { value: 'pinterest', label: 'Pinterest', icon: 'grid' },
    { value: 'classic', label: 'Классика', icon: 'list' },
  ];

  return (
    <View style={styles.container}>
      {/* Основной переключатель */}
      <Pressable
        onPress={onToggle}
        style={[
          styles.mainToggle,
          useModernDesign && styles.mainToggleActive,
        ]}
      >
        <View style={styles.toggleContent}>
          <Feather
            name={useModernDesign ? 'zap' : 'clock'}
            size={20}
            color={useModernDesign ? themeColors.primary : themeColors.textMuted}
          />
          <Text style={[
            styles.toggleText,
            useModernDesign && styles.toggleTextActive,
          ]}>
            {useModernDesign ? 'Современный дизайн' : 'Классический дизайн'}
          </Text>
        </View>
        <View style={[
          styles.switch,
          useModernDesign && styles.switchActive,
        ]}>
          <View style={[
            styles.switchThumb,
            useModernDesign && styles.switchThumbActive,
          ]} />
        </View>
      </Pressable>

      {/* Выбор варианта карточки (только для современного дизайна) */}
      {useModernDesign && (
        <View style={styles.variantSelector}>
          <Text style={styles.variantLabel}>Стиль карточек:</Text>
          <View style={styles.variantButtons}>
            {cardVariants.map((variant) => (
              <Pressable
                key={variant.value}
                onPress={() => onCardVariantChange(variant.value as any)}
                style={[
                  styles.variantButton,
                  cardVariant === variant.value && styles.variantButtonActive,
                ]}
              >
                <Feather
                  name={variant.icon as any}
                  size={16}
                  color={cardVariant === variant.value ? themeColors.textOnPrimary : themeColors.textMuted}
                />
                <Text style={[
                  styles.variantButtonText,
                  cardVariant === variant.value && styles.variantButtonTextActive,
                ]}>
                  {variant.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}
    </View>
  );
});

const createStyles = (themeColors: ReturnType<typeof useThemedColors>) => StyleSheet.create({
  container: {
    position: 'absolute',
    top: Platform.select({ web: 20, default: 60 }),
    right: 20,
    zIndex: 1000,
    backgroundColor: themeColors.surfaceElevated,
    borderRadius: radii.xl,
    padding: spacing.md,
    ...themeColors.shadows.medium,
    ...Platform.select({
      web: {
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        boxShadow: themeColors.boxShadows.medium,
      },
    }),
  },
  mainToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: themeColors.surface,
    borderRadius: radii.pill,
    minWidth: 220,
    ...Platform.select({
      web: {
        cursor: 'pointer',
        transition: 'all 0.3s ease',
      },
    }),
  },
  mainToggleActive: {
    backgroundColor: themeColors.primarySoft,
  },
  toggleContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  toggleText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: themeColors.text,
  },
  toggleTextActive: {
    color: themeColors.primaryDark,
  },
  switch: {
    width: 44,
    height: 24,
    borderRadius: 12,
    backgroundColor: themeColors.border,
    padding: 2,
    ...Platform.select({
      web: {
        transition: 'all 0.3s ease',
      },
    }),
  },
  switchActive: {
    backgroundColor: themeColors.primary,
  },
  switchThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: themeColors.surface,
    ...themeColors.shadows.light,
    ...Platform.select({
      web: {
        transition: 'all 0.3s ease',
      },
    }),
  },
  switchThumbActive: {
    transform: [{ translateX: 20 }],
  },
  variantSelector: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: themeColors.border,
  },
  variantLabel: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: themeColors.textMuted,
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  variantButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  variantButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    backgroundColor: themeColors.surface,
    borderWidth: 1,
    borderColor: themeColors.border,
    ...Platform.select({
      web: {
        cursor: 'pointer',
        transition: 'all 0.2s ease',
      },
    }),
  },
  variantButtonActive: {
    backgroundColor: themeColors.primary,
    borderColor: themeColors.primaryDark,
  },
  variantButtonText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    color: themeColors.text,
  },
  variantButtonTextActive: {
    color: themeColors.textOnPrimary,
  },
});

export default DesignToggle;
