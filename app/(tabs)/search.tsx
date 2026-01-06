// ✅ УЛУЧШЕНИЕ: Страница поиска с DESIGN_TOKENS и useThemedColors
import React, { memo, useMemo } from 'react';
import { StyleSheet, View, Platform } from 'react-native';
import { usePathname } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';

import InstantSEO from '@/components/seo/LazyInstantSEO';
import ErrorBoundary from '@/components/ErrorBoundary';
import ErrorDisplay from '@/components/ErrorDisplay';
import ListTravel from '@/components/listTravel/ListTravel';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';

function SearchScreen() {
    const pathname = usePathname();
    const isFocused = useIsFocused();
    const colors = useThemedColors();

    const SITE = process.env.EXPO_PUBLIC_SITE_URL || 'https://metravel.by';

    const canonical = useMemo(() => `${SITE}${pathname || ''}`, [SITE, pathname]);

    const title = 'Поиск путешествий | Metravel';
    const description = 'Найдите путешествия по фильтрам и сохраните лучшие идеи в свою книгу.';

    // ✅ ДИЗАЙН: Динамические стили с DESIGN_TOKENS
    const styles = useMemo(() => StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: colors.background,
        },
        errorContainer: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            padding: DESIGN_TOKENS.spacing.lg,
        },
    }), [colors]);

    return (
        <>
            {isFocused && Platform.OS === 'web' && (
                <InstantSEO
                    headKey="travel-search"
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
                                message="Не удалось загрузить поиск путешествий"
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
                    <ListTravel />
                </ErrorBoundary>
            </View>
        </>
    );
}


export default memo(SearchScreen);
