import React from 'react'
import { Text, Pressable, Platform, type PlatformOSType } from 'react-native'
import { render, fireEvent, waitFor } from '@testing-library/react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'

import { useListTravelVisibility, type UseListTravelVisibilityProps } from '@/components/listTravel/hooks/useListTravelVisibility'
import { PERSONALIZATION_VISIBLE_KEY, WEEKLY_HIGHLIGHTS_VISIBLE_KEY } from '@/components/listTravel/utils/listTravelConstants'
import { getStorageBatch } from '@/utils/storageBatch'

jest.mock('@/utils/storageBatch', () => ({
  getStorageBatch: jest.fn(),
}))

const HookTestComponent = (props: UseListTravelVisibilityProps) => {
  const {
    isPersonalizationVisible,
    isWeeklyHighlightsVisible,
    isInitialized,
    handleTogglePersonalization,
    handleToggleWeeklyHighlights,
  } = useListTravelVisibility(props)

  return (
    <>
      <Text testID="personalization">{isPersonalizationVisible ? 'true' : 'false'}</Text>
      <Text testID="weekly">{isWeeklyHighlightsVisible ? 'true' : 'false'}</Text>
      <Text testID="initialized">{isInitialized ? 'true' : 'false'}</Text>
      <Pressable testID="toggle-personalization" onPress={handleTogglePersonalization}>
        <Text>toggle personalization</Text>
      </Pressable>
      <Pressable testID="toggle-weekly" onPress={handleToggleWeeklyHighlights}>
        <Text>toggle weekly</Text>
      </Pressable>
    </>
  )
}

const mockedGetStorageBatch = getStorageBatch as jest.MockedFunction<typeof getStorageBatch>
const setPlatform = (os: PlatformOSType) => {
  ;(Platform as any).OS = os
}

describe('useListTravelVisibility', () => {
  const originalPlatform = Platform.OS

  beforeEach(() => {
    jest.clearAllMocks()
    mockedGetStorageBatch.mockReset()
    setPlatform(originalPlatform)
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.clear()
    }
    ;(AsyncStorage as any).__reset?.()
  })

  afterAll(() => {
    setPlatform(originalPlatform)
  })

  it('reads visibility from sessionStorage on web and keeps state in sync on toggle', async () => {
    setPlatform('web')
    sessionStorage.setItem(PERSONALIZATION_VISIBLE_KEY, 'false')
    sessionStorage.setItem(WEEKLY_HIGHLIGHTS_VISIBLE_KEY, 'false')

    const { getByTestId } = render(<HookTestComponent />)

    await waitFor(() => {
      expect(getByTestId('personalization')).toHaveTextContent('false')
      expect(getByTestId('weekly')).toHaveTextContent('false')
      expect(getByTestId('initialized')).toHaveTextContent('true')
    })

    fireEvent.press(getByTestId('toggle-personalization'))
    await waitFor(() => expect(getByTestId('personalization')).toHaveTextContent('true'))
    expect(sessionStorage.getItem(PERSONALIZATION_VISIBLE_KEY)).toBeNull()

    fireEvent.press(getByTestId('toggle-personalization'))
    await waitFor(() => expect(getByTestId('personalization')).toHaveTextContent('false'))
    expect(sessionStorage.getItem(PERSONALIZATION_VISIBLE_KEY)).toBe('false')

    fireEvent.press(getByTestId('toggle-weekly'))
    await waitFor(() => expect(getByTestId('weekly')).toHaveTextContent('true'))
    expect(sessionStorage.getItem(WEEKLY_HIGHLIGHTS_VISIBLE_KEY)).toBeNull()
  })

  it('loads native visibility via batched storage call and persists toggles through AsyncStorage', async () => {
    setPlatform('ios')
    mockedGetStorageBatch.mockResolvedValueOnce({
      [PERSONALIZATION_VISIBLE_KEY]: 'false',
      [WEEKLY_HIGHLIGHTS_VISIBLE_KEY]: 'false',
    })

    const setItemMock = AsyncStorage.setItem as jest.Mock
    const removeItemMock = AsyncStorage.removeItem as jest.Mock

    const { getByTestId } = render(<HookTestComponent />)

    await waitFor(() => {
      expect(mockedGetStorageBatch).toHaveBeenCalledWith([
        PERSONALIZATION_VISIBLE_KEY,
        WEEKLY_HIGHLIGHTS_VISIBLE_KEY,
      ])
      expect(getByTestId('personalization')).toHaveTextContent('false')
      expect(getByTestId('weekly')).toHaveTextContent('false')
    })

    fireEvent.press(getByTestId('toggle-personalization'))
    await waitFor(() => expect(removeItemMock).toHaveBeenCalledWith(PERSONALIZATION_VISIBLE_KEY))

    fireEvent.press(getByTestId('toggle-personalization'))
    await waitFor(() => expect(setItemMock).toHaveBeenCalledWith(PERSONALIZATION_VISIBLE_KEY, 'false'))
  })

  it('respects external visibility props without touching persistent storage', async () => {
    setPlatform('web')
    const getItemSpy = jest.spyOn(Storage.prototype, 'getItem')
    const onTogglePersonalization = jest.fn()
    const onToggleWeekly = jest.fn()

    const { getByTestId } = render(
      <HookTestComponent
        externalPersonalizationVisible={false}
        externalWeeklyHighlightsVisible={true}
        onTogglePersonalization={onTogglePersonalization}
        onToggleWeeklyHighlights={onToggleWeekly}
      />
    )

    await waitFor(() => expect(getByTestId('initialized')).toHaveTextContent('true'))

    expect(getByTestId('personalization')).toHaveTextContent('false')
    expect(getByTestId('weekly')).toHaveTextContent('true')
    expect(getItemSpy).not.toHaveBeenCalled()

    fireEvent.press(getByTestId('toggle-personalization'))
    fireEvent.press(getByTestId('toggle-weekly'))

    expect(onTogglePersonalization).toHaveBeenCalledTimes(1)
    expect(onToggleWeekly).toHaveBeenCalledTimes(1)
    expect(getByTestId('personalization')).toHaveTextContent('false')
    expect(getByTestId('weekly')).toHaveTextContent('true')

    getItemSpy.mockRestore()
  })
})
