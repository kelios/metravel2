import { Platform } from 'react-native';
import { render, waitFor } from '@testing-library/react-native';

jest.mock('@/hooks/useTheme', () => ({
  useThemedColors: () => ({
    text: '#111111',
    textMuted: '#666666',
    primary: '#0a84ff',
    primaryText: '#0a84ff',
    focus: '#ff00ff',
    surface: '#ffffff',
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

describe('StableContent (web) inline image priority', () => {
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

  it('keeps inline rich-text images lazy and low priority', async () => {
    const StableContent = (await import('@/components/travel/StableContent')).default;

    const html = [
      '<p>First paragraph</p>',
      '<img src="https://example.com/hero.jpg" width="800" height="600" />',
      '<p>Middle text</p>',
      '<img src="https://example.com/second.jpg" width="640" height="480" />',
      '<img src="https://example.com/third.jpg" />',
    ].join('');

    const { UNSAFE_getAllByProps } = render(
      <StableContent html={html} contentWidth={700} />
    );

    await waitFor(() => {
      const [container] = UNSAFE_getAllByProps({ className: 'travel-rich-text' });
      expect(container).toBeTruthy();

      const rendered: string = container.props.dangerouslySetInnerHTML?.__html ?? '';

      // Extract all img tags from rendered HTML
      const imgTags = rendered.match(/<img\b[^>]*>/gi) ?? [];
      expect(imgTags.length).toBeGreaterThanOrEqual(2);

      imgTags.forEach((tag) => {
        expect(tag).toContain('fetchpriority="low"');
        expect(tag).toContain('loading="lazy"');
      });
    });
  });
});
