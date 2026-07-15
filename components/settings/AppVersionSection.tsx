import { View, Text } from 'react-native';
import Feather from '@expo/vector-icons/Feather';

import type { AppVersionInfo } from '@/utils';
import type { useThemedColors } from '@/hooks/useTheme';
import type { createSettingsStyles } from '@/components/screens/settings/settings.styles';
import { translate as i18nT } from '@/i18n'


type Colors = ReturnType<typeof useThemedColors>;
type Styles = ReturnType<typeof createSettingsStyles>;

interface AppVersionSectionProps {
    styles: Styles;
    colors: Colors;
    versionInfo: AppVersionInfo;
}

export default function AppVersionSection({ styles, colors, versionInfo }: AppVersionSectionProps) {
    return (
        <View style={styles.card} testID="app-version-card">
            <View style={styles.cardRow}>
                <View style={styles.cardIcon}>
                    <Feather name="info" size={18} color={colors.primaryDark} />
                </View>
                <View style={styles.cardText}>
                    <Text style={styles.cardTitle}>{i18nT('profile:components.settings.AppVersionSection.versiya_prilozheniya_2081ca7b')}</Text>
                    <Text style={styles.cardMeta}>{versionInfo.displayVersion}</Text>
                    {versionInfo.packageName ? (
                        <Text style={styles.cardMeta}>{i18nT('profile:components.settings.AppVersionSection.paket_3e680e0f')}{versionInfo.packageName}</Text>
                    ) : null}
                </View>
            </View>
        </View>
    );
}
