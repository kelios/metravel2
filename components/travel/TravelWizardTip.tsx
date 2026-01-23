import React, { useMemo, useState } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { useResponsive } from '@/hooks/useResponsive';
import { useThemedColors } from '@/hooks/useTheme';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import CardActionPressable from '@/components/ui/CardActionPressable';

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
    const { isPhone, isLargePhone } = useResponsive();
    const isMobile = isPhone || isLargePhone;
    const colors = useThemedColors();
    const [expanded, setExpanded] = useState(defaultExpanded);

    const isExpanded = useMemo(() => {
        if (!isMobile) return true;
        return expanded;
    }, [expanded, isMobile]);

    const styles = useMemo(() => StyleSheet.create({
        tipCard: {
            marginHorizontal: DESIGN_TOKENS.spacing.lg,
            marginTop: 8,
            padding: DESIGN_TOKENS.spacing.md,
            borderRadius: DESIGN_TOKENS.radii.md,
            backgroundColor: colors.successSoft,
            borderWidth: 1,
            borderColor: colors.successLight,
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
            color: colors.success,
        },
        tipChevron: {
            fontSize: DESIGN_TOKENS.typography.sizes.xs,
            color: colors.textMuted,
            fontWeight: '600',
        },
        tipBody: {
            marginTop: 6,
            fontSize: DESIGN_TOKENS.typography.sizes.sm,
            color: colors.text,
        },
    }), [colors]);

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
            <CardActionPressable
                onPress={() => setExpanded(v => !v)}
                style={styles.tipHeaderRow}
                accessibilityLabel={title}
            >
                <Text style={styles.tipTitle}>{title}</Text>
                <Text style={styles.tipChevron}>{isExpanded ? 'Скрыть' : 'Показать'}</Text>
            </CardActionPressable>
            {isExpanded ? <Text style={styles.tipBody}>{body}</Text> : null}
        </View>
    );
};


export default React.memo(TravelWizardTip);
