import { resources } from '@/i18n/resources'

// Паритет перевода с RU по краям значения (#2237). Интерфейс местами собирает
// фразу из кусочков: `{t('Нет аккаунта? ')}<Link>`, `{t('Версия приложения: ')}{n}`.
// Разделителем служит пробел внутри RU-значения, а машинный перевод обрезал его —
// на экране выходило «Don't have an account?Sign up», «Application version:1.0.5».
// Тот же прогон потерял регистр первой буквы: «Точка» → «point», «Хочу» → «chcę».
//
// Гейт держит три правила:
// 1. краевые пробелы перевода равны краевым пробелам RU во всех локалях;
// 2. регистр первой буквы перевода равен RU, если оба значения начинаются с буквы;
// 3. кусочков с краевым пробелом в RU не становится больше: новая фраза
//    заводится с подстановкой (`{{value1}}`), а не склейкой. Перевод кусочка на
//    подстановку уменьшает FRAGMENT_BASELINE — число правится вниз вместе с ним.

type Locale = 'en' | 'pl' | 'be' | 'uk'
type Bundle = Record<string, Record<string, unknown>>

const LOCALES: Locale[] = ['en', 'pl', 'be', 'uk']
const FRAGMENT_BASELINE = 0

// Имя собственное со строчной буквы — не потеря регистра.
const LOWERCASE_PROPER_NAME = /^(iOS|iPhone|iPad|macOS|eSIM)\b/

const bundles = resources as unknown as Record<'ru' | Locale, Bundle>

const ruEntries = Object.entries(bundles.ru).flatMap(([namespace, entries]) =>
  Object.entries(entries)
    .filter((entry): entry is [string, string] => typeof entry[1] === 'string')
    .map(([key, ru]) => ({ id: `${namespace}:${key}`, namespace, key, ru })),
)

const leading = (value: string) => value.match(/^\s*/)?.[0] ?? ''
const trailing = (value: string) => value.match(/\s*$/)?.[0] ?? ''
const isLetter = (char: string | undefined) => Boolean(char && /\p{L}/u.test(char))
const isUpper = (char: string) => char === char.toUpperCase() && char !== char.toLowerCase()

const edgeWhitespaceViolations = (locale: Locale): string[] =>
  ruEntries.flatMap(({ id, namespace, key, ru }) => {
    const value = bundles[locale]?.[namespace]?.[key]
    if (typeof value !== 'string') return []
    return leading(value) === leading(ru) && trailing(value) === trailing(ru)
      ? []
      : [`${id}: RU ${JSON.stringify(ru)} ≠ ${JSON.stringify(value)}`]
  })

const firstLetterCaseViolations = (locale: Locale): string[] =>
  ruEntries.flatMap(({ id, namespace, key, ru }) => {
    const value = bundles[locale]?.[namespace]?.[key]
    if (typeof value !== 'string' || LOWERCASE_PROPER_NAME.test(value.trimStart())) return []
    const ruFirst = ru.trimStart()[0]
    const first = value.trimStart()[0]
    if (!isLetter(ruFirst) || !isLetter(first)) return []
    return isUpper(ruFirst) === isUpper(first) ? [] : [`${id}: RU ${JSON.stringify(ru)} ≠ ${JSON.stringify(value)}`]
  })

describe('паритет перевода с RU по краям значения (#2237)', () => {
  it.each(LOCALES)('%s: краевые пробелы как в RU', (locale) => {
    expect(edgeWhitespaceViolations(locale)).toEqual([])
  })

  it.each(LOCALES)('%s: регистр первой буквы как в RU', (locale) => {
    expect(firstLetterCaseViolations(locale)).toEqual([])
  })

  it('кусочков для склейки не становится больше', () => {
    const fragments = ruEntries.filter(({ ru }) => /^\s|\s$/.test(ru)).map(({ id }) => id)
    // Равенство, а не потолок: рост — новая склейка, спад — опустить число.
    expect(fragments.length).toBe(FRAGMENT_BASELINE)
  })

  it('фраза с подстановкой заменила кусочки в местах из карточки', () => {
    const removed = [
      'auth:components.auth.LoginForm.net_akkaunta_6dd7f1de',
      'home:components.about.AboutIntroCard.versiya_prilozheniya_01aa3c56',
      'map:components.UserPoints.ImportWizard.naydeno_tochek_bc25057d',
      'achievements:components.achievements.BadgeDetailSheet.ostalos_9237468c',
      'achievements:components.achievements.PlaceFirstBadgeCard.otkryto_66797293',
    ]
    const stillFragments = removed.filter((id) => {
      const entry = ruEntries.find((candidate) => candidate.id === id)
      return entry ? /^\s|\s$/.test(entry.ru) : false
    })
    expect(stillFragments).toEqual([])
  })
})
