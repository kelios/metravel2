import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { DESIGN_TOKENS } from '@/constants/designSystem';

/**
 * Оболочка соц-кнопки веб-форм входа: геометрия, состояния и accessibility —
 * одни на всех провайдеров, брендовые цвета и логотип приходят снаружи.
 *
 * Выделено из `FacebookSignInButton.web.tsx` и `AppleSignInButton.web.tsx`
 * (#1506): кнопки стоят соседями в одном блоке `LoginForm`/`RegistrationForm`,
 * и пока оболочка существовала двумя копиями, правка одной молча разъезжалась
 * со второй. Google сюда не переводится: его кнопку рисует сам GSI.
 */

/** Общая высота соц-кнопок: они читаются как один набор, а не как разнобой. */
export const SOCIAL_AUTH_BUTTON_HEIGHT = 48;

export type SocialAuthButtonProps = {
    /** Надпись в кнопке — она же меняется на «загружаемся»/«недоступно». */
    label: string;
    /** Постоянное имя действия: оно не должно скакать вместе с `label`. */
    accessibilityLabel: string;
    /** Логотип провайдера; цвет задаёт вызывающий по своему брендбуку. */
    icon: ReactNode;
    backgroundColor: string;
    foregroundColor: string;
    onPress: () => void;
    testID: string;
    loading?: boolean;
    disabled?: boolean;
};

/**
 * Заглушка на время гидратации: держит ту же высоту, чтобы появление кнопки не
 * двигало форму.
 */
export function SocialAuthButtonPlaceholder() {
    return <View style={styles.placeholder} />;
}

export default function SocialAuthButton({
    label,
    accessibilityLabel,
    icon,
    backgroundColor,
    foregroundColor,
    onPress,
    testID,
    loading = false,
    disabled = false,
}: SocialAuthButtonProps) {
    return (
        <Pressable
            onPress={onPress}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel={accessibilityLabel}
            accessibilityState={{ disabled, busy: loading }}
            testID={testID}
            style={({ pressed }) => [
                styles.button,
                { backgroundColor },
                disabled && styles.buttonDisabled,
                pressed && styles.buttonPressed,
            ]}
        >
            <View style={styles.content}>
                {loading ? <ActivityIndicator size="small" color={foregroundColor} /> : icon}
                <Text style={[styles.text, { color: foregroundColor }]}>{label}</Text>
            </View>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    placeholder: {
        width: '100%',
        minHeight: SOCIAL_AUTH_BUTTON_HEIGHT,
        borderRadius: DESIGN_TOKENS.radii.lg,
    },
    button: {
        width: '100%',
        minHeight: SOCIAL_AUTH_BUTTON_HEIGHT,
        borderRadius: DESIGN_TOKENS.radii.lg,
        alignItems: 'center',
        justifyContent: 'center',
    },
    buttonDisabled: {
        opacity: 0.55,
    },
    buttonPressed: {
        opacity: 0.88,
        transform: [{ scale: 0.99 }],
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        paddingHorizontal: 16,
    },
    text: {
        fontSize: 16,
        fontWeight: '600',
        flexShrink: 1,
        textAlign: 'center',
    },
});
