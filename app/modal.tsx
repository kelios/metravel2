import React from 'react';
import { Platform, StatusBar, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import EditScreenInfo from '@/components/EditScreenInfo';
import { Text, View } from '@/components/Themed';
import { DESIGN_TOKENS } from '@/constants/designSystem';

export default function ModalScreen() {
    // Хук useNavigation вызывается на верхнем уровне компонента
    const navigation = useNavigation();

    return (
        <View style={styles.container}>
            <TouchableOpacity style={styles.closeButton} onPress={() => navigation.goBack()}>
                <Text style={styles.closeButtonText}>Закрыть</Text>
            </TouchableOpacity>

            <Text style={styles.title}>О сайте</Text>
            <View
              style={styles.separator}
              lightColor={DESIGN_TOKENS.colors.borderLight}
              darkColor={DESIGN_TOKENS.colors.borderStrong}
            />

            <EditScreenInfo path="app/modal.tsx" />

            <StatusBar barStyle={Platform.OS === 'ios' ? 'light-content' : 'default'} />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 20,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        marginVertical: 20,
    },
    separator: {
        marginVertical: 30,
        height: 1,
        width: '80%',
    },
    closeButton: {
        position: 'absolute',
        top: 40,
        right: 20,
        backgroundColor: DESIGN_TOKENS.colors.primary,
        padding: 10,
        borderRadius: 5,
    },
    closeButtonText: {
        color: DESIGN_TOKENS.colors.textOnPrimary,
        fontSize: 16,
    },
});
