import { render, fireEvent, waitFor, act } from '@testing-library/react-native';

import ImageGalleryComponentIOS from '@/components/travel/ImageGalleryComponent';
import { uploadImage, deleteImage } from '@/src/api/misc';

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

jest.mock('@/src/api/misc', () => ({
  __esModule: true,
  uploadImage: jest.fn(),
  deleteImage: jest.fn(),
}));

jest.mock('@/components/ConfirmDialog', () => {
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

  it('calls onChange after uploading images', async () => {
    (uploadImage as jest.Mock).mockResolvedValue({ id: 101, url: '/uploads/a.jpg' });

    const onChange = jest.fn();

    const { getByTestId } = render(
      <ImageGalleryComponentIOS
        collection="gallery"
        idTravel="123"
        initialImages={[]}
        onChange={onChange}
      />
    );

    await act(async () => {
      fireEvent.press(getByTestId('gallery-ios.pick'));
    });

    await waitFor(() => {
      expect(uploadImage).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith([
        expect.stringContaining('/uploads/a.jpg'),
      ]);
    });
  });

  it('deletes by backend id and updates onChange; does not call deleteImage for non-numeric ids', async () => {
    const onChange = jest.fn();

    const { getByTestId, queryByTestId } = render(
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
        expect.stringContaining('/uploads/server.jpg'),
        expect.stringContaining('/uploads/local.jpg'),
      ]);
    });

    // Delete server image: should call delete API and remove from list
    fireEvent.press(getByTestId('gallery-ios.delete:123'));
    await waitFor(() => {
      expect(queryByTestId('confirm-dialog')).toBeTruthy();
    });
    fireEvent.press(getByTestId('confirm-dialog.confirm'));

    await waitFor(() => {
      expect(deleteImage).toHaveBeenCalledWith('123');
    });

    await waitFor(() => {
      expect(onChange).toHaveBeenLastCalledWith([
        expect.stringContaining('/uploads/local.jpg'),
      ]);
    });

    // Delete legacy image: should not call delete API
    fireEvent.press(getByTestId('gallery-ios.delete:legacy-0'));
    await waitFor(() => {
      expect(queryByTestId('confirm-dialog')).toBeTruthy();
    });
    fireEvent.press(getByTestId('confirm-dialog.confirm'));

    await waitFor(() => {
      expect(deleteImage).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(onChange).toHaveBeenLastCalledWith([]);
    });
  });
});
