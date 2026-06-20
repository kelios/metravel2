// src/screens/tabs/QuestsScreen.styles.ts
import { StyleSheet, Platform } from 'react-native';

import { DESIGN_TOKENS } from '@/constants/designSystem';
import type { ThemedColors } from '@/hooks/useTheme';

const { spacing, radii, typography } = DESIGN_TOKENS;
const PANEL_RADIUS = radii.lg;
const CONTROL_RADIUS = radii.sm;

// ───────────── Styles (Two-column layout) ─────────────

export function getStyles(colors: ThemedColors, screenWidth: number, screenHeight?: number) {
    const isMobileW = screenWidth < 768;
    const isSmallPhone = screenWidth < 360;
    const isTablet = screenWidth >= 768 && screenWidth < 1024;
    const SIDEBAR_WIDTH = isTablet ? 260 : 340;
    const headerPadding = isMobileW ? spacing.md : spacing.lg;
    const headerTopPadding = isMobileW ? spacing.lg : spacing.xl;
    const sectionPaddingX = isMobileW ? spacing.sm : spacing.md;
    const sectionPaddingY = isMobileW ? spacing.xxs : spacing.xs;
    const countryGapTop = isMobileW ? spacing.xs : spacing.sm;
    const cityItemVertical = isMobileW ? spacing.xxs : spacing.xs;
    const cityIconSize = isMobileW ? 28 : 32;
    const badgeFontSize = isSmallPhone ? 12 : 11;
    const categoryFontSize = isSmallPhone ? 12 : 10;

    return StyleSheet.create({
        /* ---- Root Layout (Two-column, Premium) ---- */
        root: {
            flex: 1,
            // Без minHeight:0 в column-flex (mobile web) дочерний ScrollView
            // получает flex-basis от высоты КОНТЕНТА, а не от вьюпорта, поэтому
            // внутренний скролл-контейнер «думает», что прокручивать нечего
            // (scrollTop застревает на 0), хотя scrollHeight в разы больше.
            minHeight: 0,
            backgroundColor: colors.background,
            flexDirection: isMobileW ? 'column' : 'row',
            // На десктоп-вебе НЕ ставим minHeight:100vh: root живёт во flex-
            // родителе высотой (вьюпорт − navbar), а 100vh перекрывает клип
            // overflow:hidden оболочки приложения, и низ скролл-колонки content
            // (с последним рядом карточек) уходит за границу клипа. flex:1 +
            // minHeight:0 заполняют родителя ровно по высоте → скролл доходит
            // до конца. На мобильном вебе скроллит сама страница (body).
        },

        /* ---- Left Sidebar (Premium, atmospheric) ---- */
        sidebar: {
            flexGrow: isMobileW ? 1 : 0,
            flexBasis: isMobileW ? 'auto' : SIDEBAR_WIDTH,
            width: isMobileW ? '100%' : SIDEBAR_WIDTH,
            flexShrink: 0,
            flexDirection: 'column',
            borderRightWidth: isMobileW ? 0 : StyleSheet.hairlineWidth,
            borderRightColor: colors.borderLight,
            backgroundColor: colors.surface,
            ...Platform.select({
                web: {
                    overflowY: 'auto',
                    maxHeight: isMobileW ? 'auto' : '100vh',
                    position: isMobileW ? 'relative' : 'sticky',
                    top: 0,
                    boxShadow: ((colors.boxShadows as any)?.card ?? DESIGN_TOKENS.shadows.card) as any,
                    scrollbarWidth: 'thin',
                    scrollbarColor: `${colors.borderLight} transparent`,
                    transition: 'width 0.3s ease',
                } as any,
            }),
        },
        sidebarScroll: {
            flex: 1,
            minHeight: 0,
        },
        sidebarHeader: {
            padding: headerPadding,
            paddingTop: headerTopPadding,
            paddingBottom: isMobileW ? spacing.md : spacing.lg,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: colors.borderLight,
            ...Platform.select({
                web: {
                    backgroundColor: colors.surface,
                } as any,
            }),
        },
        sidebarTitleRow: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: spacing.sm,
        },
        sidebarTitle: {
            color: colors.text,
            fontSize: isMobileW ? 20 : 26,
            fontWeight: '800',
            marginBottom: spacing.xxs,
            letterSpacing: -0.6,
            lineHeight: isMobileW ? 26 : 32,
            flexShrink: 1,
        },
        sidebarCloseBtn: {
            width: 36,
            height: 36,
            borderRadius: CONTROL_RADIUS,
            backgroundColor: colors.backgroundSecondary,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1,
            borderColor: colors.borderLight,
            ...Platform.select({
                web: { cursor: 'pointer', transition: 'background-color 0.2s ease' } as any,
            }),
        },
        sidebarSubtitle: {
            color: colors.textMuted,
            fontSize: isMobileW ? typography.sizes.xs : typography.sizes.sm,
            lineHeight: isMobileW ? 18 : 20,
            letterSpacing: -0.1,
            maxWidth: 280,
            fontWeight: '400',
        },
        sidebarActions: {
            flexDirection: 'row',
            gap: spacing.sm,
            marginTop: isMobileW ? spacing.sm : spacing.md,
        },
        actionBtn: {
            flexDirection: 'row',
            gap: spacing.xs,
            backgroundColor: colors.brand,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
            borderRadius: CONTROL_RADIUS,
            alignItems: 'center',
            justifyContent: 'center',
            flex: 1,
            ...Platform.select({
                web: {
                    cursor: 'pointer',
                    transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
                    boxShadow: ((colors.boxShadows as any)?.light ?? DESIGN_TOKENS.shadows.light) as any,
                } as any,
            }),
        },
        actionBtnSecondary: {
            backgroundColor: colors.backgroundSecondary,
            borderWidth: 1,
            borderColor: colors.borderLight,
            ...Platform.select({
                web: { boxShadow: 'none' } as any,
            }),
        },
        actionBtnText: {
            color: colors.textOnPrimary,
            fontWeight: '600',
            fontSize: typography.sizes.sm,
        },
        actionBtnTextSecondary: {
            color: colors.text,
        },

        /* ---- City List (Premium, spacious) ---- */
        cityListSection: {
            paddingHorizontal: sectionPaddingX,
            paddingVertical: sectionPaddingY,
        },
        cityListLabel: {
            color: colors.textMuted,
            fontSize: 9,
            fontWeight: '700',
            textTransform: 'uppercase',
            letterSpacing: 1.0,
            marginBottom: spacing.xs,
            paddingHorizontal: spacing.xs,
            opacity: 0.8,
        },
        countryLabel: {
            color: colors.text,
            fontSize: typography.sizes.sm,
            fontWeight: '700',
            letterSpacing: -0.2,
        },
        countryHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: countryGapTop,
            marginBottom: spacing.xxs,
            paddingHorizontal: spacing.xs,
            paddingVertical: spacing.xxs,
            borderRadius: CONTROL_RADIUS,
            borderWidth: 1,
            borderColor: 'transparent',
            ...Platform.select({
                web: {
                    cursor: 'pointer',
                    transition: 'background-color 0.2s ease, border-color 0.2s ease',
                } as any,
            }),
        },
        countryHeaderActions: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.xs,
        },
        countryCount: {
            color: colors.textMuted,
            fontSize: typography.sizes.xs,
            fontWeight: '700',
        },
        countryToolsSection: {
            paddingHorizontal: sectionPaddingX,
            paddingTop: spacing.xs,
            paddingBottom: spacing.xs,
        },
        collapseAllBtn: {
            flexDirection: 'row',
            alignItems: 'center',
            alignSelf: 'flex-start',
            gap: spacing.xxs,
            backgroundColor: colors.backgroundSecondary,
            paddingHorizontal: spacing.sm,
            paddingVertical: spacing.xs,
            borderRadius: CONTROL_RADIUS,
            borderWidth: 1,
            borderColor: colors.borderLight,
            minHeight: isMobileW ? DESIGN_TOKENS.touchTarget.minHeight : undefined,
            ...Platform.select({
                web: {
                    cursor: 'pointer',
                    transition: 'opacity 0.2s ease',
                } as any,
            }),
        },
        collapseAllBtnText: {
            color: colors.textMuted,
            fontSize: typography.sizes.xs,
            fontWeight: '700',
            letterSpacing: 0.2,
        },
        cityItem: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingVertical: cityItemVertical,
            paddingHorizontal: isMobileW ? spacing.xs : spacing.sm,
            borderRadius: CONTROL_RADIUS,
            borderWidth: 1,
            borderColor: 'transparent',
            minHeight: isMobileW ? DESIGN_TOKENS.touchTarget.minHeight : undefined,
            marginBottom: spacing.xxs,
            ...Platform.select({
                web: {
                    cursor: 'pointer',
                    transition: 'background-color 0.2s ease, border-color 0.2s ease',
                } as any,
            }),
        },
        cityItemActive: {
            backgroundColor: colors.brandSoft,
            borderColor: colors.brandAlpha30,
        },
        cityItemLeft: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.xs,
            flex: 1,
            minWidth: 0,
        },
        cityItemIcon: {
            width: cityIconSize,
            height: cityIconSize,
            borderRadius: CONTROL_RADIUS,
            backgroundColor: colors.backgroundSecondary,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1,
            borderColor: colors.borderLight,
            ...Platform.select({
                web: { transition: 'all 0.2s ease' } as any,
            }),
        },
        cityItemIconActive: {
            backgroundColor: colors.brand,
            borderColor: colors.brandAlpha30,
        },
        cityItemText: {
            color: colors.text,
            fontSize: typography.sizes.sm,
            fontWeight: '500',
            letterSpacing: -0.2,
            flexShrink: 1,
            minWidth: 0,
        },
        cityItemTextActive: {
            color: colors.brandDark,
            fontWeight: '600',
        },
        cityItemCount: {
            backgroundColor: colors.backgroundTertiary,
            paddingHorizontal: spacing.xs,
            paddingVertical: 2,
            borderRadius: radii.full,
            borderWidth: 1,
            borderColor: colors.borderLight,
            minWidth: 24,
            alignItems: 'center',
            marginLeft: spacing.xs,
        },
        cityItemCountActive: {
            backgroundColor: colors.brand,
            borderColor: colors.brandAlpha30,
        },
        cityItemCountText: {
            color: colors.textMuted,
            fontSize: typography.sizes.xs,
            fontWeight: '700',
        },
        cityItemCountTextActive: {
            color: colors.textOnPrimary,
        },

        /* ---- Radius selector (Modern pill chips) ---- */
        radiusSection: {
            flexDirection: 'row',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: spacing.xs,
            paddingHorizontal: sectionPaddingX,
            paddingBottom: spacing.sm,
            paddingTop: spacing.xs,
        },
        radiusLabel: {
            color: colors.textMuted,
            fontSize: typography.sizes.sm,
            fontWeight: '500',
            marginRight: spacing.xs,
        },
        radiusChip: {
            paddingHorizontal: spacing.sm,
            paddingVertical: spacing.xs,
            borderRadius: CONTROL_RADIUS,
            backgroundColor: colors.backgroundSecondary,
            borderWidth: 1,
            borderColor: colors.borderLight,
            minWidth: 48,
            minHeight: isMobileW ? DESIGN_TOKENS.touchTarget.minHeight : 30,
            alignItems: 'center',
            justifyContent: 'center',
            ...Platform.select({
                web: {
                    cursor: 'pointer',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                } as any,
            }),
        },
        radiusChipActive: {
            backgroundColor: colors.brand,
            borderColor: colors.brandAlpha30,
            ...Platform.select({
                web: {
                    boxShadow: ((colors.boxShadows as any)?.light ?? DESIGN_TOKENS.shadows.light) as any,
                    transform: 'scale(1.02)',
                } as any,
            }),
        },
        radiusChipText: {
            color: colors.textMuted,
            fontSize: typography.sizes.xs,
            fontWeight: '600',
        },
        radiusChipTextActive: {
            color: colors.textOnPrimary,
        },

        /* ---- Right Content (Premium, atmospheric) ---- */
        content: {
            flex: 1,
            // minHeight:0 нужен, чтобы flex-ребёнок мог сжаться ниже своей
            // контентной высоты и отдать прокрутку внутреннему overflow:auto.
            minHeight: 0,
            backgroundColor: colors.background,
            ...Platform.select({
                web: ({
                    // Оболочка приложения на вебе — это контейнер фикс. высоты с
                    // overflow:hidden (body НЕ скроллит), поэтому колонка контента
                    // должна прокручиваться сама и на мобильном, и на десктопе.
                    // flexBasis:0 + flex:1 + minHeight:0 (на .content) дают колонке
                    // высоту родителя, а overflowY:auto — внутренний скролл.
                    flexBasis: 0,
                    overflowY: 'auto',
                    overscrollBehavior: 'contain',
                    scrollBehavior: 'smooth',
                } as any),
            }),
        },
        contentHeader: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: spacing.sm,
            paddingHorizontal: headerPadding,
            paddingTop: isMobileW ? spacing.lg : spacing.xl,
            paddingBottom: isMobileW ? spacing.sm : spacing.md,
            borderBottomWidth: 0,
            borderBottomColor: colors.borderLight,
            backgroundColor: colors.background,
            ...Platform.select({
                web: isMobileW
                    ? ({
                          // Шапка липнет к верху скролл-колонки. Живой backdrop-blur
                          // на мобильном убивает GPU — статичный «фрост»
                          // (CLAUDE.md правило #2).
                          position: 'sticky',
                          top: 0,
                          zIndex: 10,
                          backgroundColor: colors.surfaceMuted,
                      } as any)
                    : ({
                          position: 'sticky',
                          top: 0,
                          zIndex: 10,
                          backdropFilter: 'blur(16px)',
                          WebkitBackdropFilter: 'blur(16px)',
                          backgroundColor: colors.surface,
                      } as any),
            }),
        },
        contentTitle: {
            color: colors.text,
            fontSize: isMobileW ? 20 : 28,
            fontWeight: '800',
            letterSpacing: -0.6,
            lineHeight: isMobileW ? 26 : 34,
        },
        contentTitleBlock: {
            flex: 1,
            minWidth: 0,
        },
        contentCount: {
            color: colors.textMuted,
            fontSize: typography.sizes.sm,
            marginTop: 2,
            fontWeight: '500',
        },
        contentBody: {
            padding: isMobileW ? spacing.md : spacing.lg,
            paddingTop: isMobileW ? spacing.sm : spacing.md,
            // Нижний инсет под фиксированный BottomDock (mobile web, ~64px),
            // чтобы последний квест был полностью виден над доком.
            paddingBottom: isMobileW
                ? (Platform.OS === 'web' ? 64 + spacing.xl : spacing.xl)
                : spacing.lg,
        },
        mapSection: {
            width: '100%',
        },
        geoBanner: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.xs,
            marginBottom: spacing.md,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
            borderRadius: radii.lg,
            backgroundColor: colors.warningSoft,
            borderWidth: 1,
            borderColor: colors.warning,
        },
        geoBannerText: {
            flex: 1,
            color: colors.warningDark,
            fontSize: typography.sizes.sm,
            fontWeight: '600',
            lineHeight: 20,
        },
        mapContainer: {
            width: '100%',
            height: Math.min(isMobileW ? 420 : 620, screenHeight ? screenHeight * 0.6 : 620),
            borderRadius: radii.lg,
            overflow: 'hidden',
            borderWidth: 1,
            borderColor: colors.borderLight,
            backgroundColor: colors.backgroundSecondary,
        },
        mapLoading: {
            width: '100%',
            height: Math.min(isMobileW ? 420 : 620, screenHeight ? screenHeight * 0.6 : 620),
            borderRadius: radii.lg,
            borderWidth: 1,
            borderColor: colors.borderLight,
            backgroundColor: colors.surface,
            alignItems: 'center',
            justifyContent: 'center',
        },

        /* ---- Quests Grid (Modern responsive grid) ---- */
        questsGrid: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: spacing.lg,
            ...Platform.select({
                web: {
                    display: 'grid',
                    gridTemplateColumns: isMobileW
                        ? '1fr'
                        : 'repeat(auto-fill, minmax(min(100%, 380px), 1fr))',
                    justifyItems: 'start',
                    gap: spacing.xl,
                } as any,
            }),
        },

        /* ---- Skeleton ---- */
        skeletonGrid: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: spacing.lg,
        },
        skeletonCard: {
            width: '100%',
            maxWidth: 600,
        },

        /* ---- Mobile filter toggle (Modern pill) ---- */
        mobileFilterBtn: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
            backgroundColor: colors.backgroundSecondary,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
            borderRadius: CONTROL_RADIUS,
            borderWidth: 1,
            borderColor: colors.borderLight,
            flexShrink: 0,
            minHeight: DESIGN_TOKENS.touchTarget.minHeight,
            ...Platform.select({
                web: {
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                } as any,
            }),
        },
        mobileFilterBtnText: {
            color: colors.text,
            fontSize: typography.sizes.sm,
            fontWeight: '600',
        },

        /* ---- Mobile sidebar overlay (Smooth backdrop) ---- */
        sidebarOverlay: {
            ...Platform.select({
                web: {
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: colors.overlay,
                    backdropFilter: 'blur(4px)',
                    WebkitBackdropFilter: 'blur(4px)',
                    zIndex: 999,
                    animationKeyframes: 'fadeIn',
                    animationDuration: '0.2s',
                    animationTimingFunction: 'ease',
                } as any,
                // Native: position the backdrop explicitly — web-only styles above
                // left the overlay zero-sized on iOS/Android, so the drawer never
                // appeared visually (F-20).
                default: {
                    ...StyleSheet.absoluteFillObject,
                    backgroundColor: colors.overlay,
                    zIndex: 999,
                    elevation: 8,
                },
            }),
        },
        sidebarMobile: {
            ...Platform.select({
                web: {
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    bottom: 0,
                    width: 340,
                    maxWidth: '88vw',
                    zIndex: 1000,
                    borderTopRightRadius: PANEL_RADIUS,
                    borderBottomRightRadius: PANEL_RADIUS,
                    overflow: 'hidden',
                    boxShadow: ((colors.boxShadows as any)?.modal ?? DESIGN_TOKENS.shadows.modal) as any,
                    animationKeyframes: 'slideInLeft',
                    animationDuration: '0.25s',
                    animationTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
                } as any,
                default: {
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    bottom: 0,
                    width: Math.min(340, Math.round(screenWidth * 0.88)),
                    zIndex: 1000,
                    elevation: 12,
                    borderTopRightRadius: PANEL_RADIUS,
                    borderBottomRightRadius: PANEL_RADIUS,
                    overflow: 'hidden',
                },
            }),
        },

        /* ---- Quest Card Styles (Modern, Atmospheric) ---- */
        questCard: {
            borderRadius: radii.xl,
            overflow: 'hidden',
            backgroundColor: colors.surface,
            position: 'relative',
            ...Platform.select({
                web: {
                    boxShadow: '0 2px 12px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)',
                    transition: 'all 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                    cursor: 'pointer',
                    willChange: 'transform, box-shadow',
                } as any,
            }),
        },
        questCardHover: {
            ...Platform.select({
                web: {
                    transform: 'translateY(-6px)',
                    boxShadow: '0 16px 40px rgba(0,0,0,0.12), 0 8px 20px rgba(255, 146, 43, 0.08)',
                } as any,
            }),
        },
        questCardImage: {
            width: '100%',
            height: isMobileW ? 220 : 260,
            position: 'relative',
            overflow: 'hidden',
        },
        questCardGradient: {
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: '70%',
            ...Platform.select({
                web: {
                    backgroundImage: 'linear-gradient(to top, rgba(15,15,20,0.95) 0%, rgba(15,15,20,0.7) 35%, rgba(15,15,20,0.3) 60%, transparent 100%)',
                } as any,
            }),
        },
        questCardMagicGlow: {
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: -20,
            height: 120,
            ...Platform.select({
                web: {
                    backgroundImage: 'radial-gradient(ellipse at center bottom, rgba(255, 146, 43, 0.12) 0%, transparent 60%)',
                    pointerEvents: 'none',
                } as any,
            }),
        },
        questCardVignette: {
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            ...Platform.select({
                web: {
                    boxShadow: 'inset 0 0 40px rgba(0,0,0,0.15)',
                    pointerEvents: 'none',
                } as any,
            }),
        },
        questCardContent: {
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            padding: spacing.xl,
            paddingBottom: spacing.xl + spacing.xs,
        },
        questCardCategory: {
            color: 'rgba(255, 200, 140, 0.9)',
            fontSize: categoryFontSize,
            fontWeight: '600',
            textTransform: 'uppercase',
            letterSpacing: 1.5,
            marginBottom: spacing.xs,
            ...Platform.select({
                web: {
                    textShadow: '0 1px 4px rgba(0,0,0,0.5)',
                } as any,
            }),
        },
        questCardTitle: {
            color: colors.textOnDark,
            fontSize: isMobileW ? 18 : 20,
            fontWeight: '700',
            letterSpacing: -0.3,
            lineHeight: isMobileW ? 24 : 28,
            marginBottom: spacing.md,
            ...Platform.select({
                web: {
                    textShadow: '0 2px 8px rgba(0,0,0,0.4)',
                } as any,
            }),
        },
        questCardMeta: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
            flexWrap: 'wrap',
        },
        questCardMetaItem: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            backgroundColor: 'rgba(255,255,255,0.12)',
            paddingHorizontal: spacing.sm,
            paddingVertical: 4,
            borderRadius: radii.full,
            ...Platform.select({
                web: {
                    backdropFilter: 'blur(8px)',
                    WebkitBackdropFilter: 'blur(8px)',
                } as any,
            }),
        },
        questCardMetaText: {
            color: 'rgba(255,255,255,0.95)',
            fontSize: 12,
            fontWeight: '500',
        },
        questCardMetaDivider: {
            width: 3,
            height: 3,
            borderRadius: 1.5,
            backgroundColor: 'rgba(255,255,255,0.35)',
        },
        questCardPioneerRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            marginTop: spacing.xs,
        },
        questCardPioneerText: {
            flexShrink: 1,
            color: 'rgba(255,255,255,0.95)',
            fontSize: 12,
            fontWeight: '600',
        },
        questCardBadge: {
            position: 'absolute',
            top: spacing.sm,
            left: spacing.sm,
            backgroundColor: 'rgba(255, 146, 43, 0.92)',
            paddingHorizontal: spacing.sm,
            paddingVertical: 4,
            borderRadius: radii.full,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            ...Platform.select({
                web: {
                    backdropFilter: 'blur(6px)',
                    boxShadow: '0 2px 8px rgba(255, 146, 43, 0.35)',
                } as any,
            }),
        },
        questCardBadgeText: {
            color: colors.textOnDark,
            fontSize: badgeFontSize,
            fontWeight: '600',
        },
        questCardCompletedBadge: {
            position: 'absolute',
            top: spacing.sm,
            left: spacing.sm,
            backgroundColor: 'rgba(46, 125, 50, 0.92)',
            paddingHorizontal: spacing.sm,
            paddingVertical: 4,
            borderRadius: radii.full,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            zIndex: 5,
            ...Platform.select({
                web: {
                    backdropFilter: 'blur(6px)',
                    boxShadow: '0 2px 8px rgba(46, 125, 50, 0.35)',
                } as any,
            }),
        },
        questCardCompletedText: {
            color: colors.textOnDark,
            fontSize: badgeFontSize,
            fontWeight: '600',
        },
        questCardDifficultyBadge: {
            position: 'absolute',
            top: spacing.sm,
            right: spacing.sm,
            backgroundColor: 'rgba(0,0,0,0.45)',
            paddingHorizontal: spacing.sm,
            paddingVertical: 4,
            borderRadius: radii.full,
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.xxs,
            ...Platform.select({
                web: {
                    backdropFilter: 'blur(6px)',
                } as any,
            }),
        },
        questCardDifficultyText: {
            color: 'rgba(255,255,255,0.88)',
            fontSize: badgeFontSize,
            fontWeight: '500',
        },
        questCardPlayIcon: {
            position: 'absolute',
            top: '42%',
            left: '50%',
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: 'rgba(255, 146, 43, 0.95)',
            alignItems: 'center',
            justifyContent: 'center',
            ...Platform.select({
                web: {
                    transform: 'translate(-50%, -50%) scale(0.85)',
                    boxShadow: '0 8px 24px rgba(255, 146, 43, 0.45), 0 0 0 6px rgba(255, 146, 43, 0.12)',
                    opacity: 0,
                    transition: 'all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                } as any,
                // На native нет hover: центрируем кружок в верхней части обложки
                // (web-only transform translate тут не работает), чтобы он не
                // налезал на заголовок внизу карточки.
                default: {
                    top: '30%',
                    marginLeft: -28,
                    marginTop: -28,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.3,
                    shadowRadius: 8,
                    elevation: 4,
                },
            }),
        },
        questCardPlayIconVisible: {
            ...Platform.select({
                web: {
                    opacity: 1,
                    transform: 'translate(-50%, -50%) scale(1)',
                } as any,
            }),
        },
    });
}
