import React from 'react';
import { Platform, Image, StyleSheet } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { QueryClientContext } from '@tanstack/react-query';

import ImageGalleryComponent from '@/components/travel/ImageGalleryComponent.web';
import {
  createGalleryStyles,
  createMobileWebStaticFrostStyle,
} from '@/components/travel/gallery/styles';
import { MODERN_MATTE_PALETTE, MODERN_MATTE_SHADOWS, MODERN_MATTE_BOX_SHADOWS } from '@/constants/modernMattePalette';

jest.mock('@/components/ui/OptimizedImage', () => {
  const React = require('react');
  const { Image } = require('react-native');
  const fired = new Set();

  return ({ source, onError, onLoad }: any) => {
    const uri = source?.uri;

    React.useEffect(() => {
      if (!uri) return;
      const key = String(uri);
      if (fired.has(key)) return;
      fired.add(key);

      if (key.includes('/404')) {
        onError?.();
      } else {
        onLoad?.();
      }
    }, [uri, onError, onLoad]);

    return React.createElement(Image, {
      testID: 'gallery-image',
      accessibilityLabel: 'Gallery image',
      source,
    });
  };
});

jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  launchCameraAsync: jest.fn(async () => ({ canceled: true })),
  MediaTypeOptions: {},
  PermissionStatus: { GRANTED: 'granted' },
}));

jest.mock('react-dropzone', () => {
  const dropMock = { rootProps: {}, tabIndex: undefined, onDrop: (_files: any) => {}, accept: undefined };
  return {
    useDropzone: (opts: any) => {
      dropMock.onDrop = opts.onDrop;
      dropMock.accept = opts.accept;
      return {
        getRootProps: () => ({ tabIndex: -1 }),
        getInputProps: () => ({ accept: opts.accept, multiple: opts.multiple }),
        isDragActive: false,
        onDrop: opts.onDrop,
      };
    },
    __dropMock: dropMock,
  };
});

jest.mock('@/utils/webImageUpload', () => {
  const prepareWebImageFileForUpload = jest.fn(async (file: File) => file);
  return {
    __esModule: true,
    prepareWebImageFileForUpload,
    __mocks: { prepareWebImageFileForUpload },
  };
});

jest.mock('@/components/ui/ConfirmDialog', () => {
  const React = require('react');
  const { View, TouchableOpacity, Text } = require('react-native');
  return ({ visible, onConfirm, onClose }: any) =>
    visible
      ? React.createElement(
          View,
          null,
          React.createElement(
            TouchableOpacity,
            { testID: 'confirm-delete', onPress: onConfirm },
            React.createElement(Text, null, 'confirm'),
          ),
          React.createElement(
            TouchableOpacity,
            { testID: 'cancel-delete', onPress: onClose },
            React.createElement(Text, null, 'cancel'),
          ),
        )
      : null;
});

jest.mock('@/api/misc', () => {
  const uploadImageMock = jest.fn(async () => ({ id: 'uploaded-1', url: '/uploaded.jpg' }));
  const deleteImageMock = jest.fn(async () => undefined);
  const reorderGalleryMock = jest.fn(async () => ({ gallery: [] }));
  const updateGalleryCaptionMock = jest.fn(async (_id: string, caption: string) => ({ id: 1, caption }));
  return {
    __esModule: true,
    uploadImage: uploadImageMock,
    deleteImage: deleteImageMock,
    reorderGallery: reorderGalleryMock,
    updateGalleryCaption: updateGalleryCaptionMock,
    __mocks: { uploadImageMock, deleteImageMock, reorderGalleryMock, updateGalleryCaptionMock },
  };
});

