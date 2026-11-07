/**
 * #2897: «Спросить про этот маршрут / квест» — только под `EXPO_PUBLIC_AI_ASSISTANT`,
 * переход через `router.push` на `/assistant?source=<type>:<id>`.
 */
import React from 'react'
import { fireEvent, render } from '@testing-library/react-native'

import AskAssistantButton from '@/components/assistant/AskAssistantButton'

describe('AskAssistantButton', () => {
  const originalFlag = process.env.EXPO_PUBLIC_AI_ASSISTANT
  afterEach(() => {
    process.env.EXPO_PUBLIC_AI_ASSISTANT = originalFlag
    jest.clearAllMocks()
  })

  it('без флага не рендерится', async () => {
    delete process.env.EXPO_PUBLIC_AI_ASSISTANT
    const { toJSON, queryByTestId } = await render(<AskAssistantButton source={{ type: 'travel', id: 816 }} />)
    expect(queryByTestId('ask-assistant-source')).toBeNull()
    expect(toJSON()).toBeNull()
  })

  it('с флагом ведёт в ассистента с источником статьи; у квеста — своя подпись', async () => {
    process.env.EXPO_PUBLIC_AI_ASSISTANT = '1'
    const { router } = jest.requireMock('expo-router')
    const travel = await render(<AskAssistantButton source={{ type: 'travel', id: 816 }} />)
    expect(travel.getByText('Спросить про этот маршрут')).toBeTruthy()
    await fireEvent.press(travel.getByTestId('ask-assistant-source'))
    expect(router.push).toHaveBeenCalledWith('/assistant?source=travel:816')

    const quest = await render(<AskAssistantButton source={{ type: 'quest', id: 12 }} testID="quest-ask" />)
    expect(quest.getByText('Спросить про этот квест')).toBeTruthy()
    await fireEvent.press(quest.getByTestId('quest-ask'))
    expect(router.push).toHaveBeenLastCalledWith('/assistant?source=quest:12')
  })
})
