import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Platform } from 'react-native';

import TravelRouteFilesPanel from '@/components/travel/TravelRouteFilesPanel';
import { listTravelRouteFiles, uploadTravelRouteFile } from '@/api/travelRoutes';

const ORIGINAL_PLATFORM_OS = Platform.OS;

jest.mock('expo-document-picker', () => ({
  getDocumentAsync: jest.fn(),
}));

jest.mock('@/ui/paper', () => ({
  Button: ({ children, onPress, disabled }: any) => {
    const React = require('react');
    const { Pressable, Text } = require('react-native');
    return (
      <Pressable onPress={onPress} disabled={disabled}>
        <Text>{children}</Text>
      </Pressable>
    );
  },
}));

jest.mock('@/hooks/useTheme', () => ({
  useThemedColors: () => ({
    primary: '#7a9d8f',
    primarySoft: 'rgba(122, 157, 143, 0.06)',
    primaryText: '#5a7f70',
    surface: '#ffffff',
    text: '#3a3a3a',
    textMuted: '#6a6a6a',
    border: 'rgba(58, 58, 58, 0.06)',
    borderLight: 'rgba(58, 58, 58, 0.04)',
    danger: '#b23b3b',
  }),
}));

jest.mock('@/api/travelRoutes', () => ({
  deleteTravelRouteFile: jest.fn(),
  downloadTravelRouteFileBlob: jest.fn(),
  listTravelRouteFiles: jest.fn(async () => []),
  uploadTravelRouteFile: jest.fn(async () => ({
    id: 1,
    original_name: 'route.gpx',
    ext: 'gpx',
  })),
}));

jest.mock('@/utils/travelRouteDownload', () => ({
  downloadTravelRouteFile: jest.fn(),
}));

jest.mock('@/utils/routeFileParser', () => ({
  parseRouteFilePreview: jest.fn(() => ({ linePoints: [], elevationProfile: [] })),
}));

const makeDropEvent = (files: File[]) => {
  const event: any = {
    preventDefault: jest.fn(),
    stopPropagation: jest.fn(),
    dataTransfer: {
      files,
      dropEffect: 'none',
    },
  };
  return event;
};

describe('TravelRouteFilesPanel drag-and-drop', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (listTravelRouteFiles as jest.Mock).mockResolvedValue([]);
    (uploadTravelRouteFile as jest.Mock).mockResolvedValue({
      id: 1,
      original_name: 'route.gpx',
      ext: 'gpx',
    });
    Object.defineProperty(Platform, 'OS', { value: 'web' });
  });

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { value: ORIGINAL_PLATFORM_OS });
  });

  it('uploads a dropped GPX file through the same route upload API', async () => {
    const file = new File(['<gpx></gpx>'], 'Парковка 2.gpx', { type: 'application/gpx+xml' });
    (listTravelRouteFiles as jest.Mock)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 1, original_name: 'Парковка 2.gpx', ext: 'gpx', size: 5420 }]);
    (uploadTravelRouteFile as jest.Mock).mockResolvedValueOnce({
      id: 1,
      original_name: 'Парковка 2.gpx',
      ext: 'gpx',
      size: 5420,
    });
    const screen = render(<TravelRouteFilesPanel travelId={640} allowUpload />);
    const panel = screen.getByTestId('travel-route-files-panel');
    const dropEvent = makeDropEvent([file]);

    fireEvent(panel, 'dragOver', dropEvent);
    fireEvent(panel, 'drop', dropEvent);

    await waitFor(() => {
      expect(uploadTravelRouteFile).toHaveBeenCalledWith(640, file);
    });
    expect(await screen.findByText('Парковка 2.gpx')).toBeTruthy();
    expect(dropEvent.preventDefault).toHaveBeenCalled();
    expect(dropEvent.stopPropagation).toHaveBeenCalled();
  });

  it('rejects unsupported dropped files without uploading them', async () => {
    const file = new File(['text'], 'notes.txt', { type: 'text/plain' });
    const screen = render(<TravelRouteFilesPanel travelId={640} allowUpload />);
    const panel = screen.getByTestId('travel-route-files-panel');

    fireEvent(panel, 'drop', makeDropEvent([file]));

    await waitFor(() => {
      expect(screen.getByText('Поддерживаются только файлы .gpx и .kml')).toBeTruthy();
    });
    expect(uploadTravelRouteFile).not.toHaveBeenCalled();
  });
});
