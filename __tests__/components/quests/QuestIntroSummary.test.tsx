import React from 'react'
import { render } from '@testing-library/react-native'
import QuestIntroSummary from '@/components/quests/QuestIntroSummary'
import type { QuestRouteGeometryState } from '@/components/quests/useQuestRouteGeometry'

const route = (patch: Partial<QuestRouteGeometryState> = {}): QuestRouteGeometryState => ({
  status: 'ready', source: 'routed', distanceM: 4500, durationS: 2400,
  track: [[27, 53], [27.1, 53.1]], ...patch,
})

describe('quest introduction summary (#3065)', () => {
  it('shows real catalog values and the routed distance before start', async () => {
    const view = await render(<QuestIntroSummary durationMin={90} difficulty="medium" pointsCount={5} routeComplete route={route()} />)
    expect(view.getByTestId('quest-intro-offer').props.children).toBe('Бесплатно · без гида · 5 точек · 1 ч 30 мин')
    expect(view.getByText('Средне')).toBeTruthy()
    expect(view.getByText('4,5 км')).toBeTruthy()
  })

  it('names the points once and leaves out an unknown duration instead of guessing it (#3219)', async () => {
    const view = await render(<QuestIntroSummary pointsCount={9} routeComplete route={route()} />)
    expect(view.getByTestId('quest-intro-offer').props.children).toBe('Бесплатно · без гида · 9 точек')
    expect(view.queryByText('Точки')).toBeNull()
    expect(view.queryByText('9')).toBeNull()
  })

  it('says under the offer that the quest is self-guided, any day, no booking (#3284)', async () => {
    const view = await render(<QuestIntroSummary durationMin={120} pointsCount={7} routeComplete route={route()} />)
    expect(view.getByTestId('quest-intro-self-guided').props.children).toBe('Проходите сами в любой день — без записи и без группы.')
  })

  it('distinguishes loading, absent metadata and an unrouted fallback', async () => {
    const view = await render(<QuestIntroSummary metaLoading pointsCount={2} routeComplete route={route({ status: 'loading', source: 'direct' })} />)
    expect(view.getAllByText('Загрузка…')).toHaveLength(2)
    await view.rerender(<QuestIntroSummary pointsCount={2} routeComplete route={route({ status: 'fallback', source: 'direct' })} />)
    expect(view.getAllByText('Нет данных')).toHaveLength(2)
    expect(view.queryByText('4,5 км')).toBeNull()
  })

  it('does not present a partial route as a complete distance', async () => {
    const view = await render(<QuestIntroSummary pointsCount={3} routeComplete={false} route={route()} />)
    expect(view.queryByText('4,5 км')).toBeNull()
    expect(view.getAllByText('Нет данных')).toHaveLength(2)
  })
})
