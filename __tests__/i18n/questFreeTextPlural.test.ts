import fs from 'node:fs'
import path from 'node:path'

import { selectPluralCategory } from '@/i18n/pluralRules'
import { resources, type TranslationKey } from '@/i18n/resources'
import { getFixedTranslator, translatePlural } from '@/i18n/translate'

const TOO_SHORT = 'quests:components.quests.questWizardStepCard.freeTextTooShort'
const NOTE = 'quests:components.quests.questWizardStepCard.freeTextNote'

type Locale = 'ru' | 'be' | 'uk' | 'pl' | 'en'

// Тот же путь, что у `translatePlural` на устройстве: категорию выбирает
// `selectPluralCategory`, а не `Intl.PluralRules` i18next (#1335). Так тест
// проверяет форму для любой локали, не переключая язык приложения.
const pluralFor = (locale: Locale, key: string, count: number): string =>
  getFixedTranslator(locale)(
    `${key}_${selectPluralCategory(count, locale)}` as TranslationKey,
    { count },
  )

describe('quest free-text length messages agree the noun with the number (#2166)', () => {
  it.each([
    [1, 'Слишком коротко — напиши хотя бы 1 символ.'],
    [2, 'Слишком коротко — напиши хотя бы 2 символа.'],
    [4, 'Слишком коротко — напиши хотя бы 4 символа.'],
    [5, 'Слишком коротко — напиши хотя бы 5 символов.'],
    [11, 'Слишком коротко — напиши хотя бы 11 символов.'],
    [21, 'Слишком коротко — напиши хотя бы 21 символ.'],
    [24, 'Слишком коротко — напиши хотя бы 24 символа.'],
  ])('RU too-short error for %i', (count, expected) => {
    expect(translatePlural(TOO_SHORT as TranslationKey, count)).toBe(expected)
    expect(pluralFor('ru', TOO_SHORT, count)).toBe(expected)
  })

  it.each([
    [1, 'Нужен хотя бы 1 символ.'],
    [4, 'Нужно хотя бы 4 символа.'],
    [5, 'Нужно хотя бы 5 символов.'],
    [21, 'Нужен хотя бы 21 символ.'],
  ])('RU note under the field for %i', (count, tail) => {
    expect(translatePlural(NOTE as TranslationKey, count)).toBe(
      `Свободный ответ: правильного варианта нет — просто опиши, что видишь. ${tail}`,
    )
  })

  it.each<[Locale, number, string]>([
    ['be', 1, 'Занадта коратка — напішы хаця б 1 сімвал.'],
    ['be', 4, 'Занадта коратка — напішы хаця б 4 сімвалы.'],
    ['be', 5, 'Занадта коратка — напішы хаця б 5 сімвалаў.'],
    ['be', 21, 'Занадта коратка — напішы хаця б 21 сімвал.'],
    ['uk', 1, 'Занадто коротко — напиши щонайменше 1 символ.'],
    ['uk', 4, 'Занадто коротко — напиши щонайменше 4 символи.'],
    ['uk', 5, 'Занадто коротко — напиши щонайменше 5 символів.'],
    ['uk', 24, 'Занадто коротко — напиши щонайменше 24 символи.'],
    ['pl', 1, 'Za krótko — napisz co najmniej 1 znak.'],
    ['pl', 4, 'Za krótko — napisz co najmniej 4 znaki.'],
    ['pl', 5, 'Za krótko — napisz co najmniej 5 znaków.'],
    ['pl', 21, 'Za krótko — napisz co najmniej 21 znaków.'],
    ['pl', 22, 'Za krótko — napisz co najmniej 22 znaki.'],
    ['en', 1, 'Too short — write at least 1 character.'],
    ['en', 4, 'Too short — write at least 4 characters.'],
  ])('%s too-short error for %i', (locale, count, expected) => {
    expect(pluralFor(locale, TOO_SHORT, count)).toBe(expected)
  })

  it.each<[Locale, number, string]>([
    ['be', 4, 'Патрэбна хаця б 4 сімвалы.'],
    ['uk', 4, 'Потрібно щонайменше 4 символи.'],
    // «Potrzeba» управляет родительным падежом: форма «few» здесь «znaków», не «znaki».
    ['pl', 1, 'Potrzeba co najmniej 1 znaku.'],
    ['pl', 4, 'Potrzeba co najmniej 4 znaków.'],
    ['en', 1, 'At least 1 character.'],
    ['en', 4, 'At least 4 characters.'],
  ])('%s note under the field for %i', (locale, count, tail) => {
    expect(pluralFor(locale, NOTE, count).endsWith(` ${tail}`)).toBe(true)
  })

  it('keeps the base key and all four plural forms in every locale', () => {
    const missing: string[] = []
    for (const [locale, localeResources] of Object.entries(resources)) {
      const quests = localeResources.quests as Record<string, string>
      for (const key of [TOO_SHORT, NOTE]) {
        const bare = key.replace('quests:', '')
        for (const suffix of ['', '_one', '_few', '_many', '_other']) {
          const value = quests[`${bare}${suffix}`]
          if (!value || !value.includes('{{count}}')) missing.push(`${locale}:${bare}${suffix}`)
        }
      }
    }
    expect(missing).toEqual([])
  })

  it('leaves no single-form key or direct i18nT call for these messages', () => {
    const stale: string[] = []
    for (const [locale, localeResources] of Object.entries(resources)) {
      for (const key of Object.keys(localeResources.quests)) {
        if (/slishkom_korotko_value1|svobodnyy_otvet_value1/.test(key)) stale.push(`${locale}:${key}`)
      }
    }
    expect(stale).toEqual([])

    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'components/quests/questWizardStepCard.tsx'),
      'utf8',
    )
    expect(source).toContain(`translatePlural('${TOO_SHORT}', freeTextMinLength)`)
    expect(source).toContain(`translatePlural('${NOTE}', freeTextMinLength)`)
  })
})
