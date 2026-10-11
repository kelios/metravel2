import type React from 'react';

let createElement: typeof import('react').createElement;
let renderToStaticMarkup: typeof import('react-dom/server').renderToStaticMarkup;
let StyleSheet: { getSheet: () => { textContent: string } };
let PopularTravelList: typeof import('@/components/travel/PopularTravelList').default;
let PopularTravelListSkeleton: typeof import('@/components/travel/NearTravelListSkeleton').PopularTravelListSkeleton;
let colors: ReturnType<typeof import('@/constants/designSystem').getThemedColors>;
let viewportWidth = 1280;
const refetch = jest.fn();
let mockQuery: { data: Record<string, unknown>; isLoading: boolean; isError: boolean; refetch: typeof refetch };

beforeAll(() => {
  jest.resetModules();
  jest.doMock('react-native', () => {
    const rnw = jest.requireActual('react-native-web');
    return new Proxy(rnw, { get: (target, key) => key === 'useWindowDimensions'
      ? () => ({ width: viewportWidth, height: 900, scale: 1, fontScale: 1 }) : target[key] });
  });
  jest.doMock('react-native-reanimated', () => ({
    __esModule: true,
    default: { View: require('react-native').View },
    useSharedValue: (value: number) => ({ value }),
    useAnimatedStyle: (factory: () => object) => factory(),
    withSpring: (value: number) => value,
  }));
  jest.doMock('@tanstack/react-query', () => ({ ...jest.requireActual('@tanstack/react-query'), useQuery: () => mockQuery }));
  jest.doMock('expo-router', () => ({ router: { push: jest.fn() }, usePathname: () => '/travels/current' }));
  jest.doMock('@/hooks/useTheme', () => ({ useThemedColors: () => colors, useTheme: () => ({ isDark: false }) }));
  jest.doMock('@/hooks/useResponsive', () => ({
    useResponsiveWidth: () => viewportWidth,
    useResponsive: () => ({ width: viewportWidth, isMobile: viewportWidth < 768, isPhone: viewportWidth < 768 }),
    useBreakpoints: () => ({ width: viewportWidth, isPhone: viewportWidth < 768 }),
  }));
  jest.doMock('@expo/vector-icons/Feather', () => {
    const react = require('react'), rn = require('react-native');
    return { __esModule: true, default: ({ size }: { size: number }) => react.createElement(rn.View, { style: { width: size, height: size } }) };
  });
  jest.doMock('@/components/travel/FavoriteButton', () => ({ __esModule: true, default: () => null }));
  jest.doMock('@/components/travel/TravelStatusButton', () => ({ __esModule: true, default: () => null }));
  jest.doMock('@/components/safety/ContentSafetyActions', () => ({ __esModule: true, default: () => null }));
  jest.doMock('@/components/safety/HiddenContentGate', () => ({ __esModule: true, default: ({ children }: { children: React.ReactNode }) => children }));
  ;({ createElement } = require('react'));
  ;({ renderToStaticMarkup } = require('react-dom/server.node'));
  ;({ StyleSheet } = require('react-native'));
  colors = require('@/constants/designSystem').getThemedColors(false);
  PopularTravelList = require('@/components/travel/PopularTravelList').default;
  ;({ PopularTravelListSkeleton } = require('@/components/travel/NearTravelListSkeleton'));
});

const items = (count: number) => Object.fromEntries(Array.from({ length: count }, (_, i) => [String(i), {
  id: i + 1, slug: `popular-${i + 1}`, name: `Маршрут ${i + 1}`, countryName: 'Польша', countUnicIpView: '100',
}]));
const host = (element: React.ReactElement) => {
  const node = document.createElement('div');
  node.innerHTML = renderToStaticMarkup(element);
  return node;
};
const css = (node: Element) => {
  const sheet = StyleSheet.getSheet().textContent;
  const rules = [...node.classList].flatMap((name) => {
    const match = sheet.match(new RegExp(`\\.${name}\\{([^}]*)\\}`));
    return match ? [{ order: match.index ?? 0, text: match[1] }] : [];
  }).sort((a, b) => a.order - b.order);
  const resolved = document.createElement('div').style;
  resolved.cssText = [...rules.map(({ text }) => text), node.getAttribute('style') ?? '']
    .map(text => text.trim().replace(/;+$/, '')).filter(Boolean).join(';');
  return Object.fromEntries(Array.from(resolved).sort().map((property) => [
    property, resolved.getPropertyValue(property),
  ]));
};
const geometry = (node: HTMLElement) => {
  const rail = node.querySelector('[data-testid="popular-travel-rail"]')!;
  const slot = rail.querySelector('[data-testid="popular-travel-rail-slot"]')!;
  return { column: css(rail.parentElement!), content: css(slot.parentElement!), slot: css(slot) };
};

it('compares resolved CSS values independently of declaration order without hiding different gaps', () => {
  const a = document.createElement('div');
  const b = document.createElement('div');
  a.style.cssText = 'gap:12px;width:100px;height:20px;overflow:hidden';
  b.style.cssText = 'overflow:hidden;height:20px;width:100px;gap:12px';
  expect(css(a)).toEqual({ gap: '12px', height: '20px', overflow: 'hidden', width: '100px' });
  expect(css(a)).toEqual(css(b));
  b.style.gap = '16px';
  expect(css(a)).not.toEqual(css(b));
});

describe.each([390, 1280])('Popular sidebar one-row contract at %s', (width) => {
  beforeEach(() => { viewportWidth = width; mockQuery = { data: {}, isLoading: true, isError: false, refetch }; });

  it('has the same responsive row/slot geometry before lazy mount, while loading and for one/eight cards', () => {
    const deferred = host(createElement(PopularTravelListSkeleton));
    const loading = host(createElement(PopularTravelList, { embedded: true, showHeader: false }));
    expect(geometry(loading)).toEqual(geometry(deferred));
    for (const count of [1, 8]) {
      mockQuery = { data: items(count), isLoading: false, isError: false, refetch };
      const loaded = host(createElement(PopularTravelList, { embedded: true, showHeader: false }));
      expect(geometry(loaded)).toEqual(geometry(deferred));
      expect(loaded.querySelectorAll('[data-testid="popular-travel-rail-slot"]')).toHaveLength(count);
      expect(loaded.querySelectorAll('[data-testid="popular-travel-rail-slot"][role="listitem"]')).toHaveLength(count);
      expect([...loaded.querySelectorAll('a[href]')].map((link) => link.getAttribute('href'))).toEqual(
        Array.from({ length: count }, (_, i) => `/travels/popular-${i + 1}`));
      expect(loaded.querySelector('[data-testid="travel-list-item-skeleton"]')).toBeNull();
    }
  });

  it('keeps real empty/error semantics and no fabricated route cards', () => {
    mockQuery = { data: {}, isLoading: false, isError: false, refetch };
    expect(host(createElement(PopularTravelList, { embedded: true, showHeader: false })).innerHTML).toBe('');
    mockQuery.isError = true;
    const failed = host(createElement(PopularTravelList, { embedded: true, showHeader: false }));
    expect(failed.querySelector('[data-testid="popular-travel-rail-slot"]')).toBeNull();
    expect(failed.querySelector('[data-testid="travel-list-item-skeleton"]')).toBeNull();
    expect(failed.querySelector('[role="button"]')?.getAttribute('aria-label')).toBe('Повторить загрузку популярных маршрутов');
  });
});
