import { renderHook, act, waitFor } from '@testing-library/react-native';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useTravelWizard } from '@/hooks/useTravelWizard';

const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  canGoBack: jest.fn(() => false),
};
let mockLocalSearchParams: Record<string, string | string[] | undefined> = {};

jest.mock('expo-router', () => {
  return {
    __esModule: true,
    useRouter: () => mockRouter,
    useNavigation: () => ({
      addListener: jest.fn(() => jest.fn()),
    }),
    useLocalSearchParams: () => mockLocalSearchParams,
  };
});

jest.mock('@/utils/analytics', () => ({
  __esModule: true,
  trackWizardEvent: jest.fn(),
}));

jest.mock('react-native-toast-message', () => ({
  __esModule: true,
  default: { show: jest.fn() },
  show: jest.fn(),
}));

jest.mock('@/utils/beforeunloadGuard', () => ({
  __esModule: true,
  useBeforeUnload: jest.fn(),
  isUnloadAllowed: jest.fn(() => true),
}));

describe('useTravelWizard step persistence', () => {
  const stepKey = 'metravel_travel_wizard_step_test';

  const setPlatformOs = (os: string) => {
    Object.defineProperty(Platform, 'OS', {
      value: os,
      configurable: true,
    });
  };

  let originalPlatformOs: string;
  let originalEnvFlag: string | undefined;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockLocalSearchParams = {};
    mockRouter.canGoBack.mockReturnValue(false);
    originalPlatformOs = Platform.OS;
    originalEnvFlag = process.env.JEST_ENABLE_WIZARD_PERSISTENCE;
    process.env.JEST_ENABLE_WIZARD_PERSISTENCE = '1';
    setPlatformOs('ios');
    await AsyncStorage.clear();
  });

  afterEach(() => {
    setPlatformOs(originalPlatformOs);
    if (originalEnvFlag === undefined) {
      delete process.env.JEST_ENABLE_WIZARD_PERSISTENCE;
    } else {
      process.env.JEST_ENABLE_WIZARD_PERSISTENCE = originalEnvFlag;
    }
  });

  // Контракт save ≠ moderate (docs/TRAVEL_SAVE_MODERATION_CONTRACT.md):
  // переход между шагами НИКОГДА не блокируется валидацией полноты — обязательные
  // поля проверяются ровно один раз, при явной отправке на модерацию.
  it('advances to the next step even when required fields are empty (free navigation)', async () => {
    const emptyFormData = { name: '', description: '' } as any;
    const { result } = renderHook(() =>
      useTravelWizard({
        totalSteps: 6,
        hasUnsavedChanges: false,
        canSave: true,
        onSave: jest.fn(async () => ({ publish: false, moderation: false })),
        getFormData: () => emptyFormData,
      }),
    );

    await waitFor(() => {
      expect(result.current.currentStep).toBe(1);
    });

    act(() => {
      result.current.handleNext();
    });

    expect(result.current.currentStep).toBe(2);
    expect(result.current.step1SubmitErrors).toEqual([]);
  });

  it('restores currentStep from persisted JSON payload', async () => {
    await AsyncStorage.setItem(
      stepKey,
      JSON.stringify({ step: 4, timestamp: Date.now(), schemaVersion: 1 }),
    );

    const { result } = renderHook(() =>
      useTravelWizard({
        totalSteps: 6,
        hasUnsavedChanges: false,
        canSave: true,
        onSave: jest.fn(async () => ({ publish: false, moderation: false })),
        stepStorageKey: stepKey,
        stepStorageTtlMs: 7 * 24 * 60 * 60 * 1000,
      }),
    );

    await waitFor(() => {
      expect(result.current.currentStep).toBe(4);
    });
  });

  it('does not restore expired step (TTL) and clears storage item', async () => {
    const ttlMs = 1000;
    await AsyncStorage.setItem(
      stepKey,
      JSON.stringify({ step: 5, timestamp: Date.now() - ttlMs - 1, schemaVersion: 1 }),
    );

    const { result } = renderHook(() =>
      useTravelWizard({
        totalSteps: 6,
        hasUnsavedChanges: false,
        canSave: true,
        onSave: jest.fn(async () => ({ publish: false, moderation: false })),
        stepStorageKey: stepKey,
        stepStorageTtlMs: ttlMs,
      }),
    );

    await waitFor(() => {
      expect(result.current.currentStep).toBe(1);
    });

    expect(AsyncStorage.removeItem).toHaveBeenCalledWith(stepKey);
  });

  it('falls back to step 1 and clears storage when schemaVersion is missing/incompatible', async () => {
    await AsyncStorage.setItem(
      stepKey,
      JSON.stringify({ step: 5, timestamp: Date.now(), schemaVersion: 0 }),
    );

    const { result } = renderHook(() =>
      useTravelWizard({
        totalSteps: 6,
        hasUnsavedChanges: false,
        canSave: true,
        onSave: jest.fn(async () => ({ publish: false, moderation: false })),
        stepStorageKey: stepKey,
      }),
    );

    await waitFor(() => {
      expect(result.current.currentStep).toBe(1);
    });

    expect(AsyncStorage.removeItem).toHaveBeenCalledWith(stepKey);
  });

  it('restores step from legacy numeric string payload (backward compatibility)', async () => {
    await AsyncStorage.setItem(stepKey, '3');

    const { result } = renderHook(() =>
      useTravelWizard({
        totalSteps: 6,
        hasUnsavedChanges: false,
        canSave: true,
        onSave: jest.fn(async () => ({ publish: false, moderation: false })),
        stepStorageKey: stepKey,
      }),
    );

    await waitFor(() => {
      expect(result.current.currentStep).toBe(3);
    });
  });

  it('clears persisted step on finish only when save result indicates publish/moderation', async () => {
    await AsyncStorage.setItem(
      stepKey,
      JSON.stringify({ step: 6, timestamp: Date.now(), schemaVersion: 1 }),
    );

    const onSave = jest.fn(async () => ({ publish: true, moderation: false }));

    const { result } = renderHook(() =>
      useTravelWizard({
        totalSteps: 6,
        hasUnsavedChanges: false,
        canSave: true,
        onSave,
        stepStorageKey: stepKey,
      }),
    );

    await act(async () => {
      await result.current.handleFinishWizard();
    });

    expect(onSave).toHaveBeenCalled();
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith(stepKey);
  });

  it('does not clear persisted step on finish when save result is draft', async () => {
    await AsyncStorage.setItem(
      stepKey,
      JSON.stringify({ step: 6, timestamp: Date.now(), schemaVersion: 1 }),
    );

    const onSave = jest.fn(async () => ({ publish: false, moderation: false }));

    const { result } = renderHook(() =>
      useTravelWizard({
        totalSteps: 6,
        hasUnsavedChanges: false,
        canSave: true,
        onSave,
        stepStorageKey: stepKey,
      }),
    );

    await act(async () => {
      await result.current.handleFinishWizard();
    });

    expect(onSave).toHaveBeenCalled();
    expect(AsyncStorage.removeItem).not.toHaveBeenCalledWith(stepKey);
  });
});

