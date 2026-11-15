import { Platform, StyleSheet, type TextStyle } from 'react-native'

import { DESIGN_TOKENS } from '@/constants/designSystem'
import type { ThemedColors } from '@/hooks/useTheme'

const { spacing, radii, typography } = DESIGN_TOKENS

export const ASSISTANT_CONTENT_MAX_WIDTH = 760
/** Минимальный тач-таргет строки источника и кнопок композера. */
export const ASSISTANT_TOUCH_TARGET = 48

export const createAssistantStyles = (colors: ThemedColors, isMobile: boolean) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      flexGrow: 1,
      width: '100%',
      maxWidth: ASSISTANT_CONTENT_MAX_WIDTH,
      alignSelf: 'center',
      paddingHorizontal: isMobile ? spacing.md : spacing.lg,
      paddingTop: isMobile ? spacing.sm : spacing.lg,
      gap: spacing.md,
    },
    emptyWrap: {
      flexGrow: 1,
      justifyContent: 'center',
      paddingVertical: spacing.lg,
    },
    examplesRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      gap: spacing.xs,
      marginTop: spacing.md,
    },
    // Пилюля примера обязана помещаться в ширину ряда: без maxWidth кнопка
    // берёт ширину подписи в одну строку, и на 320–390 px текст обрезается
    // с обеих сторон (#2894); с ограничением подпись переносится на 2 строки.
    exampleChip: {
      maxWidth: '100%',
      flexShrink: 1,
    },
    turn: {
      gap: spacing.sm,
    },
    questionBubble: {
      alignSelf: 'flex-end',
      maxWidth: '88%',
      backgroundColor: colors.primaryLight,
      borderRadius: radii.md,
      borderBottomRightRadius: radii.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    questionText: {
      ...typography.scale.body,
      color: colors.text,
    },
    answerCard: {
      alignSelf: 'stretch',
      backgroundColor: colors.surface,
      borderColor: colors.borderLight,
      borderWidth: StyleSheet.hairlineWidth,
      borderRadius: radii.md,
      borderBottomLeftRadius: radii.sm,
      padding: spacing.md,
      gap: spacing.sm,
    },
    roleLabel: {
      ...typography.scale.label,
      textTransform: 'uppercase',
      color: colors.textMuted,
    },
    answerText: {
      ...typography.scale.body,
      fontSize: isMobile ? 15 : 16,
      lineHeight: isMobile ? 22 : 24,
      color: colors.text,
    },
    statusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      minHeight: 24,
    },
    statusText: {
      ...typography.scale.bodySmall,
      color: colors.textMuted,
      flex: 1,
    },
    noticeText: {
      ...typography.scale.bodySmall,
      color: colors.textMuted,
    },
    noticeActions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.xs,
    },
    feedbackRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: spacing.xs,
      marginTop: spacing.xxs,
    },
    feedbackLabel: {
      ...typography.scale.bodySmall,
      color: colors.textMuted,
    },
    sourcesTitle: {
      ...typography.scale.label,
      textTransform: 'uppercase',
      color: colors.textMuted,
      marginTop: spacing.xxs,
    },
    sourceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      minHeight: ASSISTANT_TOUCH_TARGET,
      paddingVertical: spacing.xxs,
      paddingHorizontal: spacing.xs,
      borderRadius: radii.sm,
      backgroundColor: colors.backgroundSecondary,
    },
    sourceRowPressed: {
      opacity: 0.8,
    },
    // Блок «Ещё в мире» (#3357): строка маршрута выше строки источника — под названием стоят факты.
    worldRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.sm,
      minHeight: ASSISTANT_TOUCH_TARGET,
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.xs,
      borderRadius: radii.sm,
      backgroundColor: colors.backgroundSecondary,
    },
    worldFacts: {
      ...typography.scale.caption,
      color: colors.text,
    },
    worldEffort: {
      ...typography.scale.caption,
      fontWeight: '600',
      color: colors.text,
    },
    worldNote: {
      ...typography.scale.caption,
      color: colors.textMuted,
    },
    sourceIcon: {
      width: 32,
      height: 32,
      borderRadius: radii.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primaryLight,
    },
    sourceTextCol: {
      flex: 1,
      gap: 2,
    },
    sourceType: {
      ...typography.scale.caption,
      color: colors.textMuted,
    },
    sourceTitle: {
      ...typography.scale.bodySmall,
      fontWeight: '600',
      color: colors.text,
    },
    composerWrap: {
      width: '100%',
      maxWidth: ASSISTANT_CONTENT_MAX_WIDTH,
      alignSelf: 'center',
      paddingHorizontal: isMobile ? spacing.md : spacing.lg,
      paddingTop: spacing.xs,
      gap: spacing.xxs,
      backgroundColor: colors.background,
    },
    composerRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: spacing.xs,
    },
    input: {
      flex: 1,
      minHeight: ASSISTANT_TOUCH_TARGET,
      maxHeight: 140,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.borderLight,
      backgroundColor: colors.surface,
      color: colors.text,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      fontSize: 16,
      lineHeight: 22,
      ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' as TextStyle['outlineStyle'] } as const) : null),
    },
    inputError: {
      borderColor: colors.danger,
    },
    composerMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      minHeight: 20,
    },
    composerMetaText: {
      ...typography.scale.caption,
      color: colors.textMuted,
      flex: 1,
    },
    composerErrorText: {
      ...typography.scale.caption,
      color: colors.danger,
      flex: 1,
    },
    disclaimer: {
      ...typography.scale.caption,
      color: colors.textMuted,
    },
    // Та же колонка, что у поля вопроса (`composerWrap`): на широком экране строка не уезжает к краю окна.
    planBlock: {
      gap: spacing.sm,
    },
    planDay: {
      gap: spacing.xs,
    },
    planDayHead: {
      flexDirection: 'row',
      alignItems: 'baseline',
      flexWrap: 'wrap',
      gap: spacing.xs,
    },
    planDayTitle: {
      ...typography.scale.label,
      color: colors.text,
    },
    planDayHours: {
      ...typography.scale.caption,
      color: colors.textMuted,
    },
    profileNotice: {
      ...typography.scale.caption,
      color: colors.textMuted,
      width: '100%',
      maxWidth: ASSISTANT_CONTENT_MAX_WIDTH,
      alignSelf: 'center',
      paddingHorizontal: isMobile ? spacing.md : spacing.lg,
      paddingBottom: spacing.xs,
    },
  })

export type AssistantStyles = ReturnType<typeof createAssistantStyles>
