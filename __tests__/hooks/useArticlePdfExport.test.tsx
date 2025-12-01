// __tests__/hooks/useArticlePdfExport.test.tsx
// Тесты для useArticlePdfExport (экспорт одной статьи)

import React from 'react';
import { renderHook, act } from '@testing-library/react-native';
import type { Travel } from '@/src/types/types';
import { useArticlePdfExport } from '@/src/hooks/useArticlePdfExport';
import type { ArticleExportSettings } from '@/src/services/pdf-export/generators/ArticlePdfGenerator';

const mockGenerateHtml: (...args: any[]) => string = jest.fn(
  () => '<!doctype html><html lang="ru"><body>Article PDF</body></html>'
);
const mockOpenBookPreviewWindow = jest.fn();

jest.mock('@/src/services/pdf-export/ArticlePdfExportService', () => ({
  ArticlePdfExportService: jest.fn().mockImplementation(() => ({
    generateHtml: (...args: any[]) => mockGenerateHtml(...(args as [any, any])),
  })),
}));

jest.mock('@/src/utils/openBookPreviewWindow', () => ({
  openBookPreviewWindow: (...args: any[]) => mockOpenBookPreviewWindow(...args),
}));

const buildTravel = (): Travel => ({
  id: 1,
  name: 'Статья-путешествие',
  description: '<p>Описание</p>',
  recommendation: '<p>Советы</p>',
  plus: '<p>Плюсы</p>',
  minus: '<p>Минусы</p>',
  countryName: 'Беларусь',
  cityName: 'Минск',
  number_days: 3,
} as unknown as Travel);

describe('useArticlePdfExport', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('инициализируется с корректным начальными значениями', () => {
    const { result } = renderHook(() => useArticlePdfExport());

    expect(result.current.isGenerating).toBe(false);
    expect(result.current.progress).toBe(0);
    expect(result.current.error).toBeNull();
    expect(typeof result.current.exportArticle).toBe('function');
  });

  it('использует пресет по умолчанию и открывает окно предпросмотра', async () => {
    const travel = buildTravel();
    const { result } = renderHook(() => useArticlePdfExport());

    await act(async () => {
      await result.current.exportArticle(travel);
    });

    expect(mockGenerateHtml).toHaveBeenCalledTimes(1);

    const firstCallArgs = mockGenerateHtml.mock.calls[0] as any[];
    const calledTravel = firstCallArgs[0] as Travel;
    const calledSettings = firstCallArgs[1] as ArticleExportSettings;

    expect(calledTravel).toBe(travel);
    expect(calledSettings.theme).toBeDefined();
    expect(calledSettings.format).toBeDefined();
    expect(calledSettings.includeToc).toBe(true);

    expect(mockOpenBookPreviewWindow).toHaveBeenCalledTimes(1);
  });

  it('переопределяет настройки поверх пресета через overrides', async () => {
    const travel = buildTravel();
    const { result } = renderHook(() => useArticlePdfExport({ defaultPresetId: 'default' }));

    await act(async () => {
      await result.current.exportArticle(travel, { includeMap: false });
    });

    const firstCallArgs = mockGenerateHtml.mock.calls[0] as any[];
    const calledSettings = firstCallArgs[1] as ArticleExportSettings;

    expect(calledSettings.includeMap).toBe(false);
  });

  it('обрабатывает ошибки генерации и сохраняет их в состоянии', async () => {
    const travel = buildTravel();
    const error = new Error('Generation failed');
    mockGenerateHtml.mockImplementationOnce(() => {
      throw error;
    });

    const { result } = renderHook(() => useArticlePdfExport());

    await act(async () => {
      await result.current.exportArticle(travel);
    });

    expect(result.current.error).toEqual(error);
    expect(result.current.isGenerating).toBe(false);
    expect(result.current.progress).toBe(0);
  });
});
