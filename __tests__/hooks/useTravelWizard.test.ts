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

jest.mock('@/utils/analytics', () => ({
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

describe('useTravelWizard beforeunload guard (web)', () => {
  const originalWindow = (global as any).window;
  const originalDocument = (global as any).document;

  const setPlatformOs = (os: string) => {
    Object.defineProperty(Platform, 'OS', {
      value: os,
      configurable: true,
    });
  };

  let addEventListener: jest.Mock;
  let removeEventListener: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    setPlatformOs('web');

    addEventListener = jest.fn();
    removeEventListener = jest.fn();

    const win: any = {
      addEventListener,
      removeEventListener,
      self: null,
      top: null,
    };
    win.self = win;
    win.top = win;

    const doc: any = {
      permissionsPolicy: {
        allowsFeature: jest.fn(() => true),
      },
      featurePolicy: undefined,
    };

    (global as any).window = win;
    (global as any).document = doc;
  });

  afterEach(() => {
    (global as any).window = originalWindow;
    (global as any).document = originalDocument;
  });

  it('attaches beforeunload handler and prevents unload when hasUnsavedChanges=true', () => {
    const { unmount } = renderHook(() =>
      useTravelWizard({
        totalSteps: 6,
        hasUnsavedChanges: true,
        canSave: true,
        onSave: jest.fn(async () => ({ publish: false, moderation: false })),
      }),
    );

    expect(addEventListener).toHaveBeenCalledTimes(1);
    expect(addEventListener).toHaveBeenCalledWith('beforeunload', expect.any(Function));

    const handler = (addEventListener.mock.calls[0] as any[])[1] as (e: any) => void;
    const e: any = { preventDefault: jest.fn(), returnValue: undefined };

    handler(e);
    expect(e.preventDefault).toHaveBeenCalled();
    expect(e.returnValue).toBe('');

    unmount();
  });

  it('removes beforeunload handler when hasUnsavedChanges toggles to false', () => {
    const { rerender, unmount } = renderHook<ReturnType<typeof useTravelWizard>, { hasUnsavedChanges: boolean }>(
      ({ hasUnsavedChanges }) =>
        useTravelWizard({
          totalSteps: 6,
          hasUnsavedChanges,
          canSave: true,
          onSave: jest.fn(async () => ({ publish: false, moderation: false })),
        }),
      {
        initialProps: { hasUnsavedChanges: true },
      },
    );

    const handler = (addEventListener.mock.calls[0] as any[])[1] as any;

    rerender({ hasUnsavedChanges: false });
    expect(removeEventListener).toHaveBeenCalledWith('beforeunload', handler);

    unmount();
  });
});
