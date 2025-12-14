import React, { useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, SafeAreaView, FlatList, Pressable, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { useAuth } from '@/context/AuthContext';
import { useFavorites } from '@/context/FavoritesContext';
import EmptyState from '@/components/EmptyState';
import TabTravelCard from '@/components/listTravel/TabTravelCard';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { globalFocusStyles } from '@/styles/globalFocus';

export default function FavoritesScreen() {
    const router = useRouter();
    const { isAuthenticated } = useAuth();
    const { favorites, removeFavorite, clearFavorites } = useFavorites() as any;

    const handleClearAll = useCallback(async () => {
        try {
            if (!clearFavorites) return;

            if (Platform.OS === 'web') {
                const confirmed = window.confirm('Очистить избранное?');
                if (!confirmed) return;
            }

            await clearFavorites();
        } catch (error) {
            console.error('Error clearing favorites:', error);
        }
    }, [clearFavorites]);

    const handleOpen = useCallback(
        (url: string) => {
            if (Platform.OS === 'web') {
                window.location.href = url;
            } else {
                router.push(url as any);
            }
        },
        [router]
    );

    const data = useMemo(() => (Array.isArray(favorites) ? favorites : []), [favorites]);

    if (!isAuthenticated) {
        return (
            <SafeAreaView style={styles.container}>
                <EmptyState
                    icon="heart"
                    title="Избранное доступно после входа"
                    description="Войдите в аккаунт, чтобы синхронизировать избранное между устройствами."
                    action={{
                        label: 'Войти',
                        onPress: () => router.push('/login'),
                    }}
                />
            </SafeAreaView>
        );
    }

    if (data.length === 0) {
        return (
            <SafeAreaView style={styles.container}>
                <EmptyState
                    icon="heart"
                    title="В избранном пока пусто"
                    description="Откройте путешествие и нажмите на сердечко, чтобы добавить его сюда."
                    action={{
                        label: 'Перейти к путешествиям',
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
                contentContainerStyle={styles.listContent}
                renderItem={({ item }: { item: any }) => (
                    <View style={styles.cardWrap}>
                        <TabTravelCard
                            item={{
                                id: item.id,
                                title: item.title,
                                imageUrl: item.imageUrl,
                                city: item.city ?? null,
                                country: item.country ?? null,
                            }}
                            onPress={() => handleOpen(item.url)}
                            style={styles.card}
                        />

                        <Pressable
                            style={[styles.removeButton, globalFocusStyles.focusable]}
                            onPress={() => removeFavorite?.(item.id, item.type)}
                            accessibilityRole="button"
                            accessibilityLabel="Удалить из избранного"
                            {...Platform.select({ web: { cursor: 'pointer' } })}
                        >
                            <Feather name="trash-2" size={16} color="#ffffff" />
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
        paddingHorizontal: 10,
        paddingVertical: 8,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: DESIGN_TOKENS.colors.border,
        backgroundColor: DESIGN_TOKENS.colors.surface,
    },
    clearButtonText: {
        fontSize: 13,
        fontWeight: '600',
        color: DESIGN_TOKENS.colors.danger,
    },
    listContent: {
        paddingHorizontal: 18,
        paddingBottom: 20,
        paddingTop: 4,
        gap: 14,
        alignItems: 'center',
    },
    cardWrap: {
        position: 'relative',
        width: '100%',
        alignItems: 'center',
    },
    card: {
        width: '100%',
        minWidth: 320,
        maxWidth: 360,
        alignSelf: 'center',
        marginRight: 0,
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
