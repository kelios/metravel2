import { fireEvent, render, waitFor } from '@testing-library/react-native'
import { Platform, Text } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'

import QuestPublicPageFrame from '@/components/quests/QuestPublicPageFrame'
import { STORAGE_PENDING_CATALOG_SELECTION } from '@/utils/questCatalogSelection'

const mockPush = jest.fn()
const originalPlatform = Platform.OS
let mockWidth = 390
const mockQuests = [{ id: 'minsk', cityId: '4', cityName: 'Минск', countryCode: 'BY', title: 'Minsk', points: 8 }]

jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }))
jest.mock('@/hooks/useQuestsApi', () => ({ useQuestsList: () => ({ quests: mockQuests }) }))
jest.mock('@/hooks/useResponsive', () => ({ useBreakpoints: () => ({ width: mockWidth, isMobile: mockWidth < 768 }) }))
jest.mock('@expo/vector-icons/Feather', () => () => null)
jest.mock('@/screens/tabs/useQuestPersonalSlices', () => ({
  useQuestPersonalSlices: () => ({ counts: {}, showCompletedFilter: false, showCompletedByOthersFilter: false, showUncompletedFilter: false }),
}))
jest.mock('@/screens/tabs/QuestsSidebar', () => {
  const { Pressable, Text, View } = require('react-native')
  return { __esModule: true, default: ({ onSelectCity, onSetViewMode, onCloseDrawer, onToggleCountryGroup, collapsedCountryCodes, testID }: {
    onSelectCity: (id: string) => void
    onSetViewMode: (mode: string) => void
    onCloseDrawer?: () => void
    onToggleCountryGroup: (code: string) => void
    collapsedCountryCodes: Record<string, boolean>
    testID?: string
  }) => <View testID={testID || 'public-drawer-content'}>
    {onCloseDrawer ? <Pressable accessibilityLabel="Close navigation" onPress={onCloseDrawer}><Text>Close navigation</Text></Pressable> : null}
    <Pressable accessibilityLabel="Toggle Belarus" onPress={() => onToggleCountryGroup('BY')}>
      <Text>{collapsedCountryCodes.BY ? 'Belarus collapsed' : 'Belarus expanded'}</Text>
    </Pressable>
    <Pressable onPress={() => onSelectCity('4')}><Text>Choose Minsk</Text></Pressable>
    <Pressable onPress={() => onSelectCity('__kids__')}><Text>Choose children</Text></Pressable>
    <Pressable onPress={() => onSetViewMode('map')}><Text>Choose map</Text></Pressable>
  </View> }
})

beforeEach(async () => {
  Platform.OS = 'web'
  mockWidth = 390
  jest.clearAllMocks()
  await AsyncStorage.clear()
})

afterEach(() => { Platform.OS = originalPlatform })

it('keeps narrative content and sends a mobile city choice to its catalog', async () => {
  const { getByLabelText, getByText, queryByTestId } = await render(
    <QuestPublicPageFrame><Text>Scenario content</Text></QuestPublicPageFrame>,
  )
  expect(getByText('Scenario content')).toBeTruthy()
  await fireEvent.press(getByLabelText('Выбрать город'))
  await waitFor(() => expect(getByText('Choose Minsk')).toBeTruthy())
  await fireEvent.press(getByText('Choose Minsk'))
  await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/quests/minsk'))
  expect(queryByTestId('quests-sidebar-overlay')).toBeNull()
})

it('hands non-city selection to the existing catalog rather than filtering the narrative', async () => {
  const { getByLabelText, getByText } = await render(<QuestPublicPageFrame><Text>Scenario content</Text></QuestPublicPageFrame>)
  await fireEvent.press(getByLabelText('Выбрать город'))
  await waitFor(() => expect(getByText('Choose children')).toBeTruthy())
  await fireEvent.press(getByText('Choose children'))
  await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/quests'))
  expect(await AsyncStorage.getItem(STORAGE_PENDING_CATALOG_SELECTION)).toBe('__kids__')
  expect(getByText('Scenario content')).toBeTruthy()
})

it('uses the same sidebar on desktop and opens the quest map', async () => {
  mockWidth = 1440
  const { getByText, getByTestId, queryByLabelText } = await render(<QuestPublicPageFrame><Text>Country content</Text></QuestPublicPageFrame>)
  await waitFor(() => expect(getByTestId('quests-desktop-sidebar')).toBeTruthy())
  expect(queryByLabelText('Close navigation')).toBeNull()
  await fireEvent.press(getByText('Choose map'))
  expect(mockPush).toHaveBeenCalledWith('/quests/map')
})

it('keeps expanded countries through closing, reopening and changing between mobile and desktop', async () => {
  const page = () => <QuestPublicPageFrame><Text>Scenario content</Text></QuestPublicPageFrame>
  const { getByLabelText, getByText, queryByLabelText, queryByTestId, rerender } = await render(page())
  await fireEvent.press(getByLabelText('Выбрать город'))
  await waitFor(() => expect(getByText('Belarus collapsed')).toBeTruthy())
  await fireEvent.press(getByLabelText('Toggle Belarus'))
  expect(getByText('Belarus expanded')).toBeTruthy()

  await fireEvent.press(getByLabelText('Close navigation'))
  expect(queryByTestId('quests-sidebar-overlay')).toBeNull()
  await fireEvent.press(getByLabelText('Выбрать город'))
  expect(getByText('Belarus expanded')).toBeTruthy()
  await fireEvent.press(getByLabelText('Close navigation'))

  mockWidth = 1440
  await rerender(page())
  expect(getByText('Belarus expanded')).toBeTruthy()
  expect(queryByLabelText('Close navigation')).toBeNull()

  mockWidth = 390
  await rerender(page())
  await fireEvent.press(getByLabelText('Выбрать город'))
  expect(getByText('Belarus expanded')).toBeTruthy()
  expect(getByLabelText('Close navigation')).toBeTruthy()
  expect(getByText('Scenario content')).toBeTruthy()
})
