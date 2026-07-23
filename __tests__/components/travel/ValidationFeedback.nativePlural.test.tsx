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
})
