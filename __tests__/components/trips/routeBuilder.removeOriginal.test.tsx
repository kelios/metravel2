// #2054: «Удалить оригинал» стирал загруженный трек GPX/KML сразу по нажатию —
// `handleRemoveStoredRouteFile` из `useTripRouteFileBranch` был повешен прямо на
// кнопку. Тест идёт по настоящей цепочке RouteBuilder → файловая ветка →
// TripRouteImportPanel → ConfirmDialog и считает вызовы мутации удаления: DELETE
// уходит только из подтверждения, а синхронный лок #1824 по-прежнему глушит
// повтор в одном тике.
//
// #2069: файлов у поездки ноль или несколько, у каждого своя карточка, и DELETE
// уходит ровно по тому routeId, чью «Удалить» подтвердили.
import React from 'react'
import { act, fireEvent, render, within } from '@testing-library/react-native'

import type { PlannedTripRouteFile } from '@/api/plannedTripRoutes'
import type { PlannedTrip } from '@/api/plannedTrips'
import RouteBuilder from '@/components/trips/planning/RouteBuilder'
import { createQueryWrapper } from '../../helpers/testQueryClient'

const mockOriginalDelete = jest.fn()
let mockDeletePending = false
let mockDeleteVariables: { tripId: number; routeId: number } | undefined = undefined
let mockStoredRouteFiles: PlannedTripRouteFile[] | undefined = undefined

jest.mock('@/api/places', () => ({ fetchPlacesCatalog: jest.fn() }))
jest.mock('@/api/travelsApi', () => ({ fetchTravels: jest.fn() }))

jest.mock('@/hooks/usePlannedTripsApi', () => ({
  useRouteTemplates: () => ({ data: [] }),
  useTripRouteElevation: () => ({ data: undefined }),
  useRefreshTripRouteElevation: () => ({ mutate: jest.fn(), isPending: false }),
  useUpdateTripRoute: () => ({ mutate: jest.fn(), isPending: false }),
  useUpdateTripTransport: () => ({ mutate: jest.fn(), isPending: false }),
  useUpdateTripBikeType: () => ({ mutate: jest.fn(), isPending: false }),
}))

// Один массив на все рендеры: новая ссылка на каждый рендер гоняла бы карту.
const mockNoTrackSegments: Array<Array<[number, number]>> = []
jest.mock('@/hooks/usePlannedTripRouteFile', () => ({
  usePlannedTripRouteFiles: () => ({ data: mockStoredRouteFiles }),
  usePlannedTripOriginalTracks: () => mockNoTrackSegments,
  useUploadPlannedTripRouteFile: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useDeletePlannedTripRouteFile: () => ({
    mutate: mockOriginalDelete,
    isPending: mockDeletePending,
    variables: mockDeleteVariables,
  }),
}))

// В jest анимация скрытия настоящего Paper-диалога (`useNativeDriver: true`) не
// завершается, и закрытое окно остаётся в дереве. Дублёр держит контракт
// ConfirmDialog — `visible`, `onClose`, `onConfirm`, testID кнопок, — а
// содержимое настоящего окна проверяют tripRouteImportPanelOriginal.test.tsx и
// e2e на web.
jest.mock('@/components/ui/ConfirmDialog', () => {
  const { Pressable, Text, View } = require('react-native')
  return function ConfirmDialogStandIn({
    visible,
    onClose,
    onConfirm,
    title,
    message,
    confirmTestID,
    cancelTestID,
  }: {
    visible: boolean
    onClose: () => void
    onConfirm: () => void
    title?: string
    message?: string
    confirmTestID?: string
    cancelTestID?: string
  }) {
    if (!visible) return null
    return (
      <View testID="confirm-dialog">
        <Text>{title}</Text>
        <Text>{message}</Text>
        <Pressable testID={cancelTestID} onPress={onClose} />
        <Pressable testID={confirmTestID} onPress={onConfirm} />
      </View>
    )
  }
})

jest.mock('@/utils/tripAnalytics', () => ({
  trackRouteExported: jest.fn(),
  trackRoutePointAdded: jest.fn(),
}))

jest.mock('@/components/ui/ImageCardMedia', () => {
  return function ImageCardMedia() {
    const { View } = require('react-native')
    return <View />
  }
})

jest.mock('@/components/trips/planning/TripPlanRouteMap', () => {
  return function TripPlanRouteMap() {
    const { View } = require('react-native')
    return <View testID="trip-plan-route-map" />
  }
})

const TRIP_ID = 22

const STORED_ORIGINAL: PlannedTripRouteFile = {
  id: 7,
  original_name: 'Mullerthal_Trail_Routes_1-3.kml',
  ext: 'kml',
  size: 185548,
  created_at: '2026-09-20T08:00:00Z',
  updated_at: '2026-09-20T08:00:00Z',
}

