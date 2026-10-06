import { render } from '@testing-library/react-native'

import { CharacterCounter, ValidationSummary } from '@/components/travel/ValidationFeedback'
import { i18n } from '@/i18n'

const characterPluralCases: Array<[string, string[]]> = [
  ['ru', ['0 символов', '1 символ', '2 символа', '5 символов']],
  ['be', ['0 знакаў', '1 знак', '2 знакі', '5 знакаў']],
  ['uk', ['0 символів', '1 символ', '2 символи', '5 символів']],
  ['pl', ['0 znaków', '1 znak', '2 znaki', '5 znaków']],
  ['en', ['0 characters', '1 character', '2 characters', '5 characters']],
]

describe('ValidationFeedback native plural fallback', () => {
  afterEach(async () => {
    await i18n.changeLanguage('ru')
  })

  it('renders Russian counts when Intl.PluralRules is unavailable', () => {
    const descriptor = Object.getOwnPropertyDescriptor(Intl, 'PluralRules')
    Object.defineProperty(Intl, 'PluralRules', { configurable: true, value: undefined })

    try {
      const { getByText } = render(<ValidationSummary errorCount={2} warningCount={5} />)
      expect(getByText('2 ошибки')).toBeTruthy()
      expect(getByText('5 предупреждений')).toBeTruthy()
    } finally {
      if (descriptor) Object.defineProperty(Intl, 'PluralRules', descriptor)
    }
  })

  it.each(characterPluralCases)('formats 0/1/2/5 character nouns for %s', async (locale, expected) => {
    await i18n.changeLanguage(locale)

    for (const [index, count] of [0, 1, 2, 5].entries()) {
      const screen = render(<CharacterCounter current={count} showProgress={false} />)
      expect(screen.getByText(expected[index])).toBeTruthy()
      screen.unmount()
    }
  })
  it.each(characterPluralCases)('localizes entire minimum/maximum messages for %s', async (locale, expected) => {
    await i18n.changeLanguage(locale)
    const minimum = { ru: 'минимум', be: 'мінімум', uk: 'мінімум', pl: 'minimum', en: 'minimum' }[locale]
    const exceeded = { ru: 'превышен лимит', be: 'перавышаны ліміт', uk: 'перевищений ліміт', pl: 'przekroczono limit', en: 'limit exceeded' }[locale]
    for (const [index, limit] of [1, 2, 5].entries()) {
      const noun = expected[index + 1].replace(/^\d+ /, '')
      const below = render(<CharacterCounter current={0} min={limit} showProgress={false} />)
      expect(below.getByText(`0 / ${limit} ${noun} (${minimum})`)).toBeTruthy()
      below.unmount()
      const over = render(<CharacterCounter current={limit + 1} max={limit} showProgress={false} />)
      expect(over.getByText(`${limit + 1} / ${limit} ${noun} (${exceeded})`)).toBeTruthy()
      over.unmount()
    }
  })

})
