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

  it('manual save sends current description HTML (not __draft_placeholder__)', async () => {
    const html = '<p>еуые</p>';
    (saveFormData as jest.Mock).mockImplementation(async (payload: any) => ({ ...payload }));

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

    act(() => {
      result.current.setFormData({
        ...(result.current.formData as any),
        name: 'Test',
        description: html,
      });
    });

    await act(async () => {
      await result.current.handleManualSave();
    });

    expect(saveFormData).toHaveBeenCalledTimes(1);
    const sentPayload = (saveFormData as jest.Mock).mock.calls[0][0];
    expect(sentPayload.description).toBe(html);
    expect(sentPayload.description).not.toBe('__draft_placeholder__');
  });

  it('manual save keeps local description if backend responds with description=null (no placeholder on next save)', async () => {
    const html = '<p>еуые</p>';
    (saveFormData as jest.Mock)
      .mockImplementationOnce(async (payload: any) => ({ ...payload, description: null }))
      .mockImplementationOnce(async (payload: any) => ({ ...payload }));

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

    act(() => {
      result.current.setFormData({
        ...(result.current.formData as any),
        name: 'Test',
        description: html,
      });
    });

    await act(async () => {
      await result.current.handleManualSave();
    });

    // Even if server responded with null, local state should keep HTML.
    expect((result.current.formData as any).description).toBe(html);

    await act(async () => {
      await result.current.handleManualSave();
    });

    expect(saveFormData).toHaveBeenCalledTimes(2);
    const sentPayload2 = (saveFormData as jest.Mock).mock.calls[1][0];
    expect(sentPayload2.description).toBe(html);
    expect(sentPayload2.description).not.toBe('__draft_placeholder__');
  });

  it('manual save merges dataOverride placeholders with current snapshot (publish override only)', async () => {
    const html = '<p>test</p>';
    (saveFormData as jest.Mock).mockImplementation(async (payload: any) => ({ ...payload }));

    const { result } = renderHook(() =>
      useTravelFormData({
        travelId: '817',
        isNew: false,
        userId: '42',
        isSuperAdmin: false,
        isAuthenticated: true,
        authReady: true,
      })
    );

    await waitFor(() => expect(result.current.isInitialLoading).toBe(false));

    // Set current snapshot as if user typed real values.
    act(() => {
      result.current.setFormData({
        ...(result.current.formData as any),
        id: 817,
        name: 'Длинное описание',
        description: html,
        categories: [1],
      });
    });

    // Simulate caller override like TravelWizardStepPublish (publish flags), but accidentally containing placeholders.
    const override = {
      ...(result.current.formData as any),
      name: null,
      description: '__draft_placeholder__',
      plus: '__draft_placeholder__',
      minus: '__draft_placeholder__',
      recommendation: '__draft_placeholder__',
      youtube_link: '__draft_placeholder__',
      categories: [],
      publish: false,
      moderation: false,
    };

    await act(async () => {
      await result.current.handleManualSave(override);
    });

    expect(saveFormData).toHaveBeenCalledTimes(1);
    const sentPayload = (saveFormData as jest.Mock).mock.calls[0][0];
    expect(sentPayload.publish).toBe(false);
    expect(sentPayload.moderation).toBe(false);
    expect(sentPayload.description).toBe(html);
    expect(sentPayload.description).not.toBe('__draft_placeholder__');
    expect(sentPayload.name).toBe('Длинное описание');
    expect(sentPayload.categories).toEqual([1]);
  });
});
