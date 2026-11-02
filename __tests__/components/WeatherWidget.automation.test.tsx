import { render, waitFor } from '@testing-library/react-native'
import { Platform } from 'react-native'

// #2922: под web-автоматизацией виджет не ходит в open-meteo и не рендерится,
// но сообщает о завершении, чтобы плейсхолдер сайдбара статьи не висел.
jest.mock('@/utils/isWebAutomation', () => ({
  isWebAutomation: true,
  isWebAutomationNavigator: () => true,
}))

import WeatherWidget from '@/components/home/WeatherWidget'

describe('WeatherWidget under web automation', () => {
  const originalPlatform = Platform.OS
  const originalFetch = global.fetch

  beforeEach(() => {
    ;(Platform as any).OS = 'web'
    global.fetch = jest.fn()
  })

  afterEach(() => {
    ;(Platform as any).OS = originalPlatform
    global.fetch = originalFetch
    jest.clearAllMocks()
  })

  it('skips the third-party request, renders nothing and still settles', async () => {
    const onSettled = jest.fn()
    const { toJSON } = await render(
      <WeatherWidget
        points={[{ coord: '53.9, 27.56', address: 'Минск' }]}
        countryName="BY"
        onSettled={onSettled}
      />
    )

    await waitFor(() => expect(onSettled).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(toJSON()).toBeNull())
    expect(global.fetch).not.toHaveBeenCalled()
  })
})
