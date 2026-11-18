/** @jest-environment node */

/**
 * #3410: ключи данных loader — внутренние идентификаторы маршрута
 * (`/(tabs)/travels/<slug>`), а не адреса. Googlebot вынимал их из инлайн-скрипта
 * как ссылки и получал 404 (прод-лог 11–14.11.2026: 46 обращений к `/(tabs)/…`).
 * Эскейп слэша через unicode приёмка 18.11.2026 не приняла: раскодирование JSON
 * снова собирает путь. Патч `patches/@expo+router-server+58.0.19.patch` кладёт
 * слэш ключа как U+001F. Это не эскейп слэша. Тот же скрипт возвращает ключ до гидрации.
 */

import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'

/** Статический разбор, которым краулер достаёт путь из текста скрипта. */
const crawlerUnescape = (source: string): string => {
  let text = source
  for (let pass = 0; pass < 3; pass += 1) {
    text = text.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)))
    text = text.replace(/\\\//g, '/')
  }
  return text
}

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
    const decoded = crawlerUnescape(script)

    expect(script).not.toContain(ROUTE_KEY)
    expect(script).not.toContain('(tabs)/')
    expect(script).not.toContain('/travels/staryy')
    expect(script).not.toContain('\\u002F')
    expect(script).not.toContain('\\u002f')
    expect(decoded).not.toContain(ROUTE_KEY)
    expect(decoded).not.toContain('/(tabs)/')
    expect(decoded).not.toContain('/travels/')
    expect(crawlerUnescape(createLoaderDataScriptAsString({ [ROUTE_KEY]: {} }))).not.toContain('/(tabs)/')
    const questKey = '/(tabs)/quests/21/wroclaw-kids-gnome-service'
    const questScript = crawlerUnescape(getLoaderDataScriptContents({ [questKey]: { quest: null } }))
    expect(questScript).not.toContain(questKey)
    expect(questScript).not.toContain('/(tabs)/quests/')
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
    expect(patch).toContain('LOADER_KEY_SLASH')
    expect(patch).not.toContain('\\u002F')
  })

  it('stays readable by the production loader regex without the route key', () => {
    const script = getLoaderDataScriptContents({ [ROUTE_KEY]: { travel: { id: 340, slug: 'staryy-i-novyy-zamki-v-grodno' } } })
    const loaderMatch = script.match(/globalThis\.__EXPO_ROUTER_LOADER_DATA__\s*=\s*JSON\.parse\(("(?:\\.|[^"\\])*")\)/)

    expect(loaderMatch).not.toBeNull()
    const parsed = JSON.parse(JSON.parse(loaderMatch![1])) as Record<string, { travel?: { id?: number; slug?: string } }>
    expect(Object.keys(parsed).some((key) => key.includes('/'))).toBe(false)
    expect(Object.keys(parsed)).not.toContain(ROUTE_KEY)
    expect(Object.values(parsed).map((entry) => entry?.travel?.id)).toEqual([340])
    expect(Object.values(parsed).map((entry) => entry?.travel?.slug)).toEqual(['staryy-i-novyy-zamki-v-grodno'])
  })
})