describe('useTravelWizard beforeunload guard (web)', () => {
  const setPlatformOs = (os: string) => {
    Object.defineProperty(Platform, 'OS', {
      value: os,
      configurable: true,
    });
  };

  let originalPlatformOs: string;

  beforeEach(() => {
    jest.clearAllMocks();
    mockLocalSearchParams = {};
    mockRouter.canGoBack.mockReturnValue(false);
    originalPlatformOs = Platform.OS;
    setPlatformOs('web');
  });

  afterEach(() => {
    setPlatformOs(originalPlatformOs);
  });

  it('enables beforeunload on web when hasUnsavedChanges=true', () => {
    const { useBeforeUnload } = require('@/utils/beforeunloadGuard');

    renderHook(() =>
      useTravelWizard({
        totalSteps: 6,
        hasUnsavedChanges: true,
        canSave: true,
        onSave: jest.fn(async () => ({ publish: false, moderation: false })),
      }),
    );

    expect(useBeforeUnload).toHaveBeenCalledWith(
      expect.any(Function),
      true
    );
  });

  it('keeps beforeunload disabled on web when hasUnsavedChanges=false', () => {
    const { useBeforeUnload } = require('@/utils/beforeunloadGuard');

    renderHook(() =>
      useTravelWizard({
        totalSteps: 6,
        hasUnsavedChanges: false,
        canSave: true,
        onSave: jest.fn(async () => ({ publish: false, moderation: false })),
      }),
    );

    expect(useBeforeUnload).toHaveBeenCalledWith(
      expect.any(Function),
      false
    );
  });
});

describe('useTravelWizard origin-aware exit', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLocalSearchParams = {};
    mockRouter.canGoBack.mockReturnValue(false);
  });

  it('replaces to returnTo when leaving the first wizard step', () => {
    mockLocalSearchParams = { returnTo: '/search' };

    const { result } = renderHook(() =>
      useTravelWizard({
        totalSteps: 6,
        hasUnsavedChanges: false,
        canSave: true,
        onSave: jest.fn(async () => ({ publish: false, moderation: false })),
      }),
    );

    act(() => {
      result.current.handleExit();
    });

    expect(mockRouter.replace).toHaveBeenCalledWith('/search');
    expect(mockRouter.back).not.toHaveBeenCalled();
  });

  it('uses legacy from param as the return target', () => {
    mockLocalSearchParams = { from: ['/map'] };

    const { result } = renderHook(() =>
      useTravelWizard({
        totalSteps: 6,
        hasUnsavedChanges: false,
        canSave: true,
        onSave: jest.fn(async () => ({ publish: false, moderation: false })),
      }),
    );

    act(() => {
      result.current.handleExit();
    });

    expect(mockRouter.replace).toHaveBeenCalledWith('/map');
  });

  it('falls back to router history when origin is invalid', () => {
    mockLocalSearchParams = { returnTo: 'https://example.com/search' };
    mockRouter.canGoBack.mockReturnValue(true);

    const { result } = renderHook(() =>
      useTravelWizard({
        totalSteps: 6,
        hasUnsavedChanges: false,
        canSave: true,
        onSave: jest.fn(async () => ({ publish: false, moderation: false })),
      }),
    );

    act(() => {
      result.current.handleExit();
    });

    expect(mockRouter.back).toHaveBeenCalled();
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });
});
