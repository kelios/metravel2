import { Platform, StyleSheet } from 'react-native';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';

export const createTravelListItemStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    wrap: {
      width: '100%',
      ...(Platform.OS === 'web' ? { height: '100%', touchAction: 'pan-y' } as any : {}),
    },

    // Современная минималистичная карточка
    card: {
      width: '100%',
      backgroundColor: colors.surface,
      borderRadius: DESIGN_TOKENS.radii.lg,
      borderWidth: Platform.OS === 'web' ? 1 : 0,
      borderColor: colors.border,
      overflow: 'hidden',
      ...(Platform.OS === 'web'
        ? ({
            maxWidth: '100%',
            alignSelf: 'stretch',
          } as any)
        : null),
      // Минимальные тени для глубины - разделены по платформам
      ...Platform.select({
        web: {
          boxShadow: colors.boxShadows.light,
        } as any,
        ios: colors.shadows.light,
        android: { elevation: 2 },
        default: colors.shadows.light,
      }),
    },

    androidOptimized: {
      shadowColor: undefined,
      shadowOffset: undefined,
      shadowOpacity: undefined,
      shadowRadius: undefined,
    },

    selected: {
      ...Platform.select({
        web: {
          boxShadow: colors.boxShadows.hover,
          borderColor: colors.primary,
        } as any,
        default: {
          shadowColor: colors.primary,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.15,
          shadowRadius: 8,
          elevation: 4,
        },
      }),
    },

    single: {
      maxWidth: 600,
      alignSelf: 'center',
    },

    infoBadgeText: {
      fontSize: DESIGN_TOKENS.typography.sizes.sm,
      color: colors.text,
      fontWeight: DESIGN_TOKENS.typography.weights.medium as any,
      letterSpacing: -0.2,
    },

    // Упрощенные кнопки управления
    adminActionsContainer: {
      position: 'absolute',
      top: DESIGN_TOKENS.spacing.sm,
      left: DESIGN_TOKENS.spacing.sm,
      zIndex: 20,
      flexDirection: 'row',
      alignItems: 'center',
      gap: DESIGN_TOKENS.spacing.xs,
      // Компактный glass-пил, по высоте близкий к кнопке избранного
      backgroundColor: colors.surfaceMuted,
      borderRadius: DESIGN_TOKENS.radii.full,
      paddingHorizontal: DESIGN_TOKENS.spacing.xs,
      paddingVertical: DESIGN_TOKENS.spacing.xs * 0.75,
      ...(Platform.OS === 'web'
        ? {
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
          }
        : {}),
    },

    adminBtn: {
      paddingHorizontal: DESIGN_TOKENS.spacing.xs,
      paddingVertical: DESIGN_TOKENS.spacing.xs * 0.25,
      borderRadius: DESIGN_TOKENS.radii.full,
      justifyContent: 'center',
      alignItems: 'center',
      ...(Platform.OS === 'web' ? { cursor: 'pointer' } : {}),
    },

    adminDivider: {
      width: 1,
      height: 16,
      backgroundColor: colors.border,
    },

    favoriteButtonContainer: {
      position: 'absolute',
      top: DESIGN_TOKENS.spacing.sm,
      right: DESIGN_TOKENS.spacing.sm,
      zIndex: 20,
    },

    // Упрощенный контент
    contentBelow: {
      // Компактный внутренний отступ и небольшой gap между элементами
      paddingHorizontal: 4,
      paddingVertical: 4,
      gap: 4,
      backgroundColor: colors.surface,
      width: '100%',
      minWidth: 0,
      ...(Platform.OS === 'web'
        ? {
            paddingHorizontal: 12,
            paddingTop: 8,
            paddingBottom: 16,
            flex: 1,
          }
        : {}),
    },

    countrySlot: {
      width: '100%',
      minWidth: 0,
      ...(Platform.OS === 'web'
        ? ({
            minHeight: 34,
          } as any)
        : ({ minHeight: 28 } as any)),
    },

    // Современная типографика
    title: {
      fontSize: DESIGN_TOKENS.typography.sizes.lg,
      fontWeight: DESIGN_TOKENS.typography.weights.semibold as any,
      lineHeight: 22,
      color: colors.text,
      marginBottom: 0,
    },

    // Упрощенная мета-информация
    metaRow: {
      flexDirection: 'column',
      alignItems: 'stretch',
      justifyContent: 'flex-start',
      gap: Platform.OS === 'web' ? 6 : DESIGN_TOKENS.spacing.xs,
    },

    // Первая строка: пользователь + просмотры
    metaInfoTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      width: '100%',
      minHeight: Platform.OS === 'web' ? 18 : 20,
      minWidth: 0,
    },

    // Вторая строка: бейджи Популярное / Новое
    metaBadgesRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: DESIGN_TOKENS.spacing.xs,
      marginTop: Platform.OS === 'web' ? 4 : DESIGN_TOKENS.spacing.xs * 0.5,
      marginBottom: Platform.OS === 'web' ? 8 : 0,
      flexWrap: Platform.OS === 'web' ? 'nowrap' : 'wrap',
      overflow: Platform.OS === 'web' ? 'hidden' : 'visible',
      // Чуть меньшая минимальная высота, чтобы панель была компактнее
      minHeight: Platform.OS === 'web' ? 28 : 22,
    },

    metaBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: DESIGN_TOKENS.spacing.xs,
      flex: 1,
      minWidth: 0,
    },

    // Отдельный стиль для просмотров - абсолютно позиционированы
    metaBoxViews: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: DESIGN_TOKENS.spacing.xs,
      paddingHorizontal: DESIGN_TOKENS.spacing.xs,
      paddingVertical: 2,
      flexShrink: 0,
    },

    metaBoxViewsChip: {
      backgroundColor: colors.backgroundSecondary,
      borderWidth: 1,
      borderColor: colors.borderLight,
      borderRadius: 999,
      paddingVertical: 3,
      paddingHorizontal: 8,
    },

    metaBoxRatingChip: {
      marginLeft: 6,
      paddingLeft: 10,
      borderLeftWidth: 1,
      borderLeftColor: colors.borderLight,
    },

    metaTxt: {
      fontSize: DESIGN_TOKENS.typography.sizes.sm,
      color: colors.textSecondary,
      fontWeight: DESIGN_TOKENS.typography.weights.medium as any,
      lineHeight: Platform.OS === 'web' ? 16 : 18,
      flex: 1, // Занимаем доступное пространство в контейнере
      minWidth: 0, // Важно для корректного обрезания текста
      opacity: 1,
    },

    // Отдельный стиль для текста просмотров - не обрезается
    metaTxtViews: {
      fontSize: DESIGN_TOKENS.typography.sizes.sm,
      color: colors.textSecondary,
      fontWeight: DESIGN_TOKENS.typography.weights.medium as any,
      lineHeight: Platform.OS === 'web' ? 16 : 18,
      opacity: 1,
    },

    // Упрощенные статус-бейджи (современные нейтральные pill-метки)
    statusBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: DESIGN_TOKENS.spacing.xs,
      paddingHorizontal: DESIGN_TOKENS.spacing.sm,
      paddingVertical: DESIGN_TOKENS.spacing.xs * 0.75,
      borderRadius: DESIGN_TOKENS.radii.full,
      borderWidth: 1,
      backgroundColor: colors.backgroundSecondary,
      borderColor: colors.border,
    },

    statusBadgePopular: {},

    statusBadgeNew: {},

    statusBadgeText: {
      fontSize: DESIGN_TOKENS.typography.sizes.xs,
      fontWeight: DESIGN_TOKENS.typography.weights.semibold as any,
      letterSpacing: -0.1,
      color: colors.textSecondary,
    },

    statusBadgeTextPopular: {},

    statusBadgeTextNew: {},

    // Упрощенные теги стран
    tags: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: DESIGN_TOKENS.spacing.xs,
    },

    tag: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.backgroundSecondary,
      borderRadius: DESIGN_TOKENS.radii.sm,
      paddingHorizontal: DESIGN_TOKENS.spacing.sm,
      paddingVertical: Platform.OS === 'web' ? DESIGN_TOKENS.spacing.xxs : DESIGN_TOKENS.spacing.xs,
      gap: DESIGN_TOKENS.spacing.xs,
    },

    tagTxt: {
      fontSize:
        Platform.OS === 'web'
          ? DESIGN_TOKENS.typography.sizes.xs
          : DESIGN_TOKENS.typography.sizes.sm,
      color: colors.textSecondary,
      fontWeight: DESIGN_TOKENS.typography.weights.medium as any,
    },

    // Упрощенные чекбоксы
    checkWrap: {
      position: 'absolute',
      top: DESIGN_TOKENS.spacing.sm,
      right: DESIGN_TOKENS.spacing.sm,
      zIndex: 20,
    },

    checkbox: {
      width: 24,
      height: 24,
      borderRadius: DESIGN_TOKENS.radii.sm,
      borderWidth: 2,
      borderColor: colors.borderStrong,
      backgroundColor: colors.surface,
      justifyContent: 'center',
      alignItems: 'center',
      cursor: Platform.OS === 'web' ? 'pointer' : undefined,
    },

    checkboxChecked: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
  });
