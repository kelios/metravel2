/**
 * MapOnboarding - контекстный тур для новых пользователей карты.
 *
 * Показывает tooltip рядом с конкретным UI-элементом (по testID / data-testid).
 * Шаги переключаются стрелками «Далее» / «Пропустить».
 * Состояние завершения хранится в localStorage / AsyncStorage.
 *
 * Экспортирует `restartMapOnboarding()` для повторного запуска из настроек.
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, Platform, Pressable } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import Feather from '@expo/vector-icons/Feather';
import type { ComponentProps } from 'react';
import Button from '@/components/ui/Button';

type FeatherIconName = ComponentProps<typeof Feather>['name'];

const ONBOARDING_STORAGE_KEY = 'metravel_map_onboarding_completed';

// --------------- restart support ---------------
let _restartCb: (() => void) | null = null;

/** Call from settings / menu to re-show the onboarding tour. */
export function restartMapOnboarding(): void {
  if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
    try { localStorage.removeItem(ONBOARDING_STORAGE_KEY); } catch { /* noop */ }
  }
  _restartCb?.();
}

// --------------- step definitions ---------------
type TooltipPosition = 'bottom' | 'top' | 'left' | 'right';

interface OnboardingStep {
  title: string;
  description: string;
  icon: FeatherIconName;
  /** data-testid of the target element (web) */
  targetTestID?: string;
  /** Preferred tooltip placement relative to target */
  placement: TooltipPosition;
}

const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    title: 'Карта путешествий',
    description: 'Здесь отображаются интересные места и маршруты от других путешественников. Перемещайте и масштабируйте карту.',
    icon: 'map',
    targetTestID: 'map-panel',
    placement: 'bottom',
  },
  {
    title: 'Настройте фильтры',
    description: 'Используйте фильтры по категориям и радиусу, чтобы найти подходящие места.',
    icon: 'filter',
    targetTestID: 'map-panel-tab-filters',
    placement: 'bottom',
  },
  {
    title: 'Список мест',
    description: 'Переключитесь на вкладку «Список», чтобы увидеть все найденные места с расстояниями.',
    icon: 'list',
    targetTestID: 'map-panel-tab-travels',
    placement: 'bottom',
  },
  {
    title: 'Стройте маршруты',
    description: 'Переключитесь в режим маршрута, чтобы проложить путь между точками на карте.',
    icon: 'navigation',
    targetTestID: 'filters-panel-header',
    placement: 'bottom',
  },
];

// --------------- helpers ---------------
interface Rect { top: number; left: number; width: number; height: number }

