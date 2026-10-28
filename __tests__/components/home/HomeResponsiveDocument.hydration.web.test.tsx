import type React from 'react';

let createElement: typeof import('react').createElement;
let act: typeof import('react').act;
let renderToString: typeof import('react-dom/server').renderToString;
let hydrateRoot: typeof import('react-dom/client').hydrateRoot;
let Hero: React.ComponentType;
let Promo: React.ComponentType;
let Directory: React.ComponentType;
let Provider: React.Provider<unknown>;
let sliderBookEnabled = false;
let viewport = { width: 1440, height: 900, isDesktop: true, isPortrait: false };

beforeAll(() => {
  jest.resetModules();
  jest.doMock('react-native', () => jest.requireActual('react-native-web'));
  jest.doMock('expo-router', () => ({ useRouter: () => ({ push: () => {} }),
    Link: ({ href, asChild, children, ...props }: { href: string; asChild?: boolean; children: React.ReactNode }) => {
      const React = require('react');
      return asChild ? React.cloneElement(React.Children.only(children), { ...props, href })
        : React.createElement(require('react-native').Text, { ...props, href }, children);
    } }));
  jest.doMock('@expo/vector-icons/Feather', () => () => null);
  jest.doMock('@/hooks/useTheme', () => ({ useThemedColors: () => require('@/constants/designSystem').getThemedColors(false) }));
  jest.doMock('@/components/home/useHomeViewport', () => ({ useHomeViewport: () => viewport }));
  jest.doMock('@/components/home/useHomeHeroSlider', () => ({
    shouldDisableHomeHeroSliderBlur: () => false,
    useHomeHeroSlider: ({ slides, showSideSlider }: { slides: unknown[]; showSideSlider: boolean }) => {
      sliderBookEnabled = showSideSlider;
      return { currentSlide: slides[0], visibleSlide: 0,
      renderedSlideIndices: [0], loadedSlides: new Set(), markSlideAsLoaded: () => {},
      handleNextSlide: () => {}, handlePrevSlide: () => {}, topWaveAnimatedStyle: {}, bottomWaveAnimatedStyle: {} };
    },
  }));
  jest.doMock('@/utils/analytics', () => ({ queueAnalyticsEvent: () => {}, sendAnalyticsEvent: () => {} }));
  jest.doMock('@/utils/externalLinks', () => ({ openExternalUrl: () => {}, openExternalUrlInNewTab: () => {} }));
  jest.doMock('@/hooks/useTrackedImpression', () => ({ useTrackedImpression: () => ({}) }));
  jest.doMock('@/components/ui/richMediaViewport', () => ({ useRichMediaVisibility: () => ({ visible: true }) }));
  jest.doMock('@/hooks/useQuestsApi', () => ({ useQuestsPreview: () => ({ loading: false,
    quests: Array.from({ length: 8 }, (_, index) => ({ id: `quest-${index}`, cityId: '7', title: `Quest ${index}`,
      cityName: 'Fixture city', cover: { src: 'https://example.test/cover.webp' }, points: 10 })) }) }));
  jest.doMock('@/components/ui/ImageCardMedia', () => ({ source, loading, alt }: { source: unknown; loading: string; alt: string }) =>
    require('react').createElement('img', { src: typeof source === 'number' ? `/fixture-${source}.webp` : '/fixture.webp', loading, alt }));
  ;({ createElement, act } = require('react'));
  ;({ renderToString } = require('react-dom/server.node'));
  ;({ hydrateRoot } = require('react-dom/client'));
  Hero = require('@/components/home/HomeHero').default;
  Promo = require('@/components/home/HomeQuestsPromoSection').default;
  Directory = require('@/components/quests/runtime/QuestDiscoveryDirectory.web').default;
  Provider = require('@/components/quests/runtime/QuestDiscoveryContext').QuestDiscoveryContext.Provider;
});

