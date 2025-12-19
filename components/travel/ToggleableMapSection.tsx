import React, { useState, useMemo } from 'react';
import { View, StyleSheet, Pressable, Text, ActivityIndicator, Platform } from 'react-native';
import ChevronDown from 'lucide-react-native/dist/esm/icons/chevron-down';
import ChevronUp from 'lucide-react-native/dist/esm/icons/chevron-up';
import MapPinned from 'lucide-react-native/dist/esm/icons/map-pinned';
import { Feather } from '@expo/vector-icons';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useResponsive } from '@/hooks/useResponsive';

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
    const { isPhone } = useResponsive();
    const isMobile = isPhone;
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
                {Platform.OS === 'web' ? (
                  <Feather name="map-pin" size={18} color="#3B2C24" style={{ marginRight: DESIGN_TOKENS.spacing.xs }} />
                ) : (
                  <MapPinned size={18} color="#3B2C24" style={{ marginRight: DESIGN_TOKENS.spacing.xs }} />
                )}
                <Text style={[styles.toggleText, isMobile && styles.toggleTextMobile]}>
                    {hintText}
                </Text>
                {Platform.OS === 'web' ? (
                  <Feather name={showMap ? 'chevron-up' : 'chevron-down'} size={18} color="#3B2C24" />
                ) : showMap ? (
                  <ChevronUp size={18} color="#3B2C24" />
                ) : (
                  <ChevronDown size={18} color="#3B2C24" />
                )}
            </Pressable>

            {showMap && (
                <View style={[styles.mapContainer, isMobile && styles.mapContainerMobile]}>
                    {isLoading ? (
                        <View style={styles.loadingState}>
                            {Platform.OS === 'web' ? <View style={styles.loadingSkeleton} /> : <ActivityIndicator color="#ff9f5a" />}
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
        paddingHorizontal: DESIGN_TOKENS.spacing.lg,
        backgroundColor: '#fff',
        borderRadius: 16,
        gap: DESIGN_TOKENS.spacing.sm,
        ...Platform.select({
          web: {
            boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
          },
          ios: {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.05,
            shadowRadius: 4,
          },
          android: {
            elevation: 2,
          },
        }),
    },
    toggleButtonPressed: {
        backgroundColor: '#f0f0f0',
    },
    toggleText: {
        fontSize: DESIGN_TOKENS.typography.sizes.md,
        fontWeight: '600',
        color: '#3B2C24',
    },
    toggleTextMobile: {
        fontSize: DESIGN_TOKENS.typography.sizes.sm,
    },
    mapContainer: {
        marginTop: DESIGN_TOKENS.spacing.lg,
        width: '100%',
        minHeight: 400,
        borderRadius: 16,
        backgroundColor: '#fff',
        overflow: 'hidden',
        ...Platform.select({
          web: {
            boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
          },
          ios: {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.05,
            shadowRadius: 4,
          },
          android: {
            elevation: 2,
          },
        }),
    },
    mapContainerMobile: {
        minHeight: 300,
        borderRadius: 0,
    },
    loadingState: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: DESIGN_TOKENS.spacing.md,
    },
    loadingText: {
        fontSize: DESIGN_TOKENS.typography.sizes.sm,
        color: '#475569',
    },
    loadingSkeleton: {
        width: 52,
        height: 52,
        borderRadius: 14,
        backgroundColor: '#f1f5f9',
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
});
