import { Platform, StyleSheet } from 'react-native';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';

// Inline meta-text scale: bodySmall on web, caption on native.
const META_TEXT_FONT_SIZE =
  Platform.OS === 'web'
    ? DESIGN_TOKENS.typography.scale.bodySmall.fontSize
    : DESIGN_TOKENS.typography.scale.caption.fontSize;
const META_TEXT_LINE_HEIGHT =
  Platform.OS === 'web'
    ? DESIGN_TOKENS.typography.scale.bodySmall.lineHeight
    : DESIGN_TOKENS.typography.scale.caption.lineHeight;

export const createTravelListItemStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    wrap: {
      width: '100%',
      ...(Platform.OS === 'web' ? { height: '100%' } as any : {}),
    },

    // Современная минималистичная карточка
    card: {
      width: '100%',
      backgroundColor: colors.surface,
      borderRadius: DESIGN_TOKENS.radii.lg,
      borderWidth: 1,
      borderColor: colors.borderLight,
      overflow: 'hidden',
      ...(Platform.OS === 'web'
        ? ({
            maxWidth: '100%',
            alignSelf: 'stretch',
            transition: 'all 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
            willChange: 'transform, box-shadow, border-color',
          } as any)
        : null),
      // Мягкие тени для глубины
      ...Platform.select({
        web: {
          // Hard-coded 50% white inset created a bright bar across the top edge in dark mode.
          // Lower alpha keeps a subtle highlight in light mode without blowing out on dark surfaces.
          boxShadow: '0 2px 12px rgba(0, 0, 0, 0.06), 0 1px 4px rgba(0, 0, 0, 0.04), inset 0 1px 0 rgba(255, 255, 255, 0.08)',
        } as any,
        ios: {
          shadowColor: DESIGN_TOKENS.colors.text,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.08,
          shadowRadius: 12,
        },
        android: { elevation: 3 },
        default: {
          shadowColor: DESIGN_TOKENS.colors.text,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.08,
          shadowRadius: 12,
        },
      }),
    },
    cardHomeFeatured: {
      borderWidth: 1,
      borderColor: colors.primaryAlpha30,
      ...Platform.select({
        web: {
          boxShadow: DESIGN_TOKENS.shadows.medium,
          transition: 'transform 0.3s ease, box-shadow 0.3s ease, border-color 0.2s ease',
          backgroundImage: `linear-gradient(180deg, ${colors.surface} 0%, ${colors.backgroundSecondary} 100%)`,
          backgroundRepeat: 'no-repeat',
        } as any,
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
          boxShadow: `0 0 0 3px ${colors.primary}`,
          outlineStyle: 'none',
        } as any,
        default: {
          borderColor: colors.primary,
          borderWidth: 2.5,
        },
      }),
    },

    selectedOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(77, 124, 112, 0.22)',
      zIndex: 2,
      borderRadius: DESIGN_TOKENS.radii.lg,
      pointerEvents: 'none',
    },

    single: {
      maxWidth: 600,
      alignSelf: 'center',
    },

    // Упрощенные кнопки управления — скрыты по умолчанию, видны при hover
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
            opacity: 1,
          }
        : {}),
    },

    adminActionsContainerMobile: {
      top: 8,
      left: 8,
      gap: 2,
      paddingHorizontal: 5,
      paddingVertical: 4,
      // Mobile web: kill the live backdrop-filter (frost rule, CLAUDE.md). The translucent
      // surfaceMuted background already gives the frosted-glass look without re-rasterizing
      // the scrolling list behind each card every frame.
      ...(Platform.OS === 'web'
        ? ({ backdropFilter: 'none', WebkitBackdropFilter: 'none' } as any)
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

    adminBtnMobile: {
      minWidth: 30,
      minHeight: 30,
      paddingHorizontal: 5,
      paddingVertical: 5,
    },

    adminDivider: {
      width: 1,
      height: 16,
      backgroundColor: colors.border,
    },

    adminDividerMobile: {
      height: 14,
    },

    favoriteButtonContainer: {
      position: 'absolute',
      top: DESIGN_TOKENS.spacing.sm,
      right: DESIGN_TOKENS.spacing.sm,
      zIndex: 20,
    },

    cardContentContainer: {
      paddingHorizontal: DESIGN_TOKENS.spacing.sm,
      paddingTop: Platform.OS === 'web' ? 9 : 10,
      paddingBottom: Platform.OS === 'web' ? 11 : 12,
      borderTopWidth: 1,
      borderTopColor: colors.borderLight,
    },

    contentStack: {
      width: '100%',
      minWidth: 0,
      gap: Platform.OS === 'web' ? 4 : 3,
    },

    titleInline: {
      fontSize: Platform.OS === 'web'
        ? DESIGN_TOKENS.typography.sizes.md
        : DESIGN_TOKENS.typography.sizes.sm,
      lineHeight: Platform.OS === 'web'
        ? 20
        : 19,
      fontWeight: DESIGN_TOKENS.typography.weights.semibold as any,
      color: colors.text,
      width: '100%',
      minWidth: 0,
    },

    inlineMetaGroup: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      flexShrink: 1,
      minWidth: 0,
      gap: 0,
      overflow: 'hidden',
    },

    // Компактная мета-информация — одна строка
    metaRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      justifyContent: 'flex-start',
      columnGap: 6,
      rowGap: Platform.OS === 'web' ? 2 : 3,
      minHeight: Platform.OS === 'web' ? 18 : 20,
      paddingTop: 1,
    },

    // Правая часть: рейтинг + бейджи
    metaBadgesRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 4,
      flexShrink: 0,
      maxWidth: '100%',
      minWidth: 0,
      paddingTop: Platform.OS === 'web' ? 1 : 0,
    },

    draftStatusBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      flexShrink: 0,
      paddingHorizontal: 6,
      paddingVertical: Platform.OS === 'web' ? 2 : 3,
      borderRadius: DESIGN_TOKENS.radii.pill,
      backgroundColor: colors.warningSoft,
    },

    draftStatusText: {
      fontSize: META_TEXT_FONT_SIZE,
      lineHeight: META_TEXT_LINE_HEIGHT,
      fontWeight: DESIGN_TOKENS.typography.weights.semibold as any,
      color: colors.warningDark,
    },

    engagementMetricsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Platform.OS === 'web' ? 10 : 8,
      flexShrink: 0,
    },

    engagementMetric: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      flexShrink: 0,
      position: 'relative',
    },

    engagementMetricText: {
      fontSize: META_TEXT_FONT_SIZE,
      lineHeight: META_TEXT_LINE_HEIGHT,
      color: colors.textSecondary,
      fontWeight: DESIGN_TOKENS.typography.weights.semibold as any,
    },

    engagementTooltip: {
      position: 'absolute',
      bottom: 22,
      left: '50%',
      paddingHorizontal: 8,
      paddingVertical: 5,
      borderRadius: DESIGN_TOKENS.radii.sm,
      backgroundColor: colors.text,
      zIndex: 30,
      ...(Platform.OS === 'web'
        ? {
            transform: 'translateX(-50%)',
            boxShadow: '0 8px 20px rgba(0,0,0,0.16)',
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
          } as any
        : {}),
    },

    engagementTooltipText: {
      fontSize: DESIGN_TOKENS.typography.sizes.xs,
      lineHeight: 16,
      color: colors.background,
      fontWeight: DESIGN_TOKENS.typography.weights.medium as any,
    },

    // Год путешествия — компактный чип в правой части мета-строки
    metaYear: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      flexShrink: 0,
    },

    metaYearText: {
      fontSize: META_TEXT_FONT_SIZE,
      lineHeight: META_TEXT_LINE_HEIGHT,
      fontWeight: DESIGN_TOKENS.typography.weights.semibold as any,
      color: colors.textSecondary,
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
      color: colors.warning,
    },

    metaRatingValue: {
      fontSize: Platform.OS === 'web' ? 12 : 11,
      lineHeight: Platform.OS === 'web' ? 14 : 14,
      fontWeight: DESIGN_TOKENS.typography.weights.semibold as any,
      color: colors.textSecondary,
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

    // Оверлей просмотров на фото (mobile web + native): тёмная пилюля в углу,
    // читаемая поверх любого кадра.
    viewsOverlayBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingVertical: 3,
      paddingHorizontal: 7,
      borderRadius: DESIGN_TOKENS.radii.pill,
      backgroundColor: 'rgba(0,0,0,0.55)',
    },
    viewsOverlayText: {
      color: '#fff',
      fontSize: META_TEXT_FONT_SIZE,
      lineHeight: META_TEXT_LINE_HEIGHT,
      fontWeight: '600',
    },

    // Оверлей автора на фото для компактных/мобильных карточек, где текстовая
    // строка автора скрыта. Зеркалит бейдж просмотров (нижний-левый угол).
    authorOverlayBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingVertical: 3,
      paddingHorizontal: 7,
      borderRadius: DESIGN_TOKENS.radii.pill,
      backgroundColor: 'rgba(0,0,0,0.55)',
      maxWidth: 160,
    },
    authorOverlayText: {
      color: '#fff',
      fontSize: META_TEXT_FONT_SIZE,
      lineHeight: META_TEXT_LINE_HEIGHT,
      fontWeight: '600',
      flexShrink: 1,
    },

    metaTxt: {
      fontSize: META_TEXT_FONT_SIZE,
      color: colors.textSecondary,
      fontWeight: DESIGN_TOKENS.typography.weights.medium as any,
      lineHeight: META_TEXT_LINE_HEIGHT,
      minWidth: 0,
    },

    // Inline теги стран (без pill-фона)
    tags: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      flexShrink: 1,
      minWidth: 0,
    },

    tagTxt: {
      fontSize: META_TEXT_FONT_SIZE,
      color: colors.textSecondary,
      fontWeight: DESIGN_TOKENS.typography.weights.medium as any,
      lineHeight: META_TEXT_LINE_HEIGHT,
      flexShrink: 1,
      // Guarantee the country fits ~8-10 chars before truncating, so it never
      // collapses to ".:.." on narrow 2-col cards.
      minWidth: 64,
    },

    // Чекбоксы выбора
    checkWrap: {
      position: 'absolute',
      top: 8,
      right: 8,
      zIndex: 20,
      padding: 4,
    },

    checkboxHitTarget: {
      padding: 4,
    },

    checkbox: {
      width: 28,
      height: 28,
      borderRadius: DESIGN_TOKENS.radii.full,
      borderWidth: 2,
      borderColor: 'rgba(255,255,255,0.85)',
      backgroundColor: 'rgba(0,0,0,0.28)',
      justifyContent: 'center',
      alignItems: 'center',
      ...(Platform.OS === 'web'
        ? { cursor: 'pointer', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }
        : {}),
    },

    checkboxChecked: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
  });
