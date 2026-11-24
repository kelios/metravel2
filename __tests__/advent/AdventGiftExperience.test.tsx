import { act, fireEvent, render } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'

import AdventDoorSheet from '@/components/advent/AdventDoorSheet'
import AdventGeoTask, { adventGeoDirection } from '@/components/advent/AdventGeoTask'
import AdventRiddleTask, { ADVENT_STEP_CELEBRATE_MS } from '@/components/advent/AdventRiddleTask'
import { resolveAdventWindowCrop } from '@/components/advent/AdventWindowCrop'
import type { AdventDoorView } from '@/hooks/useAdventCampaign'
import { i18n } from '@/i18n'
import { getAdventCampaign } from '@/services/advent/loadCampaign'
import { drawAdventCard } from '@/utils/advent/adventShareImage'

// Дверца как подарок (#3482): регрессии обхода «подарок или форма».

jest.mock('@/hooks/useReduceMotion', () => ({
  ...jest.requireActual('@/hooks/useReduceMotion'),
  useReduceMotion: () => false,
}))
jest.mock('@/utils/analytics', () => ({ sendAnalyticsEvent: jest.fn(), queueAnalyticsEvent: jest.fn() }))
jest.mock('@/components/ui/BottomSheet', () => {
  const React = require('react')
  const { View, Text } = require('react-native')
  return ({ visible, title, children }: { visible: boolean; title: string; children: React.ReactNode }) =>
    visible
      ? React.createElement(View, { testID: 'sheet' }, React.createElement(Text, { testID: 'sheet-title' }, title), children)
      : null
})
const mockMapProps = jest.fn()
jest.mock('@/components/UserPoints/UserPointsMap', () => {
  const React = require('react')
  const { View } = require('react-native')
  const Map = (props: Record<string, unknown>) => {
    mockMapProps(props)
    return React.createElement(View, { testID: 'geo-map' })
  }
  return { __esModule: true, default: Map, UserPointsMap: Map }
})

const campaign = getAdventCampaign()
const doorOf = (day: number, extra: Partial<AdventDoorView> = {}): AdventDoorView => {
  const door = campaign.doors.find((item) => item.day === day)
  if (!door) throw new Error(`door ${day} missing`)
  return { ...door, state: 'opened', openedAt: door.date, ...extra }
}

beforeEach(async () => {
  mockMapProps.mockClear()
  await i18n.changeLanguage('ru')
})
afterEach(() => jest.useRealTimers())

