/**
 * #2059 — маркеры web-карты конструктора: номер как в списке, активная точка
 * крупнее и вне кластеров, близкие точки — в кластерах механизма /map
 * (`mapClusterGroup.ts`), а перетаскивание (#1781) остаётся на маркере.
 *
 * `@react-leaflet/core` в jest — корневой мок (`__mocks__/@react-leaflet/core.js`)
 * с тем же контекстом: по нему проверяется, что маркеры добавляются в группу
 * кластеров, а не прямо на карту.
 */
import React from 'react'
import { act, render, waitFor } from '@testing-library/react-native'

import type { RoutePoint } from '@/api/plannedTrips'
import { MAP_CLUSTER_GROUP_OPTIONS } from '@/components/MapPage/Map/mapClusterGroup'
import TripPlanRouteMarkers from '@/components/trips/planning/TripPlanRouteMarkers'
import { FOCUS_POINT_ZOOM } from '@/components/trips/planning/tripPlanRouteMap.types'
import { getThemedColors } from '@/constants/designSystem'

const core = require('@react-leaflet/core')

jest.mock('react-dom', () => ({ createPortal: (node: unknown) => node }))

type Captured = { props: Record<string, any>; container: unknown }

class FakeMarkerCluster {
  _icon: { attrs: Record<string, string>; setAttribute: (key: string, value: string) => void }
  constructor(private readonly count: number) {
    const attrs: Record<string, string> = {}
    this._icon = { attrs, setAttribute: (key, value) => { attrs[key] = value } }
  }
  getChildCount() {
    return this.count
  }
}

const setup = () => {
  const captured: Captured[] = []
  const group = {
    on: jest.fn(),
    off: jest.fn(),
    clearLayers: jest.fn(),
    refreshClusters: jest.fn(),
  }
  const cluster = new FakeMarkerCluster(12)
  const map = {
    addLayer: jest.fn(),
    removeLayer: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
    eachLayer: jest.fn((callback: (layer: unknown) => void) => callback(cluster)),
  }
  const L = {
    divIcon: jest.fn((options: Record<string, unknown>) => options),
    markerClusterGroup: jest.fn(() => group),
    MarkerCluster: FakeMarkerCluster,
  }
  const Marker = (props: Record<string, any>) => {
    const context = React.useContext(core.LeafletContext) as { layerContainer?: unknown } | null
    captured.push({ props, container: context?.layerContainer })
    return <>{props.children}</>
  }
  const RL = {
    Marker,
    Popup: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
    useMap: () => map,
  }
  return { captured, group, cluster, map, L, RL }
}

// 20 точек: кластеры включаются только у маршрута длиннее 15 точек.
const route: RoutePoint[] = Array.from({ length: 20 }, (_, index) => ({
  id: `p${index}`,
  type: 'custom',
  name: `Точка ${index + 1}`,
  description: null,
  coordinates: [12 + index * 0.01, 47.5 + index * 0.01],
  placeId: null,
}))

const colors = getThemedColors(false)

const markersTree = (
  env: ReturnType<typeof setup>,
  props: Partial<React.ComponentProps<typeof TripPlanRouteMarkers>> = {},
) => (
    <core.LeafletContext.Provider value={{ map: env.map }}>
      <TripPlanRouteMarkers
        L={env.L as any}
        RL={env.RL as any}
        RLCore={core}
        route={route}
        readonly={false}
        draggable
        colors={colors}
        onDragEnd={() => () => undefined}
        onEditPoint={jest.fn()}
        {...props}
      />
    </core.LeafletContext.Provider>
  )

const renderMarkers = (
  env: ReturnType<typeof setup>,
  props: Partial<React.ComponentProps<typeof TripPlanRouteMarkers>> = {},
) => render(markersTree(env, props))

const lastByIndex = (captured: Captured[]) => {
  const byKey = new Map<string, Captured>()
  for (const entry of captured) byKey.set(String(entry.props.title), entry)
  return Array.from(byKey.values())
}

