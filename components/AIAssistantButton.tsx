import React, { useState } from 'react';
import { 
    View, 
    TouchableOpacity, 
    StyleSheet, 
    Platform,
    Animated,
    useWindowDimensions,
    Pressable,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { globalFocusStyles } from '@/styles/globalFocus'; // ✅ ИСПРАВЛЕНИЕ: Импорт focus-стилей

export default function AIAssistantButton() {
    const router = useRouter();
    const { width } = useWindowDimensions();
    const isMobile = width <= 768;
    const [scaleAnim] = useState(new Animated.Value(1));

    const handlePress = () => {
        // Анимация нажатия
        Animated.sequence([
            Animated.timing(scaleAnim, {
                toValue: 0.9,
                duration: 100,
                useNativeDriver: true,
            }),
            Animated.timing(scaleAnim, {
                toValue: 1,
                duration: 100,
                useNativeDriver: true,
            }),
        ]).start();

        // Переход на страницу чата
        router.push('/chat');
    };

    return (
        <Animated.View
            style={[
                styles.container,
                {
                    transform: [{ scale: scaleAnim }],
                    bottom: isMobile ? 100 : 30,
                    right: isMobile ? 20 : 30,
                },
            ]}
        >
            <Pressable
                style={[styles.button, globalFocusStyles.focusable]} // ✅ ИСПРАВЛЕНИЕ: Добавлен focus-индикатор
                onPress={handlePress}
                accessibilityRole="button"
                accessibilityLabel="Открыть AI-помощника"
            >
                <MaterialIcons name="smart-toy" size={24} color="#fff" />
                {!isMobile && (
                    <View style={styles.badge}>
                        <MaterialIcons name="auto-awesome" size={12} color="#6b8e7f" />
                    </View>
                )}
            </Pressable>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        zIndex: 1000,
    },
    button: {
        width: 56,
        height: 56,
        minWidth: 56, // ✅ ИСПРАВЛЕНИЕ: Минимальная ширина для touch-целей
        minHeight: 56, // ✅ ИСПРАВЛЕНИЕ: Минимальная высота для touch-целей
        borderRadius: DESIGN_TOKENS.radii.pill, // ✅ ИСПРАВЛЕНИЕ: Используем единый радиус
        backgroundColor: DESIGN_TOKENS.colors.primary, // ✅ ИСПРАВЛЕНИЕ: Используем единый primary цвет
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: DESIGN_TOKENS.colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 8,
        elevation: 8,
        // ✅ УЛУЧШЕНИЕ: Убрана граница, используется только тень
        ...Platform.select({
            web: {
                transition: 'all 0.2s ease',
                cursor: 'pointer',
                // @ts-ignore
                ':hover': {
                    backgroundColor: '#3a7a7a', // Темнее primary для hover
                    transform: 'scale(1.1)',
                },
            },
        }),
    },
    badge: {
        position: 'absolute',
        top: -4,
        right: -4,
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: DESIGN_TOKENS.colors.surface, // ✅ ИСПРАВЛЕНИЕ: Используем единый цвет
        justifyContent: 'center',
        alignItems: 'center',
        // ✅ УЛУЧШЕНИЕ: Убрана граница, используется только тень
        shadowColor: DESIGN_TOKENS.colors.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 2,
    },
});

