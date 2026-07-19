import { StyleSheet, Platform } from 'react-native';
import { DESIGN_TOKENS } from '@/constants/designSystem';

export const styles = StyleSheet.create({
    mobileContainer: {
        flex: 1,
    },
    hydrationFallback: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    desktopContainer: {
        flex: 1,
        ...(Platform.OS === 'web'
            ? { minHeight: '70vh' as any, maxWidth: 1000, width: '100%', alignSelf: 'center' as any, paddingVertical: DESIGN_TOKENS.spacing.md }
            : {}),
    },
    desktopInner: {
        flex: 1,
        flexDirection: 'row',
        borderWidth: 1,
        borderRadius: DESIGN_TOKENS.radii.lg,
        overflow: 'hidden',
    },
    sidebar: {
        width: 320,
        borderRightWidth: 1,
    },
    fullPanel: {
        flex: 1,
    },
    chatArea: {
        flex: 1,
    },
    emptyChat: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: DESIGN_TOKENS.spacing.md,
    },
    emptyChatText: {
        fontSize: DESIGN_TOKENS.typography.sizes.sm,
        textAlign: 'center',
    },
});
