/**
 * @jest-environment jsdom
 * @jest-environment-options {"url":"https://metravel.by/"}
 */

import { Platform } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react';

let StableContent: (typeof import('@/components/travel/StableContent.web'))['default'];

jest.mock('@/hooks/useTheme', () => ({
  useThemedColors: () => ({
    text: '#111111',
    textMuted: '#666666',
    primary: '#0a84ff',
    focus: '#ff00ff',
    surfaceMuted: '#f7f7f7',
    borderLight: '#e5e7eb',
    backgroundSecondary: '#fafafa',
    mutedBackground: '#f3f4f6',
    boxShadows: { card: 'none', light: 'none' },
  }),
}));

jest.mock('@/components/travel/FullscreenGallery', () => ({ __esModule: true, default: () => null }));

/**
 * #3262: клик по фасаду YouTube строит адрес плеера из `data-yt`. Сейчас санитайзер
 * срезает авторский `data-yt`, и фасад строит только htmlTransform — проверка
 * формата в обработчике не зависит от этого: в адрес идёт только id ролика.
 */
describe('YouTube facade click (#3262)', () => {
  beforeAll(async () => {
    StableContent = (await import('@/components/travel/StableContent.web')).default;
  });

  beforeEach(() => {
    Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true });
  });

  const CANONICAL = '<p><iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ"></iframe></p>';

  const renderFacade = async (dataYt?: string) => {
    const { container } = render(<StableContent html={CANONICAL} contentWidth={700} />);
    await waitFor(() => {
      expect(container.querySelector('.yt-lite')).toBeTruthy();
    });
    const facade = container.querySelector('.yt-lite') as HTMLElement;
    if (dataYt !== undefined) facade.setAttribute('data-yt', dataYt);
    fireEvent.click(facade);
    return facade;
  };

  it('opens the player for a canonical video id', async () => {
    const facade = await renderFacade();
    expect(facade.getAttribute('data-yt')).toBe('dQw4w9WgXcQ');
    expect(facade.querySelector('iframe')?.getAttribute('src')).toBe(
      'https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=1&rel=0',
    );
  });

  it.each([
    '../../watch?v=x&list=y',
    'abc/def',
    'abcdef?autoplay=0#t',
    'a'.repeat(21),
    'abc',
  ])('ignores a facade whose data-yt is not a video id: %s', async (value) => {
    const facade = await renderFacade(value);
    expect(facade.querySelector('iframe')).toBeNull();
  });
});