const { __mocks } = jest.requireMock('@/api/misc') as any;
const uploadImageMock = __mocks.uploadImageMock as jest.Mock;
const deleteImageMock = __mocks.deleteImageMock as jest.Mock;
const reorderGalleryMock = __mocks.reorderGalleryMock as jest.Mock;
const updateGalleryCaptionMock = __mocks.updateGalleryCaptionMock as jest.Mock;
const { __mocks: webImageUploadMocks } = jest.requireMock('@/utils/webImageUpload') as any;
const prepareWebImageFileForUploadMock = webImageUploadMocks.prepareWebImageFileForUpload as jest.Mock;

const renderSafe = (ui: React.ReactElement) => {
  try {
    return render(ui);
  } catch (e) {
    console.error('renderSafe error:', e);
    throw e;
  }
};

const runDrop = async (files: File[]) => {
  const { __dropMock } = jest.requireMock('react-dropzone') as any;
  await act(async () => {
    await __dropMock.onDrop(files);
  });
};

const runDropNoWait = (files: File[]) => {
  const { __dropMock } = jest.requireMock('react-dropzone') as any;
  act(() => {
    // Intentionally do not await onDrop; some tests keep upload promise pending.
    __dropMock.onDrop(files);
  });
};

describe('ImageGalleryComponent.web', () => {
  const originalPlatform = Platform.OS;
  const originalCreateObjectURL = URL.createObjectURL;
  const originalWindowLocation = window.location;

  beforeAll(() => {
    Object.defineProperty(Platform, 'OS', { value: 'web' });
    URL.createObjectURL = jest.fn(() => 'blob://preview');
    process.env.EXPO_PUBLIC_API_URL = 'https://example.test/api';

    // jsdom treats window.location as readonly; redefine for deterministic origin.
    // @ts-ignore -- jsdom readonly window.location: must delete before reassigning in tests
    delete (window as any).location;
    const href = 'http://localhost:8081/travel/42';
    (window as any).location = {
      ...originalWindowLocation,
      href,
      origin: 'http://localhost:8081',
      protocol: 'http:',
      hostname: 'localhost',
      host: 'localhost:8081',
      pathname: '/travel/42',
      search: '',
      hash: '',
      assign: jest.fn(),
      replace: jest.fn(),
      reload: jest.fn(),
      toString: () => href,
    };
  });

  afterAll(() => {
    Object.defineProperty(Platform, 'OS', { value: originalPlatform });
    URL.createObjectURL = originalCreateObjectURL;

    // restore jsdom location
    // @ts-ignore -- jsdom readonly window.location: must delete before restoring in tests
    delete (window as any).location;
    (window as any).location = originalWindowLocation;
  });

  beforeEach(() => {
    jest.useRealTimers();
    uploadImageMock.mockClear();
    deleteImageMock.mockClear();
    reorderGalleryMock.mockClear();
    updateGalleryCaptionMock.mockClear();
    prepareWebImageFileForUploadMock.mockClear();
    prepareWebImageFileForUploadMock.mockImplementation(async (file: File) => file);
  });

  it('renders initial images with absolute URLs and count', () => {
    const { getByText, UNSAFE_getAllByType } = renderSafe(
      <ImageGalleryComponent
        collection="gallery"
        idTravel="42"
        initialImages={[{ id: '1', url: '/relative.jpg' }]}
        maxImages={5}
      />,
    );

    expect(getByText(/Загружено/)).toBeTruthy();
    const image = UNSAFE_getAllByType(Image)[0];
    expect(image).toBeTruthy();
  });

  it('shows initial images with delete buttons', () => {
    const { getAllByTestId } = renderSafe(
      <ImageGalleryComponent
        collection="gallery"
        idTravel="42"
        initialImages={[
          { id: '1', url: 'https://example.com/pic1.jpg' },
          { id: '2', url: 'https://example.com/pic2.jpg' },
          { id: '3', url: 'https://example.com/pic3.jpg' },
        ]}
        maxImages={5}
      />,
    );

    const images = getAllByTestId('gallery-image');
    expect(images.length).toBeGreaterThanOrEqual(3);
    const deleteButtons = getAllByTestId('delete-image-button');
    expect(deleteButtons.length).toBeGreaterThanOrEqual(3); // overlay + corner buttons
  });

  it('saves a place caption for each backend gallery image and reports it to the form', async () => {
    const onChange = jest.fn();
    const { getByTestId, getByText } = renderSafe(
      <ImageGalleryComponent
        collection="gallery"
        idTravel="42"
        initialImages={[{ id: '41', url: 'https://example.com/pic1.jpg', caption: '' }]}
        maxImages={5}
        onChange={onChange}
      />,
    );

    const input = getByTestId('gallery-caption-input-41');
    fireEvent.changeText(input, '  Мирский замок  ');
    fireEvent(input, 'blur');

    await waitFor(() => {
      expect(updateGalleryCaptionMock).toHaveBeenCalledWith('41', 'Мирский замок');
      expect(getByText('Сохранено')).toBeTruthy();
      expect(onChange).toHaveBeenLastCalledWith([
        expect.objectContaining({ id: '41', caption: 'Мирский замок' }),
      ]);
    });
  });

  it('does not call the caption API for a temporary image id', () => {
    const { queryByTestId } = renderSafe(
      <ImageGalleryComponent
        collection="gallery"
        idTravel="42"
        initialImages={[{ id: 'legacy-0', url: 'https://example.com/pic1.jpg', caption: '' }]}
        maxImages={5}
      />,
    );

    expect(queryByTestId('gallery-caption-input-legacy-0')).toBeNull();
    expect(updateGalleryCaptionMock).not.toHaveBeenCalled();
  });

  it('uploads files via dropzone and finalizes', async () => {
    const file = new File(['data'], 'test.jpg', { type: 'image/jpeg' });

    const { getByText, findAllByTestId } = renderSafe(
      <ImageGalleryComponent collection="gallery" idTravel="42" initialImages={[]} maxImages={5} />,
    );

    await runDrop([file]);

    expect(getByText(/Загружено/)).toBeTruthy();

    const images = await findAllByTestId('gallery-image');
    expect(images.length).toBeGreaterThan(0);
  });

  it('compresses oversized web gallery files instead of rejecting them before upload', async () => {
    const largeFile = new File([new Uint8Array(10 * 1024 * 1024 + 128)], 'large-trip-photo.jpg', {
      type: 'image/jpeg',
    });
    const compressedFile = new File(['compressed'], 'large-trip-photo.jpg', {
      type: 'image/jpeg',
    });

    prepareWebImageFileForUploadMock.mockResolvedValueOnce(compressedFile);

    renderSafe(
      <ImageGalleryComponent collection="gallery" idTravel="42" initialImages={[]} maxImages={5} />,
    );

    await runDrop([largeFile]);

    await waitFor(() => {
      expect(uploadImageMock).toHaveBeenCalled();
    });

    expect(prepareWebImageFileForUploadMock).toHaveBeenCalledWith(largeFile);
    const formData = uploadImageMock.mock.calls[0][0] as FormData;
    expect(formData.get('file')).toBe(compressedFile);
  });

  it('registers HEIC and HEIF in the web dropzone accept list', () => {
    renderSafe(
      <ImageGalleryComponent collection="gallery" idTravel="42" initialImages={[]} maxImages={5} />,
    );

    const { __dropMock } = jest.requireMock('react-dropzone') as any;
    expect(__dropMock.accept).toEqual(
      expect.objectContaining({
        'image/*': expect.arrayContaining(['.heic', '.heif', '.heics', '.heifs']),
        'image/heic': expect.arrayContaining(['.heic']),
        'image/heif': expect.arrayContaining(['.heif']),
      }),
    );
  });

  it('keeps uploaded image visible even if in-flight placeholder is dropped by props sync', async () => {
    const file = new File(['data'], 'test.jpg', { type: 'image/jpeg' });

    // Make upload async so we can simulate a prop update that might reset state.
    let resolveUpload: ((value: any) => void) | null = null;
    uploadImageMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveUpload = resolve;
        }),
    );

    const { rerender, UNSAFE_getAllByType } = renderSafe(
      <ImageGalleryComponent collection="gallery" idTravel="42" initialImages={[]} maxImages={5} />,
    );

    runDropNoWait([file]);

    await waitFor(() => {
      expect(prepareWebImageFileForUploadMock).toHaveBeenCalledWith(file);
      expect(uploadImageMock).toHaveBeenCalled();
    });

    // Simulate a parent prop sync (e.g. wizard form re-renders with initialImages)
    // that previously could drop the uploading placeholders.
    rerender(
      <ImageGalleryComponent collection="gallery" idTravel="42" initialImages={[]} maxImages={5} />,
    );

    // Now resolve upload; even if placeholder is gone, component must append the final item.
    await act(async () => {
      resolveUpload?.({ id: 'uploaded-1', url: '/uploaded.jpg' });
    });

    // Flush any queued microtasks/state updates after resolving the upload.
    await act(async () => {
      await Promise.resolve();
    });

    await waitFor(() => {
      const imgs = UNSAFE_getAllByType(Image);
      expect(imgs.length).toBeGreaterThan(0);
    });
  });

  it('normalizes private IP https media URLs on localhost by forcing http', async () => {
    // Backend may respond with an absolute https URL to a private IP; in dev that often fails.
    uploadImageMock.mockResolvedValueOnce({ id: 'uploaded-1', url: 'https://192.168.50.36/gallery/820/x.jpg' });

    const file = new File(['data'], 'test.jpg', { type: 'image/jpeg' });

    const { UNSAFE_getAllByType } = renderSafe(
      <ImageGalleryComponent collection="gallery" idTravel="42" initialImages={[]} maxImages={5} />,
    );

    await runDrop([file]);

    // OptimizedImage is mocked to RN Image, so we can inspect source.uri.
    await waitFor(() => {
      const imgs = UNSAFE_getAllByType(Image);
      expect(imgs.length).toBeGreaterThan(0);
      const uri = imgs[0].props.source?.uri;
      expect(uri).toBe('http://192.168.50.36/gallery/820/x.jpg');
    });
  });

  it('does not show duplicate previews when drop handler fires twice for the same uploaded image', async () => {
    // Simulate a bug where onDrop runs twice (double event) but backend returns the same image.
    uploadImageMock
      .mockResolvedValueOnce({ id: '999', url: '/same.jpg' })
      .mockResolvedValueOnce({ id: '999', url: '/same.jpg' });

    const file = new File(['data'], 'test.jpg', { type: 'image/jpeg' });

    const { UNSAFE_getAllByType } = renderSafe(
      <ImageGalleryComponent collection="gallery" idTravel="42" initialImages={[]} maxImages={10} />,
    );

    await runDrop([file]);
    await runDrop([file]);

    // `gallery-image` testID is used both on wrapper View and on mocked OptimizedImage.
    // Count actual rendered Image nodes instead.
    await waitFor(() => {
      const imgs = UNSAFE_getAllByType(Image);
      expect(imgs).toHaveLength(1);
    });
  });

  it('reports only finalized unique URLs via onChange (no duplicates, no uploading placeholders)', async () => {
    uploadImageMock
      .mockResolvedValueOnce({ id: '999', url: '/same.jpg' })
      .mockResolvedValueOnce({ id: '999', url: '/same.jpg' });

    const onChange = jest.fn();
    const file = new File(['data'], 'test.jpg', { type: 'image/jpeg' });

    renderSafe(
      <ImageGalleryComponent
        collection="gallery"
        idTravel="42"
        initialImages={[]}
        maxImages={10}
        onChange={onChange}
      />,
    );

    await runDrop([file]);
    await runDrop([file]);

    await waitFor(() => {
      // Should be called with one URL only, even if upload is triggered twice.
      expect(onChange).toHaveBeenCalled();
      const last = onChange.mock.calls[onChange.mock.calls.length - 1][0] as Array<{ id?: string; url: string }>;
      expect(last).toHaveLength(1);
      expect(last[0]?.url).toContain('/same.jpg');
    });
  });

  it('reports reordered gallery items in display order', async () => {
    const onChange = jest.fn();
    const { getAllByTestId } = renderSafe(
      <ImageGalleryComponent
        collection="gallery"
        idTravel="42"
        initialImages={[
          { id: '1', url: 'https://example.com/first.jpg' },
          { id: '2', url: 'https://example.com/second.jpg' },
          { id: '3', url: 'https://example.com/third.jpg' },
        ]}
        maxImages={10}
        onChange={onChange}
      />,
    );

    await waitFor(() => expect(onChange).toHaveBeenCalled());

    const callsBeforeMove = onChange.mock.calls.length;
    fireEvent.press(getAllByTestId('gallery-move-left-button')[1]);
    const immediate = onChange.mock.calls[onChange.mock.calls.length - 1][0] as Array<{ id?: string; url: string }>;
    expect(onChange.mock.calls.length).toBeGreaterThan(callsBeforeMove);
    expect(immediate.map((item) => item.id)).toEqual(['2', '1', '3']);

    await waitFor(() => {
      const last = onChange.mock.calls[onChange.mock.calls.length - 1][0] as Array<{ id?: string; url: string }>;
      expect(last.map((item) => item.id)).toEqual(['2', '1', '3']);
    });
  });

  it('keeps gallery move controls at 44px and adds a contrast backdrop', () => {
    const styles = createGalleryStyles({
      ...MODERN_MATTE_PALETTE,
      shadows: MODERN_MATTE_SHADOWS,
      boxShadows: MODERN_MATTE_BOX_SHADOWS,
    } as any);
    const moveControls = StyleSheet.flatten(styles.moveControls);
    const moveButton = StyleSheet.flatten(styles.moveButton);

    expect(moveControls.backgroundColor).toBe(MODERN_MATTE_PALETTE.overlay);
    expect(moveControls.padding).toBeGreaterThan(0);
    expect(moveButton.width).toBeGreaterThanOrEqual(44);
    expect(moveButton.height).toBeGreaterThanOrEqual(44);
    expect(moveButton.minWidth).toBeGreaterThanOrEqual(44);
    expect(moveButton.minHeight).toBeGreaterThanOrEqual(44);
    expect(moveButton.borderWidth).toBeGreaterThanOrEqual(2);
  });

  it('returns a supported flat static-frost style for mobile web buttons', () => {
    const moveMobileOverride = createMobileWebStaticFrostStyle(MODERN_MATTE_PALETTE.surfaceMuted);
    const deleteMobileOverride = createMobileWebStaticFrostStyle(MODERN_MATTE_PALETTE.danger);

    expect(moveMobileOverride).toEqual(expect.objectContaining({
      backgroundColor: MODERN_MATTE_PALETTE.surfaceMuted,
      backdropFilter: 'none',
      WebkitBackdropFilter: 'none',
    }));
    expect(deleteMobileOverride).toEqual(expect.objectContaining({
      backgroundColor: MODERN_MATTE_PALETTE.danger,
      backdropFilter: 'none',
      WebkitBackdropFilter: 'none',
    }));

    expect(Object.keys(moveMobileOverride).some((key) => key.startsWith('@media'))).toBe(false);
    expect(Object.keys(deleteMobileOverride).some((key) => key.startsWith('@media'))).toBe(false);
  });

  it('invalidates the travel detail cache after persisted reorder', async () => {
    const invalidateQueries = jest.fn(async () => undefined);
    const { getAllByTestId } = renderSafe(
      <QueryClientContext.Provider value={{ invalidateQueries } as any}>
        <ImageGalleryComponent
          collection="gallery"
          idTravel="42"
          initialImages={[
            { id: '1', url: 'https://example.com/first.jpg' },
            { id: '2', url: 'https://example.com/second.jpg' },
          ]}
          maxImages={10}
        />
      </QueryClientContext.Provider>,
    );

    fireEvent.press(getAllByTestId('gallery-move-left-button')[1]);

    await waitFor(() => {
      expect(reorderGalleryMock).toHaveBeenCalledWith(42, ['2', '1'], expect.any(AbortSignal));
      expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['travel', 42] });
    }, { timeout: 2000 });
  });

  it('dedupes absolute and relative URLs that point to the same image path', async () => {
    uploadImageMock.mockResolvedValueOnce({ id: '999', url: 'http://localhost:8081/same.jpg' });

    const file = new File(['data'], 'test.jpg', { type: 'image/jpeg' });

    const { rerender, UNSAFE_getAllByType } = renderSafe(
      <ImageGalleryComponent
        collection="gallery"
        idTravel="42"
        initialImages={[{ id: 'legacy-0', url: '/same.jpg' }]}
        maxImages={10}
      />,
    );

    await runDrop([file]);

    // Simulate parent sync in legacy/relative format.
    rerender(
      <ImageGalleryComponent
        collection="gallery"
        idTravel="42"
        initialImages={[{ id: 'legacy-0', url: '/same.jpg' }]}
        maxImages={10}
      />,
    );

    await waitFor(() => {
      const imgs = UNSAFE_getAllByType(Image);
      expect(imgs).toHaveLength(1);
    });
  });

  it('does not show duplicate previews when backend returns different ids for the same final URL', async () => {
    // Real-world: backend may create duplicate records for the same file and respond with different ids.
    uploadImageMock
      .mockResolvedValueOnce({ id: '1001', url: '/same.jpg' })
      .mockResolvedValueOnce({ id: '1002', url: '/same.jpg' });

    const file = new File(['data'], 'test.jpg', { type: 'image/jpeg' });

    const { UNSAFE_getAllByType } = renderSafe(
      <ImageGalleryComponent collection="gallery" idTravel="42" initialImages={[]} maxImages={10} />,
    );

    await runDrop([file]);
    await runDrop([file]);

    await waitFor(() => {
      const imgs = UNSAFE_getAllByType(Image);
      expect(imgs).toHaveLength(1);
    });
  });

  it('does not keep both legacy and backend items when they point to the same URL (no blurred duplicate)', async () => {
    uploadImageMock.mockResolvedValueOnce({ id: '999', url: '/same.jpg' });

    const file = new File(['data'], 'test.jpg', { type: 'image/jpeg' });

    // Simulate parent-provided legacy item (e.g. form state stores only URLs).
    const { UNSAFE_getAllByType } = renderSafe(
      <ImageGalleryComponent
        collection="gallery"
        idTravel="42"
        initialImages={[{ id: 'legacy-0', url: '/same.jpg' }]}
        maxImages={10}
      />,
    );

    await runDrop([file]);

    await waitFor(() => {
      const imgs = UNSAFE_getAllByType(Image);
      expect(imgs).toHaveLength(1);
    });
  });

  it('calls delete API after parent prop sync replaces backend ids with legacy ids (preserves backend id by url)', async () => {
    uploadImageMock.mockResolvedValueOnce({ id: '999', url: '/same.jpg' });

    const file = new File(['data'], 'test.jpg', { type: 'image/jpeg' });

    const { rerender, getAllByTestId, getByTestId } = renderSafe(
      <ImageGalleryComponent collection="gallery" idTravel="42" initialImages={[]} maxImages={10} />, 
    );

    await runDrop([file]);

    // Parent stores only URL strings and rehydrates with legacy ids.
    rerender(
      <ImageGalleryComponent
        collection="gallery"
        idTravel="42"
        initialImages={[{ id: 'legacy-0', url: '/same.jpg' }]}
        maxImages={10}
      />,
    );

    // Delete should still call backend DELETE by numeric id (999), not treat it as legacy.
    fireEvent.press(getAllByTestId('delete-image-button')[0]);
    fireEvent.press(getByTestId('confirm-delete'));

    await waitFor(() => expect(deleteImageMock).toHaveBeenCalledWith('999'));
  });

  it('keeps already loaded images visible when uploading new ones (preserves hasLoaded across prop sync)', async () => {
    uploadImageMock
      .mockResolvedValueOnce({ id: '111', url: '/a.jpg' })
      .mockResolvedValueOnce({ id: '222', url: '/b.jpg' });

    const fileA = new File(['data'], 'a.jpg', { type: 'image/jpeg' });
    const fileB = new File(['data'], 'b.jpg', { type: 'image/jpeg' });

    const { rerender, getAllByTestId, UNSAFE_getAllByType } = renderSafe(
      <ImageGalleryComponent collection="gallery" idTravel="42" initialImages={[]} maxImages={10} />,
    );

    await runDrop([fileA]);

    // Simulate parent syncing stored URLs (legacy ids) after first upload.
    rerender(
      <ImageGalleryComponent
        collection="gallery"
        idTravel="42"
        initialImages={[{ id: 'legacy-0', url: '/a.jpg' }]}
        maxImages={10}
      />,
    );

    await waitFor(() => {
      const imgs = UNSAFE_getAllByType(Image);
      expect(imgs.length).toBe(1);
    });

    await runDrop([fileB]);

    // Now parent syncs again with both URLs; image A must stay visible (not hidden again).
    rerender(
      <ImageGalleryComponent
        collection="gallery"
        idTravel="42"
        initialImages={[
          { id: 'legacy-0', url: '/a.jpg' },
          { id: 'legacy-1', url: '/b.jpg' },
        ]}
        maxImages={10}
      />,
    );

    await waitFor(() => {
      const imgs = UNSAFE_getAllByType(Image);
      expect(imgs.length).toBe(2);
      expect(getAllByTestId('delete-image-button').length).toBeGreaterThan(0);
    });
  });

  it('deletes an image after confirmation', async () => {
    const { getByTestId, queryAllByTestId, getAllByTestId } = renderSafe(
      <ImageGalleryComponent
        collection="gallery"
        idTravel="42"
        initialImages={[{ id: '123', url: 'https://example.com/pic.jpg' }]}
      />,
    );

    // дождаться отрисовки исходной картинки
    let initialCount = 0;
    await waitFor(() => {
      initialCount = queryAllByTestId('gallery-image').length;
      expect(initialCount).toBeGreaterThan(0);
    });

    fireEvent.press(getAllByTestId('delete-image-button')[0]);
    fireEvent.press(getByTestId('confirm-delete'));

    await waitFor(() => expect(deleteImageMock).toHaveBeenCalledWith('123'));
    await waitFor(() =>
      expect(queryAllByTestId('gallery-image').length).toBeLessThan(initialCount),
    );
  });

  it('removes legacy gallery items locally without calling delete API', async () => {
    const { getByTestId, queryAllByTestId, getAllByTestId } = renderSafe(
      <ImageGalleryComponent
        collection="gallery"
        idTravel="42"
        initialImages={[{ id: 'legacy-3', url: 'https://example.com/pic.jpg' }]}
      />,
    );

    let initialCount = 0;
    await waitFor(() => {
      initialCount = queryAllByTestId('gallery-image').length;
      expect(initialCount).toBeGreaterThan(0);
    });

    fireEvent.press(getAllByTestId('delete-image-button')[0]);
    fireEvent.press(getByTestId('confirm-delete'));

    await waitFor(() =>
      expect(queryAllByTestId('gallery-image').length).toBeLessThan(initialCount),
    );
    expect(deleteImageMock).not.toHaveBeenCalled();
  });

  it('allows deleting failed upload from overlay action', async () => {
    uploadImageMock.mockImplementationOnce(() => {
      throw new Error('upload failed');
    });
    const file = new File(['data'], 'broken.jpg', { type: 'image/jpeg' });

    const { getAllByTestId, queryAllByTestId, getByTestId, getByText } = renderSafe(
      <ImageGalleryComponent collection="gallery" idTravel="42" initialImages={[]} maxImages={5} />,
    );

    await runDrop([file]);

    let buttonsCount = 0;
    await waitFor(() => {
      buttonsCount = getAllByTestId('delete-image-button').length;
      expect(buttonsCount).toBeGreaterThan(0);
    });
    expect(getByText('Ошибка загрузки')).toBeTruthy();
    expect(getByText('Удалить')).toBeTruthy();

    const before = queryAllByTestId('gallery-image').length;
    fireEvent.press(getAllByTestId('delete-image-button')[0]);
    fireEvent.press(getByTestId('confirm-delete'));

    await waitFor(() =>
      expect(queryAllByTestId('gallery-image').length).toBeLessThan(before),
    );
    expect(deleteImageMock).not.toHaveBeenCalled();
  });

  it('allows HEIC upload on web', async () => {
    const file = new File(['data'], 'iphone.heic', { type: 'image/heic' });
    const convertedFile = new File(['jpeg-data'], 'iphone.jpg', { type: 'image/jpeg' });

    prepareWebImageFileForUploadMock.mockResolvedValueOnce(convertedFile);

    renderSafe(
      <ImageGalleryComponent collection="gallery" idTravel="42" initialImages={[]} maxImages={5} />,
    );

    await runDrop([file]);

    await waitFor(() => {
      expect(uploadImageMock).toHaveBeenCalled();
    });

    expect(prepareWebImageFileForUploadMock).toHaveBeenCalledWith(file);
    const formData = uploadImageMock.mock.calls[0][0] as FormData;
    expect(formData.get('file')).toBe(convertedFile);
  });

  it('shows delete button for items with missing url and removes them locally', async () => {
    const { getAllByTestId, getByTestId, queryAllByTestId } = renderSafe(
      <ImageGalleryComponent
        collection="gallery"
        idTravel="42"
        initialImages={[{ id: 'legacy-0', url: '' }]}
        maxImages={10}
      />,
    );

    let initialCount = 0;
    await waitFor(() => {
      initialCount = queryAllByTestId('gallery-image').length;
      expect(initialCount).toBeGreaterThan(0);
    });

    await waitFor(() => {
      expect(getAllByTestId('delete-image-button').length).toBeGreaterThan(0);
    });

    fireEvent.press(getAllByTestId('delete-image-button')[0]);
    fireEvent.press(getByTestId('confirm-delete'));

    await waitFor(() =>
      expect(queryAllByTestId('gallery-image').length).toBeLessThan(initialCount),
    );
  });

  it('marks existing image as error on 404 and still allows deleting it', async () => {
    const { getByText, getAllByTestId, getByTestId, queryAllByTestId } = renderSafe(
      <ImageGalleryComponent
        collection="gallery"
        idTravel="42"
        initialImages={[
          {
            id: '3796',
            url: 'http://192.168.50.36/gallery/3796/conversions/404-detail_hd.jpg',
          },
        ]}
        maxImages={10}
      />,
    );

    await waitFor(() => {
      expect(getByText('Ошибка загрузки')).toBeTruthy();
    });

    expect(getAllByTestId('delete-image-button').length).toBeGreaterThan(0);
    expect(getByTestId('gallery-caption-input-3796')).toBeTruthy();

    const before = queryAllByTestId('gallery-image').length;
    fireEvent.press(getAllByTestId('delete-image-button')[0]);
    fireEvent.press(getByTestId('confirm-delete'));

    await waitFor(() =>
      expect(queryAllByTestId('gallery-image').length).toBeLessThan(before),
    );
  });
});
