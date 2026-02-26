import React, { useMemo, useState } from 'react';
import { Text, StyleSheet, TouchableOpacity, Image, Platform } from 'react-native';
import { router } from 'expo-router';
import { useResponsive } from '@/hooks/useResponsive';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';

export default React.memo(function Logo({ variant: _variant = 'default' }: any) {
    const { isPhone, isLargePhone } = useResponsive();
    const isMobile = isPhone || isLargePhone;
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
                style={[styles.logo, isMobile && styles.logoMobile]}
                resizeMode="contain"
                onError={() => setLogoLoadFailed(true)}
                accessibilityLabel="MeTravel логотип"
                alt="MeTravel логотип"
            />
            {!isMobile && (
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
    logoMobile: { 
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