it.each([[390, 844], [768, 1024], [1440, 900], [2048, 900], [2560, 640]])(
  'keeps the same real hero and six selected cards when the document hydrates at %sx%s', async (width, height) => {
    viewport = { width: 1440, height: 900, isDesktop: true, isPortrait: false };
    const tree = createElement(Provider, { value: { view: 'home', locale: 'ru' } },
      createElement(Hero), createElement(Promo));
    const container = document.createElement('div');
    container.innerHTML = renderToString(tree);
    document.body.appendChild(container);
    // Responsive CSS is the root render-blocking asset, never a duplicate body style.
    expect(container.querySelector('style')).toBeNull();
    const hero = container.querySelector('[data-home-responsive-hero]');
    const book = container.querySelector('[data-home-book-wrapper]');
    const title = container.querySelector('h1')?.textContent;
    const subtitle = container.querySelector('[data-home-book-subtitle]')?.textContent;
    const left = container.querySelector('[data-home-book-left]')!;
    const moods = container.querySelector('[data-home-responsive-mood-rail]')!;
    const primary = container.querySelector('[data-home-book-media]')!;
    expect(left.compareDocumentPosition(moods) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(moods.compareDocumentPosition(primary) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(hero).not.toBeNull();
    expect(container.querySelectorAll('h1')).toHaveLength(1);
    expect(container.querySelectorAll('input')).toHaveLength(1);
    expect(container.querySelectorAll('[data-home-book-cta]')).toHaveLength(1);
    expect(container.querySelectorAll('[data-home-primary-slide] img[loading="eager"]')).toHaveLength(1);
    expect(container.querySelectorAll('[data-home-popular-card] img[loading="lazy"]')).toHaveLength(4);
    expect(container.querySelector('[data-home-quest-grid]')?.children).toHaveLength(6);
    const cardHrefs = [...container.querySelectorAll('[data-home-quest-grid] a')].map((link) => link.getAttribute('href'));
    const moreLinks = [...container.querySelectorAll('[data-home-quest-more] a')];
    const expectedHrefs = Array.from({ length: 8 }, (_, index) => `/quests/7/quest-${index}`);
    // CSS shows four cards plus four compact links on mobile; six plus two on
    // desktop. The normal visible link set stays the old selected eight.
    expect([...cardHrefs.slice(0, 4), ...moreLinks.map((link) => link.getAttribute('href'))]).toEqual(expectedHrefs);
    expect([...cardHrefs, ...moreLinks.filter((link) => Number(link.getAttribute('data-home-quest-more-index')) >= 6)
      .map((link) => link.getAttribute('href'))]).toEqual(expectedHrefs);
    // #2817: the server HTML carries the section's ItemList and a real scenario link.
    const itemLists = container.querySelectorAll('script[data-seo-jsonld="home-quests-itemlist"]');
    expect(itemLists).toHaveLength(1);
    const itemList = JSON.parse(itemLists[0].textContent || '{}');
    expect(itemList.numberOfItems).toBe(8);
    expect(itemList.itemListElement.map((entry: { url: string }) => new URL(entry.url).pathname)).toEqual(expectedHrefs);
    expect(container.querySelectorAll('a[href="/quests/scenario"]')).toHaveLength(1);
    const errors: unknown[] = [];
    let root: ReturnType<typeof hydrateRoot> | undefined;
    try {
      viewport = { width, height, isDesktop: width >= 1280, isPortrait: height >= width };
      await act(async () => { root = hydrateRoot(container, tree, { onRecoverableError: (error) => errors.push(error) }); });
      expect(errors).toEqual([]);
      expect(container.querySelector('[data-home-responsive-hero]')).toBe(hero);
      expect(container.querySelector('[data-home-book-wrapper]')).toBe(book);
      expect(container.querySelector('h1')?.textContent).toBe(title);
      expect(container.querySelector('[data-home-book-subtitle]')?.textContent).toBe(subtitle);
      expect(container.querySelector('[data-home-quest-grid]')?.children).toHaveLength(6);
      expect(container.querySelectorAll('h1')).toHaveLength(1);
      expect(sliderBookEnabled).toBe(width >= 1280);
    } finally {
      await act(async () => root?.unmount());
      container.remove();
    }
  },
);

it('keeps every catalogue, city and country link in an ordinary usable HTML directory', () => {
  const data = { view: 'catalog', locale: 'ru', cities: [{ title: 'City', path: '/quests/fixture-city' }],
    countries: [{ title: 'Country', path: '/quests/country/belarus' }],
    quests: Array.from({ length: 40 }, (_, index) => ({ city_id: 7, quest_id: `quest-${index}`, title: `Quest ${index}` })) };
  const container = document.createElement('div');
  container.innerHTML = renderToString(createElement(Provider, { value: data }, createElement(Directory)));
  const details = container.querySelector('details');
  expect(details?.querySelector('summary')?.textContent).toBeTruthy();
  expect(details?.querySelectorAll('a')).toHaveLength(42);
  expect(details?.querySelector('[href="/quests/7/quest-39"]')).not.toBeNull();
  expect(details?.querySelector('[href="/quests/fixture-city"]')).not.toBeNull();
  expect(details?.querySelector('[href="/quests/country/belarus"]')).not.toBeNull();
  expect(details?.hasAttribute('inert')).toBe(false);
  expect(details?.getAttribute('aria-hidden')).toBeNull();
});
