// #1491: панель маршрута планировщика идёт той же лесенкой, что и /map —
// «1 Транспорт → 2 Точки маршрута → 3 Итог», — а главное действие называется
// так же и появляется только когда есть что сохранять. Тест держит и структуру,
// и подписи: без него откат к самодельной панели прошёл бы незамеченным.
import React from 'react'
import { act, fireEvent, render, waitFor } from '@testing-library/react-native'

import type { PlannedTrip } from '@/api/plannedTrips'
import RouteBuilder from '@/components/trips/planning/RouteBuilder'
import { createQueryWrapper } from '../../helpers/testQueryClient'

const mockRouteMutate = jest.fn()
const mockOriginalUpload = jest.fn()
const mockOriginalDelete = jest.fn()
// Сохранённый оригинал есть не в каждом сценарии панели, поэтому мок запроса
// файла переключаемый: по умолчанию файла нет, как и было.
let mockStoredRouteFile: { id: number; name: string } | null = null

jest.mock('@/api/places', () => ({ fetchPlacesCatalog: jest.fn() }))
jest.mock('@/api/travelsApi', () => ({ fetchTravels: jest.fn() }))

jest.mock('@/hooks/usePlannedTripsApi', () => ({
  useRouteTemplates: () => ({ data: [] }),
  useTripRouteElevation: () => ({ data: undefined }),
  useRefreshTripRouteElevation: () => ({ mutate: jest.fn(), isPending: false }),
  useUpdateTripRoute: () => ({ mutate: mockRouteMutate, isPending: false }),
  useUpdateTripTransport: () => ({ mutate: jest.fn(), isPending: false }),
  useUpdateTripBikeType: () => ({ mutate: jest.fn(), isPending: false }),
}))

jest.mock('@/hooks/usePlannedTripRouteFile', () => ({
  usePlannedTripRouteFile: () => ({ data: mockStoredRouteFile }),
  usePlannedTripOriginalTrack: () => ({ data: null }),
  useUploadPlannedTripRouteFile: () => ({
    mutateAsync: mockOriginalUpload,
    isPending: false,
  }),
  useDeletePlannedTripRouteFile: () => ({ mutate: mockOriginalDelete, isPending: false }),
}))

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

jest.mock('@/components/trips/planning/TripRoutePreviewEngine', () => {
  return function TripRoutePreviewEngine() {
    const { View } = require('react-native')
    return <View testID="trip-route-preview-engine" />
  }
})

jest.mock('@/components/trips/planning/TripPlanRouteMap', () => {
  return function TripPlanRouteMap() {
    const { View } = require('react-native')
    return <View testID="trip-plan-route-map" />
  }
})

jest.mock('@/components/trips/planning/TripRouteImportPanel', () => {
  return function TripRouteImportPanel({
    route,
    onApply,
    onRemoveStoredFile,
  }: {
    route: PlannedTrip['route']
    onApply: (route: PlannedTrip['route'], upload: {
      kind: 'native'
      uri: string
      name: string
      mimeType: string
    }) => void
    onRemoveStoredFile: () => void
  }) {
    const { Pressable, View } = require('react-native')
    return (
      <View>
        <Pressable
          testID="route-builder-remove-original"
          onPress={onRemoveStoredFile}
        />
        <Pressable
          testID="route-builder-apply-original-only"
          onPress={() => onApply(route, {
            kind: 'native',
            uri: 'file:///cache/import.gpx',
            name: 'import.gpx',
            mimeType: 'application/gpx+xml',
          })}
        />
        <Pressable
          testID="route-builder-apply-imported-route"
          onPress={() => onApply(
            [
              { id: 'imp-1', type: 'custom', name: 'Точка 1', description: null, coordinates: [27.9, 54.4], placeId: null },
              { id: 'imp-2', type: 'custom', name: 'Точка 2', description: null, coordinates: [28.0, 54.5], placeId: null },
              { id: 'imp-3', type: 'custom', name: 'Точка 3', description: null, coordinates: [28.1, 54.6], placeId: null },
            ],
            {
              kind: 'native',
              uri: 'file:///cache/import.gpx',
              name: 'import.gpx',
              mimeType: 'application/gpx+xml',
            },
          )}
        />
      </View>
    )
  }
})

