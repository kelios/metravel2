/**
 * @jest-environment node
 */

/**
 * #1747 — подписи ярлыков лаунчера Android совпадают с названиями экранов.
 *
 * Плагин `plugins/withAndroidShortcuts.js` выполняется при prebuild как CommonJS
 * и TS-модулей i18n не видит, поэтому держит собственную таблицу подписей.
 * Этот тест — единственное, что не даёт таблице отстать от i18n: экран
 * переименовали (как /favorites → «Хочу поехать» в #1745) — тест падает по
 * локали и ярлыку, пока не обновлена и таблица.
 */

import fs from 'fs'
import os from 'os'
import path from 'path'

import { SUPPORTED_LOCALES } from '@/i18n/config'

const plugin = require('../../plugins/withAndroidShortcuts') as typeof import('../../plugins/withAndroidShortcuts') & {
  DEFAULT_LOCALE: string
  SHORTCUT_LABELS: Record<string, Record<'search' | 'map' | 'favorites', { short: string; long: string }>>
  SHORTCUTS_XML: string
  escapeAndroidString: (value: string) => string
  renderShortcutStrings: (labels: Record<string, { short: string; long: string }>) => string
  upsertShortcutStrings: (
    stringsPath: string,
    labels: Record<string, { short: string; long: string }>,
    options?: { isDefault?: boolean },
  ) => string
  allowMissingTranslations: (content: string) => string
  writeShortcutResources: (resDir: string) => void
}

const REPO_ROOT = path.resolve(__dirname, '../..')

/** Все пары ключ→текст модуля i18n: каждый модуль экспортирует один объект ресурсов. */
const loadResources = (locale: string, relative: string): Record<string, string> => {
  const moduleExports = require(path.join(REPO_ROOT, 'i18n/locales', locale, relative)) as Record<string, unknown>
  return Object.assign({}, ...Object.values(moduleExports).filter((value) => value && typeof value === 'object'))
}

/** Откуда плагин обязан брать каждую подпись. Длинной подписи карты ключа в i18n нет. */
const I18N_SOURCE: Record<'search' | 'map' | 'favorites', { short: [string, string]; long?: [string, string] }> = {
  search: {
    short: ['static/navigation_static', 'breadcrumb.search'],
    long: ['generated/home_01', 'components.home.HomeHeroSearchBar.poisk_marshrutov_ee35e283'],
  },
  map: {
    short: ['static/navigation_static', 'breadcrumb.map'],
  },
  favorites: {
    short: ['static/navigation_static', 'breadcrumb.favorites'],
    long: ['generated/shared_01', 'app.tabs.favorites.marshruty_kuda_vy_hotite_poehat_c9209d67'],
  },
}

