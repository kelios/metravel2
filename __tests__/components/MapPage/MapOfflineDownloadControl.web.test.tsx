import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

const mockFetchOfflineMapPoints = jest.fn();
const mockReadMapRegionOffline = jest.fn();
const mockSaveMapRegionOffline = jest.fn();

jest.mock('@/api/mapOffline', () => ({
  fetchOfflineMapPoints: (...args: unknown[]) => mockFetchOfflineMapPoints(...args),
}));

jest.mock('@/hooks/useOfflineCatalog', () => ({
  useOfflineCatalog: () => ({ items: [] }),
}));

jest.mock('@/services/offline/mapOfflineAdapter', () => {
  const actual = jest.requireActual('@/services/offline/mapOfflineAdapter');
  return {
    ...actual,
    readMapRegionOffline: (...args: unknown[]) => mockReadMapRegionOffline(...args),
    saveMapRegionOffline: (...args: unknown[]) => mockSaveMapRegionOffline(...args),
    deleteMapRegionOffline: jest.fn(),
  };
});

jest.mock('@/i18n/LocaleProvider', () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      key === 'offline:mapPointsSaved'
        ? `saved:${String(values?.count ?? '')}`
        : key,
  }),
}));

import MapOfflineDownloadControlWeb from '@/components/MapPage/MapOfflineDownloadControl.web';

const bbox = { west: 27.4, south: 53.8, east: 27.7, north: 54 };

describe('MapOfflineDownloadControl web parity', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockReadMapRegionOffline.mockResolvedValue(null);
    mockFetchOfflineMapPoints.mockResolvedValue({
      points: [{ id: 1, title: 'Point' }],
      etag: '"v1"',
      notModified: false,
    });
    mockSaveMapRegionOffline.mockResolvedValue(undefined);
  });

  it('saves a truthful point-only region in the loaded web shell', async () => {
    const view = render(<MapOfflineDownloadControlWeb bbox={bbox} />);
    fireEvent.press(view.getByTestId('map-offline-download-fab'));
    fireEvent.press(view.getByText('offline:saveMapRegion'));

    await waitFor(() => {
      expect(mockSaveMapRegionOffline).toHaveBeenCalledWith(
        expect.objectContaining({
          bbox,
          minZ: 0,
          maxZ: 0,
          tileCount: 0,
          bytes: 0,
        }),
        [{ id: 1, title: 'Point' }],
        '"v1"',
      );
    });
    expect(view.getByText('saved:1')).toBeTruthy();
  });

  it('keeps save disabled until the viewport bbox is known', () => {
    const view = render(<MapOfflineDownloadControlWeb bbox={null} />);
    fireEvent.press(view.getByTestId('map-offline-download-fab'));

    expect(view.getByText('offline:mapRegionUnavailable')).toBeTruthy();
    expect(view.getByTestId('map-offline-download-submit').props.accessibilityState?.disabled).toBe(true);
  });
});
