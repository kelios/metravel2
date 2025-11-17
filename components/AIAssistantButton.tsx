import React, { useState } from 'react';
import { 
    View, 
    TouchableOpacity, 
    StyleSheet, 
    Platform,
    Animated,
    useWindowDimensions,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

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
            <TouchableOpacity
                style={styles.button}
                onPress={handlePress}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Открыть AI-помощника"
            >
                <MaterialIcons name="smart-toy" size={24} color="#fff" />
                {!isMobile && (
                    <View style={styles.badge}>
                        <MaterialIcons name="auto-awesome" size={12} color="#6b8e7f" />
                    </View>
                )}
            </TouchableOpacity>
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
        borderRadius: 28,
        backgroundColor: '#6b8e7f',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#6b8e7f',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 8,
        elevation: 8,
        borderWidth: 3,
        borderColor: '#ffffff',
    },
    badge: {
        position: 'absolute',
        top: -4,
        right: -4,
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: '#ffffff',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#6b8e7f',
    },
});

