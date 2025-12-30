import React, { useCallback, useMemo, useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, FlatList, Pressable, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { useAuth } from '@/context/AuthContext';
import { useFavorites } from '@/context/FavoritesContext';
import EmptyState from '@/components/EmptyState';
import TabTravelCard from '@/components/listTravel/TabTravelCard';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { globalFocusStyles } from '@/styles/globalFocus';
import { confirmAction } from '@/src/utils/confirmAction';
import { SkeletonLoader } from '@/components/SkeletonLoader';
import { useResponsive } from '@/hooks/useResponsive';

export default function HistoryScreen() {
    const router = useRouter();
    const { width } = useResponsive();
    const { isAuthenticated } = useAuth();
    const { viewHistory, clearHistory } = useFavorites() as any;
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const timer = setTimeout(() => setIsLoading(false), 300);
        return () => clearTimeout(timer);
    }, [viewHistory]);

    const horizontalPadding = 16;
    const columnGap = 14;
    const minCardWidth = 320;
    const availableWidth = Math.max(0, (width || 0) - horizontalPadding * 2);
    const computedColumns = Math.max(1, Math.floor((availableWidth + columnGap) / (minCardWidth + columnGap)));
    const numColumns = Math.min(computedColumns, 3);

    const handleOpen = useCallback(
        (url: string) => {
            router.push(url as any);
        },
        [router]
    );

    // Функция для очистки заголовка от информации о стране
    const cleanTitle = useCallback((title: string, country: string | null) => {
        if (!country || !title) return title;
        
        // Удаляем страну из заголовка
        const countryPatterns = [
            `в ${country}`,
            `в ${country.toLowerCase()}`,
            `${country}`,
            `${country.toLowerCase()}`,
        ];
        
        let cleanedTitle = title;
        countryPatterns.forEach(pattern => {
            cleanedTitle = cleanedTitle.replace(pattern, '').trim();
        });
        
        // Удаляем лишние пробелы и знаки препинания в конце
        cleanedTitle = cleanedTitle.replace(/\s*[,.\-:]\s*$/, '').trim();
        
        return cleanedTitle || title; // Возвращаем оригинал если что-то пошло не так
    }, []);

    const handleClear = useCallback(async () => {
        if (!clearHistory) return;

        const confirmed = await confirmAction({
            title: 'Очистить историю',
            message: 'Очистить историю просмотров?',
            confirmText: 'Очистить',
            cancelText: 'Отмена',
        });
        if (!confirmed) return;

        await clearHistory();
    }, [clearHistory]);

    const data = useMemo(() => (Array.isArray(viewHistory) ? viewHistory : []), [viewHistory]);

    if (!isAuthenticated) {
        return (
            <SafeAreaView style={styles.container}>
                <EmptyState
                    icon="clock"
                    title="Войдите в аккаунт"
                    description="Войдите, чтобы сохранять историю просмотров и синхронизировать её между устройствами."
                    action={{
                        label: 'Войти',
                        onPress: () => router.push('/login'),
                    }}
                />
            </SafeAreaView>
        );
    }

    if (isLoading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.header}>
                    <View style={styles.headerTitleBlock}>
                        <Text style={styles.title}>История</Text>
                    </View>
                </View>
                <View style={styles.gridContent}>
                    {Array.from({ length: numColumns > 1 ? numColumns * 2 : 3 }).map((_, index) => (
                        <View key={index} style={styles.gridItem}>
                            <SkeletonLoader width="100%" height={280} borderRadius={12} style={styles.card} />
                        </View>
                    ))}
                </View>
            </SafeAreaView>
        );
    }

    if (data.length === 0) {
        return (
            <SafeAreaView style={styles.container}>
                <EmptyState
                    icon="clock"
                    title="История просмотров пуста"
                    description="Откройте путешествие — оно появится здесь автоматически."
                    action={{
                        label: 'К путешествиям',
                        onPress: () => router.push('/travelsby'),
                    }}
                />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <View style={styles.headerTitleBlock}>
                    <Text style={styles.title}>История</Text>
                    <Text style={styles.subtitle}>{data.length} шт.</Text>
                </View>

                <Pressable
                    style={[styles.clearButton, globalFocusStyles.focusable]}
                    onPress={handleClear}
                    accessibilityRole="button"
                    accessibilityLabel="Очистить историю просмотров"
                    {...Platform.select({ web: { cursor: 'pointer' } })}
                >
                    <Feather name="trash-2" size={16} color={DESIGN_TOKENS.colors.danger} />
                    <Text style={styles.clearButtonText}>Очистить</Text>
                </Pressable>
            </View>

            <FlatList
                data={data}
                keyExtractor={(item: any) => `history-${item.type || 'travel'}-${item.id}-${item.viewedAt || ''}`}
                numColumns={numColumns}
                key={numColumns}
                contentContainerStyle={styles.gridContent}
                columnWrapperStyle={numColumns > 1 ? styles.gridRow : undefined}
                renderItem={({ item }: { item: any }) => (
                    <View style={[styles.gridItem, numColumns > 1 ? { maxWidth: `${100 / numColumns}%` } : null]}>
                        <TabTravelCard
                            item={{
                                id: item.id,
                                title: cleanTitle(item.title, item.country ?? item.countryName),
                                imageUrl: item.imageUrl,
                                city: item.city ?? null,
                                country: item.country ?? item.countryName ?? null,
                            }}
                            badge={{
                                icon: 'history',
                                backgroundColor: DESIGN_TOKENS.colors.overlay,
                                iconColor: DESIGN_TOKENS.colors.textOnDark,
                            }}
                            onPress={() => handleOpen(item.url)}
                            layout="grid"
                            style={styles.card}
                        />
                    </View>
                )}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: DESIGN_TOKENS.colors.mutedBackground,
    },
    header: {
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 8,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
    },
    headerTitleBlock: {
        flex: 1,
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
        color: DESIGN_TOKENS.colors.text,
    },
    subtitle: {
        marginTop: 4,
        fontSize: 13,
        color: DESIGN_TOKENS.colors.textMuted,
    },
    clearButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: DESIGN_TOKENS.radii.md,
        borderWidth: 1,
        borderColor: DESIGN_TOKENS.colors.danger,
        backgroundColor: DESIGN_TOKENS.colors.surface,
        minHeight: 40,
    },
    clearButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: DESIGN_TOKENS.colors.danger,
    },
    gridContent: {
        paddingHorizontal: 16,
        paddingBottom: 24,
        paddingTop: 6,
    },
    gridRow: {
        justifyContent: 'flex-start',
        gap: 14,
        paddingTop: 12,
    },
    gridItem: {
        flex: 1,
        paddingTop: 12,
    },
    card: {
        marginRight: 0,
        width: '100%',
        minWidth: 320,
        maxWidth: 360,
        alignSelf: 'center',
    },
});
