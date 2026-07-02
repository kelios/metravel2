import React from 'react';
import { View, Text, Pressable, Platform } from 'react-native';
import Feather from '@expo/vector-icons/Feather';

import { globalFocusStyles } from '@/styles/globalFocus';
import type { useThemedColors } from '@/hooks/useTheme';
import type { createSettingsStyles } from '@/components/screens/settings/settings.styles';

type Colors = ReturnType<typeof useThemedColors>;
type Styles = ReturnType<typeof createSettingsStyles>;
type FeatherIconName = React.ComponentProps<typeof Feather>['name'];

interface NavCardSectionProps {
    styles: Styles;
    colors: Colors;
    icon: FeatherIconName;
    title: string;
    meta: string;
    accessibilityLabel: string;
    onPress: () => void;
}

export default function NavCardSection({
    styles,
    colors,
    icon,
    title,
    meta,
    accessibilityLabel,
    onPress,
}: NavCardSectionProps) {
    return (
        <Pressable
            style={[styles.card, globalFocusStyles.focusable]}
            onPress={onPress}
            accessibilityRole="button"
            accessibilityLabel={accessibilityLabel}
            {...Platform.select({ web: { cursor: 'pointer' } })}
        >
            <View style={styles.cardRow}>
                <View style={styles.cardIcon}>
                    <Feather name={icon} size={18} color={colors.primaryDark} />
                </View>
                <View style={styles.cardText}>
                    <Text style={styles.cardTitle}>{title}</Text>
                    <Text style={styles.cardMeta}>{meta}</Text>
                </View>
                <Feather name="chevron-right" size={18} color={colors.textMuted} />
            </View>
        </Pressable>
    );
}
