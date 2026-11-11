import React from 'react';
import { Platform } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import type { MarkerData } from '@/types/types';

// #3213: the real upload widget runs inside the real sheet on Android; only the
// network and the system picker are scripted.
jest.mock('@/components/forms/MultiSelectField', () => {
  const { View } = require('react-native');
  return (props: Record<string, unknown>) => <View {...props} />;
});
jest.mock('@/components/ui/ToastHost', () => () => null);
jest.mock('@/components/ui/ImageCardMedia', () => () => null);
jest.mock('@/api/misc', () => ({ createPointCategory: jest.fn(), uploadImage: jest.fn() }));
jest.mock('@/utils/pointCategoryDictionaryQuery', () => ({ requestPointCategoryDictionaryRefresh: jest.fn() }));
jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(async () => ({ granted: true })),
  requestCameraPermissionsAsync: jest.fn(async () => ({ granted: true })),
  launchImageLibraryAsync: jest.fn(async () => ({
    canceled: false,
    assets: [{ uri: 'file:///point.jpg', fileName: 'point.jpg', mimeType: 'image/jpeg', fileSize: 1000 }],
  })),
  launchCameraAsync: jest.fn(async () => ({ canceled: true })),
}));

import * as ImagePicker from 'expo-image-picker';
import PointEditorSheet from '@/components/travel/stepRoute/PointEditorSheet';

const { uploadImage } = jest.requireMock('@/api/misc') as { uploadImage: jest.Mock };

const marker: MarkerData = { id: 42, lat: 53.9, lng: 27.5, country: null, address: 'Немига', categories: [1], image: 'https://example.com/old.jpg' };