describe('Android launcher shortcuts (#1747)', () => {
  it('covers every app locale, ru as the default values/ set', () => {
    expect(Object.keys(plugin.SHORTCUT_LABELS).sort()).toEqual([...SUPPORTED_LOCALES].sort())
    expect(plugin.DEFAULT_LOCALE).toBe('ru')
  })

  it.each([...SUPPORTED_LOCALES])('%s: labels mirror the screen names from i18n', (locale) => {
    const labels = plugin.SHORTCUT_LABELS[locale]
    const expected: Record<string, string> = {}
    const actual: Record<string, string> = {}

    for (const [id, source] of Object.entries(I18N_SOURCE)) {
      for (const kind of ['short', 'long'] as const) {
        const ref = source[kind]
        if (!ref) continue
        const [module, key] = ref
        expected[`${id}.${kind}`] = loadResources(locale, module)[key]
        actual[`${id}.${kind}`] = labels[id as keyof typeof labels][kind]
      }
    }

    expect(actual).toEqual(expected)
    // Длинная подпись карты — единственная без ключа в i18n: хотя бы не пустая.
    expect(labels.map.long.trim().length).toBeGreaterThan(0)
  })

  it('shortcuts.xml references exactly the string names the table renders', () => {
    const referenced = [...plugin.SHORTCUTS_XML.matchAll(/@string\/(shortcut_[a-z]+_(?:short|long))/g)].map((m) => m[1]).sort()
    const rendered = [...plugin.renderShortcutStrings(plugin.SHORTCUT_LABELS.ru).matchAll(/name="([^"]+)"/g)].map((m) => m[1]).sort()

    expect(referenced).toEqual(rendered)
  })

  it('escapes Android string resources', () => {
    expect(plugin.escapeAndroidString(`Ro'k & "q" <b>`)).toBe(`Ro\\'k &amp; \\"q\\" &lt;b&gt;`)
  })

  describe('resource writer', () => {
    let resDir: string

    beforeEach(() => {
      resDir = fs.mkdtempSync(path.join(os.tmpdir(), 'android-shortcuts-'))
    })

    afterEach(() => {
      fs.rmSync(resDir, { recursive: true, force: true })
    })

    it('replaces stale shortcut strings in an existing values/strings.xml and keeps the rest', () => {
      // Ровно то, что лежит в уже собранном android/ после старого плагина.
      const valuesDir = path.join(resDir, 'values')
      fs.mkdirSync(valuesDir, { recursive: true })
      fs.writeFileSync(
        path.join(valuesDir, 'strings.xml'),
        [
          '<resources>',
          '  <string name="app_name">MeTravel</string>',
          '  <string name="shortcut_search_short">Поиск</string>',
          '  <string name="shortcut_favorites_short">Избранное</string>',
          '  <string name="shortcut_favorites_long">Избранные маршруты</string>',
          '  <string name="expo_runtime_version">exposdk:57.0.0</string>',
          '</resources>',
          '',
        ].join('\n'),
        'utf8',
      )

      plugin.writeShortcutResources(resDir)

      const content = fs.readFileSync(path.join(valuesDir, 'strings.xml'), 'utf8')
      expect(content).not.toContain('Избранное')
      expect(content).not.toContain('Избранные маршруты')
      expect(content).toContain('<string name="shortcut_favorites_short">Хочу поехать</string>')
      expect(content).toContain('<string name="app_name">MeTravel</string>')
      expect(content).toContain('<string name="expo_runtime_version">exposdk:57.0.0</string>')
      expect(content.match(/shortcut_favorites_short/g)).toHaveLength(1)
      expect(content.match(/<\/resources>/g)).toHaveLength(1)
      expect(fs.existsSync(path.join(resDir, 'xml', 'shortcuts.xml'))).toBe(true)
    })

    it('lets the default set skip MissingTranslation: locale sets carry only shortcut_* strings', () => {
      // app_name/expo_runtime_version/facebook_* дефолтного набора в values-<l>/
      // не переведены; без tools:ignore AGP-lint валит :app:lintVitalRelease.
      plugin.writeShortcutResources(resDir)

      const root = fs.readFileSync(path.join(resDir, 'values', 'strings.xml'), 'utf8').match(/<resources[^>]*>/)?.[0]
      expect(root).toContain('xmlns:tools="http://schemas.android.com/tools"')
      expect(root).toContain('tools:ignore="MissingTranslation"')

      const locale = fs.readFileSync(path.join(resDir, 'values-en', 'strings.xml'), 'utf8')
      expect(locale).not.toContain('tools:ignore')
    })

    it('keeps an existing tools namespace and ignore list on the default root', () => {
      const withNamespace = '<resources xmlns:tools="http://schemas.android.com/tools">\n</resources>\n'
      expect(plugin.allowMissingTranslations(withNamespace).match(/xmlns:tools=/g)).toHaveLength(1)
      expect(plugin.allowMissingTranslations(withNamespace)).toContain('tools:ignore="MissingTranslation"')

      const alreadyIgnored = '<resources xmlns:tools="http://schemas.android.com/tools" tools:ignore="ExtraTranslation">\n</resources>\n'
      expect(plugin.allowMissingTranslations(alreadyIgnored)).toBe(alreadyIgnored)
    })

    it('creates values-<locale>/strings.xml for the other locales', () => {
      plugin.writeShortcutResources(resDir)

      for (const locale of SUPPORTED_LOCALES) {
        if (locale === plugin.DEFAULT_LOCALE) continue
        const content = fs.readFileSync(path.join(resDir, `values-${locale}`, 'strings.xml'), 'utf8')
        expect(content).toContain(
          `<string name="shortcut_favorites_short">${plugin.escapeAndroidString(plugin.SHORTCUT_LABELS[locale].favorites.short)}</string>`,
        )
        expect(content.trim().startsWith('<resources>')).toBe(true)
        expect(content.trim().endsWith('</resources>')).toBe(true)
      }
    })

    it('is idempotent: a second run leaves one copy of every string', () => {
      plugin.writeShortcutResources(resDir)
      plugin.writeShortcutResources(resDir)

      const content = fs.readFileSync(path.join(resDir, 'values-en', 'strings.xml'), 'utf8')
      expect(content.match(/shortcut_map_long/g)).toHaveLength(1)
    })

    it('refuses a strings.xml without a <resources> root', () => {
      const broken = path.join(resDir, 'values', 'strings.xml')
      fs.mkdirSync(path.dirname(broken), { recursive: true })
      fs.writeFileSync(broken, '<oops/>', 'utf8')

      expect(() => plugin.upsertShortcutStrings(broken, plugin.SHORTCUT_LABELS.ru)).toThrow(/<\/resources>/)
    })
  })
})
