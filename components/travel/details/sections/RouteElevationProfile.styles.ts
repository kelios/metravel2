import { StyleSheet } from 'react-native'

import { DESIGN_TOKENS } from '@/constants/designSystem'
import type { ThemedColors } from '@/hooks/useTheme'

export const createRouteElevationProfileStyles = (colors: ThemedColors) =>
  StyleSheet.create({
    container: {
      marginTop: DESIGN_TOKENS.spacing.sm,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: DESIGN_TOKENS.radii.md,
      backgroundColor: colors.surface,
      padding: DESIGN_TOKENS.spacing.md,
    },
    title: {
      fontSize: DESIGN_TOKENS.typography.sizes.sm,
      fontWeight: '700',
      color: colors.text,
    },
    subtitle: {
      marginTop: 2,
      fontSize: 12,
      color: colors.textMuted,
      fontWeight: '500',
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: DESIGN_TOKENS.spacing.sm,
      marginBottom: DESIGN_TOKENS.spacing.sm,
    },
    headerTextWrap: {
      flex: 1,
    },
    downloadBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      minHeight: 44,
      paddingHorizontal: 12,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: colors.borderLight,
      backgroundColor: colors.surfaceMuted,
      justifyContent: 'center',
    },
    downloadBtnText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.primaryText,
    },
    downloadBtnPressed: {
      opacity: 0.85,
      backgroundColor: colors.backgroundSecondary,
    },
    downloadBtnDisabled: {
      opacity: 0.45,
    },
    summaryGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: DESIGN_TOKENS.spacing.xs,
      marginBottom: DESIGN_TOKENS.spacing.sm,
    },
    // #1671: узкая раскладка держит три плитки одним рядом — без flexWrap и
    // minWidth плитки уезжали в две колонки на три ряда.
    summaryGridCompact: {
      flexWrap: 'nowrap',
      gap: DESIGN_TOKENS.spacing.xxs,
      marginBottom: DESIGN_TOKENS.spacing.xs,
    },
    summaryCard: {
      minWidth: 124,
      flexGrow: 1,
      borderRadius: DESIGN_TOKENS.radii.sm,
      borderWidth: 1,
      borderColor: colors.borderLight,
      backgroundColor: colors.surfaceMuted,
      paddingHorizontal: DESIGN_TOKENS.spacing.sm,
      paddingVertical: DESIGN_TOKENS.spacing.sm,
    },
    // `flexShrink: 1` здесь не косметика: в RN значение по умолчанию — 0, и ряд
    // из трёх плиток надеялся только на `flexBasis: 0`. На iOS (TestFlight
    // 1.0.5 (8)) третья плитка «Перепад» всё равно уезжала за правый край
    // карточки, хотя на web та же раскладка меряется ровно (три плитки по 109 px
    // в контейнере 336 px). Разрешение сжиматься делает ряд независимым от того,
    // как платформа резолвит базис.
    summaryCardCompact: {
      minWidth: 0,
      flexBasis: 0,
      flexShrink: 1,
      paddingHorizontal: DESIGN_TOKENS.spacing.xs,
      paddingVertical: DESIGN_TOKENS.spacing.xs,
    },
    summaryCardAccent: {
      backgroundColor: colors.backgroundSecondary,
      borderColor: colors.border,
    },
    summaryIconWrap: {
      width: 26,
      height: 26,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
      marginBottom: DESIGN_TOKENS.spacing.xs,
    },
    summaryIconWrapCompact: {
      width: 22,
      height: 22,
      borderRadius: 11,
      marginBottom: DESIGN_TOKENS.spacing.xxs,
    },
    summaryIconWrapAccent: {
      backgroundColor: colors.primarySoft,
    },
    summaryLabel: {
      fontSize: 11,
      color: colors.textMuted,
      marginBottom: 2,
    },
    summaryValue: {
      fontSize: DESIGN_TOKENS.typography.sizes.xs,
      color: colors.text,
      fontWeight: '700',
    },
    chartWrap: {
      position: 'relative',
      borderRadius: DESIGN_TOKENS.radii.sm,
      borderWidth: 1,
      borderColor: colors.borderLight,
      backgroundColor: colors.backgroundSecondary,
      overflow: 'hidden',
    },
    chartMetaRow: {
      position: 'absolute',
      top: DESIGN_TOKENS.spacing.xs,
      left: DESIGN_TOKENS.spacing.sm,
      right: DESIGN_TOKENS.spacing.sm,
      zIndex: 2,
      flexDirection: 'row',
      justifyContent: 'space-between',
      pointerEvents: 'none',
    },
    chartMetaBadge: {
      borderRadius: 999,
      backgroundColor: colors.surfaceAlpha40,
      borderWidth: 1,
      borderColor: colors.borderLight,
      paddingHorizontal: DESIGN_TOKENS.spacing.xs,
      paddingVertical: 4,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    chartMetaBadgePeak: {
      backgroundColor: colors.primaryAlpha30,
      borderColor: colors.primaryAlpha40,
    },
    chartMetaBadgeCompact: {
      paddingHorizontal: 6,
      minHeight: 24,
    },
    chartMetaLabel: {
      fontSize: 11,
      color: colors.textMuted,
      fontWeight: '600',
    },
    chartMetaValue: {
      fontSize: 11,
      color: colors.text,
      fontWeight: '700',
    },
    tooltip: {
      position: 'absolute',
      zIndex: 3,
      width: 104,
      borderRadius: DESIGN_TOKENS.radii.sm,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceElevated,
      paddingHorizontal: DESIGN_TOKENS.spacing.xs,
      paddingVertical: 6,
    },
    tooltipTitle: {
      fontSize: 11,
      color: colors.text,
      fontWeight: '700',
      marginBottom: 2,
    },
    tooltipSubtitle: {
      fontSize: 10,
      color: colors.textMuted,
    },
    chartHitArea: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 4,
    },
    yAxisLabels: {
      position: 'absolute',
      top: 0,
      left: DESIGN_TOKENS.spacing.sm,
      width: 56,
      height: 120,
      zIndex: 1,
      pointerEvents: 'none',
    },
    yAxisText: {
      position: 'absolute',
      left: 0,
      fontSize: 10,
      color: colors.textMuted,
      backgroundColor: colors.surfaceAlpha40,
      paddingHorizontal: 4,
      borderRadius: 6,
      overflow: 'hidden',
    },
    yAxisTextCompact: {
      fontSize: 9,
      paddingHorizontal: 2,
    },
    axisLabels: {
      marginTop: 2,
      marginHorizontal: DESIGN_TOKENS.spacing.sm,
      marginBottom: DESIGN_TOKENS.spacing.xs,
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    axisText: {
      fontSize: 11,
      color: colors.textMuted,
    },
    tagsRow: {
      marginTop: 4,
      marginBottom: DESIGN_TOKENS.spacing.xs,
      marginHorizontal: DESIGN_TOKENS.spacing.sm,
      gap: DESIGN_TOKENS.spacing.xs,
      width: '100%',
      alignSelf: 'stretch',
    },
    pointCardsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: DESIGN_TOKENS.spacing.xs,
      width: '100%',
      alignSelf: 'stretch',
      marginTop: DESIGN_TOKENS.spacing.sm,
    },
    // Компакт складывает карточки в столбец ЯВНО. Раньше стопка держалась на
    // `flexBasis: '100%'` у карточки внутри wrap-ряда: на web это переносит
    // каждую карточку на свою строку, а на iOS все три остались одним рядом —
    // подпись схлопывалась до «Т…», а высота («180 м») вылезала за границу чипа
    // (TestFlight 1.0.5 (8)). Столбец не зависит от резолва процентного базиса.
    pointCardsGridCompact: {
      flexDirection: 'column',
      flexWrap: 'nowrap',
    },
    pointCard: {
      minWidth: 150,
      flex: 1,
      borderRadius: DESIGN_TOKENS.radii.sm,
      borderWidth: 1,
      borderColor: colors.borderLight,
      backgroundColor: colors.surface,
      padding: DESIGN_TOKENS.spacing.sm,
    },
    // На узком экране три карточки в ряд давали каждой ~91px, из которых под
    // подпись оставалось 65px: название точки («Минск, площадь Победы» — 147px)
    // схлопывалось до нечитаемого огрызка. Поэтому на компакте карточка занимает
    // строку целиком и раскладывается в ряд — подпись получает всю ширину, а по
    // высоте выходит даже меньше прежних трёх строк.
    pointCardCompact: {
      minWidth: 0,
      // Гасим `flex: 1` базовой карточки явными значениями: в столбце карточка
      // не растёт и не сжимается, а ширину берёт от `alignSelf: 'stretch'`.
      flexGrow: 0,
      flexShrink: 0,
      flexBasis: 'auto',
      alignSelf: 'stretch',
      flexDirection: 'row',
      alignItems: 'center',
      gap: DESIGN_TOKENS.spacing.xs,
      paddingVertical: DESIGN_TOKENS.spacing.xs,
    },
    pointCardHeaderCompact: {
      marginBottom: 0,
      flexShrink: 0,
      gap: 4,
    },
    // Подпись — единственный растяжимый элемент строки: `minWidth: 0` обязателен,
    // иначе flex-item не сжимается ниже intrinsic-ширины и снова режет текст.
    pointCardCaptionCompact: {
      flex: 1,
      minWidth: 0,
    },
    pointCardValueCompact: {
      marginBottom: 0,
      flexShrink: 0,
    },
    pointCardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 6,
    },
    pointCardLabel: {
      fontSize: 12,
      color: colors.textMuted,
      fontWeight: '700',
    },
    pointCardValue: {
      fontSize: DESIGN_TOKENS.typography.sizes.md,
      color: colors.text,
      fontWeight: '700',
      marginBottom: 4,
    },
    pointCardCaption: {
      fontSize: 12,
      color: colors.textMuted,
      lineHeight: 16,
    },
    transportWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      flexShrink: 0,
      maxWidth: '100%',
      alignSelf: 'flex-start',
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.borderLight,
      backgroundColor: colors.surfaceMuted,
      paddingHorizontal: DESIGN_TOKENS.spacing.sm,
      paddingVertical: 6,
    },
    tagItem: {
      fontSize: DESIGN_TOKENS.typography.sizes.xs,
      color: colors.text,
      fontWeight: '600',
    },
  })
