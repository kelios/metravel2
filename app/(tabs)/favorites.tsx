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

export default function FavoritesScreen() {
    const router = useRouter();
    const { width } = useResponsive();
    const { isAuthenticated } = useAuth();
    const { favorites, removeFavorite, clearFavorites } = useFavorites() as any;
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const timer = setTimeout(() => setIsLoading(false), 300);
        return () => clearTimeout(timer);
    }, [favorites]);

    const handleClearAll = useCallback(async () => {
        try {
            if (!clearFavorites) return;

            const confirmed = await confirmAction({
                title: 'Очистить избранное',
                message: 'Очистить избранное?',
                confirmText: 'Очистить',
                cancelText: 'Отмена',
            });
            if (!confirmed) return;

            await clearFavorites();
        } catch (error) {
            console.error('Error clearing favorites:', error);
        }
    }, [clearFavorites]);

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

    const horizontalPadding = 16;
    const columnGap = 14;
    const minCardWidth = 320;
    const availableWidth = Math.max(0, (width || 0) - horizontalPadding * 2);
    const computedColumns = Math.max(1, Math.floor((availableWidth + columnGap) / (minCardWidth + columnGap)));
    const numColumns = Math.min(computedColumns, 3);

    const data = useMemo(() => (Array.isArray(favorites) ? favorites : []), [favorites]);

    if (!isAuthenticated) {
        return (
            <SafeAreaView style={styles.container}>
                <EmptyState
                    icon="heart"
                    title="Войдите в аккаунт"
                    description="Войдите, чтобы сохранять избранное и синхронизировать его между устройствами."
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
                    <View style={styles.headerRow}>
                        <View style={styles.headerTitleBlock}>
                            <Text style={styles.title}>Избранное</Text>
                        </View>
                    </View>
                </View>
                <View style={styles.listContent}>
                    {Array.from({ length: 3 }).map((_, index) => (
                        <View key={index} style={styles.cardWrap}>
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
                    icon="heart"
                    title="В избранном пока пусто"
                    description="Откройте путешествие и нажмите на сердечко — оно появится здесь."
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
                <View style={styles.headerRow}>
                    <View style={styles.headerTitleBlock}>
                        <Text style={styles.title}>Избранное</Text>
                        <Text style={styles.subtitle}>{data.length} шт.</Text>
                    </View>

                    {typeof clearFavorites === 'function' && data.length > 0 && (
                        <Pressable
                            style={[styles.clearButton, globalFocusStyles.focusable]}
                            onPress={handleClearAll}
                            accessibilityRole="button"
                            accessibilityLabel="Очистить избранное"
                            {...Platform.select({ web: { cursor: 'pointer' } })}
                        >
                            <Feather name="trash-2" size={16} color={DESIGN_TOKENS.colors.danger} />
                            <Text style={styles.clearButtonText}>Очистить</Text>
                        </Pressable>
                    )}
                </View>
            </View>

            <FlatList
                data={data}
                keyExtractor={(item: any) => `${item.type || 'travel'}-${item.id}`}
                numColumns={numColumns}
                key={numColumns}
                contentContainerStyle={styles.listContent}
                columnWrapperStyle={numColumns > 1 ? styles.gridRow : undefined}
                renderItem={({ item }: { item: any }) => (
                    <View style={styles.gridItem}>
                        <TabTravelCard
                            item={{
                                id: item.id,
                                title: cleanTitle(item.title, item.country ?? item.countryName),
                                imageUrl: item.imageUrl,
                                city: item.city ?? null,
                                country: item.country ?? item.countryName ?? null,
                            }}
                            badge={{
                                icon: 'favorite',
                                backgroundColor: DESIGN_TOKENS.colors.danger,
                                iconColor: DESIGN_TOKENS.colors.textOnDark,
                            }}
                            onPress={() => handleOpen(item.url)}
                            layout="grid"
                            style={styles.card}
                        />

                        <Pressable
                            style={[styles.removeButton, globalFocusStyles.focusable]}
                            onPress={() => removeFavorite?.(item.id, item.type)}
                            accessibilityRole="button"
                            accessibilityLabel="Удалить из избранного"
                            {...Platform.select({ web: { cursor: 'pointer' } })}
                        >
                            <Feather name="trash-2" size={16} color={DESIGN_TOKENS.colors.textOnDark} />
                        </Pressable>
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
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'flex-end',
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
        justifyContent: 'center',
        gap: 6,
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
    listContent: {
        paddingHorizontal: 16,
        paddingBottom: 24,
        paddingTop: 12,
        rowGap: 14,
    },
    gridRow: {
        justifyContent: 'space-between',
        gap: 14,
    },
    gridItem: {
        flex: 1,
        minWidth: 0,
        paddingTop: 12,
        position: 'relative',
    },
    card: {
        width: '100%',
        minWidth: 0,
        maxWidth: '100%',
        marginRight: 0,
    },
    cardWrap: {
        marginBottom: 14,
    },
    removeButton: {
        position: 'absolute',
        top: 10,
        left: 10,
        width: 32,
        height: 32,
        borderRadius: 999,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(239, 68, 68, 0.95)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.65)',
    },
});
