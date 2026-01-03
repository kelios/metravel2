import { useState, useCallback, useRef, useMemo } from 'react';
import { Animated, Easing, useWindowDimensions } from 'react-native';

const PANEL_ANIMATION_DURATION = 250;

/**
 * Хук для управления боковой панелью с анимацией.
 * @param isMobile - флаг мобильного устройства (для разных стилей анимации)
 */
export function usePanelController(isMobile: boolean = false) {
    const { width: windowWidth, height: windowHeight } = useWindowDimensions();
    const [isPanelVisible, setPanelVisible] = useState(!isMobile);
    const panelAnimation = useRef(new Animated.Value(isMobile ? 0 : 1)).current;

    const openPanel = useCallback(() => {
        setPanelVisible(true);
        Animated.timing(panelAnimation, {
            toValue: 1,
            duration: PANEL_ANIMATION_DURATION,
            easing: Easing.out(Easing.exp),
            useNativeDriver: true,
        }).start();
    }, [panelAnimation]);

    const closePanel = useCallback(() => {
        Animated.timing(panelAnimation, {
            toValue: 0,
            duration: PANEL_ANIMATION_DURATION,
            easing: Easing.in(Easing.exp),
            useNativeDriver: true,
        }).start(() => setPanelVisible(false));
    }, [panelAnimation]);

    const panelStyle = useMemo(() => ({
        transform: [
            {
                translateX: panelAnimation.interpolate({
                    inputRange: [0, 1],
                    outputRange: [isMobile ? windowWidth : 16, 0],
                }),
            },
        ],
        opacity: panelAnimation.interpolate({
            inputRange: [0, 1],
            outputRange: [0, 1],
        }),
    }), [panelAnimation, isMobile, windowWidth]);

    const overlayStyle = useMemo(() => ({
        opacity: panelAnimation,
    }), [panelAnimation]);

    return {
        isPanelVisible,
        openPanel,
        closePanel,
        panelStyle,
        overlayStyle,
    };
}
