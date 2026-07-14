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
  const bottomSheetHeroBasis = bp === 'narrow' ? '58%' : bp === 'compact' ? '62%' : '66%';
  const bottomSheetHeroMinHeight = bp === 'narrow' ? '46%' : bp === 'compact' ? '50%' : '54%';

  return StyleSheet.create({
    container: {
      width: '100%',
      minWidth: 0,
      alignSelf: 'stretch',
      ...(bottomCardLayout && Platform.OS !== 'web' ? { flexGrow: 1 } : null),
    },
    // Mobile bottom-sheet split (web only): the card fills the parent sheet as a
    // flex column — a FIXED hero on top and a scrollable caption/actions region
    // below. The photo stays pinned; expanding «Ещё» only scrolls the body.
    splitRoot: {
      width: '100%',
      flex: 1,
      minHeight: 0,
      backgroundColor: colors.surface,
      ...(Platform.OS === 'web' ? ({ display: 'flex', flexDirection: 'column' } as any) : null),
    },
    splitHero: {
      width: '100%',
      position: 'relative',
      backgroundColor: colors.backgroundSecondary ?? colors.surface,
      overflow: 'hidden',
      // Photo is pinned and dominant, but narrow mobile needs enough fixed
      // room below it for title, coordinates, and the first action row.
      ...(Platform.OS === 'web'
        ? ({
            flexGrow: 0,
            flexShrink: 0,
            flexBasis: bottomSheetHeroBasis,
            maxHeight: bottomSheetHeroBasis,
            minHeight: bottomSheetHeroMinHeight,
          } as any)
        : null),
    },
    // Desktop Leaflet popup split: unlike the mobile sheet, the popup has NO fixed
    // outer height (content-driven, capped by CSS max-height). So the hero keeps its
    // NATURAL height and never shrinks — only the caption/actions body scrolls.
    popupSplitRoot: {
      width: '100%',
      minHeight: 0,
      backgroundColor: colors.surface,
      ...(Platform.OS === 'web'
        ? ({
            display: 'flex',
            flexDirection: 'column',
            // Fill the (CSS-capped) `.leaflet-popup-content` flex column so the inner
            // body can claim the leftover height and scroll under the fixed hero.
            flexGrow: 1,
            flexShrink: 1,
            flexBasis: 'auto',
            maxHeight: '100%',
          } as any)
        : null),
    },
    popupSplitHero: {
      width: '100%',
      position: 'relative',
      height: heroHeight > 0 ? heroHeight : undefined,
      backgroundColor: colors.backgroundSecondary ?? colors.surface,
      overflow: 'hidden',
      ...(Platform.OS === 'web' ? ({ flexShrink: 0 } as any) : null),
    },
    splitScroll: {
      width: '100%',
      ...(Platform.OS === 'web'
        ? ({
            flexGrow: 1,
            flexShrink: 1,
            flexBasis: 'auto',
            minHeight: 0,
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
            overscrollBehavior: 'contain',
          } as any)
        : null),
    },
    // Desktop Leaflet popup scroll body. The popup `.leaflet-popup-content` has only
    // a `max-height` (no definite height), so a `flex:1` child can't resolve a bounded
    // height to scroll within — it would grow and get clipped. Give the body an explicit
    // max-height of (content cap − fixed hero height) so ONLY this region scrolls while
    // the photo stays pinned. The cap mirrors the CSS in utils/ensureLeafletCss.ts.
    popupSplitScroll: {
      width: '100%',
      ...(Platform.OS === 'web'
        ? ({
            flexShrink: 1,
            minHeight: 0,
            maxHeight: `calc(min(660px, 100dvh - 160px, var(--metravel-popup-max-h, 100dvh)) - ${heroHeight > 0 ? heroHeight : 248}px)`,
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
            overscrollBehavior: 'contain',
          } as any)
        : null),
    },
    splitContentPadding: {
      paddingHorizontal: horizontalPadding,
      paddingTop: 12,
    },
    popupCard: {
      width: '100%',
      backgroundColor: colors.surface,
      // Native bottom card: the surrounding sheet panel owns the rounded top corners +
      // shadow, so the inner popup card is flat (no radius / no shadow) to avoid a
      // double-card look. Web (desktop Leaflet popup) keeps its own rounded shadowed box.
      borderRadius: bottomCardLayout && Platform.OS !== 'web'
        ? 0
        : compactLayout ? compactSp.radius + 4 : sp.radius + 4,
      position: 'relative',
      overflow: 'hidden',
      ...(bottomCardLayout && Platform.OS !== 'web' ? { flexGrow: 1 } : null),
      ...(Platform.OS === 'web'
        ? ({
            boxShadow: '0 22px 52px rgba(15,23,42,0.22), 0 8px 18px rgba(15,23,42,0.12)',
          } as any)
        : bottomCardLayout
          ? null
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
    relatedTravelActionsInline: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: bottomCardLayout ? 6 : 8,
    },
    // ♥ favorite + compact trip-status icon stacked on the hero photo, top-LEFT
    // (native bottom card only), away from ✕ (top-right) and ⤢ expand (bottom-right).
    heroFavoriteOverlay: {
      position: 'absolute',
      top: 10,
      left: 10,
      zIndex: 7,
    },
    closeButton: {
      position: 'absolute',
      top: compactLayout ? 10 : 12,
      right: compactLayout ? 10 : 12,
      width: compactLayout ? 40 : 44,
      height: compactLayout ? 40 : 44,
      borderRadius: DESIGN_TOKENS.radii.full,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderLight ?? colors.border,
      zIndex: 12,
      ...(Platform.OS === 'web'
        ? ({
            cursor: 'pointer',
            boxShadow: '0 10px 22px rgba(15,23,42,0.18)',
            transition: 'opacity 0.15s ease, transform 0.15s ease, background-color 0.15s ease',
          } as any)
        : {
            shadowColor: DESIGN_TOKENS.colors.text,
            shadowOffset: { width: 0, height: 3 },
            shadowOpacity: 0.12,
            shadowRadius: 8,
            elevation: 3,
          }),
    },
    closeButtonPressed: {
      opacity: 0.72,
      transform: [{ scale: 0.94 }],
    },
    relatedTravelInlineSection: {
      width: '100%',
      alignItems: 'center',
      justifyContent: 'center',
      paddingBottom: bottomCardLayout ? 2 : 0,
    },
    actionGroup: {
      gap: bottomCardLayout && Platform.OS !== 'web' ? 10 : 6,
    },
    // Native bottom-card: thin hairline divider between logical blocks (place info /
    // «Статус поездки» / «Действия с точкой») so the content sheet reads as grouped
    // rows like the shared action sheet. Web popup keeps its borderless stacked look.
    blockDivider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.borderLight ?? colors.border,
      marginVertical: 2,
    },
    actionGroupLabel: {
      fontSize: bottomCardLayout && Platform.OS !== 'web' ? 13 : compactLayout ? fs.small - 1 : fs.small,
      lineHeight: (bottomCardLayout && Platform.OS !== 'web' ? 13 : compactLayout ? fs.small - 1 : fs.small) * 1.25,
      fontWeight: '700',
      color: colors.textMuted,
    },
    relatedTravelActionSlot: {
      flexGrow: 0,
      flexShrink: 0,
      minWidth: 0,
      alignItems: 'center',
      justifyContent: 'center',
    },
    relatedTravelScrim: {
      // Scoped to the ♥/＋ button corner only (not the whole hero): a small, soft
      // scrim just for icon contrast so the dominant photo stays unobscured.
      position: 'absolute',
      top: 0,
      left: 0,
      width: 60,
      height: 100,
      zIndex: 5,
      borderBottomRightRadius: 24,
      backgroundColor: 'rgba(15,23,42,0.18)',
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
    // Bottom-sheet split (web): the hero fills its fixed header instead of using
    // the card's own fixed photo height, so it stays pinned and gap-free while the
    // caption/actions scroll beneath it. ImageCardMedia keeps contain+blur.
    imageContainerFill: {
      ...(Platform.OS === 'web'
        ? ({ width: '100%', height: '100%', minHeight: 0, flex: 1 } as any)
        : null),
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
            // Mobile (compact) drops the live backdrop blur — it recomposites the
            // map region on close (jank, CLAUDE.md arch #2). The static dark frost
            // (rgba(15,23,42,0.58)) keeps the icon legible. Desktop keeps blur.
            ...(compactLayout
              ? null
              : { backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }),
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
      paddingBottom: bottomCardLayout && Platform.OS !== 'web' ? 2 : 0,
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
      ...(bottomCardLayout && Platform.OS !== 'web' ? { flexGrow: 1, justifyContent: 'flex-start' } : null),
    },
    footerStack: {
      gap: bottomCardLayout ? 8 : splitLayout ? 10 : compactLayout ? compactSp.sectionGap : sp.sectionGap,
      ...(bottomCardLayout && Platform.OS !== 'web' ? { flexGrow: 1, justifyContent: 'space-between' } : null),
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
    titleRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 6,
    },
    titleTextWithShare: {
      // Title shares its row with the right-aligned «Поделиться» icon; flex so the
      // text wraps/truncates instead of pushing the icon off-screen.
      flex: 1,
      minWidth: 0,
    },
    titleShareBtn: {
      width: 36,
      height: 36,
      borderRadius: DESIGN_TOKENS.radii.full,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.backgroundSecondary ?? colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderLight ?? colors.border,
      flexShrink: 0,
      ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : null),
    },
    titleText: {
      fontSize: bottomCardLayout ? fs.title - 1 : splitLayout ? fs.title + 1 : fs.title,
      fontWeight: '800',
      color: colors.text,
      lineHeight: (bottomCardLayout ? fs.title - 1 : splitLayout ? fs.title + 1 : fs.title) * 1.24,
      letterSpacing: 0,
      ...(Platform.OS === 'web'
        ? ({
            display: '-webkit-box',
            WebkitLineClamp: bottomCardLayout ? 2 : splitLayout ? 2 : bp === 'narrow' ? 3 : 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          } as any)
        : null),
    },
    subtitleText: {
      fontSize: bottomCardLayout ? fs.small - 1 : compactLayout ? fs.small - 1 : splitLayout ? fs.small + 1 : fs.small,
      color: colors.textMuted,
      lineHeight: (bottomCardLayout ? fs.small - 1 : compactLayout ? fs.small - 1 : splitLayout ? fs.small + 1 : fs.small) * 1.35,
      ...(Platform.OS === 'web'
        ? ({
            display: '-webkit-box',
            WebkitLineClamp: bottomCardLayout ? 1 : splitLayout ? 2 : 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
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
    coordCopyButton: {
      width: bottomCardLayout ? 28 : 30,
      height: bottomCardLayout ? 28 : 30,
      borderRadius: DESIGN_TOKENS.radii.full,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderLight ?? colors.border,
      ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : null),
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
    iconActionRow: {
      flexDirection: 'row',
      alignItems: bottomCardLayout ? 'center' : 'flex-start',
      justifyContent: 'space-between',
      gap: bottomCardLayout ? 6 : 4,
      paddingHorizontal: bottomCardLayout ? 0 : 2,
    },
    iconActionBtn: {
      flex: 1,
      flexBasis: 0,
      minWidth: 0,
      alignItems: 'center',
      gap: 6,
      paddingVertical: bottomCardLayout ? 4 : 2,
      ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : null),
    },
    iconActionBubble: {
      width: bottomCardLayout ? 44 : compactLayout ? 44 : 46,
      height: bottomCardLayout ? 44 : compactLayout ? 44 : 46,
      borderRadius: DESIGN_TOKENS.radii.full,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.backgroundSecondary ?? colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderLight ?? colors.border,
      ...(Platform.OS === 'web'
        ? ({ transition: 'background-color 0.15s ease, transform 0.15s ease, border-color 0.15s ease' } as any)
        : null),
    },
    iconActionBubblePrimary: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    iconActionBubbleActive: {
      backgroundColor: colors.primarySoft ?? colors.backgroundSecondary,
      borderColor: colors.primaryAlpha30 ?? colors.primarySoft ?? colors.borderLight,
    },
    iconActionBtnPressed: {
      opacity: 0.7,
      transform: [{ scale: 0.94 }],
    },
    iconActionLabelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 2,
      width: '100%',
      minWidth: 0,
      paddingHorizontal: bottomCardLayout ? 2 : 0,
    },
    iconActionLabel: {
      fontSize: bottomCardLayout ? 12 : compactLayout ? 11 : 12,
      lineHeight: (bottomCardLayout ? 12 : compactLayout ? 11 : 12) * 1.2,
      fontWeight: '600',
      color: colors.text,
      textAlign: 'center',
      maxWidth: '100%',
      flexShrink: 1,
    },
    navGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'flex-start',
      rowGap: 8,
      marginTop: 0,
      paddingTop: bottomCardLayout ? 8 : 6,
    },
    navSection: {
      gap: bottomCardLayout ? 8 : 6,
      paddingTop: 8,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.borderLight ?? colors.border,
    },
    navSectionTitle: {
      fontSize: bottomCardLayout ? fs.small : compactLayout ? fs.small - 1 : fs.small,
      lineHeight: (bottomCardLayout ? fs.small : compactLayout ? fs.small - 1 : fs.small) * 1.25,
      fontWeight: '700',
      color: colors.textMuted,
    },
    navGridItem: {
      width: '25%',
      minWidth: 0,
      alignItems: 'center',
      gap: 6,
      paddingVertical: bottomCardLayout ? 4 : 2,
      ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : null),
    },
    actionSummaryText: {
      fontSize: compactLayout ? fs.small - 1 : fs.small,
      lineHeight: (compactLayout ? fs.small - 1 : fs.small) * 1.35,
      color: colors.textMuted,
      fontWeight: '500',
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
      color: colors.primaryText,
    },
  });
};
