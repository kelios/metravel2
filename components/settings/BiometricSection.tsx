import { View, Text } from 'react-native';
import Feather from '@expo/vector-icons/Feather';

import { Toggle } from '@/components/ui/Toggle';
import type { useThemedColors } from '@/hooks/useTheme';
import type { useBiometricAuth } from '@/hooks/useBiometricAuth';
import type { createSettingsStyles } from '@/components/screens/settings/settings.styles';
import { translate as i18nT } from '@/i18n'


type Colors = ReturnType<typeof useThemedColors>;
type Styles = ReturnType<typeof createSettingsStyles>;

interface BiometricSectionProps {
    styles: Styles;
    colors: Colors;
    biometric: ReturnType<typeof useBiometricAuth>;
}

export default function BiometricSection({ styles, colors, biometric }: BiometricSectionProps) {
    return (
        <View style={styles.card}>
            <View style={styles.settingRow}>
                <View style={styles.settingTextBlock}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Feather name="lock" size={16} color={colors.primaryDark} />
                        <Text style={styles.settingTitle}>{i18nT('profile:components.settings.BiometricSection.vhod_po_biometrii_27d9c7ea')}</Text>
                    </View>
                    <Text style={styles.settingMeta}>
                        {i18nT('profile:components.settings.BiometricSection.ispolzuyte_otpechatok_paltsa_ili_face_id_dly_78ec37b5')}</Text>
                </View>
                <Toggle
                    value={biometric.isEnabled}
                    onValueChange={async (val) => {
                        if (val) await biometric.enable();
                        else await biometric.disable();
                    }}
                    disabled={biometric.isChecking}
                />
            </View>
        </View>
    );
}
