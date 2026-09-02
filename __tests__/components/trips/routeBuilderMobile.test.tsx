// #1691: мобильная вкладка «Маршрут» — карта блоком в потоке страницы, панель
// маршрута обычным контентом под ней. Тест держит три инварианта редизайна,
// каждый из которых был измеренным дефектом шторки на 390×844:
//   1. панель не заводит собственный скролл (шторка показывала 23px контента
//      из 2269px в свёрнутом положении и 506px в развёрнутом);
//   2. «Добавить точку» лежит внутри секции списка, а не за импортом и
//      экспортом в конце панели (~2000px прокрутки);
//   3. правка точки открывается внутри карточки своей точки, а не в конце
//      дерева, куда шторку подбрасывало вместе со скроллом.
import React from 'react'
import { fireEvent, render, within } from '@testing-library/react-native'

import type { PlannedTrip } from '@/api/plannedTrips'
import RouteBuilder from '@/components/trips/planning/RouteBuilder'
import { createQueryWrapper } from '../../helpers/testQueryClient'

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

jest.mock('@/hooks/usePlannedTripRouteFile', () => ({
  usePlannedTripRouteFile: () => ({ data: null }),
  usePlannedTripOriginalTrack: () => ({ data: null }),
  useUploadPlannedTripRouteFile: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useDeletePlannedTripRouteFile: () => ({ mutate: jest.fn(), isPending: false }),
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

// Карта заглушена, но отдаёт наружу то, чем управляет раскладка: растянута ли
// она на сцену (`fill`) и какую точку её попросили показать (`focusPoint`).
jest.mock('@/components/trips/planning/TripPlanRouteMap', () => {
  return function TripPlanRouteMap({
    fill,
    focusPoint,
    onAddPointFromMap,
  }: {
    fill?: boolean
    focusPoint?: { lat: number; lng: number; token: number } | null
    onAddPointFromMap?: (coords: { lat: number; lng: number }) => void
  }) {
    const { Pressable, Text, View } = require('react-native')
    return (
      <View testID="trip-plan-route-map">
        <Text testID="route-map-fill">{String(!!fill)}</Text>
        <Text testID="route-map-focus">
          {focusPoint ? `${focusPoint.lat},${focusPoint.lng}` : 'none'}
        </Text>
        <Pressable
          testID="route-map-click"
          onPress={() => onAddPointFromMap?.({ lat: 53.95, lng: 27.61 })}
        />
      </View>
    )
  }
})

jest.mock('@/components/trips/planning/TripRouteImportPanel', () => {
  return function TripRouteImportPanel() {
    const { View } = require('react-native')
    return <View testID="trip-route-import-panel" />
  }
})

jest.mock('@/components/MapPage/AddressSearch', () => {
  return function AddressSearch() {
    const { View } = require('react-native')
    return <View testID="route-builder-address-search" />
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
  route: [makePoint(0), makePoint(1), makePoint(2)],
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

const renderMobile = () =>
  render(<RouteBuilder trip={makeTrip()} layout="mapFirst" />, {
    wrapper: createQueryWrapper().Wrapper,
  })

describe('RouteBuilder — мобильная раскладка вкладки «Маршрут»', () => {
  it('раскладывает карту и панель одним потоком, без шторки со своим скроллом', () => {
    const { getByTestId, queryByTestId } = renderMobile()

    expect(getByTestId('route-mobile-map')).toBeTruthy()
    expect(getByTestId('route-mobile-summary')).toBeTruthy()
    // Шторка и её внутренний скролл — источник трёх вложенных скроллов.
    expect(queryByTestId('route-sheet')).toBeNull()
    expect(queryByTestId('route-sheet-scroll')).toBeNull()
    expect(queryByTestId('route-sheet-handle')).toBeNull()
    // Список точек тоже не заводит своего скролла: страница одна.
    expect(queryByTestId('route-builder-point-list-scroll')).toBeNull()
  })

  it('держит «Добавить точку» внутри секции списка точек', () => {
    const { getByTestId } = renderMobile()

    const pointsStep = getByTestId('route-builder-step-points')
    expect(within(pointsStep).getByTestId('route-builder-add-action')).toBeTruthy()
  })

  it('открывает форму добавления вместе с адресным поиском в одном месте', () => {
    const { getByTestId } = renderMobile()

    fireEvent.press(getByTestId('route-builder-add-action'))

    const addForm = getByTestId('route-builder-add-form')
    expect(within(addForm).getByTestId('route-builder-address-search')).toBeTruthy()
  })

  it('раскрывает правку точки внутри её же карточки', () => {
    const { getByTestId, queryByTestId } = renderMobile()

    expect(queryByTestId('route-builder-edit-form')).toBeNull()

    fireEvent.press(getByTestId('route-builder-edit-1'))

    const card = getByTestId('route-builder-point-1')
    expect(within(card).getByTestId('route-builder-edit-form')).toBeTruthy()
    // Соседние точки остаются на месте: контекст маршрута не теряется.
    expect(getByTestId('route-builder-point-0')).toBeTruthy()
    expect(getByTestId('route-builder-point-2')).toBeTruthy()
  })

  it('сворачивает открытый редактор той же кнопкой, а не пересобирает форму', () => {
    const { getByTestId, queryByTestId } = renderMobile()

    fireEvent.press(getByTestId('route-builder-edit-1'))
    fireEvent.changeText(getByTestId('route-builder-edit-name'), 'Переименованная точка')
    expect(getByTestId('route-builder-edit-name').props.value).toBe('Переименованная точка')

    // Кнопка со стрелкой вверх обещает «свернуть» — она и сворачивает. Раньше
    // она звала ту же `onEdit`: форма пересобиралась из сохранённой точки, ввод
    // молча пропадал, а редактор оставался открытым.
    fireEvent.press(getByTestId('route-builder-edit-1'))
    expect(queryByTestId('route-builder-edit-form')).toBeNull()
  })

  it('тапом по телу строки с открытым редактором не сбрасывает введённое', () => {
    const { getByTestId } = renderMobile()

    fireEvent.press(getByTestId('route-builder-edit-1'))
    fireEvent.changeText(getByTestId('route-builder-edit-name'), 'Черновик названия')
    fireEvent.press(getByTestId('route-builder-focus-1'))

    expect(getByTestId('route-builder-edit-name').props.value).toBe('Черновик названия')
  })

  it('открывает ту же правку тапом по телу строки', () => {
    const { getByTestId } = renderMobile()

    fireEvent.press(getByTestId('route-builder-focus-2'))

    expect(within(getByTestId('route-builder-point-2')).getByTestId('route-builder-edit-form')).toBeTruthy()
  })

  it('убирает перестановку и удаление из свёрнутой строки и отдаёт их редактору', () => {
    const { getByTestId, queryByTestId } = renderMobile()

    // Четыре иконки по 44dp съедали ширину названия точки — в свёрнутой строке
    // остаётся только вход в правку.
    expect(queryByTestId('route-builder-move-up-1')).toBeNull()
    expect(queryByTestId('route-builder-move-down-1')).toBeNull()
    expect(queryByTestId('route-builder-delete-1')).toBeNull()

    fireEvent.press(getByTestId('route-builder-edit-1'))

    const card = getByTestId('route-builder-point-1')
    expect(within(card).getByTestId('route-builder-move-up-1')).toBeTruthy()
    expect(within(card).getByTestId('route-builder-move-down-1')).toBeTruthy()
    expect(within(card).getByTestId('route-builder-delete-1')).toBeTruthy()
  })

  it('оставляет desktop-раскладку с полным набором кнопок в строке', () => {
    const { getByTestId, queryByTestId } = render(
      <RouteBuilder trip={makeTrip()} />,
      { wrapper: createQueryWrapper().Wrapper },
    )

    expect(getByTestId('route-builder-move-up-1')).toBeTruthy()
    expect(getByTestId('route-builder-delete-1')).toBeTruthy()

    fireEvent.press(getByTestId('route-builder-edit-1'))
    // На desktop форма остаётся отдельной секцией колонки, а не внутри строки.
    expect(queryByTestId('route-builder-edit-form')).toBeTruthy()
    expect(
      within(getByTestId('route-builder-point-1')).queryByTestId('route-builder-edit-form'),
    ).toBeNull()
  })
})

// #1495/#1691: раскладку `mapFirst` собирает уже не шторка, а RouteBuilderMobile —
// карта блоком в потоке страницы. Выше держится контракт самой раскладки, здесь —
// связка «карта ↔ панель»: чем карту растянули, куда сфокусировали и доводит ли
// тап по ней новую точку до формы правки.
describe('RouteBuilder layout=mapFirst — связка карты и панели', () => {
  it('растягивает карту и держит панель обычным контентом под ней', () => {
    const { getByTestId, queryByTestId } = renderMobile()

    expect(getByTestId('route-map-fill').props.children).toBe('true')
    expect(getByTestId('route-mobile-map')).toBeTruthy()
    // Транспорт, точки и добавление доехали до панели целиком.
    expect(getByTestId('route-builder-transport-control')).toBeTruthy()
    expect(getByTestId('route-builder-point-0')).toBeTruthy()
    // Добавление раскрывается по запросу: длинная форма не вытесняет точки и
    // итог, пока пользователь не выбрал это действие.
    expect(getByTestId('route-builder-add-action')).toBeTruthy()
    expect(queryByTestId('route-builder-add-form')).toBeNull()
    expect(queryByTestId('route-builder-site-search')).toBeNull()

    fireEvent.press(getByTestId('route-builder-add-action'))

    // Первый тип — «место», поэтому раскрытая add-форма показывает поиск, а не
    // ручной submit `route-builder-add`.
    expect(getByTestId('route-builder-add-form')).toBeTruthy()
    expect(getByTestId('route-builder-site-search')).toBeTruthy()
    expect(getByTestId('route-summary')).toBeTruthy()
    // #1491: кнопка действия появляется только при несохранённых правках,
    // поэтому на нетронутом маршруте её нет ни в стеке, ни в мобильной панели.
    expect(queryByTestId('route-builder-save')).toBeNull()
  })

  it('тап по точке в списке центрует карту на её координатах', () => {
    const { getByTestId } = renderMobile()

    expect(getByTestId('route-map-focus').props.children).toBe('none')

    fireEvent.press(getByTestId('route-builder-focus-1'))

    expect(getByTestId('route-map-focus').props.children).toBe('53.93,27.52')
  })

  // #1700: гость-участник попадает не в RouteBuilderMobile, а в readonly-ветку —
  // экран отдаёт `mapFirst` независимо от владения, а проверка `!trip.isOwner`
  // стоит раньше. Строку точки там рендерит тот же renderPoint, значит и обещание
  // «тап центрует карту» там то же: карта обязана получить focusPoint.
  it('гостю-участнику тап по точке тоже центрует карту', () => {
    const { getByTestId } = render(
      <RouteBuilder trip={makeTrip({ isOwner: false })} layout="mapFirst" />,
      { wrapper: createQueryWrapper().Wrapper },
    )

    expect(getByTestId('route-map-focus').props.children).toBe('none')

    fireEvent.press(getByTestId('route-builder-focus-1'))

    expect(getByTestId('route-map-focus').props.children).toBe('53.93,27.52')
  })

  it('точка, добавленная тапом по карте, открывает форму переименования', () => {
    const { getByTestId } = renderMobile()

    fireEvent.press(getByTestId('route-map-click'))

    expect(getByTestId('route-builder-edit-form')).toBeTruthy()
    expect(getByTestId('route-builder-edit-lat').props.value).toBe('53.95')
    expect(getByTestId('route-builder-edit-lng').props.value).toBe('27.61')
  })

  it('вертикальная раскладка остаётся без мобильного блока и без центрирования по тапу', () => {
    const { getByTestId, queryByTestId } = render(<RouteBuilder trip={makeTrip()} />, {
      wrapper: createQueryWrapper().Wrapper,
    })

    expect(queryByTestId('route-mobile-map')).toBeNull()
    expect(queryByTestId('route-builder-focus-1')).toBeNull()
    expect(getByTestId('route-map-fill').props.children).toBe('false')
  })
})
