import React, { useState, useMemo, useEffect, useRef } from 'react';
import { View, StyleSheet, Pressable, Text, ActivityIndicator, Platform, useWindowDimensions } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { METRICS } from '@/constants/layout';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';

type ToggleableMapSectionProps = {
    children: React.ReactNode;
    // TD-04: По умолчанию закрыто — карта монтируется только после первого открытия
    initiallyOpen?: boolean;
    isLoading?: boolean;
    loadingLabel?: string;
    keepMounted?: boolean;
    forceOpenTrigger?: number;
    onOpenChange?: (open: boolean) => void;
};

const ToggleableMapSection = ({
    children,
    initiallyOpen = false,
    isLoading = false,
    loadingLabel = 'Загружаем карту...',
    keepMounted = false,
    forceOpenTrigger,
    onOpenChange,
}: ToggleableMapSectionProps) => {
    const [showMap, setShowMap] = useState(initiallyOpen);
    const [hasOpened, setHasOpened] = useState(initiallyOpen);
    const { width } = useWindowDimensions();
    const isMobile = width < METRICS.breakpoints.tablet;
    const isDesktop = width >= METRICS.breakpoints.desktop;
    const colors = useThemedColors();
    // TD-04: ref для Intersection Observer (web desktop — авто-открытие при прокрутке до карты)
    const wrapperRef = useRef<View>(null);

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
            onOpenChange?.(next);
            return next;
        });
    };

    useEffect(() => {
        if (forceOpenTrigger === undefined) return;
        setShowMap(true);
        setHasOpened(true);
    }, [forceOpenTrigger]);

    // TD-04: IntersectionObserver — на desktop карта авто-монтируется когда доходит до viewport
    useEffect(() => {
        if (Platform.OS !== 'web') return;
        if (!isDesktop) return; // на мобайле только по клику
        if (hasOpened) return; // уже открыта — не нужно
        if (typeof IntersectionObserver === 'undefined') return;

        const node = (wrapperRef.current as any)?._nativeTag
            ? null // native — не используем
            : (wrapperRef.current as unknown as Element | null);

        if (!node) return;

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0]?.isIntersecting) {
                    setShowMap(true);
                    setHasOpened(true);
                    observer.disconnect();
                }
            },
            { rootMargin: '200px', threshold: 0 }
        );
        observer.observe(node);
        return () => observer.disconnect();
    }, [isDesktop, hasOpened]);

    return (
        <View ref={wrapperRef} style={styles.wrapper}>
            <Pressable
                onPress={handleToggle}
                style={({ pressed }) => [
                    styles.toggleButton,
                    pressed && styles.toggleButtonPressed,
                ]}
            >
                <Feather name="map-pin" size={18} color={colors.text} />
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
                        !showMap && keepMounted ? { height: 0, minHeight: 0, marginTop: 0, opacity: 0 } : null,
                    ]}
                    {...(Platform.OS === 'web' ? { 'data-map-visible': showMap ? 'true' : 'false' } : {})}
                >
                    {showMap ? (
                        isLoading ? (
                            <View style={styles.loadingState}>
                                {Platform.OS === 'web' ? (
                                    <View style={styles.loadingSkeleton}>
                                        <Feather name="map" size={24} color={colors.textMuted} />
                                    </View>
                                ) : (
                                    <ActivityIndicator color={colors.primary} />
                                )}
                            </View>
                        ) : (
                            children
                        )
                    ) : (
                        keepMounted ? children : null
                    )}
                </View>
            )}
        </View>
    );
};

export default React.memo(ToggleableMapSection);

// ✅ УЛУЧШЕНИЕ: Функция создания стилей с динамическими цветами для поддержки тем
const createStyles = (colors: ReturnType<typeof useThemedColors>) => StyleSheet.create({
    wrapper: {
        width: '100%',
    },
    toggleButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        paddingHorizontal: DESIGN_TOKENS.spacing.lg,
        borderRadius: DESIGN_TOKENS.radii.md,
        gap: DESIGN_TOKENS.spacing.sm,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.borderLight,
        ...Platform.select({
          web: {
            cursor: 'pointer' as any,
            transition: 'background-color 0.2s ease, border-color 0.2s ease' as any,
            ':hover': {
              backgroundColor: colors.backgroundSecondary,
              borderColor: colors.border,
            } as any,
          },
        }),
    },
    toggleButtonPressed: {
        backgroundColor: colors.backgroundSecondary,
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
        marginTop: DESIGN_TOKENS.spacing.md,
        width: '100%',
        minHeight: 400,
        borderRadius: DESIGN_TOKENS.radii.md,
        overflow: Platform.OS === 'web' ? 'visible' : 'hidden',
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.borderLight,
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
        alignItems: 'center',
        justifyContent: 'center',
    },
});
