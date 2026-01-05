import { renderHook, act, waitFor } from '@testing-library/react-native';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useTravelWizard } from '@/hooks/useTravelWizard';

jest.mock('expo-router', () => {
  return {
    __esModule: true,
    useRouter: () => ({
      push: jest.fn(),
      replace: jest.fn(),
      back: jest.fn(),
    }),
    useNavigation: () => ({
      addListener: jest.fn(() => jest.fn()),
    }),
  };
});

jest.mock('@/src/utils/analytics', () => ({
  __esModule: true,
  trackWizardEvent: jest.fn(),
}));

jest.mock('react-native-toast-message', () => ({
  __esModule: true,
  default: { show: jest.fn() },
  show: jest.fn(),
}));

describe('useTravelWizard step persistence', () => {
  const stepKey = 'metravel_travel_wizard_step_test';

  const setPlatformOs = (os: string) => {
    Object.defineProperty(Platform, 'OS', {
      value: os,
      configurable: true,
    });
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    process.env.JEST_ENABLE_WIZARD_PERSISTENCE = '1';
    setPlatformOs('ios');
    await AsyncStorage.clear();
  });

  it('restores currentStep from persisted JSON payload', async () => {
    await AsyncStorage.setItem(
      stepKey,
      JSON.stringify({ step: 4, timestamp: Date.now() }),
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
      JSON.stringify({ step: 5, timestamp: Date.now() - ttlMs - 1 }),
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
      JSON.stringify({ step: 6, timestamp: Date.now() }),
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
      JSON.stringify({ step: 6, timestamp: Date.now() }),
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