describe('#2059 TripPlanRouteMarkers.web', () => {
  it('кладёт маркеры в группу кластеров /map с её настройками', async () => {
    const env = setup()
    renderMarkers(env)

    await waitFor(() => expect(lastByIndex(env.captured)).toHaveLength(20))
    expect(env.L.markerClusterGroup).toHaveBeenCalledTimes(1)
    expect(env.L.markerClusterGroup).toHaveBeenCalledWith(
      expect.objectContaining({
        ...MAP_CLUSTER_GROUP_OPTIONS,
        // С зума фокуса точки/дня каждая точка — свой маркер (его можно тянуть).
        disableClusteringAtZoom: FOCUS_POINT_ZOOM,
        // Маркеры сразу на своих местах: без 300 мс полёта от центра кластера,
        // в который хват брал соседний маркер.
        animate: false,
        iconCreateFunction: expect.any(Function),
      }),
    )
    expect(env.map.addLayer).toHaveBeenCalledWith(env.group)
    expect(env.group.on).toHaveBeenCalledWith('clusterclick', expect.any(Function))
    for (const entry of lastByIndex(env.captured)) {
      expect(entry.container).toBe(env.group)
    }
  })

  it('номер на маркере совпадает с номером строки списка', async () => {
    const env = setup()
    renderMarkers(env)

    await waitFor(() => expect(lastByIndex(env.captured)).toHaveLength(20))
    lastByIndex(env.captured).forEach((entry, index) => {
      expect(entry.props.title).toBe(`${index + 1}. Точка ${index + 1}`)
      expect(entry.props.icon.html).toContain(`>${index + 1}</text>`)
      expect(entry.props.icon.iconSize).toEqual([36, 36])
    })
  })

  it('активная точка крупнее и живёт вне кластеров', async () => {
    const env = setup()
    renderMarkers(env, { activeIndex: 3 })

    await waitFor(() => expect(lastByIndex(env.captured)).toHaveLength(20))
    const active = lastByIndex(env.captured).find((entry) => entry.props.title === '4. Точка 4')
    expect(active?.props.icon.iconSize).toEqual([44, 44])
    expect(active?.props.icon.className).toContain('metravel-trip-plan-marker-active')
    expect(active?.props.zIndexOffset).toBe(1000)
    expect(active?.container).toBeUndefined()
  })

  it('перетаскивание остаётся на маркере в кластере (#1781)', async () => {
    const env = setup()
    const dragEnd = jest.fn()
    renderMarkers(env, { onDragEnd: (index) => () => dragEnd(index) })

    await waitFor(() => expect(lastByIndex(env.captured)).toHaveLength(20))
    const second = lastByIndex(env.captured)[1]
    expect(second.props.draggable).toBe(true)
    second.props.eventHandlers.dragend({})
    expect(dragEnd).toHaveBeenCalledWith(1)
  })

  it('брошенный маркер не уходит в кластер к соседу, пока точка стоит на месте дропа (#1781)', async () => {
    const env = setup()
    const dragEnd = jest.fn()
    const props = { onDragEnd: (index: number) => () => dragEnd(index) }
    const utils = renderMarkers(env, props)
    await waitFor(() => expect(lastByIndex(env.captured)).toHaveLength(20))
    const byTitle = (title: string) => lastByIndex(env.captured).find((entry) => entry.props.title === title)

    // Отпустили рядом с третьей точкой; `RouteBuilder` округляет до 6 знаков.
    const drop = { lat: 47.5198764, lng: 12.0201234 }
    act(() => {
      byTitle('2. Точка 2')?.props.eventHandlers.dragend({ target: { getLatLng: () => drop } })
    })
    expect(dragEnd).toHaveBeenCalledWith(1)
    const moved = route.map((point, index) =>
      index === 1 ? { ...point, coordinates: [12.020123, 47.519876] as [number, number] } : point,
    )
    utils.rerender(markersTree(env, { ...props, route: moved }))

    expect(byTitle('2. Точка 2')?.container).toBeUndefined()
    // Не активная: обычная капля без подъёма над соседями.
    expect(byTitle('2. Точка 2')?.props.icon.iconSize).toEqual([36, 36])
    expect(byTitle('3. Точка 3')?.container).toBe(env.group)

    // Точку поправили в редакторе — маркер возвращается в кластеры.
    const edited = moved.map((point, index) =>
      index === 1 ? { ...point, coordinates: [12.5, 47.9] as [number, number] } : point,
    )
    utils.rerender(markersTree(env, { ...props, route: edited }))
    expect(byTitle('2. Точка 2')?.container).toBe(env.group)
  })

  it('отклонённый перенос оставляет маркер в кластерах', async () => {
    const env = setup()
    renderMarkers(env)
    await waitFor(() => expect(lastByIndex(env.captured)).toHaveLength(20))

    act(() => {
      lastByIndex(env.captured)[1].props.eventHandlers.dragend({
        target: { getLatLng: () => ({ lat: 47.9, lng: 12.9 }) },
      })
    })

    expect(lastByIndex(env.captured)[1].container).toBe(env.group)
  })

  it('кластер показывает число точек и подписан для скринридера', async () => {
    const env = setup()
    renderMarkers(env)

    await waitFor(() => expect(env.cluster._icon.attrs['aria-label']).toBe('Кластер: 12 точек'))
    const [[options]] = env.L.markerClusterGroup.mock.calls as unknown as Array<[{ iconCreateFunction: (c: unknown) => any }]>
    const icon = options.iconCreateFunction({ getChildCount: () => 12 })
    expect(icon.className).toContain('metravel-cluster-icon')
    expect(icon.html).toContain('12')
  })

  it('маршрут до 15 точек не кластеризуется — каждая точка видна с номером', async () => {
    const env = setup()
    renderMarkers(env, { route: route.slice(0, 15) })

    await waitFor(() => expect(lastByIndex(env.captured)).toHaveLength(15))
    expect(env.L.markerClusterGroup).not.toHaveBeenCalled()
    for (const entry of lastByIndex(env.captured)) expect(entry.container).toBeUndefined()
  })

  it('без кластеров активная точка не меняет порядок маркеров (порядок маршрута)', async () => {
    const env = setup()
    renderMarkers(env, { route: route.slice(0, 15), activeIndex: 3 })

    await waitFor(() => expect(lastByIndex(env.captured)).toHaveLength(15))
    expect(env.captured.slice(0, 15).map((entry) => entry.props.title)).toEqual(
      route.slice(0, 15).map((point, index) => `${index + 1}. ${point.name}`),
    )
    expect(env.captured[3].props.icon.iconSize).toEqual([44, 44])
  })

  it('перерисовка не двигает маркеры, а переименование обновляет подпись', async () => {
    const env = setup()
    // Живой маркер Leaflet: `title` он читает только при создании иконки.
    const instances: Array<{ options: { title: string }; element: { title: string }; getElement: () => { title: string } }> = []
    const LiveMarker = (props: Record<string, any>) => {
      const context = React.useContext(core.LeafletContext) as { layerContainer?: unknown } | null
      env.captured.push({ props, container: context?.layerContainer })
      const [instance] = React.useState(() => {
        const element = { title: String(props.title) }
        const created = { options: { title: String(props.title) }, element, getElement: () => element }
        instances.push(created)
        return created
      })
      React.useImperativeHandle(props.ref, () => instance, [instance])
      return <>{props.children}</>
    }
    env.RL.Marker = LiveMarker
    const onDragEnd = () => () => undefined
    const tree = (nextRoute: RoutePoint[]) => (
      <core.LeafletContext.Provider value={{ map: env.map }}>
        <TripPlanRouteMarkers
          L={env.L as any}
          RL={env.RL as any}
          RLCore={core}
          route={nextRoute}
          readonly={false}
          draggable
          colors={colors}
          onDragEnd={onDragEnd}
          onEditPoint={jest.fn()}
        />
      </core.LeafletContext.Provider>
    )
    const utils = render(tree(route))
    await waitFor(() => expect(instances).toHaveLength(20))
    const before = env.captured.slice(-20)

    // Ввод в панели конструктора перерисовывает карту тем же маршрутом, а
    // переименование — новым массивом с теми же координатами.
    const renamed = route.map((point, index) => (index === 1 ? { ...point, name: 'Мирский замок' } : { ...point }))
    utils.rerender(tree(renamed))
    const after = env.captured.slice(-20)

    after.forEach((entry, index) => {
      // Та же ссылка — react-leaflet не зовёт `setLatLng`, markercluster не
      // снимает и не добавляет маркер заново.
      expect(entry.props.position).toBe(before[index].props.position)
      expect(entry.props.eventHandlers).toBe(before[index].props.eventHandlers)
    })
    expect(instances).toHaveLength(20)
    expect(instances[1].options.title).toBe('2. Мирский замок')
    expect(instances[1].element.title).toBe('2. Мирский замок')
    expect(instances[0].element.title).toBe('1. Точка 1')
  })

  // #2073: `accessibilityHint` на корневом `<View>` карты (TripPlanRouteMap.web.tsx)
  // ничего не даёт — react-native-web 0.21.2 не реализует этот проп ни у одного
  // элемента. Реальная доставка — `aria-description` прямо на DOM-узле маркера.
  it('#2073 перетаскиваемый маркер получает aria-description с подсказкой', async () => {
    const env = setup()
    const instances: Array<{
      element: {
        attrs: Record<string, string>
        setAttribute: (key: string, value: string) => void
        removeAttribute: (key: string) => void
      }
    }> = []
    const LiveMarker = (props: Record<string, any>) => {
      const [instance] = React.useState(() => {
        const attrs: Record<string, string> = {}
        const element = {
          title: String(props.title),
          attrs,
          setAttribute: (key: string, value: string) => { attrs[key] = value },
          removeAttribute: (key: string) => { delete attrs[key] },
        }
        const created = { options: { title: String(props.title) }, element, getElement: () => element }
        instances.push(created)
        return created
      })
      React.useImperativeHandle(props.ref, () => instance, [instance])
      return <>{props.children}</>
    }
    env.RL.Marker = LiveMarker
    renderMarkers(env, { draggable: true })

    await waitFor(() => expect(instances).toHaveLength(20))
    instances.forEach((instance) => {
      expect(instance.element.attrs['aria-description']).toBe(
        'Маркер точки можно перетащить по карте, а по тапу открыть изменение или удаление.',
      )
    })
  })

  it('#2073 маркер без перетаскивания не получает aria-description', async () => {
    const env = setup()
    const instances: Array<{
      element: { attrs: Record<string, string>; setAttribute: (key: string, value: string) => void }
    }> = []
    const LiveMarker = (props: Record<string, any>) => {
      const [instance] = React.useState(() => {
        const attrs: Record<string, string> = {}
        const element = {
          title: String(props.title),
          attrs,
          setAttribute: (key: string, value: string) => { attrs[key] = value },
          removeAttribute: (key: string) => { delete attrs[key] },
        }
        const created = { options: { title: String(props.title) }, element, getElement: () => element }
        instances.push(created)
        return created
      })
      React.useImperativeHandle(props.ref, () => instance, [instance])
      return <>{props.children}</>
    }
    env.RL.Marker = LiveMarker
    renderMarkers(env, { draggable: false })

    await waitFor(() => expect(instances).toHaveLength(20))
    instances.forEach((instance) => {
      expect(instance.element.attrs['aria-description']).toBeUndefined()
    })
  })

  // #2073 P2: markercluster снимает и заново добавляет маркер на каждый
  // zoom/pan, который меняет его группировку — Leaflet `_initIcon` создаёт
  // НОВЫЙ DOM-узел на каждое такое пересоздание, а эффект по `title`/`hint`
  // не перезапускается (их deps не меняются). На момент монтирования маркера
  // в кластере `getElement()` ещё пуст — DOM появляется позже, вместе с `add`.
  // На старом коде (`eventHandlers` без `add`) этот тест падает синхронно:
  // `eventHandlers.add` отсутствует, вызов бросает TypeError.
  it('#2073 P2 не теряет aria-description при пересоздании DOM-узла маркера (регруппировка кластера)', async () => {
    const env = setup()
    type FakeElement = {
      attrs: Record<string, string>
      setAttribute: (key: string, value: string) => void
      removeAttribute: (key: string) => void
    }
    const makeElement = (): FakeElement => {
      const attrs: Record<string, string> = {}
      return {
        attrs,
        setAttribute: (key, value) => { attrs[key] = value },
        removeAttribute: (key) => { delete attrs[key] },
      }
    }
    let capturedInstance: { options: { title: string }; element: FakeElement | null } | null = null
    let capturedEventHandlers: Record<string, (event?: unknown) => void> | undefined
    const LiveMarker = (props: Record<string, any>) => {
      const [instance] = React.useState(() => ({
        options: { title: String(props.title) },
        // На монтировании маркер ещё в кластере — Leaflet его DOM-узел
        // создаёт позже, реальным добавлением на карту.
        element: null as FakeElement | null,
        getElement(): FakeElement | undefined { return this.element ?? undefined },
      }))
      capturedInstance = instance
      capturedEventHandlers = props.eventHandlers
      React.useImperativeHandle(props.ref, () => instance, [instance])
      return <>{props.children}</>
    }
    env.RL.Marker = LiveMarker
    renderMarkers(env, { draggable: true, route: route.slice(0, 1) })

    await waitFor(() => expect(capturedInstance).not.toBeNull())
    expect(capturedEventHandlers?.add).toEqual(expect.any(Function))

    const hint = 'Маркер точки можно перетащить по карте, а по тапу открыть изменение или удаление.'

    // Первое реальное добавление на карту создаёт первый DOM-узел.
    const firstElement = makeElement()
    capturedInstance!.element = firstElement
    capturedEventHandlers!.add({ target: capturedInstance })
    expect(firstElement.attrs['aria-description']).toBe(hint)

    // Кластер регруппировался (zoom/pan) — Leaflet создал НОВЫЙ узел вместо
    // старого; та же подсказка обязана появиться и на нём.
    const secondElement = makeElement()
    capturedInstance!.element = secondElement
    capturedEventHandlers!.add({ target: capturedInstance })
    expect(secondElement.attrs['aria-description']).toBe(hint)
  })

  it('без ядра react-leaflet маркеры идут прямо на карту', async () => {
    const env = setup()
    renderMarkers(env, { RLCore: undefined })

    await waitFor(() => expect(lastByIndex(env.captured)).toHaveLength(20))
    expect(env.L.markerClusterGroup).not.toHaveBeenCalled()
    for (const entry of lastByIndex(env.captured)) expect(entry.container).toBeUndefined()
  })
})
