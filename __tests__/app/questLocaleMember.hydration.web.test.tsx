/**
 * @jest-environment jsdom
 */

import type React from 'react'

/**
 * #2449: переводная страница квеста `/{locale}/quests/…` собирается из
 * RU-экспорта деталки, и её `#root` — русский серверный рендер другого
 * маршрута, а браузер рисует web-адаптер `app/[...missing].web.tsx` на языке
 * URL. Гидратация такой разметки всегда кончалась React #418. Здесь — настоящий
 * серверный рендер react-native-web, настоящий сборщик страницы
 * (`buildQuestDetailPageHtml`) и то же правило монтирования, что у Expo
 * (`expo/src/launch/AppRegistry.web.tsx`: флаг `__EXPO_ROUTER_HYDRATE__` →
 * `hydrateRoot`, иначе `createRoot`), по образцу #2178.
 */

let createElement: typeof import('react').createElement
let act: typeof import('react').act
let hydrateRoot: typeof import('react-dom/client').hydrateRoot
let createRoot: typeof import('react-dom/client').createRoot
let renderToString: typeof import('react-dom/server').renderToString
let i18n: { changeLanguage: (locale: string) => Promise<unknown> }
let translate: (key: string) => string
let SkipLinks: React.ComponentType
let buildQuestDetailPageHtml: (input: Record<string, unknown>) => string
let ssgTranslator: (locale: string) => unknown
let questRouteKey: (quest: unknown) => { path: string; cityId: string; questId: string }

const SKIP_KEY = 'navigationStatic:components.layout.SkipLinks.pereyti_k_osnovnomu_soderzhimomu_6663999c'
const QUEST = {
  quest_id: 'minsk-cmok', city_id: '4', city_name: 'Минск', title: 'Квест по Минску',
  points: 1, duration_min: 45, cover_url: 'https://metravel.by/quest-cover/quests/4/main/cover.webp',
}
const story = Array.from({ length: 60 }, (_, i) => `zdanie ${i} opowiada o mieście.`).join(' ')
const bundle = (locale: string) => ({
  quest_id: QUEST.quest_id, title: locale === 'ru' ? QUEST.title : `Quest po Mińsku`,
  content_locale: locale, available_locales: ['ru', 'pl'], city: { name: locale === 'ru' ? 'Минск' : 'Mińsk' },
  intro: { step_id: 'intro', title: 'Intro', story },
  steps: [{ step_id: 's1', title: 'Ratusz', location: 'Plac', story, task: 'znajdź', hint: 'spójrz', answer_pattern: { type: 'exact', value: 'x' } }],
})

beforeAll(() => {
  jest.resetModules()
  jest.doMock('react-native', () => jest.requireActual('react-native-web'))
  ;({ createElement, act } = require('react'))
  ;({ hydrateRoot, createRoot } = require('react-dom/client'))
  // `.node`: браузерная сборка серверного рендера требует MessageChannel, которого нет в jsdom.
  ;({ renderToString } = require('react-dom/server.node'))
  i18n = require('@/i18n/instance').default
  ;({ translate } = require('@/i18n'))
  SkipLinks = require('@/components/layout/SkipLinks').default
  ;({ buildQuestDetailPageHtml } = require('@/scripts/generate-seo-pages'))
  const { createSsgTranslator } = require('@/scripts/lib/questLocalePackage')
  const { catalogs } = require('@/i18n/babel-inline-plugin').loadSsgCatalogs(require('path').resolve(__dirname, '..', '..'))
  ssgTranslator = (locale) => createSsgTranslator(catalogs, locale)
  ;({ questRouteKey } = require('@/utils/questCityAlias'))
}, 120_000)

afterAll(async () => {
  await i18n.changeLanguage('ru')
})

const isHydrationMessage = (args: unknown[]) =>
  /hydrat|did not match|server rendered|#418|#419|#423|#425/i.test(args.map(String).join(' '))

