import { useEffect, useMemo, useRef } from 'react';
import { Animated, Platform } from 'react-native';

/**
 * ✅ ФАЗА 2: Анимации переходов между шагами
 * Hook для управления анимациями при переходе между шагами визарда
 */

export interface StepTransitionConfig {
  duration?: number;
  useNativeDriver?: boolean;
  fadeIn?: boolean;
  slideIn?: boolean;
}

const DEFAULT_CONFIG: StepTransitionConfig = {
  duration: 300,
  useNativeDriver: Platform.OS !== 'web',
  fadeIn: true,
  slideIn: true,
};

/**
 * Hook для анимации появления шага
 */
export function useStepTransition(config: StepTransitionConfig = {}) {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    const animations: Animated.CompositeAnimation[] = [];

    if (mergedConfig.fadeIn) {
      animations.push(
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: mergedConfig.duration!,
          useNativeDriver: mergedConfig.useNativeDriver!,
        })
      );
    }

    if (mergedConfig.slideIn) {
      animations.push(
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: mergedConfig.duration!,
          useNativeDriver: mergedConfig.useNativeDriver!,
        })
      );
    }

    if (animations.length > 0) {
      Animated.parallel(animations).start();
    }

    return () => {
      // Cleanup если нужно
    };
  }, [fadeAnim, slideAnim, mergedConfig.duration, mergedConfig.fadeIn, mergedConfig.slideIn, mergedConfig.useNativeDriver]);

  return {
    fadeAnim,
    slideAnim,
    animatedStyle: {
      opacity: mergedConfig.fadeIn ? fadeAnim : 1,
      transform: mergedConfig.slideIn
        ? [{ translateY: slideAnim }]
        : undefined,
    },
  };
}

/**
 * Hook для анимации при смене шага
 * Используется для fade out → fade in эффекта
 */
export function useStepChangeTransition(currentStep: number, config: StepTransitionConfig = {}) {
  const mergedConfig = useMemo(() => ({ ...DEFAULT_CONFIG, ...config }), [config]);

  const fadeAnim = useRef(new Animated.Value(1)).current;
  const prevStepRef = useRef(currentStep);

  useEffect(() => {
    if (prevStepRef.current !== currentStep) {
      // Fade out → Fade in
      Animated.sequence([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: mergedConfig.duration! / 2,
          useNativeDriver: mergedConfig.useNativeDriver!,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: mergedConfig.duration! / 2,
          useNativeDriver: mergedConfig.useNativeDriver!,
        }),
      ]).start();

      prevStepRef.current = currentStep;
    }
  }, [currentStep, fadeAnim, mergedConfig]);

  return {
    fadeAnim,
    animatedStyle: {
      opacity: fadeAnim,
    },
  };
}

/**
 * Hook для анимации прогресс-бара
 */
export function useProgressBarAnimation(progress: number, config: StepTransitionConfig = {}) {
  const mergedConfig = useMemo(() => ({ ...DEFAULT_CONFIG, ...config }), [config]);
  const progressAnim = useRef(new Animated.Value(progress)).current;

  useEffect(() => {
    Animated.spring(progressAnim, {
      toValue: progress,
      friction: 8,
      tension: 40,
      useNativeDriver: false, // width не поддерживается с native driver
    }).start();
  }, [progress, progressAnim, mergedConfig]);

  return {
    progressAnim,
  };
}

/**
 * Hook для анимации милестонов
 */
export function useMilestoneAnimation(isActive: boolean, isPassed: boolean, config: StepTransitionConfig = {}) {
  const mergedConfig = useMemo(() => ({ ...DEFAULT_CONFIG, duration: 200, ...config }), [config]);

  const scaleAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(isPassed ? 1 : 0.5)).current;

  useEffect(() => {
    if (isActive) {
      Animated.spring(scaleAnim, {
        toValue: 1.2,
        friction: 3,
        tension: 100,
        useNativeDriver: mergedConfig.useNativeDriver!,
      }).start();
    } else {
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 3,
        tension: 100,
        useNativeDriver: mergedConfig.useNativeDriver!,
      }).start();
    }

    Animated.timing(opacityAnim, {
      toValue: isPassed || isActive ? 1 : 0.5,
      duration: mergedConfig.duration!,
      useNativeDriver: mergedConfig.useNativeDriver!,
    }).start();
  }, [isActive, isPassed, scaleAnim, opacityAnim, mergedConfig]);

  return {
    scaleAnim,
    opacityAnim,
    animatedStyle: {
      transform: [{ scale: scaleAnim }],
      opacity: opacityAnim,
    },
  };
}

/**
 * Hook для анимации появления контекстных подсказок
 */
export function useTipAnimation(visible: boolean, delay: number = 0, config: StepTransitionConfig = {}) {
  const mergedConfig = useMemo(() => ({ ...DEFAULT_CONFIG, duration: 250, ...config }), [config]);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(-10)).current;

  useEffect(() => {
    if (visible) {
      setTimeout(() => {
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: mergedConfig.duration!,
            useNativeDriver: mergedConfig.useNativeDriver!,
          }),
          Animated.timing(slideAnim, {
            toValue: 0,
            duration: mergedConfig.duration!,
            useNativeDriver: mergedConfig.useNativeDriver!,
          }),
        ]).start();
      }, delay);
    } else {
      fadeAnim.setValue(0);
      slideAnim.setValue(-10);
    }
  }, [visible, delay, fadeAnim, slideAnim, mergedConfig.duration, mergedConfig.useNativeDriver]);

  return {
    fadeAnim,
    slideAnim,
    animatedStyle: {
      opacity: fadeAnim,
      transform: [{ translateY: slideAnim }],
    },
  };
}

/**
 * Hook для анимации кнопок при наведении (web)
 */
export function useButtonHoverAnimation() {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const shouldUseNativeDriver = Platform.OS !== 'web';

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.95,
      friction: 3,
      tension: 100,
      useNativeDriver: shouldUseNativeDriver,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 3,
      tension: 100,
      useNativeDriver: shouldUseNativeDriver,
    }).start();
  };

  return {
    scaleAnim,
    animatedStyle: {
      transform: [{ scale: scaleAnim }],
    },
    handlePressIn,
    handlePressOut,
  };
}

/**
 * Утилита для создания staggered анимации (каскадное появление элементов)
 */
export function createStaggeredAnimation(
  items: any[],
  baseDelay: number = 0,
  itemDelay: number = 100
): number[] {
  return items.map((_, index) => baseDelay + index * itemDelay);
}

