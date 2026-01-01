import React, { useState, useMemo } from 'react';
import { View, StyleSheet, Pressable, Text, ActivityIndicator, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useResponsive } from '@/hooks/useResponsive';
import { useThemedColors } from '@/hooks/useTheme';

type ToggleableMapSectionProps = {
    children: React.ReactNode;
    initiallyOpen?: boolean;
    isLoading?: boolean;
    loadingLabel?: string;
    keepMounted?: boolean;
};

const ToggleableMapSection = ({
    children,
    initiallyOpen = true,
    isLoading = false,
    loadingLabel = 'Загружаем карту...',
    keepMounted = false,
}: ToggleableMapSectionProps) => {
    const [showMap, setShowMap] = useState(initiallyOpen);
    const [hasOpened, setHasOpened] = useState(initiallyOpen);
    const { isPhone } = useResponsive();
    const colors = useThemedColors();
    const isMobile = isPhone;

    // ✅ УЛУЧШЕНИЕ: Мемоизация стилей с динамическими цветами
    const styles = useMemo(() => createStyles(colors), [colors]);

    const hintText = useMemo(
        () => (showMap && isLoading ? loadingLabel : showMap ? 'Скрыть карту' : 'Показать карту'),
        [isLoading, loadingLabel, showMap],
    );

    const shouldRenderContainer = showMap || (keepMounted && hasOpened);

    const handleToggle = () => {
        setShowMap((prev) => {
            const next = !prev;
            if (next && !hasOpened) {
                setHasOpened(true);
            }
            return next;
        });
    };

    return (
        <View style={styles.wrapper}>
            <Pressable
                onPress={handleToggle}
                style={({ pressed }) => [
                    styles.toggleButton,
                    pressed && styles.toggleButtonPressed,
                ]}
            >
                <Feather name="map-pin" size={18} color={colors.text} style={{ marginRight: DESIGN_TOKENS.spacing.xs }} />
                <Text style={[styles.toggleText, isMobile && styles.toggleTextMobile]}>
                    {hintText}
                </Text>
                <Feather name={showMap ? 'chevron-up' : 'chevron-down'} size={18} color={colors.text} />
            </Pressable>

            {shouldRenderContainer && (
                <View
                    style={[
                        styles.mapContainer,
                        isMobile && styles.mapContainerMobile,
                        !showMap && keepMounted ? { height: 0, minHeight: 0, marginTop: 0 } : null,
                    ]}
                >
                    {showMap ? (
                        isLoading ? (
                            <View style={styles.loadingState}>
                                {Platform.OS === 'web' ? (
                                    <View style={styles.loadingSkeleton} />
                                ) : (
                                    <ActivityIndicator color={colors.primary} />
                                )}
                                <Text style={styles.loadingText}>{loadingLabel}</Text>
                            </View>
                        ) : (
                            children
                        )
                    ) : (
                        children
                    )}
                </View>
            )}
        </View>
    );
};

export default ToggleableMapSection;

// ✅ УЛУЧШЕНИЕ: Функция создания стилей с динамическими цветами для поддержки тем
const createStyles = (colors: ReturnType<typeof useThemedColors>) => StyleSheet.create({
    wrapper: {
        width: '100%',
    },
    toggleButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        paddingHorizontal: DESIGN_TOKENS.spacing.lg,
        borderRadius: 16,
        gap: DESIGN_TOKENS.spacing.sm,
        backgroundColor: colors.surface,
        ...Platform.select({
          web: {
            boxShadow: DESIGN_TOKENS.shadows.light,
          },
          ios: {
            ...DESIGN_TOKENS.shadowsNative.light,
          },
          android: {
            elevation: 2,
          },
        }),
    },
    toggleButtonPressed: {
        backgroundColor: colors.surfaceLight,
    },
    toggleText: {
        fontSize: DESIGN_TOKENS.typography.sizes.md,
        fontWeight: '600',
        color: colors.text,
    },
    toggleTextMobile: {
        fontSize: DESIGN_TOKENS.typography.sizes.sm,
    },
    mapContainer: {
        marginTop: DESIGN_TOKENS.spacing.lg,
        width: '100%',
        minHeight: 400,
        borderRadius: 16,
        overflow: 'hidden',
        backgroundColor: colors.surface,
        ...Platform.select({
          web: {
            boxShadow: DESIGN_TOKENS.shadows.light,
          },
          ios: {
            ...DESIGN_TOKENS.shadowsNative.light,
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
        color: colors.textMuted,
    },
    loadingSkeleton: {
        width: 52,
        height: 52,
        borderRadius: 14,
        borderWidth: 1,
        backgroundColor: colors.surfaceLight,
        borderColor: colors.border,
    },
});
