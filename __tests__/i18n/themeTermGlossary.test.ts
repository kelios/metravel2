import { resources } from '@/i18n/resources'

// #2180: в приложении «тема» — всегда тема оформления (светлая/тёмная, тема
// PDF-книги), смысла «тема разговора» в интерфейсе нет. Машинный перевод без
// контекста дал EN «Subject»/«Select topic» и PL «Temat» — в меню, настройках,
// a11y-подписи переключателя темы и в PDF-книге. Глоссарий держит термин для
// каждого RU-значения со словом «тема» в любой форме.

// Окончание обязательно: голое «тем» — местоимение («тем, кто…», «тем ближе»).
const RU_THEME_WORD = /(^|[^а-яё])тем(а|у|ы|е|ой|ам|ами|ах)([^а-яё]|$)/i

const GLOSSARY = {
  en: { required: /\btheme/i, forbidden: /\b(topic|subject)/i },
  pl: { required: /motyw/i, forbidden: /temat/i },
} as const

type Bundle = Record<string, Record<string, unknown>>

const themeEntries = () =>
  Object.entries(resources.ru as unknown as Bundle).flatMap(([namespace, entries]) =>
    Object.entries(entries)
      .filter(([, value]) => typeof value === 'string' && RU_THEME_WORD.test(value))
      .map(([key]) => ({ namespace, key })),
  )

describe('глоссарий: «тема» = тема оформления (#2180)', () => {
  it('находит ключи с темой оформления в RU', () => {
    expect(themeEntries().length).toBeGreaterThanOrEqual(8)
    expect(RU_THEME_WORD.test('Тематические группы')).toBe(false)
    expect(RU_THEME_WORD.test('Чем дальше, тем ближе')).toBe(false)
    expect(RU_THEME_WORD.test('Выбрать тему: {{value1}}')).toBe(true)
  })

  it.each(Object.keys(GLOSSARY) as (keyof typeof GLOSSARY)[])('%s переводит «тему» как тему оформления', (locale) => {
    const { required, forbidden } = GLOSSARY[locale]
    const bundle = resources[locale] as unknown as Bundle
    const violations = themeEntries().flatMap(({ namespace, key }) => {
      const value = bundle[namespace]?.[key]
      if (typeof value !== 'string') return []
      return required.test(value) && !forbidden.test(value) ? [] : [`${namespace}:${key} = ${JSON.stringify(value)}`]
    })
    expect(violations).toEqual([])
  })
})
