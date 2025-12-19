import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Pressable } from 'react-native';
import { router } from 'expo-router';
import { METRICS } from '@/constants/layout';
import { useResponsive } from '@/hooks/useResponsive';

export default React.memo(function Logo({ variant = 'default' }: any) {
    const { isPhone, isLargePhone } = useResponsive();
    const isMobile = isPhone || isLargePhone;

    return (
        <TouchableOpacity
            onPress={() => router.push('/')}
            style={styles.logoContainer}
            accessibilityRole="button"
            accessibilityLabel="MeTravel - Главная страница"
        >
            <Image
                source={require('../assets/icons/logo_yellow_60x60.png')}
                style={[styles.logo, isMobile && styles.logoMobile]}
                resizeMode="contain"
            />
            {!isMobile && (
                <View style={styles.logoTextRow}>
                    <Text style={styles.logoTextMe}>Me</Text>
                    <Text style={styles.logoTextTravel}>Travel</Text>
                </View>
            )}
        </TouchableOpacity>
    );
});

const styles = StyleSheet.create({
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
        color: '#ff9f5a',
        fontSize: 18,
        fontWeight: '600',
    },
    logoTextTravel: { 
        color: '#25a562',
        fontSize: 18,
        fontWeight: '600',
    },
    logoTextRow: { 
        flexDirection: 'row', 
        marginLeft: 8,
        alignItems: 'center',
    },
});

