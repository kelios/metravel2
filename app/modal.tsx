import { useMemo } from 'react';
import { Platform, StatusBar, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import EditScreenInfo from '@/components/EditScreenInfo';
import { Text, View } from '@/components/Themed';
import { useThemedColors } from '@/hooks/useTheme';

export default function ModalScreen() {
    // Хук useNavigation вызывается на верхнем уровне компонента
    const navigation = useNavigation();
    const colors = useThemedColors();
    const styles = useMemo(() => createStyles(colors), [colors]);

    return (
        <View style={styles.container}>
            <TouchableOpacity style={styles.closeButton} onPress={() => navigation.goBack()}>
                <Text style={styles.closeButtonText}>Закрыть</Text>
            </TouchableOpacity>

            <Text style={styles.title}>О сайте</Text>
            <View style={styles.separator} />

            <EditScreenInfo path="app/modal.tsx" />

            <StatusBar barStyle={Platform.OS === 'ios' ? 'light-content' : 'default'} />
        </View>
    );
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) => StyleSheet.create({
    container: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 20,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: colors.text,
        marginVertical: 20,
    },
    separator: {
        marginVertical: 30,
        height: 1,
        width: '80%',
        backgroundColor: colors.border,
    },
    closeButton: {
        position: 'absolute',
        top: 40,
        right: 20,
        backgroundColor: colors.primary,
        padding: 10,
        borderRadius: 5,
    },
    closeButtonText: {
        color: colors.textOnPrimary,
        fontSize: 16,
    },
});
