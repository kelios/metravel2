import { View, Text, Pressable, Platform } from 'react-native';
import Feather from '@expo/vector-icons/Feather';

import type { Theme, useThemedColors } from '@/hooks/useTheme';
import type { createSettingsStyles } from '@/components/screens/settings/settings.styles';
import { translate as i18nT } from '@/i18n'


type Colors = ReturnType<typeof useThemedColors>;
type Styles = ReturnType<typeof createSettingsStyles>;

interface ThemeOption {
    value: Theme;
    label: string;
    description: string;
    icon: 'sun' | 'moon' | 'smartphone';
}

interface ThemeSectionProps {
    styles: Styles;
    colors: Colors;
    theme: Theme;
    setTheme: (theme: Theme) => void;
    themeOptions: ThemeOption[];
}

export default function ThemeSection({ styles, colors, theme, setTheme, themeOptions }: ThemeSectionProps) {
    return (
        <View style={styles.card}>
            <View style={styles.cardRow}>
                <View style={styles.cardIcon}>
                    <Feather name="sun" size={18} color={colors.primaryDark} />
                </View>
                <View style={styles.cardText}>
                    <Text style={styles.cardTitle}>{i18nT('profile:components.settings.ThemeSection.tema_oformleniya_78a345c8')}</Text>
                    <Text style={styles.cardMeta}>{i18nT('profile:components.settings.ThemeSection.po_umolchaniyu_svetlaya_b13d797b')}</Text>
                </View>
            </View>

            <View
                style={styles.themeOptions}
                accessibilityRole="radiogroup"
                accessibilityLabel={i18nT('profile:components.settings.ThemeSection.vybor_temy_oformleniya_dbeae2db')}
            >
                {themeOptions.map((option) => {
                    const isSelected = theme === option.value;
                    return (
                        <Pressable
                            key={option.value}
                            onPress={() => setTheme(option.value)}
                            style={({ pressed }) => [
                                styles.themeOption,
                                isSelected && styles.themeOptionActive,
                                pressed && styles.themeOptionPressed,
                            ]}
                            accessibilityRole="radio"
                            accessibilityState={{ selected: isSelected }}
                            accessibilityLabel={option.label}
                            {...Platform.select({ web: { cursor: 'pointer' } })}
                        >
                            <View style={[styles.themeOptionIcon, isSelected && styles.themeOptionIconActive]}>
                                <Feather name={option.icon} size={16} color={colors.primaryDark} />
                            </View>
                            <View style={styles.themeOptionText}>
                                <Text style={styles.themeOptionTitle}>{option.label}</Text>
                                <Text style={styles.themeOptionDescription}>{option.description}</Text>
                            </View>
                            {isSelected ? (
                                <Feather name="check" size={16} color={colors.primaryDark} />
                            ) : null}
                        </Pressable>
                    );
                })}
            </View>
        </View>
    );
}
