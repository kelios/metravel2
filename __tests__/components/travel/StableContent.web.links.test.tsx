import { Platform } from 'react-native';
import { render, waitFor } from '@testing-library/react-native';

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

  it('injects CSS styles for anchors and keeps <a> tag in rendered HTML', async () => {
    const StableContent = (await import('@/components/travel/StableContent')).default;

    const html = '<p>See <a href="https://example.com">Example</a></p>';

    const { UNSAFE_getAllByProps } = render(
      <StableContent html={html} contentWidth={700} />
    );

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
});
