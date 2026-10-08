import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { uploadImage } from '@/api/misc';
import { showToast } from '@/utils/toast';
import PhotoUploadWithPreview from '@/components/travel/PhotoUploadWithPreview';

jest.mock('@/api/misc', () => ({ uploadImage: jest.fn() }));
jest.mock('@/utils/toast', () => ({ showToast: jest.fn() }));

const originalOS = Platform.OS;
beforeEach(() => {
  jest.clearAllMocks();
  Object.defineProperty(Platform, 'OS', { value: 'ios' });
});
afterEach(() => Object.defineProperty(Platform, 'OS', { value: originalOS }));

it.each([
  ['gallery', 'requestMediaLibraryPermissionsAsync', 'Требуется доступ к галерее'],
  ['camera', 'requestCameraPermissionsAsync', 'Требуется доступ к камере'],
] as const)('uses the shell feedback channel for denied %s permission', async (button, permission, message) => {
  jest.mocked(ImagePicker[permission]).mockResolvedValueOnce({ granted: false } as ImagePicker.MediaLibraryPermissionResponse);
  const screen = render(<PhotoUploadWithPreview collection="travelMainImage" idTravel="42" />);
  await act(async () => fireEvent.press(screen.getByTestId(`photo-upload-${button}-button`)));
  expect(showToast).toHaveBeenCalledWith(expect.objectContaining({ text1: message, position: 'bottom' }));
  expect(screen.queryByText(message)).toBeNull();
});

it('uses the shell feedback channel for an upload failure', async () => {
  jest.mocked(ImagePicker.requestMediaLibraryPermissionsAsync).mockResolvedValueOnce({ granted: true } as ImagePicker.MediaLibraryPermissionResponse);
  jest.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValueOnce({ canceled: false, assets: [{ uri: 'file:///photo.jpg', width: 10, height: 10 }] });
  jest.mocked(uploadImage).mockRejectedValueOnce(new Error('Network failure'));
  const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
  try {
    const screen = render(<PhotoUploadWithPreview collection="travelMainImage" idTravel="42" />);
    await act(async () => fireEvent.press(screen.getByTestId('photo-upload-gallery-button')));
    await waitFor(() => expect(showToast).toHaveBeenCalledWith(expect.objectContaining({ text1: 'Произошла ошибка при загрузке', position: 'bottom' })));
    expect(screen.queryByText('Произошла ошибка при загрузке')).toBeNull();
  } finally {
    consoleError.mockRestore();
  }
});

it('notifies on every identical validation failure from a new picker attempt', async () => {
  jest.mocked(ImagePicker.requestMediaLibraryPermissionsAsync).mockResolvedValue({ granted: true } as ImagePicker.MediaLibraryPermissionResponse);
  jest.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///large.jpg', width: 10, height: 10, fileSize: 12 * 1024 * 1024 }] });
  const screen = render(<PhotoUploadWithPreview collection="travelMainImage" idTravel="42" />);
  await act(async () => fireEvent.press(screen.getByTestId('photo-upload-gallery-button')));
  await act(async () => fireEvent.press(screen.getByTestId('photo-upload-gallery-button')));
  expect(showToast).toHaveBeenCalledTimes(2);
  expect(jest.mocked(showToast).mock.calls[0][0].text1).toBe(jest.mocked(showToast).mock.calls[1][0].text1);
  expect(uploadImage).not.toHaveBeenCalled();
});

it('notifies when a deferred cover upload fails after the draft receives its id', async () => {
  jest.mocked(ImagePicker.requestMediaLibraryPermissionsAsync).mockResolvedValueOnce({ granted: true } as ImagePicker.MediaLibraryPermissionResponse);
  jest.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValueOnce({ canceled: false, assets: [{ uri: 'file:///photo.jpg', width: 10, height: 10 }] });
  jest.mocked(uploadImage).mockRejectedValueOnce(new Error('Network failure'));
  const screen = render(<PhotoUploadWithPreview collection="travelMainImage" />);

  await act(async () => fireEvent.press(screen.getByTestId('photo-upload-gallery-button')));
  expect(uploadImage).not.toHaveBeenCalled();

  screen.rerender(<PhotoUploadWithPreview collection="travelMainImage" idTravel="42" />);
  await waitFor(() => expect(showToast).toHaveBeenCalledWith(expect.objectContaining({ text1: 'Произошла ошибка при загрузке', position: 'bottom' })));
  await act(async () => screen.rerender(<PhotoUploadWithPreview collection="travelMainImage" idTravel="42" />));
  expect(uploadImage).toHaveBeenCalledTimes(1);
  expect(showToast).toHaveBeenCalledTimes(1);
  expect(screen.queryByText('Произошла ошибка при загрузке')).toBeNull();
});
