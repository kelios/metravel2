import { Platform } from 'react-native';
import { render, waitFor } from '@testing-library/react';

jest.mock('@/utils/sanitizeRichText', () => {
  const actual = jest.requireActual('@/utils/sanitizeRichText');
  return {
    ...actual,
    sanitizeRichText: jest.fn(actual.sanitizeRichText),
  };
});

import { SafeHtml } from '@/components/article/SafeHtml';
import { sanitizeRichText } from '@/utils/sanitizeRichText';

const mockedSanitize = sanitizeRichText as jest.MockedFunction<typeof sanitizeRichText>;

describe('SafeHtml serverSanitized canonical path (#709)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true });
  });

  it('renders server safe_html without invoking the full client sanitizer', async () => {
    const { container } = render(
      <SafeHtml html={'<h2 id="intro">Интро</h2><p>Canonical текст</p>'} serverSanitized />,
    );

    await waitFor(() => {
      expect(container.querySelector('#intro')).toBeTruthy();
    });
    expect(container.textContent).toContain('Canonical текст');
    expect(mockedSanitize).not.toHaveBeenCalled();
  });

  it('still applies the cheap guard to server html', async () => {
    const { container } = render(
      <SafeHtml
        html={'<p onclick="alert(1)">text</p><script>alert(2)</script>'}
        serverSanitized
      />,
    );

    await waitFor(() => {
      expect(container.textContent).toContain('text');
    });
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('[onclick]')).toBeNull();
    expect(mockedSanitize).not.toHaveBeenCalled();
  });

  it('legacy payload keeps the full sanitize pipeline', async () => {
    const { container } = render(<SafeHtml html={'<p>legacy</p>'} />);

    await waitFor(() => {
      expect(container.textContent).toContain('legacy');
    });
    expect(mockedSanitize).toHaveBeenCalledTimes(1);
  });

  it('adds a fallback alt only to rich-text images that do not already have one', async () => {
    const { container } = render(
      <SafeHtml
        html={'<p><img src="/one.jpg"><img src="/two.jpg" alt="Подпись автора"></p>'}
        serverSanitized
        imageAlt={'Маршрут «Краков»'}
      />,
    );

    await waitFor(() => {
      expect(container.querySelectorAll('img')).toHaveLength(2);
    });
    expect(container.querySelector('img[src="/one.jpg"]')?.getAttribute('alt')).toBe('Маршрут «Краков»');
    expect(container.querySelector('img[src="/two.jpg"]')?.getAttribute('alt')).toBe('Подпись автора');
  });
});
