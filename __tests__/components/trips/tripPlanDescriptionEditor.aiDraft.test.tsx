/**
 * #2911: редактор описания поездки показывает «Черновик описания» только с текстом плана
 * и под `EXPO_PUBLIC_AI_ASSISTANT`; вставка варианта заменяет значение поля целиком.
 */
process.env.EXPO_PUBLIC_AI_ASSISTANT = '1'

import React, { useState } from 'react'
import { fireEvent, render, waitFor } from '@testing-library/react-native'

import TripPlanDescriptionEditor from '@/components/trips/planning/TripPlanDescriptionEditor'

jest.mock('@/hooks/useResponsive', () => ({ useResponsive: () => ({ isHydrated: true, isMobile: false }) }))
jest.mock('@/hooks/useSoftKeyboardInset', () => ({ useSoftKeyboardInset: () => ({ contentViewportInset: 0, rootBottomOverlap: 0 }) }))
jest.mock('@/components/trips/planning/TripDescriptionDraftPanel', () => {
  const React = require('react')
  const { Pressable, Text } = require('react-native')
  return {
    __esModule: true,
    default: ({ planText, currentValue, onInsert }: { planText: string; currentValue: string; onInsert: (v: string) => void }) =>
      React.createElement(
        Pressable,
        { testID: 'draft-stub', onPress: () => onInsert('Черновик из плана') },
        React.createElement(Text, { testID: 'draft-stub-plan' }, planText),
        React.createElement(Text, { testID: 'draft-stub-value' }, currentValue),
      ),
  }
})

function Harness({ plan }: { plan: string | null }) {
  const [value, setValue] = useState('')
  return <TripPlanDescriptionEditor value={value} onChangeText={setValue} label="Описание" placeholder="…" aiDraftPlanText={plan} />
}

describe('TripPlanDescriptionEditor: черновик описания (#2911)', () => {
  it('панель получает план и текущее значение; вставка кладёт вариант в поле', async () => {
    const screen = await render(<Harness plan="Точки: Минск → Гродно" />)
    const stub = await screen.findByTestId('draft-stub')
    expect(screen.getByTestId('draft-stub-plan').props.children).toBe('Точки: Минск → Гродно')
    await fireEvent.press(stub)
    await waitFor(() => expect(screen.getByTestId('trip-plan-edit-description').props.value).toBe('Черновик из плана'))
    expect(screen.getByTestId('draft-stub-value').props.children).toBe('Черновик из плана')
  })

  it('без текста плана панели нет', async () => {
    const screen = await render(<Harness plan={null} />)
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(screen.queryByTestId('draft-stub')).toBeNull()
  })
})
