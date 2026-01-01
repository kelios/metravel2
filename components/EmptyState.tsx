// Компонент для пустых состояний
import React from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
// ✅ ДИЗАЙН: Импорт максимально легкой и воздушной палитры
import { AIRY_COLORS } from '@/constants/airyColors';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';
import { globalFocusStyles } from '@/styles/globalFocus'; // ✅ ИСПРАВЛЕНИЕ: Импорт focus-стилей

interface EmptyStateProps {
  icon: string;
  title: string;
  description: string;
  action?: {
    label: string;
    onPress: () => void;
  };
  secondaryAction?: {
    label: string;
    onPress: () => void;
  };
  iconSize?: number;
  iconColor?: string;
  variant?: 'default' | 'search' | 'error' | 'empty' | 'inspire'; // ✅ УЛУЧШЕНИЕ: Варианты EmptyState
  suggestions?: string[]; // ✅ UX УЛУЧШЕНИЕ: Предложения для поиска
  examples?: Array<{ title: string; author?: string; image?: string }>; // ✅ UX: Примеры для вдохновения
}

export default function EmptyState({
  icon,
  title,
  description,
  action,
  secondaryAction,
  iconSize = 96, // ✅ ДИЗАЙН: Увеличен размер иконки
  iconColor = AIRY_COLORS.primary, // ✅ ДИЗАЙН: Воздушный легкий персик по умолчанию
  variant = 'default',
  suggestions = [],
  examples = [],
}: EmptyStateProps) {
  const colors = useThemedColors();

  // ✅ УЛУЧШЕНИЕ: Разные цвета для разных вариантов
  const variantColors = {
    default: { icon: colors.primary, bg: colors.primaryLight },
    search: { icon: colors.textMuted, bg: colors.backgroundSecondary },
    error: { icon: colors.danger, bg: colors.dangerLight },
    empty: { icon: colors.textMuted, bg: colors.mutedBackground },
    inspire: { icon: colors.primary, bg: colors.primaryLight },
  };

  const variantColorScheme = variantColors[variant] || variantColors.default;
  const finalIconColor = iconColor || variantColorScheme.icon;
  return (
    <View style={styles.container}>
      <View style={[styles.iconContainer, { backgroundColor: variantColorScheme.bg }]}>
        <Feather name={icon as any} size={iconSize} color={finalIconColor} />
      </View>
      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.description, { color: colors.textMuted }]}>{description}</Text>

      {/* ✅ UX УЛУЧШЕНИЕ: Предложения для поиска */}
      {suggestions.length > 0 && (
        <View style={styles.suggestionsContainer}>
          <Text style={styles.suggestionsTitle}>Попробуйте:</Text>
          <View style={styles.suggestionsList}>
            {suggestions.map((suggestion, index) => (
              <Pressable
                key={index}
                style={[styles.suggestionChip, globalFocusStyles.focusable]} // ✅ ИСПРАВЛЕНИЕ: Добавлен focus-индикатор
                onPress={() => {
                  if (action) action.onPress();
                }}
                accessibilityRole="button"
                accessibilityLabel={`Попробовать: ${suggestion}`}
                {...Platform.select({
                  web: {
                    cursor: 'pointer',
                  },
                })}
              >
                <Text style={styles.suggestionText}>{suggestion}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {/* ✅ UX УЛУЧШЕНИЕ: Примеры для вдохновения */}
      {variant === 'inspire' && examples.length > 0 && (
        <View style={styles.examplesContainer}>
          <Text style={styles.examplesTitle}>Примеры от путешественников:</Text>
          <View style={styles.examplesList}>
            {examples.slice(0, 3).map((example, index) => (
              <View key={index} style={styles.exampleCard}>
                <Feather name="map-pin" size={16} color={colors.primary} />
                <Text style={styles.exampleTitle} numberOfLines={1}>
                  {example.title}
                </Text>
                {example.author && (
                  <Text style={styles.exampleAuthor} numberOfLines={1}>
                    от {example.author}
                  </Text>
                )}
              </View>
            ))}
          </View>
        </View>
      )}

      <View style={styles.actionsContainer}>
        {action && (
          <Pressable
            style={[styles.actionButton, globalFocusStyles.focusable]} // ✅ ИСПРАВЛЕНИЕ: Добавлен focus-индикатор
            onPress={action.onPress}
            accessibilityRole="button"
            accessibilityLabel={action.label}
            {...Platform.select({
              web: { 
                cursor: 'pointer',
                transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                // @ts-ignore
                ':hover': {
                  transform: 'translateY(-2px) scale(1.02)',
                  boxShadow: '0 4px 12px rgba(255, 159, 90, 0.3)',
                },
              },
            })}
          >
            <Text style={styles.actionText}>{action.label}</Text>
          </Pressable>
        )}
        {secondaryAction && (
          <Pressable
            style={[styles.secondaryActionButton, globalFocusStyles.focusable, { backgroundColor: colors.primarySoft }]} // ✅ Динамический фон
            onPress={secondaryAction.onPress}
            accessibilityRole="button"
            accessibilityLabel={secondaryAction.label}
            {...Platform.select({
              web: { 
                cursor: 'pointer',
                transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
              },
            })}
          >
            <Text style={styles.secondaryActionText}>{secondaryAction.label}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Platform.select({
      default: 32, // Mobile: 32px
      web: 48, // Desktop: 48px
    }),
    minHeight: Platform.select({
      default: 300, // Mobile: 300px
      web: 400, // Desktop: 400px
    }),
  },
  iconContainer: {
    width: 120, // ✅ ДИЗАЙН: Контейнер для иконки
    height: 120,
    borderRadius: 60,
    backgroundColor: AIRY_COLORS.primaryLight, // ✅ ДИЗАЙН: Воздушный легкий персиковый фон
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    ...Platform.select({
      web: {
        boxShadow: '0 4px 16px rgba(255, 159, 90, 0.15)',
      },
    }),
  },
  title: {
    fontSize: Platform.select({
      default: 22, // Mobile: 22px
      web: 24, // Desktop: 24px
    }),
    fontWeight: '700',
    fontFamily: Platform.select({ web: 'Georgia, serif', default: undefined }), // ✅ ДИЗАЙН: Georgia для заголовков
    marginTop: 8, // ✅ ДИЗАЙН: Уменьшен отступ
    marginBottom: 12, // ✅ ДИЗАЙН: Увеличен отступ
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  description: {
    fontSize: Platform.select({
      default: 15, // Mobile: 15px
      web: 16, // Desktop: 16px
    }),
    textAlign: 'center',
    lineHeight: Platform.select({
      default: 22, // Mobile: 22px
      web: 24, // Desktop: 24px
    }),
    marginBottom: 32, // ✅ ДИЗАЙН: Увеличен отступ
    maxWidth: Platform.select({
      default: 320, // Mobile: 320px
      web: 400, // Desktop: 400px
    }),
  },
  actionButton: {
    paddingHorizontal: 32, // ✅ ДИЗАЙН: Увеличены отступы
    paddingVertical: 14, // ✅ ДИЗАЙН: Высота 48px (14*2 + 20px текста)
    backgroundColor: DESIGN_TOKENS.colors.primary, // ✅ ИСПРАВЛЕНИЕ: Используем единый primary цвет
    borderRadius: DESIGN_TOKENS.radii.md, // ✅ ИСПРАВЛЕНИЕ: Используем единый радиус
    minHeight: 44, // ✅ ИСПРАВЛЕНИЕ: Минимальная высота для touch-целей
    ...Platform.select({
      web: {
        backgroundColor: DESIGN_TOKENS.colors.primary, // ✅ ИСПРАВЛЕНИЕ: Используем единый primary цвет
        boxShadow: DESIGN_TOKENS.shadows.medium,
        transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        // @ts-ignore
        ':hover': {
          backgroundColor: DESIGN_TOKENS.colors.primaryDark,
          transform: 'translateY(-2px) scale(1.02)',
          boxShadow: '0 3px 8px rgba(31, 31, 31, 0.12)',
        },
      },
    }),
  },
  actionText: {
    color: DESIGN_TOKENS.colors.textInverse,
    fontSize: 16, // ✅ ДИЗАЙН: Увеличен размер
    fontWeight: '700', // ✅ ДИЗАЙН: Увеличен weight
    letterSpacing: 0.3,
  },
  actionsContainer: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryActionButton: {
    paddingHorizontal: 24,
    paddingVertical: 14,
    backgroundColor: 'transparent',
    // ✅ УЛУЧШЕНИЕ: Убрана граница, используется только цвет текста
    borderRadius: DESIGN_TOKENS.radii.md, // ✅ ИСПРАВЛЕНИЕ: Используем единый радиус
    minHeight: 44, // ✅ ИСПРАВЛЕНИЕ: Минимальная высота для touch-целей
    ...Platform.select({
      web: {
        transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        // @ts-ignore
        ':hover': {
          backgroundColor: DESIGN_TOKENS.colors.primarySoft,
        },
      },
    }),
  },
  secondaryActionText: {
    color: DESIGN_TOKENS.colors.primary,
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  suggestionsContainer: {
    marginTop: 16,
    marginBottom: 24,
    alignItems: 'center',
  },
  suggestionsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: DESIGN_TOKENS.colors.textMuted,
    marginBottom: 12,
  },
  suggestionsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
    maxWidth: Platform.select({
      default: 320,
      web: 500,
    }),
  },
  suggestionChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: DESIGN_TOKENS.colors.mutedBackground, // ✅ ИСПРАВЛЕНИЕ: Используем единый цвет
    borderRadius: DESIGN_TOKENS.radii.pill, // ✅ ИСПРАВЛЕНИЕ: Используем единый радиус
    // ✅ УЛУЧШЕНИЕ: Убрана граница, используется только фон
    minHeight: 32, // ✅ ИСПРАВЛЕНИЕ: Минимальная высота для touch-целей
    ...Platform.select({
      web: {
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        // @ts-ignore
        ':hover': {
          backgroundColor: DESIGN_TOKENS.colors.surface,
          borderColor: DESIGN_TOKENS.colors.primary, // ✅ ИСПРАВЛЕНИЕ: Используем единый primary цвет
        },
      },
    }),
  },
  suggestionText: {
    fontSize: 13,
    color: DESIGN_TOKENS.colors.text,
    fontWeight: '500',
  },
  examplesContainer: {
    marginTop: 24,
    marginBottom: 24,
    width: '100%',
    maxWidth: Platform.select({
      default: 320,
      web: 500,
    }),
  },
  examplesTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: DESIGN_TOKENS.colors.textMuted,
    marginBottom: 16,
    textAlign: 'center',
  },
  examplesList: {
    gap: 12,
  },
  exampleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    backgroundColor: DESIGN_TOKENS.colors.surface,
    borderRadius: DESIGN_TOKENS.radii.md,
    borderWidth: 1,
    borderColor: DESIGN_TOKENS.colors.border,
    ...Platform.select({
      web: {
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
      },
    }),
  },
  exampleTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: DESIGN_TOKENS.colors.text,
  },
  exampleAuthor: {
    fontSize: 12,
    color: DESIGN_TOKENS.colors.textMuted,
    fontStyle: 'italic',
  },
});
