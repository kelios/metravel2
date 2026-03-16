import { Platform } from 'react-native';
import { act, render, waitFor } from '@testing-library/react-native';

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
    boxShadows: {
      card: '0 8px 24px rgba(0, 0, 0, 0.08)',
      light: '0 4px 14px rgba(0, 0, 0, 0.06)',
    },
  }),
}));

describe('StableContent (web) link styles', () => {
  const setPlatformOs = (os: string) => {
    Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
  };

  beforeEach(() => {
    setPlatformOs('web');
    const existing = typeof document !== 'undefined'
      ? document.getElementById('travel-rich-text-styles')
      : null;
    if (existing?.parentNode) {
      existing.parentNode.removeChild(existing);
    }
  });

  afterEach(() => {
    const existing = typeof document !== 'undefined'
      ? document.getElementById('travel-rich-text-styles')
      : null;
    if (existing?.parentNode) {
      existing.parentNode.removeChild(existing);
    }
  });

  it('injects CSS styles synchronously and keeps <a> tag in rendered HTML', async () => {
    const StableContent = (await import('@/components/travel/StableContent')).default;

    const html = '<p>See <a href="https://example.com">Example</a></p>';

    const { UNSAFE_getAllByProps } = render(
      <StableContent html={html} contentWidth={700} />
    );

    const styleElImmediate = document.getElementById('travel-rich-text-styles') as HTMLStyleElement | null;
    expect(styleElImmediate).toBeTruthy();
    expect(String(styleElImmediate?.textContent || '')).toContain('.travel-rich-text a');

    await waitFor(() => {
      const styleEl = document.getElementById('travel-rich-text-styles') as HTMLStyleElement | null;
      expect(styleEl).toBeTruthy();
      expect(String(styleEl?.textContent || '')).toContain('.travel-rich-text a');
      expect(String(styleEl?.textContent || '')).toContain('text-decoration: underline');
    });

    const [container] = UNSAFE_getAllByProps({ className: 'travel-rich-text' });
    expect(container).toBeTruthy();
    expect(container.props.className).toBe('travel-rich-text');
    expect(container.props.dangerouslySetInnerHTML?.__html).toMatch(
      /href="https:\/\/example\.com\/?"/
    );
    expect(container.props.dangerouslySetInnerHTML?.__html).toContain('>Example<');
  });

  it('opens inline image in a lightbox on click and closes it', async () => {
    const StableContent = (await import('@/components/travel/StableContent')).default;

    render(
      <StableContent
        html={'<p><img src="https://example.com/photo.jpg" width="800" height="600" alt="Горы" /></p>'}
        contentWidth={700}
      />
    );

    await waitFor(() => {
      expect(document.querySelector(`.${'travel-rich-text'} img`)).toBeTruthy();
    });

    const inlineImage = document.querySelector('.travel-rich-text img') as HTMLImageElement | null;
    expect(inlineImage).toBeTruthy();

    act(() => {
      inlineImage?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    await waitFor(() => {
      const lightbox = document.querySelector('[data-testid="travel-rich-text-lightbox"]');
      expect(lightbox).toBeTruthy();
      expect(lightbox?.getAttribute('aria-label')).toBe('Горы');
    });

    const closeButton = document.querySelector('button[aria-label="Закрыть изображение"]') as HTMLButtonElement | null;
    expect(closeButton).toBeTruthy();

    act(() => {
      closeButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    await waitFor(() => {
      expect(document.querySelector('[data-testid="travel-rich-text-lightbox"]')).toBeNull();
    });
  });
});
