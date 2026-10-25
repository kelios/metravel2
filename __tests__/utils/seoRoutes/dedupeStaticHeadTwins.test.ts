/**
 * @jest-environment jsdom
 */
import { claimStaticHeadTwins, dedupeStaticHeadTwins } from '@/utils/seo';

describe('dedupeStaticHeadTwins (#2740)', () => {
  beforeEach(() => {
    document.head.innerHTML = '';
  });

  it('removes static twins of helmet-owned description, og, twitter and canonical', () => {
    document.head.insertAdjacentHTML('beforeend', [
      '<meta name="description" content="static">',
      '<meta property="og:title" content="static">',
      '<meta property="og:locale" content="ru_RU">',
      '<meta name="twitter:site" content="@metravel_by">',
      '<link rel="canonical" href="https://metravel.by/static">',
      '<meta name="robots" content="noindex, follow">',
      '<meta data-rh="true" name="description" content="live">',
      '<meta data-rh="true" property="og:title" content="live">',
      '<meta data-rh="true" property="og:locale" content="ru_RU">',
      '<link data-rh="true" rel="canonical" href="https://metravel.by/live">',
      '<meta data-rh="true" name="robots" content="noindex, follow">',
    ].join(''));

    expect(dedupeStaticHeadTwins()).toBe(4);
    expect(document.head.querySelectorAll('meta[name="description"]')).toHaveLength(1);
    expect(document.head.querySelector('meta[name="description"]')?.getAttribute('content')).toBe('live');
    expect(document.head.querySelectorAll('meta[property="og:title"]')).toHaveLength(1);
    expect(document.head.querySelectorAll('meta[property="og:locale"]')).toHaveLength(1);
    expect(document.head.querySelectorAll('link[rel="canonical"]')).toHaveLength(1);
    expect(document.head.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe('https://metravel.by/live');
    // Static-only tags stay; build-owned robots survives hydration (#1929).
    expect(document.head.querySelectorAll('meta[name="twitter:site"]')).toHaveLength(1);
    expect(document.head.querySelectorAll('meta[name="robots"]')).toHaveLength(2);
  });

  it('is a no-op without helmet-owned tags', () => {
    document.head.insertAdjacentHTML('beforeend', '<meta name="description" content="static"><link rel="canonical" href="/x">');
    expect(dedupeStaticHeadTwins()).toBe(0);
    expect(document.head.querySelectorAll('meta, link')).toHaveLength(2);
  });
});

describe('claimStaticHeadTwins (#2740)', () => {
  beforeEach(() => {
    document.head.innerHTML = '';
    document.head.removeAttribute('data-static-head-deduped');
  });

  it('grants the sweep once per document, even before helmet has committed', () => {
    document.head.insertAdjacentHTML('beforeend', '<meta name="description" content="static">');
    expect(claimStaticHeadTwins()?.size).toBe(1);
    expect(claimStaticHeadTwins()).toBeNull();
    expect(document.head.getAttribute('data-static-head-deduped')).toBe('true');
  });

  it('limits the sweep to the exported nodes and leaves later non-data-rh copies (#1613)', () => {
    document.head.insertAdjacentHTML('beforeend', '<meta name="description" content="export"><meta name="robots" content="noindex">');
    const staticNodes = claimStaticHeadTwins();
    document.head.insertAdjacentHTML(
      'beforeend',
      '<meta data-owner="spa-copy" name="description" content="spa"><meta data-rh="true" name="description" content="live">',
    );

    expect(dedupeStaticHeadTwins(staticNodes ?? undefined)).toBe(1);
    expect(Array.from(document.head.querySelectorAll('meta[name="description"]')).map((node) => node.getAttribute('content')))
      .toEqual(['spa', 'live']);
  });
});
