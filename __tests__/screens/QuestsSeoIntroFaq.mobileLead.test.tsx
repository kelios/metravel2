import React from 'react'
import { fireEvent, render } from '@testing-library/react-native'
import QuestsSeoIntroFaq from '@/screens/tabs/QuestsSeoIntroFaq'

// #2781: on a phone the /quests intro took the whole first screen. The lead is
// clamped to three lines with a toggle; the full text stays in the markup.
const mockBreakpoints = { isSmallPhone: false, isPhone: true }
jest.mock('@/hooks/useResponsive', () => ({
  useBreakpoints: () => mockBreakpoints,
}))
jest.mock('expo-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => children,
}))

beforeEach(() => {
  mockBreakpoints.isPhone = true
})

it('clamps the lead on a phone and expands it on demand without dropping the text', async () => {
  const view = await render(<QuestsSeoIntroFaq variant="intro" lead="Длинное описание городских квестов" />)
  const lead = view.getByTestId('quests-seo-lead')
  expect(lead.props.numberOfLines).toBe(3)
  expect(lead.props.children).toBe('Длинное описание городских квестов')

  await fireEvent.press(view.getByTestId('quests-seo-lead-toggle'))
  expect(view.getByTestId('quests-seo-lead').props.numberOfLines).toBeUndefined()
  expect(view.getByText('Свернуть')).toBeTruthy()
})

it('keeps the full lead without a toggle on wider screens', async () => {
  mockBreakpoints.isPhone = false
  const view = await render(<QuestsSeoIntroFaq variant="intro" lead="Длинное описание городских квестов" />)
  expect(view.getByTestId('quests-seo-lead').props.numberOfLines).toBeUndefined()
  expect(view.queryByTestId('quests-seo-lead-toggle')).toBeNull()
})
