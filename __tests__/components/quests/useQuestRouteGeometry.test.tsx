import { renderHook } from '@testing-library/react-native'

import { useQuestRouteGeometry, type QuestRouteGeometryState } from '@/components/quests/useQuestRouteGeometry'
import * as geometry from '@/components/quests/questRouteGeometry'

it('never exposes the preceding quest route on the first render after points change', async () => {
  const renders: QuestRouteGeometryState[] = []
  const first = [{ lat: 52, lng: 21 }, { lat: 52.1, lng: 21.1 }]
  const second = [{ lat: 53, lng: 27 }, { lat: 53.1, lng: 27.1 }]
  const { rerender } = await renderHook(({ steps }) => {
    const route = useQuestRouteGeometry(steps)
    renders.push(route)
    return route
  }, { initialProps: { steps: first } })

  renders.length = 0
  await rerender({ steps: second })
  expect(renders[0].status).toBe('loading')
  expect(renders[0].track[0]).toEqual([27, 53])
  expect(renders[0].source).toBe('direct')
})

it('does not abort or restart routing when metadata recreates identical points', async () => {
  const previousEnv = process.env.NODE_ENV
  Object.defineProperty(process.env, 'NODE_ENV', { configurable: true, writable: true, value: 'development' })
  const build = jest.spyOn(geometry, 'buildQuestRouteGeometry').mockImplementation(() => new Promise(() => {}))
  try {
    const steps = [{ lat: 52, lng: 21 }, { lat: 52.1, lng: 21.1 }]
    const { rerender, unmount } = await renderHook(({ routeSteps }) => useQuestRouteGeometry(routeSteps), { initialProps: { routeSteps: steps } })
    expect(build).toHaveBeenCalledTimes(1)
    const signal = build.mock.calls[0][1]?.signal
    await rerender({ routeSteps: steps.map((point) => ({ ...point })) })
    expect(build).toHaveBeenCalledTimes(1)
    expect(signal?.aborted).toBe(false)
    unmount()
  } finally {
    build.mockRestore()
    Object.defineProperty(process.env, 'NODE_ENV', { configurable: true, writable: true, value: previousEnv })
  }
})
