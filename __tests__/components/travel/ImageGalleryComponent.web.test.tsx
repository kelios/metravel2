import React from 'react';
import { Platform, Text, View, TouchableOpacity } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import ImageGalleryComponent from '@/components/travel/ImageGalleryComponent';

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
  return ({ visible, onConfirm, onClose }: any) =>
    visible ? (
      <View>
        <TouchableOpacity testID="confirm-delete" onPress={onConfirm}>
          <Text>confirm</Text>
        </TouchableOpacity>
        <TouchableOpacity testID="cancel-delete" onPress={onClose}>
          <Text>cancel</Text>
        </TouchableOpacity>
      </View>
    ) : null;
});

const uploadImageMock = jest.fn(async () => ({ id: 'uploaded-1', url: '/uploaded.jpg' }));
const deleteImageMock = jest.fn(async () => undefined);

jest.mock('@/src/api/misc', () => ({
  uploadImage: (...args: any[]) => uploadImageMock(...args),
  deleteImage: (...args: any[]) => deleteImageMock(...args),
}));

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
    const { getByText, getAllByProps } = render(
      <ImageGalleryComponent
        collection="gallery"
        idTravel="42"
        initialImages={[{ id: '1', url: '/relative.jpg' }]}
        maxImages={5}
      />,
    );

    expect(getByText(/Загружено/)).toBeTruthy();
    const image = getAllByProps({ source: { uri: 'https://example.test/relative.jpg' } })[0];
    expect(image).toBeTruthy();
  });

  it('uploads files via dropzone with optimistic preview and finalizes', async () => {
    const file = new File(['data'], 'test.jpg', { type: 'image/jpeg' });

    const { getByText, getAllByProps } = render(
      <ImageGalleryComponent collection="gallery" idTravel="42" initialImages={[]} maxImages={5} />,
    );

    await runDrop([file]);

    expect(uploadImageMock).toHaveBeenCalledTimes(1);
    const formData = uploadImageMock.mock.calls[0][0] as FormData;
    expect(formData.get('collection')).toBe('gallery');
    expect(formData.get('id')).toBe('42');

    // Optimistic preview should appear immediately
    expect(getByText(/Загружено/)).toBeTruthy();

    await waitFor(() => {
      const image = getAllByProps({ source: { uri: 'https://example.test/uploaded.jpg' } })[0];
      expect(image).toBeTruthy();
    });
  });

  it('deletes an image after confirmation', async () => {
    const { getAllByText, getByTestId, queryAllByProps } = render(
      <ImageGalleryComponent
        collection="gallery"
        idTravel="42"
        initialImages={[{ id: 'del-1', url: 'https://example.com/pic.jpg' }]}
      />,
    );

    fireEvent.press(getAllByText('✖')[0]);
    fireEvent.press(getByTestId('confirm-delete'));

    await waitFor(() => expect(deleteImageMock).toHaveBeenCalledWith('del-1'));
    await waitFor(() => expect(queryAllByProps({ source: { uri: 'https://example.com/pic.jpg' } })).toHaveLength(0));
  });
});
