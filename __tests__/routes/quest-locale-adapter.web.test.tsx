import React from 'react'
import { render } from '@testing-library/react-native'

let mockPathname = '/pl/quests/4/minsk-cmok'
const mockDetail = jest.fn((_props: unknown) => null)
const mockNotFound = jest.fn(() => null)

jest.mock('expo-router', () => ({ usePathname: () => mockPathname }))
jest.mock('@/components/layout/CustomHeader', () => ({ __esModule: true, default: () => null }))
jest.mock('@/app/(tabs)/quests/[city]/[questId]', () => ({
  __esModule: true, default: (props: unknown) => mockDetail(props),
}))
jest.mock('@/app/[...missing].tsx', () => ({ __esModule: true, NotFoundContent: () => mockNotFound() }))

import QuestLocaleRouteScreen from '@/app/[...missing].web'

describe('quest-only web catch-all', () => {
  beforeEach(() => { mockDetail.mockClear(); mockNotFound.mockClear() })

  it.each(['be', 'uk', 'pl', 'en'])('delegates an exact %s prefix with stable city and slug', (locale) => {
    mockPathname = `/${locale}/quests/4/minsk-cmok`
    render(<QuestLocaleRouteScreen />)
    expect(mockDetail).toHaveBeenCalledWith(expect.objectContaining({
      route: { locale, cityId: 4, questSlug: 'minsk-cmok', path: mockPathname },
    }))
    expect(mockNotFound).not.toHaveBeenCalled()
  })

  it.each(['/de/quests/4/minsk-cmok', '/ru/quests/4/minsk-cmok', '/pl/quests/minsk', '/pl/quests/minsk/minsk-cmok', '/pl/travels/example'])('keeps unsupported path %s in the existing not-found screen', (path) => {
    mockPathname = path
    render(<QuestLocaleRouteScreen />)
    expect(mockDetail).not.toHaveBeenCalled()
    expect(mockNotFound).toHaveBeenCalled()
  })
})
