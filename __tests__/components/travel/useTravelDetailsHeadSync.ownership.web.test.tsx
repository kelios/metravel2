/**
 * @jest-environment jsdom
 */

import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { Platform } from 'react-native'

import { useTravelDetailsHeadSync } from '@/components/travel/details/hooks/useTravelDetailsHeadSync'

jest.mock('@/i18n/useLocaleRevision', () => ({ useLocaleRevision: () => 0 }))

const ARTICLE = { readyTitle: 'Статья', readyDesc: 'Описание статьи', readyImage: '', canonicalUrl: 'https://metravel.by/travels/a' }

function Probe({ isFocused }: { isFocused: boolean }) {
  useTravelDetailsHeadSync({
    ...ARTICLE,
    isFocused,
    routePaths: ['/travels/a', '/travels/42'],
    syncNavigationTitle: () => {},
  })
  return null
}

const head = () => ({
  title: document.title,
  canonical: document.head.querySelector('link[rel="canonical"]')?.getAttribute('href') ?? null,
  description: document.head.querySelector('meta[name="description"]')?.getAttribute('content') ?? null,
})

// Другой владелец (менеджер head экрана /search) пишет свои теги.
const writeSearchHead = () => {
  document.title = 'Поиск'
  document.head.querySelector('link[rel="canonical"]')!.setAttribute('href', 'https://metravel.by/search')
  document.head.querySelector('meta[name="description"]')!.setAttribute('content', 'Поиск маршрутов')
  // childList-мутация, на которую подписан наблюдатель статьи.
  document.head.appendChild(document.createElement('meta'))
}

const flushObservers = () => act(async () => { await Promise.resolve(); await Promise.resolve() })

// #2916: фокус экрана снимается следующим коммитом после popstate, поэтому
// право писать head определяется адресом документа, а не только `isFocused`.
describe('useTravelDetailsHeadSync ownership (web)', () => {
  const originalPlatform = Platform.OS
  let root: Root | null = null

  beforeAll(() => { Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' }) })
  afterAll(() => { Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatform }) })
  beforeEach(() => { document.head.innerHTML = ''; window.history.replaceState(null, '', '/travels/a') })
  afterEach(async () => { await act(async () => { root?.unmount() }); root = null })

  it('patches the head on its own address and leaves another page head alone after popstate', async () => {
    const container = document.createElement('div')
    await act(async () => { root = createRoot(container); root.render(<Probe isFocused />) })
    expect(head()).toEqual({ title: 'Статья', canonical: 'https://metravel.by/travels/a', description: 'Описание статьи' })

    // Back на /search: адрес уже сменился, фокус статьи ещё не снят.
    window.history.replaceState(null, '', '/search')
    writeSearchHead()
    await flushObservers()
    expect(head()).toEqual({ title: 'Поиск', canonical: 'https://metravel.by/search', description: 'Поиск маршрутов' })

    // Снятие фокуса приходит следующим коммитом и ничего не возвращает.
    await act(async () => { root!.render(<Probe isFocused={false} />) })
    await flushObservers()
    expect(head().title).toBe('Поиск')
  })

  it('keeps patching while the document is on the numeric fallback address', async () => {
    window.history.replaceState(null, '', '/travels/42')
    const container = document.createElement('div')
    await act(async () => { root = createRoot(container); root.render(<Probe isFocused />) })
    expect(head().title).toBe('Статья')
    document.title = 'Чужой'
    document.head.appendChild(document.createElement('meta'))
    await flushObservers()
    expect(head().title).toBe('Статья')
  })
})
