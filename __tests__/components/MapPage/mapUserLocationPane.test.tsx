/**
 * #1780 — маркер «вы здесь» на web должен жить в собственном pane выше POI и
 * кластеров. Ловушка, из-за которой первая версия фикса молча не работала:
 * `utils/leafletFix` патчит `Map.getPane` в get-or-create, поэтому проверка
 * «pane ещё нет» никогда не срабатывает — getPane САМ создаёт узел, но без
 * стилей. Тест воспроизводит именно такой патченный map.
 *
 * Второй охраняемый инвариант: имя pane обязано ДОЙТИ до `<Marker pane=…>`.
 * До #1780 имя считалось пропом `userLocationPaneName`, которого никто не
 * передавал, — маркер оставался в общем markerPane, и стилизация pane сама по
 * себе ничего не чинила.
 */
import React from 'react'
import { Platform } from 'react-native'
import { render } from '@testing-library/react-native'

import { MapLayers } from '@/components/MapPage/Map/MapLayers'

const originalOS = Platform.OS

let markerProps: Array<Record<string, any>> = []

beforeEach(() => {
  markerProps = []
  // Pane создаётся только на web: на native карта живёт в WebView и свой pane
  // объявляет сама (nativeMapHtml).
  Platform.OS = 'web'
})

afterEach(() => {
  Platform.OS = originalOS
})

const Stub = ({ children }: any) => <>{children ?? null}</>

const MarkerStub = (props: any) => {
  markerProps.push(props)
  return <>{props.children ?? null}</>
}

const lastMarkerProps = () => markerProps[markerProps.length - 1]

const makeMapInstance = ({
  getOrCreate,
  connected = true,
}: {
  getOrCreate: boolean
  connected?: boolean
}) => {
  const panes: Record<string, any> = {}
  const makePane = (name: string) => {
    const el = { style: {} as Record<string, string>, isConnected: connected, name }
    panes[name] = el
    return el
  }
  return {
    panes,
    createPane: jest.fn((name: string) => makePane(name)),
    // getOrCreate: поведение пропатченного leafletFix.
    getPane: jest.fn((name: string) => panes[name] ?? (getOrCreate ? makePane(name) : undefined)),
  }
}

const renderLayers = (mapInstance: any) =>
  render(
    <MapLayers
      TileLayer={Stub}
      Circle={Stub}
      Marker={MarkerStub}
      Popup={Stub}
      mode="radius"
      circleCenter={null}
      radiusInMeters={0}
      userLocation={{ lat: 53.9, lng: 27.56 }}
      userLocationIcon={{}}
      mapInstance={mapInstance}
    />,
  )

describe('#1780 — pane маркера «вы здесь» на web', () => {
  it('получает z-index выше markerPane даже когда getPane пропатчен в get-or-create', () => {
    const map = makeMapInstance({ getOrCreate: true })
    renderLayers(map)

    const pane = map.panes['metravel-user-location']
    expect(pane).toBeDefined()
    // 625 > markerPane 600 (POI и кластеры), но < tooltip/popup 650/700.
    expect(pane.style.zIndex).toBe('625')
    // Pane чисто визуальный: тап должен доставаться POI/кластеру под точкой.
    expect(pane.style.pointerEvents).toBe('none')
  })

  it('передаёт имя pane самому маркеру и не делает его интерактивным', () => {
    const map = makeMapInstance({ getOrCreate: true })
    renderLayers(map)

    // Главная регрессия #1780: стилизованный pane бесполезен, если имя не
    // доехало до маркера — именно так вёл себя мёртвый проп userLocationPaneName.
    expect(lastMarkerProps().pane).toBe('metravel-user-location')
    // Вместе с pointer-events:none у pane это и есть «не крадём тап у POI».
    expect(lastMarkerProps().interactive).toBe(false)
  })

  it('создаёт pane сам, когда патча нет (ванильный Leaflet)', () => {
    const map = makeMapInstance({ getOrCreate: false })
    renderLayers(map)

    expect(map.createPane).toHaveBeenCalledWith('metravel-user-location')
    expect(map.panes['metravel-user-location'].style.zIndex).toBe('625')
    expect(lastMarkerProps().pane).toBe('metravel-user-location')
  })

  it('на detached-заглушке мёртвой карты оставляет маркер в общем pane', () => {
    // leafletFix на пересоздаваемой карте отдаёт узел вне документа. Повесить на
    // него маркер — значит убрать точку с карты совсем, поэтому фолбэк — markerPane.
    const map = makeMapInstance({ getOrCreate: true, connected: false })
    renderLayers(map)

    expect(lastMarkerProps().pane).toBeUndefined()
    expect(map.panes['metravel-user-location'].style.zIndex).toBeUndefined()
  })

  it('на native ничего не трогает: pane объявляет сам WebView-HTML', () => {
    Platform.OS = 'ios'
    const map = makeMapInstance({ getOrCreate: true })
    renderLayers(map)

    expect(map.getPane).not.toHaveBeenCalled()
    expect(map.createPane).not.toHaveBeenCalled()
    expect(lastMarkerProps().pane).toBeUndefined()
  })
})