describe('riddle responses (#3482)', () => {
  const riddle = doorOf(3).task.riddle!.questions

  it('B1: the answer field can shrink, so «Проверить» never leaves the block on 320–390 px', async () => {
    const view = await render(<AdventRiddleTask questions={riddle} onComplete={jest.fn()} />)
    const input = StyleSheet.flatten(view.getByTestId('advent-riddle-input').props.style)
    expect(input.flex).toBe(1)
    expect(input.minWidth).toBe(0)
    const check = StyleSheet.flatten(view.getByTestId('advent-riddle-check').props.style)
    expect(check.flexShrink).toBe(0)
  })

  it('B8: an empty answer is not checked and does not reveal the hint', async () => {
    const onComplete = jest.fn()
    const view = await render(<AdventRiddleTask questions={riddle} onComplete={onComplete} />)
    expect(view.getByTestId('advent-riddle-check').props.accessibilityState.disabled).toBe(true)
    await fireEvent.changeText(view.getByTestId('advent-riddle-input'), '   ')
    await fireEvent(view.getByTestId('advent-riddle-input'), 'submitEditing')
    expect(view.queryByTestId('advent-riddle-wrong')).toBeNull()
    expect(onComplete).not.toHaveBeenCalled()
  })

  it('B7: a soft miss, with the hint on its own line', async () => {
    const view = await render(<AdventRiddleTask questions={riddle} onComplete={jest.fn()} />)
    await fireEvent.changeText(view.getByTestId('advent-riddle-input'), 'минск')
    await fireEvent.press(view.getByTestId('advent-riddle-check'))
    expect(view.getByText('Почти! Попробуйте ещё раз.')).toBeTruthy()
    expect(view.getByTestId('advent-riddle-hint').props.children).toBe('Подсказка: Минская область, рядом с Миром.')
  })

  it('B2: the final correct answer stays on screen with the answer and XP', async () => {
    const onComplete = jest.fn()
    const view = await render(<AdventRiddleTask questions={riddle} xp={15} onComplete={onComplete} />)
    await fireEvent.changeText(view.getByTestId('advent-riddle-input'), 'несвиж')
    await fireEvent.press(view.getByTestId('advent-riddle-check'))
    expect(onComplete).toHaveBeenCalledTimes(1)
    expect(view.getByText('Несвиж — точно! Дверца засияла')).toBeTruthy()
    expect(view.getByTestId('advent-riddle-correct-xp')).toBeTruthy()
  })

  it('B2: an intermediate «Верно!» is visible for at least 800 ms before the next question', async () => {
    const quiz = doorOf(6).task.riddle!.questions
    const view = await render(<AdventRiddleTask questions={quiz} onComplete={jest.fn()} />)
    jest.useFakeTimers()
    await fireEvent.press(view.getByTestId('advent-riddle-option-7'))
    expect(view.getByTestId('advent-riddle-step-correct')).toBeTruthy()
    expect(ADVENT_STEP_CELEBRATE_MS).toBeGreaterThanOrEqual(800)
    await act(async () => {
      jest.advanceTimersByTime(799)
    })
    expect(view.getByTestId('advent-riddle-step-correct')).toBeTruthy()
    expect(view.getByText('Вопрос 1 из 3')).toBeTruthy()
    await act(async () => {
      jest.advanceTimersByTime(ADVENT_STEP_CELEBRATE_MS)
    })
    expect(view.queryByTestId('advent-riddle-step-correct')).toBeNull()
    expect(view.getByText('Вопрос 2 из 3')).toBeTruthy()
    await act(async () => {
      jest.runOnlyPendingTimers()
    })
    jest.useRealTimers()
  })

  it('marks a wrong quiz option instead of a bare error', async () => {
    const quiz = doorOf(6).task.riddle!.questions
    const view = await render(<AdventRiddleTask questions={quiz} onComplete={jest.fn()} />)
    await fireEvent.press(view.getByTestId('advent-riddle-option-14'))
    expect(view.getByText('Не этот — но вы близко.')).toBeTruthy()
  })
})

describe('geo task (#3482)', () => {
  const geo = doorOf(9).task.geo!

  it('B3: opens on the task view (mapZoom) without the «my location» marker', async () => {
    const view = await render(<AdventGeoTask target={geo} onComplete={jest.fn()} />)
    await view.findByTestId('geo-map')
    const props = mockMapProps.mock.calls.at(-1)?.[0] as Record<string, unknown>
    expect(props.initialView).toEqual({ lat: geo.mapCenter!.lat, lng: geo.mapCenter!.lng, zoom: geo.mapZoom })
    // `center` у карты «Моих точек» — геопозиция: с ним рисуется «Моё местоположение» и зум ≥ 12.
    expect(props.center).toBeUndefined()
  })

  it('a miss points the direction; a hit celebrates and keeps the map', async () => {
    const onComplete = jest.fn()
    const view = await render(<AdventGeoTask target={geo} xp={15} onComplete={onComplete} />)
    await view.findByTestId('geo-map')
    const press = (mockMapProps.mock.calls.at(-1)?.[0] as { onMapPress: (c: { lat: number; lng: number }) => void }).onMapPress
    // Мирский замок — к юго-западу от Минска: игроку подсказываем направление.
    await act(async () => press({ lat: 53.9, lng: 27.56 }))
    expect(view.getByTestId('advent-geo-result').props.children).toMatch(/^Тепло, но не совсем: до цели около \d+ км\. Попробуйте юго-западнее\.$/)
    expect(onComplete).not.toHaveBeenCalled()
    await act(async () => press({ lat: geo.lat, lng: geo.lng }))
    expect(onComplete).toHaveBeenCalledTimes(1)
    expect(view.getByText('В точку! Дверца засияла')).toBeTruthy()
    expect(view.getByTestId('geo-map')).toBeTruthy()
  })

  it('names eight compass directions', () => {
    const from = { lat: 53, lng: 27 }
    expect(adventGeoDirection(from, { lat: 54, lng: 27 })).toBe('n')
    expect(adventGeoDirection(from, { lat: 52, lng: 27 })).toBe('s')
    expect(adventGeoDirection(from, { lat: 53, lng: 26 })).toBe('w')
    expect(adventGeoDirection(from, { lat: 54, lng: 28.6 })).toBe('ne')
  })
})