describe('PointEditorSheet while the point photo uploads (#3213)', () => {
  const originalOS = Platform.OS;

  beforeEach(() => {
    Object.defineProperty(Platform, 'OS', { value: 'android' });
    uploadImage.mockReset();
  });

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { value: originalOS });
  });

  const renderSheet = async () => {
    let resolveUpload!: (value: { url: string }) => void;
    uploadImage.mockImplementationOnce(() => new Promise((resolve) => { resolveUpload = resolve; }));
    const onSave = jest.fn();
    const onClose = jest.fn();
    const screen = await render(
      <PointEditorSheet
        visible
        marker={marker}
        index={0}
        categoryTravelAddress={[]}
        onSave={onSave}
        onRemove={jest.fn()}
        onClose={onClose}
      />,
    );
    // The press handler awaits the whole upload; it is not awaited here on purpose.
    void fireEvent.press(screen.getByTestId('photo-upload-gallery-button'));
    await waitFor(() => expect(screen.getByTestId('travel-wizard.point-editor.photo-uploading')).toBeTruthy());
    return { screen, onSave, onClose, resolve: (url: string) => resolveUpload({ url }) };
  };

  it('blocks save and close until the upload finishes, then saves the uploaded photo', async () => {
    const { screen, onSave, onClose, resolve } = await renderSheet();

    await fireEvent.press(screen.getByTestId('travel-wizard.point-editor.save'));
    await fireEvent.press(screen.getByTestId('travel-wizard.point-editor.close'));
    expect(onSave).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();

    await act(async () => {
      resolve('https://example.com/new.jpg');
    });
    await waitFor(() => expect(screen.queryByTestId('travel-wizard.point-editor.photo-uploading')).toBeNull());

    await fireEvent.press(screen.getByTestId('travel-wizard.point-editor.save'));
    expect(onSave).toHaveBeenCalledWith(0, expect.objectContaining({ image: 'https://example.com/new.jpg' }));
  });

  it('lets the author cancel the upload and save the point with its previous photo', async () => {
    const { screen, onSave, resolve } = await renderSheet();

    await fireEvent.press(screen.getByTestId('travel-wizard.point-editor.cancel-photo-upload'));
    await waitFor(() => expect(screen.queryByTestId('travel-wizard.point-editor.photo-uploading')).toBeNull());
    await act(async () => {
      resolve('https://example.com/late.jpg');
    });

    await fireEvent.press(screen.getByTestId('travel-wizard.point-editor.save'));
    expect(onSave).toHaveBeenCalledWith(0, expect.objectContaining({ image: 'https://example.com/old.jpg' }));
  });

  const renderPicking = async (launcher: 'launchImageLibraryAsync' | 'launchCameraAsync', button: string) => {
    let resolvePicker!: (value: ImagePicker.ImagePickerResult) => void;
    jest.mocked(ImagePicker[launcher]).mockImplementationOnce(() => new Promise((resolve) => { resolvePicker = resolve; }));
    const onSave = jest.fn();
    const onClose = jest.fn();
    const screen = await render(
      <PointEditorSheet visible marker={marker} index={0} categoryTravelAddress={[]} onSave={onSave} onRemove={jest.fn()} onClose={onClose} />,
    );
    void fireEvent.press(screen.getByTestId(button));
    await waitFor(() => expect(screen.getByTestId('travel-wizard.point-editor.photo-uploading')).toBeTruthy());
    return { screen, onSave, onClose, resolvePicker };
  };

  const pickedAsset: ImagePicker.ImagePickerResult = {
    canceled: false,
    assets: [{ uri: 'file:///picked.jpg', fileName: 'picked.jpg', mimeType: 'image/jpeg', fileSize: 1000, width: 10, height: 10 }],
  };

  it.each([
    ['gallery', 'launchImageLibraryAsync', 'photo-upload-gallery-button'],
    ['camera', 'launchCameraAsync', 'photo-upload-camera-button'],
  ] as const)('blocks save from the moment the %s opens and keeps the photo picked meanwhile', async (_name, launcher, button) => {
    const { screen, onSave, onClose, resolvePicker } = await renderPicking(launcher, button);

    await fireEvent.press(screen.getByTestId('travel-wizard.point-editor.save'));
    await fireEvent.press(screen.getByTestId('travel-wizard.point-editor.close'));
    expect(onSave).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(uploadImage).not.toHaveBeenCalled();

    let resolveUpload!: (value: { url: string }) => void;
    uploadImage.mockImplementationOnce(() => new Promise((resolve) => { resolveUpload = resolve; }));
    await act(async () => { resolvePicker(pickedAsset); });
    await waitFor(() => expect(uploadImage).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId('travel-wizard.point-editor.photo-uploading')).toBeTruthy();
    await act(async () => { resolveUpload({ url: 'https://example.com/picked.jpg' }); });
    await waitFor(() => expect(screen.queryByTestId('travel-wizard.point-editor.photo-uploading')).toBeNull());

    await fireEvent.press(screen.getByTestId('travel-wizard.point-editor.save'));
    expect(onSave).toHaveBeenCalledWith(0, expect.objectContaining({ image: 'https://example.com/picked.jpg' }));
  });

  it('releases the lock when the author closes the picker without a photo', async () => {
    const { screen, onSave, resolvePicker } = await renderPicking('launchImageLibraryAsync', 'photo-upload-gallery-button');

    await act(async () => { resolvePicker({ canceled: true, assets: null }); });
    await waitFor(() => expect(screen.queryByTestId('travel-wizard.point-editor.photo-uploading')).toBeNull());

    await fireEvent.press(screen.getByTestId('travel-wizard.point-editor.save'));
    expect(uploadImage).not.toHaveBeenCalled();
    expect(onSave).toHaveBeenCalledWith(0, expect.objectContaining({ image: 'https://example.com/old.jpg' }));
  });

  it.each([
    ['the camera permission is denied', () => jest.mocked(ImagePicker.requestCameraPermissionsAsync).mockResolvedValueOnce({ granted: false } as ImagePicker.CameraPermissionResponse), 'photo-upload-camera-button'],
    ['the gallery picker fails', () => jest.mocked(ImagePicker.launchImageLibraryAsync).mockRejectedValueOnce(new Error('picker failed')), 'photo-upload-gallery-button'],
  ] as const)('releases the lock when %s', async (_name, arrange, button) => {
    arrange();
    const onSave = jest.fn();
    const screen = await render(
      <PointEditorSheet visible marker={marker} index={0} categoryTravelAddress={[]} onSave={onSave} onRemove={jest.fn()} onClose={jest.fn()} />,
    );
    await fireEvent.press(screen.getByTestId(button));
    await waitFor(() => expect(screen.queryByTestId('travel-wizard.point-editor.photo-uploading')).toBeNull());

    await fireEvent.press(screen.getByTestId('travel-wizard.point-editor.save'));
    expect(uploadImage).not.toHaveBeenCalled();
    expect(onSave).toHaveBeenCalledWith(0, expect.objectContaining({ image: 'https://example.com/old.jpg' }));
  });

  it('does not upload a photo whose selection the author cancelled', async () => {
    const { screen, onSave, resolvePicker } = await renderPicking('launchImageLibraryAsync', 'photo-upload-gallery-button');

    await fireEvent.press(screen.getByTestId('travel-wizard.point-editor.cancel-photo-upload'));
    await waitFor(() => expect(screen.queryByTestId('travel-wizard.point-editor.photo-uploading')).toBeNull());
    await act(async () => { resolvePicker(pickedAsset); });

    expect(uploadImage).not.toHaveBeenCalled();
    expect(screen.queryByTestId('travel-wizard.point-editor.photo-uploading')).toBeNull();
    await fireEvent.press(screen.getByTestId('travel-wizard.point-editor.save'));
    expect(onSave).toHaveBeenCalledWith(0, expect.objectContaining({ image: 'https://example.com/old.jpg' }));
  });

  it('does not carry the photo of a removed point into the next opened point', async () => {
    const { screen, onSave, resolve } = await renderSheet();

    await fireEvent.press(screen.getByTestId('travel-wizard.point-editor.remove'));
    await fireEvent.press(screen.getByTestId('travel-wizard.point-editor.remove-confirm'));

    const other: MarkerData = { ...marker, id: 43, address: 'Троицкое', image: 'https://example.com/other.jpg' };
    await screen.rerender(
      <PointEditorSheet
        visible
        marker={other}
        index={1}
        categoryTravelAddress={[]}
        onSave={onSave}
        onRemove={jest.fn()}
        onClose={jest.fn()}
      />,
    );
    await act(async () => {
      resolve('https://example.com/removed-point.jpg');
    });

    await fireEvent.press(screen.getByTestId('travel-wizard.point-editor.save'));
    expect(onSave).toHaveBeenLastCalledWith(1, expect.objectContaining({ image: 'https://example.com/other.jpg' }));
  });
});
