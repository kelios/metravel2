import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { Platform, Alert, BackHandler } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter, useNavigation } from 'expo-router';
import { trackWizardEvent } from '@/utils/analytics';
import type { ValidationError, ModerationIssue } from '@/utils/formValidation';
import { validateStep } from '@/utils/travelWizardValidation';
import type { TravelFormData } from '@/types/types';
import { showToastMessage } from '@/utils/toast';
import { getErrorMessage } from '@/utils/errorHelpers';
import { useBeforeUnload } from '@/utils/beforeunloadGuard';

type WizardSaveResult = {
  publish?: boolean;
  moderation?: boolean;
} | null | undefined;

type BeforeRemoveEventLike = {
  preventDefault: () => void;
  data: {
    action: unknown;
  };
};

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
  onSave: () => Promise<WizardSaveResult>;
  getFormData?: () => TravelFormData | null | undefined;
  stepStorageKey?: string;
  stepStorageTtlMs?: number;
}

// Платформенный драйвер хранилища шага (web → localStorage, native → AsyncStorage).
const stepStorage = {
  async read(key: string): Promise<string | null> {
    if (Platform.OS === 'web') return localStorage.getItem(key);
    return AsyncStorage.getItem(key);
  },
  async write(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
      localStorage.setItem(key, value);
      return;
    }
    await AsyncStorage.setItem(key, value);
  },
  async remove(key: string): Promise<void> {
    if (Platform.OS === 'web') {
      localStorage.removeItem(key);
      return;
    }
    await AsyncStorage.removeItem(key);
  },
};

type ParsedStep = { step: number | null; expired: boolean };

// Чистый разбор сохранённого значения шага.
// Поддерживает JSON {step,timestamp} с TTL и legacy-формат (числовая строка).
function parseStoredStep(
  raw: string,
  normalize: (value: unknown) => number,
  ttlMs: number,
): ParsedStep {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { step: normalize(raw), expired: false };
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { step: normalize(raw), expired: false };
  }

  const obj = parsed as { step?: unknown; timestamp?: unknown };
  const ts = typeof obj.timestamp === 'number' ? obj.timestamp : Number(obj.timestamp);
  if (!Number.isFinite(ts) || Date.now() - ts > ttlMs) {
    return { step: null, expired: true };
  }

  return { step: obj.step != null ? normalize(obj.step) : null, expired: false };
}

