import { useCallback, useRef, useState } from 'react';
import { act, renderHook } from '@testing-library/react-native';

import { uploadImage } from '@/api/misc';
import { useMarkerImageUpload } from '@/hooks/useMarkerImageUpload';
import type { MarkerData, TravelFormData } from '@/types/types';
import {
  getPendingImageFile,
  removePendingImageFile,
} from '@/utils/pendingImageFiles';

jest.mock('@/api/misc', () => ({
  uploadImage: jest.fn(),
}));

jest.mock('@/api/travelsApi', () => ({
  fetchTravel: jest.fn(),
}));

jest.mock('@/utils/pendingImageFiles', () => ({
  getPendingImageFile: jest.fn(),
  removePendingImageFile: jest.fn(),
}));

describe('useMarkerImageUpload', () => {
  const blobUrl = 'blob:https://example.com/route-point-preview';
  const uploadedUrl = 'https://example.com/travel-address/route-point.webp';
  const marker: MarkerData = {
    id: 55,
    lat: 49.6274,
    lng: 21.1955,
    country: null,
    address: 'EXIF point',
    categories: [],
    image: blobUrl,
  };

  const originalRequestAnimationFrame = globalThis.requestAnimationFrame;
  const originalRevokeObjectURL = globalThis.URL.revokeObjectURL;

  afterEach(() => {
    (uploadImage as jest.MockedFunction<typeof uploadImage>).mockReset();
    (getPendingImageFile as jest.MockedFunction<typeof getPendingImageFile>).mockReset();
    (removePendingImageFile as jest.MockedFunction<typeof removePendingImageFile>).mockReset();
    Object.defineProperty(globalThis, 'requestAnimationFrame', {
      configurable: true,
      writable: true,
      value: originalRequestAnimationFrame,
    });
    Object.defineProperty(globalThis.URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: originalRevokeObjectURL,
    });
  });

  it('replaces a backend fallback that arrived while the blob upload was in flight', async () => {
    const fallbackUrl = 'https://example.com/travel-cover/fallback.webp';
    const pendingFile = new File(['point'], 'point.webp', { type: 'image/webp' });
    Object.defineProperty(globalThis, 'requestAnimationFrame', {
      configurable: true,
      writable: true,
      value: jest.fn(() => 1),
    });
    (getPendingImageFile as jest.MockedFunction<typeof getPendingImageFile>)
      .mockReturnValue(pendingFile);
    (uploadImage as jest.MockedFunction<typeof uploadImage>)
      .mockResolvedValue({ url: uploadedUrl });

    const formDataRef = {
      current: {
        coordsMeTravel: [marker],
      } as TravelFormData,
    };
    const updateFormMarkers = jest.fn();
    const updateBaseline = jest.fn();
    const { result } = renderHook(
      () =>
        useMarkerImageUpload({
          formDataRef,
          updateFormMarkers,
          updateBaseline,
        }),
      { concurrentRoot: false },
    );

    let upload!: Promise<void>;
    act(() => {
      upload = result.current.uploadPendingMarkerImages([marker]);
    });
    formDataRef.current = {
      ...formDataRef.current,
      coordsMeTravel: [{ ...marker, image: fallbackUrl }],
    };

    await act(async () => {
      await upload;
    });

    expect(formDataRef.current.coordsMeTravel[0]?.image).toBe(uploadedUrl);
    expect(updateFormMarkers).toHaveBeenCalledWith(
      [expect.objectContaining({ id: 55, image: uploadedUrl })],
      expect.objectContaining({
        coordsMeTravel: [expect.objectContaining({ id: 55, image: uploadedUrl })],
      }),
    );
    expect(updateBaseline).toHaveBeenCalledWith(
      expect.objectContaining({
        coordsMeTravel: [expect.objectContaining({ id: 55, image: uploadedUrl })],
      }),
    );
    expect(removePendingImageFile).toHaveBeenCalledWith(blobUrl);
  });

  it('does not let an old upload completion overwrite a newer local preview', () => {
    const newerBlobUrl = 'blob:https://example.com/newer-route-point-preview';
    const formDataRef = {
      current: {
        coordsMeTravel: [{ ...marker, image: newerBlobUrl }],
      } as TravelFormData,
    };
    const updateFormMarkers = jest.fn();
    const updateBaseline = jest.fn();
    const { result } = renderHook(
      () =>
        useMarkerImageUpload({
          formDataRef,
          updateFormMarkers,
          updateBaseline,
        }),
      { concurrentRoot: false },
    );

    act(() => {
      result.current.applyUploadedMarkerImage('55', blobUrl, uploadedUrl);
    });

    expect(formDataRef.current.coordsMeTravel[0]?.image).toBe(newerBlobUrl);
    expect(updateFormMarkers).not.toHaveBeenCalled();
    expect(updateBaseline).not.toHaveBeenCalled();
  });

  it('keeps uploaded photo B when older upload A completes last', async () => {
    const blobUrlB = 'blob:https://example.com/route-point-preview-b';
    const uploadedUrlB = 'https://example.com/travel-address/route-point-b.webp';
    const fileA = new File(['point-a'], 'point-a.webp', { type: 'image/webp' });
    const fileB = new File(['point-b'], 'point-b.webp', { type: 'image/webp' });
    let resolveUploadA!: (value: Awaited<ReturnType<typeof uploadImage>>) => void;
    let resolveUploadB!: (value: Awaited<ReturnType<typeof uploadImage>>) => void;
    const uploadAResponse = new Promise<Awaited<ReturnType<typeof uploadImage>>>((resolve) => {
      resolveUploadA = resolve;
    });
    const uploadBResponse = new Promise<Awaited<ReturnType<typeof uploadImage>>>((resolve) => {
      resolveUploadB = resolve;
    });
    Object.defineProperty(globalThis, 'requestAnimationFrame', {
      configurable: true,
      writable: true,
      value: jest.fn(() => 1),
    });
    (getPendingImageFile as jest.MockedFunction<typeof getPendingImageFile>)
      .mockImplementation((url) => {
        if (url === blobUrl) return fileA;
        if (url === blobUrlB) return fileB;
        return null;
      });
    (uploadImage as jest.MockedFunction<typeof uploadImage>)
      .mockImplementation((formData) => {
        const file = formData.get('file');
        return file instanceof File && file.name === fileA.name
          ? uploadAResponse
          : uploadBResponse;
      });

    const formDataRef = {
      current: {
        coordsMeTravel: [marker],
      } as TravelFormData,
    };
    const updateFormMarkers = jest.fn();
    const updateBaseline = jest.fn();
    const { result } = renderHook(
      () =>
        useMarkerImageUpload({
          formDataRef,
          updateFormMarkers,
          updateBaseline,
        }),
      { concurrentRoot: false },
    );

    let uploadA!: Promise<void>;
    act(() => {
      uploadA = result.current.uploadPendingMarkerImages([marker]);
    });
    formDataRef.current = {
      ...formDataRef.current,
      coordsMeTravel: [{ ...marker, image: blobUrlB }],
    };
    let uploadB!: Promise<void>;
    act(() => {
      uploadB = result.current.uploadPendingMarkerImages([
        { ...marker, image: blobUrlB },
      ]);
    });

    await act(async () => {
      resolveUploadB({ url: uploadedUrlB });
      await uploadB;
    });
    expect(formDataRef.current.coordsMeTravel[0]?.image).toBe(uploadedUrlB);

    await act(async () => {
      resolveUploadA({ url: uploadedUrl });
      await uploadA;
    });

    expect(formDataRef.current.coordsMeTravel[0]?.image).toBe(uploadedUrlB);
    expect(updateFormMarkers).toHaveBeenCalledTimes(1);
    expect(updateBaseline).toHaveBeenCalledTimes(1);
  });

  it('does not restore an uploaded image after the user removed the preview', async () => {
    const pendingFile = new File(['point'], 'point.webp', { type: 'image/webp' });
    let resolveUpload!: (value: Awaited<ReturnType<typeof uploadImage>>) => void;
    const uploadResponse = new Promise<Awaited<ReturnType<typeof uploadImage>>>((resolve) => {
      resolveUpload = resolve;
    });
    Object.defineProperty(globalThis, 'requestAnimationFrame', {
      configurable: true,
      writable: true,
      value: jest.fn(() => 1),
    });
    (getPendingImageFile as jest.MockedFunction<typeof getPendingImageFile>)
      .mockReturnValue(pendingFile);
    (uploadImage as jest.MockedFunction<typeof uploadImage>)
      .mockReturnValue(uploadResponse);

    const formDataRef = {
      current: {
        coordsMeTravel: [marker],
      } as TravelFormData,
    };
    const updateFormMarkers = jest.fn();
    const updateBaseline = jest.fn();
    const { result } = renderHook(
      () =>
        useMarkerImageUpload({
          formDataRef,
          updateFormMarkers,
          updateBaseline,
        }),
      { concurrentRoot: false },
    );

    let upload!: Promise<void>;
    act(() => {
      upload = result.current.uploadPendingMarkerImages([marker]);
    });
    formDataRef.current = {
      ...formDataRef.current,
      coordsMeTravel: [{ ...marker, image: null }],
    };

    await act(async () => {
      resolveUpload({ url: uploadedUrl });
      await upload;
    });

    expect(formDataRef.current.coordsMeTravel[0]?.image).toBeNull();
    expect(updateFormMarkers).not.toHaveBeenCalled();
    expect(updateBaseline).not.toHaveBeenCalled();
    expect(removePendingImageFile).toHaveBeenCalledWith(blobUrl);
  });

  it('keeps a failed upload pending and limits retries to three attempts', async () => {
    const pendingFile = new File(['point'], 'point.webp', { type: 'image/webp' });
    const revokeObjectURL = jest.fn();
    Object.defineProperty(globalThis.URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: revokeObjectURL,
    });
    (getPendingImageFile as jest.MockedFunction<typeof getPendingImageFile>)
      .mockReturnValue(pendingFile);
    (uploadImage as jest.MockedFunction<typeof uploadImage>)
      .mockRejectedValue(new Error('transient upload failure'));

    const formDataRef = {
      current: {
        coordsMeTravel: [marker],
      } as TravelFormData,
    };
    const updateFormMarkers = jest.fn();
    const updateBaseline = jest.fn();
    const { result } = renderHook(
      () =>
        useMarkerImageUpload({
          formDataRef,
          updateFormMarkers,
          updateBaseline,
        }),
      { concurrentRoot: false },
    );

    for (let attempt = 0; attempt < 4; attempt += 1) {
      await act(async () => {
        await result.current.uploadPendingMarkerImages([marker]);
      });
    }

    expect(uploadImage).toHaveBeenCalledTimes(3);
    expect(formDataRef.current.coordsMeTravel[0]?.image).toBe(blobUrl);
    expect(updateFormMarkers).not.toHaveBeenCalled();
    expect(updateBaseline).not.toHaveBeenCalled();
    expect(removePendingImageFile).not.toHaveBeenCalled();
    expect(revokeObjectURL).not.toHaveBeenCalled();
  });

  it('keeps the blob preview alive after the swap so a repaint cannot hit a revoked source', async () => {
    jest.useFakeTimers();
    const pendingFile = new File(['point'], 'point.webp', { type: 'image/webp' });
    const frameCallbacks: FrameRequestCallback[] = [];
    let renderedSource = blobUrl;
    let renderedSourceAtRevoke = '';
    const revokeObjectURL = jest.fn(() => {
      renderedSourceAtRevoke = renderedSource;
    });
    Object.defineProperty(globalThis, 'requestAnimationFrame', {
      configurable: true,
      writable: true,
      value: jest.fn((callback: FrameRequestCallback) => {
        frameCallbacks.push(callback);
        return frameCallbacks.length;
      }),
    });
    Object.defineProperty(globalThis.URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: revokeObjectURL,
    });
    (getPendingImageFile as jest.MockedFunction<typeof getPendingImageFile>)
      .mockReturnValue(pendingFile);
    (uploadImage as jest.MockedFunction<typeof uploadImage>)
      .mockResolvedValue({ url: uploadedUrl });

    const updateBaseline = jest.fn();
    const { result } = renderHook(
      () => {
        const formDataRef = useRef({
          coordsMeTravel: [marker],
        } as TravelFormData);
        const [renderedFormData, setRenderedFormData] = useState(formDataRef.current);
        renderedSource = String(renderedFormData.coordsMeTravel[0]?.image ?? '');
        const updateFormMarkers = useCallback(
          (_markers: MarkerData[], nextFormData: TravelFormData) => {
            setRenderedFormData(nextFormData);
          },
          [],
        );
        const upload = useMarkerImageUpload({
          formDataRef,
          updateFormMarkers,
          updateBaseline,
        });
        return { ...upload, renderedFormData };
      },
      { concurrentRoot: false },
    );

    try {
      await act(async () => {
        await result.current.uploadPendingMarkerImages([marker]);
      });

      expect(result.current.renderedFormData.coordsMeTravel[0]?.image).toBe(uploadedUrl);
      expect(removePendingImageFile).toHaveBeenCalledWith(blobUrl);
      // Кадр раньше коммита апдейта из промиса: revoke по rAF успевает убить
      // blob, пока в DOM ещё стоит превью — миниатюра точки остаётся пустой.
      expect(frameCallbacks).toHaveLength(0);
      expect(revokeObjectURL).not.toHaveBeenCalled();

      act(() => {
        jest.advanceTimersByTime(14_000);
      });
      expect(revokeObjectURL).not.toHaveBeenCalled();

      act(() => {
        jest.advanceTimersByTime(2_000);
      });
      expect(revokeObjectURL).toHaveBeenCalledTimes(1);
      expect(revokeObjectURL).toHaveBeenCalledWith(blobUrl);
      expect(renderedSourceAtRevoke).toBe(uploadedUrl);
    } finally {
      jest.useRealTimers();
    }
  });

  it('never revokes a preview whose swap did not reach the form and reuses the uploaded url', async () => {
    jest.useFakeTimers();
    const pendingFile = new File(['point'], 'point.webp', { type: 'image/webp' });
    const revokeObjectURL = jest.fn();
    Object.defineProperty(globalThis.URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: revokeObjectURL,
    });
    (getPendingImageFile as jest.MockedFunction<typeof getPendingImageFile>)
      .mockReturnValue(pendingFile);
    (uploadImage as jest.MockedFunction<typeof uploadImage>)
      .mockResolvedValue({ url: uploadedUrl });

    const updateFormMarkers = jest.fn();
    const updateBaseline = jest.fn();
    // Точка временно потеряла id в форме: подменять картинку не в чем.
    const formDataRef = {
      current: { coordsMeTravel: [{ ...marker, id: null }] } as unknown as TravelFormData,
    };
    const { result } = renderHook(() => useMarkerImageUpload({
      formDataRef,
      updateFormMarkers,
      updateBaseline,
    }));

    try {
      await act(async () => {
        await result.current.uploadPendingMarkerImages([marker]);
      });

      expect(uploadImage).toHaveBeenCalledTimes(1);
      expect(updateFormMarkers).not.toHaveBeenCalled();
      expect(removePendingImageFile).not.toHaveBeenCalled();
      act(() => {
        jest.advanceTimersByTime(60_000);
      });
      expect(revokeObjectURL).not.toHaveBeenCalled();

      // Id вернулся — следующий сейв доклеивает готовый url без повторной заливки.
      formDataRef.current = { coordsMeTravel: [marker] } as unknown as TravelFormData;
      await act(async () => {
        await result.current.uploadPendingMarkerImages([marker]);
      });

      expect(uploadImage).toHaveBeenCalledTimes(1);
      expect(updateFormMarkers).toHaveBeenCalledTimes(1);
      expect(updateFormMarkers.mock.calls[0][0][0].image).toBe(uploadedUrl);
      expect(removePendingImageFile).toHaveBeenCalledWith(blobUrl);
    } finally {
      jest.useRealTimers();
    }
  });

  it('re-uploads the file when the point came back with another id', async () => {
    const pendingFile = new File(['point'], 'point.webp', { type: 'image/webp' });
    const recreatedMarkerId = 56;
    const uploadedUrlForRecreated = 'https://example.com/travel-address/route-point-56.webp';
    (getPendingImageFile as jest.MockedFunction<typeof getPendingImageFile>)
      .mockReturnValue(pendingFile);
    (uploadImage as jest.MockedFunction<typeof uploadImage>)
      .mockResolvedValueOnce({ url: uploadedUrl })
      .mockResolvedValueOnce({ url: uploadedUrlForRecreated });

    const updateFormMarkers = jest.fn();
    const updateBaseline = jest.fn();
    // Точка ушла в сейв без id: апсерт удалил прежнюю строку и создал новую с
    // пустой картинкой, поэтому старый url к ней не относится.
    const formDataRef = {
      current: { coordsMeTravel: [{ ...marker, id: null }] } as unknown as TravelFormData,
    };
    const { result } = renderHook(
      () => useMarkerImageUpload({ formDataRef, updateFormMarkers, updateBaseline }),
      { concurrentRoot: false },
    );

    await act(async () => {
      await result.current.uploadPendingMarkerImages([marker]);
    });
    expect(updateFormMarkers).not.toHaveBeenCalled();

    const recreatedMarker = { ...marker, id: recreatedMarkerId };
    formDataRef.current = {
      coordsMeTravel: [recreatedMarker],
    } as unknown as TravelFormData;
    await act(async () => {
      await result.current.uploadPendingMarkerImages([recreatedMarker]);
    });

    expect(uploadImage).toHaveBeenCalledTimes(2);
    const secondUploadBody = (uploadImage as jest.MockedFunction<typeof uploadImage>)
      .mock.calls[1][0];
    expect(secondUploadBody.get('id')).toBe(String(recreatedMarkerId));
    expect(updateFormMarkers).toHaveBeenCalledTimes(1);
    expect(updateFormMarkers.mock.calls[0][0][0].image).toBe(uploadedUrlForRecreated);
  });
});
