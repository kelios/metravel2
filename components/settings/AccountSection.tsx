import { View, Text, Pressable, Platform } from 'react-native';
import Feather from '@expo/vector-icons/Feather';

import { globalFocusStyles } from '@/styles/globalFocus';
import type { useThemedColors } from '@/hooks/useTheme';
import type { createSettingsStyles } from '@/components/screens/settings/settings.styles';
import { translate as i18nT } from '@/i18n'


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
                    <Feather name="user" size={18} color={colors.primaryDark} />
                </View>
                <View style={styles.cardText}>
                    <Text style={styles.cardTitle}>{username || i18nT('profile:components.settings.AccountSection.defaultUserName')}</Text>
                    <Text style={styles.cardMeta}>{i18nT('profile:components.settings.AccountSection.vy_voshli_v_akkaunt_903ff030')}</Text>
                </View>
            </View>

            <Pressable
                style={[styles.dangerButton, globalFocusStyles.focusable]}
                onPress={handleLogout}
                accessibilityRole="button"
                accessibilityLabel={i18nT('profile:components.settings.AccountSection.vyyti_iz_akkaunta_30eec566')}
                {...Platform.select({ web: { cursor: 'pointer' } })}
            >
                <Feather name="log-out" size={18} color={colors.danger} />
                <Text style={styles.dangerButtonText}>{i18nT('profile:components.settings.AccountSection.vyyti_790a2d1c')}</Text>
            </Pressable>

            <Pressable
                style={[styles.dangerButton, styles.deleteAccountButton, globalFocusStyles.focusable]}
                onPress={handleDeleteAccount}
                accessibilityRole="button"
                accessibilityLabel={i18nT('profile:components.settings.AccountSection.udalit_akkaunt_35f7b30c')}
                {...Platform.select({ web: { cursor: 'pointer' } })}
            >
                <Feather name="user-x" size={18} color={colors.textOnPrimary} />
                <Text style={styles.deleteAccountButtonText}>{i18nT('profile:components.settings.AccountSection.udalit_akkaunt_35f7b30c')}</Text>
            </Pressable>
        </View>
    );
}
