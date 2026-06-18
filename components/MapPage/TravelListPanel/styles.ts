import { StyleSheet } from 'react-native'

import type { ThemedColors } from '@/hooks/useTheme'

import { IS_WEB } from './helpers'

export const getStyles = (colors: ThemedColors) =>
  StyleSheet.create({
    list: { paddingBottom: 8, alignItems: 'center' },
    listHeaderCard: {
      width: '100%',
      padding: 14,
      marginBottom: 10,
      borderRadius: 16,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderLight,
      gap: 10,
    },
    listHeaderTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 8,
    },
    listHeaderTitle: {
      fontSize: 18,
      fontWeight: '800',
      color: colors.text,
      letterSpacing: -0.3,
    },
    listHeaderCountChip: {
      paddingHorizontal: 9,
      paddingVertical: 3,
      borderRadius: 999,
      backgroundColor: colors.primarySoft,
    },
    listHeaderCountChipText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.primaryText,
    },
    listHeaderHint: { fontSize: 13, lineHeight: 18, color: colors.textMuted },
    listHeaderActions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: 8,
    },
    filtersButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      minHeight: 40,
      paddingHorizontal: 14,
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.primary,
      backgroundColor: colors.primarySoft,
    },
    filtersButtonPressed: { opacity: 0.7 },
    filtersButtonText: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.primaryText,
    },
    webScrollView: {
      flex: 1,
      minHeight: 0,
      width: '100%',
      ...(IS_WEB
        ? ({ scrollbarWidth: 'thin', scrollbarColor: `${colors.border} transparent` } as any)
        : null),
    },
    nativeList: {
      flex: 1,
      minHeight: 0,
      width: '100%',
    },
    compactPreviewCard: {
      width: '100%',
      minHeight: 76,
      paddingHorizontal: 12,
      paddingVertical: 10,
      marginBottom: 8,
      borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderLight,
      backgroundColor: colors.surface,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    compactPreviewCardPressed: {
      opacity: 0.85,
    },
    compactPreviewIcon: {
      width: 42,
      height: 42,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.backgroundSecondary,
    },
    compactPreviewIconText: {
      color: colors.primary,
      fontSize: 20,
      fontWeight: '800',
    },
    compactPreviewText: {
      flex: 1,
      minWidth: 0,
    },
    compactPreviewTitle: {
      color: colors.text,
      fontSize: 15,
      fontWeight: '800',
      lineHeight: 20,
    },
    compactPreviewSubtitle: {
      color: colors.textMuted,
      fontSize: 12,
      lineHeight: 16,
      marginTop: 2,
    },
    loader: { paddingVertical: 16, alignItems: 'center' },
    endText: {
      textAlign: 'center',
      color: colors.textMuted,
      paddingVertical: 16,
      fontSize: 12,
    },
    emptyContainer: { padding: 32, alignItems: 'center', gap: 8 },
    emptyIconCircle: {
      width: 88,
      height: 88,
      borderRadius: 44,
      marginBottom: 8,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceMuted,
    },
    emptyText: { fontSize: 16, fontWeight: '600', color: colors.text },
    emptyHint: {
      fontSize: 14,
      color: colors.textMuted,
      textAlign: 'center',
      marginBottom: 8,
    },
    emptyActions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 12,
      marginTop: 4,
    },
    skeletonContainer: { padding: 12, gap: 12 },
    skeletonCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 12,
      borderRadius: 12,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    skeletonLines: { flex: 1, gap: 8 },
  })

export type TravelListStyles = ReturnType<typeof getStyles>
