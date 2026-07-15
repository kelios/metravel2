import React, { useMemo, useState } from 'react';
import { Text, StyleSheet, TouchableOpacity, Image, Platform } from 'react-native';
import { router } from 'expo-router';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';
import { translate as i18nT } from '@/i18n'


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
            accessibilityHint={i18nT('navigation:components.layout.Logo.pereyti_na_glavnuyu_stranitsu_98203dd9')}
        >
            <Image
                source={logoLoadFailed ? fallbackSource : primarySource}
                style={[styles.logo, isCompact && styles.logoCompact]}
                resizeMode="contain"
                onError={() => setLogoLoadFailed(true)}
                accessibilityLabel={i18nT('navigation:components.layout.Logo.metravel_logotip_14780610')}
                alt={i18nT('navigation:components.layout.Logo.metravel_logotip_14780610')}
            />
            {showWordmark && (
                <Text style={styles.logoTextRow}>
                    <Text style={styles.logoTextMe}>{i18nT('navigation:components.layout.Logo.me_7e450b64')}</Text><Text style={styles.logoTextTravel}>{i18nT('navigation:components.layout.Logo.travel_6006be95')}</Text>
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
    logo: { 
        width: 32, 
        height: 32,
        ...Platform.select({
            web: { objectFit: 'contain' } as any,
        }),
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
