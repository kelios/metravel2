import { Platform } from 'react-native';

import { asBottomDimension } from '@/components/layout/bottomChromeInset';

/** Shared by the eager slot and the lazy sidebar. */
export function getQuestCatalogSidebarWidth(screenWidth: number) {
    return screenWidth >= 768 && screenWidth < 1024 ? 260 : 340;
}

/** The eager map fallback and the loaded map must occupy the same height. */
export function getQuestCatalogMapHeight(screenWidth: number, screenHeight?: number) {
    return asBottomDimension(screenWidth < 768
        ? (Platform.OS === 'web'
            ? 'calc(100dvh - 148px - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px))'
            : Math.max(420, (screenHeight || 700) - 172))
        : Math.min(620, screenHeight ? screenHeight * 0.6 : 620));
}
