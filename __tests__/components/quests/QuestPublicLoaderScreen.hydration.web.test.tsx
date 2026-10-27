import type React from 'react';
import { questPrivateSnapshot } from '../../fixtures/questPublicProjection';

let createElement: typeof import('react').createElement;
let act: typeof import('react').act;
let renderToString: typeof import('react-dom/server').renderToString;
let hydrateRoot: typeof import('react-dom/client').hydrateRoot;
let Screen: React.ComponentType<{ fallback: React.ReactNode }>;
let payload: Record<string, unknown>;
let pages: Array<Record<string, unknown>>;

beforeAll(() => {
  jest.resetModules();
  jest.doMock('react-native', () => jest.requireActual('react-native-web'));
  jest.doMock('expo-router', () => ({ useIsFocused: () => true, useLocalSearchParams: () => ({}), useLoaderData: () => payload,
    Link: ({ href, children }: { href: string; children: React.ReactNode }) => require('react').createElement('a', { href }, children) }));
  jest.doMock('@/hooks/useTheme', () => ({ useThemedColors: () => ({ primary: 'orange', text: 'black', border: 'gray' }) }));
  jest.doMock('@/i18n/LocaleProvider', () => ({ useTranslation: () => ({ t: () => 'Start quest' }) }));
  jest.doMock('@/components/seo/LazyInstantSEO', () => () => null);
  jest.doMock('@/components/quests/QuestVersionLinks', () => () => null);
  jest.doMock('@/components/ui/ImageCardMedia', () => ({ src, alt }: { src: string; alt: string }) => require('react').createElement('img', { src, alt }));
  jest.doMock('@/components/ui/Button', () => ({ label, onPress }: { label: string; onPress: () => void }) =>
    require('react').createElement('button', { onClick: onPress }, label));
  jest.doMock('@/app/(tabs)/quests/[city]/[questId].tsx', () => ({ __esModule: true,
    default: ({ publicProjection }: { publicProjection: { locale: string } }) => {
      const Text = require('@/components/quests/QuestContentText').default;
      return require('react').createElement(Text, { accessibilityRole: 'header', 'aria-level': 1 }, `Gameplay ${publicProjection.locale}`);
    } }));
  ;({ createElement, act } = require('react'));
  ;({ renderToString } = require('react-dom/server.node'));
  ;({ hydrateRoot } = require('react-dom/client'));
  Screen = require('@/components/quests/runtime/QuestPublicLoaderScreen.web').default;
  const { buildQuestWebProjection } = require('@/scripts/lib/questWebProjection');
  const { loadSsgCatalogs } = require('@/i18n/babel-inline-plugin');
  pages = buildQuestWebProjection(questPrivateSnapshot(), loadSsgCatalogs(require('node:path').resolve(__dirname, '../../..')).catalogs).pages;
});

it.each([390, 768, 1440])('hydrates the public body at %spx and keeps its single heading when gameplay opens', async (width) => {
  const page = pages.find((entry) => entry.kind === 'detail' && entry.locale === 'pl')!;
  payload = { ...page, schema_version: 2, state: 'available', publication_id: 'b'.repeat(64), corpus_revision: 'c'.repeat(64),
    ru_source_path: '/quests/7/fixture-city-walk', versions: [] };
  const original = window.innerWidth;
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1440 });
  const tree = createElement(Screen, { fallback: createElement('p', null, 'Legacy') });
  const container = document.createElement('div');
  container.innerHTML = renderToString(tree);
  document.body.appendChild(container);
  const publicBody = container.querySelector('main[data-quest-public-page]');
  const text = publicBody?.textContent;
  expect(container.querySelectorAll('h1')).toHaveLength(1);
  expect(publicBody?.getAttribute('lang')).toBe('pl');
  const errors: unknown[] = [];
  let root: ReturnType<typeof hydrateRoot> | undefined;
  try {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
    await act(async () => { root = hydrateRoot(container, tree, { onRecoverableError: (error) => errors.push(error) }); });
    expect(errors).toEqual([]);
    expect(container.querySelector('main')).toBe(publicBody);
    expect(publicBody?.textContent).toBe(text);
    await act(async () => { container.querySelector('button')!.click(); });
    expect(container.querySelectorAll('h1')).toHaveLength(1);
    expect(container.querySelector('h2')?.textContent).toBe('Gameplay pl');
    expect(container.querySelector('main')).toBe(publicBody);
    expect(publicBody?.textContent).toContain('Gameplay pl');
    expect(publicBody?.textContent).toContain((page.page as { lead: string }).lead);
  } finally {
    await act(async () => root?.unmount());
    container.remove();
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: original });
  }
});
