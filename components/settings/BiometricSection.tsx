import { View, Text } from 'react-native';
import Feather from '@expo/vector-icons/Feather';

import { Toggle } from '@/components/ui/Toggle';
import type { useThemedColors } from '@/hooks/useTheme';
import type { useBiometricAuth } from '@/hooks/useBiometricAuth';
import type { createSettingsStyles } from '@/components/screens/settings/settings.styles';

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
                        <Feather name="lock" size={16} color={colors.primary} />
                        <Text style={styles.settingTitle}>Вход по биометрии</Text>
                    </View>
                    <Text style={styles.settingMeta}>
                        Используйте отпечаток пальца или Face ID для быстрого входа
                    </Text>
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