describe('door sheet as a gift (#3482)', () => {
  const renderSheet = (door: AdventDoorView, isAuthenticated = true) =>
    render(
      <AdventDoorSheet
        door={door}
        isAuthenticated={isAuthenticated}
        campaignYear={2026}
        onClose={jest.fn()}
        onCompleteTask={jest.fn()}
      />,
    )

  it('opens with the room of the facade, a warm title and a reward tag', async () => {
    const view = await renderSheet(doorOf(3))
    expect(view.getByTestId('sheet-title').props.children).toBe('3 декабря · ваш подарок')
    expect(view.getByTestId('advent-sheet-room', { includeHiddenElements: true })).toBeTruthy()
    expect(view.getByText('Маленькое задание на сегодня')).toBeTruthy()
    expect(view.getByText('+15 XP')).toBeTruthy()
    expect(view.getByTestId('advent-reward-state').props.children).toBe('Ждёт вас')
    expect(view.queryByText('ПОДАРОК')).toBeNull()
  })

  it('B5: door 25 gives a real postcard with «Поделиться открыткой», and no task contradiction', async () => {
    const view = await renderSheet(doorOf(25, { state: 'done', doneAt: '2026-12-25' }))
    expect(await view.findByTestId('advent-postcard')).toBeTruthy()
    expect(view.getByText('Поделиться открыткой')).toBeTruthy()
    expect(view.queryByTestId('advent-task-section')).toBeNull()
    expect(view.queryByText(/задание засчитано/i)).toBeNull()
  })

  it('invites a guest warmly to make the gift count', async () => {
    const view = await renderSheet(doorOf(3), false)
    expect(view.getByText('Хотите, чтобы этот подарок засчитался?')).toBeTruthy()
    expect(view.getByTestId('advent-guest-login')).toBeTruthy()
  })
})

describe('facade crop (#3482)', () => {
  it('frames the window of the day inside the 2:3 facade', () => {
    // Окно 1 — левый верхний угол фасада: область прижата к краю, не уходит за него.
    const first = resolveAdventWindowCrop(1, 16 / 9)
    expect(first.left).toBe('0%')
    const last = resolveAdventWindowCrop(24, 16 / 9)
    const width = parseFloat(last.width)
    const left = parseFloat(last.left)
    // Правый край области не дальше правого края картинки.
    expect(width + left).toBeGreaterThanOrEqual(100 - 0.01)
    expect(resolveAdventWindowCrop(null, 4 / 3).top).toBe('0%')
  })
})

describe('share image house (#3482)', () => {
  it('draws the night house with lit windows when the spec asks for it', () => {
    const fillRect = jest.fn()
    const ctx = {
      fillStyle: '',
      font: '',
      textBaseline: 'top',
      textAlign: 'left',
      createLinearGradient: () => ({ addColorStop: jest.fn() }),
      fillRect,
      beginPath: jest.fn(),
      moveTo: jest.fn(),
      lineTo: jest.fn(),
      closePath: jest.fn(),
      arc: jest.fn(),
      fill: jest.fn(),
      rect: jest.fn(),
      fillText: jest.fn(),
      measureText: (text: string) => ({ width: text.length * 20 }),
    }
    const canvas = { width: 0, height: 0, getContext: () => ctx } as unknown as HTMLCanvasElement
    const before = fillRect.mock.calls.length
    expect(drawAdventCard(canvas, { eyebrow: 'Адвент', title: 'С Рождеством!', stats: [], house: { lit: 24 } })).toBe(true)
    // Фон, лента, труба, стена и 24 окна.
    expect(fillRect.mock.calls.length - before).toBeGreaterThanOrEqual(24 + 3)
  })
})
