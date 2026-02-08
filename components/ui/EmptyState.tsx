// Компонент для пустых состояний
import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';
import { globalFocusStyles } from '@/styles/globalFocus'; // ✅ ИСПРАВЛЕНИЕ: Импорт focus-стилей
import Button from '@/components/ui/Button';
import Chip from '@/components/ui/Chip';

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

function EmptyState({
  icon,
  title,
  description,
  action,
  secondaryAction,
  iconSize = 96, // ✅ ДИЗАЙН: Увеличен размер иконки
  iconColor,
  variant = 'default',
  suggestions = [],
  examples = [],
}: EmptyStateProps) {
  const colors = useThemedColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  // ✅ УЛУЧШЕНИЕ: Разные цвета для разных вариантов
  const variantColors = {
    default: { icon: colors.primary, bg: colors.primaryLight },
    search: { icon: colors.textMuted, bg: colors.backgroundSecondary },
    error: { icon: colors.danger, bg: colors.dangerLight },
    empty: { icon: colors.textMuted, bg: colors.mutedBackground },
    inspire: { icon: colors.primary, bg: colors.primaryLight },
  };

  const variantColorScheme = variantColors[variant] || variantColors.default;
  const finalIconColor = iconColor ?? variantColorScheme.icon;
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
              <Chip
                key={index}
                label={suggestion}
                onPress={action?.onPress}
                style={[styles.suggestionChip, globalFocusStyles.focusable]}
                testID={`empty-state-suggestion-${index}`}
              />
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
          <Button
            label={action.label}
            onPress={action.onPress}
            variant="primary"
            size="md"
            style={styles.actionButton}
            accessibilityLabel={action.label}
          />
        )}
        {secondaryAction && (
          <Button
            label={secondaryAction.label}
            onPress={secondaryAction.onPress}
            variant="ghost"
            size="md"
            style={[styles.secondaryActionButton, { backgroundColor: colors.primarySoft }]}
            accessibilityLabel={secondaryAction.label}
          />
        )}
      </View>
    </View>
  );
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) => StyleSheet.create({
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
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    ...Platform.select({
      web: {
        boxShadow: colors.boxShadows.light,
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
    borderRadius: DESIGN_TOKENS.radii.md, // ✅ ИСПРАВЛЕНИЕ: Используем единый радиус
    minHeight: 44, // ✅ ИСПРАВЛЕНИЕ: Минимальная высота для touch-целей
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
          backgroundColor: colors.primarySoft,
        },
      },
    }),
  },
  suggestionsContainer: {
    marginTop: 16,
    marginBottom: 24,
    alignItems: 'center',
  },
  suggestionsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textMuted,
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
    backgroundColor: colors.mutedBackground, // ✅ ИСПРАВЛЕНИЕ: Используем единый цвет
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
    color: colors.textMuted,
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
    backgroundColor: colors.surface,
    borderRadius: DESIGN_TOKENS.radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...Platform.select({
      web: {
        boxShadow: colors.boxShadows.light,
      },
    }),
  },
  exampleTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  exampleAuthor: {
    fontSize: 12,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
});

export default React.memo(EmptyState);
