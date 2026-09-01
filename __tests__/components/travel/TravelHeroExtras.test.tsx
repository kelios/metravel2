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

  it('renders quick facts and passes hero-priority quick jump links on native', () => {
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

    render(
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

  it('renders hero-priority quick jumps on web too', () => {
    Platform.OS = 'web' as any
    const sectionLinks = [
      { key: 'description', label: 'Описание', icon: 'file-text' },
      { key: 'map', label: 'Карта', icon: 'map' },
    ]

    render(
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

  it('рендерит TravelStatusButton с корректными пропсами для travel с slug', () => {
    Platform.OS = 'ios' as any
    const travel: any = {
      id: 5,
      slug: 'my-trip',
      name: 'My Trip',
      travel_image_thumb_url: 'https://example.com/img.jpg',
      countryName: 'Italy',
    }
    render(
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
    render(
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

  // #1673: на узком экране ряд действий переносился, и офлайн читался второй
  // главной кнопкой во всю ширину. Компактный чип оставляет оба действия в одной
  // строке; на широком экране раскладка ряда прежняя.
  it('сжимает офлайн-чип до иконки только на узком экране', () => {
    const travel: any = { id: 7, slug: 'grodno', name: 'Гродно за 1 день' }

    render(
      <TravelHeroExtras travel={travel} isMobile sectionLinks={[]} onQuickJump={jest.fn()} />
    )
    expect(mockOfflineSaveControl).toHaveBeenCalledWith(
      expect.objectContaining({ compact: true })
    )

    mockOfflineSaveControl.mockClear()
    render(
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

  // Вторая половина того же фикса: без снятой 240-px базы и без flexShrink ряд
  // переносится независимо от того, сжат чип или нет — статус с базой по
  // контенту не отдаёт место соседу и уходит на свою строку.
  it('на узком экране статус теряет 240-px базу и умеет отдавать ширину', () => {
    const travel: any = { id: 7, slug: 'grodno', name: 'Гродно за 1 день' }

    render(
      <TravelHeroExtras travel={travel} isMobile sectionLinks={[]} onQuickJump={jest.fn()} />
    )
    const mobileStatus = StyleSheet.flatten(mockTravelStatusButton.mock.calls[0][0].style)
    expect(mobileStatus.flexBasis).toBe('auto')
    expect(mobileStatus.flexShrink).toBe(1)

    mockTravelStatusButton.mockClear()
    render(
      <TravelHeroExtras
        travel={travel}
        isMobile={false}
        sectionLinks={[]}
        onQuickJump={jest.fn()}
      />
    )
    const desktopStatus = StyleSheet.flatten(mockTravelStatusButton.mock.calls[0][0].style)
    expect(desktopStatus.flexBasis).toBe(240)
  })

  it('не рендерит «Сохранить офлайн» без id маршрута', () => {
    render(
      <TravelHeroExtras
        travel={{ slug: 'draft', name: 'Черновик' } as any}
        isMobile={false}
        sectionLinks={[]}
        onQuickJump={jest.fn()}
      />
    )

    expect(mockOfflineSaveControl).not.toHaveBeenCalled()
  })

  it('использует id как fallback в URL при отсутствии slug', () => {
    const travel: any = { id: 99, name: 'No Slug' }
    render(
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
})
