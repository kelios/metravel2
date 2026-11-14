// #3379 (д): чанк движка поиска не пришёл и после повторов — экран показывает
// существующее состояние ошибки с «Повторить», а не вечный скелетон или
// «ничего не найдено»; в режиме карты — то же, вместо пустой карты.
import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react-native'

jest.mock('@/hooks/useQuestPlayersCount', () => ({ useQuestPlayersCount: () => null }))
jest.mock('@/screens/tabs/QuestsSeoIntroFaq', () => ({ __esModule: true, default: () => null }))

import QuestsContentPanel from '@/screens/tabs/QuestsContentPanel'

const styles = new Proxy({}, { get: () => ({}) })
const baseProps = {
  styles,
  colors: new Proxy({}, { get: () => '#000' }),
  dataLoaded: true,
  viewMode: 'list' as const,
  selectedCityId: '__all__',
  selectedCityName: null,
  nearbyId: '__nearby__',
  searchQuery: 'краков',
  appliedSearchTerm: 'краков',
  onSearchChange: jest.fn(),
  questsAll: [],
  questCardWidth: 300,
  userLoc: null,
  isMapAreaActive: false,
  geoMessage: null,
  geoRequesting: false,
  radiiLg: 12,
  isMobile: false,
  filtersActive: false,
  onResetFilters: jest.fn(),
  onShowNearby: jest.fn(),
  onOpenFilterDrawer: jest.fn(),
  onToggleViewMode: jest.fn(),
}

describe('QuestsContentPanel search engine failure (#3379)', () => {
  it('shows the load error with retry instead of «nothing found»', async () => {
    const retrySearch = jest.fn()
    await render(<QuestsContentPanel {...baseProps} retrySearch={retrySearch} />)

    fireEvent.press(await screen.findByTestId('quest-landing-load-error-retry'))
    expect(retrySearch).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('Ничего не найдено')).toBeNull()
  })

  it('replaces the empty map with the same error in map mode', async () => {
    await render(<QuestsContentPanel {...baseProps} viewMode="map" mapSlot={<></>} retrySearch={jest.fn()} />)
    expect(await screen.findByTestId('quest-landing-load-error')).toBeTruthy()
  })

  it('keeps «nothing found» for a settled empty search', async () => {
    await render(<QuestsContentPanel {...baseProps} />)
    expect(screen.queryByTestId('quest-landing-load-error')).toBeNull()
    expect(await screen.findByText('Ничего не найдено')).toBeTruthy()
  })
})
