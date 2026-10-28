import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react-native'

import { ApiError } from '@/api/client'
import type { TripGearItem } from '@/api/plannedTripsGear'
import {
  gearProgress,
  groupGearByCategory,
  nextGearStatus,
} from '@/components/trips/planning/tripGearRules'

const mockUseTripGear = jest.fn()
const mockAdd = jest.fn()
const mockTemplate = jest.fn()
const mockUpdate = jest.fn()
const mockDelete = jest.fn()

const mutationState = (mutate: jest.Mock, overrides: Record<string, unknown> = {}) => ({
  mutate,
  error: null,
  isPending: false,
  isSuccess: false,
  data: undefined,
  ...overrides,
})

let mockAddState = mutationState(mockAdd)
let mockTemplateState = mutationState(mockTemplate)
let mockUpdateState = mutationState(mockUpdate)
let mockDeleteState = mutationState(mockDelete)

jest.mock('@/hooks/useTripGearApi', () => ({
  useTripGear: (...args: unknown[]) => mockUseTripGear(...args),
  useAddTripGearItem: () => mockAddState,
  useApplyTripGearTemplate: () => mockTemplateState,
  useUpdateTripGearItem: () => mockUpdateState,
  useDeleteTripGearItem: () => mockDeleteState,
}))

import TripGearChecklist from '@/components/trips/planning/TripGearChecklist'
import type { PlannedTrip } from '@/api/plannedTrips'

const trip = (overrides: Partial<PlannedTrip> = {}): PlannedTrip =>
  ({ id: 8001, isOwner: true, myRsvp: 'going', ...overrides }) as unknown as PlannedTrip

const item = (overrides: Partial<TripGearItem> = {}): TripGearItem => ({
  id: 1,
  title: 'Паспорт',
  category: 'documents',
  status: 'buy',
  sortOrder: 0,
  ...overrides,
})

const queryState = (overrides: Record<string, unknown> = {}) => ({
  data: undefined,
  error: null,
  isError: false,
  isLoading: false,
  isFetching: false,
  refetch: jest.fn().mockResolvedValue(undefined),
  ...overrides,
})

beforeEach(() => {
  jest.clearAllMocks()
  mockAddState = mutationState(mockAdd)
  mockTemplateState = mutationState(mockTemplate)
  mockUpdateState = mutationState(mockUpdate)
  mockDeleteState = mutationState(mockDelete)
  mockUseTripGear.mockReturnValue(queryState({ data: [] }))
})

describe('правила чеклиста снаряжения (#1839)', () => {
  it('крутит статус по кругу купить → есть → взято', () => {
    expect(nextGearStatus('buy')).toBe('owned')
    expect(nextGearStatus('owned')).toBe('packed')
    expect(nextGearStatus('packed')).toBe('buy')
  })

  it('группирует по категориям в порядке макета и не оставляет пустых групп', () => {
    const groups = groupGearByCategory([
      item({ id: 1, category: 'food' }),
      item({ id: 2, category: 'documents' }),
      item({ id: 3, category: 'food' }),
    ])

    expect(groups.map((group) => group.category)).toEqual(['documents', 'food'])
    expect(groups[1].items.map((entry) => entry.id)).toEqual([1, 3])
  })

  it('считает готовым только «взято»', () => {
    expect(gearProgress([item({ status: 'owned' }), item({ id: 2, status: 'packed' })]))
      .toEqual({ packed: 1, total: 2, complete: false })
    expect(gearProgress([item({ status: 'packed' })]))
      .toEqual({ packed: 1, total: 1, complete: true })
    expect(gearProgress([])).toEqual({ packed: 0, total: 0, complete: false })
  })
})

