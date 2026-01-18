import React from 'react';
import { render, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { ImportWizard } from '@/components/UserPoints/ImportWizard';

jest.mock('expo-document-picker', () => ({
  getDocumentAsync: jest.fn(),
}));

jest.mock('@/src/api/parsers/googleMapsParser', () => ({
  GoogleMapsParser: {
    parse: jest.fn(),
  },
}));

jest.mock('@/src/api/parsers/osmParser', () => ({
  OSMParser: {
    parse: jest.fn(),
  },
}));

jest.mock('@/src/api/userPoints', () => ({
  userPointsApi: {
    importPoints: jest.fn()
  }
}));

describe('ImportWizard', () => {
  const mockOnComplete = jest.fn();
  const mockOnCancel = jest.fn();

  const mockGetDocumentAsync = require('expo-document-picker').getDocumentAsync as jest.Mock;
  const mockGoogleParse = require('@/src/api/parsers/googleMapsParser').GoogleMapsParser.parse as jest.Mock;
  const mockOsmParse = require('@/src/api/parsers/osmParser').OSMParser.parse as jest.Mock;
  const mockImportPoints = require('@/src/api/userPoints').userPointsApi.importPoints as jest.Mock;

  const mockAsset = {
    uri: 'file://test.json',
    name: 'Saved Places.json',
    size: 123,
    mimeType: 'application/json',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetDocumentAsync.mockResolvedValue({ canceled: false, assets: [mockAsset] });
    mockGoogleParse.mockResolvedValue([
      {
        id: 'p1',
        name: 'Test Point',
        latitude: 10,
        longitude: 20,
        color: 'blue',
        category: 'other',
        status: 'planning',
        source: 'google_maps',
        importedAt: new Date(0).toISOString(),
      },
    ]);
    mockOsmParse.mockRejectedValue(new Error('not osm'));
    mockImportPoints.mockResolvedValue({ imported: 1, skipped: 0 });
  });

  it('should render intro step with single import button', () => {
    render(<ImportWizard onComplete={mockOnComplete} onCancel={mockOnCancel} />);

    expect(screen.getAllByText('Импорт точек').length).toBeGreaterThan(0);
    expect(screen.getByText('Отмена')).toBeTruthy();
  });

  it('should open file picker and move to preview after selecting a file', async () => {
    render(<ImportWizard onComplete={mockOnComplete} onCancel={mockOnCancel} />);

    const importBtns = screen.getAllByText('Импорт точек');
    fireEvent.press(importBtns[importBtns.length - 1]);

    expect(mockGetDocumentAsync).toHaveBeenCalled();

    expect(await screen.findByText('Предпросмотр данных')).toBeTruthy();
    expect(screen.getByText('Найдено точек: 1')).toBeTruthy();
  });

  it('should allow going back to intro from preview', async () => {
    render(<ImportWizard onComplete={mockOnComplete} onCancel={mockOnCancel} />);

    const importBtns = screen.getAllByText('Импорт точек');
    fireEvent.press(importBtns[importBtns.length - 1]);
    await screen.findByText('Предпросмотр данных');

    fireEvent.press(screen.getByText('Назад'));
    expect(screen.getAllByText('Импорт точек').length).toBeGreaterThan(0);
  });

  it('should call onCancel when cancel button is pressed', () => {
    render(<ImportWizard onComplete={mockOnComplete} onCancel={mockOnCancel} />);

    const cancelButton = screen.getByText('Отмена');
    fireEvent.press(cancelButton);

    expect(mockOnCancel).toHaveBeenCalled();
  });

  it('should import after preview', async () => {
    render(<ImportWizard onComplete={mockOnComplete} onCancel={mockOnCancel} />);

    const importBtns = screen.getAllByText('Импорт точек');
    fireEvent.press(importBtns[importBtns.length - 1]);
    await screen.findByText('Предпросмотр данных');

    fireEvent.press(screen.getByText('Импортировать'));

    await waitFor(() => {
      expect(mockImportPoints).toHaveBeenCalled();
    });

    expect(await screen.findByText('Импорт завершен!')).toBeTruthy();
    expect(screen.getByText('Импортировано: 1 точек')).toBeTruthy();
  });

  it('should allow closing complete screen', async () => {
    render(<ImportWizard onComplete={mockOnComplete} onCancel={mockOnCancel} />);

    const importBtns = screen.getAllByText('Импорт точек');
    fireEvent.press(importBtns[importBtns.length - 1]);
    await screen.findByText('Предпросмотр данных');
    fireEvent.press(screen.getByText('Импортировать'));
    await screen.findByText('Импорт завершен!');

    fireEvent.press(screen.getByText('Готово'));

    expect(mockOnComplete).toHaveBeenCalled();
  });

  it('should show error when file type cannot be detected', async () => {
    mockGoogleParse.mockRejectedValueOnce(new Error('bad google'));
    mockOsmParse.mockRejectedValueOnce(new Error('bad osm'));

    render(<ImportWizard onComplete={mockOnComplete} onCancel={mockOnCancel} />);

    const importBtns = screen.getAllByText('Импорт точек');
    fireEvent.press(importBtns[importBtns.length - 1]);

    expect(await screen.findByText('Не удалось распознать формат файла. Поддерживаются: JSON (Google Takeout), GeoJSON, GPX, KML.')).toBeTruthy();
  });
});
