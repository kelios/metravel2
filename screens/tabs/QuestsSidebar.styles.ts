import type { CSSProperties } from 'react';
import { StyleSheet, Platform } from 'react-native';

import { asBottomDimension } from '@/components/layout/bottomChromeInset';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import type { ThemedColors } from '@/hooks/useTheme';
import { webTextStyle, webViewStyle } from '@/utils/webProps';

import { getQuestCatalogSidebarWidth } from './QuestsStyleMetrics';

const { spacing, radii, typography, touchTarget } = DESIGN_TOKENS;
const CONTROL_RADIUS = radii.sm;

/** Private to the lazy sidebar; the eager catalog reserves only its slot. */
export function getQuestsSidebarStyles(colors: ThemedColors, screenWidth: number) {
    const isMobileW = screenWidth < 768;
    const SIDEBAR_WIDTH = getQuestCatalogSidebarWidth(screenWidth);
    const headerPadding = isMobileW ? spacing.md : spacing.lg;
    const headerTopPadding = isMobileW ? spacing.lg : spacing.xl;
    const sectionPaddingX = isMobileW ? spacing.sm : spacing.md;
    const cityItemVertical = isMobileW ? spacing.xxs : spacing.xs;
    const cityIconSize = isMobileW ? 28 : 32;

    return StyleSheet.create({
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
                web: webViewStyle({
                    ...({ overflowY: 'auto' } satisfies CSSProperties),
                    // Без явного hidden ось X тоже становится скроллируемой, и
                    // focus-scroll на кнопке действий уводит весь сайдбар вбок,
                    // пряча «Показать списком» за левым краем.
                    overflowX: 'hidden',
                    maxHeight: isMobileW ? '100%' : asBottomDimension('100vh'),
                    position: isMobileW ? 'relative' : 'sticky',
                    top: 0,
                    boxShadow: colors.boxShadows?.card ?? DESIGN_TOKENS.shadows.card,
                    ...({
                        scrollbarWidth: 'thin',
                        scrollbarColor: `${colors.borderLight} transparent`,
                    } satisfies CSSProperties),
                    transition: 'width 0.3s ease',
                    ...({
                        WebkitOverflowScrolling: 'touch',
                        overscrollBehavior: 'contain',
                    } satisfies CSSProperties),
                }),
            }),
        },
        sidebarScroll: {
            flex: 1,
            minHeight: 0,
            ...Platform.select({
                web: webViewStyle({
                    ...({
                        overflowY: 'auto',
                        WebkitOverflowScrolling: 'touch',
                        overscrollBehavior: 'contain',
                    } satisfies CSSProperties),
                    touchAction: 'pan-y',
                }),
            }),
        },
        sidebarHeader: {
            padding: headerPadding,
            paddingTop: headerTopPadding,
            paddingBottom: isMobileW ? spacing.md : spacing.lg,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: colors.borderLight,
            ...Platform.select({
                web: webViewStyle({
                    backgroundColor: colors.surface,
                    // Чип-подсказка кнопки действия выходит за пределы шапки —
                    // без своего слоя её перекрыл бы список городов.
                    position: 'relative',
                    zIndex: 5,
                }),
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
            width: 44,
            height: 44,
            borderRadius: CONTROL_RADIUS,
            backgroundColor: colors.backgroundSecondary,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1,
            borderColor: colors.borderLight,
            ...Platform.select({
                web: webViewStyle({ cursor: 'pointer', transition: 'background-color 0.2s ease' }),
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
            flexWrap: 'wrap',
            gap: spacing.sm,
            marginTop: isMobileW ? spacing.sm : spacing.md,
        },
        sidebarActionIconBtn: {
            width: DESIGN_TOKENS.touchTarget.minWidth,
            height: DESIGN_TOKENS.touchTarget.minHeight,
            borderRadius: CONTROL_RADIUS,
            backgroundColor: colors.backgroundSecondary,
            borderWidth: 1,
            borderColor: colors.borderLight,
            alignItems: 'center',
            justifyContent: 'center',
            ...Platform.select({
                web: webViewStyle({
                    cursor: 'pointer',
                    transition: 'background-color 0.2s ease, border-color 0.2s ease, opacity 0.2s ease',
                }),
            }),
        },
        sidebarActionIconBtnActive: {
            backgroundColor: colors.brand,
            borderColor: colors.brand,
        },
        sidebarActionIconBtnDisabled: {
            opacity: 0.5,
        },
        // Desktop-web пилюля действия: всегда квадратная icon-only, подпись при
        // наведении показывается ОТДЕЛЬНЫМ абсолютным чипом под кнопкой.
        // Инлайновое раскрытие подписи меняло ширину пилюли, последняя кнопка
        // ряда переносилась на вторую строку, уезжала из-под курсора → hover
        // сбрасывался и кнопка «дёргалась» в бесконечном цикле.
        sidebarActionPill: {
            position: 'relative',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            height: DESIGN_TOKENS.touchTarget.minHeight,
            minWidth: DESIGN_TOKENS.touchTarget.minHeight,
            paddingHorizontal: spacing.sm,
            borderRadius: CONTROL_RADIUS,
            backgroundColor: colors.backgroundSecondary,
            borderWidth: 1,
            borderColor: colors.borderLight,
            ...Platform.select({
                web: webViewStyle({
                    cursor: 'pointer',
                    transition: 'background-color 0.2s ease, border-color 0.2s ease, opacity 0.2s ease',
                }),
            }),
        },
        sidebarActionPillActive: {
            backgroundColor: colors.brand,
            borderColor: colors.brand,
        },
        // Подсказка-чип под кнопкой: абсолютная и pointerEvents=none, поэтому
        // никак не влияет на раскладку ряда действий и не ловит курсор.
        sidebarActionPillLabelWrap: {
            position: 'absolute',
            top: '100%',
            marginTop: spacing.xxs,
            paddingHorizontal: spacing.sm,
            paddingVertical: spacing.xxs,
            borderRadius: CONTROL_RADIUS,
            backgroundColor: colors.backgroundSecondary,
            borderWidth: 1,
            borderColor: colors.borderLight,
            maxWidth: 220,
            overflow: 'hidden',
            ...Platform.select({
                web: webViewStyle({
                    opacity: 0,
                    transform: 'translateY(-4px)',
                    transition: 'opacity 0.18s ease, transform 0.18s ease',
                    zIndex: 30,
                }),
            }),
        },
        // Сторона привязки задаётся отдельными модификаторами (без сброса в
        // 'auto'): у правых кнопок ряда чип прижимается правым краем, иначе он
        // уезжает за границу сайдбара с overflowX: hidden и обрезается.
        sidebarActionPillLabelWrapStart: {
            left: 0,
        },
        sidebarActionPillLabelWrapEnd: {
            right: 0,
        },
        sidebarActionPillLabelWrapOpen: {
            ...Platform.select({
                web: webViewStyle({
                    opacity: 1,
                    transform: 'translateY(0)',
                }),
            }),
        },
        sidebarActionPillLabel: {
            color: colors.text,
            fontWeight: '600',
            fontSize: typography.sizes.sm,
            ...Platform.select({
                web: webTextStyle({ whiteSpace: 'nowrap' }),
            }),
        },

        /* ---- City List: шаг свёрнутой страны не больше шага строк фильтров (#2011) ---- */
        cityListSection: {
            paddingHorizontal: sectionPaddingX,
        },
        // Отделяет список стран от строк фильтров над ним: у строк стран своих
        // вертикальных отступов больше нет.
        countryList: {
            marginTop: spacing.sm,
        },
        countryLabel: {
            color: colors.text,
            fontSize: typography.sizes.sm,
            fontWeight: '700',
            letterSpacing: -0.2,
        },
        // Свёрнутая страна с выбором внутри: иначе после сворачивания не видно, откуда фильтр.
        // Оранжевый ТЕКСТ на светлой поверхности — `brandText`, а не `brandDark` (≈3.2:1 на
        // белом): контракт `docs/DESIGN_SYSTEM.md`, «Orange accents».
        countryLabelActive: {
            color: colors.brandText,
        },
        countryActiveDot: {
            width: spacing.xs,
            height: spacing.xs,
            borderRadius: radii.full,
            backgroundColor: colors.brand,
        },
        countryHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            minHeight: touchTarget.minHeight,
            marginBottom: spacing.xxs,
            paddingHorizontal: spacing.xs,
            paddingVertical: spacing.xxs,
            borderRadius: CONTROL_RADIUS,
            borderWidth: 1,
            borderColor: 'transparent',
            ...Platform.select({
                web: webViewStyle({
                    transition: 'background-color 0.2s ease, border-color 0.2s ease',
                }),
            }),
        },
        // Вся строка страны — одна зона нажатия (#2011); `flexShrink` ужимает длинное имя,
        // чтобы оно не выдавливало счётчик за границу сайдбара.
        countryLabelPress: {
            flexGrow: 1,
            flexShrink: 1,
            justifyContent: 'center',
        },
        countryHeaderActions: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: spacing.xs,
        },
        countryCount: {
            color: colors.textMuted,
            fontSize: typography.sizes.xs,
            fontWeight: '700',
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
                web: webViewStyle({
                    cursor: 'pointer',
                    transition: 'background-color 0.2s ease, border-color 0.2s ease',
                }),
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
                web: webViewStyle({ transition: 'all 0.2s ease' }),
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
    });
}

export type QuestsSidebarStyles = ReturnType<typeof getQuestsSidebarStyles>;