describe('TripGearChecklist — владелец', () => {
  it('показывает пустое состояние с шаблоном и добавлением', async () => {
    await render(<TripGearChecklist trip={trip()} />)

    expect(screen.getByTestId('trip-gear-empty')).toBeTruthy()
    await fireEvent.press(screen.getByTestId('trip-gear-template'))
    expect(mockTemplate).toHaveBeenCalledWith({ tripId: 8001 })
  })

  it('переключает статус вещи одним тапом по чипу', async () => {
    mockUseTripGear.mockReturnValue(queryState({ data: [item({ id: 7, status: 'owned' })] }))

    await render(<TripGearChecklist trip={trip()} />)
    await fireEvent.press(screen.getByTestId('trip-gear-status-7'))

    expect(mockUpdate).toHaveBeenCalledWith({ tripId: 8001, itemId: 7, status: 'packed' })
  })

  it('добавляет вещь в ту категорию, из заголовка которой открыта форма', async () => {
    mockUseTripGear.mockReturnValue(queryState({ data: [item({ id: 5, category: 'food' })] }))

    await render(<TripGearChecklist trip={trip()} />)
    await fireEvent.press(screen.getByTestId('trip-gear-add-food'))
    await fireEvent.changeText(screen.getByTestId('trip-gear-add-input'), '  Перекус  ')
    await fireEvent.press(screen.getByTestId('trip-gear-add-submit'))

    expect(mockAdd).toHaveBeenCalledWith(
      { tripId: 8001, title: 'Перекус', category: 'food' },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    )
  })

  it('удаляет вещь из списка', async () => {
    mockUseTripGear.mockReturnValue(queryState({ data: [item({ id: 3 })] }))

    await render(<TripGearChecklist trip={trip()} />)
    await fireEvent.press(screen.getByTestId('trip-gear-delete-3'))

    expect(mockDelete).toHaveBeenCalledWith({ tripId: 8001, itemId: 3 })
  })

  it('показывает прогресс, а на полностью собранном списке — «все вещи взяты»', async () => {
    mockUseTripGear.mockReturnValue(
      queryState({ data: [item({ id: 1, status: 'packed' }), item({ id: 2, status: 'buy' })] }),
    )
    const view = await render(<TripGearChecklist trip={trip()} />)
    expect(screen.getByTestId('trip-gear-progress').props.children).toContain('1')

    mockUseTripGear.mockReturnValue(queryState({ data: [item({ id: 1, status: 'packed' })] }))
    await view.rerender(<TripGearChecklist trip={trip()} />)
    expect(screen.getByTestId('trip-gear-progress').props.children).toBe('Все вещи взяты')
  })

  it('сообщает, что повтор шаблона ничего не добавил', async () => {
    mockUseTripGear.mockReturnValue(queryState({ data: [item()] }))
    mockTemplateState = mutationState(mockTemplate, { isSuccess: true, data: [] })

    await render(<TripGearChecklist trip={trip()} />)

    expect(screen.getByTestId('trip-gear-template-nothing-new')).toBeTruthy()
  })
})

describe('TripGearChecklist — доступ и ошибки', () => {
  it('не рендерит блок тому, кто не едет', async () => {
    await render(<TripGearChecklist trip={trip({ isOwner: false, myRsvp: null })} />)

    expect(screen.queryByTestId('trip-gear-checklist')).toBeNull()
    expect(mockUseTripGear).toHaveBeenCalledWith(8001, false)
  })

  it('участнику показывает список без единой кнопки записи', async () => {
    mockUseTripGear.mockReturnValue(queryState({ data: [item({ id: 9 })] }))

    await render(<TripGearChecklist trip={trip({ isOwner: false, myRsvp: 'going' })} />)

    expect(screen.getByTestId('trip-gear-item-9')).toBeTruthy()
    expect(screen.queryByTestId('trip-gear-template')).toBeNull()
    expect(screen.queryByTestId('trip-gear-delete-9')).toBeNull()
    expect(screen.queryByTestId('trip-gear-add-documents')).toBeNull()

    await fireEvent.press(screen.getByTestId('trip-gear-status-9'))
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('предлагает повтор при сорванной загрузке и держит уже загруженные вещи', async () => {
    const refetch = jest.fn().mockResolvedValue(undefined)
    mockUseTripGear.mockReturnValue(
      queryState({
        data: [item({ id: 4 })],
        error: new ApiError(0, 'offline'),
        isError: true,
        refetch,
      }),
    )

    await render(<TripGearChecklist trip={trip()} />)

    expect(screen.getByTestId('trip-gear-item-4')).toBeTruthy()
    expect(screen.getByText('Не удалось загрузить чеклист.')).toBeTruthy()
    await fireEvent.press(screen.getByTestId('trip-gear-retry'))
    expect(refetch).toHaveBeenCalledTimes(1)
  })

  it('на 404 показывает «пока недоступен», а не пустой чеклист без объяснения', async () => {
    mockUseTripGear.mockReturnValue(
      queryState({ data: undefined, error: new ApiError(404, 'no endpoint'), isError: true }),
    )

    await render(<TripGearChecklist trip={trip()} />)

    expect(screen.getByText('Чеклист снаряжения пока недоступен.')).toBeTruthy()
    expect(screen.queryByTestId('trip-gear-retry')).toBeNull()
  })

  it('ошибку записи показывает без кнопки повтора: её чинит тот же тап', async () => {
    mockUseTripGear.mockReturnValue(queryState({ data: [item({ id: 2 })] }))
    mockUpdateState = mutationState(mockUpdate, { error: new ApiError(500, 'boom') })

    await render(<TripGearChecklist trip={trip()} />)

    expect(screen.getByText('Не удалось сохранить изменение.')).toBeTruthy()
    expect(screen.queryByTestId('trip-gear-retry')).toBeNull()
  })
})
