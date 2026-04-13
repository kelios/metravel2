import { useState, useCallback, useMemo } from 'react';
import { useWindowDimensions } from 'react-native';
import {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';

const PANEL_ANIMATION_DURATION = 250;

/**
 * Хук для управления боковой панелью с анимацией (Reanimated 4, UI-thread).
 * @param isMobile - флаг мобильного устройства (для разных стилей анимации)
 */
export function usePanelController(isMobile: boolean = false) {
    const { width: windowWidth } = useWindowDimensions();
    const [isPanelVisible, setPanelVisible] = useState(!isMobile);
    const progress = useSharedValue(isMobile ? 0 : 1);

    const openPanel = useCallback(() => {
        setPanelVisible(true);
        progress.value = withTiming(1, {
            duration: PANEL_ANIMATION_DURATION,
            easing: Easing.out(Easing.exp),
        });
    }, [progress]);

    const closePanel = useCallback(() => {
        progress.value = withTiming(0, {
            duration: PANEL_ANIMATION_DURATION,
            easing: Easing.in(Easing.exp),
        });
        // Hide panel after animation completes
        setTimeout(() => setPanelVisible(false), PANEL_ANIMATION_DURATION);
    }, [progress]);

    const closedTranslateX = isMobile ? windowWidth : 16;

    const panelStyle = useAnimatedStyle(() => ({
        transform: [
            { translateX: progress.value * (0 - closedTranslateX) + closedTranslateX },
        ],
        opacity: progress.value,
    }));

    const overlayStyle = useAnimatedStyle(() => ({
        opacity: progress.value,
    }));

    return useMemo(() => ({
        isPanelVisible,
        openPanel,
        closePanel,
        panelStyle,
        overlayStyle,
    }), [isPanelVisible, openPanel, closePanel, panelStyle, overlayStyle]);
}
