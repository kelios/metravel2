/**
 * #1699 — бюджет полотна карты в режиме маршрута.
 *
 * Отчёт TestFlight (MeTravel 1.0.5, iPhone 16 Pro): «Сделать информацию о
 * маршруте не на карте — съедает место». Поверх карты стояли ДВА яруса разом:
 * ряд «Старт · Моё местоположение · На карте» (44dp) и карточка сводки в два
 * этажа (68dp) — вместе с зазором 118dp сверх тулбара.
 *
 * Инвариант: под тулбаром живёт РОВНО один ярус маршрута высотой 44dp. Выбор
 * старта — контрол фазы построения (обе его пилюли начинают маршрут заново),
 * поэтому у готового маршрута его слот занимает сводка.
 */
import { cleanup, fireEvent, render } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'

import { MapMobileTopOverlay } from '@/components/MapPage/MapMobile/MapMobileTopOverlay'
import { getMapMobileTopOverlayStyles } from '@/components/MapPage/MapMobile/MapMobileTopOverlay.styles'
import { ROUTING_DIRECT_LINE } from '@/components/MapPage/RoutingStatus'
import { getThemedColors } from '@/constants/designSystem'

const colors = getThemedColors(false) as any

const ROUTE_ROW_HEIGHT = 44

const routeProps = {
  colors,
  topInset: 24,
  radiusBadge: '50',
  activePopover: null,
  onToggleRadius: jest.fn(),
  onToggleLayers: jest.fn(),
  onClosePopover: jest.fn(),
  onOpenFilters: jest.fn(),
  onCenterOnUser: jest.fn(),
  onShowAllPlaces: jest.fn(),
  onOpenList: jest.fn(),
  listBadge: '246',
  radiusOptions: [{ id: '50', name: '50 км' }],
  radiusValue: '50',
  onRadiusSelect: jest.fn(),
  onEnterRoute: jest.fn(),
  mode: 'route',
  transportMode: 'car',
  onToggleTransport: jest.fn(),
  onTransportSelect: jest.fn(),
  onClearRoute: jest.fn(),
  onUseUserLocationStart: jest.fn(),
  onStartManualRoute: jest.fn(),
} as const

afterEach(cleanup)

