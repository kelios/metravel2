import { View, Text, Pressable, Platform } from 'react-native';
import Feather from '@expo/vector-icons/Feather';

import { globalFocusStyles } from '@/styles/globalFocus';
import type { useThemedColors } from '@/hooks/useTheme';
import type { createSettingsStyles } from '@/components/screens/settings/settings.styles';

type Colors = ReturnType<typeof useThemedColors>;
type Styles = ReturnType<typeof createSettingsStyles>;

interface DataManagementSectionProps {
    styles: Styles;
    colors: Colors;
    favorites: unknown[];
    viewHistory: unknown[];
    handleClearFavorites: () => void;
    handleClearHistory: () => void;
}

export default function DataManagementSection({
    styles,
    colors,
    favorites,
    viewHistory,
    handleClearFavorites,
    handleClearHistory,
}: DataManagementSectionProps) {
    return (
        <>
            <View style={styles.card}>
                <View style={styles.cardRow}>
                    <View style={styles.cardIcon}>
                        <Feather name="heart" size={18} color={colors.primary} />
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
                    <Feather name="trash-2" size={18} color={colors.danger} />
                    <Text style={styles.dangerButtonText}>Очистить избранное</Text>
                </Pressable>
            </View>

            <View style={styles.card}>
                <View style={styles.cardRow}>
                    <View style={styles.cardIcon}>
                        <Feather name="clock" size={18} color={colors.primary} />
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
                    <Feather name="trash-2" size={18} color={colors.danger} />
                    <Text style={styles.dangerButtonText}>Очистить историю</Text>
                </Pressable>
            </View>
        </>
    );
}