// Адресный поиск /map ходит в Nominatim; здесь проверяется не он, а то, что его
// выбор превращается в точку маршрута.
jest.mock('@/components/MapPage/AddressSearch', () => {
  return function AddressSearch({
    onAddressSelect,
  }: {
    onAddressSelect: (address: string, coords: { lat: number; lng: number }) => void
  }) {
    const { Pressable } = require('react-native')
    return (
      <Pressable
        testID="route-builder-address-pick"
        onPress={() => onAddressSelect('Минск, Беларусь', { lat: 53.9, lng: 27.56 })}
      />
    )
  }
})

const makePoint = (index: number) => ({
  id: `p${index}`,
  type: 'custom' as const,
  name: `Точка ${index + 1}`,
  description: null,
  coordinates: [27.5 + index * 0.02, 53.9 + index * 0.03] as [number, number],
  placeId: null,
})

const makeTrip = (overrides: Partial<PlannedTrip> = {}): PlannedTrip => ({
  id: 42,
  slug: '42',
  title: 'Маршрут',
  description: '',
  startDate: '2026-08-08',
  startTime: '09:00',
  transport: 'car',
  visibility: 'private',
  seatsTotal: 4,
  startPoint: null,
  status: 'planning',
  organizer: { id: 7, name: 'Owner', avatarUrl: null },
  route: [makePoint(0), makePoint(1)],
  routeGeometry: null,
  routeSummary: null,
  routingState: null,
  participants: [],
  coverUrl: null,
  region: '',
  publishedToCommunity: false,
  report: null,
  isOwner: true,
  myRsvp: 'going',
  createdAt: '2026-08-08T08:00:00Z',
  ...overrides,
})

const addPoint = (getByTestId: (id: string) => any, name: string) => {
  fireEvent.press(getByTestId('route-builder-add-action'))
  fireEvent.press(getByTestId('route-builder-type-custom'))
  fireEvent.changeText(getByTestId('route-builder-name'), name)
  fireEvent.press(getByTestId('route-builder-add'))
}


// #1491: шаг «Точки маршрута» рендерит общий AddressSearch с /map, а он ходит за
// адресами через React Query — конструктору нужен клиент, как и в приложении.
const renderRouteBuilder = (element: React.ReactElement) =>
  render(element, { wrapper: createQueryWrapper().Wrapper })

