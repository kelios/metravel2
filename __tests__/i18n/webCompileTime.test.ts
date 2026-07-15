import fs from 'node:fs'
import path from 'node:path'

import { transformSync } from '@babel/core'

import i18n from '@/i18n/instance.web'
import type { TranslationKey } from '@/i18n/resources'
import {
  getFixedTranslator,
  hashTranslationKey,
  loadWebLocale,
  translate,
  translatePlural,
} from '@/i18n/translate.web'

describe('web compile-time localization', () => {
  it('inlines literal keys before Metro bundles web modules', () => {
    const result = transformSync(
      `
        import { translate as i18nT, translatePlural } from '@/i18n'
        export const language = i18nT('common:language.ru')
        export const characters = translatePlural('travel:common.characterNoun', 2)
      `,
      {
        caller: { name: 'metro', platform: 'web' },
        filename: path.resolve(process.cwd(), 'components/__i18n_compile_probe__.tsx'),
      },
    )

    expect(result?.code).not.toContain('common:language.ru')
    expect(result?.code).not.toContain('travel:common.characterNoun')
    expect(result?.code).toContain('h:')
    expect(result?.code).toContain('v:')
    expect(result?.code).toContain('p:')
    expect(result?.code).not.toContain('Russian')
    expect(result?.code).not.toContain('Rosyjski')
  })

  it('inlines JSON-backed quest SEO resources before Metro bundles the helper', () => {
    const filename = path.resolve(process.cwd(), 'utils/questSeo.js')
    const result = transformSync(fs.readFileSync(filename, 'utf8'), {
      caller: { name: 'metro', platform: 'web' },
      filename,
    })

    expect(result?.code).not.toContain('seo:utils.questSeo.')
    expect(result?.code).toContain('h:')
    expect(result?.code).toContain('v:')
  })

  it('keeps interpolation and Russian plural rules in the eager runtime', () => {
    const fixedRu = getFixedTranslator('ru')
    const compiledNoun = {
      h: hashTranslationKey('travel:common.characterNoun'),
      v: 'символов',
      p: { one: 'символ', few: 'символа', many: 'символов', other: 'символов' },
    } as unknown as TranslationKey

    expect(
      translate('Осталось {{count}}' as TranslationKey, { count: 3 }),
    ).toBe('Осталось 3')
    expect(fixedRu(compiledNoun, { count: 2 })).toBe('символа')
    expect(translatePlural(compiledNoun, 2)).toBe('символа')
  })

  it('loads every non-default locale outside the eager bundle', async () => {
    const languageName = {
      h: hashTranslationKey('common:language.ru'),
      v: 'Русский',
    } as unknown as TranslationKey

    await loadWebLocale('be')
    expect(getFixedTranslator('be')(languageName)).toBe('Руская')

    await loadWebLocale('uk')
    expect(getFixedTranslator('uk')(languageName)).toBe('Російська')

    await loadWebLocale('en')
    expect(getFixedTranslator('en')(languageName)).toBe('Russian')

    await loadWebLocale('pl')
    expect(getFixedTranslator('pl')(languageName)).toBe('Rosyjski')

    await i18n.changeLanguage('ru')
  })

  it('does not expose an uninlined translation key to the user', () => {
    expect(translate('common:not-inlined' as TranslationKey)).toBe('Перевод недоступен')
  })
})
