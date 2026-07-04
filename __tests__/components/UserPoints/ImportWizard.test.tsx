import { render, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ImportWizard } from '@/components/UserPoints/ImportWizard';
import type { ImportPreviewResult } from '@/types/userPoints';

jest.mock('expo-document-picker', () => ({
  getDocumentAsync: jest.fn(),
}));

jest.mock('@/api/userPoints', () => ({
  userPointsApi: {
    previewImport: jest.fn(),
    importPoints: jest.fn(),
  },
}));

describe('ImportWizard', () => {
  const mockOnComplete = jest.fn();
  const mockOnCancel = jest.fn();

  const renderWithClient = () => {
    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    return render(
      <QueryClientProvider client={client}>
        <ImportWizard onComplete={mockOnComplete} onCancel={mockOnCancel} />
      </QueryClientProvider>
    );
  };

  const renderWithClientAndSpy = () => {
    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    const invalidateSpy = jest.spyOn(client, 'invalidateQueries');

    const utils = render(
      <QueryClientProvider client={client}>
        <ImportWizard onComplete={mockOnComplete} onCancel={mockOnCancel} />
      </QueryClientProvider>
    );

    return { ...utils, client, invalidateSpy };
  };

  const mockGetDocumentAsync = require('expo-document-picker').getDocumentAsync as jest.Mock;
  const mockPreviewImport = require('@/api/userPoints').userPointsApi.previewImport as jest.Mock;
  const mockImportPoints = require('@/api/userPoints').userPointsApi.importPoints as jest.Mock;

  const mockAsset = {
    uri: 'file://test.geojson',
    name: 'Saved Places.geojson',
    size: 123,
    mimeType: 'application/geo+json',
  };

  const previewResult: ImportPreviewResult = {
    importId: 'preview-1',
    dryRun: true,
    source: 'geojson',
    dedupePolicy: 'merge',
    points: [
      {
        name: 'Point 1',
        description: null,
        latitude: 1,
        longitude: 2,
        address: null,
        color: 'brown',
        status: 'planned',
        source: 'geojson',
        originalId: null,
        categoryIds: [],
      },
    ],
    summary: {
      totalParsed: 1,
      valid: 1,
      created: 0,
      updated: 0,
      skipped: 0,
      duplicates: 0,
      warnings: [],
      errors: [],
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetDocumentAsync.mockResolvedValue({ canceled: false, assets: [mockAsset] });
    mockPreviewImport.mockResolvedValue(previewResult);
    mockImportPoints.mockResolvedValue({ created: 1, skipped: 0 });
  });

  it('should render intro step with single import button', () => {
    renderWithClient();

    expect(screen.getAllByText('Импорт точек').length).toBeGreaterThan(0);
    expect(screen.getByText('Отмена')).toBeTruthy();
  });

  it('should send the file to the server dry-run preview and move to preview', async () => {
    renderWithClient();

    const importBtns = screen.getAllByText('Импорт точек');
    fireEvent.press(importBtns[importBtns.length - 1]);

    expect(mockGetDocumentAsync).toHaveBeenCalled();

    expect(await screen.findByText('Предпросмотр данных')).toBeTruthy();
    expect(mockPreviewImport).toHaveBeenCalledWith(mockAsset);
    expect(screen.getByText(/Найдено точек:\s*1/)).toBeTruthy();
  });

  it('should allow going back to intro from preview', async () => {
    renderWithClient();

    const importBtns = screen.getAllByText('Импорт точек');
    fireEvent.press(importBtns[importBtns.length - 1]);
    await screen.findByText('Предпросмотр данных');

    fireEvent.press(screen.getByText('Назад'));
    expect(screen.getAllByText('Импорт точек').length).toBeGreaterThan(0);
  });

  it('should call onCancel when cancel button is pressed', () => {
    renderWithClient();

    const cancelButton = screen.getByText('Отмена');
    fireEvent.press(cancelButton);

    expect(mockOnCancel).toHaveBeenCalled();
  });

  it('should import after preview via non-dry-run call', async () => {
    renderWithClient();

    const importBtns = screen.getAllByText('Импорт точек');
    fireEvent.press(importBtns[importBtns.length - 1]);
    await screen.findByText('Предпросмотр данных');

    fireEvent.press(screen.getByText('Импортировать'));

    await waitFor(() => {
      expect(mockImportPoints).toHaveBeenCalledWith(mockAsset, { dedupePolicy: 'merge' });
    });

    expect(await screen.findByText('Импорт завершен!')).toBeTruthy();
    expect(screen.getByText(/Создано:\s*1\s*точек/)).toBeTruthy();
  });

  it('should invalidate userPoints query after successful import', async () => {
    const { invalidateSpy } = renderWithClientAndSpy();

    const importBtns = screen.getAllByText('Импорт точек');
    fireEvent.press(importBtns[importBtns.length - 1]);
    await screen.findByText('Предпросмотр данных');

    fireEvent.press(screen.getByText('Импортировать'));

    await waitFor(() => {
      expect(mockImportPoints).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['userPointsAll'] });
    });
  });

  it('should allow closing complete screen', async () => {
    renderWithClient();

    const importBtns = screen.getAllByText('Импорт точек');
    fireEvent.press(importBtns[importBtns.length - 1]);
    await screen.findByText('Предпросмотр данных');
    fireEvent.press(screen.getByText('Импортировать'));
    await screen.findByText('Импорт завершен!');

    fireEvent.press(screen.getByText('Готово'));

    expect(mockOnComplete).toHaveBeenCalled();
  });

  it('should show backend errors when preview returns no points', async () => {
    mockPreviewImport.mockResolvedValueOnce({
      ...previewResult,
      points: [],
      summary: { ...previewResult.summary, totalParsed: 0, valid: 0, errors: ['Unsupported file type'] },
    });

    renderWithClient();

    const importBtns = screen.getAllByText('Импорт точек');
    fireEvent.press(importBtns[importBtns.length - 1]);

    expect(await screen.findByText(/Unsupported file type/)).toBeTruthy();
  });

  it('should surface a thrown preview error', async () => {
    mockPreviewImport.mockRejectedValueOnce(new Error('Network down'));

    renderWithClient();

    const importBtns = screen.getAllByText('Импорт точек');
    fireEvent.press(importBtns[importBtns.length - 1]);

    expect(await screen.findByText(/Network down/)).toBeTruthy();
  });
});