describe('RouteBuilder panel steps', () => {
  beforeEach(() => {
    mockRouteMutate.mockReset()
    mockOriginalUpload.mockReset()
    mockOriginalUpload.mockResolvedValue({ id: 1 })
    mockOriginalDelete.mockReset()
    mockStoredRouteFile = null
  })

  it('строит панель тремя нумерованными шагами, как /map', () => {
    const { getByTestId } = renderRouteBuilder(<RouteBuilder trip={makeTrip()} />)

    const steps = ['transport', 'points', 'summary'].map((key) =>
      getByTestId(`route-builder-step-${key}`),
    )
    expect(steps).toHaveLength(3)

    expect(getByTestId('route-builder-step-transport')).toBeTruthy()
    expect(getByTestId('route-builder-step-points')).toBeTruthy()
    expect(getByTestId('route-builder-step-summary')).toBeTruthy()
  })

  it('разводит панель и карту по колонкам, как на /map', () => {
    const { getByTestId } = renderRouteBuilder(<RouteBuilder trip={makeTrip()} />)

    expect(getByTestId('route-builder-panel-column')).toBeTruthy()
    expect(getByTestId('route-builder-map-column')).toBeTruthy()
  })

  it('прячет кнопку действия, пока маршрут совпадает с сохранённым', () => {
    const { queryByTestId } = renderRouteBuilder(<RouteBuilder trip={makeTrip()} />)

    expect(queryByTestId('route-builder-save')).toBeNull()
  })

  it('на пустом маршруте предлагает построить его после второй точки', () => {
    const { getByTestId, queryByTestId } = renderRouteBuilder(<RouteBuilder trip={makeTrip({ route: [] })} />)

    addPoint(getByTestId, 'Старт')
    // Одна точка: сохранить черновик можно, но строить ещё нечего.
    expect(getByTestId('route-builder-save').props.accessibilityLabel).toBe('Сохранить маршрут')
    expect(getByTestId('route-builder-save-hint').props.children).toBe('Добавьте старт и финиш')

    addPoint(getByTestId, 'Финиш')
    expect(getByTestId('route-builder-save').props.accessibilityLabel).toBe('Построить маршрут')
    expect(queryByTestId('route-builder-save-hint')).toBeNull()
  })

  it('на уже построенном маршруте зовёт пересчитать его', () => {
    const { getByTestId } = renderRouteBuilder(<RouteBuilder trip={makeTrip()} />)

    addPoint(getByTestId, 'Ещё точка')

    expect(getByTestId('route-builder-save').props.accessibilityLabel).toBe('Пересчитать маршрут')
  })

  it('загружает новый оригинал без лишнего PUT, если точки не изменились', async () => {
    const { getByTestId } = renderRouteBuilder(<RouteBuilder trip={makeTrip()} />)

    fireEvent.press(getByTestId('route-builder-apply-original-only'))
    expect(getByTestId('route-builder-save').props.accessibilityLabel).toBe('Сохранить маршрут')
    fireEvent.press(getByTestId('route-builder-save'))

    await waitFor(() => expect(mockOriginalUpload).toHaveBeenCalledWith({
      tripId: 42,
      file: {
        uri: 'file:///cache/import.gpx',
        name: 'import.gpx',
        type: 'application/gpx+xml',
      },
    }))
    expect(mockRouteMutate).not.toHaveBeenCalled()
  })

  // #1824: у ветки «точки не менялись» лока не было вовсе, а `disabled` кнопки
  // держится на `uploadRouteFile.isPending` и поднимается только со следующим
  // рендером. Повтор нажатия в одном тике отправлял второй multipart того же
  // файла, и завершение первой отправки удаляло кэш-копию из-под второй.
  it('повтор нажатия в одном тике не отправляет оригинал дважды', async () => {
    const { getByTestId } = renderRouteBuilder(<RouteBuilder trip={makeTrip()} />)

    fireEvent.press(getByTestId('route-builder-apply-original-only'))
    fireEvent.press(getByTestId('route-builder-save'))
    fireEvent.press(getByTestId('route-builder-save'))

    await waitFor(() => expect(mockOriginalUpload).toHaveBeenCalledTimes(1))
    expect(mockRouteMutate).not.toHaveBeenCalled()
  })

  // Лок отправки оригинала обязан сниматься и по отказу: иначе отказ хранилища
  // запирал бы кнопку до перезагрузки экрана, а обещанный ретрай той же кнопкой
  // молча не уходил бы.
  it('после отказа хранилища ретрай той же кнопкой уходит снова', async () => {
    mockOriginalUpload.mockRejectedValueOnce(new Error('storage down'))
    const { getByTestId } = renderRouteBuilder(<RouteBuilder trip={makeTrip()} />)

    fireEvent.press(getByTestId('route-builder-apply-original-only'))
    fireEvent.press(getByTestId('route-builder-save'))
    // Отказ обработан, лок снят.
    await act(async () => {})
    expect(mockOriginalUpload).toHaveBeenCalledTimes(1)

    fireEvent.press(getByTestId('route-builder-save'))
    await waitFor(() => expect(mockOriginalUpload).toHaveBeenCalledTimes(2))
  })

  // #1824, пункт 3: у удаления оригинала лока тоже не было. `disabled` кнопки
  // держится на `deleteRouteFile.isPending` и поднимается только со следующим
  // рендером, поэтому повтор нажатия в одном тике слал второй DELETE того же
  // файла — второй отвечал 404, и пользователь видел «не удалось удалить» на
  // уже удалённом файле.
  it('повтор нажатия в одном тике не удаляет оригинал дважды', () => {
    mockStoredRouteFile = { id: 5, name: 'import.gpx' }
    const { getByTestId } = renderRouteBuilder(<RouteBuilder trip={makeTrip()} />)

    fireEvent.press(getByTestId('route-builder-remove-original'))
    fireEvent.press(getByTestId('route-builder-remove-original'))

    expect(mockOriginalDelete).toHaveBeenCalledTimes(1)
    expect(mockOriginalDelete.mock.calls[0][0]).toEqual({ tripId: 42, routeId: 5 })
  })

  // Лок удаления снимается и по отказу: иначе неудачное удаление запирало бы
  // кнопку до перезагрузки экрана.
  it('после отказа удаления ретрай той же кнопкой уходит снова', () => {
    mockStoredRouteFile = { id: 5, name: 'import.gpx' }
    const { getByTestId } = renderRouteBuilder(<RouteBuilder trip={makeTrip()} />)

    fireEvent.press(getByTestId('route-builder-remove-original'))
    act(() => {
      mockOriginalDelete.mock.calls[0][1].onError(new Error('500'))
      mockOriginalDelete.mock.calls[0][1].onSettled()
    })

    fireEvent.press(getByTestId('route-builder-remove-original'))
    expect(mockOriginalDelete).toHaveBeenCalledTimes(2)
  })

  // Регресс #1496: у `updateTripRoute.mutate` был только `onSuccess`, поэтому
  // отказ `PUT /route/` (на проде — 400 «title is required for custom route
  // points») ничего не показывал: кнопка гасла, маршрут не сохранялся, и
  // пользователь не получал ни одного признака ошибки.
  it('показывает ошибку, когда сохранение маршрута отклонено сервером', () => {
    const { getByTestId, queryByTestId } = renderRouteBuilder(
      <RouteBuilder trip={makeTrip({ route: [] })} />,
    )

    addPoint(getByTestId, 'Старт')
    addPoint(getByTestId, 'Финиш')
    expect(queryByTestId('route-builder-save-error')).toBeNull()

    fireEvent.press(getByTestId('route-builder-save'))
    expect(mockRouteMutate).toHaveBeenCalledTimes(1)

    act(() => {
      mockRouteMutate.mock.calls[0][1].onError(new Error('400'))
      mockRouteMutate.mock.calls[0][1].onSettled()
    })

    expect(getByTestId('route-builder-save-error').props.children).toBe(
      'Не удалось сохранить маршрут. Проверьте точки и попробуйте ещё раз.',
    )
  })

  it('снимает ошибку сохранения при следующей успешной попытке', () => {
    const { getByTestId, queryByTestId } = renderRouteBuilder(
      <RouteBuilder trip={makeTrip({ route: [] })} />,
    )

    addPoint(getByTestId, 'Старт')
    addPoint(getByTestId, 'Финиш')
    fireEvent.press(getByTestId('route-builder-save'))
    act(() => {
      mockRouteMutate.mock.calls[0][1].onError(new Error('400'))
      mockRouteMutate.mock.calls[0][1].onSettled()
    })
    expect(getByTestId('route-builder-save-error')).toBeTruthy()

    fireEvent.press(getByTestId('route-builder-save'))
    act(() => {
      // Маршрут, отличный от сохранённого у поездки: иначе `cta.visible`
      // становится false, блок кнопки исчезает целиком и проверка проходит
      // вхолостую — не отличая сброс состояния от размонтирования.
      mockRouteMutate.mock.calls[1][1].onSuccess(
        makeTrip({
          route: [
            { id: 'x', type: 'custom', name: 'Старт', description: null, coordinates: [27.1, 53.1], placeId: null },
            { id: 'y', type: 'custom', name: 'Финиш', description: null, coordinates: [27.2, 53.2], placeId: null },
            { id: 'z', type: 'custom', name: 'Ещё', description: null, coordinates: [27.3, 53.3], placeId: null },
          ],
        }),
      )
      mockRouteMutate.mock.calls[1][1].onSettled()
    })

    expect(getByTestId('route-builder-save')).toBeTruthy()
    expect(queryByTestId('route-builder-save-error')).toBeNull()
  })

  // Ошибка относилась к прошлому черновику: импорт, меняющий точки, должен её
  // снимать, иначе она висит оценкой того, чего на экране уже нет. Импорт,
  // который приносит только оригинал и не трогает точки, ошибку сохраняет —
  // отказ по-прежнему относится ровно к тому набору точек, что на экране.
  it('снимает ошибку сохранения, когда импорт заменил точки маршрута', () => {
    const { getByTestId, queryByTestId } = renderRouteBuilder(
      <RouteBuilder trip={makeTrip({ route: [] })} />,
    )

    addPoint(getByTestId, 'Старт')
    addPoint(getByTestId, 'Финиш')
    fireEvent.press(getByTestId('route-builder-save'))
    act(() => {
      mockRouteMutate.mock.calls[0][1].onError(new Error('400'))
      mockRouteMutate.mock.calls[0][1].onSettled()
    })
    expect(getByTestId('route-builder-save-error')).toBeTruthy()

    fireEvent.press(getByTestId('route-builder-apply-imported-route'))

    // Якорь: блок кнопки должен остаться смонтированным, иначе отсутствие
    // ошибки объясняется размонтированием, а не тем, что подпись маршрута
    // разошлась с подписью, на которой отказ случился.
    expect(getByTestId('route-builder-save')).toBeTruthy()
    expect(queryByTestId('route-builder-save-error')).toBeNull()
  })

  // P3 код-ревью гейта: пока сообщение жило в отдельном состоянии, оно пережидало
  // размонтирование блока и возвращалось уже как оценка другого набора точек.
  it('прячет ошибку прошлого сохранения, как только маршрут изменили', () => {
    const { getByTestId, queryByTestId } = renderRouteBuilder(
      <RouteBuilder trip={makeTrip({ route: [] })} />,
    )

    addPoint(getByTestId, 'Старт')
    addPoint(getByTestId, 'Финиш')
    fireEvent.press(getByTestId('route-builder-save'))
    act(() => {
      mockRouteMutate.mock.calls[0][1].onError(new Error('400'))
      mockRouteMutate.mock.calls[0][1].onSettled()
    })
    expect(getByTestId('route-builder-save-error')).toBeTruthy()

    // Маршрут стал другим — ошибка относится уже не к тому, что на экране.
    addPoint(getByTestId, 'Ещё точка')

    expect(getByTestId('route-builder-save')).toBeTruthy()
    expect(queryByTestId('route-builder-save-error')).toBeNull()
  })

  it('добавляет точку после выбора адреса и подтверждения формы', () => {
    const { getByTestId } = renderRouteBuilder(<RouteBuilder trip={makeTrip({ route: [] })} />)

    fireEvent.press(getByTestId('route-builder-add-action'))
    fireEvent.press(getByTestId('route-builder-address-pick'))
    fireEvent.press(getByTestId('route-builder-add'))
    fireEvent.press(getByTestId('route-builder-save'))

    expect(mockRouteMutate).toHaveBeenCalledTimes(1)
    expect(mockRouteMutate.mock.calls[0][0].route[0]).toMatchObject({
      type: 'custom',
      name: 'Минск',
      description: 'Минск, Беларусь',
      coordinates: [27.56, 53.9],
    })
  })
})
