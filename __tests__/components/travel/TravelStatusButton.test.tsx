import React from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react-native'

// --- mocks ---

jest.mock('@/context/AuthContext', () => ({
  useAuth: jest.fn(),
}))

jest.mock('@/hooks/useRequireAuth', () => ({
  useRequireAuth: jest.fn(),
}))

jest.mock('@/stores/travelStatusStore', () => ({
  useTravelStatusStore: jest.fn(),
}))

jest.mock('@/utils/toast', () => ({
  showToast: jest.fn(() => Promise.resolve()),
}))

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

  it('показывает поле ввода даты при выборе «Планирую»', () => {
    useAuth.mockReturnValue(makeAuthMock(true, '1'))
    render(<TravelStatusButton {...baseProps} />)

    fireEvent.press(screen.getByRole('button', { name: 'Добавить в план' }))
    fireEvent.press(screen.getByRole('button', { name: 'Планирую' }))

    expect(screen.getByText('Укажите дату поездки')).toBeTruthy()
    expect(screen.getByText('Дата поездки')).toBeTruthy()
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



