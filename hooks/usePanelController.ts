import { useState, useCallback, useRef } from 'react';
import { Animated, Easing, Platform, useWindowDimensions } from 'react-native';

const PANEL_ANIMATION_DURATION = 250;

export const usePanelController = () => {
    const { height: windowHeight } = useWindowDimensions();
    const [isPanelVisible, setPanelVisible] = useState(false);
    const panelAnimation = useRef(new Animated.Value(0)).current;

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

    const panelStyle = {
        transform: [
            {
                translateY: panelAnimation.interpolate({
                    inputRange: [0, 1],
                    outputRange: [windowHeight, 0],
                }),
            },
        ],
    };

    const overlayStyle = {
        opacity: panelAnimation,
    };

    return {
        isPanelVisible,
        openPanel,
        closePanel,
        panelStyle,
        overlayStyle,
    };
};

export {};
