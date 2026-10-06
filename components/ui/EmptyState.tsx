// Компонент для пустых состояний — единственный владелец вида «пусто» (#2104).
// density обязателен: `compact` — пустота внутри вкладки, списка, панели или листа
// (кнопка обязана попасть в первый экран над доком); `full` — самостоятельный пустой
// экран. Правило — docs/DESIGN_SYSTEM.md «Empty states», страж —
// __tests__/config/empty-state-governance.test.ts.
import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Platform, type StyleProp, type ViewStyle } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useResponsive } from '@/hooks/useResponsive';
import { useThemedColors } from '@/hooks/useTheme';
import { globalFocusStyles } from '@/styles/globalFocus'; // ✅ ИСПРАВЛЕНИЕ: Импорт focus-стилей
import Button from '@/components/ui/Button';
import Chip from '@/components/ui/Chip';
import { translate as i18nT } from '@/i18n'
import { breakpointLayoutProps, breakpointStyle } from '@/utils/breakpointLayout'
import { EMPTY_STATE_LAYOUT } from './emptyStateLayout'
import type { FeatherIconName } from '@/constants/navigationIcons'


export type EmptyStateDensity = 'full' | 'compact';

export interface EmptyStateAction {
  label: string;
  onPress: () => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  /** Иконка Feather слева от подписи. */
  icon?: FeatherIconName;
  loading?: boolean;
  disabled?: boolean;
  testID?: string;
}

export interface EmptyStateProps {
  icon: string;
  title: string;
  description?: string;
  action?: EmptyStateAction;
  secondaryAction?: EmptyStateAction;
  /** Дополнительные действия (ghost) после основного и вторичного — панель карты держит четыре. */
  moreActions?: EmptyStateAction[];
  iconSize?: number;
  iconColor?: string;
  variant?: 'default' | 'search' | 'error' | 'empty' | 'inspire'; // ✅ УЛУЧШЕНИЕ: Варианты EmptyState
  suggestions?: string[]; // ✅ UX УЛУЧШЕНИЕ: Предложения для поиска
  examples?: Array<{ title: string; author?: string; image?: string }>; // ✅ UX: Примеры для вдохновения
  /** Обязателен: выбор вида делается на месте вызова, а не угадывается (#2104). */
  density: EmptyStateDensity;
  testID?: string;
}

const renderActionIcon = (name: FeatherIconName | undefined, color: string) =>
  name ? <Feather name={name} size={18} color={color} /> : undefined;

