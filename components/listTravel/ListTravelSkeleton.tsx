import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { DESIGN_TOKENS } from '@/constants/designSystem';

const shimmerColor = Platform.select({
    web: 'rgba(226, 232, 240, 0.4)',
    default: 'rgba(226, 232, 240, 0.6)',
});

const blocks = Array.from({ length: 6 });

export default function ListTravelSkeleton() {
    return (
        <View style={styles.wrapper} accessibilityRole="progressbar">
            <View style={styles.filterRow}>
                <View style={[styles.pill, styles.wide]} />
                <View style={styles.pill} />
                <View style={styles.pill} />
            </View>
            {blocks.map((_, index) => (
                <View key={`skeleton-${index}`} style={styles.card}>
                    <View style={styles.imagePlaceholder} />
                    <View style={styles.textBlock}>
                        <View style={[styles.line, styles.linePrimary]} />
                        <View style={[styles.line, styles.lineSecondary]} />
                        <View style={[styles.line, styles.lineShort]} />
                    </View>
                </View>
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    wrapper: {
        flex: 1,
        paddingHorizontal: 16,
        paddingVertical: 12,
        gap: 12,
    },
    filterRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 4,
    },
    pill: {
        height: 32,
        flex: 1,
        borderRadius: 999,
        backgroundColor: shimmerColor,
    },
    wide: {
        flex: 1.6,
    },
    card: {
        borderRadius: DESIGN_TOKENS.radii.lg,
        backgroundColor: DESIGN_TOKENS.colors.surface,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: DESIGN_TOKENS.colors.border,
    },
    imagePlaceholder: {
        height: 180,
        backgroundColor: shimmerColor,
    },
    textBlock: {
        padding: 16,
        gap: 10,
    },
    line: {
        height: 14,
        backgroundColor: shimmerColor,
        borderRadius: 8,
    },
    linePrimary: {
        width: '80%',
        height: 18,
    },
    lineSecondary: {
        width: '60%',
    },
    lineShort: {
        width: '40%',
    },
});

