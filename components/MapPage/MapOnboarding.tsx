/**
 * MapOnboarding - интерактивный тур для новых пользователей карты
 * Показывается один раз при первом визите на /map
 */

import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Platform, Pressable } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import Feather from '@expo/vector-icons/Feather';
import Button from '@/components/ui/Button';

const ONBOARDING_STORAGE_KEY = 'metravel_map_onboarding_completed';

interface OnboardingStep {
  title: string;
  description: string;
  icon: string;
}

const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    title: 'Места для путешествий',
    description: 'Здесь отображаются интересные места и маршруты от других путешественников',
    icon: 'map',
  },
  {
    title: 'Настройте поиск',
    description: 'Используйте фильтры, чтобы найти подходящие места по категориям и радиусу',
    icon: 'filter',
  },
  {
    title: 'Стройте маршруты',
    description: 'Переключитесь в режим маршрута, чтобы проложить путь между точками',
    icon: 'navigation',
  },
];

interface MapOnboardingProps {
  /** Callback при завершении onboarding */
  onComplete?: () => void;
}

export const MapOnboarding: React.FC<MapOnboardingProps> = ({ onComplete }) => {
  const colors = useThemedColors();
  const styles = getStyles(colors);
  const [currentStep, setCurrentStep] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    checkOnboardingStatus();
  }, []);

  const checkOnboardingStatus = async () => {
    try {
      if (Platform.OS === 'web') {
        const completed = localStorage.getItem(ONBOARDING_STORAGE_KEY);
        if (!completed) {
          setTimeout(() => setVisible(true), 500);
        }
      } else {
        const completed = await AsyncStorage.getItem(ONBOARDING_STORAGE_KEY);
        if (!completed) {
          setTimeout(() => setVisible(true), 500);
        }
      }
    } catch {
      // Игнорируем ошибки storage
    }
  };

  const handleComplete = useCallback(() => {
    try {
      if (Platform.OS === 'web') {
        localStorage.setItem(ONBOARDING_STORAGE_KEY, 'true');
      } else {
        void AsyncStorage.setItem(ONBOARDING_STORAGE_KEY, 'true');
      }
    } catch {
      // Игнорируем ошибки storage
    }
    setVisible(false);
    onComplete?.();
  }, [onComplete]);

  const handleNext = useCallback(() => {
    if (currentStep < ONBOARDING_STEPS.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      handleComplete();
    }
  }, [currentStep, handleComplete]);

  const handleSkip = useCallback(() => {
    handleComplete();
  }, [handleComplete]);

  if (!visible) return null;

  const step = ONBOARDING_STEPS[currentStep];
  const isLastStep = currentStep === ONBOARDING_STEPS.length - 1;

  return (
    <View style={styles.overlay}>
      <Pressable style={styles.backdrop} onPress={handleSkip} />

      <View style={styles.card}>
        {/* Иконка */}
        <View style={styles.iconContainer}>
          <View style={styles.iconCircle}>
            <Feather name={step.icon as any} size={32} color={colors.primary} />
          </View>
        </View>

        {/* Контент */}
        <Text style={styles.title}>{step.title}</Text>
        <Text style={styles.description}>{step.description}</Text>

        {/* Индикаторы шагов */}
        <View style={styles.stepsIndicator}>
          {ONBOARDING_STEPS.map((_, index) => (
            <View
              key={index}
              style={[
                styles.stepDot,
                index === currentStep && styles.stepDotActive,
              ]}
            />
          ))}
        </View>

        {/* Кнопки */}
        <View style={styles.actions}>
          <Button
            label="Пропустить"
            onPress={handleSkip}
            variant="ghost"
            size="md"
            style={styles.skipButton}
          />
          <Button
            label={isLastStep ? 'Начать' : 'Далее'}
            onPress={handleNext}
            variant="primary"
            size="md"
            style={styles.nextButton}
          />
        </View>

        {/* Прогресс */}
        <Text style={styles.progress}>
          {currentStep + 1} из {ONBOARDING_STEPS.length}
        </Text>
      </View>
    </View>
  );
};

const getStyles = (colors: ThemedColors) => StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10000,
    justifyContent: 'center',
    alignItems: 'center',
    padding: DESIGN_TOKENS.spacing.lg,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: DESIGN_TOKENS.radii.xl,
    padding: DESIGN_TOKENS.spacing.xl,
    maxWidth: 400,
    width: '100%',
    alignItems: 'center',
    ...(Platform.OS === 'web'
      ? ({ boxShadow: colors.boxShadows.heavy } as any)
      : {
          ...colors.shadows.heavy,
          elevation: 8,
        }),
  },
  iconContainer: {
    marginBottom: DESIGN_TOKENS.spacing.lg,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginBottom: DESIGN_TOKENS.spacing.sm,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    color: colors.textMuted,
    marginBottom: DESIGN_TOKENS.spacing.lg,
    textAlign: 'center',
  },
  stepsIndicator: {
    flexDirection: 'row',
    gap: DESIGN_TOKENS.spacing.sm,
    marginBottom: DESIGN_TOKENS.spacing.lg,
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
  },
  stepDotActive: {
    backgroundColor: colors.primary,
    width: 24,
  },
  actions: {
    flexDirection: 'row',
    gap: DESIGN_TOKENS.spacing.md,
    width: '100%',
    marginBottom: DESIGN_TOKENS.spacing.sm,
  },
  skipButton: {
    flex: 1,
  },
  nextButton: {
    flex: 1,
  },
  progress: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
  },
});

export default MapOnboarding;