const makeTrip = (): PlannedTrip => ({
  id: TRIP_ID,
  slug: String(TRIP_ID),
  title: 'Муллерталь',
  description: '',
  startDate: '2026-10-03',
  startTime: '09:00',
  transport: 'walk',
  visibility: 'private',
  seatsTotal: 4,
  startPoint: null,
  status: 'planning',
  organizer: { id: 7, name: 'Owner', avatarUrl: null },
  route: [
    { id: 'a', type: 'custom', name: 'Эхтернах', description: null, coordinates: [6.4214, 49.8117], placeId: null },
    { id: 'b', type: 'custom', name: 'Бердорф', description: null, coordinates: [6.3508, 49.8206], placeId: null },
  ],
  routeGeometry: [
    [6.4214, 49.8117],
    [6.3861, 49.8161],
    [6.3508, 49.8206],
  ],
  routeSummary: {
    distanceKm: 7.4,
    durationMin: 110,
    elevationGainM: 0,
    stopsCount: 0,
    provider: 'ors',
  },
  routingState: { provider: 'ors', isOptimal: true, fallbackReason: null, warnings: [] },
  participants: [],
  coverUrl: null,
  region: '',
  publishedToCommunity: false,
  report: null,
  isOwner: true,
  myRsvp: 'going',
  createdAt: '2026-09-20T08:00:00Z',
})

const renderRouteBuilder = () =>
  render(<RouteBuilder trip={makeTrip()} />, { wrapper: createQueryWrapper().Wrapper })

const REMOVE = 'trip-route-import-remove-original'
const CONFIRM = 'trip-route-import-remove-original-confirm'
const CANCEL = 'trip-route-import-remove-original-cancel'

