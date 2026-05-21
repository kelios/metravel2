import React from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react-native'
import { Platform } from 'react-native'

// --- mocks ---

jest.mock('@/context/AuthContext', () => ({
  useAuth: jest.fn(),
}))

jest.mock('@/hooks/useRequireAuth', () => ({
  useRequireAuth: jest.fn(),
}))

jest.mock('@/stores/travelStatusStore', () => ({
  useTravelStatusStore: jest.fn(),
  parseTravelStatusDateParts: jest.fn((value: unknown) => {
    if (typeof value !== 'string') return null
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
    if (!match) return null
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
    return date.getFullYear() === Number(match[1]) &&
      date.getMonth() === Number(match[2]) - 1 &&
      date.getDate() === Number(match[3])
      ? { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) }
      : null
  }),
}))

jest.mock('@/utils/toast', () => ({
  showToast: jest.fn(() => Promise.resolve()),
}))

jest.mock('@/components/calendar/MiniCalendar', () => {
  return function MockMiniCalendar({ onDayPress, selectedDate }: any) {
    const { Pressable, Text, View } = require('react-native')
    return (
      <View testID="planned-date-calendar">
        <Text>Календарь выбора даты</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="15 Июль"
          onPress={() => onDayPress?.('2026-07-15')}
        >
          <Text>15</Text>
        </Pressable>
        {selectedDate ? <Text>{selectedDate}</Text> : null}
      </View>
    )
  }
})

jest.mock('@/styles/globalFocus', () => ({
  globalFocusStyles: { focusable: {} },
}))

const { useAuth } = require('@/context/AuthContext') as { useAuth: jest.Mock }
const { useRequireAuth } = require('@/hooks/useRequireAuth') as { useRequireAuth: jest.Mock }
const { useTravelStatusStore } = require('@/stores/travelStatusStore') as { useTravelStatusStore: jest.Mock }
const { showToast } = require('@/utils/toast') as { showToast: jest.Mock }

import TravelStatusButton from '@/components/travel/TravelStatusButton'

const baseProps = {
  travelId: 42,
  travelTitle: 'Alps Trek',
  travelUrl: '/travels/alps-trek',
  travelImageUrl: 'https://example.com/img.jpg',
  travelCountry: 'Switzerland',
}

const makeStoreMock = (overrides: Record<string, any> = {}) => ({
  getStatus: jest.fn(() => undefined),
  setStatus: jest.fn(() => Promise.resolve()),
  removeStatus: jest.fn(() => Promise.resolve()),
  ...overrides,
})

const makeAuthMock = (isAuthenticated = false, userId: string | null = null) => ({
  isAuthenticated,
  userId,
})

const makeRequireAuthMock = (requireAuth = jest.fn()) => ({
  requireAuth,
})

beforeEach(() => {
  jest.clearAllMocks()
  Platform.OS = 'ios'
  useAuth.mockReturnValue(makeAuthMock())
  useRequireAuth.mockReturnValue(makeRequireAuthMock())
  useTravelStatusStore.mockReturnValue(makeStoreMock())
})