function EmptyState({
  icon,
  title,
  description,
  action,
  secondaryAction,
  moreActions = [],
  iconSize,
  iconColor,
  variant = 'default',
  suggestions = [],
  examples = [],
  density,
  testID = 'empty-state',
}: EmptyStateProps) {
  const colors = useThemedColors();
  const { isMobile, isHydrated } = useResponsive();
  // До гидрации web считает себя мобильным (width=0). Гейтим по isHydrated, чтобы
  // на десктопе размеры иконки/отступов не «мигали» (64→96) после гидрации.
  const isMobileLayout = isHydrated && isMobile;
  const isCompact = density === 'compact';
  // Кнопки компактной заглушки: до гидратации — узкий вариант (столбик), широкий даёт
  // critical CSS (`emptyStateLayout.ts`); после — по живой ширине.
  const isWideCompact = isHydrated && !isMobile;
  const styles = useMemo(
    () => createEmptyStateStyles(colors, density, isMobileLayout),
    [colors, density, isMobileLayout],
  );

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
  // Компакт на мобильном (web и native одинаково — паритет): иначе иконка+отступы
  // выталкивают кнопку-действие за первый экран 390×844.
  // compact игнорирует iconSize: иконка 28 в круге 56 одинакова во всех списках (§6).
  const finalIconSize = isCompact ? COMPACT_ICON_SIZE : iconSize ?? (isMobileLayout ? 64 : 96);
  return (
    <View style={styles.container} testID={testID}>
      <View style={[styles.iconContainer, { backgroundColor: variantColorScheme.bg }]}>
        <Feather name={icon as any} size={finalIconSize} color={finalIconColor} />
      </View>
      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      {description ? (
        <Text style={[styles.description, { color: colors.textMuted }]}>{description}</Text>
      ) : null}

      {/* ✅ UX УЛУЧШЕНИЕ: Предложения для поиска */}
      {suggestions.length > 0 && (
        <View style={styles.suggestionsContainer}>
          <Text style={styles.suggestionsTitle}>{i18nT('shared:components.ui.EmptyState.poprobuyte_e633baed')}</Text>
          <View style={styles.suggestionsList}>
            {suggestions.map((suggestion, index) => (
              <Chip
                key={index}
                label={suggestion}
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
          <Text style={styles.examplesTitle}>{i18nT('shared:components.ui.EmptyState.primery_ot_puteshestvennikov_ae747d86')}</Text>
          <View style={styles.examplesList}>
            {examples.slice(0, 3).map((example, index) => (
              <View key={index} style={styles.exampleCard}>
                <Feather name="map-pin" size={16} color={colors.primaryDark} />
                <Text style={styles.exampleTitle} numberOfLines={1}>
                  {example.title}
                </Text>
                {example.author && (
                  <Text style={styles.exampleAuthor} numberOfLines={1}>
                    {i18nT('shared:components.ui.EmptyState.ot_823c5a22', { value1: example.author })}</Text>
                )}
              </View>
            ))}
          </View>
        </View>
      )}

      <View
        style={
          isCompact
            ? breakpointStyle(EMPTY_STATE_LAYOUT, 'compactActions', isWideCompact)
            : styles.actionsContainer
        }
        {...(isCompact ? breakpointLayoutProps(EMPTY_STATE_LAYOUT, 'compactActions') : null)}
      >
        {action && (
          <Button
            label={action.label}
            onPress={action.onPress}
            variant="primary"
            size="md"
            icon={renderActionIcon(action.icon, colors.textOnPrimary)}
            loading={action.loading}
            disabled={action.disabled}
            style={[styles.actionButton, action.style]}
            accessibilityLabel={action.accessibilityLabel ?? action.label}
            testID={action.testID ?? `${testID}-action`}
          />
        )}
        {secondaryAction && (
          <Button
            label={secondaryAction.label}
            onPress={secondaryAction.onPress}
            variant="ghost"
            size="md"
            icon={renderActionIcon(secondaryAction.icon, colors.primaryText)}
            loading={secondaryAction.loading}
            disabled={secondaryAction.disabled}
            style={[styles.secondaryActionButton, { backgroundColor: colors.primarySoft }, secondaryAction.style]}
            accessibilityLabel={secondaryAction.accessibilityLabel ?? secondaryAction.label}
            testID={secondaryAction.testID ?? `${testID}-secondary-action`}
          />
        )}
        {moreActions.map((extra, index) => (
          <Button
            key={extra.testID ?? `${extra.label}-${index}`}
            label={extra.label}
            onPress={extra.onPress}
            variant="ghost"
            size="md"
            icon={renderActionIcon(extra.icon, colors.primaryText)}
            loading={extra.loading}
            disabled={extra.disabled}
            style={[styles.secondaryActionButton, extra.style]}
            accessibilityLabel={extra.accessibilityLabel ?? extra.label}
            testID={extra.testID ?? `${testID}-more-action-${index}`}
          />
        ))}
      </View>
    </View>
  );
}

const fullStyleSpec = (
  colors: ReturnType<typeof useThemedColors>,
  isMobile: boolean,
): StyleSheet.NamedStyles<any> => ({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    // isMobile, а не Platform.select: mobile web должен совпадать с устройством,
    // десктопные паддинги на 390px выталкивают действие за фолд.
    padding: isMobile ? 24 : Platform.select({ default: 32, web: 48 }),
    minHeight: isMobile ? 260 : Platform.select({ default: 300, web: 400 }),
  },
  iconContainer: {
    width: isMobile ? 88 : 128,
    height: isMobile ? 88 : 128,
    borderRadius: isMobile ? 44 : 64,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: isMobile ? 20 : 28,
    ...Platform.select({
      web: {
        boxShadow: `0 4px 12px ${colors.primaryAlpha30}`,
      },
      ios: {
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
      },
    }),
  },
  title: {
    fontSize: isMobile ? 22 : Platform.select({ default: 24, web: 28 }),
    fontWeight: '800',
    // Serif — только desktop web; на мобильном web системный sans, как на устройстве.
    fontFamily: Platform.select({ web: isMobile ? undefined : 'Georgia, serif', default: undefined }),
    marginTop: 8,
    marginBottom: 16,
    textAlign: 'center',
    letterSpacing: -0.5,
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
    marginBottom: isMobile ? 24 : 32,
    maxWidth: Platform.select({
      default: 320, // Mobile: 320px
      web: 400, // Desktop: 400px
    }),
  },
  actionButton: {
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: DESIGN_TOKENS.radii.pill,
    minHeight: 48,
    overflow: 'hidden',
    ...Platform.select({
      web: {
        backgroundImage: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.accent} 50%, ${colors.brand} 100%)`,
        boxShadow: `0 4px 16px ${colors.primaryAlpha30}, 0 2px 8px ${colors.brandAlpha40}`,
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      } as any,
    }),
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
    borderRadius: DESIGN_TOKENS.radii.pill, // pill — единый радиус кнопок по всему приложению
    minHeight: 44, // ✅ ИСПРАВЛЕНИЕ: Минимальная высота для touch-целей
    // Отклик на наведение даёт сам `Button` (`hovered` → фон `primarySoft` варианта
    // `ghost`); ключ-псевдокласс здесь был мёртв — RNW компилирует его в битое правило (#2036).
    ...Platform.select({
      web: {
        transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
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

const createStyles = (colors: ReturnType<typeof useThemedColors>, isMobile: boolean) =>
  StyleSheet.create(fullStyleSpec(colors, isMobile));

// Компактный вид (макет docs/features/mobile-screen-shell-mock.md §6): круг 56, иконка 28,
// без flex/minHeight, отступы вдвое меньше `full`. Стили не зависят от ширины; раскладку
// кнопок (столбик на телефоне, ряд шире) задаёт `emptyStateLayout.ts`, верная с первого кадра.
const COMPACT_ICON_SIZE = 28;
const COMPACT_CIRCLE = 56;

const createCompactStyles = (colors: ReturnType<typeof useThemedColors>) => {
  // Базовый спек — всегда узкий вариант: компактный вид от ширины не зависит (#2114).
  const full = fullStyleSpec(colors, true);
  return StyleSheet.create<any>({
    ...full,
    container: {
      alignItems: 'center',
      paddingVertical: 16,
      paddingHorizontal: 12,
    },
    iconContainer: {
      width: COMPACT_CIRCLE,
      height: COMPACT_CIRCLE,
      borderRadius: COMPACT_CIRCLE / 2,
      backgroundColor: colors.primaryLight,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 10,
    },
    title: {
      fontSize: 18,
      lineHeight: 24,
      fontWeight: '700',
      marginBottom: 6,
      textAlign: 'center',
    },
    description: {
      fontSize: 14,
      lineHeight: 20,
      textAlign: 'center',
      marginBottom: 14,
      maxWidth: 400,
    },
    actionButton: {
      ...full.actionButton,
      paddingVertical: 12,
      minHeight: 44,
    },
    secondaryActionButton: {
      ...full.secondaryActionButton,
      paddingVertical: 10,
    },
  });
};

/** Стили заглушки: `compact` не зависит от ширины (первый кадр = финальный), `full` — зависит. */
export const createEmptyStateStyles = (
  colors: ReturnType<typeof useThemedColors>,
  density: EmptyStateDensity,
  isMobile: boolean,
) => (density === 'compact' ? createCompactStyles(colors) : createStyles(colors, isMobile));

export default React.memo(EmptyState);
