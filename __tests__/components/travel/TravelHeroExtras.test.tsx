import { Platform, StyleSheet } from 'react-native'
import { render, screen } from '@testing-library/react-native'

import { TravelHeroExtras } from '@/components/travel/details/TravelHeroExtras'

const mockQuickFacts = jest.fn((_props: any) => null)
const mockTravelHeroQuickJumps = jest.fn((_props: any) => null)
const mockTravelStatusButton = jest.fn((_props: any) => null)
const mockOfflineSaveControl = jest.fn((_props: any) => null)
const mockSaveTravelOffline = jest.fn(() => Promise.resolve())

jest.mock('@/components/travel/details/TravelDetailsHeroStyles', () => ({
  useTravelDetailsHeroStyles: () => ({
    sectionContainer: {},
    contentStable: {},
    quickFactsContainer: {},
    quickJumpWrapper: {},
  }),
}))

jest.mock('@/components/travel/QuickFacts', () => ({
  __esModule: true,
  default: (props: any) => mockQuickFacts(props),
}))

jest.mock('@/components/travel/details/TravelHeroQuickJumps', () => ({
  __esModule: true,
  default: (props: any) => mockTravelHeroQuickJumps(props),
}))

jest.mock('@/components/travel/TravelStatusButton', () => ({
  __esModule: true,
  default: (props: any) => mockTravelStatusButton(props),
}))

jest.mock('@/components/offline/OfflineSaveControl', () => ({
  __esModule: true,
  default: (props: any) => mockOfflineSaveControl(props),
}))

jest.mock('@/services/offline/travelOfflineAdapter', () => ({
  saveTravelOffline: (...args: unknown[]) => mockSaveTravelOffline(...(args as [])),
}))

