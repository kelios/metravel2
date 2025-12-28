import { useState, useCallback, useEffect, useRef } from 'react';
import { Platform, Alert, BackHandler } from 'react-native';
import { useRouter, useNavigation } from 'expo-router';
import Toast from 'react-native-toast-message';
import { trackWizardEvent } from '@/src/utils/analytics';
import type { ValidationError, ModerationIssue } from '@/utils/formValidation';

export interface StepMeta {
  id: number;
  title: string;
  subtitle: string;
  tipTitle: string;
  tipBody: string;
  nextLabel: string;
}

export const STEP_CONFIG: StepMeta[] = [
  {
    id: 1,
    title: 'Основная информация',
    subtitle: 'Название и описание путешествия',
    tipTitle: 'Совет',
    tipBody: 'Начните с названия и короткого описания. Остальные поля можно заполнить позже — они нужны только для модерации.',
    nextLabel: 'Далее: Маршрут (шаг 2 из 6)',
  },
  {
    id: 2,
    title: 'Маршрут на карте',
    subtitle: 'Добавьте ключевые точки и страны маршрута',
    tipTitle: 'Лайфхак',
    tipBody: '',
    nextLabel: 'К медиа (шаг 3 из 6)',
  },
  {
    id: 3,
    title: 'Медиа путешествия',
    subtitle: 'Добавьте обложку, фотографии и видео — это повышает доверие и конверсию',
    tipTitle: 'Подсказка',
    tipBody: 'Если есть выбор, начните с обложки: горизонтальный кадр без коллажей обычно смотрится лучше в списках.',
    nextLabel: 'К деталям (шаг 4 из 6)',
  },
  {
    id: 4,
    title: 'Детали и советы',
    subtitle: 'Плюсы/минусы, рекомендации и бюджет — чтобы маршрут был полезнее',
    tipTitle: 'Подсказка',
    tipBody: 'Короткие списки и конкретика работают лучше, чем общий текст. Пишите так, как советовали бы другу.',
    nextLabel: 'К доп. параметрам (шаг 5 из 6)',
  },
  {
    id: 5,
    title: 'Дополнительные параметры',
    subtitle: 'Транспорт, сложность, сезонность, виза и другие настройки',
    tipTitle: 'Подсказка',
    tipBody: 'Эти поля не обязательны для перехода по шагам, но помогают читателям лучше понять условия маршрута.',
    nextLabel: 'К публикации (шаг 6 из 6)',
  },
  {
    id: 6,
    title: 'Публикация путешествия',
    subtitle: 'Проверьте готовность и выберите статус — черновик или модерация',
    tipTitle: 'Подсказка',
    tipBody: 'Перед модерацией убедитесь, что есть описание, страны, минимум одна точка маршрута и обложка/фото.',
    nextLabel: 'Завершить',
  },
];

interface UseTravelWizardOptions {
  totalSteps?: number;
  hasUnsavedChanges: boolean;
  canSave: boolean;
  onSave: () => Promise<any>;
}

