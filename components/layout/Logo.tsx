import React, { useMemo, useState } from 'react';
import { Text, StyleSheet, TouchableOpacity, Image, Platform } from 'react-native';
import { router } from 'expo-router';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';

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
    const [logoLoadFailed, setLogoLoadFailed] = useState(false);
    const primarySource =
        Platform.OS === 'web'
            ? ({ uri: '/assets/icons/logo_yellow_60x60.png' } as const)
            : require('../../assets/icons/logo_yellow_60x60.png');
    const fallbackSource =
        Platform.OS === 'web'
            ? ({ uri: '/assets/icons/logo_yellow.png' } as const)
            : require('../../assets/icons/logo_yellow_60x60.png');

    return (
        <TouchableOpacity
            onPress={() => router.push('/')}
            style={styles.logoContainer}
            accessibilityRole="link"
            accessibilityHint="Перейти на главную страницу"
        >
            <Image
                source={logoLoadFailed ? fallbackSource : primarySource}
                style={[styles.logo, isCompact && styles.logoCompact]}
                resizeMode="contain"
                onError={() => setLogoLoadFailed(true)}
                accessibilityLabel="MeTravel логотип"
                alt="MeTravel логотип"
            />
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
    },
    logo: { 
        width: 32, 
        height: 32,
    },
    logoCompact: {
        width: 26, 
        height: 26,
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
