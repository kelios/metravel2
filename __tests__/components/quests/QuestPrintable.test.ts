const mockGenerateCanvasMapSnapshot = jest.fn(async () => '');

jest.mock('@/utils/mapImageGenerator', () => ({
  generateCanvasMapSnapshot: mockGenerateCanvasMapSnapshot,
  generateStaticMapUrl: jest.fn(async () => ''),
  generateLeafletRouteSnapshot: jest.fn(async () => ''),
}));

const mockOpenPendingBookPreviewWindow = jest.fn(() => ({}));
const mockOpenBookPreviewWindow = jest.fn();
const mockDiscardPendingBookPreviewWindow = jest.fn();

// Jest резолвит printHtml в native-адаптер; окно браузера — web-адаптер.
jest.mock('@/utils/printHtml', () => jest.requireActual('@/utils/printHtml.web'));

jest.mock('@/utils/openBookPreviewWindow', () => ({
  // обёртки: адаптер печати импортирует модуль до объявления моков ниже
  openPendingBookPreviewWindow: () => mockOpenPendingBookPreviewWindow(),
  openBookPreviewWindow: (...args: unknown[]) => (mockOpenBookPreviewWindow as (...a: unknown[]) => void)(...args),
  discardPendingBookPreviewWindow: (...args: unknown[]) => mockDiscardPendingBookPreviewWindow(...args),
}));

import { Platform } from 'react-native';
import { generatePrintableQuest } from '@/components/quests/QuestPrintable';
import * as printableMap from '@/components/quests/printable/map';

describe('QuestPrintable', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (Platform as { OS: string }).OS = 'web';
    (global as typeof globalThis & { window?: Record<string, unknown> }).window = { open: jest.fn() };
  });

  it('includes quest cover image in printable cover when coverUrl is provided', async () => {
    await generatePrintableQuest({
      title: 'Ереван: Город на вулкане',
      coverUrl: 'https://img.example.com/cover.jpg',
      questUrl: 'https://metravel.by/quests/4/minsk-cmok',
      steps: [
        {
          id: 'step-1',
          title: 'Шаг 1',
          location: 'Площадь',
          story: 'История',
          task: 'Задание',
          answer: () => true,
          lat: 40.1772,
          lng: 44.5035,
          mapsUrl: 'https://maps.google.com/maps?q=40.1772,44.5035',
        },
      ],
    });

    expect(mockOpenBookPreviewWindow).toHaveBeenCalledTimes(1);

    const html = mockOpenBookPreviewWindow.mock.calls[0][0];
    expect(html).toContain('class="cover has-cover-image"');
    expect(html).toContain('class="cover-image-backdrop"');
    expect(html).toContain('https://img.example.com/cover.jpg');
  });

  // #2198: язык разметки — язык текста квеста, а не интерфейса.
  it.each([
    ['pl', /<html lang="pl/],
    ['en', /<html lang="en/],
    [undefined, /<html lang="ru/],
  ])('ставит <html lang> по языку контента шагов (%s)', async (contentLocale, expected) => {
    await generatePrintableQuest({
      title: 'Quest',
      steps: [
        {
          id: 'step-1',
          title: 'Krok 1',
          location: 'Rynek',
          story: 'Historia',
          task: 'Zadanie',
          answer: () => true,
          contentLocale,
          lat: 50.0614,
          lng: 19.9366,
          mapsUrl: '',
        },
      ],
    });

    const html = mockOpenBookPreviewWindow.mock.calls[0][0];
    expect(html).toMatch(expected);
  });

  it('requests a close printable map snapshot so short quest routes stay readable', async () => {
    await generatePrintableQuest({
      title: 'Урочище Вялое',
      steps: [
        {
          id: 'step-1',
          title: 'Шаг 1',
          location: 'Опушка урочища Вялое, поляна у лесной дороги из Рудни',
          story: 'История',
          task: 'Задание',
          answer: () => true,
          lat: 53.9756,
          lng: 26.6891,
          mapsUrl: 'https://maps.google.com/maps?q=53.9756,26.6891',
        },
        {
          id: 'step-2',
          title: 'Шаг 2',
          location: 'Корпуса заброшенного санатория «Лесное»',
          story: 'История',
          task: 'Задание',
          answer: () => true,
          lat: 53.9768,
          lng: 26.6901,
          mapsUrl: 'https://maps.google.com/maps?q=53.9768,26.6901',
        },
      ],
    });

    expect(mockGenerateCanvasMapSnapshot).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({
        maxZoom: 17,
        fitPaddingFactor: 1.08,
      }),
    );
  });

  // #2102: попап заблокирован — выходим с 'unavailable' до canvas-карты и тайлов.
  it('returns unavailable before rendering the map when the print window is blocked', async () => {
    mockOpenPendingBookPreviewWindow.mockReturnValueOnce(null as never);

    const result = await generatePrintableQuest({
      title: 'Урочище Вялое',
      steps: [
        {
          id: 'step-1',
          title: 'Шаг 1',
          location: 'Опушка',
          story: 'История',
          task: 'Задание',
          answer: () => true,
          lat: 53.9756,
          lng: 26.6891,
          mapsUrl: 'https://maps.google.com/maps?q=53.9756,26.6891',
        },
      ],
    });

    expect(result).toBe('unavailable');
    expect(mockGenerateCanvasMapSnapshot).not.toHaveBeenCalled();
    expect(mockOpenBookPreviewWindow).not.toHaveBeenCalled();
  });

  // #2125: сборка документа упала после резерва — заглушка не остаётся висеть.
  it('closes the reserved print window when building the document fails', async () => {
    const win = { closed: false };
    mockOpenPendingBookPreviewWindow.mockReturnValueOnce(win as never);
    const spy = jest
      .spyOn(printableMap, 'buildPrintableCanvasMapDataUrl')
      .mockRejectedValueOnce(new Error('canvas failed'));

    await expect(
      generatePrintableQuest({
        title: 'Урочище Вялое',
        steps: [
          {
            id: 'step-1',
            title: 'Шаг 1',
            location: 'Опушка',
            story: 'История',
            task: 'Задание',
            answer: () => true,
            lat: 53.9756,
            lng: 26.6891,
            mapsUrl: 'https://maps.google.com/maps?q=53.9756,26.6891',
          },
        ],
      }),
    ).rejects.toThrow('canvas failed');
    expect(mockDiscardPendingBookPreviewWindow).toHaveBeenCalledWith(win);
    expect(mockOpenBookPreviewWindow).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
