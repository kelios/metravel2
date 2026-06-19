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
  bottomCardLayout = false,
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
      position: 'relative',
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
      // Bottom card: photo runs edge-to-edge and flush to the top so it reads as the
      // dominant hero; the text/meta block keeps its horizontal padding below.
      paddingTop: splitLayout || bottomCardLayout ? 0 : topPadding,
      paddingHorizontal: splitLayout || bottomCardLayout ? 0 : horizontalPadding,
    },
    relatedTravelActions: {
      position: 'absolute',
      top: compactLayout ? 10 : 12,
      left: compactLayout ? 10 : 12,
      zIndex: 6,
    },
    relatedTravelScrim: {
      // Scoped to the ♥/＋ button corner only (not the whole hero): a small, soft
      // gradient just for icon contrast so the dominant photo stays unobscured.
      position: 'absolute',
      top: 0,
      left: 0,
      width: 60,
      height: 100,
      zIndex: 5,
      borderBottomRightRadius: 24,
      backgroundColor: 'rgba(15,23,42,0.18)',
      ...(Platform.OS === 'web'
        ? ({
            background:
              'linear-gradient(135deg, rgba(15,23,42,0.32) 0%, rgba(15,23,42,0.12) 55%, rgba(15,23,42,0) 100%)',
          } as any)
        : null),
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
      // Bottom card: photo is edge-to-edge (topSection drops its padding), so the
      // caption block restores its own horizontal padding here.
      paddingHorizontal: splitLayout ? horizontalPadding + 2 : bottomCardLayout ? horizontalPadding : 2,
      // Bottom card: tighten the gap between the (now dominant) photo and the title
      // so the content block reads as a compact caption under the hero.
      paddingTop: splitLayout ? topPadding + 2 : bottomCardLayout ? 8 : 14,
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
      paddingTop: splitLayout ? 10 : bottomCardLayout ? 8 : 14,
      paddingBottom: bottomCardLayout ? Math.max(8, bottomPadding - 2) : bottomPadding,
    },
    footerStack: {
      gap: bottomCardLayout ? 8 : splitLayout ? 10 : compactLayout ? compactSp.sectionGap : sp.sectionGap,
    },
    infoSection: {
      gap: bottomCardLayout ? 5 : compactLayout ? 6 : splitLayout ? 6 : bp === 'narrow' ? 8 : 10,
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
      // Bottom card: badge hugs its content and stays inside the full-width sheet.
      // (The trailing-glyph clip itself is fixed at the call site — see index.tsx.)
      ...(bottomCardLayout ? ({ maxWidth: '100%' } as const) : null),
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
      color: colors.primaryDark ?? colors.primary,
      fontSize: compactLayout ? fs.small : fs.small + 1,
      fontWeight: '800',
      textDecorationLine: 'none',
      paddingHorizontal: compactLayout ? 10 : 12,
      paddingVertical: compactLayout ? 6 : 7,
      borderRadius: DESIGN_TOKENS.radii.pill,
      backgroundColor: colors.primarySoft ?? colors.backgroundSecondary,
      borderWidth: 1,
      borderColor: colors.primaryAlpha30 ?? colors.borderLight,
      ...(Platform.OS === 'web'
        ? ({
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          minHeight: compactLayout ? 30 : 34,
          lineHeight: 1.2,
          transition: 'background-color 0.15s ease, border-color 0.15s ease, transform 0.15s ease',
        } as any)
        : null),
    },
    categoryText: {
      fontSize: compactLayout ? fs.small - 1 : fs.small,
      color: colors.textMuted,
      // Bottom card: keep the label from being shrunk by the row. The trailing-glyph
      // clip («Замок» → «Замо») is an RN-Android text-width-rounding bug worked around
      // at the call site (trailing hair space widens the measured line so «к» paints).
      ...(bottomCardLayout ? { flexShrink: 0 } : null),
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
      minHeight: bottomCardLayout ? 28 : compactLayout ? compactSp.coordMinHeight : splitLayout ? 32 : 36,
      paddingHorizontal: compactLayout ? 10 : splitLayout ? 10 : 12,
      paddingVertical: bottomCardLayout ? 4 : compactLayout ? 5 : 6,
      borderRadius: DESIGN_TOKENS.radii.pill,
      backgroundColor: colors.backgroundSecondary ?? colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderLight ?? colors.border,
    },
    coordText: {
      // Coordinates are secondary metadata in the bottom card — keep them small and
      // muted so they don't compete with the address line above.
      fontSize: bottomCardLayout ? fs.coord - 1 : compactLayout ? fs.small : splitLayout ? fs.coord - 1 : fs.coord,
      fontWeight: bottomCardLayout ? '400' : '500',
      color: bottomCardLayout ? colors.textMuted : colors.text,
      flex: 1,
      minWidth: 0,
      fontFamily:
        Platform.OS === 'web'
          ? ('ui-monospace, SFMono-Regular, Menlo, Consolas, monospace' as any)
          : undefined,
    },
    actionsStack: {
      gap: bottomCardLayout ? 8 : splitLayout ? 8 : 10,
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
      gap: bottomCardLayout ? 3 : 4,
      width: bottomCardLayout ? 58 : compactLayout ? 64 : 68,
      paddingVertical: bottomCardLayout ? 2 : 4,
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
      width: bottomCardLayout ? 38 : compactLayout ? 34 : 38,
      height: bottomCardLayout ? 38 : compactLayout ? 34 : 38,
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
      minHeight: bottomCardLayout ? 42 : compactLayout ? compactSp.addBtnMinHeight : splitLayout ? 40 : 46,
      paddingVertical: bottomCardLayout ? 8 : compactLayout ? 6 : 9,
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
