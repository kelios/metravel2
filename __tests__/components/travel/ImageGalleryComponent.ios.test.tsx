import { render, fireEvent, waitFor, act } from '@testing-library/react-native';

import ImageGalleryComponentIOS from '@/components/travel/ImageGalleryComponent';
import { uploadImage, deleteImage } from '@/api/misc';
import { ThemeContext } from '@/hooks/useTheme';
import { MODERN_MATTE_PALETTE_DARK } from '@/constants/modernMattePalette';

jest.mock('expo-image-picker', () => {
  return {
    __esModule: true,
    MediaTypeOptions: { Images: 'Images' },
    requestMediaLibraryPermissionsAsync: jest.fn(async () => ({ status: 'granted', granted: true })),
    requestCameraPermissionsAsync: jest.fn(async () => ({ status: 'granted', granted: true })),
    launchImageLibraryAsync: jest.fn(async () => ({
      canceled: false,
      assets: [{ uri: 'file:///test.jpg' }],
    })),
    launchCameraAsync: jest.fn(async () => ({
      canceled: false,
      assets: [{ uri: 'file:///camera.jpg' }],
    })),
  };
});

jest.mock('@/api/misc', () => ({
  __esModule: true,
  uploadImage: jest.fn(),
  deleteImage: jest.fn(),
  reorderGallery: jest.fn(async () => ({ gallery: [] })),
}));

jest.mock('@/utils/toast', () => ({
  __esModule: true,
  showToast: jest.fn(async () => undefined),
}));

jest.mock('@/components/ui/ConfirmDialog', () => {
  const React = require('react');
  const { View, Text, Pressable } = require('react-native');
  return {
    __esModule: true,
    default: ({ visible, title, message, onConfirm, onClose }: any) => {
      if (!visible) return null;
      return (
        <View testID="confirm-dialog">
          <Text>{title}</Text>
          <Text>{message}</Text>
          <Pressable testID="confirm-dialog.confirm" onPress={onConfirm}>
            <Text>confirm</Text>
          </Pressable>
          <Pressable testID="confirm-dialog.close" onPress={onClose}>
            <Text>close</Text>
          </Pressable>
        </View>
      );
    },
  };
});