/** The Expo export of the RU detail: hydration flag plus the RU render of the app shell. */
async function ruExportHtml() {
  await i18n.changeLanguage('ru')
  const shell = renderToString(createElement(SkipLinks))
  return [
    '<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8"/><title>Квест | Metravel</title>',
    '<meta property="og:locale" content="ru_RU"/><script>globalThis.__EXPO_ROUTER_HYDRATE__=true;</script>',
    `</head><body><div id="root">${shell}</div></body></html>`,
  ].join('')
}

function buildPage(baseHtml: string, locale: string) {
  return buildQuestDetailPageHtml({
    baseHtml, quest: QUEST, bundle: bundle(locale), route: questRouteKey(QUEST), ssg: ssgTranslator(locale),
  })
}

/** Mount a stored document the way the Expo web entry does and collect hydration errors. */
async function mountDocument(html: string, clientLocale: string) {
  const parsed = new DOMParser().parseFromString(html, 'text/html')
  const flagHost = globalThis as { __EXPO_ROUTER_HYDRATE__?: boolean }
  delete flagHost.__EXPO_ROUTER_HYDRATE__
  for (const script of parsed.querySelectorAll('script:not([type]):not([src])')) {
    if (script.textContent?.includes('__EXPO_ROUTER_HYDRATE__')) new Function(script.textContent)()
  }
  const hydrate = flagHost.__EXPO_ROUTER_HYDRATE__ === true
  const container = document.createElement('div')
  container.innerHTML = parsed.getElementById('root')?.innerHTML ?? ''
  document.body.appendChild(container)
  await i18n.changeLanguage(clientLocale)
  const recoverableErrors: string[] = []
  const consoleErrors = jest.spyOn(console, 'error')
  let root: ReturnType<typeof createRoot> | null = null
  try {
    await act(async () => {
      const element = createElement(SkipLinks)
      if (hydrate) {
        root = hydrateRoot(container, element, {
          onRecoverableError: (error) => recoverableErrors.push(String((error as Error)?.message ?? error)),
        })
      } else {
        root = createRoot(container)
        root.render(element)
      }
      await Promise.resolve()
    })
    const hydrationConsoleErrors = consoleErrors.mock.calls.filter(isHydrationMessage).map((args) => String(args[0]))
    return { hydrate, recoverableErrors, hydrationConsoleErrors, text: container.textContent ?? '' }
  } finally {
    consoleErrors.mockRestore()
    await act(async () => {
      root?.unmount()
    })
    container.remove()
    delete flagHost.__EXPO_ROUTER_HYDRATE__
  }
}

describe('переводная страница квеста монтируется без React #418 (#2449)', () => {
  it('RU-страница по-прежнему гидратирует свой серверный рендер без расхождений', async () => {
    const result = await mountDocument(buildPage(await ruExportHtml(), 'ru'), 'ru')
    expect(result).toMatchObject({ hydrate: true, recoverableErrors: [], hydrationConsoleErrors: [] })
  })

  it.each(['be', 'uk', 'pl', 'en'])('%s: первый кадр сразу на языке URL, без гидратации чужой разметки', async (locale) => {
    const html = buildPage(await ruExportHtml(), locale)
    await i18n.changeLanguage('ru')
    const ruLabel = translate(SKIP_KEY)
    expect(html).not.toContain(ruLabel)

    const result = await mountDocument(html, locale)
    expect(result).toMatchObject({ hydrate: false, recoverableErrors: [], hydrationConsoleErrors: [] })
    expect(result.text).toContain(translate(SKIP_KEY))
    expect(result.text).not.toContain(ruLabel)
  }, 30_000)

  it('контроль: документ до исправления (русский #root и флаг гидратации) даёт расхождение', async () => {
    const legacy = (await ruExportHtml()).replace('<html lang="ru">', '<html lang="pl">')
    const result = await mountDocument(legacy, 'pl')
    expect(result.hydrate).toBe(true)
    expect([...result.recoverableErrors, ...result.hydrationConsoleErrors].join(' ')).toMatch(/hydrat|did not match|server rendered|#418/i)
  })
})
