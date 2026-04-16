import { Platform, StyleSheet } from 'react-native'

import { DESIGN_TOKENS } from '@/constants/designSystem'
import type { ThemedColors } from '@/hooks/useTheme'

type ArticleEditorWebStyleOptions = {
  isCompactViewport: boolean
  isSmallViewport: boolean
}

export const getArticleEditorWebStyles = (
  colors: ThemedColors,
  options: ArticleEditorWebStyleOptions,
) =>
  StyleSheet.create({
    wrap: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: DESIGN_TOKENS.radii.md,
      marginVertical: DESIGN_TOKENS.spacing.sm,
      backgroundColor: colors.surface,
      width: '100%',
      maxWidth: '100%',
      overflow: 'hidden',
    },
    bar: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: options.isCompactViewport ? 'flex-start' : 'center',
      flexWrap: 'wrap',
      paddingHorizontal: options.isCompactViewport
        ? DESIGN_TOKENS.spacing.sm
        : DESIGN_TOKENS.spacing.md,
      paddingVertical: DESIGN_TOKENS.spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.surfaceElevated,
      position: Platform.OS === 'web' ? ('sticky' as any) : 'relative',
      top: Platform.OS === 'web' ? 0 : undefined,
      zIndex: Platform.OS === 'web' ? 20 : undefined,
      overflow: Platform.OS === 'web' ? ('visible' as any) : undefined,
    },
    label: {
      fontSize: DESIGN_TOKENS.typography.sizes.md,
      fontWeight: '600' as const,
      color: colors.text,
      width: options.isCompactViewport ? '100%' : undefined,
      marginBottom: options.isCompactViewport ? DESIGN_TOKENS.spacing.xs : 0,
      paddingRight: DESIGN_TOKENS.spacing.sm,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: options.isCompactViewport ? 'flex-start' : 'flex-end',
      flexWrap: 'wrap',
      flexShrink: 1,
      width: options.isCompactViewport ? '100%' : undefined,
      overflow: Platform.OS === 'web' ? ('visible' as any) : undefined,
    },
    btn: {
      marginLeft: options.isCompactViewport ? 0 : DESIGN_TOKENS.spacing.sm,
      marginTop: options.isCompactViewport ? DESIGN_TOKENS.spacing.xs : 0,
    },
    editorArea: {
      flex: 1,
      minHeight: 0,
      ...(Platform.OS === 'web' ? ({ overflow: 'visible' } as any) : null),
    },
    editor: {
      minHeight: 200,
      flex: 1,
      ...(Platform.OS === 'web' ? ({ width: '100%', minWidth: 0 } as any) : null),
    },
    html: {
      minHeight: options.isCompactViewport ? 240 : 200,
      flex: 1,
      padding: DESIGN_TOKENS.spacing.md,
      fontSize: DESIGN_TOKENS.typography.sizes.sm,
      color: colors.text,
      backgroundColor: colors.surface,
    },
    loadBox: {
      padding: DESIGN_TOKENS.spacing.lg,
      alignItems: 'center',
      justifyContent: 'center',
      gap: DESIGN_TOKENS.spacing.sm,
    },
    loadTxt: {
      color: colors.textSecondary,
    },
    loadHint: {
      color: colors.textSecondary,
      textAlign: 'center' as const,
      maxWidth: 360,
    },
    fullWrap: {
      flex: 1,
      height: '100%',
      width: '100%',
      ...(Platform.OS === 'web'
        ? ({
            minHeight: '100dvh',
            minWidth: '100vw',
            position: 'fixed',
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            zIndex: 1000,
          } as any)
        : null),
      backgroundColor: colors.background,
    },
    fullInner: {
      flex: 1,
      width: '100%',
      maxWidth: '100%',
      paddingHorizontal: 0,
      paddingBottom: 0,
    },
    modalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.35)',
      justifyContent: 'center' as const,
      padding: options.isCompactViewport
        ? DESIGN_TOKENS.spacing.md
        : DESIGN_TOKENS.spacing.lg,
    },
    modalCard: {
      width: '100%',
      maxWidth: 520,
      alignSelf: 'center' as const,
      backgroundColor: colors.surface,
      borderRadius: DESIGN_TOKENS.radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: options.isCompactViewport
        ? DESIGN_TOKENS.spacing.md
        : DESIGN_TOKENS.spacing.lg,
    },
    modalTitle: {
      color: colors.text,
      fontSize: DESIGN_TOKENS.typography.sizes.md,
      fontWeight: '600' as const,
      marginBottom: DESIGN_TOKENS.spacing.sm,
    },
    modalDescription: {
      color: colors.textSecondary,
      fontSize: DESIGN_TOKENS.typography.sizes.sm,
      marginBottom: DESIGN_TOKENS.spacing.md,
    },
    modalInput: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: DESIGN_TOKENS.radii.sm,
      paddingHorizontal: DESIGN_TOKENS.spacing.md,
      paddingVertical: DESIGN_TOKENS.spacing.sm,
      color: colors.text,
      backgroundColor: colors.surface,
      marginBottom: DESIGN_TOKENS.spacing.md,
    },
    modalActions: {
      flexDirection: options.isSmallViewport ? 'column-reverse' as const : 'row' as const,
      justifyContent: 'flex-end' as const,
      alignItems: options.isSmallViewport ? 'stretch' as const : 'center' as const,
      gap: DESIGN_TOKENS.spacing.sm,
    },
  })
