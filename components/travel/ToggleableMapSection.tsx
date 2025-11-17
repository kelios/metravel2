import React, { useState, useMemo } from 'react';
import { View, StyleSheet, Pressable, Text, useWindowDimensions, ActivityIndicator } from 'react-native';
import { ChevronDown, ChevronUp, MapPinned } from 'lucide-react-native';

type ToggleableMapSectionProps = {
    children: React.ReactNode;
    initiallyOpen?: boolean;
    isLoading?: boolean;
    loadingLabel?: string;
};

const ToggleableMapSection = ({
    children,
    initiallyOpen = true,
    isLoading = false,
    loadingLabel = 'Загружаем карту...',
}: ToggleableMapSectionProps) => {
    const [showMap, setShowMap] = useState(initiallyOpen);
    const { width } = useWindowDimensions();
    const isMobile = width <= 480;
    const hintText = useMemo(
        () => (showMap && isLoading ? loadingLabel : showMap ? 'Скрыть карту' : 'Показать карту'),
        [isLoading, loadingLabel, showMap],
    );

    return (
        <View style={styles.wrapper}>
            <Pressable
                onPress={() => setShowMap((prev) => !prev)}
                style={({ pressed }) => [
                    styles.toggleButton,
                    pressed && styles.toggleButtonPressed,
                ]}
            >
                <MapPinned size={18} color="#3B2C24" style={{ marginRight: 6 }} />
                <Text style={[styles.toggleText, isMobile && styles.toggleTextMobile]}>
                    {hintText}
                </Text>
                {showMap ? (
                    <ChevronUp size={18} color="#3B2C24" />
                ) : (
                    <ChevronDown size={18} color="#3B2C24" />
                )}
            </Pressable>

            {showMap && (
                <View style={[styles.mapContainer, isMobile && styles.mapContainerMobile]}>
                    {isLoading ? (
                        <View style={styles.loadingState}>
                            <ActivityIndicator color="#ff9f5a" />
                            <Text style={styles.loadingText}>{loadingLabel}</Text>
                        </View>
                    ) : (
                        children
                    )}
                </View>
            )}
        </View>
    );
};

export default ToggleableMapSection;

const styles = StyleSheet.create({
    wrapper: {
        width: '100%',
    },
    toggleButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        backgroundColor: '#fff',
        borderRadius: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
        gap: 8,
    },
    toggleButtonPressed: {
        backgroundColor: '#f0f0f0',
    },
    toggleText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#3B2C24',
    },
    toggleTextMobile: {
        fontSize: 14,
    },
    mapContainer: {
        marginTop: 16,
        width: '100%',
        minHeight: 400,
        borderRadius: 16,
        backgroundColor: '#fff',
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    mapContainerMobile: {
        minHeight: 300,
        borderRadius: 0,
    },
    loadingState: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
    },
    loadingText: {
        fontSize: 14,
        color: '#475569',
    },
});