function getTargetRect(testID: string | undefined): Rect | null {
  if (Platform.OS !== 'web' || !testID || typeof document === 'undefined') return null;
  const el = document.querySelector(`[data-testid="${testID}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

function tooltipPosition(rect: Rect | null, placement: TooltipPosition): { top?: number; left?: number; bottom?: number; right?: number } {
  if (!rect) return {}; // fallback: centered via flexbox
  const GAP = 12;
  switch (placement) {
    case 'bottom':
      return { top: rect.top + rect.height + GAP, left: Math.max(8, Math.min(rect.left, (typeof window !== 'undefined' ? window.innerWidth : 800) - 320)) };
    case 'top':
      return { bottom: (typeof window !== 'undefined' ? window.innerHeight : 600) - rect.top + GAP, left: Math.max(8, rect.left) };
    case 'left':
      return { top: rect.top, right: (typeof window !== 'undefined' ? window.innerWidth : 800) - rect.left + GAP };
    case 'right':
      return { top: rect.top, left: rect.left + rect.width + GAP };
    default:
      return {};
  }
}

// --------------- component ---------------
interface MapOnboardingProps {
  onComplete?: () => void;
}

export const MapOnboarding: React.FC<MapOnboardingProps> = ({ onComplete }) => {
  const colors = useThemedColors();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [currentStep, setCurrentStep] = useState(0);
  const [visible, setVisible] = useState(false);
  const [targetRect, setTargetRect] = useState<Rect | null>(null);
  const rafRef = useRef(0);

  // Register restart callback
  useEffect(() => {
    _restartCb = () => { setCurrentStep(0); setVisible(true); };
    return () => { _restartCb = null; };
  }, []);

  // Check storage on mount
  useEffect(() => {
    (async () => {
      try {
        if (Platform.OS === 'web') {
          if (!localStorage.getItem(ONBOARDING_STORAGE_KEY)) {
            setTimeout(() => setVisible(true), 800);
          }
        } else {
          const v = await AsyncStorage.getItem(ONBOARDING_STORAGE_KEY);
          if (!v) setTimeout(() => setVisible(true), 800);
        }
      } catch { /* noop */ }
    })();
  }, []);

  // Measure target element when step changes
  useEffect(() => {
    if (!visible) return;
    const measure = () => {
      const step = ONBOARDING_STEPS[currentStep];
      setTargetRect(getTargetRect(step?.targetTestID));
    };
    // Delay to let DOM settle
    rafRef.current = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(rafRef.current);
  }, [visible, currentStep]);

  const handleComplete = useCallback(() => {
    try {
      if (Platform.OS === 'web') {
        localStorage.setItem(ONBOARDING_STORAGE_KEY, 'true');
      } else {
        void AsyncStorage.setItem(ONBOARDING_STORAGE_KEY, 'true');
      }
    } catch { /* noop */ }
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
  const pos = tooltipPosition(targetRect, step.placement);
  const hasTarget = targetRect !== null;

  return (
    <View style={[styles.overlay, { pointerEvents: 'box-none' }]}>
      {/* Semi-transparent backdrop */}
      <Pressable style={styles.backdrop} onPress={handleSkip} />

      {/* Spotlight cutout around target element */}
      {hasTarget && Platform.OS === 'web' && (
        <View
          style={[
            styles.spotlight,
            {
              top: targetRect!.top - 4,
              left: targetRect!.left - 4,
              width: targetRect!.width + 8,
              height: targetRect!.height + 8,
              pointerEvents: 'none',
            },
          ]}
        />
      )}

      {/* Tooltip card */}
      <View
        style={[
          styles.card,
          hasTarget ? { position: 'absolute', ...pos } as any : null,
        ]}
      >
        {/* Arrow indicator */}
        {hasTarget && step.placement === 'bottom' && (
          <View style={styles.arrowUp} />
        )}

        <View style={styles.cardHeader}>
          <View style={styles.iconCircle}>
            <Feather name={step.icon} size={20} color={colors.primary} />
          </View>
          <Text style={styles.title}>{step.title}</Text>
        </View>

        <Text style={styles.description}>{step.description}</Text>

        {/* Step dots + actions */}
        <View style={styles.footer}>
          <View style={styles.stepsIndicator}>
            {ONBOARDING_STEPS.map((_, index) => (
              <View
                key={index}
                style={[styles.stepDot, index === currentStep && styles.stepDotActive]}
              />
            ))}
          </View>

          <View style={styles.actions}>
            <Button
              label="Пропустить"
              onPress={handleSkip}
              variant="ghost"
              size="sm"
              testID="onboarding-skip"
            />
            <Button
              label={isLastStep ? 'Готово' : 'Далее'}
              onPress={handleNext}
              variant="primary"
              size="sm"
              testID="onboarding-next"
            />
          </View>
        </View>
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
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  spotlight: {
    position: 'absolute',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.primary,
    backgroundColor: 'transparent',
    zIndex: 10001,
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 0 0 9999px rgba(0,0,0,0.45)' } as any)
      : null),
  },
  arrowUp: {
    position: 'absolute',
    top: -8,
    left: 24,
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderBottomWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: colors.surface,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: DESIGN_TOKENS.radii.lg,
    padding: 16,
    maxWidth: 340,
    width: '90%',
    zIndex: 10002,
    ...(Platform.OS === 'web'
      ? ({ boxShadow: colors.boxShadows.heavy } as any)
      : { ...colors.shadows.heavy, elevation: 8 }),
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    flex: 1,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
    marginBottom: 12,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepsIndicator: {
    flexDirection: 'row',
    gap: 4,
  },
  stepDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.border,
  },
  stepDotActive: {
    backgroundColor: colors.primary,
    width: 16,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
});

export default React.memo(MapOnboarding);
