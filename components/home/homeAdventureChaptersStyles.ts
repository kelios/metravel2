import { StyleSheet, Platform } from 'react-native';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import type { useThemedColors } from '@/hooks/useTheme';

type Colors = ReturnType<typeof useThemedColors>;

export const createAdventureChaptersStyles = (colors: Colors, isMobile: boolean, numColumns: number) =>
  StyleSheet.create({
    // ── Section wrapper ──────────────────────────────────────────────────────
    section: {
      width: '100%',
      paddingVertical: isMobile ? 10 : 14,
      backgroundColor: 'transparent',
    },
    sectionFrame: {
      backgroundColor: 'transparent',
    },
    sectionGlow: {
      position: 'absolute',
      top: -60,
      right: -80,
      width: 240,
      height: 160,
      borderRadius: DESIGN_TOKENS.radii.full,
      backgroundColor: colors.primarySoft,
      opacity: 0.45,
      ...Platform.select({ web: { filter: 'blur(44px)' } }),
    },
    sectionAccent: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 0,
      height: 3,
      backgroundColor: colors.primaryAlpha30,
      borderTopLeftRadius: DESIGN_TOKENS.radii.xl,
      borderTopRightRadius: DESIGN_TOKENS.radii.xl,
    },

    // ── Section header ────────────────────────────────────────────────────────
    header: {
      alignItems: 'center',
      paddingTop: isMobile ? 40 : 64,
      paddingBottom: isMobile ? 28 : 48,
      gap: isMobile ? 10 : 14,
    },
    headerLeft: {
      alignItems: 'center',
      gap: isMobile ? 10 : 14,
    },
    heroTitle: {
      fontSize: isMobile ? 28 : 48,
      fontWeight: '800',
      color: colors.text,
      textAlign: 'center',
      letterSpacing: -1.2,
      lineHeight: isMobile ? 34 : 56,
    },
    heroTitleAccent: {
      fontSize: isMobile ? 28 : 48,
      fontWeight: '800',
      color: colors.brand,
      textAlign: 'center',
      letterSpacing: -1.2,
      lineHeight: isMobile ? 34 : 56,
    },
    heroSubtitle: {
      fontSize: isMobile ? 15 : 17,
      fontWeight: '400',
      color: colors.textMuted,
      textAlign: 'center',
      lineHeight: isMobile ? 22 : 26,
      maxWidth: 540,
      alignSelf: 'center',
    },

    // Small label pill
    labelPill: {
      alignSelf: 'center',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderWidth: 1,
      borderColor: colors.primaryAlpha30,
      borderRadius: DESIGN_TOKENS.radii.pill,
      backgroundColor: colors.primarySoft,
      paddingHorizontal: 13,
      paddingVertical: 5,
      ...Platform.select({ web: { boxShadow: `0 1px 5px ${colors.primary}12` } }),
    },
    labelPillText: {
      color: colors.primaryText,
      fontSize: 10,
      lineHeight: 14,
      fontWeight: '700',
      letterSpacing: 0.9,
      textTransform: 'uppercase',
    },

    // Main title
    title: {
      fontSize: isMobile ? 28 : 40,
      fontWeight: '800',
      color: colors.text,
      lineHeight: isMobile ? 34 : 50,
      letterSpacing: isMobile ? -0.7 : -1.1,
      textAlign: 'center',
      maxWidth: 820,
    },

    // Subtitle
    subtitle: {
      fontSize: isMobile ? 14 : 16,
      color: colors.textMuted,
      lineHeight: isMobile ? 21 : 24,
      maxWidth: 680,
      textAlign: 'center',
    },

    // "View all" button
    viewAllButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      paddingHorizontal: isMobile ? 18 : 24,
      paddingVertical: isMobile ? 11 : 14,
      borderRadius: DESIGN_TOKENS.radii.pill,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      alignSelf: 'center',
      flexShrink: 0,
      ...Platform.select({
        web: {
          cursor: 'pointer',
          transition: 'background-color 0.18s ease, border-color 0.18s ease, transform 0.18s ease, box-shadow 0.18s ease',
          boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
          whiteSpace: 'nowrap',
        } as any,
      }),
    },
    viewAllButtonHover: {
      backgroundColor: colors.primarySoft,
      borderColor: colors.primaryAlpha40,
      ...Platform.select({
        web: {
          transform: 'translateY(-2px)',
          boxShadow: '0 6px 18px rgba(0,0,0,0.09)',
        } as any,
      }),
    },
    viewAllButtonText: {
      fontSize: isMobile ? 14 : 15,
      fontWeight: '600',
      color: colors.text,
    },

    // ── Cards grid ────────────────────────────────────────────────────────────
    grid: {
      flexDirection: isMobile ? 'column' : 'row',
      flexWrap: 'wrap',
      gap: isMobile ? 14 : 18,
      ...Platform.select({
        web: !isMobile
          ? ({
              alignItems: 'stretch',
            } as any)
          : null,
      }),
    },

    // Each card slot — flex equal columns on desktop
    cardSlot: {
      flexGrow: isMobile ? 1 : 0,
      flexShrink: isMobile ? 1 : 0,
      flexBasis: isMobile ? 'auto' : `${100 / Math.max(1, numColumns)}%`,
      minWidth: isMobile ? '100%' : 260,
      maxWidth: isMobile ? '100%' : `${100 / Math.max(1, numColumns)}%`,
      ...Platform.select({
        web: !isMobile
          ? ({
              alignSelf: 'stretch',
              minWidth: `calc((100% - ${(Math.max(1, numColumns) - 1) * 18}px) / ${Math.max(1, numColumns)})`,
              maxWidth: `calc((100% - ${(Math.max(1, numColumns) - 1) * 18}px) / ${Math.max(1, numColumns)})`,
              flexBasis: `calc((100% - ${(Math.max(1, numColumns) - 1) * 18}px) / ${Math.max(1, numColumns)})`,
            } as any)
          : ({ alignSelf: 'stretch' } as any),
      }),
    },
    cardSlotPlaceholder: {
      opacity: 0,
      ...Platform.select({ web: { visibility: 'hidden', pointerEvents: 'none' } as any }),
    },

    // ── Chapter card ──────────────────────────────────────────────────────────
    card: {
      borderRadius: DESIGN_TOKENS.radii.xl,
      overflow: 'hidden',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderLight,
      ...Platform.select({
        web: {
          boxShadow: '0 4px 22px rgba(0,0,0,0.07), 0 1px 4px rgba(0,0,0,0.035)',
          transition: 'transform 0.3s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.3s ease, border-color 0.18s ease',
          cursor: 'pointer',
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
        } as any,
        default: {
          shadowColor: DESIGN_TOKENS.colors.text,
          shadowOffset: { width: 0, height: 3 },
          shadowOpacity: 0.08,
          shadowRadius: 10,
          elevation: 3,
        },
      }),
    },
    cardHovered: {
      borderColor: colors.primaryAlpha30,
      ...Platform.select({
        web: {
          transform: 'translateY(-5px) scale(1.010)',
          boxShadow: '0 18px 44px rgba(0,0,0,0.12), 0 4px 12px rgba(0,0,0,0.06)',
        } as any,
      }),
    },
    cardFocused: {
      ...Platform.select({
        web: {
          borderColor: colors.primary,
          boxShadow: `0 0 0 3px ${colors.primaryAlpha30}, 0 8px 22px rgba(0,0,0,0.09)`,
        } as any,
      }),
    },

    // ── Cover photo area ──────────────────────────────────────────────────────
    coverContainer: {
      width: '100%',
      height: isMobile ? 260 : 320,
      position: 'relative',
      backgroundColor: colors.backgroundSecondary,
      overflow: 'hidden',
    },
    coverImage: {
      ...StyleSheet.absoluteFillObject,
    },

    // Gradient overlay for text legibility
    coverGradient: {
      ...StyleSheet.absoluteFillObject,
      ...Platform.select({
        web: {
          backgroundImage:
            'linear-gradient(180deg, rgba(0,0,0,0) 24%, rgba(0,0,0,0.22) 54%, rgba(0,0,0,0.70) 100%)',
          pointerEvents: 'none',
        } as any,
      }),
    },
    coverGradientNative: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.44)',
    },

    // Chapter label — top-left corner
    chapterLabel: {
      position: 'absolute',
      top: 14,
      left: 14,
      zIndex: 10,
      paddingHorizontal: 11,
      paddingVertical: 5,
      borderRadius: DESIGN_TOKENS.radii.sm,
      backgroundColor: 'rgba(255,255,255,0.15)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.25)',
      ...Platform.select({
        web: {
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          transition: 'background-color 0.2s ease, transform 0.25s cubic-bezier(0.34,1.56,0.64,1)',
        } as any,
      }),
    },
    chapterLabelHovered: {
      ...Platform.select({
        web: {
          backgroundColor: 'rgba(255,255,255,0.24)',
          transform: 'scale(1.03)',
        } as any,
      }),
    },
    chapterLabelText: {
      fontSize: 10,
      fontWeight: '700',
      color: 'rgba(255,255,255,0.90)',
      letterSpacing: 1.1,
      textTransform: 'uppercase',
      ...Platform.select({
        web: { textShadow: '0 1px 2px rgba(0,0,0,0.28)' } as any,
      }),
    },

    // Favorite button — top-right corner
    favoriteSlot: {
      position: 'absolute',
      top: 12,
      right: 12,
      zIndex: 10,
    },

    // Title overlay — bottom of cover
    titleOverlay: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      paddingHorizontal: 18,
      paddingTop: 32,
      paddingBottom: 18,
      zIndex: 5,
    },
    titleOverlayText: {
      fontSize: isMobile ? 16 : 18,
      fontWeight: '700',
      color: colors.textOnDark,
      lineHeight: isMobile ? 22 : 25,
      letterSpacing: -0.25,
      ...Platform.select({
        web: { textShadow: '0 2px 8px rgba(0,0,0,0.42)' } as any,
        ios: {
          textShadowColor: 'rgba(0,0,0,0.42)',
          textShadowOffset: { width: 0, height: 2 },
          textShadowRadius: 8,
        },
        android: {
          textShadowColor: 'rgba(0,0,0,0.42)',
          textShadowOffset: { width: 0, height: 2 },
          textShadowRadius: 8,
        },
      }),
    },

    // ── Card content area ─────────────────────────────────────────────────────
    cardContent: {
      paddingHorizontal: 18,
      paddingTop: 14,
      paddingBottom: 18,
      gap: 10,
      backgroundColor: colors.surface,
      ...Platform.select({
        web: {
          backgroundImage: `linear-gradient(180deg, ${colors.surface} 0%, ${colors.backgroundSecondary} 100%)`,
          backgroundRepeat: 'no-repeat',
        } as any,
      }),
    },

    // Metadata row: location · country · views · rating
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 5,
      minHeight: 20,
    },
    metaItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      flexShrink: 1,
    },
    metaText: {
      fontSize: 12,
      fontWeight: '400',
      color: colors.textMuted,
      lineHeight: 17,
    },
    metaDot: {
      width: 2,
      height: 2,
      borderRadius: 999,
      backgroundColor: colors.borderStrong,
      marginHorizontal: 2,
      opacity: 0.6,
    },
    metaRating: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      backgroundColor: colors.warningSoft ?? colors.primarySoft,
      borderRadius: DESIGN_TOKENS.radii.sm,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    metaRatingStar: {
      fontSize: 10,
      color: colors.warning,
    },
    metaRatingText: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.text,
    },
    metaPopular: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      backgroundColor: colors.primarySoft,
      borderRadius: DESIGN_TOKENS.radii.sm,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    metaPopularText: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.primaryText,
    },

    // Subtle divider inside card content
    cardDivider: {
      height: 1,
      backgroundColor: colors.borderLight,
      marginVertical: 2,
      opacity: 0.7,
    },

    // Shimmer
    shimmerOverlay: {
      ...StyleSheet.absoluteFillObject,
    },

    // ── Empty state ───────────────────────────────────────────────────────────
    emptyState: {
      alignItems: 'center',
      paddingVertical: isMobile ? 44 : 68,
      gap: 14,
      borderRadius: DESIGN_TOKENS.radii.xl,
      borderWidth: 1,
      borderColor: colors.borderLight,
      backgroundColor: colors.surface,
      ...Platform.select({
        web: { boxShadow: '0 2px 12px rgba(0,0,0,0.04)' } as any,
      }),
    },
    emptyIcon: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: colors.primarySoft,
      borderWidth: 1,
      borderColor: colors.primaryAlpha30,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyTitle: {
      fontSize: isMobile ? 16 : 18,
      fontWeight: '700',
      color: colors.text,
      textAlign: 'center',
      letterSpacing: -0.1,
    },
    emptySubtitle: {
      fontSize: 14,
      color: colors.textMuted,
      textAlign: 'center',
      lineHeight: 21,
    },

    // ── Skeleton loader ───────────────────────────────────────────────────────
    skeletonCard: {
      borderRadius: DESIGN_TOKENS.radii.xl,
      overflow: 'hidden',
      backgroundColor: colors.backgroundSecondary,
      borderWidth: 1,
      borderColor: colors.borderLight,
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: isMobile ? 'auto' : `${100 / Math.max(1, numColumns)}%`,
      minWidth: isMobile ? '100%' : 260,
      maxWidth: isMobile ? '100%' : `${100 / Math.max(1, numColumns)}%`,
      height: isMobile ? 360 : 420,
      ...Platform.select({
        web: !isMobile
          ? ({
              minWidth: `calc((100% - ${(Math.max(1, numColumns) - 1) * 18}px) / ${Math.max(1, numColumns)})`,
              maxWidth: `calc((100% - ${(Math.max(1, numColumns) - 1) * 18}px) / ${Math.max(1, numColumns)})`,
              flexBasis: `calc((100% - ${(Math.max(1, numColumns) - 1) * 18}px) / ${Math.max(1, numColumns)})`,
            } as any)
          : null,
      }),
    },
  });
