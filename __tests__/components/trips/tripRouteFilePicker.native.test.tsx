import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import TripRouteFilePicker from '@/components/trips/planning/TripRouteFilePicker';

jest.mock('@expo/vector-icons/Feather', () => () => null);
jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => ({ isHydrated: true, isMobile: true }),
}));
jest.mock('@/hooks/useTheme', () => ({
  useThemedColors: () => ({ text: '#111111' }),
}));
jest.mock('expo-document-picker', () => ({ getDocumentAsync: jest.fn() }));
jest.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file:///cache/',
  EncodingType: { UTF8: 'utf8' },
  readAsStringAsync: jest.fn(),
  deleteAsync: jest.fn().mockResolvedValue(undefined),
}));

const DocumentPicker = require('expo-document-picker') as { getDocumentAsync: jest.Mock };
const FileSystem = require('expo-file-system/legacy') as {
  readAsStringAsync: jest.Mock;
  deleteAsync: jest.Mock;
};

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
};

const asset = (name: string, size = 42) => ({
  uri: `file:///cache/${name}`,
  name,
  size,
  mimeType: 'application/gpx+xml',
});

const renderPicker = () => {
  const props = {
    label: 'Load track (GPX/KML)',
    maxBytes: 100,
    onPicked: jest.fn(),
    onError: jest.fn(),
    onBusyChange: jest.fn(),
  };
  return { ...render(<TripRouteFilePicker {...props} />), props };
};

describe('TripRouteFilePicker native adapter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    FileSystem.readAsStringAsync.mockResolvedValue('<gpx />');
    FileSystem.deleteAsync.mockResolvedValue(undefined);
  });

  it('reads the selected cache copy, returns normalized text, and deletes the copy', async () => {
    DocumentPicker.getDocumentAsync.mockResolvedValue({
      canceled: false,
      assets: [asset('weekend.gpx')],
    });
    const { getByTestId, props } = renderPicker();

    fireEvent.press(getByTestId('trip-route-import-picker'));

    await waitFor(() => expect(props.onPicked).toHaveBeenCalledWith({
      name: 'weekend.gpx',
      size: 42,
      text: '<gpx />',
    }));
    expect(DocumentPicker.getDocumentAsync).toHaveBeenCalledWith(expect.objectContaining({
      copyToCacheDirectory: true,
      multiple: false,
    }));
    expect(FileSystem.readAsStringAsync).toHaveBeenCalledWith(
      'file:///cache/weekend.gpx',
      { encoding: 'utf8' },
    );
    expect(FileSystem.deleteAsync).toHaveBeenCalledWith(
      'file:///cache/weekend.gpx',
      { idempotent: true },
    );
    expect(props.onBusyChange.mock.calls).toEqual([[true], [false]]);
  });

  it('leaves callbacks untouched when the chooser is cancelled', async () => {
    DocumentPicker.getDocumentAsync.mockResolvedValue({ canceled: true, assets: null });
    const { getByTestId, props } = renderPicker();

    fireEvent.press(getByTestId('trip-route-import-picker'));
    await act(async () => undefined);

    expect(props.onPicked).not.toHaveBeenCalled();
    expect(props.onError).not.toHaveBeenCalled();
    expect(props.onBusyChange).not.toHaveBeenCalled();
    expect(FileSystem.readAsStringAsync).not.toHaveBeenCalled();
  });

  it('rejects an oversized cache copy before reading and still removes it', async () => {
    DocumentPicker.getDocumentAsync.mockResolvedValue({
      canceled: false,
      assets: [asset('huge.gpx', 101)],
    });
    const { getByTestId, props } = renderPicker();

    fireEvent.press(getByTestId('trip-route-import-picker'));

    await waitFor(() => expect(props.onError).toHaveBeenCalledWith('tooLarge'));
    expect(FileSystem.readAsStringAsync).not.toHaveBeenCalled();
    expect(FileSystem.deleteAsync).toHaveBeenCalledWith(
      'file:///cache/huge.gpx',
      { idempotent: true },
    );
    expect(props.onPicked).not.toHaveBeenCalled();
  });

  it('ignores a stale picker result but still cleans its cache copy', async () => {
    const firstPick = deferred<unknown>();
    const secondPick = deferred<unknown>();
    DocumentPicker.getDocumentAsync
      .mockImplementationOnce(() => firstPick.promise)
      .mockImplementationOnce(() => secondPick.promise);
    const { getByTestId, props } = renderPicker();

    fireEvent.press(getByTestId('trip-route-import-picker'));
    fireEvent.press(getByTestId('trip-route-import-picker'));

    await act(async () => {
      secondPick.resolve({ canceled: false, assets: [asset('new.kml')] });
      await secondPick.promise;
    });
    await waitFor(() => expect(props.onPicked).toHaveBeenCalledTimes(1));

    await act(async () => {
      firstPick.resolve({ canceled: false, assets: [asset('old.gpx')] });
      await firstPick.promise;
    });
    await waitFor(() => expect(FileSystem.deleteAsync).toHaveBeenCalledWith(
      'file:///cache/old.gpx',
      { idempotent: true },
    ));

    expect(props.onPicked).toHaveBeenCalledWith(expect.objectContaining({ name: 'new.kml' }));
    expect(props.onPicked).not.toHaveBeenCalledWith(expect.objectContaining({ name: 'old.gpx' }));
  });
});
