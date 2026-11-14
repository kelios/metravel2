/** @jest-environment node */

/**
 * #3410: ключи данных loader — внутренние идентификаторы маршрута
 * (`/(tabs)/travels/<slug>`), а не адреса. Googlebot вынимал их из инлайн-скрипта
 * как ссылки и получал 404 (прод-лог 11–14.11.2026: 46 обращений к `/(tabs)/…`).
 * Патч `patches/@expo+router-server+58.0.19.patch` отдаёт слэши ключа
 * JSON-эскейпами: в тексте документа пути нет, `JSON.parse` возвращает ключ целым.
 */

import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'

const { createLoaderDataScriptAsString, getLoaderDataScriptContents } = require('@expo/router-server/build/utils/html') as {
  createLoaderDataScriptAsString: (data: unknown) => string
  getLoaderDataScriptContents: (data: unknown) => string
}

const hydrate = (script: string): unknown => {
  const context = vm.createContext({})
  vm.runInContext(script, context)
  return (context as { __EXPO_ROUTER_LOADER_DATA__?: unknown }).__EXPO_ROUTER_LOADER_DATA__
}

const ROUTE_KEY = '/(tabs)/travels/staryy-i-novyy-zamki-v-grodno'

describe('router-server loader data keys (#3410)', () => {
  it('keeps the route key out of the document as path-like text', () => {
    const script = getLoaderDataScriptContents({ [ROUTE_KEY]: { travel: { id: 340 } } })

    expect(script).not.toContain(ROUTE_KEY)
    expect(script).not.toContain('(tabs)/')
    expect(script).not.toContain('/travels/staryy')
    expect(createLoaderDataScriptAsString({ [ROUTE_KEY]: {} })).not.toContain('(tabs)/')
  })

  it('hands hydration the same keys and values', () => {
    const data = {
      [ROUTE_KEY]: {
        travel: { id: 340, description: '<p>a/b</p><img src="https://metravel.by/travel-description-image/x.webp">' },
      },
      '/(tabs)/quests/21/wroclaw-kids-gnome-service': { quest: null, steps: [1, 2] },
      '/': { featured: [] },
    }

    expect(hydrate(getLoaderDataScriptContents(data))).toEqual(data)
  })

  it('leaves value content as the stock serializer writes it', () => {
    const value = { url: 'https://metravel.by/travels/slug', html: '</script><!-- &  ' }
    const script = getLoaderDataScriptContents({ [ROUTE_KEY]: value })

    expect(script).not.toContain('</script>')
    expect(hydrate(script)).toEqual({ [ROUTE_KEY]: value })
    // Адреса внутри значений — содержимое страницы, их патч не трогает.
    expect(script).toContain('https://metravel.by/travels/slug')
  })

  it('drops undefined values and passes non-object data like JSON.stringify', () => {
    const data = { [ROUTE_KEY]: undefined, '/kept': { ok: true }, '/fn': () => 1 }

    expect(hydrate(getLoaderDataScriptContents(data))).toEqual({ '/kept': { ok: true } })
    for (const plain of [null, [1, '/a/b'], 'text', 42]) {
      expect(hydrate(getLoaderDataScriptContents(plain))).toEqual(plain)
    }
  })

  it('is carried by the committed patch, not only by this checkout', () => {
    const patch = fs.readFileSync(path.join(__dirname, '../../patches/@expo+router-server+58.0.19.patch'), 'utf8')

    expect(patch).toContain('build/utils/html.js')
    expect(patch).toContain('function stringifyLoaderData(data)')
  })
})