describe('TravelStatusButton — полный режим (default)', () => {
  it('отображает кнопку «Добавить в план» при отсутствии статуса', () => {
    render(<TravelStatusButton {...baseProps} />)
    expect(screen.getByRole('button', { name: 'Добавить в план' })).toBeTruthy()
  })

  it('отображает текущий статус, если он задан', () => {
    useTravelStatusStore.mockReturnValue(
      makeStoreMock({ getStatus: jest.fn(() => ({ status: 'visited', id: 42, addedAt: 100 })) })
    )
    render(<TravelStatusButton {...baseProps} />)
    expect(screen.getByRole('button', { name: 'Был здесь' })).toBeTruthy()
  })

  it('отображает plannedDate рядом с меткой', () => {
    useTravelStatusStore.mockReturnValue(
      makeStoreMock({
        getStatus: jest.fn(() => ({
          status: 'planned',
          plannedDate: '2026-08-15',
          id: 42,
          addedAt: 100,
        })),
      })
    )
    render(<TravelStatusButton {...baseProps} />)
    expect(screen.getByText('· 2026-08-15')).toBeTruthy()
  })

  it('вызывает requireAuth и не открывает модал, если пользователь не авторизован', () => {
    const requireAuth = jest.fn()
    useRequireAuth.mockReturnValue(makeRequireAuthMock(requireAuth))
    useAuth.mockReturnValue(makeAuthMock(false))

    render(<TravelStatusButton {...baseProps} />)
    fireEvent.press(screen.getByRole('button', { name: 'Добавить в план' }))

    expect(requireAuth).toHaveBeenCalledTimes(1)
    // Модал не должен открыться (нет элементов листа опций)
    expect(screen.queryByText('Был здесь')).toBeNull()
  })

  it('открывает модал при нажатии авторизованным пользователем', () => {
    useAuth.mockReturnValue(makeAuthMock(true, '1'))
    render(<TravelStatusButton {...baseProps} />)
    fireEvent.press(screen.getByRole('button', { name: 'Добавить в план' }))
    // Заголовок в модале + текст кнопки — оба содержат «Добавить в план»
    expect(screen.getAllByText('Добавить в план').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Был здесь')).toBeTruthy()
    expect(screen.getByText('Планирую')).toBeTruthy()
    expect(screen.getByText('Хочу поехать')).toBeTruthy()
  })

  it('вызывает setStatus при выборе статуса «Был здесь»', async () => {
    const setStatus = jest.fn(() => Promise.resolve())
    useTravelStatusStore.mockReturnValue(makeStoreMock({ setStatus }))
    useAuth.mockReturnValue(makeAuthMock(true, '1'))

    render(<TravelStatusButton {...baseProps} />)
    fireEvent.press(screen.getByRole('button', { name: 'Добавить в план' }))
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Был здесь' }))
    })

    expect(setStatus).toHaveBeenCalledWith(
      expect.objectContaining({ id: 42, status: 'visited', title: 'Alps Trek' }),
      '1'
    )
    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'success', text1: 'Был здесь' })
    )
  })

  it('показывает календарь при выборе «Планирую»', () => {
    useAuth.mockReturnValue(makeAuthMock(true, '1'))
    render(<TravelStatusButton {...baseProps} />)

    fireEvent.press(screen.getByRole('button', { name: 'Добавить в план' }))
    fireEvent.press(screen.getByRole('button', { name: 'Планирую' }))

    expect(screen.getByText('Укажите дату поездки')).toBeTruthy()
    expect(screen.getByText('Дата поездки')).toBeTruthy()
    expect(screen.getByText('Выберите день в календаре.')).toBeTruthy()
    expect(screen.getByTestId('planned-date-calendar')).toBeTruthy()
    expect(screen.getByText('Дата не выбрана')).toBeTruthy()
  })

  it('на web показывает встроенный календарь без ручного поля ввода даты', () => {
    Platform.OS = 'web'
    useAuth.mockReturnValue(makeAuthMock(true, '1'))
    render(<TravelStatusButton {...baseProps} />)

    fireEvent.press(screen.getByRole('button', { name: 'Добавить в план' }))
    fireEvent.press(screen.getByRole('button', { name: 'Планирую' }))

    expect(screen.getByTestId('planned-date-calendar')).toBeTruthy()
    expect(screen.queryByPlaceholderText('ГГГГ-ММ-ДД')).toBeNull()
    expect(screen.queryByLabelText('Дата поездки')).toBeNull()
  })

  it('сохраняет planned статус с датой, выбранной в календаре', async () => {
    const setStatus = jest.fn(() => Promise.resolve())
    useTravelStatusStore.mockReturnValue(makeStoreMock({ setStatus }))
    useAuth.mockReturnValue(makeAuthMock(true, '1'))
    render(<TravelStatusButton {...baseProps} />)

    fireEvent.press(screen.getByRole('button', { name: 'Добавить в план' }))
    fireEvent.press(screen.getByRole('button', { name: 'Планирую' }))
    fireEvent.press(screen.getByRole('button', { name: '15 Июль' }))
    expect(screen.getByText('Выбрано: 2026-07-15')).toBeTruthy()

    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Сохранить дату' }))
    })

    expect(setStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 42,
        status: 'planned',
        plannedDate: '2026-07-15',
      }),
      '1'
    )
    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'success', text1: 'Добавлено в планы', text2: '2026-07-15' })
    )
  })

  it('показывает ошибку при попытке сохранить пустую дату', async () => {
    useAuth.mockReturnValue(makeAuthMock(true, '1'))
    render(<TravelStatusButton {...baseProps} />)

    fireEvent.press(screen.getByRole('button', { name: 'Добавить в план' }))
    fireEvent.press(screen.getByRole('button', { name: 'Планирую' }))
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Сохранить дату' }))
    })

    expect(screen.getByText('Укажите дату')).toBeTruthy()
  })

  it('показывает кнопку «Убрать из плана», если статус уже задан', () => {
    useTravelStatusStore.mockReturnValue(
      makeStoreMock({ getStatus: jest.fn(() => ({ status: 'wishlist', id: 42, addedAt: 100 })) })
    )
    useAuth.mockReturnValue(makeAuthMock(true, '1'))

    render(<TravelStatusButton {...baseProps} />)
    fireEvent.press(screen.getByRole('button', { name: 'Хочу поехать' }))
    expect(screen.getByRole('button', { name: 'Убрать из плана' })).toBeTruthy()
  })

  it('вызывает removeStatus при нажатии «Убрать из плана»', async () => {
    const removeStatus = jest.fn(() => Promise.resolve())
    useTravelStatusStore.mockReturnValue(
      makeStoreMock({
        getStatus: jest.fn(() => ({ status: 'wishlist', id: 42, addedAt: 100 })),
        removeStatus,
      })
    )
    useAuth.mockReturnValue(makeAuthMock(true, '1'))

    render(<TravelStatusButton {...baseProps} />)
    fireEvent.press(screen.getByRole('button', { name: 'Хочу поехать' }))
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Убрать из плана' }))
    })

    expect(removeStatus).toHaveBeenCalledWith(42, '1')
  })
})

