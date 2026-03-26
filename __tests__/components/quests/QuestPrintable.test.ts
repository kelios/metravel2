jest.mock('@/utils/mapImageGenerator', () => ({
  generateStaticMapUrl: jest.fn(async () => ''),
  generateLeafletRouteSnapshot: jest.fn(async () => ''),
}));

const mockOpenPendingBookPreviewWindow = jest.fn(() => null);
const mockOpenBookPreviewWindow = jest.fn();

jest.mock('@/utils/openBookPreviewWindow', () => ({
  openPendingBookPreviewWindow: mockOpenPendingBookPreviewWindow,
  openBookPreviewWindow: mockOpenBookPreviewWindow,
}));

import { Platform } from 'react-native';
import { generatePrintableQuest } from '@/components/quests/QuestPrintable';

describe('QuestPrintable', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (Platform as { OS: string }).OS = 'web';
    (global as typeof globalThis & { window?: Record<string, unknown> }).window = {};
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
    expect(html).toContain('class="cover-image"');
    expect(html).toContain('https://img.example.com/cover.jpg');
  });
});