describe('TravelHeroExtras', () => {
  const originalPlatformOS = Platform.OS

  beforeEach(() => {
    Platform.OS = originalPlatformOS as any
    mockQuickFacts.mockClear()
    mockTravelHeroQuickJumps.mockClear()
    mockTravelStatusButton.mockClear()
    mockOfflineSaveControl.mockClear()
    mockSaveTravelOffline.mockClear()
  })

  afterAll(() => {
    Platform.OS = originalPlatformOS as any
  })

  it('renders quick facts and passes hero-priority quick jump links on native', async () => {
    Platform.OS = 'ios' as any

    const travel: any = { id: 1, slug: 'hero-extra', name: 'Hero extra' }
    const sectionLinks = [
      { key: 'comments', label: 'Комментарии', icon: 'message-circle' },
      { key: 'gallery', label: 'Галерея', icon: 'image' },
      { key: 'map', label: 'Карта', icon: 'map' },
      { key: 'description', label: 'Описание', icon: 'file-text' },
      { key: 'video', label: 'Видео', icon: 'youtube' },
      { key: 'points', label: 'Точки', icon: 'map-pin' },
    ]

    await render(
      <TravelHeroExtras
        travel={travel}
        isMobile
        sectionLinks={sectionLinks as any}
        onQuickJump={jest.fn()}
      />
    )

    expect(screen.getByTestId('travel-details-quick-facts')).toBeTruthy()
    expect(mockQuickFacts).toHaveBeenCalledWith(expect.objectContaining({ travel }))
    expect(mockTravelHeroQuickJumps).toHaveBeenCalledWith(
      expect.objectContaining({
        isMobile: true,
        links: [
          sectionLinks[2],
          sectionLinks[3],
          sectionLinks[5],
          sectionLinks[0],
          sectionLinks[4],
        ],
      })
    )
  })

  it('renders hero-priority quick jumps on web too', async () => {
    Platform.OS = 'web' as any
    const sectionLinks = [
      { key: 'description', label: 'Описание', icon: 'file-text' },
      { key: 'map', label: 'Карта', icon: 'map' },
    ]

    await render(
      <TravelHeroExtras
        travel={{ id: 2, slug: 'hero-web', name: 'Hero web' } as any}
        isMobile={false}
        sectionLinks={sectionLinks as any}
        onQuickJump={jest.fn()}
      />
    )

    expect(screen.getByTestId('travel-details-quick-facts')).toBeTruthy()
    expect(mockTravelHeroQuickJumps).toHaveBeenCalledWith(
      expect.objectContaining({
        isMobile: false,
        links: [sectionLinks[1], sectionLinks[0]],
      })
    )
  })

  it('рендерит TravelStatusButton с корректными пропсами для travel с slug', async () => {
    Platform.OS = 'ios' as any
    const travel: any = {
      id: 5,
      slug: 'my-trip',
      name: 'My Trip',
      travel_image_thumb_url: 'https://example.com/img.jpg',
      countryName: 'Italy',
    }
    await render(
      <TravelHeroExtras
        travel={travel}
        isMobile
        sectionLinks={[]}
        onQuickJump={jest.fn()}
      />
    )

    expect(mockTravelStatusButton).toHaveBeenCalledWith(
      expect.objectContaining({
        travelId: 5,
        travelTitle: 'My Trip',
        travelUrl: '/travels/my-trip',
        travelImageUrl: 'https://example.com/img.jpg',
        travelCountry: 'Italy',
      })
    )
  })

  // Контракт переноса: «Сохранить офлайн» живёт в ряду действий под галереей, а не
  // отдельной плашкой над страницей, и сохраняет именно этот маршрут.
  it('рендерит «Сохранить офлайн» рядом со статусом под галереей', async () => {
    const travel: any = { id: 7, slug: 'grodno', name: 'Гродно за 1 день' }
    await render(
      <TravelHeroExtras
        travel={travel}
        isMobile
        sectionLinks={[]}
        onQuickJump={jest.fn()}
      />
    )

    expect(mockOfflineSaveControl).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'travel', sourceId: 7 })
    )

    const { onSave } = mockOfflineSaveControl.mock.calls[0][0]
    await onSave(true)
    expect(mockSaveTravelOffline).toHaveBeenCalledWith(travel, { pinned: true, includePhotos: true })
  })

  // #2902: «Открыть в навигаторе» и «GPX» живут в том же ряду действий и
  // появляются только при ≥ 2 точках с координатами — без этой проводки прод
  // снова остаётся без GPX, хотя главная обещает GPS-треки.
  it('рендерит навигатор и GPX в ряду действий только при ≥ 2 точках', async () => {
    const withPoints: any = {
      id: 7,
      slug: 'grodno',
      name: 'Гродно за 1 день',
      travelAddress: [
        { id: 1, address: 'Коложа', coord: '53.6772,23.8139' },
        { id: 2, address: 'Старый замок', coord: '53.6774,23.8237' },
      ],
    }
    const view = await render(
      <TravelHeroExtras travel={withPoints} isMobile sectionLinks={[]} onQuickJump={jest.fn()} />
    )
    expect(view.getByTestId('travel-navigator-trigger')).toBeTruthy()
    expect(view.getByTestId('travel-gpx-download')).toBeTruthy()
    await view.unmount()

    const onePoint: any = { ...withPoints, travelAddress: withPoints.travelAddress.slice(0, 1) }
    const single = await render(
      <TravelHeroExtras travel={onePoint} isMobile sectionLinks={[]} onQuickJump={jest.fn()} />
    )
    expect(single.queryByTestId('travel-navigator-trigger')).toBeNull()
    expect(single.queryByTestId('travel-gpx-download')).toBeNull()
  })

  // #1673: на узком экране ряд действий переносился, и офлайн читался второй
  // главной кнопкой во всю ширину. Компактный чип оставляет оба действия в одной строке.
  it('сжимает офлайн-чип до иконки только на узком экране', async () => {
    const travel: any = { id: 7, slug: 'grodno', name: 'Гродно за 1 день' }

    await render(
      <TravelHeroExtras travel={travel} isMobile sectionLinks={[]} onQuickJump={jest.fn()} />
    )
    expect(mockOfflineSaveControl).toHaveBeenCalledWith(
      expect.objectContaining({ compact: true })
    )

    mockOfflineSaveControl.mockClear()
    await render(
      <TravelHeroExtras
        travel={travel}
        isMobile={false}
        sectionLinks={[]}
        onQuickJump={jest.fn()}
      />
    )
    expect(mockOfflineSaveControl).toHaveBeenCalledWith(
      expect.objectContaining({ compact: false })
    )
  })

  it('растягивает статус только на мобильном, оставляя desktop-ряд компактным', async () => {
    const travel: any = { id: 7, slug: 'grodno', name: 'Гродно за 1 день' }

    await render(
      <TravelHeroExtras travel={travel} isMobile sectionLinks={[]} onQuickJump={jest.fn()} />
    )
    const mobileStatus = StyleSheet.flatten(mockTravelStatusButton.mock.calls[0][0].style)
    expect(mobileStatus.flexBasis).toBe('auto')
    expect(mobileStatus.flexShrink).toBe(1)
    expect(mobileStatus.flexGrow).toBe(1)

    mockTravelStatusButton.mockClear()
    await render(
      <TravelHeroExtras
        travel={travel}
        isMobile={false}
        sectionLinks={[]}
        onQuickJump={jest.fn()}
      />
    )
    const desktopStatus = StyleSheet.flatten(mockTravelStatusButton.mock.calls[0][0].style)
    expect(desktopStatus.flexBasis).toBe('auto')
    expect(desktopStatus.flexGrow ?? 0).toBe(0)
  })

  it('не рендерит «Сохранить офлайн» без id маршрута', async () => {
    await render(
      <TravelHeroExtras
        travel={{ slug: 'draft', name: 'Черновик' } as any}
        isMobile={false}
        sectionLinks={[]}
        onQuickJump={jest.fn()}
      />
    )

    expect(mockOfflineSaveControl).not.toHaveBeenCalled()
  })

  it('использует id как fallback в URL при отсутствии slug', async () => {
    const travel: any = { id: 99, name: 'No Slug' }
    await render(
      <TravelHeroExtras
        travel={travel}
        isMobile={false}
        sectionLinks={[]}
        onQuickJump={jest.fn()}
      />
    )
    expect(mockTravelStatusButton).toHaveBeenCalledWith(
      expect.objectContaining({ travelUrl: '/travels/99' })
    )
  })

  // Один ряд действий одной высоты: на desktop web статус — 36 px чип, как
  // офлайн, навигатор и GPX; на телефоне и на любом native (планшет тоже) —
  // тач-таргет, как у соседних OfflineSaveControl/TravelRouteActions.
  it('передаёт статусу размер ряда действий по ширине и платформе', async () => {
    const travel: any = { id: 7, slug: 'grodno', name: 'Гродно за 1 день' }
    Platform.OS = 'web' as any
    await render(
      <TravelHeroExtras travel={travel} isMobile={false} sectionLinks={[]} onQuickJump={jest.fn()} />
    )
    expect(mockTravelStatusButton).toHaveBeenCalledWith(expect.objectContaining({ size: 'sm' }))

    mockTravelStatusButton.mockClear()
    await render(
      <TravelHeroExtras travel={travel} isMobile sectionLinks={[]} onQuickJump={jest.fn()} />
    )
    expect(mockTravelStatusButton).toHaveBeenCalledWith(expect.objectContaining({ size: 'md' }))

    // Native tablet (width ≥ 768 → isMobile=false) keeps the 44/48 px touch row.
    mockTravelStatusButton.mockClear()
    Platform.OS = 'ios' as any
    await render(
      <TravelHeroExtras travel={travel} isMobile={false} sectionLinks={[]} onQuickJump={jest.fn()} />
    )
    expect(mockTravelStatusButton).toHaveBeenCalledWith(expect.objectContaining({ size: 'md' }))
  })

  // Табы дублируют навигацию desktop-сайдбара; прячет их CSS-медиазапрос
  // (`travelFirstScreenLayout`) по маркеру, а не JS-ветка — ширина 0 на SSR.
  it('помечает ряд табов маркером для CSS-скрытия рядом с сайдбаром (web)', async () => {
    Platform.OS = 'web' as any
    const view = await render(
      <TravelHeroExtras
        travel={{ id: 2, slug: 'hero-web', name: 'Hero web' } as any}
        isMobile={false}
        sectionLinks={[{ key: 'map', label: 'Карта', icon: 'map' }] as any}
        onQuickJump={jest.fn()}
      />
    )
    const hasMarker = (node: any): boolean => {
      if (!node || typeof node !== 'object') return false
      if (Array.isArray(node)) return node.some(hasMarker)
      return node.props?.dataSet?.travelQuickJumps === 'true' || hasMarker(node.children)
    }
    expect(mockTravelHeroQuickJumps).toHaveBeenCalled()
    expect(hasMarker(view.toJSON())).toBe(true)
  })
})
