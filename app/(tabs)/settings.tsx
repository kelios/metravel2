import React, { useCallback } from 'react';
import { View, Text, StyleSheet, SafeAreaView, Pressable, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { useAuth } from '@/context/AuthContext';
import { useFavorites } from '@/context/FavoritesContext';
import EmptyState from '@/components/EmptyState';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { globalFocusStyles } from '@/styles/globalFocus';

export default function SettingsScreen() {
    const router = useRouter();
    const { isAuthenticated } = useAuth();
    const favoritesContext = typeof useFavorites === 'function' ? useFavorites() : ({} as any);
    const { clearHistory, clearFavorites, favorites, viewHistory } = favoritesContext as any;

    const handleClearHistory = useCallback(async () => {
        try {
            if (typeof clearHistory !== 'function') return;

            if (Platform.OS === 'web') {
                const confirmed = window.confirm('Очистить историю просмотров?');
                if (!confirmed) return;
            }

            await clearHistory();
        } catch (error) {
            console.error('Error clearing history:', error);
        }
    }, [clearHistory]);

    const handleClearFavorites = useCallback(async () => {
        try {
            if (typeof clearFavorites !== 'function') return;

            if (Platform.OS === 'web') {
                const confirmed = window.confirm('Очистить избранное?');
                if (!confirmed) return;
            }

            await clearFavorites();
        } catch (error) {
            console.error('Error clearing favorites:', error);
        }
    }, [clearFavorites]);

    if (!isAuthenticated) {
        return (
            <SafeAreaView style={styles.container}>
                <EmptyState
                    icon="settings"
                    title="Настройки доступны после входа"
                    description="Войдите в аккаунт, чтобы управлять избранным и историей просмотров."
                    action={{
                        label: 'Войти',
                        onPress: () => router.push('/login'),
                    }}
                />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Настройки</Text>
                <Text style={styles.subtitle}>Управление данными аккаунта</Text>
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Данные</Text>

                <View style={styles.card}>
                    <View style={styles.cardRow}>
                        <View style={styles.cardIcon}>
                            <Feather name="heart" size={18} color={DESIGN_TOKENS.colors.primary} />
                        </View>
                        <View style={styles.cardText}>
                            <Text style={styles.cardTitle}>Избранное</Text>
                            <Text style={styles.cardMeta}>{Array.isArray(favorites) ? favorites.length : 0} шт.</Text>
                        </View>
                    </View>

                    <Pressable
                        style={[styles.dangerButton, globalFocusStyles.focusable]}
                        onPress={handleClearFavorites}
                        accessibilityRole="button"
                        accessibilityLabel="Очистить избранное"
                        {...Platform.select({ web: { cursor: 'pointer' } })}
                    >
                        <Feather name="trash-2" size={18} color={DESIGN_TOKENS.colors.danger} />
                        <Text style={styles.dangerButtonText}>Очистить избранное</Text>
                    </Pressable>
                </View>

                <View style={styles.card}>
                    <View style={styles.cardRow}>
                        <View style={styles.cardIcon}>
                            <Feather name="clock" size={18} color={DESIGN_TOKENS.colors.primary} />
                        </View>
                        <View style={styles.cardText}>
                            <Text style={styles.cardTitle}>История просмотров</Text>
                            <Text style={styles.cardMeta}>{Array.isArray(viewHistory) ? viewHistory.length : 0} шт.</Text>
                        </View>
                    </View>

                    <Pressable
                        style={[styles.dangerButton, globalFocusStyles.focusable]}
                        onPress={handleClearHistory}
                        accessibilityRole="button"
                        accessibilityLabel="Очистить историю просмотров"
                        {...Platform.select({ web: { cursor: 'pointer' } })}
                    >
                        <Feather name="trash-2" size={18} color={DESIGN_TOKENS.colors.danger} />
                        <Text style={styles.dangerButtonText}>Очистить историю</Text>
                    </Pressable>
                </View>
            </View>
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
        paddingTop: 16,
        paddingBottom: 10,
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
    section: {
        paddingHorizontal: 16,
        paddingTop: 6,
        paddingBottom: 24,
        gap: 12,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: DESIGN_TOKENS.colors.text,
    },
    card: {
        backgroundColor: DESIGN_TOKENS.colors.surface,
        borderRadius: DESIGN_TOKENS.radii.lg,
        borderWidth: 1,
        borderColor: DESIGN_TOKENS.colors.border,
        padding: 14,
        gap: 12,
    },
    cardRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    cardIcon: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: DESIGN_TOKENS.colors.primarySoft,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cardText: {
        flex: 1,
    },
    cardTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: DESIGN_TOKENS.colors.text,
    },
    cardMeta: {
        marginTop: 2,
        fontSize: 12,
        color: DESIGN_TOKENS.colors.textMuted,
    },
    dangerButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        paddingVertical: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: DESIGN_TOKENS.colors.danger,
        backgroundColor: DESIGN_TOKENS.colors.surface,
    },
    dangerButtonText: {
        fontSize: 14,
        fontWeight: '700',
        color: DESIGN_TOKENS.colors.danger,
    },
});
