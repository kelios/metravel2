import React, { useMemo } from 'react';
import { Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';
import BirdLogoIcon from './BirdLogoIcon';

type LogoProps = {
    isCompact?: boolean;
    showWordmark?: boolean;
    variant?: 'default';
};

export default React.memo(function Logo({
    isCompact = false,
    showWordmark = true,
    variant: _variant = 'default',
}: LogoProps) {
    const colors = useThemedColors();
    const styles = useMemo(() => getStyles(colors), [colors]);

    return (
        <TouchableOpacity
            onPress={() => router.push('/')}
            style={styles.logoContainer}
            accessibilityRole="link"
            accessibilityLabel="MeTravel логотип"
            accessibilityHint="Перейти на главную страницу"
        >
            <BirdLogoIcon size={isCompact ? 26 : 32} />
            {showWordmark && (
                <Text style={styles.logoTextRow}>
                    <Text style={styles.logoTextMe}>Me</Text><Text style={styles.logoTextTravel}>Travel</Text>
                </Text>
            )}
        </TouchableOpacity>
    );
});

const getStyles = (colors: ThemedColors) => StyleSheet.create({
    logoContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 44,
        minHeight: 44,
        flexShrink: 0,
    },
    logoTextMe: {
        color: colors.primaryText,
        fontSize: 18,
        fontWeight: '600',
    },
    logoTextTravel: {
        color: colors.success,
        fontSize: 18,
        fontWeight: '600',
    },
    logoTextRow: {
        marginLeft: 8,
    },
});
