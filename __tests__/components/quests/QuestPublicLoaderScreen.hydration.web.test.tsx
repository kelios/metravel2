import type React from 'react';
import { questPrivateSnapshot } from '../../fixtures/questPublicProjection';

let createElement: typeof import('react').createElement;
let act: typeof import('react').act;
let renderToString: typeof import('react-dom/server').renderToString;
let hydrateRoot: typeof import('react-dom/client').hydrateRoot;
let createRoot: typeof import('react-dom/client').createRoot;
let Screen: React.ComponentType<{ children: (projection: { locale: string; release_id: string } | null) => React.ReactNode }>;
let payload: Record<string, unknown>;
let pages: Array<Record<string, unknown>>;

beforeAll(() => {
  jest.resetModules();
  jest.doMock('react-native', () => jest.requireActual('react-native-web'));
  jest.doMock('expo-router', () => ({ useIsFocused: () => true, useLoaderData: () => payload,
    Link: ({ href, children }: { href: string; children: React.ReactNode }) => require('react').createElement('a', { href }, children) }));
  jest.doMock('@/components/seo/LazyInstantSEO', () => () => null);
  jest.doMock('@/components/quests/QuestVersionLinks', () => () => null);
  jest.doMock('@/components/ui/ImageCardMedia', () => ({ src, alt }: { src: string; alt: string }) => require('react').createElement('img', { src, alt }));
  ;({ createElement, act } = require('react'));
  ;({ renderToString } = require('react-dom/server.node'));
  ;({ hydrateRoot, createRoot } = require('react-dom/client'));
  Screen = require('@/components/quests/runtime/QuestPublicLoaderScreen.web').default;
  const { buildQuestWebProjection } = require('@/scripts/lib/questWebProjection');
  const { loadSsgCatalogs } = require('@/i18n/babel-inline-plugin');
  pages = buildQuestWebProjection(questPrivateSnapshot(), loadSsgCatalogs(require('node:path').resolve(__dirname, '../../..')).catalogs).pages;
});

const appScreen = (projection: { locale: string; release_id: string } | null) =>
  createElement('p', { 'data-testid': 'legacy' }, projection ? `Legacy ${projection.locale} ${projection.release_id}` : 'Legacy');

function detailPayload() {
  const page = pages.find((entry) => entry.kind === 'detail' && entry.locale === 'pl')!;
  payload = { ...page, schema_version: 2, state: 'available', publication_id: 'b'.repeat(64), corpus_revision: 'c'.repeat(64),
    ru_source_path: '/quests/7/fixture-city-walk', versions: [] };
  return page;
}

it.each([390, 768, 1440])('serves the public body as server HTML and hands off to the app screen after hydration at %spx', async (width) => {
  const page = detailPayload();
  const original = window.innerWidth;
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1440 });
  const tree = createElement(Screen, null, appScreen);
  const container = document.createElement('div');
  container.innerHTML = renderToString(tree);
  document.body.appendChild(container);
  const publicBody = container.querySelector('main[data-quest-public-page]');
  expect(container.querySelectorAll('h1')).toHaveLength(1);
  expect(publicBody?.getAttribute('lang')).toBe('pl');
  expect(publicBody?.textContent).toContain((page.page as { lead: string }).lead);
  expect(container.querySelector('[data-testid="legacy"]')).toBeNull();
  const errors: unknown[] = [];
  let root: ReturnType<typeof hydrateRoot> | undefined;
  try {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
    await act(async () => { root = hydrateRoot(container, tree, { onRecoverableError: (error) => errors.push(error) }); });
    expect(errors).toEqual([]);
    // Visitors get the regular app screen, not the crawler document.
    expect(container.querySelector('main[data-quest-public-page]')).toBeNull();
    // The detail screen gets the loader projection as its publication proof.
    expect(container.querySelector('[data-testid="legacy"]')?.textContent).toBe(`Legacy pl ${'b'.repeat(64)}`);
  } finally {
    await act(async () => root?.unmount());
    container.remove();
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: original });
  }
});

it('mounts the app screen directly on a client-side navigation, without a document frame', async () => {
  detailPayload();
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  // Records keep every inserted node, including one replaced in a later commit.
  const records: MutationRecord[] = [];
  const observer = new MutationObserver((batch) => records.push(...batch));
  observer.observe(container, { childList: true, subtree: true });
  try {
    await act(async () => { root.render(createElement(Screen, null, appScreen)); });
    records.push(...observer.takeRecords());
    const inserted = records.flatMap((record) => [...record.addedNodes]).filter((node): node is Element => node instanceof Element);
    expect(inserted.length).toBeGreaterThan(0);
    expect(inserted.some((node) => node.matches('main[data-quest-public-page], img') || node.querySelector('main[data-quest-public-page], img'))).toBe(false);
    expect(container.querySelector('main[data-quest-public-page]')).toBeNull();
    expect(container.querySelector('img')).toBeNull();
    // The detail screen gets the loader projection as its publication proof.
    expect(container.querySelector('[data-testid="legacy"]')?.textContent).toBe(`Legacy pl ${'b'.repeat(64)}`);
  } finally {
    observer.disconnect();
    await act(async () => root.unmount());
    container.remove();
  }
});
