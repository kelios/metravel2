// components/home/homeHeroStyles/typographyStyles.ts
import { Platform } from 'react-native'
import { DESIGN_TOKENS } from '@/constants/designSystem'

import type { HeroStyleContext } from './context'

export const createTypographyStyles = (ctx: HeroStyleContext) => {
  const {
    colors,
    isMobile,
    isSmallPhone,
    showSideSlider,
    isNarrowDesktopBook,
    useDenseBookNotes,
    desktopBookTitleSize,
    desktopBookTitleLineHeight,
    desktopBookSubtitleSize,
    desktopBookSubtitleLineHeight,
    sansSerif,
    editorialSerif,
    editorialCaps,
    warmBgSoft,
    cardSurface,
    warmBorder,
    warmGold,
    inkStrong,
    inkMuted,
    inkSubtle,
  } = ctx

  return {
    chapterHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: showSideSlider ? 12 : 16,
    },
    chapterLabel: {
      fontSize: 10,
      fontWeight: '500',
      color: inkSubtle,
      textTransform: 'uppercase',
      letterSpacing: 2.2,
      ...Platform.select({ web: { fontFamily: editorialCaps } as any }),
    },
    chapterDivider: {
      height: 1,
      flex: 1,
      maxWidth: 80,
      backgroundColor: warmGold,
      opacity: 0.6,
    },
    heroMetaRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: showSideSlider ? 16 : 8,
      width: '100%',
    },
    heroMetaBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      minHeight: 32,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: DESIGN_TOKENS.radii.pill,
      backgroundColor: cardSurface,
      borderWidth: 1,
      borderColor: warmBorder,
      ...Platform.select({
        web: {
          boxShadow: DESIGN_TOKENS.shadows.light,
        } as any,
      }),
    },
    heroMetaBadgeText: {
      color: inkMuted,
      fontSize: 12,
      lineHeight: 16,
      fontWeight: '500',
      ...Platform.select({ web: { fontFamily: sansSerif } as any }),
    },
    title: {
      fontSize: isSmallPhone ? 28 : isMobile ? 32 : 36,
      fontWeight: '700',
      color: inkStrong,
      letterSpacing: -0.8,
      lineHeight: isSmallPhone ? 34 : isMobile ? 40 : 44,
      textAlign: 'left',
      ...Platform.select({
        web: showSideSlider
          ? ({
              fontFamily: editorialSerif,
              fontSize: desktopBookTitleSize,
              lineHeight: desktopBookTitleLineHeight,
              letterSpacing: '-0.03em',
            } as any)
          : ({ fontFamily: sansSerif } as any),
      }),
    },
    titleAccent: {
      fontSize: isSmallPhone ? 28 : isMobile ? 32 : 36,
      fontWeight: '800',
      // Книжная страница использует отдельный тематический токен, чтобы акцент
      // оставался контрастным и на светлом, и на тёмном варианте подложки.
      // Гейт — showSideSlider, как у serif-ветки title: hasBookLayout ждёт
      // измеренного bookHeight и на первом рендере ещё false.
      color: showSideSlider
        ? DESIGN_TOKENS.colors.bookPageAccent
        : colors.brandText,
      letterSpacing: -0.8,
      lineHeight: isSmallPhone ? 34 : isMobile ? 40 : 44,
      textAlign: 'left',
      ...Platform.select({
        web: showSideSlider
          ? ({
              fontFamily: editorialSerif,
              fontSize: desktopBookTitleSize,
              lineHeight: desktopBookTitleLineHeight,
              letterSpacing: '-0.02em',
            } as any)
          : ({ fontFamily: sansSerif } as any),
      }),
    },
    subtitle: {
      fontSize: isMobile ? 16 : 17,
      fontWeight: '400',
      color: inkMuted,
      lineHeight: isMobile ? 24 : 27,
      textAlign: 'left',
      maxWidth: 520,
      alignSelf: 'flex-start',
      letterSpacing: 0.1,
      marginTop: isMobile ? 12 : 16,
      ...Platform.select({
        web: showSideSlider
          ? ({
              fontFamily: editorialSerif,
              fontSize: desktopBookSubtitleSize,
              lineHeight: desktopBookSubtitleLineHeight,
              maxWidth: '88%',
              letterSpacing: '0.01em',
              marginTop: '3.2%',
            } as any)
          : ({ fontFamily: sansSerif } as any),
      }),
    },
    pageNotesGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      maxWidth: showSideSlider ? '100%' : '88%',
      marginTop: isNarrowDesktopBook ? 18 : 24,
      marginBottom: showSideSlider ? 20 : 0,
      ...Platform.select({
        web: showSideSlider
          ? ({
              transform: 'rotate(-0.18deg)',
            } as any)
          : {},
      }),
    },
    pageNote: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: useDenseBookNotes ? 5 : 8,
      minHeight: useDenseBookNotes ? 28 : 34,
      paddingHorizontal: useDenseBookNotes ? 7 : 10,
      paddingVertical: useDenseBookNotes ? 5 : 7,
      borderRadius: DESIGN_TOKENS.radii.pill,
      backgroundColor: DESIGN_TOKENS.colors.surfaceAlpha40,
      borderWidth: 1,
      borderColor: warmBorder,
      ...Platform.select({
        web: {
          cursor: 'pointer',
          transition:
            'background-color 0.18s ease, border-color 0.18s ease, transform 0.18s ease',
          boxShadow: '0 1px 0 rgba(128,96,58,0.04)',
        } as any,
      }),
    },
    pageNoteHover: {
      backgroundColor: warmBgSoft,
      borderColor: DESIGN_TOKENS.colors.brandAlpha40,
      ...Platform.select({
        web: {
          transform: 'translateY(-1px)',
        } as any,
      }),
    },
    pageNoteActive: {
      backgroundColor: DESIGN_TOKENS.colors.brand,
      borderColor: DESIGN_TOKENS.colors.brand,
      ...Platform.select({
        web: {
          boxShadow: `0 6px 16px ${DESIGN_TOKENS.colors.brandAlpha30}`,
        } as any,
      }),
    },
    pageNoteIcon: {
      width: useDenseBookNotes ? 18 : 22,
      height: useDenseBookNotes ? 18 : 22,
      borderRadius: useDenseBookNotes ? 9 : 11,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: DESIGN_TOKENS.colors.brandAlpha30,
    },
    pageNoteIconActive: {
      backgroundColor: DESIGN_TOKENS.colors.overlayLight,
    },
    pageNoteTextWrap: {
      gap: 0,
    },
    pageNoteText: {
      color: inkStrong,
      fontSize: useDenseBookNotes ? 10 : 12,
      lineHeight: useDenseBookNotes ? 12 : 15,
      fontWeight: '600',
      ...Platform.select({ web: { fontFamily: sansSerif } as any }),
    },
    pageNoteTextActive: {
      color: DESIGN_TOKENS.colors.textOnPrimary,
    },
    pageNoteMeta: {
      color: inkSubtle,
      fontSize: useDenseBookNotes ? 8 : 10,
      lineHeight: useDenseBookNotes ? 9 : 12,
      fontWeight: '500',
      ...Platform.select({ web: { fontFamily: sansSerif } as any }),
    },
    pageNoteMetaActive: {
      color: DESIGN_TOKENS.colors.textOnPrimary,
      opacity: 0.86,
    },
    sectionLabelRow: {
      width: '100%',
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      gap: 12,
      marginTop: showSideSlider ? 8 : 0,
      marginBottom: 10,
    },
    sectionLabel: {
      color: inkStrong,
      fontSize: 13,
      lineHeight: 18,
      fontWeight: '600',
      letterSpacing: 0.2,
      ...Platform.select({ web: { fontFamily: sansSerif } as any }),
    },
    sectionLabelHint: {
      color: inkSubtle,
      fontSize: 11,
      lineHeight: 15,
      fontWeight: '500',
      ...Platform.select({ web: { fontFamily: sansSerif } as any }),
    },
  } as const
}
