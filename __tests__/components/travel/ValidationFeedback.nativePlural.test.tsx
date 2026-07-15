import { render } from '@testing-library/react-native'

import { ValidationSummary } from '@/components/travel/ValidationFeedback'

describe('ValidationFeedback native plural fallback', () => {
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
})
