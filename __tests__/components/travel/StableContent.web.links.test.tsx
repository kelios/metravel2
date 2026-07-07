import { Platform } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react';

let StableContent: (typeof import('@/components/travel/StableContent'))['default'];

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
  const originalUserAgent = window.navigator.userAgent;

  const setPlatformOs = (os: string) => {
    Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
  };

  const setUserAgent = (value: string) => {
    Object.defineProperty(window.navigator, 'userAgent', {
      value,
      configurable: true,
    });
  };

  beforeEach(() => {
    setPlatformOs('web');
    setUserAgent(originalUserAgent);
    const existing = typeof document !== 'undefined'
      ? document.getElementById('travel-rich-text-styles')
      : null;
    if (existing?.parentNode) {
      existing.parentNode.removeChild(existing);
    }
  });

  beforeAll(async () => {
    StableContent = (await import('@/components/travel/StableContent')).default;
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

  it('renders standalone instagram post links as embeds in travel content on web', async () => {
    // The facade is rendered first, then lazily hydrated into the real Instagram iframe
    // by useStableContentWebEffects. Regression guard: a deleted hydration effect once
    // left these posts as static link cards.
    const html =
      '<p><a href="https://www.instagram.com/p/CScU4bJI2Ud/">https://www.instagram.com/p/CScU4bJI2Ud/</a></p>';

    const { container } = render(
      <StableContent html={html} contentWidth={700} />
    );

    await waitFor(() => {
      const iframe = container.querySelector('.travel-rich-text iframe[src*="instagram.com"]') as HTMLIFrameElement | null;
      expect(iframe).toBeTruthy();
      expect(container.querySelector('.travel-rich-text .rich-social-card--instagram')).toBeNull();
      expect(iframe?.getAttribute('src')).toBe(
        'https://www.instagram.com/p/CScU4bJI2Ud/embed/?omitscript=true&hidecaption=1'
      );
    });
  });

  it('keeps instagram posts as openable facade links on iOS Safari', async () => {
    setUserAgent(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1'
    );

    const html =
      '<p><a href="https://www.instagram.com/p/CScU4bJI2Ud/">https://www.instagram.com/p/CScU4bJI2Ud/</a></p>';

    const { container } = render(
      <StableContent html={html} contentWidth={700} />
    );

    await waitFor(() => {
      const facade = container.querySelector('.travel-rich-text .ig-lite') as HTMLDivElement | null;
      const link = container.querySelector('.travel-rich-text .ig-lite__title') as HTMLAnchorElement | null;

      expect(facade).toBeTruthy();
      expect(container.querySelector('.travel-rich-text iframe[src*="instagram.com"]')).toBeNull();
      expect(link?.getAttribute('href')).toBe('https://www.instagram.com/p/CScU4bJI2Ud/');
      expect(link?.getAttribute('target')).toBe('_blank');
    });
  });

  it('caps concurrently mounted instagram embeds (windowing) so embed-heavy pages stay light', async () => {
    // Articles that are lists of Instagram posts can have dozens of embeds. Mounting all of
    // them as live cross-origin iframes hangs the page on slow networks. The effect keeps at
    // most CAP (5) embeds live and recycles the rest back to lightweight facades.
    const posts = [
      'CScU4bJI2Ud', 'CRTm_GpnjVR', 'CDTQ_swnx_-', 'CC_PGNTsCq4',
      'CNiIv2zl6oA', 'CVRxzQvIAv9', 'CZjbUNKrHl2', 'Bx_fqWBi9TW',
    ];
    const html = posts
      .map((id) => `<p><a href="https://www.instagram.com/p/${id}/">https://www.instagram.com/p/${id}/</a></p>`)
      .join('');

    const { container } = render(
      <StableContent html={html} contentWidth={700} />
    );

    await waitFor(() => {
      const wrappers = container.querySelectorAll('.travel-rich-text .instagram-wrapper');
      const facades = container.querySelectorAll('.travel-rich-text .ig-lite');
      // at least one mounted (hydration works) but never more than CAP live at once
      expect(wrappers.length).toBeGreaterThanOrEqual(1);
      expect(wrappers.length).toBeLessThanOrEqual(5);
      // the overflow posts stayed/returned to lightweight facades (recycling happened)
      expect(facades.length).toBeGreaterThanOrEqual(1);
      // every post is accounted for as either a live embed or a facade
      expect(wrappers.length + facades.length).toBe(posts.length);
    });
  });

  it('renders instagram stories as visible fallback cards instead of blank embeds', async () => {
    const html = '<p>https://www.instagram.com/stories/metravelby/1234567890123456789/</p>';

    const { container } = render(
      <StableContent html={html} contentWidth={700} />
    );

    await waitFor(() => {
      const card = container.querySelector('.travel-rich-text .rich-social-card--instagram') as HTMLDivElement | null;
      const link = container.querySelector('.travel-rich-text .rich-social-card__title') as HTMLAnchorElement | null;
      expect(card).toBeTruthy();
      expect(container.querySelector('.travel-rich-text iframe[src*="instagram.com"]')).toBeNull();
      expect(link?.getAttribute('href')).toBe('https://www.instagram.com/stories/metravelby/1234567890123456789/');
      expect(link?.textContent).toContain('История');
    });
  });

  it('opens inline image in a lightbox on click and closes it', async () => {
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
      expect(richText?.innerHTML).toContain('--travel-rich-image-aspect:800/600');
    });

    const styleEl = document.getElementById('travel-rich-text-styles') as HTMLStyleElement | null;
    expect(styleEl).toBeTruthy();
    const css = String(styleEl?.textContent || '');
    expect(css).toContain('.travel-rich-text .rich-image-frame::before');
    expect(css).toContain('aspect-ratio: var(--travel-rich-image-aspect, 16 / 9);');
    expect(css).toContain('object-fit: contain;');
    expect(css).not.toContain('object-fit: cover;');
  });

  it('adds spacing between consecutive inline images rendered inside one paragraph', async () => {
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