describe('MapMobileTopOverlay — один ярус маршрута поверх карты (#1699)', () => {
  it('пока маршрут строится, стоит выбор старта и никакой сводки', () => {
    const { getByTestId, queryByTestId } = render(
      <MapMobileTopOverlay {...(routeProps as any)} routePointCount={1} routeDistance={0} />,
    )

    expect(getByTestId('map-mobile-route-start-selector')).toBeTruthy()
    expect(queryByTestId('map-mobile-route-summary')).toBeNull()
  })

  it('у готового маршрута сводка ЗАМЕНЯЕТ выбор старта, а не встаёт вторым ярусом', () => {
    const { getByTestId, queryByTestId } = render(
      <MapMobileTopOverlay
        {...(routeProps as any)}
        routePointCount={2}
        routeDistance={3600}
        routeDuration={660}
      />,
    )

    expect(getByTestId('map-mobile-route-summary')).toBeTruthy()
    expect(queryByTestId('map-mobile-route-start-selector')).toBeNull()
  })

  it('сводка — одна строка 44dp, а не карточка в два этажа', () => {
    const { getByTestId } = render(
      <MapMobileTopOverlay
        {...(routeProps as any)}
        routePointCount={2}
        routeDistance={3600}
        routeDuration={660}
      />,
    )

    const summary = StyleSheet.flatten(getByTestId('map-mobile-route-summary').props.style)
    expect(summary.flexDirection).toBe('row')
    expect(summary.minHeight).toBe(ROUTE_ROW_HEIGHT)
    // Вертикальные поля карточки (9+9) вернулись бы вторым этажом вместе с
    // 48dp-рамкой крестика.
    expect(summary.paddingVertical).toBe(0)

    // Тот же ярус, что и у селектора старта: высота ряда совпадает.
    const selector = StyleSheet.flatten(
      render(<MapMobileTopOverlay {...(routeProps as any)} routePointCount={0} />)
        .getByTestId('map-mobile-route-start-selector').props.style,
    )
    expect(selector.minHeight).toBe(ROUTE_ROW_HEIGHT)
  })

  it('метрики сводки не переносятся на вторую строку', () => {
    const { getByText } = render(
      <MapMobileTopOverlay
        {...(routeProps as any)}
        routePointCount={2}
        routeDistance={3600}
        routeDuration={660}
      />,
    )

    // Дистанция и время остаются на экране — ужимается подпись состояния.
    expect(getByText('3,6 км')).toBeTruthy()
    expect(getByText('11 мин')).toBeTruthy()

    // Второй ярус вернул бы именно перенос метрик (было flexWrap: 'wrap').
    const styles = getMapMobileTopOverlayStyles(colors)
    expect(styles.routeSummaryMetrics.flexWrap).toBeUndefined()
    expect(styles.routeSummaryTitle.flexShrink).toBe(1)
  })

  it('крестик стоит вне ужимаемого выхода — метрики не могут вытолкнуть его из пилюли', () => {
    // Узкий экран + длинная локаль времени + крупный системный шрифт: ряду не
    // хватает ширины даже с полностью усечённой подписью. Ужиматься обязан
    // ТОЛЬКО контейнер содержимого, иначе последний ребёнок (единственная
    // кнопка «скрыть сводку») уезжает за край пилюли и экрана.
    const styles = getMapMobileTopOverlayStyles(colors)

    expect(styles.routeSummaryContent.flexShrink).toBe(1)
    expect(styles.routeSummaryContent.minWidth).toBe(0)
    expect(styles.routeSummaryContent.overflow).toBe('hidden')
    expect(styles.routeSummaryCloseTouch.flexShrink).toBe(0)
  })

  it('состояния сводки остались в одной строке: «прямая линия» больше не дубль', () => {
    const direct = render(
      <MapMobileTopOverlay
        {...(routeProps as any)}
        routePointCount={2}
        routeDistance={3600}
        routeDuration={660}
        routingError={ROUTING_DIRECT_LINE}
      />,
    )

    // Статусом строки — один раз. Второй подписи в метриках больше нет, вместе
    // с ней удалён и её ключ локализации.
    expect(direct.getByText('Прямая линия')).toBeTruthy()
    expect(direct.queryByText('прямая линия')).toBeNull()
    direct.unmount()

    const loading = render(
      <MapMobileTopOverlay
        {...(routeProps as any)}
        routePointCount={2}
        routeDistance={3600}
        routeDuration={660}
        routingLoading
      />,
    )
    expect(loading.getByText('Маршрут обновляется')).toBeTruthy()
  })

  it('ярус не пустеет, пока роутинг ещё считает геометрию', () => {
    // `addPoint` обнуляет геометрию (stores/routeStore.ts), а выбор старта к
    // этому моменту уже уступил слот: без отдельного состояния ряд исчезал бы
    // на всё время сетевого запроса и возвращался сводкой.
    const { getByTestId, queryByTestId, getByText, queryByText } = render(
      <MapMobileTopOverlay
        {...(routeProps as any)}
        routePointCount={2}
        routeDistance={null}
        routeDuration={null}
        routingLoading
      />,
    )

    expect(getByTestId('map-mobile-route-summary')).toBeTruthy()
    expect(queryByTestId('map-mobile-route-start-selector')).toBeNull()
    expect(getByText('Маршрут обновляется')).toBeTruthy()
    // Пустых чипов метрик в этом состоянии быть не должно.
    expect(queryByText(/км|м$/)).toBeNull()
    expect(queryByText(/мин|ч$/)).toBeNull()
  })

  it('ярус занят и в дебаунс-окне, пока routingLoading ещё не включился', () => {
    // useRouting запускает запрос через setTimeout(ROUTE_DEBOUNCE_MS): между
    // второй точкой и включением loading есть окно, в котором ярус пустел бы,
    // а смещение поповеров прыгало на 50dp и обратно. Признак ожидания —
    // отсутствие геометрии в сторе (`route?.distance ?? null`), не loading.
    const { getByTestId, queryByTestId, getByText } = render(
      <MapMobileTopOverlay
        {...(routeProps as any)}
        routePointCount={2}
        routeDistance={null}
        routeDuration={null}
      />,
    )

    expect(getByTestId('map-mobile-route-summary')).toBeTruthy()
    expect(queryByTestId('map-mobile-route-start-selector')).toBeNull()
    expect(getByText('Маршрут обновляется')).toBeTruthy()
  })

  it('у яруса ожидания нет крестика: закрыть можно только готовую сводку', () => {
    // Иначе dismiss ожидания пришлось бы хранить отдельным ключом, и один раз
    // закрытое ожидание гасило бы ярус у всех последующих построений маршрута.
    const pending = render(
      <MapMobileTopOverlay
        {...(routeProps as any)}
        routePointCount={2}
        routeDistance={null}
        routeDuration={null}
        routingLoading
      />,
    )
    expect(pending.queryByTestId('map-mobile-route-summary-close')).toBeNull()
    pending.unmount()

    const ready = render(
      <MapMobileTopOverlay
        {...(routeProps as any)}
        routePointCount={2}
        routeDistance={3600}
        routeDuration={660}
      />,
    )
    expect(ready.getByTestId('map-mobile-route-summary-close')).toBeTruthy()
  })

  it('закрытая сводка не гасит ярус ожидания у следующего маршрута', () => {
    const { getByTestId, queryByTestId, getByText, rerender } = render(
      <MapMobileTopOverlay
        {...(routeProps as any)}
        routePointCount={2}
        routeDistance={3600}
        routeDuration={660}
      />,
    )

    fireEvent.press(getByTestId('map-mobile-route-summary-close'))
    expect(queryByTestId('map-mobile-route-summary')).toBeNull()

    // Точку сдвинули — геометрия обнулилась, идёт новый расчёт.
    rerender(
      <MapMobileTopOverlay
        {...(routeProps as any)}
        routePointCount={2}
        routeDistance={null}
        routeDuration={null}
        routingLoading
      />,
    )
    expect(getByTestId('map-mobile-route-summary')).toBeTruthy()
    expect(getByText('Маршрут обновляется')).toBeTruthy()
  })

  it('крестик скрывает сводку, а новый маршрут показывает её снова', () => {
    const { getByTestId, queryByTestId, rerender } = render(
      <MapMobileTopOverlay
        {...(routeProps as any)}
        routePointCount={2}
        routeDistance={3600}
        routeDuration={660}
      />,
    )

    fireEvent.press(getByTestId('map-mobile-route-summary-close'))
    expect(queryByTestId('map-mobile-route-summary')).toBeNull()
    // Скрытая сводка не возвращает выбор старта: ярус просто пуст.
    expect(queryByTestId('map-mobile-route-start-selector')).toBeNull()

    rerender(
      <MapMobileTopOverlay
        {...(routeProps as any)}
        routePointCount={2}
        routeDistance={9800}
        routeDuration={1500}
      />,
    )
    expect(getByTestId('map-mobile-route-summary')).toBeTruthy()
  })

  it('подсказка не ложится на сводку при входе в режим с готовыми двумя точками', () => {
    // Ярус один, а плашка подсказки стоит на том же смещении, что и он. Эффект,
    // который её гасит, слушает только routePointCount, поэтому вход в режим
    // маршрута с уже сохранёнными двумя точками (возврат на карту) оставлял бы
    // подсказку висеть ПОВЕРХ сводки — до #1699 она стояла ярусом ниже.
    const { queryByTestId, rerender } = render(
      <MapMobileTopOverlay
        {...(routeProps as any)}
        mode="radius"
        routePointCount={2}
        routeDistance={3600}
        routeDuration={660}
      />,
    )

    rerender(
      <MapMobileTopOverlay
        {...(routeProps as any)}
        mode="route"
        routePointCount={2}
        routeDistance={3600}
        routeDuration={660}
      />,
    )

    expect(queryByTestId('map-mobile-route-summary')).toBeTruthy()
    expect(queryByTestId('map-mobile-route-hint')).toBeNull()
  })
})