describe('ImageGalleryComponent.ios', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders touch-first gallery and camera actions without drag-and-drop copy', async () => {
    const screen = await render(
      <ImageGalleryComponentIOS
        collection="gallery"
        idTravel="123"
        initialImages={[]}
      />
    );

    expect(screen.getByTestId('gallery-ios.pick')).toBeTruthy();
    expect(screen.getByText('Выбрать из галереи')).toBeTruthy();
    expect(screen.getByTestId('gallery-ios.camera')).toBeTruthy();
    expect(screen.getByText('Сделать фото')).toBeTruthy();
    expect(screen.queryByText(/Перетащ/)).toBeNull();
  });

  it('calls onChange after uploading images', async () => {
    (uploadImage as jest.Mock).mockResolvedValue({ id: 101, url: '/uploads/a.jpg' });

    const onChange = jest.fn();

    const { getByTestId } = await render(
      <ImageGalleryComponentIOS
        collection="gallery"
        idTravel="123"
        initialImages={[]}
        onChange={onChange}
      />
    );

    await act(async () => {
      await fireEvent.press(getByTestId('gallery-ios.pick'));
    });

    await waitFor(() => {
      expect(uploadImage).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith([
        expect.objectContaining({ id: '101', url: expect.stringContaining('/uploads/a.jpg') }),
      ]);
    });
  });

  it('deletes by backend id and updates onChange; does not call deleteImage for non-numeric ids', async () => {
    const onChange = jest.fn();

    const { getByTestId, queryByTestId } = await render(
      <ImageGalleryComponentIOS
        collection="gallery"
        idTravel="123"
        initialImages={[
          { id: '123', url: '/uploads/server.jpg' },
          { id: 'legacy-0', url: '/uploads/local.jpg' },
        ]}
        onChange={onChange}
      />
    );

    // Wait for initial onChange
    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith([
        expect.objectContaining({ id: '123', url: expect.stringContaining('/uploads/server.jpg') }),
        expect.objectContaining({ id: 'legacy-0', url: expect.stringContaining('/uploads/local.jpg') }),
      ]);
    });

    // Delete server image: should call delete API and remove from list
    await fireEvent.press(getByTestId('gallery-ios.delete:123'));
    await waitFor(() => {
      expect(queryByTestId('confirm-dialog')).toBeTruthy();
    });
    await fireEvent.press(getByTestId('confirm-dialog.confirm'));

    await waitFor(() => {
      expect(deleteImage).toHaveBeenCalledWith('123');
    });

    await waitFor(() => {
      expect(onChange).toHaveBeenLastCalledWith([
        expect.objectContaining({ id: 'legacy-0', url: expect.stringContaining('/uploads/local.jpg') }),
      ]);
    });

    // Delete legacy image: should not call delete API
    await fireEvent.press(getByTestId('gallery-ios.delete:legacy-0'));
    await waitFor(() => {
      expect(queryByTestId('confirm-dialog')).toBeTruthy();
    });
    await fireEvent.press(getByTestId('confirm-dialog.confirm'));

    await waitFor(() => {
      expect(deleteImage).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(onChange).toHaveBeenLastCalledWith([]);
    });
  });

  it('uses the media-overlay text token for active move arrows in dark theme', async () => {
    const { getByTestId } = await render(
      <ThemeContext.Provider
        value={{ theme: 'dark', isDark: true, setTheme: jest.fn(), toggleTheme: jest.fn() }}
      >
        <ImageGalleryComponentIOS
          collection="gallery"
          idTravel="123"
          initialImages={[
            { id: '1', url: '/uploads/first.jpg' },
            { id: '2', url: '/uploads/second.jpg' },
          ]}
        />
      </ThemeContext.Provider>
    );

    expect(getByTestId('gallery-ios.move-right-icon:1').props.color).toBe(
      MODERN_MATTE_PALETTE_DARK.textOnDark,
    );
    expect(getByTestId('gallery-ios.move-left-icon:2').props.color).toBe(
      MODERN_MATTE_PALETTE_DARK.textOnDark,
    );
  });

  describe('order of photos is saved from the app (#3215)', () => {
    const { Platform } = require('react-native');
    const { reorderGallery } = jest.requireMock('@/api/misc') as { reorderGallery: jest.Mock };
    const { showToast } = jest.requireMock('@/utils/toast') as { showToast: jest.Mock };
    const originalOS = Platform.OS;
    // Android ships the iOS implementation through this entry.
    const AndroidGallery = require('@/components/travel/ImageGalleryComponent.android').default;
    const initialImages = [
      { id: '1', url: '/uploads/first.jpg' },
      { id: '2', url: '/uploads/second.jpg' },
      { id: '3', url: '/uploads/third.jpg' },
    ];

    beforeEach(() => {
      Object.defineProperty(Platform, 'OS', { value: 'android' });
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
      Object.defineProperty(Platform, 'OS', { value: originalOS });
    });

    const lastReportedIds = (onChange: jest.Mock) =>
      (onChange.mock.calls.at(-1)?.[0] ?? []).map((item: { id: string }) => item.id);

    it('sends the new order once after the moves settle', async () => {
      const onChange = jest.fn();
      const screen = await render(
        <AndroidGallery collection="gallery" idTravel="123" initialImages={initialImages} onChange={onChange} />,
      );

      await fireEvent.press(screen.getByTestId('gallery-ios.move-right:1'));
      await fireEvent.press(screen.getByTestId('gallery-ios.move-right:1'));
      expect(reorderGallery).not.toHaveBeenCalled();

      await act(async () => {
        jest.advanceTimersByTime(700);
      });

      expect(reorderGallery).toHaveBeenCalledTimes(1);
      expect(reorderGallery).toHaveBeenCalledWith(123, ['2', '3', '1'], expect.any(AbortSignal));
      expect(lastReportedIds(onChange)).toEqual(['2', '3', '1']);
    });

    it('returns the previous order and tells the author when the server rejects it', async () => {
      reorderGallery.mockRejectedValueOnce(new Error('offline'));
      const onChange = jest.fn();
      const screen = await render(
        <AndroidGallery collection="gallery" idTravel="123" initialImages={initialImages} onChange={onChange} />,
      );

      await fireEvent.press(screen.getByTestId('gallery-ios.move-left:2'));
      expect(lastReportedIds(onChange)).toEqual(['2', '1', '3']);

      await act(async () => {
        jest.advanceTimersByTime(700);
      });
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(lastReportedIds(onChange)).toEqual(['1', '2', '3']);
      expect(showToast).toHaveBeenCalledWith(expect.objectContaining({ type: 'error' }));
    });
  });
});
