import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import type { Travel } from '@/types/types'

const mockLoadLegacySection = jest.fn()

jest.mock('@/components/travel/details/sections/QuestForCitySection', () => {
  mockLoadLegacySection()
  return { __esModule: true, default: () => <p>Legacy quest cards</p> }
})

it('loads the legacy quest module only when the fallback is rendered', async () => {
  const DeferredSection = require('@/components/travel/details/sections/DeferredQuestForCitySection.web').default
  await Promise.resolve()
  expect(mockLoadLegacySection).not.toHaveBeenCalled()

  const host = document.createElement('div')
  const root = createRoot(host)
  try {
    await act(async () => root.render(<DeferredSection travel={{ id: 42 } as Travel} styles={{}} />))
    expect(mockLoadLegacySection).toHaveBeenCalledTimes(1)
    expect(host.textContent).toBe('Legacy quest cards')
  } finally {
    await act(async () => root.unmount())
  }
})