export function useTravelWizard(options: UseTravelWizardOptions) {
  const {
    totalSteps = 6,
    hasUnsavedChanges,
    canSave,
    onSave,
    getFormData,
    stepStorageKey,
    stepStorageTtlMs = 7 * 24 * 60 * 60 * 1000,
  } = options;
  const router = useRouter();
  const navigation = useNavigation();

  const isTestEnv = typeof process !== 'undefined' && process.env?.NODE_ENV === 'test';
  const enableStepPersistenceInTests =
    !isTestEnv || process.env?.JEST_ENABLE_WIZARD_PERSISTENCE === '1';

  const [currentStep, setCurrentStep] = useState(1);
  const [step1SubmitErrors, setStep1SubmitErrors] = useState<ValidationError[]>([]);
  const [focusAnchorId, setFocusAnchorId] = useState<string | null>(null);

  const pendingIssueNavRef = useRef<{ step: number; anchorId?: string } | null>(null);
  const exitGuardPromptVisibleRef = useRef(false);
  const hasRestoredRef = useRef(false);
  const isLeavingRef = useRef(false);
  const getFormDataRef = useRef(getFormData);
  getFormDataRef.current = getFormData;

  const normalizeStep = useCallback(
    (value: unknown) => {
      const num = typeof value === 'number' ? value : Number(value);
      if (!Number.isFinite(num)) return 1;
      const clamped = Math.min(Math.max(1, num), totalSteps);
      return clamped;
    },
    [totalSteps]
  );

  const getStoredStep = useCallback(async (): Promise<number | null> => {
    if (!stepStorageKey) return null;
    try {
      const raw = await stepStorage.read(stepStorageKey);
      if (!raw) return null;

      const { step, expired } = parseStoredStep(raw, normalizeStep, stepStorageTtlMs);
      if (expired) {
        await stepStorage.remove(stepStorageKey);
        return null;
      }
      return step;
    } catch {
      return null;
    }
  }, [normalizeStep, stepStorageKey, stepStorageTtlMs]);

  const setStoredStep = useCallback(async (step: number) => {
    if (!stepStorageKey) return;
    const payload = JSON.stringify({
      step: normalizeStep(step),
      timestamp: Date.now(),
    });
    try {
      await stepStorage.write(stepStorageKey, payload);
    } catch {
      // storage might be unavailable
    }
  }, [normalizeStep, stepStorageKey]);

  const clearPersistedStep = useCallback(async () => {
    if (!stepStorageKey) return;
    try {
      await stepStorage.remove(stepStorageKey);
    } catch {
      // ignore
    }
  }, [stepStorageKey]);

  // Restore step on mount (create/edit).
  useEffect(() => {
    if (!stepStorageKey || !enableStepPersistenceInTests) {
      hasRestoredRef.current = true;
      return;
    }
    let cancelled = false;

    const restore = async () => {
      const stored = await getStoredStep();
      if (cancelled) return;
      if (stored != null) {
        setCurrentStep(stored);
      }
      hasRestoredRef.current = true;
    };

    void restore();

    return () => {
      cancelled = true;
    };
  }, [enableStepPersistenceInTests, getStoredStep, stepStorageKey]);

  // Persist current step.
  useEffect(() => {
    if (!stepStorageKey) return;
    if (!enableStepPersistenceInTests) return;
    if (!hasRestoredRef.current) return;
    void setStoredStep(currentStep);
  }, [currentStep, enableStepPersistenceInTests, setStoredStep, stepStorageKey]);

  const handleStepSelect = useCallback(
    (step: number) => {
      if (step < 1 || step > totalSteps) return;
      trackWizardEvent('wizard_step_jump', { step_from: currentStep, step_to: step });
      setCurrentStep(step);
    },
    [currentStep, totalSteps]
  );

  const handleNext = useCallback(() => {
    if (currentStep >= totalSteps) return;

    const formData = getFormDataRef.current?.();
    if (formData) {
      const { errors } = validateStep(currentStep, formData);
      if (errors.length > 0) {
        setStep1SubmitErrors(errors);
        const firstAnchor = errors.find(e => e.anchorId)?.anchorId;
        pendingIssueNavRef.current = { step: currentStep, anchorId: firstAnchor };
        setFocusAnchorId(firstAnchor ?? null);
        trackWizardEvent('wizard_step_next_blocked', {
          step: currentStep,
          errors: errors.length,
        });
        return;
      }
    }

    setStep1SubmitErrors([]);
    trackWizardEvent('wizard_step_next', { step: currentStep });
    setCurrentStep(prev => prev + 1);
  }, [currentStep, totalSteps]);

  const handleBack = useCallback(() => {
    if (currentStep > 1) {
      trackWizardEvent('wizard_step_back', { step: currentStep });
      setCurrentStep(prev => prev - 1);
    }
  }, [currentStep]);

  const handleNavigateToIssue = useCallback((issue: ModerationIssue) => {
    const targetStep = normalizeStep(issue.targetStep);
    pendingIssueNavRef.current = { step: targetStep, anchorId: issue.anchorId };
    setCurrentStep(targetStep);
  }, [normalizeStep]);

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

    const t = setTimeout(() => {
      const el = document.getElementById(anchorId);
      if (el && typeof el.scrollIntoView === 'function') {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      pendingIssueNavRef.current = null;
      setFocusAnchorId(null);
    }, 50);

    return () => clearTimeout(t);
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
        void clearPersistedStep();
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
                    } catch (e: unknown) {
                      reset();
                      await showToastMessage({
                        type: 'error',
                        text1: 'Не удалось сохранить',
                        text2: getErrorMessage(e, 'Попробуйте ещё раз'),
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
              void clearPersistedStep();
              onDiscard();
            },
          },
        ],
        { cancelable: true, onDismiss: reset }
      );
    },
    [hasUnsavedChanges, canSave, onSave, clearPersistedStep]
  );

  // ✅ REFACTORED: Use safe beforeunload hook to prevent Permissions Policy violations
  useBeforeUnload(
    (e) => {
      e.preventDefault();
      e.returnValue = '';
    },
    Platform.OS === 'web' && hasUnsavedChanges
  );

  useEffect(() => {
    if (Platform.OS === 'web') return;
    if (!navigation?.addListener) return;

    const unsubscribe = navigation.addListener('beforeRemove', (e: BeforeRemoveEventLike) => {
      if (isLeavingRef.current) return;
      if (!hasUnsavedChanges) return;
      e.preventDefault();

      const leave = () => {
        isLeavingRef.current = true;
        navigation.dispatch(e.data.action as Parameters<typeof navigation.dispatch>[0]);
      };

      void confirmLeaveWizard(leave, leave);
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
    const saved = await onSave();
    const shouldClear = Boolean(saved?.publish || saved?.moderation);
    if (shouldClear) {
      await clearPersistedStep();
    }
  }, [onSave, clearPersistedStep]);

  return useMemo(() => ({
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
    clearPersistedStep,
  }), [
    currentStep,
    totalSteps,
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
    clearPersistedStep,
  ]);
}
