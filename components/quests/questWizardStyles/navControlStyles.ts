import { Platform, StyleSheet } from 'react-native';
import { type QuestColors, SPACING } from './shared';

export const createNavControlStyles = (colors: QuestColors, isMobile: boolean, _screenW: number) => ({
    navRow: {
        flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap',
    },
    // «Назад»/«Дальше» и круглый переключатель рядом — основная навигация шага,
    // поэтому 44dp по обеим осям (#1274), а не 40/36.
    navButton: {
        backgroundColor: colors.primary, paddingHorizontal: isMobile ? 12 : 16, paddingVertical: 10,
        borderRadius: 999, minHeight: 44, justifyContent: 'center', alignItems: 'center',
        ...Platform.select({ web: { cursor: 'pointer', transition: 'opacity 0.15s ease' } as any }),
    },
    navButtonText: { color: colors.textOnPrimary, fontSize: 13, fontWeight: '700' },
    navToggle: {
        backgroundColor: colors.backgroundSecondary,
        width: 44, height: 44, borderRadius: 999,
        justifyContent: 'center', alignItems: 'center',
        borderWidth: 1, borderColor: colors.borderLight,
        ...Platform.select({ web: { cursor: 'pointer' } as any }),
    },
    navToggleText: { fontSize: 10, color: colors.textMuted },
    coordsButton: {
        backgroundColor: colors.backgroundSecondary,
        paddingHorizontal: 10, paddingVertical: 8,
        // Высота была целиком от padding + текста (30,5dp на mobile web) —
        // объявленного размера нет, и статический гард такое не видит (#1274).
        minHeight: 44,
        justifyContent: 'center',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: colors.borderLight,
        ...Platform.select({ web: { cursor: 'pointer' } as any }),
    },
    coordsButtonText: { color: colors.textMuted, fontSize: 11, fontFamily: Platform.OS === 'web' ? 'monospace' : undefined },
    photoToggle: {
        backgroundColor: colors.primarySoft, paddingHorizontal: 12, paddingVertical: 8,
        borderRadius: 999,
        ...Platform.select({ web: { cursor: 'pointer' } as any }),
    },
    photoToggleText: { color: colors.primaryDark, fontSize: 12, fontWeight: '600' },
    navDropdown: {
        marginTop: 8, backgroundColor: colors.surface, borderRadius: 12,
        borderWidth: 1, borderColor: colors.borderLight, overflow: 'hidden',
        ...Platform.select({ web: { boxShadow: colors.boxShadows.medium } as any }),
    },
    navOption: {
        paddingHorizontal: 16, paddingVertical: 12,
        borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderLight,
        ...Platform.select({ web: { cursor: 'pointer' } as any }),
    },
    navOptionText: { color: colors.text, fontSize: 14 },

    photoHint: { fontSize: 12, color: colors.textMuted, marginBottom: SPACING.xs },
} as const);
