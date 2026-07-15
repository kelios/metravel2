import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { Platform, Alert, BackHandler } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter, useNavigation, useLocalSearchParams } from 'expo-router';
import { trackWizardEvent } from '@/utils/analytics';
import type { ValidationError, ModerationIssue } from '@/utils/formValidation';
import type { TravelFormData } from '@/types/types';
import { showToastMessage } from '@/utils/toast';
import { getErrorMessage } from '@/utils/errorHelpers';
import { useBeforeUnload } from '@/utils/beforeunloadGuard';
import { normalizeInternalReturnPath } from '@/utils/navigationReturnPath';
import { translate as i18nT } from '@/i18n'


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
    get title() { return i18nT('sharedStatic:hooks.useTravelWizard.osnovnaya_informatsiya_2d38d55a') },
    get subtitle() { return i18nT('sharedStatic:hooks.useTravelWizard.nazvanie_i_opisanie_puteshestviya_a2040e23') },
    get tipTitle() { return i18nT('travel:hooks.useTravelWizard.step1.tipTitle') },
    get tipBody() { return i18nT('travel:hooks.useTravelWizard.step1.tipBody') },
    get nextLabel() { return i18nT('travel:hooks.useTravelWizard.step1.nextLabel') },
  },
  {
    id: 2,
    get title() { return i18nT('sharedStatic:hooks.useTravelWizard.marshrut_na_karte_5e4729f7') },
    get subtitle() { return i18nT('sharedStatic:hooks.useTravelWizard.dobavte_klyuchevye_tochki_i_strany_marshruta_3f62aabc') },
    get tipTitle() { return i18nT('travel:hooks.useTravelWizard.step2.tipTitle') },
    tipBody: '',
    get nextLabel() { return i18nT('travel:hooks.useTravelWizard.step2.nextLabel') },
  },
  {
    id: 3,
    get title() { return i18nT('sharedStatic:hooks.useTravelWizard.media_puteshestviya_7faffe0e') },
    get subtitle() { return i18nT('sharedStatic:hooks.useTravelWizard.dobavte_oblozhku_fotografii_i_video_eto_povy_d5486605') },
    get tipTitle() { return i18nT('travel:hooks.useTravelWizard.defaultTipTitle') },
    get tipBody() { return i18nT('travel:hooks.useTravelWizard.step3.tipBody') },
    get nextLabel() { return i18nT('travel:hooks.useTravelWizard.step3.nextLabel') },
  },
  {
    id: 4,
    get title() { return i18nT('sharedStatic:hooks.useTravelWizard.detali_i_sovety_9f987a7e') },
    get subtitle() { return i18nT('sharedStatic:hooks.useTravelWizard.plyusy_minusy_rekomendatsii_i_byudzhet_chtob_1238afbb') },
    get tipTitle() { return i18nT('travel:hooks.useTravelWizard.defaultTipTitle') },
    get tipBody() { return i18nT('travel:hooks.useTravelWizard.step4.tipBody') },
    get nextLabel() { return i18nT('travel:hooks.useTravelWizard.step4.nextLabel') },
  },
  {
    id: 5,
    get title() { return i18nT('sharedStatic:hooks.useTravelWizard.dopolnitelnye_parametry_10c4d7f6') },
    get subtitle() { return i18nT('sharedStatic:hooks.useTravelWizard.transport_slozhnost_sezonnost_viza_i_drugie__71b95c16') },
    get tipTitle() { return i18nT('travel:hooks.useTravelWizard.defaultTipTitle') },
    get tipBody() { return i18nT('travel:hooks.useTravelWizard.step5.tipBody') },
    get nextLabel() { return i18nT('travel:hooks.useTravelWizard.step5.nextLabel') },
  },
  {
    id: 6,
    get title() { return i18nT('sharedStatic:hooks.useTravelWizard.publikatsiya_puteshestviya_e195efbe') },
    get subtitle() { return i18nT('sharedStatic:hooks.useTravelWizard.proverte_gotovnost_i_vyberite_status_chernov_4e8e3917') },
    get tipTitle() { return i18nT('travel:hooks.useTravelWizard.defaultTipTitle') },
    get tipBody() { return i18nT('travel:hooks.useTravelWizard.step6.tipBody') },
    get nextLabel() { return i18nT('travel:hooks.useTravelWizard.step6.nextLabel') },
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

// Версия схемы сохранённого шага. Меняем при несовместимом изменении формата —
// устаревшие записи откатываются к шагу 1.
const STEP_SCHEMA_VERSION = 1;

// Чистый разбор сохранённого значения шага.
// Поддерживает JSON {step,timestamp,schemaVersion} с TTL и legacy-формат (числовая строка).
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

  const obj = parsed as { step?: unknown; timestamp?: unknown; schemaVersion?: unknown };
  if (obj.schemaVersion !== STEP_SCHEMA_VERSION) {
    return { step: null, expired: true };
  }

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
    stepStorageKey,
    stepStorageTtlMs = 7 * 24 * 60 * 60 * 1000,
  } = options;
  const router = useRouter();
  const navigation = useNavigation();
  const searchParams = useLocalSearchParams<{
    returnTo?: string | string[];
    from?: string | string[];
  }>();
  const exitReturnTo = useMemo(
    () => normalizeInternalReturnPath(searchParams.returnTo ?? searchParams.from),
    [searchParams.returnTo, searchParams.from],
  );

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
      schemaVersion: STEP_SCHEMA_VERSION,
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

    // Свободная навигация между шагами: переход «Далее» НИКОГДА не блокируется
    // валидацией полноты. Проверка обязательных полей выполняется ровно один раз —
    // при явной отправке на модерацию/публикацию (см.
    // docs/TRAVEL_SAVE_MODERATION_CONTRACT.md). Инлайн-подсказки по незаполненным
    // полям шаг показывает сам, но переходу они не мешают.
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
        i18nT('shared:hooks.useTravelWizard.est_nesohranennye_izmeneniya_4cb67f79'),
        canSave
          ? i18nT('shared:hooks.useTravelWizard.sohranit_chernovik_pered_vyhodom_d0ff2d3c')
          : i18nT('shared:hooks.useTravelWizard.seychas_sohranit_nelzya_net_interneta_ili_id_55c139ab'),
        [
          {
            text: i18nT('shared:hooks.useTravelWizard.ostatsya_e14e72fc'),
            style: 'cancel',
            onPress: reset,
          },
          ...(canSave
            ? [
                {
                  text: i18nT('shared:hooks.useTravelWizard.sohranit_i_vyyti_d514b94e'),
                  onPress: async () => {
                    try {
                      await onSave();
                      reset();
                      onSavedAndLeave?.();
                    } catch (e: unknown) {
                      reset();
                      await showToastMessage({
                        type: 'error',
                        text1: i18nT('shared:hooks.useTravelWizard.ne_udalos_sohranit_d5966e16'),
                        text2: getErrorMessage(e, i18nT('shared:hooks.useTravelWizard.poprobuyte_esche_raz_1dda501f')),
                      });
                    }
                  },
                },
              ]
            : []),
          {
            text: i18nT('shared:hooks.useTravelWizard.vyyti_bez_sohraneniya_cd5cbc49'),
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

  // Leaves the wizard screen entirely (e.g. back to search/list).
  // Used by the visible back/close control on step 1 and by Android hardware back.
  // Robust against a missing nav history (wizard opened via deep link from search).
  const handleExit = useCallback(() => {
    const leave = () => {
      isLeavingRef.current = true;
      if (exitReturnTo) {
        router.replace(exitReturnTo as Parameters<typeof router.replace>[0]);
      } else if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/metravel');
      }
    };
    void confirmLeaveWizard(leave, leave);
  }, [confirmLeaveWizard, exitReturnTo, router]);

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
      // Step > 1: go to previous wizard step. Step 1: leave the screen.
      // Always consume the press so we never fall through to a no-op default
      // back (wizard can be opened via deep link from search with no history).
      if (currentStep > 1) {
        handleBack();
        return true;
      }
      handleExit();
      return true;
    };

    const sub = BackHandler.addEventListener('hardwareBackPress', onHardwareBack);
    return () => sub.remove();
  }, [currentStep, handleBack, handleExit]);

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
    handleExit,
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
    handleExit,
    handleNavigateToIssue,
    handleAnchorHandled,
    handleFinishWizard,
    confirmLeaveWizard,
    clearPersistedStep,
  ]);
}
