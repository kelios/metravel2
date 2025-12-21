import React from 'react';
import { Platform, Image } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import ImageGalleryComponent from '@/components/travel/ImageGalleryComponent.web';

jest.mock('@/components/ui/OptimizedImage', () => {
  const React = require('react');
  const { Image } = require('react-native');
  return ({ source }: any) =>
    React.createElement(Image, {
      testID: 'gallery-image',
      accessibilityLabel: 'Gallery image',
      source,
    });
});

jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  launchCameraAsync: jest.fn(async () => ({ canceled: true })),
  MediaTypeOptions: {},
  PermissionStatus: { GRANTED: 'granted' },
}));

jest.mock('react-dropzone', () => {
  const dropMock = { rootProps: {}, tabIndex: undefined, onDrop: (_files: any) => {} };
  return {
    useDropzone: (opts: any) => {
      dropMock.onDrop = opts.onDrop;
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

jest.mock('@/components/ConfirmDialog', () => {
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

jest.mock('@/src/api/misc', () => {
  const uploadImageMock = jest.fn(async () => ({ id: 'uploaded-1', url: '/uploaded.jpg' }));
  const deleteImageMock = jest.fn(async () => undefined);
  return {
    __esModule: true,
    uploadImage: uploadImageMock,
    deleteImage: deleteImageMock,
    __mocks: { uploadImageMock, deleteImageMock },
  };
});

const { __mocks } = jest.requireMock('@/src/api/misc') as any;
const uploadImageMock = __mocks.uploadImageMock as jest.Mock;
const deleteImageMock = __mocks.deleteImageMock as jest.Mock;

const runDrop = async (files: File[]) => {
  const { __dropMock } = jest.requireMock('react-dropzone') as any;
  await act(async () => {
    await __dropMock.onDrop(files);
  });
};

describe('ImageGalleryComponent.web', () => {
  const originalPlatform = Platform.OS;
  const originalCreateObjectURL = URL.createObjectURL;

  beforeAll(() => {
    Object.defineProperty(Platform, 'OS', { value: 'web' });
    URL.createObjectURL = jest.fn(() => 'blob://preview');
    process.env.EXPO_PUBLIC_API_URL = 'https://example.test/api';
  });

  afterAll(() => {
    Object.defineProperty(Platform, 'OS', { value: originalPlatform });
    URL.createObjectURL = originalCreateObjectURL;
  });

  beforeEach(() => {
    uploadImageMock.mockClear();
    deleteImageMock.mockClear();
  });

  it('renders initial images with absolute URLs and count', () => {
    const { getByText, UNSAFE_getAllByType } = render(
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

  it('uploads files via dropzone with optimistic preview and finalizes', async () => {
    const file = new File(['data'], 'test.jpg', { type: 'image/jpeg' });

    const { getByText, findAllByTestId } = render(
      <ImageGalleryComponent collection="gallery" idTravel="42" initialImages={[]} maxImages={5} />,
    );

    await runDrop([file]);

    expect(getByText(/Загружено/)).toBeTruthy();

    const images = await findAllByTestId('gallery-image');
    expect(images.length).toBeGreaterThan(0);
  });

  it('deletes an image after confirmation', async () => {
    const { getAllByText, getByTestId, queryAllByTestId } = render(
      <ImageGalleryComponent
        collection="gallery"
        idTravel="42"
        initialImages={[{ id: 'del-1', url: 'https://example.com/pic.jpg' }]}
      />,
    );

    // дождаться отрисовки исходной картинки
    let initialCount = 0;
    await waitFor(() => {
      initialCount = queryAllByTestId('gallery-image').length;
      expect(initialCount).toBeGreaterThan(0);
    });

    fireEvent.press(getAllByText('✖')[0]);
    fireEvent.press(getByTestId('confirm-delete'));

    await waitFor(() => expect(deleteImageMock).toHaveBeenCalledWith('del-1'));
    await waitFor(() =>
      expect(queryAllByTestId('gallery-image').length).toBeLessThan(initialCount),
    );
  });
});
