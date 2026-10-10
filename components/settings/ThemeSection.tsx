import type { ReactNode } from 'react';
import { View, Text, Pressable, Platform } from 'react-native';
import Feather from '@expo/vector-icons/Feather';

import type { useThemedColors } from '@/hooks/useTheme';
import type { createSettingsStyles } from '@/components/screens/settings/settings.styles';
import { translate as i18nT } from '@/i18n'


type Colors = ReturnType<typeof useThemedColors>;
type Styles = ReturnType<typeof createSettingsStyles>;

export interface ThemeOption<T extends string = string> {
    value: T;
    label: string;
    description: string;
    renderIcon: (size: number, color: string) => ReactNode;
}

interface ThemeSectionProps<T extends string> {
    styles: Styles;
    colors: Colors;
    theme: T;
    setTheme: (theme: T) => void;
    themeOptions: ReadonlyArray<ThemeOption<T>>;
    /** Заголовок/подпись/иконка карточки; по умолчанию — «Тема оформления». */
    title?: string;
    description?: string;
    headerIcon?: React.ComponentProps<typeof Feather>['name'];
    accessibilityLabel?: string;
}

/**
 * Карточка radio-выбора оформления в настройках: светлая/тёмная/авто и
 * праздничное оформление (#2376) — один компонент, разные наборы вариантов.
 */
export default function ThemeSection<T extends string>({
    styles,
    colors,
    theme,
    setTheme,
    themeOptions,
    title,
    description,
    headerIcon = 'sun',
    accessibilityLabel,
}: ThemeSectionProps<T>) {
    return (
        <View style={styles.card}>
            <View style={styles.cardRow}>
                <View style={styles.cardIcon}>
                    <Feather name={headerIcon} size={18} color={colors.primaryDark} />
                </View>
                <View style={styles.cardText}>
                    <Text style={styles.cardTitle}>{title ?? i18nT('profile:components.settings.ThemeSection.tema_oformleniya_78a345c8')}</Text>
                    <Text style={styles.cardMeta}>{description ?? i18nT('profile:components.settings.ThemeSection.po_umolchaniyu_svetlaya_b13d797b')}</Text>
                </View>
            </View>

            <View
                style={styles.themeOptions}
                accessibilityRole="radiogroup"
                accessibilityLabel={accessibilityLabel ?? i18nT('profile:components.settings.ThemeSection.vybor_temy_oformleniya_dbeae2db')}
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
                                {option.renderIcon(16, colors.primaryDark)}
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
