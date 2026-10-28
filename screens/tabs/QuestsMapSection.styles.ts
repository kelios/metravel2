import { StyleSheet, Platform } from 'react-native';

import { asBottomDimension } from '@/components/layout/bottomChromeInset';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import type { ThemedColors } from '@/hooks/useTheme';
import { webViewStyle } from '@/utils/webProps';

import { getQuestCatalogMapHeight } from './QuestsStyleMetrics';

const { spacing, radii, typography } = DESIGN_TOKENS;

/** Loaded with the map rather than with the catalog's list view. */
export function getQuestsMapStyles(colors: ThemedColors, screenWidth: number, screenHeight?: number) {
    const isMobileW = screenWidth < 768;

    return StyleSheet.create({
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
            height: getQuestCatalogMapHeight(screenWidth, screenHeight),
            minHeight: isMobileW ? 420 : undefined,
            borderRadius: isMobileW ? 0 : radii.lg,
            overflow: 'hidden',
            borderWidth: isMobileW ? 0 : 1,
            borderColor: colors.borderLight,
            backgroundColor: colors.backgroundSecondary,
            position: 'relative',
        },
        mapSearchAreaBtn: {
            position: 'absolute',
            top: asBottomDimension(Platform.OS === 'web' ? `calc(${spacing.sm}px + env(safe-area-inset-top, 0px))` : spacing.sm),
            alignSelf: 'center',
            zIndex: 20,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: spacing.xs,
            minHeight: DESIGN_TOKENS.touchTarget.minHeight,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
            borderRadius: radii.full,
            backgroundColor: colors.brand,
            ...Platform.select({
                web: webViewStyle({
                    cursor: 'pointer',
                    boxShadow: colors.boxShadows?.modal ?? DESIGN_TOKENS.shadows.modal,
                }),
            }),
        },
        mapSearchAreaBtnText: {
            color: colors.textOnPrimary,
            fontSize: typography.sizes.sm,
            fontWeight: '800',
        },
    });
}
