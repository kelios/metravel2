import { renderHook, waitFor, act } from '@testing-library/react-native';

import { useTravelFormData } from '@/hooks/useTravelFormData';
import { fetchTravel } from '@/src/api/travelsApi';
import { saveFormData } from '@/src/api/misc';
import Toast from 'react-native-toast-message';
import { router } from 'expo-router';

jest.mock('@/src/api/travelsApi', () => ({
  fetchTravel: jest.fn(),
}));

jest.mock('@/src/api/misc', () => ({
  saveFormData: jest.fn(),
}));

describe('useTravelFormData', () => {
  const baseOptions = {
    travelId: '123',
    isNew: false,
    userId: '42',
    isSuperAdmin: false,
    isAuthenticated: true,
    authReady: true,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('redirects with error when travel does not exist', async () => {
    (fetchTravel as jest.Mock).mockResolvedValue(null);

    const { result } = renderHook(() => useTravelFormData(baseOptions));

    await waitFor(() => {
      expect(router.replace).toHaveBeenCalledWith('/');
    });

    expect(Toast.show).toHaveBeenCalledWith(
      expect.objectContaining({
        text1: 'Путешествие не найдено',
      })
    );
    expect(result.current.hasAccess).toBe(false);
    expect(result.current.isInitialLoading).toBe(false);
  });

  it('does not trigger autosave while manual save is in flight', async () => {
    const deferred: { resolve?: (value: any) => void } = {};
    const manualSavePromise = new Promise<any>(resolve => {
      deferred.resolve = resolve;
    });

    (saveFormData as jest.Mock).mockImplementation(() => manualSavePromise);

    const { result } = renderHook(() =>
      useTravelFormData({
        travelId: null,
        isNew: true,
        userId: '42',
        isSuperAdmin: false,
        isAuthenticated: true,
        authReady: true,
      })
    );

    await waitFor(() => expect(result.current.isInitialLoading).toBe(false));

    jest.useFakeTimers();

    const updated = { ...(result.current.formData as any), name: 'Test Travel' };

    act(() => {
      result.current.setFormData(updated);
    });

    let inFlight: Promise<any> | undefined;
    act(() => {
      inFlight = result.current.handleManualSave(updated);
    });

    act(() => {
      jest.advanceTimersByTime(6000);
    });

    expect(saveFormData).toHaveBeenCalledTimes(1);

    await act(async () => {
      deferred.resolve?.(updated);
      await inFlight;
    });

    expect(saveFormData).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });
});
