import fs from 'node:fs'
import path from 'node:path'

import { resources, type TranslationKey } from '@/i18n/resources'
import { getFixedTranslator, hasTranslation, translate, translatePlural } from '@/i18n/translate'

const SOURCE_ROOTS = [
  'api',
  'app',
  'components',
  'config',
  'constants',
  'context',
  'hooks',
  'screens',
  'services',
  'stores',
  'utils',
]

const walk = (directory: string): string[] => {
  if (!fs.existsSync(directory)) return []
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name)
    if (entry.isDirectory()) return walk(absolute)
    return /\.(?:js|jsx|ts|tsx)$/.test(entry.name) ? [absolute] : []
  })
}

describe('i18n resources', () => {
  it('keeps every Russian namespace populated with non-empty strings', () => {
    for (const [namespace, entries] of Object.entries(resources.ru)) {
      expect(Object.keys(entries).length).toBeGreaterThan(0)
      for (const [key, value] of Object.entries(entries)) {
        expect(`${namespace}:${key}`).not.toContain('undefined')
        expect(typeof value).toBe('string')
        expect(value.trim()).not.toBe('')
      }
    }
  })

  it('keeps every locale structurally identical to the Russian source contract', () => {
    const baseline = resources.ru
    const baselineNamespaces = Object.keys(baseline).sort()

    for (const [locale, localeResources] of Object.entries(resources)) {
      expect({ locale, namespaces: Object.keys(localeResources).sort() }).toEqual({
        locale,
        namespaces: baselineNamespaces,
      })

      for (const namespace of baselineNamespaces) {
        const typedNamespace = namespace as keyof typeof baseline
        expect(Object.keys(localeResources[typedNamespace]).sort()).toEqual(
          Object.keys(baseline[typedNamespace]).sort(),
        )
      }
    }
  })

  it('preserves interpolation placeholders in every translation', () => {
    const placeholderPattern = /\{\{\s*([^}\s]+)\s*\}\}/g
    const placeholders = (value: string) =>
      [...value.matchAll(placeholderPattern)].map((match) => match[1]).sort()

    for (const locale of ['pl', 'en'] as const) {
      for (const [namespace, entries] of Object.entries(resources.ru)) {
        const translatedEntries = resources[locale][namespace as keyof typeof resources.ru]
        for (const [key, sourceValue] of Object.entries(entries)) {
          expect({ locale, namespace, key, placeholders: placeholders(translatedEntries[key as keyof typeof translatedEntries]) }).toEqual({
            locale,
            namespace,
            key,
            placeholders: placeholders(sourceValue),
          })
        }
      }
    }
  })

  it('ships translated Polish and English catalogs without Russian UI residue', () => {
    const executableStylePattern = /(?:^|\n)\s*[.#][\w.{#-][^\n{]*\{|(?:^|\n)\s*@(?:media|supports|keyframes)\b/
    for (const locale of ['pl', 'en'] as const) {
      const residue: string[] = []
      for (const [namespace, entries] of Object.entries(resources[locale])) {
        for (const [key, value] of Object.entries(entries)) {
          // Legacy executable CSS templates are copied byte-for-byte; translating
          // their declarations would corrupt layout rather than localize UI.
          if (executableStylePattern.test(value)) continue
          if (/[\u0400-\u04ff]/.test(value)) residue.push(`${namespace}:${key}`)
        }
      }
      expect({ locale, residue }).toEqual({ locale, residue: [] })
    }
  })

  it('keeps layout and executable templates out of translation resources', () => {
    const violations: string[] = []
    for (const [locale, localeResources] of Object.entries(resources)) {
      for (const [namespace, entries] of Object.entries(localeResources)) {
        for (const [key, value] of Object.entries(entries)) {
          const withoutLeadingValues = value
            .trimStart()
            .replace(/^(?:\{\{value\d+\}\}\s*)+/, '')
          const containsLayoutTemplate =
            /<!doctype|<script\b/i.test(value) ||
            /^<(?:[a-z][\w:-]*\b|!doctype)/i.test(withoutLeadingValues) ||
            (/[\r\n]/.test(value) && /<(?:div|section|svg|img|style)\b/i.test(value))
          if (containsLayoutTemplate) violations.push(`${locale}:${namespace}:${key}`)
        }
      }
    }
    expect(violations).toEqual([])
  })

  it('resolves every literal translation key used by application source', () => {
    const unresolved: string[] = []
    const keyPattern = /\b(?:i18nT|translate|translatePlural|hasTranslation)\(\s*['"]([^'"]+)['"]/g

    for (const root of SOURCE_ROOTS) {
      for (const file of walk(path.resolve(process.cwd(), root))) {
        const source = fs.readFileSync(file, 'utf8')
        for (const match of source.matchAll(keyPattern)) {
          const key = match[1] as TranslationKey
          if (!hasTranslation(key)) {
            unresolved.push(`${path.relative(process.cwd(), file)}: ${match[1]}`)
          }
        }
      }
    }

    expect(unresolved).toEqual([])
  })

  it('translates typed keys and interpolation with a fixed locale', () => {
    const fixedRu = getFixedTranslator('ru')
    const fixedPl = getFixedTranslator('pl')
    const fixedEn = getFixedTranslator('en')

    expect(translate('common:language.ru')).toBe('Русский')
    expect(
      fixedRu('trips:components.trips.tripFormatting.mest_value1_iz_value2_11fa56e7', {
        value1: 2,
        value2: 5,
      }),
    ).toBe('мест: 2 из 5')
    expect(fixedPl('common:language.settingTitle')).toBe('Język interfejsu')
    expect(fixedEn('common:language.settingTitle')).toBe('Interface language')
  })

  it('uses locale plural rules instead of component-level grammar branches', () => {
    expect(translatePlural('travel:common.characterNoun', 1)).toBe('символ')
    expect(translatePlural('travel:common.characterNoun', 2)).toBe('символа')
    expect(translatePlural('travel:common.characterNoun', 5)).toBe('символов')
    expect(translatePlural('export:services.pdfExport.runtime.map.pointNoun', 21)).toBe('точка')
  })

  it('returns the configured fallback instead of leaking an unknown key', () => {
    expect(translate('common:not-a-real-key' as TranslationKey)).toBe('Перевод недоступен')
  })
})
