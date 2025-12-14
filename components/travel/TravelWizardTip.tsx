import React, { useMemo, useState } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, useWindowDimensions } from 'react-native';

import { DESIGN_TOKENS } from '@/constants/designSystem';

type TravelWizardTipProps = {
    title?: string;
    body: string;
    defaultExpanded?: boolean;
};

const TravelWizardTip: React.FC<TravelWizardTipProps> = ({
    title = 'Подсказка',
    body,
    defaultExpanded = false,
}) => {
    const { width } = useWindowDimensions();
    const isMobile = width <= DESIGN_TOKENS.breakpoints.mobile;

    const [expanded, setExpanded] = useState(defaultExpanded);

    const isExpanded = useMemo(() => {
        if (!isMobile) return true;
        return expanded;
    }, [expanded, isMobile]);

    if (!body || String(body).trim().length === 0) return null;

    if (!isMobile) {
        return (
            <View style={styles.tipCard}>
                <Text style={styles.tipTitle}>{title}</Text>
                <Text style={styles.tipBody}>{body}</Text>
            </View>
        );
    }

    return (
        <View style={styles.tipCard}>
            <TouchableOpacity onPress={() => setExpanded(v => !v)} activeOpacity={0.8}>
                <View style={styles.tipHeaderRow}>
                    <Text style={styles.tipTitle}>{title}</Text>
                    <Text style={styles.tipChevron}>{isExpanded ? 'Скрыть' : 'Показать'}</Text>
                </View>
            </TouchableOpacity>
            {isExpanded ? <Text style={styles.tipBody}>{body}</Text> : null}
        </View>
    );
};

const styles = StyleSheet.create({
    tipCard: {
        marginHorizontal: DESIGN_TOKENS.spacing.lg,
        marginTop: 8,
        padding: DESIGN_TOKENS.spacing.md,
        borderRadius: DESIGN_TOKENS.radii.md,
        backgroundColor: DESIGN_TOKENS.colors.successSoft,
        borderWidth: 1,
        borderColor: DESIGN_TOKENS.colors.successLight,
    },
    tipHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: DESIGN_TOKENS.spacing.sm,
    },
    tipTitle: {
        fontSize: DESIGN_TOKENS.typography.sizes.sm,
        fontWeight: '600',
        color: DESIGN_TOKENS.colors.successDark,
    },
    tipChevron: {
        fontSize: DESIGN_TOKENS.typography.sizes.xs,
        color: DESIGN_TOKENS.colors.textMuted,
        fontWeight: '600',
    },
    tipBody: {
        marginTop: 6,
        fontSize: DESIGN_TOKENS.typography.sizes.sm,
        color: DESIGN_TOKENS.colors.text,
    },
});

export default React.memo(TravelWizardTip);