describe('RouteBuilder — удаление оригинала только после подтверждения (#2054)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockDeletePending = false
    mockDeleteVariables = undefined
    mockStoredRouteFiles = [STORED_ORIGINAL]
  })

  it('«Удалить» без подтверждения не отправляет DELETE', () => {
    const { getByTestId } = renderRouteBuilder()

    fireEvent.press(within(getByTestId('trip-route-import-stored-original')).getByTestId(REMOVE))

    expect(within(getByTestId('confirm-dialog')).getByText('Удалить оригинальный файл?')).toBeTruthy()
    expect(mockOriginalDelete).not.toHaveBeenCalled()
  })

  it('«Отмена» не отправляет DELETE и оставляет карточку оригинала', () => {
    const { getByTestId, queryByTestId } = renderRouteBuilder()

    fireEvent.press(getByTestId(REMOVE))
    fireEvent.press(getByTestId(CANCEL))

    expect(mockOriginalDelete).not.toHaveBeenCalled()
    expect(queryByTestId('confirm-dialog')).toBeNull()
    expect(within(getByTestId('trip-route-import-stored-original')).getByTestId(REMOVE)).toBeTruthy()
  })

  it('«Удалить» в подтверждении отправляет ровно один DELETE этого файла', () => {
    const { getByTestId, queryByTestId } = renderRouteBuilder()

    fireEvent.press(getByTestId(REMOVE))
    fireEvent.press(getByTestId(CONFIRM))

    expect(mockOriginalDelete).toHaveBeenCalledTimes(1)
    expect(mockOriginalDelete.mock.calls[0][0]).toEqual({ tripId: TRIP_ID, routeId: STORED_ORIGINAL.id })
    expect(queryByTestId('confirm-dialog')).toBeNull()
  })

  // Окно закрывается только со следующим рендером, поэтому двойное касание
  // «Удалить» в одном тике дважды доходит до файловой ветки — второй DELETE
  // глушит синхронный лок #1824, а не `disabled` кнопки.
  it('двойное подтверждение в одном тике отправляет один DELETE', () => {
    const { getByTestId } = renderRouteBuilder()

    fireEvent.press(getByTestId(REMOVE))
    const confirm = getByTestId(CONFIRM)
    act(() => {
      fireEvent.press(confirm)
      fireEvent.press(confirm)
    })

    expect(mockOriginalDelete).toHaveBeenCalledTimes(1)
  })

  it('отказ удаления показывает ошибку, а повтор снова идёт через подтверждение', () => {
    const { getByTestId } = renderRouteBuilder()

    fireEvent.press(getByTestId(REMOVE))
    fireEvent.press(getByTestId(CONFIRM))
    act(() => {
      mockOriginalDelete.mock.calls[0][1].onError(new Error('500'))
      mockOriginalDelete.mock.calls[0][1].onSettled()
    })

    expect(getByTestId('trip-route-import-upload-error').props.children).toBe(
      'Не удалось удалить оригинальный файл. Попробуйте ещё раз.',
    )

    fireEvent.press(getByTestId(REMOVE))
    expect(mockOriginalDelete).toHaveBeenCalledTimes(1)
    fireEvent.press(getByTestId(CONFIRM))
    expect(mockOriginalDelete).toHaveBeenCalledTimes(2)
  })

  // Подтверждение относится к файлу, который пользователь видел, нажимая
  // «Удалить»: сменился оригинал при открытом окне — окно закрывается, а не
  // удаляет новый файл.
  it('сменившийся при открытом окне оригинал не удаляется подтверждением', () => {
    const wrapper = createQueryWrapper().Wrapper
    const { getByTestId, queryByTestId, rerender } = render(<RouteBuilder trip={makeTrip()} />, {
      wrapper,
    })

    fireEvent.press(getByTestId(REMOVE))
    expect(getByTestId(CONFIRM)).toBeTruthy()

    mockStoredRouteFiles = [{ ...STORED_ORIGINAL, id: 8, original_name: 'Mullerthal_v2.kml' }]
    rerender(<RouteBuilder trip={makeTrip()} />)

    expect(queryByTestId('confirm-dialog')).toBeNull()
    expect(within(getByTestId('trip-route-import-stored-original')).getByText('Mullerthal_v2.kml')).toBeTruthy()
    expect(mockOriginalDelete).not.toHaveBeenCalled()
  })

  // В jest у хоста Pressable нет responder-пропов, и RNTL жмёт даже выключенную
  // кнопку, поэтому занятость проверяется по состоянию кнопки: выключенный
  // Pressable нажатие не пропускает ни на web, ни на устройстве.
  it('пока удаление идёт, «Удалить» занята и выключена', () => {
    mockDeletePending = true
    mockDeleteVariables = { tripId: TRIP_ID, routeId: STORED_ORIGINAL.id }
    const { getByTestId } = renderRouteBuilder()

    expect(getByTestId(REMOVE).props.accessibilityState).toMatchObject({
      disabled: true,
      busy: true,
    })
  })

  describe('#2069: несколько исходных файлов', () => {
    // Как у trip 47 на проде: трёхпетлевой KML и добавленный к нему GPX по дням.
    const LOOPS_KML: PlannedTripRouteFile = STORED_ORIGINAL
    const DAYS_GPX: PlannedTripRouteFile = {
      id: 11,
      original_name: 'Mullerthal_Trail_po_dnyam.gpx',
      ext: 'gpx',
      size: 412000,
      created_at: '2026-09-23T08:00:00Z',
      updated_at: '2026-09-23T08:00:00Z',
    }
    const cardsOf = (screen: ReturnType<typeof renderRouteBuilder>) =>
      screen.getAllByTestId('trip-route-import-stored-original').map((card) => within(card))

    beforeEach(() => {
      mockStoredRouteFiles = [LOOPS_KML, DAYS_GPX]
    })

    it('показывает карточку на каждый файл в порядке бэкенда', () => {
      const screen = renderRouteBuilder()

      const [first, second] = cardsOf(screen)
      expect(cardsOf(screen)).toHaveLength(2)
      expect(first.getByText('Mullerthal_Trail_Routes_1-3.kml')).toBeTruthy()
      expect(second.getByText('Mullerthal_Trail_po_dnyam.gpx')).toBeTruthy()
      expect(first.getByTestId(REMOVE)).toBeTruthy()
      expect(second.getByTestId(REMOVE)).toBeTruthy()
    })

    it('«Удалить» второго файла удаляет именно его, а не первый', () => {
      const screen = renderRouteBuilder()

      fireEvent.press(cardsOf(screen)[1].getByTestId(REMOVE))
      expect(mockOriginalDelete).not.toHaveBeenCalled()
      fireEvent.press(screen.getByTestId(CONFIRM))

      expect(mockOriginalDelete).toHaveBeenCalledTimes(1)
      expect(mockOriginalDelete.mock.calls[0][0]).toEqual({ tripId: TRIP_ID, routeId: DAYS_GPX.id })
    })

    it('пока удаляется один файл, занята только его «Удалить», соседняя выключена', () => {
      mockDeletePending = true
      mockDeleteVariables = { tripId: TRIP_ID, routeId: DAYS_GPX.id }
      const [first, second] = cardsOf(renderRouteBuilder())
      expect(first.getByTestId(REMOVE).props.accessibilityState).toMatchObject({
        disabled: true,
        busy: false,
      })
      expect(second.getByTestId(REMOVE).props.accessibilityState).toMatchObject({
        disabled: true,
        busy: true,
      })
    })
  })
})
