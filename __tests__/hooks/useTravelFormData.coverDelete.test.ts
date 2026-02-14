import { renderHook, waitFor, act, cleanup } from '@testing-library/react-native';

import { useTravelFormData } from '@/hooks/useTravelFormData';
import { saveFormData } from '@/api/misc';

jest.mock('@/api/travelsApi', () => ({
  fetchTravel: jest.fn(),
}));

jest.mock('@/api/misc', () => ({
  saveFormData: jest.fn(),
}));

describe('useTravelFormData – cover photo deletion + save', () => {
  beforeEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
    cleanup();
  });

  const newTravelOptions = {
    travelId: null,
    isNew: true,
    userId: '42',
    isSuperAdmin: false,
    isAuthenticated: true,
    authReady: true,
  };

  it('manual save sends null cover URLs after cover deletion (not old URL)', async () => {
    (saveFormData as jest.Mock).mockImplementation(async (payload: any) => ({
      ...payload,
    }));

    const { result } = renderHook(
      () => useTravelFormData(newTravelOptions),
      { concurrentRoot: false },
    );

    await waitFor(() => expect(result.current.isInitialLoading).toBe(false), { timeout: 5000 });

    // Simulate existing travel with a cover image
    act(() => {
      result.current.setFormData({
        ...(result.current.formData as any),
        id: 42,
        name: 'Travel with cover',
        travel_image_thumb_url: 'https://metravel.by/covers/42.webp',
        travel_image_thumb_small_url: 'https://metravel.by/covers/42_small.webp',
      });
    });

    // Simulate cover deletion (what TravelWizardStepMedia.handleConfirmDeleteCover does)
    act(() => {
      result.current.setFormData((prev: any) => ({
        ...prev,
        travel_image_thumb_small_url: null,
        travel_image_thumb_url: null,
      }));
    });

    // Verify formData reflects deletion
    expect((result.current.formData as any).travel_image_thumb_url).toBeNull();
    expect((result.current.formData as any).travel_image_thumb_small_url).toBeNull();

    // Now trigger manual save
    await act(async () => {
      await result.current.handleManualSave();
    });

    expect(saveFormData).toHaveBeenCalledTimes(1);
    const sentPayload = (saveFormData as jest.Mock).mock.calls[0][0];

    // The payload must have null cover URLs, NOT the old URL
    expect(sentPayload.travel_image_thumb_url).toBeNull();
    expect(sentPayload.travel_image_thumb_small_url).toBeNull();
  });

  it('cover stays null after save when server response also returns null cover', async () => {
    (saveFormData as jest.Mock).mockImplementation(async (payload: any) => ({
      ...payload,
      travel_image_thumb_url: null,
      travel_image_thumb_small_url: null,
    }));

    const { result } = renderHook(
      () => useTravelFormData(newTravelOptions),
      { concurrentRoot: false },
    );

    await waitFor(() => expect(result.current.isInitialLoading).toBe(false), { timeout: 5000 });

    // Set up travel with cover, then delete it
    act(() => {
      result.current.setFormData({
        ...(result.current.formData as any),
        id: 42,
        name: 'Travel with cover',
        travel_image_thumb_url: 'https://metravel.by/covers/42.webp',
        travel_image_thumb_small_url: 'https://metravel.by/covers/42_small.webp',
      });
    });

    act(() => {
      result.current.setFormData((prev: any) => ({
        ...prev,
        travel_image_thumb_small_url: null,
        travel_image_thumb_url: null,
      }));
    });

    await act(async () => {
      await result.current.handleManualSave();
    });

    // After save, cover should still be null (not restored from old data)
    expect((result.current.formData as any).travel_image_thumb_url).toBeNull();
    expect((result.current.formData as any).travel_image_thumb_small_url).toBeNull();
  });

  it('cover stays null even when server response returns old cover URL', async () => {
    // Simulate server returning old cover URL in upsert response
    // (server might not know about the separate DELETE /main-image/ call)
    (saveFormData as jest.Mock).mockImplementation(async (payload: any) => ({
      ...payload,
      travel_image_thumb_url: 'https://metravel.by/covers/42.webp',
      travel_image_thumb_small_url: 'https://metravel.by/covers/42_small.webp',
    }));

    const { result } = renderHook(
      () => useTravelFormData(newTravelOptions),
      { concurrentRoot: false },
    );

    await waitFor(() => expect(result.current.isInitialLoading).toBe(false), { timeout: 5000 });

    // Set up travel with cover
    act(() => {
      result.current.setFormData({
        ...(result.current.formData as any),
        id: 42,
        name: 'Travel with cover',
        travel_image_thumb_url: 'https://metravel.by/covers/42.webp',
        travel_image_thumb_small_url: 'https://metravel.by/covers/42_small.webp',
      });
    });

    // Delete cover
    act(() => {
      result.current.setFormData((prev: any) => ({
        ...prev,
        travel_image_thumb_small_url: null,
        travel_image_thumb_url: null,
      }));
    });

    await act(async () => {
      await result.current.handleManualSave();
    });

    // Even though server returned old URL, local state should keep null
    // because user explicitly deleted the cover
    // NOTE: This test may FAIL if applySavedData restores the old URL from server response.
    // That would be the bug we're looking for.
    expect((result.current.formData as any).travel_image_thumb_url).toBeNull();
    expect((result.current.formData as any).travel_image_thumb_small_url).toBeNull();
  });

  it('save succeeds after cover deletion (no error thrown)', async () => {
    (saveFormData as jest.Mock).mockImplementation(async (payload: any) => ({
      ...payload,
    }));

    const { result } = renderHook(
      () => useTravelFormData(newTravelOptions),
      { concurrentRoot: false },
    );

    await waitFor(() => expect(result.current.isInitialLoading).toBe(false), { timeout: 5000 });

    act(() => {
      result.current.setFormData({
        ...(result.current.formData as any),
        id: 42,
        name: 'Travel with cover',
        travel_image_thumb_url: 'https://metravel.by/covers/42.webp',
        travel_image_thumb_small_url: 'https://metravel.by/covers/42_small.webp',
      });
    });

    // Delete cover
    act(() => {
      result.current.setFormData((prev: any) => ({
        ...prev,
        travel_image_thumb_small_url: null,
        travel_image_thumb_url: null,
      }));
    });

    let saveResult: any;
    await act(async () => {
      saveResult = await result.current.handleManualSave();
    });

    // Save must succeed (return data, not undefined from error path)
    expect(saveResult).toBeDefined();
    expect(saveFormData).toHaveBeenCalledTimes(1);
  });

  it('gallery deletion is preserved through save', async () => {
    (saveFormData as jest.Mock).mockImplementation(async (payload: any) => ({
      ...payload,
      gallery: [],
    }));

    const { result } = renderHook(
      () => useTravelFormData(newTravelOptions),
      { concurrentRoot: false },
    );

    await waitFor(() => expect(result.current.isInitialLoading).toBe(false), { timeout: 5000 });

    // Set up travel with gallery
    act(() => {
      result.current.setFormData({
        ...(result.current.formData as any),
        id: 42,
        name: 'Travel with gallery',
        gallery: [
          'https://metravel.by/gallery/1.webp',
          'https://metravel.by/gallery/2.webp',
        ],
      });
    });

    // Remove one gallery image (simulate gallery change handler)
    act(() => {
      result.current.setFormData((prev: any) => ({
        ...prev,
        gallery: ['https://metravel.by/gallery/1.webp'],
      }));
    });

    await act(async () => {
      await result.current.handleManualSave();
    });

    expect(saveFormData).toHaveBeenCalledTimes(1);
    const sentPayload = (saveFormData as jest.Mock).mock.calls[0][0];

    // Payload should have only the remaining gallery image
    expect(sentPayload.gallery).toEqual(['https://metravel.by/gallery/1.webp']);
  });
});
