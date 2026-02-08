import React from 'react';
import { View, Text, Switch, StyleSheet, Platform } from 'react-native';
import { useThemedColors } from '@/hooks/useTheme';

interface CheckboxComponentProps {
    label: string;
    value: boolean;
    onChange: (value: boolean) => void;
}

const CheckboxComponent: React.FC<CheckboxComponentProps> = ({ label, value, onChange }) => {
    const themeColors = useThemedColors();
    return (
        <View style={styles.container}>
            <Text style={[styles.label, { color: themeColors.text }]} numberOfLines={1}>
                {label}
            </Text>
            <Switch
                value={value}
                onValueChange={onChange}
                thumbColor={Platform.OS === 'android' ? (value ? themeColors.primary : themeColors.surfaceLight) : undefined}
                trackColor={{ false: themeColors.border, true: themeColors.primaryLight }}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
    },
    label: {
        flex: 1,
        fontSize: 16,
        marginRight: 8,
    },
});

export default React.memo(CheckboxComponent);
