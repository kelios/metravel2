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
      borderWidth: 0,
      overflow: 'hidden',
      ...(Platform.OS === 'web'
        ? ({
            maxWidth: '100%',
            alignSelf: 'stretch',
          } as any)
        : null),
      // Мягкие тени для глубины
      ...Platform.select({
        web: {
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.06), 0 1px 2px rgba(0, 0, 0, 0.04)',
        } as any,
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.06,
          shadowRadius: 3,
        },
        android: { elevation: 1 },
        default: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.06,
          shadowRadius: 3,
        },
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

    // Компактный контент под изображением
    contentBelow: {
      gap: 0,
      backgroundColor: colors.surface,
      width: '100%',
      minWidth: 0,
      ...(Platform.OS === 'web'
        ? {
            paddingHorizontal: 12,
            paddingTop: 8,
            paddingBottom: 10,
          }
        : {
            paddingHorizontal: 4,
            paddingVertical: 4,
          }),
    },

    countrySlot: {
      width: '100%',
      minWidth: 0,
    },

    // Современная типографика
    title: {
      fontSize: DESIGN_TOKENS.typography.sizes.lg,
      fontWeight: DESIGN_TOKENS.typography.weights.semibold as any,
      lineHeight: 22,
      color: colors.text,
      marginBottom: 0,
    },

    // Компактная мета-информация — одна строка
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 6,
      minHeight: Platform.OS === 'web' ? 18 : 20,
    },

    // Левая часть: страна · автор · просмотры
    metaInfoTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-start',
      minWidth: 0,
      flex: 1,
      gap: 0,
      flexWrap: 'nowrap',
    },

    // Правая часть: рейтинг + бейджи
    metaBadgesRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      flexShrink: 0,
    },

    // Inline рейтинг (без чипа)
    metaRating: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
      flexShrink: 0,
    },

    metaRatingStar: {
      fontSize: Platform.OS === 'web' ? 11 : 10,
      lineHeight: Platform.OS === 'web' ? 14 : 12,
      color: '#e8a838',
    },

    metaRatingValue: {
      fontSize: Platform.OS === 'web' ? 12 : 11,
      lineHeight: Platform.OS === 'web' ? 14 : 14,
      fontWeight: DESIGN_TOKENS.typography.weights.semibold as any,
      color: colors.textSecondary,
    },

    metaBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      flexShrink: 1,
      minWidth: 0,
    },

    // Точка-разделитель между мета-элементами
    metaDot: {
      width: 3,
      height: 3,
      borderRadius: 1.5,
      backgroundColor: colors.textMuted,
      marginHorizontal: 4,
      opacity: 0.5,
      flexShrink: 0,
    },

    // Просмотры — без чипа, просто текст
    metaBoxViews: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      flexShrink: 0,
    },

    metaBoxViewsChip: {
      // Убираем чип-стиль, оставляем inline
    },

    metaBoxRatingChip: {
      marginLeft: 6,
      backgroundColor: Platform.OS === 'web'
        ? 'rgba(232, 168, 56, 0.08)'
        : colors.backgroundSecondary,
      borderWidth: 1,
      borderColor: Platform.OS === 'web'
        ? 'rgba(232, 168, 56, 0.2)'
        : colors.borderLight,
      borderRadius: 999,
      paddingVertical: 4,
      paddingHorizontal: 10,
      ...(Platform.OS === 'web'
        ? {
            boxShadow: '0 1px 2px rgba(232, 168, 56, 0.12)',
          } as any
        : {}),
    },

    metaTxt: {
      fontSize: Platform.OS === 'web' ? 12.5 : 12,
      color: colors.textMuted,
      fontWeight: DESIGN_TOKENS.typography.weights.regular as any,
      lineHeight: Platform.OS === 'web' ? 16 : 16,
      minWidth: 0,
    },

    // Текст просмотров
    metaTxtViews: {
      fontSize: Platform.OS === 'web' ? 12.5 : 12,
      color: colors.textMuted,
      fontWeight: DESIGN_TOKENS.typography.weights.regular as any,
      lineHeight: Platform.OS === 'web' ? 16 : 16,
    },

    // Компактные статус-бейджи (иконки)
    statusBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      flexShrink: 0,
    },

    statusBadgePopular: {
    },

    statusBadgeNew: {
    },

    statusBadgeText: {
      fontSize: Platform.OS === 'web' ? 10.5 : 10,
      fontWeight: DESIGN_TOKENS.typography.weights.semibold as any,
      letterSpacing: 0.3,
      textTransform: 'uppercase' as any,
      color: colors.textMuted,
    },

    statusBadgeTextPopular: {
      color: Platform.OS === 'web' ? 'rgb(180, 83, 9)' : colors.textSecondary,
    },

    statusBadgeTextNew: {
      color: Platform.OS === 'web' ? 'rgb(22, 163, 74)' : colors.textSecondary,
    },

    // Inline теги стран (без pill-фона)
    tags: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      flexShrink: 1,
      minWidth: 0,
    },

    tag: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      flexShrink: 1,
      minWidth: 0,
    },

    tagTxt: {
      fontSize: Platform.OS === 'web' ? 12.5 : 12,
      color: colors.textMuted,
      fontWeight: DESIGN_TOKENS.typography.weights.regular as any,
      lineHeight: Platform.OS === 'web' ? 16 : 16,
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
