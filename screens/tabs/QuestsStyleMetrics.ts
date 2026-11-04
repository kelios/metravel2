import { Platform } from 'react-native';

import { asBottomDimension } from '@/components/layout/bottomChromeInset';
import { getCatalogFilterPanelGeometry } from '@/components/layout/catalogFilterPanelGeometry';
import { METRICS } from '@/constants/layout';

/** Shared by the eager slot and the lazy sidebar. */
export function getQuestCatalogSidebarGeometry(screenWidth: number) {
    if (Platform.OS === 'web') {
        const geometry = getCatalogFilterPanelGeometry(screenWidth);
        return { ...geometry, overlay: geometry.width === 0 };
    }

    const { tablet, largeTablet } = METRICS.breakpoints;
    const overlay = screenWidth < tablet;
    return { overlay, width: overlay ? 0 : screenWidth < largeTablet ? 260 : 340, gap: 0 };
}

/** The eager map fallback and the loaded map must occupy the same height. */
export function getQuestCatalogMapHeight(screenWidth: number, screenHeight?: number) {
    return asBottomDimension(screenWidth < 768
        ? (Platform.OS === 'web'
            ? 'calc(100dvh - 148px - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px))'
            : Math.max(420, (screenHeight || 700) - 172))
        : Math.min(620, screenHeight ? screenHeight * 0.6 : 620));
}
