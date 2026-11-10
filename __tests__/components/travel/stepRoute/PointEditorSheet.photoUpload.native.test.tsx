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
