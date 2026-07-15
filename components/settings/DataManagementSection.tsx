import { View, Text, Pressable, Platform } from 'react-native';
import Feather from '@expo/vector-icons/Feather';

import { globalFocusStyles } from '@/styles/globalFocus';
import type { useThemedColors } from '@/hooks/useTheme';
import type { createSettingsStyles } from '@/components/screens/settings/settings.styles';
import { translate as i18nT } from '@/i18n'


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
                        <Feather name="heart" size={18} color={colors.primaryDark} />
                    </View>
                    <View style={styles.cardText}>
                        <Text style={styles.cardTitle}>{i18nT('profile:components.settings.DataManagementSection.hochu_poehat_5f921b1c')}</Text>
                        <Text style={styles.cardMeta}>{Array.isArray(favorites) ? favorites.length : 0} {i18nT('profile:components.settings.DataManagementSection.sht_345a19d5')}</Text>
                    </View>
                </View>

                <Pressable
                    style={[styles.dangerButton, globalFocusStyles.focusable]}
                    onPress={handleClearFavorites}
                    accessibilityRole="button"
                    accessibilityLabel={i18nT('profile:components.settings.DataManagementSection.ochistit_hochu_poehat_cdf8d757')}
                    {...Platform.select({ web: { cursor: 'pointer' } })}
                >
                    <Feather name="trash-2" size={18} color={colors.danger} />
                    <Text style={styles.dangerButtonText}>{i18nT('profile:components.settings.DataManagementSection.ochistit_hochu_poehat_cdf8d757')}</Text>
                </Pressable>
            </View>

            <View style={styles.card}>
                <View style={styles.cardRow}>
                    <View style={styles.cardIcon}>
                        <Feather name="clock" size={18} color={colors.primaryDark} />
                    </View>
                    <View style={styles.cardText}>
                        <Text style={styles.cardTitle}>{i18nT('profile:components.settings.DataManagementSection.istoriya_prosmotrov_f059f6d6')}</Text>
                        <Text style={styles.cardMeta}>{Array.isArray(viewHistory) ? viewHistory.length : 0} {i18nT('profile:components.settings.DataManagementSection.sht_345a19d5')}</Text>
                    </View>
                </View>

                <Pressable
                    style={[styles.dangerButton, globalFocusStyles.focusable]}
                    onPress={handleClearHistory}
                    accessibilityRole="button"
                    accessibilityLabel={i18nT('profile:components.settings.DataManagementSection.ochistit_istoriyu_prosmotrov_6649b434')}
                    {...Platform.select({ web: { cursor: 'pointer' } })}
                >
                    <Feather name="trash-2" size={18} color={colors.danger} />
                    <Text style={styles.dangerButtonText}>{i18nT('profile:components.settings.DataManagementSection.ochistit_istoriyu_45d708bd')}</Text>
                </Pressable>
            </View>
        </>
    );
}
