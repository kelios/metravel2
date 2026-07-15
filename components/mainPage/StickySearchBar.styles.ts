import { useMemo } from 'react';
import { Platform, StyleSheet } from 'react-native';

import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';
import { webTextStyle, webViewStyle } from '@/utils/webProps';

const spacing = DESIGN_TOKENS.spacing;
const radii = DESIGN_TOKENS.radii;

export const useStickySearchBarStyles = (colors: ReturnType<typeof useThemedColors>) => useMemo(() => StyleSheet.create({
  container: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: radii.lg,
    paddingHorizontal: Platform.select({ default: spacing.xs, web: spacing.xs }),
    paddingVertical: Platform.select({ default: spacing.xxs, web: spacing.xxs }),
    gap: Platform.select({ default: spacing.xs, web: spacing.xs }),
    minHeight: Platform.select({ default: 46, web: 48 }),
    ...Platform.select({
      web: webViewStyle({
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        backgroundColor: colors.surfaceElevated,
        boxShadow: colors.boxShadows.card,
      }),
    }),
  },
  containerMobile: {
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xxs,
    minHeight: 42,
    borderRadius: radii.md,
  },
  containerFlush: {
    paddingHorizontal: 0,
  },
  containerMobileWeb: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    minHeight: 0,
    // Мобильный GPU: живой backdrop-blur запрещён — статичный фрост (правило CLAUDE.md)
    backgroundColor: colors.surfaceMuted,
    ...Platform.select({
      web: webViewStyle({
        backdropFilter: 'none',
        WebkitBackdropFilter: 'none',
      }),
    }),
  },
  inner: {
    width: '100%',
    ...Platform.select({
      web: webViewStyle({
        maxWidth: 1120,
        marginLeft: 'auto',
        marginRight: 'auto',
      }),
    }),
  },
  innerFlush: {
    ...Platform.select({
      web: webViewStyle({
        maxWidth: '100%',
        marginLeft: 0,
        marginRight: 0,
      }),
    }),
  },
  containerFocused: {
    borderColor: colors.primary,
    ...Platform.select({
      web: webViewStyle({
        boxShadow: `${colors.boxShadows.card}, 0 0 0 3px ${colors.primaryAlpha30}`,
      }),
    }),
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Platform.select({ default: spacing.xs, web: spacing.sm }),
    ...Platform.select({
      web: webViewStyle({
        justifyContent: 'space-between',
      }),
    }),
  },
  contentRowMobile: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'nowrap',
  },
  searchBox: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderRadius: 0,
    borderWidth: 0,
    borderColor: 'transparent',
    paddingHorizontal: Platform.select({ default: spacing.sm, web: spacing.sm }),
    paddingVertical: Platform.select({ default: spacing.xxs, web: spacing.xxs }),
    gap: spacing.xs,
    height: Platform.select({ default: 38, web: 40 }),
    ...Platform.select({
      web: webViewStyle({
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
      }),
    }),
  },
  searchBoxMobile: {
    flex: 1,
    minWidth: 0,
    marginBottom: 0,
    height: 38,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xxs,
    gap: 6,
  },
  input: {
    flex: 1,
    fontSize: Platform.select({ default: 14, web: 15 }),
    fontWeight: '400',
    color: colors.text,
    padding: 0,
    lineHeight: Platform.select({ default: 20, web: 22 }),
    ...Platform.select({
      web: {
        outlineStyle: 'none',
        boxShadow: 'none',
        borderColor: 'transparent',
      },
    }),
  },
  inputMobile: {
    fontSize: 16,
  },
  clearButton: {
    padding: spacing.xs,
    ...Platform.select({
      web: {
        cursor: 'pointer',
      },
    }),
  },
  shortcutHint: {
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    backgroundColor: colors.surfaceMuted,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  shortcutText: {
    fontSize: 11,
    // The shortcut chip is a secondary affordance, not muted decoration; textSecondary keeps
    // the role explicit (palettes give both tokens the same value, so contrast is unchanged).
    color: colors.textSecondary,
    fontFamily: Platform.select({
      web: 'monospace',
      default: 'monospace',
    }),
  },
  // SRCH-06: Quick-filter chips
  quickFiltersRow: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    gap: spacing.xs,
    paddingTop: spacing.xs,
    ...Platform.select({
      web: webViewStyle({ overflowX: 'auto', paddingBottom: 2 }),
    }),
  },
  quickChip: {
    flexShrink: 0,
    minHeight: 36,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Platform.select({ default: spacing.xs, web: spacing.sm }),
  },
  actionsDesktop: {
    flexShrink: 0,
    flexWrap: 'nowrap',
    padding: 0,
    borderRadius: 0,
    backgroundColor: 'transparent',
    borderWidth: 0,
    borderColor: 'transparent',
  },
  resultsInline: {
    paddingHorizontal: spacing.sm,
    height: Platform.select({ default: 40, web: 52 }),
    minWidth: Platform.select({ default: 0, web: 216 }),
    ...(Platform.OS === 'web' ? webViewStyle({ width: 216 }) : null),
    alignItems: 'flex-start',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  mobileSummaryRow: {
    minHeight: 20,
    paddingHorizontal: spacing.xs,
    paddingTop: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flexWrap: 'wrap',
  },
  mobileSummaryText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '700',
  },
  pendingStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 20,
  },
  pendingStatusText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  actionsMobile: {
    flexShrink: 0,
    justifyContent: 'flex-start',
  },
  actionButton: {
    // Web desktop matches the results-pill / clear-all height (52) so the action row reads
    // as a single visual band; native stays compact at 42 to keep the touch row dense.
    width: Platform.select({ default: 42, web: 52 }),
    height: Platform.select({ default: 42, web: 52 }),
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
    position: 'relative',
    ...Platform.select({
      web: {
        cursor: 'pointer',
        transition: 'all 0.2s ease',
      },
    }),
  },
  actionButtonHovered: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.borderStrong,
  },
  actionButtonMobile: {
    width: DESIGN_TOKENS.touchTarget.minWidth,
    height: DESIGN_TOKENS.touchTarget.minHeight,
    borderRadius: 12,
  },
  actionButtonMobileWeb: {
    width: DESIGN_TOKENS.touchTarget.minWidth,
    height: DESIGN_TOKENS.touchTarget.minHeight,
    borderRadius: 12,
  },
  actionButtonActive: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primaryAlpha40,
  },
  badge: {
    position: 'absolute',
    top: 4,
    right: 4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeDot: {
    width: '100%',
    height: '100%',
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  badgeCount: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textOnPrimary,
    lineHeight: 12,
  },
  clearAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.sm,
    height: Platform.select({ default: 46, web: 52 }),
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...Platform.select({
      web: {
        cursor: 'pointer',
      },
    }),
  },
  clearAllText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  resultsText: {
    fontSize: 15,
    color: colors.text,
    fontWeight: '600',
    ...(Platform.OS === 'web'
      ? webTextStyle({
          width: '100%',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          fontVariantNumeric: 'tabular-nums',
        })
      : null),
  },
  resultsLabel: {
    fontSize: 10,
    color: colors.textMuted,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0,
    marginBottom: 2,
  },
  searchBoxFocused: {
    borderColor: 'transparent',
    backgroundColor: 'transparent',
  },
  clearButtonIconWrap: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: colors.surfaceMuted,
  },
  inlineIconSlot: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  actionIconSlot: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  shortcutHintDesktop: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.borderLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.pill,
  },
  recommendationAccent: {
    position: 'absolute',
    bottom: 6,
    width: 16,
    height: 2,
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
  historyPanel: {
    marginTop: spacing.xs,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    gap: 2,
  },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xs,
    paddingBottom: spacing.xxs,
  },
  historyHeaderText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    color: colors.textMuted,
  },
  historyClearAll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 44,
    paddingHorizontal: spacing.xs,
    justifyContent: 'center',
    ...Platform.select({ web: webViewStyle({ cursor: 'pointer' }) }),
  },
  historyClearAllText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    borderRadius: radii.sm,
    ...Platform.select({ web: webViewStyle({ cursor: 'pointer' }) }),
  },
  historyRowMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.xs,
    minWidth: 0,
  },
  historyRowText: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
  },
  historyRemove: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({ web: webViewStyle({ cursor: 'pointer' }) }),
  },
}), [colors]);
