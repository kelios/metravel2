import React from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react-native'
import i18n from '@/i18n/instance'
import { translate } from '@/i18n'
import QuestScenarioScreen, { getQuestScenarioIncludes, getQuestScenarioSteps, getQuestScenarioOccasions, getQuestScenarioFaqItems } from '@/screens/tabs/QuestScenarioScreen'
import QuestsSeoIntroFaq, { getQuestFaqItems } from '@/screens/tabs/QuestsSeoIntroFaq'

const mockNavigation = { setOptions: jest.fn() }
const mockStartup = jest.fn()
const mockQuests: never[] = []
jest.mock('expo-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => children,
  useNavigation: () => mockNavigation,
  useIsFocused: () => false,
}))
jest.mock('@/hooks/useQuestsApi', () => ({
  useQuestsList: function useQuestsList() {
    const { useEffect } = require('react') as typeof import('react')
    useEffect(() => { mockStartup() }, [])
    return { quests: mockQuests }
  },
}))
jest.mock('@/components/common/EmailSubscriptionForm', () => () => null)

beforeEach(async () => {
  jest.clearAllMocks()
  await i18n.changeLanguage('ru')
})
afterEach(async () => { await i18n.changeLanguage('ru') })

it('updates actual scenario memo sections and native navigation title without restarting the mounted screen', async () => {
  await render(<QuestScenarioScreen />)
  for (const locale of ['en', 'pl', 'ru'] as const) {
    await act(async () => { await i18n.changeLanguage(locale) })
    expect(screen.getByText(getQuestScenarioIncludes()[0].q)).toBeTruthy()
    expect(screen.getByText(getQuestScenarioSteps()[0].q)).toBeTruthy()
    expect(screen.getByText(getQuestScenarioOccasions()[0])).toBeTruthy()
    expect(screen.getByText(getQuestScenarioFaqItems()[0].q)).toBeTruthy()
    expect(mockNavigation.setOptions).toHaveBeenLastCalledWith({ title: translate('quests:screens.tabs.QuestScenarioScreen.breadcrumb') })
  }
  expect(mockStartup).toHaveBeenCalledTimes(1)
})

it('refreshes the default FAQ local factory while retaining the open accordion item', async () => {
  await render(<QuestsSeoIntroFaq variant="faq" />)
  await fireEvent.press(screen.getByLabelText(getQuestFaqItems()[0].q))
  expect(screen.getByText(getQuestFaqItems()[0].a)).toBeTruthy()
  for (const locale of ['en', 'pl', 'ru'] as const) {
    await act(async () => { await i18n.changeLanguage(locale) })
    expect(screen.getByText(getQuestFaqItems()[0].q)).toBeTruthy()
    expect(screen.getByText(getQuestFaqItems()[0].a)).toBeTruthy()
  }
})