export function useTravelWizard(options: UseTravelWizardOptions) {
  const { totalSteps = 6, hasUnsavedChanges, canSave, onSave } = options;
  const router = useRouter();
  const navigation = useNavigation();

  const [currentStep, setCurrentStep] = useState(1);
  const [step1SubmitErrors, setStep1SubmitErrors] = useState<ValidationError[]>([]);
  const [focusAnchorId, setFocusAnchorId] = useState<string | null>(null);

  const pendingIssueNavRef = useRef<{ step: number; anchorId?: string } | null>(null);
  const exitGuardPromptVisibleRef = useRef(false);

  const handleStepSelect = useCallback(
    (step: number) => {
      if (step < 1 || step > totalSteps) return;
      trackWizardEvent('wizard_step_jump', { step_from: currentStep, step_to: step });
      setCurrentStep(step);
    },
    [currentStep, totalSteps]
  );

  const handleNext = useCallback(() => {
    if (currentStep < totalSteps) {
      trackWizardEvent('wizard_step_next', { step: currentStep });
      setCurrentStep(prev => prev + 1);
    }
  }, [currentStep, totalSteps]);

  const handleBack = useCallback(() => {
    if (currentStep > 1) {
      trackWizardEvent('wizard_step_back', { step: currentStep });
      setCurrentStep(prev => prev - 1);
    }
  }, [currentStep]);

  const handleNavigateToIssue = useCallback((issue: ModerationIssue) => {
    pendingIssueNavRef.current = { step: issue.targetStep, anchorId: issue.anchorId };
    setCurrentStep(issue.targetStep);
  }, []);

  const handleAnchorHandled = useCallback(() => {
    pendingIssueNavRef.current = null;
    setFocusAnchorId(null);
  }, []);

  useEffect(() => {
    const pending = pendingIssueNavRef.current;
    if (!pending) {
      if (focusAnchorId) setFocusAnchorId(null);
      return;
    }
    if (pending.step !== currentStep) return;

    const anchorId = pending.anchorId;
    setFocusAnchorId(anchorId ?? null);

    if (!anchorId) return;
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;

    setTimeout(() => {
      const el = document.getElementById(anchorId);
      if (el && typeof (el as any).scrollIntoView === 'function') {
        (el as any).scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      pendingIssueNavRef.current = null;
      setFocusAnchorId(null);
    }, 50);
  }, [currentStep, focusAnchorId]);

  useEffect(() => {
    trackWizardEvent('wizard_step_view', {
      step: currentStep,
    });
  }, [currentStep]);

  const confirmLeaveWizard = useCallback(
    async (onDiscard: () => void, onSavedAndLeave?: () => void) => {
      if (exitGuardPromptVisibleRef.current) return;
      exitGuardPromptVisibleRef.current = true;

      const reset = () => {
        exitGuardPromptVisibleRef.current = false;
      };

      if (!hasUnsavedChanges) {
        reset();
        onDiscard();
        return;
      }

      Alert.alert(
        'Есть несохранённые изменения',
        canSave
          ? 'Сохранить черновик перед выходом?'
          : 'Сейчас сохранить нельзя (нет интернета или идёт сохранение). Выйти без сохранения?',
        [
          {
            text: 'Остаться',
            style: 'cancel',
            onPress: reset,
          },
          ...(canSave
            ? [
                {
                  text: 'Сохранить и выйти',
                  onPress: async () => {
                    try {
                      await onSave();
                      reset();
                      onSavedAndLeave?.();
                    } catch (e: any) {
                      reset();
                      Toast.show({
                        type: 'error',
                        text1: 'Не удалось сохранить',
                        text2: e?.message || 'Попробуйте ещё раз',
                      });
                    }
                  },
                },
              ]
            : []),
          {
            text: 'Выйти без сохранения',
            style: 'destructive',
            onPress: () => {
              reset();
              onDiscard();
            },
          },
        ]
      );
    },
    [hasUnsavedChanges, canSave, onSave]
  );

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (typeof window === 'undefined') return;

    const handler = (e: BeforeUnloadEvent) => {
      if (!hasUnsavedChanges) return;
      e.preventDefault();
      e.returnValue = '';
    };

    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasUnsavedChanges]);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    if (!navigation?.addListener) return;

    const unsubscribe = navigation.addListener('beforeRemove', (e: any) => {
      if (!hasUnsavedChanges) return;
      e.preventDefault();

      void confirmLeaveWizard(
        () => navigation.dispatch(e.data.action),
        () => navigation.dispatch(e.data.action)
      );
    });

    return unsubscribe;
  }, [hasUnsavedChanges, confirmLeaveWizard, navigation]);

  useEffect(() => {
    if (Platform.OS === 'web') return;

    const onHardwareBack = () => {
      if (!hasUnsavedChanges) return false;
      void confirmLeaveWizard(
        () => router.back(),
        () => router.back()
      );
      return true;
    };

    const sub = BackHandler.addEventListener('hardwareBackPress', onHardwareBack);
    return () => sub.remove();
  }, [hasUnsavedChanges, confirmLeaveWizard, router]);

  const handleFinishWizard = useCallback(async () => {
    await onSave();
  }, [onSave]);

  return {
    currentStep,
    totalSteps,
    stepConfig: STEP_CONFIG,
    step1SubmitErrors,
    setStep1SubmitErrors,
    focusAnchorId,
    handleStepSelect,
    handleNext,
    handleBack,
    handleNavigateToIssue,
    handleAnchorHandled,
    handleFinishWizard,
    confirmLeaveWizard,
  };
}
