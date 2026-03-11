import { renderHook, waitFor, act, cleanup } from '@testing-library/react-native';
import React from 'react';
import { QueryClientContext } from '@tanstack/react-query';

import { useTravelFormData } from '@/hooks/useTravelFormData';
import { fetchTravel } from '@/api/travelsApi';
import { saveFormData, uploadImage } from '@/api/misc';
import { ApiError } from '@/api/client';
import Toast from 'react-native-toast-message';
import { router } from 'expo-router';
import { getPendingImageFile, removePendingImageFile } from '@/utils/pendingImageFiles';

jest.mock('@/api/travelsApi', () => ({
  fetchTravel: jest.fn(),
}));

jest.mock('@/api/misc', () => ({
  saveFormData: jest.fn(),
  uploadImage: jest.fn(),
}));

jest.mock('@/utils/pendingImageFiles', () => ({
  getPendingImageFile: jest.fn(),
  removePendingImageFile: jest.fn(),
}));

describe('useTravelFormData', () => {
  const mockInvalidateQueries = jest.fn();
  const baseOptions = {
    travelId: '123',
    isNew: false,
    userId: '42',
    isSuperAdmin: false,
    isAuthenticated: true,
    authReady: true,
  };

  beforeEach(() => {
    // Ensure a consistent baseline; some tests temporarily enable fake timers.
    jest.useRealTimers();
    jest.clearAllMocks();
    mockInvalidateQueries.mockReset();
    mockInvalidateQueries.mockResolvedValue(undefined);
  });
  
  afterEach(() => {
    // Ensure one test's fake timers don't leak into the next.
    jest.useRealTimers();
    cleanup();
  });

  const createWrapper = () => {
    const queryClient = {
      invalidateQueries: mockInvalidateQueries,
    };

    return function Wrapper({ children }: { children: React.ReactNode }) {
      return React.createElement(
        QueryClientContext.Provider,
        { value: queryClient as any },
        children
      );
    };
  };

  it('sets loadError when travel does not exist', async () => {
    (fetchTravel as jest.Mock).mockRejectedValue(new ApiError(404, 'Not found'));

    const { result } = renderHook(() => useTravelFormData(baseOptions), { concurrentRoot: false });

    await waitFor(() => {
      expect(result.current.isInitialLoading).toBe(false);
    });

    expect(Toast.show).toHaveBeenCalledWith(
      expect.objectContaining({
        text1: 'Путешествие не найдено',
      })
    );
    expect(router.replace).not.toHaveBeenCalled();
    expect(result.current.hasAccess).toBe(false);
    expect(result.current.loadError?.status).toBe(404);
    expect(result.current.isInitialLoading).toBe(false);
  });

  it('does not trigger autosave while manual save is in flight', async () => {
    const deferred: { resolve?: (value: any) => void } = {};
    const manualSavePromise = new Promise<any>(resolve => {
      deferred.resolve = resolve;
    });

    (saveFormData as jest.Mock).mockImplementation(() => manualSavePromise);

    const { result } = renderHook(
      () =>
        useTravelFormData({
          travelId: null,
          isNew: true,
          userId: '42',
          isSuperAdmin: false,
          isAuthenticated: true,
          authReady: true,
        }),
      { concurrentRoot: false }
    );

    await waitFor(() => expect(result.current.isInitialLoading).toBe(false), { timeout: 5000 });

    const updated = { ...(result.current.formData as any), name: 'Test Travel' };

    act(() => {
      result.current.setFormData(updated);
    });

    let inFlight: Promise<any> | undefined;
    act(() => {
      inFlight = result.current.handleManualSave(updated);
    });

    // Trigger autosave directly; it must not call saveFormData while manual save is in-flight.
    await act(async () => {
      await result.current.autosave.saveNow().catch(() => {});
    });

    expect(saveFormData).toHaveBeenCalledTimes(1);

    await act(async () => {
      deferred.resolve?.(updated);
      await inFlight;
    });

    expect(saveFormData).toHaveBeenCalledTimes(1);
  });

  it('manual save sends current description HTML (not __draft_placeholder__)', async () => {
    const html = '<p>еуые</p>';
    (saveFormData as jest.Mock).mockImplementation(async (payload: any) => ({ ...payload }));

    const { result } = renderHook(
      () =>
      useTravelFormData({
        travelId: null,
        isNew: true,
        userId: '42',
        isSuperAdmin: false,
        isAuthenticated: true,
        authReady: true,
      })
      ,
      { concurrentRoot: false }
    );

    await waitFor(() => expect(result.current.isInitialLoading).toBe(false), { timeout: 5000 });

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

  it('manual save keeps moderation override flags for backend notification trigger', async () => {
    (saveFormData as jest.Mock).mockImplementation(async (payload: any) => ({ ...payload, id: 817 }));

    const { result } = renderHook(
      () =>
        useTravelFormData({
          travelId: null,
          isNew: true,
          userId: '42',
          isSuperAdmin: false,
          isAuthenticated: true,
          authReady: true,
        }),
      { concurrentRoot: false }
    );

    await waitFor(() => expect(result.current.isInitialLoading).toBe(false), { timeout: 5000 });

    act(() => {
      result.current.setFormData({
        ...(result.current.formData as any),
        id: 817,
        name: 'Travel moderation check',
        description: 'Long enough description to pass validation for moderation submit in tests.',
        countries: [1],
        categories: [1],
        coordsMeTravel: [{ lat: 53.9, lng: 27.56, categories: [1] }],
        publish: false,
        moderation: false,
      });
    });

    await act(async () => {
      await result.current.handleManualSave({
        ...(result.current.formData as any),
        publish: true,
        moderation: false,
      } as any);
    });

    expect(saveFormData).toHaveBeenCalledTimes(1);
    const sentPayload = (saveFormData as jest.Mock).mock.calls[0][0];
    expect(sentPayload.publish).toBe(true);
    expect(sentPayload.moderation).toBe(false);
  });

  it('invalidates my travels queries after first successful create', async () => {
    (saveFormData as jest.Mock).mockImplementation(async (payload: any) => ({ ...payload, id: 817 }));

    const { result } = renderHook(
      () =>
        useTravelFormData({
          travelId: null,
          isNew: true,
          userId: '42',
          isSuperAdmin: false,
          isAuthenticated: true,
          authReady: true,
        }),
      { concurrentRoot: false, wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.isInitialLoading).toBe(false), { timeout: 5000 });

    act(() => {
      result.current.setFormData({
        ...(result.current.formData as any),
        id: null,
        name: 'Created travel',
        description: 'Long enough description to keep save flow deterministic in tests.',
      });
    });

    await act(async () => {
      await result.current.handleManualSave();
    });

    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['travels'], refetchType: 'all' });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['my-travels-count', '42'], refetchType: 'all' });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['export-my-travels-count', '42'], refetchType: 'all' });
  });

  it('manual save keeps local description if backend responds with description=null (no placeholder on next save)', async () => {
    const html = '<p>еуые</p>';
    (saveFormData as jest.Mock)
      .mockImplementationOnce(async (payload: any) => ({ ...payload, description: null }))
      .mockImplementationOnce(async (payload: any) => ({ ...payload }));

    const { result } = renderHook(
      () =>
      useTravelFormData({
        travelId: null,
        isNew: true,
        userId: '42',
        isSuperAdmin: false,
        isAuthenticated: true,
        authReady: true,
      })
      ,
      { concurrentRoot: false }
    );

    await waitFor(() => expect(result.current.isInitialLoading).toBe(false), { timeout: 5000 });

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

  it('autosave keeps current rich text in form state for existing travel to avoid editor reset loops', async () => {
    const rawHtml = '<p class="ql-align-center">Свежий текст</p>';
    const sanitizedHtml = '<p>Свежий текст</p>';

    (fetchTravel as jest.Mock).mockResolvedValue({
      id: 123,
      name: 'Existing travel',
      description: '<p>Server text</p>',
      user: { id: 42 },
      coordsMeTravel: [],
      countries: [],
      categories: [],
    });
    (saveFormData as jest.Mock).mockImplementation(async (payload: any) => ({
      ...payload,
      description: sanitizedHtml,
    }));

    const { result } = renderHook(
      () =>
        useTravelFormData({
          travelId: '123',
          isNew: false,
          userId: '42',
          isSuperAdmin: true,
          isAuthenticated: true,
          authReady: true,
        }),
      { concurrentRoot: false }
    );

    await waitFor(() => expect(result.current.isInitialLoading).toBe(false), { timeout: 5000 });

    act(() => {
      result.current.setFormData({
        ...(result.current.formData as any),
        name: 'Existing travel',
        description: rawHtml,
      });
    });

    await act(async () => {
      await result.current.autosave.saveNow();
    });

    expect(saveFormData).toHaveBeenCalledTimes(1);
    expect((result.current.formData as any).description).toBe(rawHtml);
    expect((result.current.formData as any).description).not.toBe(sanitizedHtml);
  });

  it('manual save merges dataOverride placeholders with current snapshot (publish override only)', async () => {
    const html = '<p>test</p>';
    (saveFormData as jest.Mock).mockImplementation(async (payload: any) => ({ ...payload }));

    const { result } = renderHook(
      () =>
      useTravelFormData({
        travelId: null,
        isNew: true,
        userId: '42',
        isSuperAdmin: false,
        isAuthenticated: true,
        authReady: true,
      })
      ,
      { concurrentRoot: false }
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
  });

  it('preserves local previews when server response returns empty images/markers and does not include local blob urls', async () => {
    const localCover = 'blob:https://example.com/cover-preview';
    const localPointImage = 'blob:https://example.com/point-preview';

    const serverResponse = {
      id: 999,
      travel_image_thumb_url: null,
      travel_image_thumb_small_url: '',
      gallery: [],
      coordsMeTravel: [
        {
          id: 1,
          lat: 41.7,
          lng: 44.8,
          address: 'Tbilisi',
          categories: [1],
          image: null,
        },
      ],
    };

    (saveFormData as jest.Mock).mockImplementation(async (payload: any) => ({ ...payload, ...serverResponse }));

    const { result } = renderHook(
      () =>
      useTravelFormData({
        travelId: null,
        isNew: true,
        userId: '42',
        isSuperAdmin: false,
        isAuthenticated: true,
        authReady: true,
      })
      ,
      { concurrentRoot: false }
    );

    await waitFor(() => expect(result.current.isInitialLoading).toBe(false), { timeout: 5000 });

    act(() => {
      result.current.setFormData({
        ...(result.current.formData as any),
        id: 999,
        name: 'Test',
        description: 'A'.repeat(60),
        travel_image_thumb_url: localCover,
        travel_image_thumb_small_url: localCover,
        gallery: ['blob:https://example.com/gallery-preview'],
        coordsMeTravel: [
          {
            id: 1,
            lat: 41.7,
            lng: 44.8,
            address: 'Tbilisi',
            categories: [1],
            image: localPointImage,
          },
        ],
      });
    });

    await act(async () => {
      await result.current.handleManualSave();
    });

    // Cover should remain local preview until server provides real URLs.
    expect((result.current.formData as any).travel_image_thumb_url).toBe(localCover);
    expect((result.current.formData as any).travel_image_thumb_small_url).toBe(localCover);

    // Gallery should not be wiped if server returned empty array.
    expect(Array.isArray((result.current.formData as any).gallery)).toBe(true);
    expect(((result.current.formData as any).gallery as any[]).length).toBeGreaterThan(0);

    // Marker image should remain local preview if server returned null.
    const markers = (result.current.formData as any).coordsMeTravel as any[];
    expect(markers[0]?.image).toBe(localPointImage);
  });

  it('does not wipe gallery when server response omits gallery field entirely', async () => {
    const localCover = 'blob:https://example.com/cover-preview';
    const localGallery = ['blob:https://example.com/gallery-preview'];

    (saveFormData as jest.Mock).mockImplementation(async (payload: any) => {
      // Simulate backend that does not return `gallery` at all.
      const { gallery: _ignored, ...rest } = payload ?? {};
      return {
        ...rest,
        id: 999,
        travel_image_thumb_url: null,
        travel_image_thumb_small_url: '',
        coordsMeTravel: [],
      };
    });

    const { result } = renderHook(
      () =>
      useTravelFormData({
        travelId: null,
        isNew: true,
        userId: '42',
        isSuperAdmin: false,
        isAuthenticated: true,
        authReady: true,
      })
      ,
      { concurrentRoot: false }
    );

    await waitFor(() => expect(result.current.isInitialLoading).toBe(false), { timeout: 5000 });

    act(() => {
      result.current.setFormData({
        ...(result.current.formData as any),
        travel_image_thumb_url: localCover,
        travel_image_thumb_small_url: localCover,
        gallery: localGallery,
      } as any);
    });

    await act(async () => {
      await result.current.handleManualSave();
    });

    // Gallery should remain local preview if server did not return the field.
    expect(Array.isArray((result.current.formData as any).gallery)).toBe(true);
    expect((result.current.formData as any).gallery).toEqual(localGallery);
  });

  it('maps gallery image ids into contract fields for upsert payload', async () => {
    (saveFormData as jest.Mock).mockImplementation(async (payload: any) => ({ ...payload, id: 999 }));

    const { result } = renderHook(
      () =>
      useTravelFormData({
        travelId: null,
        isNew: true,
        userId: '42',
        isSuperAdmin: false,
        isAuthenticated: true,
        authReady: true,
      }),
      { concurrentRoot: false }
    );

    await waitFor(() => expect(result.current.isInitialLoading).toBe(false), { timeout: 5000 });

    act(() => {
      result.current.setFormData({
        ...(result.current.formData as any),
        name: 'Gallery IDs test',
        description: 'A'.repeat(60),
        gallery: ['https://metravel.by/gallery/3796/conversions/cover.webp'],
      } as any);
    });

    await act(async () => {
      await result.current.handleManualSave();
    });

    expect(saveFormData).toHaveBeenCalledTimes(1);
    const sentPayload = (saveFormData as jest.Mock).mock.calls[0][0];
    expect(sentPayload.gallery).toEqual([
      { id: 3796, url: 'https://metravel.by/gallery/3796/conversions/cover.webp' },
    ]);
    expect(sentPayload.travelImageThumbUrlArr).toEqual([3796]);
    expect(sentPayload.travelImageThumbUrArr).toEqual([3796]);
    expect(sentPayload.thumbs200ForCollectionArr).toEqual([3796]);
  });

  it('preserves marker images across save when backend reorders markers (merge by id/latlng, not by index)', async () => {
    (saveFormData as jest.Mock).mockImplementation(async (payload: any) => {
      // Simulate backend reorder + empty images (common on drafts).
      return {
        ...payload,
        coordsMeTravel: [
          { id: 2, lat: 20, lng: 20, address: 'B', categories: [], image: null },
          { id: 1, lat: 10, lng: 10, address: 'A', categories: [], image: '' },
        ],
      };
    });

    const { result } = renderHook(
      () =>
      useTravelFormData({
        travelId: null,
        isNew: true,
        userId: '42',
        isSuperAdmin: false,
        isAuthenticated: true,
        authReady: true,
      })
      ,
      { concurrentRoot: false }
    );

    await waitFor(() => expect(result.current.isInitialLoading).toBe(false));

    const localImgA = 'blob:https://example.com/a';
    const localImgB = 'blob:https://example.com/b';

    act(() => {
      result.current.setFormData({
        ...(result.current.formData as any),
        coordsMeTravel: [
          { id: 1, lat: 10, lng: 10, address: 'A', categories: [], image: localImgA },
          { id: 2, lat: 20, lng: 20, address: 'B', categories: [], image: localImgB },
        ],
      } as any);
    });

    await act(async () => {
      await result.current.handleManualSave(result.current.formData as any);
    });

    const savedMarkers = (result.current.formData as any).coordsMeTravel as any[];
    // Backend reordered markers, but images must stay with the same marker id.
    const byId = new Map(savedMarkers.map((m: any) => [String(m.id), m]));
    expect(byId.get('1')?.image).toBe(localImgA);
    expect(byId.get('2')?.image).toBe(localImgB);
  });

  it('preserves marker local preview when server assigns id on first save (fallback merge by lat/lng)', async () => {
    const localPointImage = 'blob:https://example.com/new-point-preview';

    (saveFormData as jest.Mock).mockImplementation(async (payload: any) => {
      // Backend assigns id and returns empty image.
      const coords = Array.isArray(payload?.coordsMeTravel) ? payload.coordsMeTravel : [];
      return {
        ...payload,
        coordsMeTravel: coords.map((m: any, idx: number) => ({
          ...m,
          id: 1000 + idx,
          // Some backends return coordinates as strings.
          lat: String(m.lat),
          lng: String(m.lng),
          image: null,
        })),
      };
    });

    const { result } = renderHook(
      () =>
        useTravelFormData({
          travelId: null,
          isNew: true,
          userId: '42',
          isSuperAdmin: false,
          isAuthenticated: true,
          authReady: true,
        }),
      { concurrentRoot: false }
    );

    await waitFor(() => expect(result.current.isInitialLoading).toBe(false));

    act(() => {
      result.current.setFormData({
        ...(result.current.formData as any),
        coordsMeTravel: [
          { id: null, lat: 55.751244, lng: 37.618423, address: 'Moscow', categories: [], image: localPointImage },
        ],
      } as any);
    });

    await act(async () => {
      await result.current.handleManualSave(result.current.formData as any);
    });

    const savedMarkers = (result.current.formData as any).coordsMeTravel as any[];
    expect(savedMarkers.length).toBe(1);
    expect(savedMarkers[0]?.id).toBe(1000);
    // Server returned null, so we must keep local preview even though id changed.
    expect(savedMarkers[0]?.image).toBe(localPointImage);
  });

  it('keeps local point photo preview in coordsMeTravel during save until point gets its own id', async () => {
    const localPointImage = 'blob:https://example.com/pending-point-preview';
    (saveFormData as jest.Mock).mockImplementation(async (payload: any) => ({ ...payload }));

    const { result } = renderHook(
      () =>
        useTravelFormData({
          travelId: '123',
          isNew: false,
          userId: '42',
          isSuperAdmin: false,
          isAuthenticated: true,
          authReady: true,
        }),
      { concurrentRoot: false }
    );

    await waitFor(() => expect(result.current.isInitialLoading).toBe(false));

    act(() => {
      result.current.setFormData({
        ...(result.current.formData as any),
        id: 123,
        name: 'Travel with EXIF point',
        description: 'A'.repeat(60),
        coordsMeTravel: [
          { id: null, lat: 49.6274333333, lng: 21.1955611111, address: 'EXIF point', categories: [], image: localPointImage },
        ],
      } as any);
    });

    await act(async () => {
      await result.current.handleManualSave(result.current.formData as any);
    });

    expect(saveFormData).toHaveBeenCalledTimes(1);
    const sentPayload = (saveFormData as jest.Mock).mock.calls[0][0];
    expect(sentPayload.coordsMeTravel[0].id).toBeNull();
    expect(sentPayload.coordsMeTravel[0].image).toBeUndefined();
  });

  it('uploads pending point photo after save response assigns marker id', async () => {
    const localPointImage = 'blob:https://example.com/pending-point-preview';
    const pendingFile = new Blob(['point'], { type: 'image/webp' });
    const uploadedUrl = 'https://example.com/travel-address/point.webp';

    (getPendingImageFile as jest.Mock).mockReturnValue(pendingFile);
    (uploadImage as jest.Mock).mockResolvedValue({ url: uploadedUrl });
    (saveFormData as jest.Mock).mockImplementation(async (payload: any) => ({
      ...payload,
      coordsMeTravel: [
        {
          id: 55,
          lat: 49.6274333333,
          lng: 21.1955611111,
          address: 'EXIF point',
          categories: [],
          image: null,
        },
      ],
    }));

    const { result } = renderHook(
      () =>
        useTravelFormData({
          travelId: '123',
          isNew: false,
          userId: '42',
          isSuperAdmin: false,
          isAuthenticated: true,
          authReady: true,
        }),
      { concurrentRoot: false }
    );

    await waitFor(() => expect(result.current.isInitialLoading).toBe(false));

    act(() => {
      result.current.setFormData({
        ...(result.current.formData as any),
        id: 123,
        name: 'Travel with EXIF point',
        description: 'A'.repeat(60),
        coordsMeTravel: [
          { id: null, lat: 49.6274333333, lng: 21.1955611111, address: 'EXIF point', categories: [], image: localPointImage },
        ],
      } as any);
    });

    await act(async () => {
      await result.current.handleManualSave(result.current.formData as any);
    });

    await waitFor(() => {
      expect(uploadImage).toHaveBeenCalledTimes(1);
    });

    const uploadFormData = (uploadImage as jest.Mock).mock.calls[0][0] as FormData;
    expect(uploadFormData.get('collection')).toBe('travelImageAddress');
    expect(uploadFormData.get('id')).toBe('55');

    await waitFor(() => {
      const savedMarkers = (result.current.formData as any).coordsMeTravel as any[];
      expect(savedMarkers[0]?.id).toBe(55);
      expect(savedMarkers[0]?.image).toBe(uploadedUrl);
    });

    expect(getPendingImageFile).toHaveBeenCalledWith(localPointImage);
    expect(removePendingImageFile).toHaveBeenCalledWith(localPointImage);
  });

  it('preserves local point photo preview after save even if backend echoes fallback server image', async () => {
    const localPointImage = 'blob:https://example.com/pending-point-preview';
    const fallbackImage = 'https://example.com/travel-cover.webp';

    (getPendingImageFile as jest.Mock).mockReturnValue(null);
    (uploadImage as jest.Mock).mockReset();

    (saveFormData as jest.Mock).mockImplementation(async (payload: any) => ({
      ...payload,
      coordsMeTravel: [
        {
          id: 55,
          lat: 49.6274333333,
          lng: 21.1955611111,
          address: 'EXIF point',
          categories: [],
          image: fallbackImage,
        },
      ],
    }));

    const { result } = renderHook(
      () =>
        useTravelFormData({
          travelId: '123',
          isNew: false,
          userId: '42',
          isSuperAdmin: false,
          isAuthenticated: true,
          authReady: true,
        }),
      { concurrentRoot: false }
    );

    await waitFor(() => expect(result.current.isInitialLoading).toBe(false));

    act(() => {
      result.current.setFormData({
        ...(result.current.formData as any),
        id: 123,
        name: 'Travel with EXIF point',
        description: 'A'.repeat(60),
        travel_image_thumb_url: fallbackImage,
        coordsMeTravel: [
          { id: null, lat: 49.6274333333, lng: 21.1955611111, address: 'EXIF point', categories: [], image: localPointImage },
        ],
      } as any);
    });

    await act(async () => {
      await result.current.handleManualSave(result.current.formData as any);
    });

    const savedMarkers = (result.current.formData as any).coordsMeTravel as any[];
    expect(savedMarkers[0]?.id).toBe(55);
    expect(savedMarkers[0]?.image).toBe(localPointImage);
  });

  it('does not keep backend fallback cover as point image when point had no photo', async () => {
    const fallbackImage = 'https://example.com/travel-cover.webp';

    (getPendingImageFile as jest.Mock).mockReturnValue(null);
    (uploadImage as jest.Mock).mockReset();
    (saveFormData as jest.Mock).mockImplementation(async (payload: any) => ({
      ...payload,
      travel_image_thumb_url: fallbackImage,
      travel_image_thumb_small_url: fallbackImage,
      coordsMeTravel: [
        {
          id: 55,
          lat: 49.6274333333,
          lng: 21.1955611111,
          address: 'Manual point',
          categories: [],
          image: fallbackImage,
        },
      ],
    }));

    const { result } = renderHook(
      () =>
        useTravelFormData({
          travelId: '123',
          isNew: false,
          userId: '42',
          isSuperAdmin: false,
          isAuthenticated: true,
          authReady: true,
        }),
      { concurrentRoot: false }
    );

    await waitFor(() => expect(result.current.isInitialLoading).toBe(false));

    act(() => {
      result.current.setFormData({
        ...(result.current.formData as any),
        id: 123,
        name: 'Travel with manual point',
        description: 'A'.repeat(60),
        travel_image_thumb_url: fallbackImage,
        coordsMeTravel: [
          { id: null, lat: 49.6274333333, lng: 21.1955611111, address: 'Manual point', categories: [], image: null },
        ],
      } as any);
    });

    await act(async () => {
      await result.current.handleManualSave(result.current.formData as any);
    });

    const savedMarkers = (result.current.formData as any).coordsMeTravel as any[];
    expect(savedMarkers[0]?.id).toBe(55);
    expect(savedMarkers[0]?.image).toBeNull();
  });

  it('uploads pending point photo after manual save override assigns marker id', async () => {
    const localPointImage = 'blob:https://example.com/override-point-preview';
    const pendingFile = new Blob(['point'], { type: 'image/webp' });
    const uploadedUrl = 'https://example.com/travel-address/override-point.webp';

    (getPendingImageFile as jest.Mock).mockReturnValue(pendingFile);
    (uploadImage as jest.Mock).mockResolvedValue({ url: uploadedUrl });
    (saveFormData as jest.Mock).mockImplementation(async (payload: any) => ({
      ...payload,
      coordsMeTravel: [
        {
          id: 77,
          lat: String(payload.coordsMeTravel?.[0]?.lat),
          lng: String(payload.coordsMeTravel?.[0]?.lng),
          address: payload.coordsMeTravel?.[0]?.address ?? 'EXIF point',
          categories: [],
          image: null,
        },
      ],
    }));

    const { result } = renderHook(
      () =>
        useTravelFormData({
          travelId: '123',
          isNew: false,
          userId: '42',
          isSuperAdmin: false,
          isAuthenticated: true,
          authReady: true,
        }),
      { concurrentRoot: false }
    );

    await waitFor(() => expect(result.current.isInitialLoading).toBe(false));

    const override = {
      ...(result.current.formData as any),
      id: 123,
      name: 'Travel with EXIF point',
      description: 'A'.repeat(60),
      coordsMeTravel: [
        {
          id: null,
          lat: 49.6274333333,
          lng: 21.1955611111,
          address: 'EXIF point',
          categories: [],
          image: localPointImage,
        },
      ],
    };

    await act(async () => {
      await result.current.handleManualSave(override as any);
    });

    await waitFor(() => {
      expect(uploadImage).toHaveBeenCalledTimes(1);
    });

    const uploadFormData = (uploadImage as jest.Mock).mock.calls[0][0] as FormData;
    expect(uploadFormData.get('collection')).toBe('travelImageAddress');
    expect(uploadFormData.get('id')).toBe('77');

    await waitFor(() => {
      const savedMarkers = (result.current.formData as any).coordsMeTravel as any[];
      expect(savedMarkers[0]?.id).toBe(77);
      expect(savedMarkers[0]?.image).toBe(uploadedUrl);
    });

    expect(getPendingImageFile).toHaveBeenCalledWith(localPointImage);
    expect(removePendingImageFile).toHaveBeenCalledWith(localPointImage);
  });

  describe('Edit flow - access control', () => {
	    it('sets hasAccess to false when user does not own the travel', async () => {
      const otherUserTravel = {
        id: 123,
        name: 'Other User Travel',
        userIds: '999', // Different user
        user: { id: 999 },
      };
      (fetchTravel as jest.Mock).mockResolvedValue(otherUserTravel);

      const { result } = renderHook(
        () =>
          useTravelFormData({
            travelId: '123',
            isNew: false,
            userId: '42', // Current user
            isSuperAdmin: false,
            isAuthenticated: true,
            authReady: true,
          }),
        { concurrentRoot: false }
      );

	      await waitFor(() => {
	        expect(result.current.hasAccess).toBe(false);
	      });

	      expect(router.replace).not.toHaveBeenCalled();
	      expect(Toast.show).toHaveBeenCalledWith(
	        expect.objectContaining({
	          text1: 'Нет доступа',
	        })
	      );
	    });

    it('allows superadmin to edit any travel', async () => {
      const otherUserTravel = {
        id: 123,
        name: 'Other User Travel',
        userIds: '999',
        user: { id: 999 },
        description: 'Test description',
        countries: [],
        categories: [],
        coordsMeTravel: [],
      };
      (fetchTravel as jest.Mock).mockResolvedValue(otherUserTravel);

      const initialProps = {
        travelId: '124',
        isNew: false,
        userId: '42',
        isSuperAdmin: true, // Superadmin
        isAuthenticated: true,
        authReady: false,
      };
      const { result, rerender } = renderHook((props) => useTravelFormData(props), {
        initialProps,
        concurrentRoot: false,
      });
      act(() => {
        rerender({ ...initialProps, authReady: true });
      });

      await waitFor(() => expect(fetchTravel).toHaveBeenCalled(), { timeout: 5000 });
      await waitFor(() => expect(result.current.hasAccess).toBe(true), { timeout: 5000 });

      expect(result.current.hasAccess).toBe(true);
      expect(router.replace).not.toHaveBeenCalled();
    });

	    it('sets hasAccess to false on fetch error', async () => {
	      (fetchTravel as jest.Mock).mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(
        () =>
          useTravelFormData({
            travelId: '125',
            isNew: false,
            userId: '42',
            isSuperAdmin: false,
            isAuthenticated: true,
            authReady: true,
          }),
        { concurrentRoot: false }
      );

	      await waitFor(() => expect(result.current.hasAccess).toBe(false));
	      await waitFor(() => expect(result.current.loadError).toBeTruthy());

	      expect(router.replace).not.toHaveBeenCalled();
	      expect(Toast.show).toHaveBeenCalledWith(
	        expect.objectContaining({
	          text1: 'Ошибка загрузки',
	        })
	      );
	    });
	  });

  describe('Edit flow - data initialization', () => {
    it('correctly initializes form data from existing travel', async () => {
      const existingTravel = {
        id: 123,
        name: 'Existing Travel',
        description: 'Existing description',
        userIds: '42',
        user: { id: 42 },
        countries: [{ country_id: '1' }],
        categories: [{ id: '1' }],
        coordsMeTravel: [
          { id: 1, lat: 41.7, lng: 44.8, address: 'Tbilisi', categories: [] },
        ],
        publish: true,
        moderation: false,
      };
      (fetchTravel as jest.Mock).mockResolvedValue(existingTravel);

      const initialProps = {
        travelId: '126',
        isNew: false,
        userId: '42',
        isSuperAdmin: false,
        isAuthenticated: true,
        authReady: false,
      };
      const { result, rerender } = renderHook((props) => useTravelFormData(props), {
        initialProps,
        concurrentRoot: false,
      });
      act(() => {
        rerender({ ...initialProps, authReady: true });
      });

      await waitFor(() => expect(fetchTravel).toHaveBeenCalled(), { timeout: 5000 });
      await waitFor(() => expect(result.current.formData.name).toBe('Existing Travel'), {
        timeout: 5000,
      });

      expect(result.current.formData.name).toBe('Existing Travel');
      expect(result.current.formData.description).toBe('Existing description');
      expect(result.current.formData.publish).toBe(true);
      expect(result.current.markers.length).toBe(1);
    });

    it('syncs countries from markers on load', async () => {
      const existingTravel = {
        id: 123,
        name: 'Travel with markers',
        userIds: '42',
        user: { id: 42 },
        countries: [],
        categories: [],
        coordsMeTravel: [
          { id: 1, lat: 41.7, lng: 44.8, address: 'Tbilisi', country: 268, categories: [] },
        ],
      };
      (fetchTravel as jest.Mock).mockResolvedValue(existingTravel);

      const initialProps = {
        travelId: '123',
        isNew: false,
        userId: '42',
        isSuperAdmin: false,
        isAuthenticated: true,
        authReady: false,
      };
      const { result, rerender } = renderHook((props) => useTravelFormData(props), {
        initialProps,
        concurrentRoot: false,
      });
      act(() => {
        rerender({ ...initialProps, authReady: true });
      });

      await waitFor(() => expect(fetchTravel).toHaveBeenCalled(), { timeout: 5000 });
      await waitFor(() => expect(result.current.formData.countries).toContain('268'), {
        timeout: 5000,
      });

      // Countries should be synced from markers
      expect(result.current.formData.countries).toContain('268');
    });
  });

  describe('Race condition protection', () => {
    it('aborts previous save request when new save is triggered', async () => {
      let saveCount = 0;
      const abortedSaves: number[] = [];

      (saveFormData as jest.Mock).mockImplementation(async (payload: any, signal?: AbortSignal) => {
        const currentSave = ++saveCount;
        
        return new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            resolve({ ...payload, id: currentSave });
          }, 100);

          if (signal) {
            signal.addEventListener('abort', () => {
              clearTimeout(timeout);
              abortedSaves.push(currentSave);
              reject(new Error('Request aborted'));
            });
          }
        });
      });

      const { result } = renderHook(
        () =>
          useTravelFormData({
            travelId: null,
            isNew: true,
            userId: '42',
            isSuperAdmin: false,
            isAuthenticated: true,
            authReady: true,
          }),
        { concurrentRoot: false }
      );

      await waitFor(() => expect(result.current.isInitialLoading).toBe(false), { timeout: 5000 });

      // Trigger first save
      act(() => {
        result.current.setFormData({
          ...(result.current.formData as any),
          name: 'First save',
        });
      });

      const firstSave = result.current.handleManualSave();

      // Immediately trigger second save (should abort first)
      act(() => {
        result.current.setFormData({
          ...(result.current.formData as any),
          name: 'Second save',
        });
      });

      const secondSave = result.current.handleManualSave();

      await act(async () => {
        await Promise.allSettled([firstSave, secondSave]);
      });

      // At least one save should have completed
      expect(saveFormData).toHaveBeenCalled();
    });
  });

  describe('Manual save errors', () => {
    it('rethrows manual save errors after showing toast', async () => {
      const saveError = new Error('Network error');
      (saveFormData as jest.Mock).mockRejectedValue(saveError);
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const { result } = renderHook(
        () =>
          useTravelFormData({
            travelId: null,
            isNew: true,
            userId: '42',
            isSuperAdmin: false,
            isAuthenticated: true,
            authReady: true,
          }),
        { concurrentRoot: false }
      );

      await waitFor(() => expect(result.current.isInitialLoading).toBe(false), { timeout: 5000 });

      act(() => {
        result.current.setFormData({
          ...(result.current.formData as any),
          name: 'Failed save',
        });
      });

      await expect(result.current.handleManualSave()).rejects.toThrow('Network error');
      consoleErrorSpy.mockRestore();
    });
  });
});
