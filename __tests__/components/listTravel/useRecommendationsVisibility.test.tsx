import { Text, Pressable, Platform, type PlatformOSType } from 'react-native'
import { render, fireEvent, waitFor } from '@testing-library/react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'

import { useRecommendationsVisibility } from '@/components/listTravel/hooks/useRecommendationsVisibility'
import { RECOMMENDATIONS_VISIBLE_KEY } from '@/components/listTravel/utils/listTravelConstants'

const HookTestComponent = () => {
  const { isRecommendationsVisible, setIsRecommendationsVisible } = useRecommendationsVisibility()

  return (
    <>
      <Text testID="visible">{isRecommendationsVisible ? 'true' : 'false'}</Text>
      <Pressable testID="show" onPress={() => setIsRecommendationsVisible(true)}>
        <Text>show</Text>
      </Pressable>
      <Pressable testID="hide" onPress={() => setIsRecommendationsVisible(false)}>
        <Text>hide</Text>
      </Pressable>
    </>
  )
}

const setPlatform = (os: PlatformOSType) => {
  ;(Platform as any).OS = os
}

describe('useRecommendationsVisibility', () => {
  const originalPlatform = Platform.OS

  beforeEach(() => {
    jest.clearAllMocks()
    setPlatform(originalPlatform)
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.clear()
    }
    ;(AsyncStorage as any).__reset?.()
  })

  afterAll(() => {
    setPlatform(originalPlatform)
  })

  it('loads and saves visibility through native AsyncStorage on Android', async () => {
    setPlatform('android')
    await AsyncStorage.setItem(RECOMMENDATIONS_VISIBLE_KEY, 'true')
    ;(AsyncStorage.getItem as jest.Mock).mockClear()
    ;(AsyncStorage.setItem as jest.Mock).mockClear()

    const { getByTestId } = render(<HookTestComponent />)

    await waitFor(() => {
      expect(AsyncStorage.getItem).toHaveBeenCalledWith(RECOMMENDATIONS_VISIBLE_KEY)
      expect(getByTestId('visible')).toHaveTextContent('true')
    })

    fireEvent.press(getByTestId('hide'))

    await waitFor(() => {
      expect(getByTestId('visible')).toHaveTextContent('false')
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(RECOMMENDATIONS_VISIBLE_KEY, 'false')
    })
  })

  it('keeps web behavior on sessionStorage', async () => {
    setPlatform('web')
    sessionStorage.setItem(RECOMMENDATIONS_VISIBLE_KEY, 'true')

    const { getByTestId } = render(<HookTestComponent />)

    expect(getByTestId('visible')).toHaveTextContent('true')
    expect(AsyncStorage.getItem).not.toHaveBeenCalled()

    fireEvent.press(getByTestId('hide'))

    await waitFor(() => {
      expect(getByTestId('visible')).toHaveTextContent('false')
      expect(sessionStorage.getItem(RECOMMENDATIONS_VISIBLE_KEY)).toBe('false')
      expect(AsyncStorage.setItem).not.toHaveBeenCalled()
    })
  })
})
