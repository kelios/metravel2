import { Platform, StyleSheet } from 'react-native';
import type { ThemedColors } from '@/hooks/useTheme';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import {
  BreakpointKey,
  COMPACT_LAYOUT_SPACING,
  FONT_SIZES,
  SPACING,
} from './constants';

export const getStyles = (
  colors: ThemedColors,
  bp: BreakpointKey,
  heroWidth: number,
  heroHeight: number,
  compactLayout: boolean,
  splitLayout: boolean,
) => {
  const sp = SPACING[bp];
  const fs = FONT_SIZES[bp];
  const compactSp = COMPACT_LAYOUT_SPACING[bp];
  const horizontalPadding = compactLayout
    ? compactSp.horizontalPadding
    : bp === 'narrow'
      ? 12
      : 14;
  const topPadding = compactLayout
    ? compactSp.topPadding
    : bp === 'narrow'
      ? 12
      : 14;
  const bottomPadding = compactLayout
    ? compactSp.bottomPadding
    : bp === 'narrow'
      ? 12
      : 14;

  return StyleSheet.create({
    container: {
      width: '100%',
      minWidth: 0,
      alignSelf: 'stretch',
    },
    popupCard: {
      width: '100%',
      backgroundColor: colors.surface,
      borderRadius: compactLayout ? compactSp.radius + 4 : sp.radius + 4,
      overflow: 'hidden',
      ...(Platform.OS === 'web'
        ? ({
            boxShadow: '0 22px 52px rgba(15,23,42,0.22), 0 8px 18px rgba(15,23,42,0.12)',
          } as any)
        : {
            shadowColor: DESIGN_TOKENS.colors.text,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.06,
            shadowRadius: 16,
            elevation: 4,
          }),
    },
    topSection: {
      width: '100%',
      paddingTop: splitLayout ? 0 : topPadding,
      paddingHorizontal: splitLayout ? 0 : horizontalPadding,
    },
    topSectionSplit: {
      flexDirection: 'row',
      alignItems: 'flex-start',
    },
    imageContainer: {
      width: '100%',
      height: heroHeight > 0 ? heroHeight : undefined,
      minHeight: heroHeight > 0 ? heroHeight : 0,
      position: 'relative',
      backgroundColor: colors.backgroundSecondary,
      borderRadius: 0,
      overflow: 'hidden',
      // Always-on cursor affordance on web so users immediately see that the
      // hero image is clickable to open the fullscreen viewer (do not gate it
      // behind hover state — touch users never hover).
      ...(Platform.OS === 'web' ? ({ cursor: 'zoom-in' } as any) : null),
    },
    imageContainerSplit: {
      width: heroWidth,
      minWidth: heroWidth,
      maxWidth: heroWidth,
      height: undefined,
      minHeight: heroHeight > 0 ? heroHeight : 0,
      flexShrink: 0,
      alignSelf: 'flex-start',
    },
    imageContainerHovered: {
      ...(Platform.OS === 'web' ? ({ cursor: 'zoom-in' } as any) : null),
    },
    imageContainerPressed: {
      opacity: 0.92,
    },
    imageExpandButton: {
      position: 'absolute',
      bottom: compactLayout ? 8 : 10,
      right: compactLayout ? 8 : 10,
      width: compactLayout ? 30 : 34,
      height: compactLayout ? 30 : 34,
      borderRadius: DESIGN_TOKENS.radii.full,
      backgroundColor: 'rgba(15,23,42,0.58)',
      alignItems: 'center',
      justifyContent: 'center',
      ...(Platform.OS === 'web'
        ? ({
            cursor: 'pointer',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            transition: 'background-color 0.15s ease, transform 0.15s ease',
          } as any)
        : null),
    },
    imageExpandButtonHovered: {
      backgroundColor: 'rgba(15,23,42,0.78)',
      transform: [{ scale: 1.06 }],
    },
    imageExpandButtonPressed: {
      backgroundColor: 'rgba(15,23,42,0.85)',
      transform: [{ scale: 0.94 }],
    },
    contentContainer: {
      paddingHorizontal: splitLayout ? horizontalPadding + 2 : 2,
      paddingTop: splitLayout ? topPadding + 2 : 14,
      paddingBottom: 0,
    },
    contentContainerSplit: {
      flex: 1,
      minWidth: 0,
      paddingLeft: splitLayout ? 12 : horizontalPadding + 2,
      paddingRight: splitLayout ? 12 : horizontalPadding + 2,
      paddingTop: splitLayout ? 8 : topPadding + 2,
      paddingBottom: 0,
      justifyContent: 'flex-start',
    },
    footerContainer: {
      paddingHorizontal: horizontalPadding,
      paddingTop: splitLayout ? 10 : 14,
      paddingBottom: bottomPadding,
    },
    footerStack: {
      gap: splitLayout ? 10 : compactLayout ? compactSp.sectionGap : sp.sectionGap,
    },
    infoSection: {
      gap: compactLayout ? 6 : splitLayout ? 6 : bp === 'narrow' ? 8 : 10,
    },
    metaRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: bp === 'narrow' ? 'flex-start' : 'center',
      gap: splitLayout ? 5 : 6,
    },
    metaBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: compactLayout ? 5 : 6,
      minHeight: compactLayout ? compactSp.metaMinHeight : splitLayout ? 24 : 26,
      paddingHorizontal: compactLayout ? 8 : splitLayout ? 9 : 11,
      paddingVertical: compactLayout ? 4 : splitLayout ? 4 : 5,
      borderRadius: DESIGN_TOKENS.radii.pill,
      backgroundColor: colors.backgroundSecondary ?? colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderLight ?? colors.border,
    },
    titleText: {
      fontSize: splitLayout ? fs.title + 1 : fs.title,
      fontWeight: '800',
      color: colors.text,
      lineHeight: (splitLayout ? fs.title + 1 : fs.title) * 1.24,
      letterSpacing: 0,
      ...(Platform.OS === 'web'
        ? ({
            display: '-webkit-box',
            WebkitLineClamp: splitLayout ? 2 : bp === 'narrow' ? 3 : 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          } as any)
        : null),
    },
    subtitleText: {
      fontSize: compactLayout ? fs.small - 1 : splitLayout ? fs.small + 1 : fs.small,
      color: colors.textMuted,
      lineHeight: (compactLayout ? fs.small - 1 : splitLayout ? fs.small + 1 : fs.small) * 1.35,
      ...(Platform.OS === 'web'
        ? ({
            display: '-webkit-box',
            WebkitLineClamp: splitLayout ? 2 : 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          } as any)
        : null),
    },
    inlineLinkRow: {
      alignItems: 'flex-start',
    },
    inlineLink: {
      color: colors.primary,
      fontSize: compactLayout ? fs.small : fs.small + 1,
      fontWeight: '600',
      textDecorationLine: 'none',
      ...(Platform.OS === 'web'
        ? ({
            cursor: 'pointer',
          } as any)
        : null),
    },
    categoryText: {
      fontSize: compactLayout ? fs.small - 1 : fs.small,
      color: colors.textMuted,
    },
    smallText: {
      fontSize: compactLayout ? fs.small - 1 : fs.small,
      color: colors.textMuted,
    },
    drivingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      flexWrap: 'wrap',
    },
    coordRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: compactLayout ? 5 : 6,
      minHeight: compactLayout ? compactSp.coordMinHeight : splitLayout ? 32 : 36,
      paddingHorizontal: compactLayout ? 10 : splitLayout ? 10 : 12,
      paddingVertical: compactLayout ? 5 : 6,
      borderRadius: DESIGN_TOKENS.radii.pill,
      backgroundColor: colors.backgroundSecondary ?? colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderLight ?? colors.border,
    },
    coordText: {
      fontSize: compactLayout ? fs.small : splitLayout ? fs.coord - 1 : fs.coord,
      fontWeight: '500',
      color: colors.text,
      flex: 1,
      minWidth: 0,
      fontFamily:
        Platform.OS === 'web'
          ? ('ui-monospace, SFMono-Regular, Menlo, Consolas, monospace' as any)
          : undefined,
    },
    actionsStack: {
      gap: splitLayout ? 8 : 10,
    },
    actionSummaryText: {
      fontSize: compactLayout ? fs.small - 1 : fs.small,
      lineHeight: (compactLayout ? fs.small - 1 : fs.small) * 1.35,
      color: colors.textMuted,
      fontWeight: '500',
    },
    secondaryActionsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'flex-start',
      justifyContent: 'flex-start',
      gap: splitLayout ? 6 : compactLayout ? 6 : 8,
    },
    chipActionBtn: {
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'flex-start',
      gap: 4,
      width: compactLayout ? 56 : 60,
      paddingVertical: 4,
      paddingHorizontal: 2,
      borderRadius: DESIGN_TOKENS.radii.md,
      ...(Platform.OS === 'web'
        ? ({ cursor: 'pointer', transition: 'background-color 0.15s ease, transform 0.15s ease' } as any)
        : null),
    },
    chipActionBtnPressed: {
      opacity: 0.7,
      transform: [{ scale: 0.95 }],
    },
    chipIconBubble: {
      width: compactLayout ? 34 : 38,
      height: compactLayout ? 34 : 38,
      borderRadius: DESIGN_TOKENS.radii.full,
      alignItems: 'center',
      justifyContent: 'center',
    },
    chipActionText: {
      fontSize: compactLayout ? 10 : 11,
      lineHeight: (compactLayout ? 10 : 11) * 1.25,
      fontWeight: '600',
      color: colors.text,
      textAlign: 'center',
    },
    hoverActionWrap: {
      position: 'relative',
      alignItems: 'center',
      justifyContent: 'center',
    },
    hoverLabelBubble: {
      position: 'absolute',
      bottom: '100%',
      marginBottom: 8,
      paddingHorizontal: 8,
      paddingVertical: 5,
      borderRadius: DESIGN_TOKENS.radii.md,
      backgroundColor: 'rgba(18, 24, 38, 0.92)',
      zIndex: 3,
      ...(Platform.OS === 'web'
        ? ({
            pointerEvents: 'none',
            boxShadow: '0 10px 18px rgba(15,23,42,0.18)',
            whiteSpace: 'nowrap',
          } as any)
        : null),
    },
    hoverLabelText: {
      fontSize: fs.small - 1,
      lineHeight: (fs.small - 1) * 1.2,
      fontWeight: '600',
      color: colors.textOnDark,
      textAlign: 'center',
    },
    iconBtn: {
      alignItems: 'center',
      justifyContent: 'center',
      width: compactLayout ? compactSp.iconButtonSize : splitLayout ? sp.iconButtonSize - 2 : sp.iconButtonSize,
      height: compactLayout ? compactSp.iconButtonSize : splitLayout ? sp.iconButtonSize - 2 : sp.iconButtonSize,
      borderRadius: DESIGN_TOKENS.radii.md,
      backgroundColor: colors.backgroundSecondary ?? colors.surface,
      borderWidth: 1,
      borderColor: colors.borderLight ?? colors.border,
      ...(Platform.OS === 'web' ? ({ cursor: 'pointer', transition: 'background-color 0.15s ease' } as any) : null),
    },
    actionBtn: {
      alignItems: 'center',
      justifyContent: 'center',
      width: compactLayout ? compactSp.iconButtonSize : splitLayout ? sp.iconButtonSize - 2 : sp.iconButtonSize,
      height: compactLayout ? compactSp.iconButtonSize : splitLayout ? sp.iconButtonSize - 2 : sp.iconButtonSize,
      borderRadius: DESIGN_TOKENS.radii.full,
      backgroundColor: colors.backgroundSecondary ?? colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderLight ?? colors.border,
      ...(Platform.OS === 'web' ? ({ cursor: 'pointer', transition: 'background-color 0.15s ease' } as any) : null),
    },
    actionBtnPressed: {
      opacity: 0.65,
      transform: [{ scale: 0.96 }],
    },
    primaryActionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      width: '100%',
      minHeight: compactLayout ? compactSp.addBtnMinHeight : splitLayout ? 40 : 46,
      paddingVertical: compactLayout ? 6 : 9,
      paddingHorizontal: compactLayout ? sp.btnPadH : splitLayout ? 14 : sp.btnPadH,
      borderRadius: DESIGN_TOKENS.radii.pill,
      backgroundColor: colors.primary,
      borderWidth: 0,
      borderColor: 'transparent',
      ...(Platform.OS === 'web' ? ({ cursor: 'pointer', transition: 'opacity 0.15s ease, transform 0.15s ease' } as any) : null),
    },
    primaryActionBtnPressed: {
      opacity: 0.72,
    },
    primaryActionText: {
      fontSize: compactLayout ? fs.small : fs.small + 1,
      fontWeight: '700',
      color: colors.textOnPrimary ?? colors.textOnDark,
      letterSpacing: 0,
    },
    routeBtn: {
      backgroundColor: colors.primarySoft ?? colors.backgroundSecondary,
      borderColor: colors.primarySoft ?? colors.borderLight ?? colors.border,
    },
    addBtn: {
      alignItems: 'center',
      justifyContent: 'center',
      width: compactLayout ? compactSp.iconButtonSize : splitLayout ? sp.iconButtonSize - 2 : sp.iconButtonSize,
      height: compactLayout ? compactSp.iconButtonSize : splitLayout ? sp.iconButtonSize - 2 : sp.iconButtonSize,
      borderRadius: DESIGN_TOKENS.radii.full,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.primarySoft ?? colors.borderLight ?? colors.border,
      backgroundColor: colors.primarySoft ?? colors.backgroundSecondary,
      ...(Platform.OS === 'web' ? ({ cursor: 'pointer', transition: 'opacity 0.15s ease' } as any) : null),
    },
    addBtnDisabled: {
      borderColor: colors.borderLight ?? colors.border,
      opacity: 0.4,
    },
    addBtnPressed: {
      opacity: 0.6,
    },
    addBtnText: {
      fontSize: compactLayout ? fs.small - 1 : bp === 'narrow' ? 13 : fs.small,
      fontWeight: '500',
      color: colors.text,
    },
    labeledActionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      height: 38,
      paddingHorizontal: 12,
      borderRadius: DESIGN_TOKENS.radii.md,
      backgroundColor: colors.backgroundSecondary ?? colors.surface,
      borderWidth: 1,
      borderColor: colors.borderLight ?? colors.border,
      ...(Platform.OS === 'web' ? ({ cursor: 'pointer', transition: 'background-color 0.15s ease' } as any) : null),
    },
    labeledActionText: {
      fontSize: fs.small,
      fontWeight: '500',
      color: colors.textMuted,
    },
    saveFullBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      width: '100%',
      minHeight: 40,
      paddingVertical: 6,
      paddingHorizontal: 14,
      borderRadius: DESIGN_TOKENS.radii.lg,
      borderWidth: 1,
      borderColor: colors.primarySoft ?? colors.borderLight ?? colors.border,
      backgroundColor: colors.primarySoft ?? colors.backgroundSecondary,
      ...(Platform.OS === 'web' ? ({ cursor: 'pointer', transition: 'opacity 0.15s ease' } as any) : null),
    },
    saveFullBtnText: {
      fontSize: fs.small + 1,
      fontWeight: '600',
      color: colors.primary,
    },
  });
};
