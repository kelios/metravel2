import React, { memo, useMemo } from 'react';
import { StyleSheet, View, Platform } from 'react-native';
import { usePathname } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';

import InstantSEO from '@/components/seo/InstantSEO';
import ErrorBoundary from '@/components/ErrorBoundary';
import ErrorDisplay from '@/components/ErrorDisplay';
import Home from '@/components/home/Home';
import { DESIGN_TOKENS } from '@/constants/designSystem';

function HomeScreen() {
    const pathname = usePathname();
    const isFocused = useIsFocused();

    const SITE = process.env.EXPO_PUBLIC_SITE_URL || 'https://metravel.by';

    const canonical = useMemo(() => `${SITE}${pathname || ''}`, [SITE, pathname]);

    if (Platform.OS === 'web' && pathname && pathname !== '/' && pathname !== '') {
        return <View style={styles.container} />;
    }

    const title = 'Твоя книга путешествий | Metravel';
    const description = 'Добавляй поездки, фото и заметки — и собирай красивую книгу в PDF для печати.';

    return (
        <>
            {isFocused && Platform.OS === 'web' && (
                <InstantSEO
                    headKey="home"
                    title={title}
                    description={description}
                    canonical={canonical}
                    image={`${SITE}/og-preview.jpg`}
                    ogType="website"
                />
            )}
            <View style={styles.container}>
                <ErrorBoundary
                    fallback={
                        <View style={styles.errorContainer}>
                            <ErrorDisplay
                                message="Не удалось загрузить главную страницу"
                                onRetry={() => {
                                    if (Platform.OS === 'web' && typeof window !== 'undefined') {
                                        window.location.reload();
                                    }
                                }}
                                variant="error"
                            />
                        </View>
                    }
                >
                    <Home />
                </ErrorBoundary>
            </View>
        </>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: DESIGN_TOKENS.colors.background,
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
});

export default memo(HomeScreen);
