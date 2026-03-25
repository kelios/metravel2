import { Platform } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react';

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

  it('scrolls to internal hash anchors on click', async () => {
    const StableContent = (await import('@/components/travel/StableContent')).default;

    const scrollIntoView = jest.fn();
    const originalScrollIntoView = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = scrollIntoView;

    try {
      const { container } = render(
        <StableContent
          html={'<p><a href="#section-1">Перейти</a></p><h2><span id="section-1">Секция 1</span></h2>'}
          contentWidth={700}
        />
      );

      await waitFor(() => {
        expect(container.querySelector('.travel-rich-text a[href="#section-1"]')).toBeTruthy();
        expect(container.querySelector('#section-1')).toBeTruthy();
      });

      const anchor = container.querySelector('.travel-rich-text a[href="#section-1"]') as HTMLAnchorElement | null;
      expect(anchor).toBeTruthy();

      fireEvent.click(anchor!);

      expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
      expect(window.location.hash).toBe('#section-1');
    } finally {
      Element.prototype.scrollIntoView = originalScrollIntoView;
    }
  });

  it('restores direct travel hash navigation with returnTo query on first render', async () => {
    const StableContent = (await import('@/components/travel/StableContent')).default;

    const scrollIntoView = jest.fn();
    const originalScrollIntoView = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = scrollIntoView;
    window.history.replaceState(null, '', '/travels/krakovskie-dolinki?returnTo=%2Fsearch#bedkowska');

    try {
      const html = [
        '<ul>',
        '<li><a href="#kobylanska">Кобылянская долина</a></li>',
        '<li><a href="#bolechowicka">Болеховицкая долина</a></li>',
        '<li><a href="#bedkowska">Бендковская долина</a></li>',
        '</ul>',
        '<h2>1. Кобылянская долина / Dolina Kobylańska</h2>',
        '<h2>2. Болеховицкая долина / Dolina Bolechowicka</h2>',
        '<h2>3. Бендковская долина / Dolina Będkowska</h2>',
      ].join('');

      const { container } = render(
        <StableContent html={html} contentWidth={700} />
      );

      await waitFor(() => {
        expect(container.querySelector('#bedkowska')).toBeTruthy();
      });

      await waitFor(() => {
        expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
      });

      expect(window.location.search).toBe('?returnTo=%2Fsearch');
      expect(window.location.hash).toBe('#bedkowska');

      const heading = container.querySelector('#bedkowska');
      expect(heading?.textContent).toContain('Бендковская долина');
    } finally {
      Element.prototype.scrollIntoView = originalScrollIntoView;
      window.history.replaceState(null, '', '/');
    }
  });

  it('injects CSS styles synchronously and keeps <a> tag in rendered HTML', async () => {
    const StableContent = (await import('@/components/travel/StableContent')).default;

    const html = '<p>See <a href="https://example.com">Example</a></p>';

    const { container } = render(
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

    const richText = container.querySelector('.travel-rich-text');
    expect(richText).toBeTruthy();
    expect(richText?.className).toBe('travel-rich-text');
    expect(richText?.innerHTML).toMatch(
      /href="https:\/\/example\.com\/?"/
    );
    expect(richText?.innerHTML).toContain('>Example<');
  });

  it('opens inline image in a lightbox on click and closes it', async () => {
    const StableContent = (await import('@/components/travel/StableContent')).default;

    const { container } = render(
      <StableContent
        html={'<p><img src="https://example.com/photo.jpg" width="800" height="600" alt="Горы" /></p>'}
        contentWidth={700}
      />
    );

    await waitFor(() => {
      expect(container.querySelector('.travel-rich-text img')).toBeTruthy();
    });

    const inlineImage = container.querySelector('.travel-rich-text img') as HTMLImageElement | null;
    expect(inlineImage).toBeTruthy();

    fireEvent.click(inlineImage!);

    await waitFor(() => {
      const lightbox = document.querySelector('[data-testid="travel-rich-text-lightbox"]');
      expect(lightbox).toBeTruthy();
      expect(lightbox?.getAttribute('aria-label')).toBe('Горы');
    });

    const closeButton = document.querySelector('button[aria-label="Закрыть изображение"]') as HTMLButtonElement | null;
    expect(closeButton).toBeTruthy();

    fireEvent.click(closeButton!);

    await waitFor(() => {
      expect(document.querySelector('[data-testid="travel-rich-text-lightbox"]')).toBeNull();
    });
  });

  it('renders description image containers with blur backdrop styles and contain fit', async () => {
    const StableContent = (await import('@/components/travel/StableContent')).default;

    const { container } = render(
      <StableContent
        html={[
          '<p><img src="https://example.com/one.jpg" width="800" height="600" alt="One" /></p>',
          '<p><img src="https://example.com/two.jpg" width="600" height="900" alt="Two" /></p>',
        ].join('')}
        contentWidth={700}
      />
    );

    await waitFor(() => {
      const richText = container.querySelector('.travel-rich-text');
      expect(richText).toBeTruthy();
      expect(richText?.innerHTML).toContain('class="rich-image-frame');
      expect(richText?.innerHTML).toContain("--travel-rich-image:url('https://images.weserv.nl/?url=example.com%2Fone.jpg");
    });

    const styleEl = document.getElementById('travel-rich-text-styles') as HTMLStyleElement | null;
    expect(styleEl).toBeTruthy();
    const css = String(styleEl?.textContent || '');
    expect(css).toContain('.travel-rich-text .rich-image-frame::before');
    expect(css).toContain('object-fit: contain;');
    expect(css).not.toContain('object-fit: cover;');
  });

  it('adds spacing between consecutive inline images rendered inside one paragraph', async () => {
    const StableContent = (await import('@/components/travel/StableContent')).default;

    render(
      <StableContent
        html={'<p><img src="https://example.com/one.jpg" width="800" height="600" alt="One" /><img src="https://example.com/two.jpg" width="800" height="600" alt="Two" /></p>'}
        contentWidth={700}
      />
    );

    await waitFor(() => {
      const styleEl = document.getElementById('travel-rich-text-styles') as HTMLStyleElement | null;
      expect(styleEl).toBeTruthy();
      const css = String(styleEl?.textContent || '');
      expect(css).toContain('.travel-rich-text p > img + img');
      expect(css).toContain('margin-top: 18px !important;');
    });
  });
});
