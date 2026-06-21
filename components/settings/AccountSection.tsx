import React from 'react';
import { View, Text, Pressable, Platform } from 'react-native';
import Feather from '@expo/vector-icons/Feather';

import { globalFocusStyles } from '@/styles/globalFocus';
import type { useThemedColors } from '@/hooks/useTheme';
import type { createSettingsStyles } from '@/components/screens/settings/settings.styles';

type Colors = ReturnType<typeof useThemedColors>;
type Styles = ReturnType<typeof createSettingsStyles>;

interface AccountSectionProps {
    styles: Styles;
    colors: Colors;
    username?: string | null;
    handleLogout: () => void;
    handleDeleteAccount: () => void;
}

export default function AccountSection({
    styles,
    colors,
    username,
    handleLogout,
    handleDeleteAccount,
}: AccountSectionProps) {
    return (
        <View style={styles.card}>
            <View style={styles.cardRow}>
                <View style={styles.cardIcon}>
                    <Feather name="user" size={18} color={colors.primary} />
                </View>
                <View style={styles.cardText}>
                    <Text style={styles.cardTitle}>{username || 'Пользователь'}</Text>
                    <Text style={styles.cardMeta}>Вы вошли в аккаунт</Text>
                </View>
            </View>

            <Pressable
                style={[styles.dangerButton, globalFocusStyles.focusable]}
                onPress={handleLogout}
                accessibilityRole="button"
                accessibilityLabel="Выйти из аккаунта"
                {...Platform.select({ web: { cursor: 'pointer' } })}
            >
                <Feather name="log-out" size={18} color={colors.danger} />
                <Text style={styles.dangerButtonText}>Выйти</Text>
            </Pressable>

            <Pressable
                style={[styles.dangerButton, styles.deleteAccountButton, globalFocusStyles.focusable]}
                onPress={handleDeleteAccount}
                accessibilityRole="button"
                accessibilityLabel="Удалить аккаунт"
                {...Platform.select({ web: { cursor: 'pointer' } })}
            >
                <Feather name="user-x" size={18} color={colors.textOnPrimary} />
                <Text style={styles.deleteAccountButtonText}>Удалить аккаунт</Text>
            </Pressable>
        </View>
    );
}
