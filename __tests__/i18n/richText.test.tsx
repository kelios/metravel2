import { render } from '@testing-library/react-native'
import { Text } from 'react-native'
import { renderLocalizedText } from '@/i18n/richText'

describe('localized rich interpolation', () => {
  it('places styled nodes in the order specified by the localized phrase', () => {
    const { getByTestId, getByText } = render(
      <Text>{renderLocalizedText('{{value2}}: {{value1}}', {
        value1: <Text testID="emphasized-count">5</Text>, value2: 'Wybrano',
      })}</Text>,
    )
    expect(getByText('Wybrano: 5')).toBeTruthy()
    expect(getByTestId('emphasized-count')).toBeTruthy()
  })
})
