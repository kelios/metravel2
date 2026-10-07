import { Platform, StyleSheet } from 'react-native';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import type { ThemedColors } from '@/hooks/useTheme';
import { webViewStyle } from '@/utils/webProps';

export const TRAVEL_TML_ROUND_HEIGHT = 250;
export const TRAVEL_TML_ROUND_IMAGE_HEIGHT = 170;

export const createTravelTmlRoundStyles = (colors: ThemedColors) => StyleSheet.create({
    container: {
        width: '100%',
        height: TRAVEL_TML_ROUND_HEIGHT,
        padding: 0,
        overflow: 'hidden',
    },

    // ✅ УЛУЧШЕНИЕ: Современная матовая карточка без границ, только тени
    card: {
        borderRadius: DESIGN_TOKENS.radii.md,
        backgroundColor: colors.surface,
        width: '100%',
        borderWidth: 1,
        borderColor: colors.borderLight,
        overflow: 'hidden',
        ...Platform.select({
            web: webViewStyle({
                alignItems: "center",
                height: '100%',
                cursor: "pointer",
                transition: 'border-color 0.2s ease',
            }),
        }),
    },
    skeletonCard: {
        height: '100%',
    },
});