describe('TravelStatusButton — compact режим', () => {
  it('не отображает текстовую метку (только иконка)', () => {
    render(<TravelStatusButton {...baseProps} compact />)
    expect(screen.queryByText('Добавить в план')).toBeNull()
    expect(screen.getByRole('button', { name: 'Добавить в план' })).toBeTruthy()
  })

  it('отображает accessibilityLabel текущего статуса', () => {
    useTravelStatusStore.mockReturnValue(
      makeStoreMock({ getStatus: jest.fn(() => ({ status: 'planned', id: 42, addedAt: 100 })) })
    )
    render(<TravelStatusButton {...baseProps} compact />)
    expect(screen.getByRole('button', { name: 'Планирую' })).toBeTruthy()
  })

  it('вызывает requireAuth при нажатии неавторизованным', () => {
    const requireAuth = jest.fn()
    useRequireAuth.mockReturnValue(makeRequireAuthMock(requireAuth))
    useAuth.mockReturnValue(makeAuthMock(false))

    render(<TravelStatusButton {...baseProps} compact />)
    fireEvent.press(screen.getByRole('button', { name: 'Добавить в план' }))
    expect(requireAuth).toHaveBeenCalledTimes(1)
  })

  it('на web останавливает click-событие, чтобы карточка не открывалась', () => {
    Platform.OS = 'web'
    const requireAuth = jest.fn()
    const event = {
      preventDefault: jest.fn(),
      stopPropagation: jest.fn(),
      nativeEvent: {
        stopPropagation: jest.fn(),
        stopImmediatePropagation: jest.fn(),
      },
    }
    useRequireAuth.mockReturnValue(makeRequireAuthMock(requireAuth))
    useAuth.mockReturnValue(makeAuthMock(false))

    render(<TravelStatusButton {...baseProps} compact />)
    fireEvent(screen.getByLabelText('Добавить в план'), 'click', event)

    expect(event.preventDefault).toHaveBeenCalledTimes(1)
    expect(event.stopPropagation).toHaveBeenCalledTimes(1)
    expect(event.nativeEvent.stopPropagation).toHaveBeenCalledTimes(1)
    expect(event.nativeEvent.stopImmediatePropagation).toHaveBeenCalledTimes(1)
    expect(requireAuth).toHaveBeenCalledTimes(1)
  })

  it('открывает тот же модал у авторизованного пользователя', () => {
    useAuth.mockReturnValue(makeAuthMock(true, '5'))
    render(<TravelStatusButton {...baseProps} compact />)
    fireEvent.press(screen.getByRole('button', { name: 'Добавить в план' }))
    expect(screen.getAllByText('Добавить в план').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Был здесь')).toBeTruthy()
  })

  it('выбор статуса в compact-режиме так же вызывает setStatus', async () => {
    const setStatus = jest.fn(() => Promise.resolve())
    useTravelStatusStore.mockReturnValue(makeStoreMock({ setStatus }))
    useAuth.mockReturnValue(makeAuthMock(true, '5'))

    render(<TravelStatusButton {...baseProps} compact />)
    fireEvent.press(screen.getByRole('button', { name: 'Добавить в план' }))
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Хочу поехать' }))
    })

    expect(setStatus).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'wishlist' }),
      '5'
    )
  })
})
