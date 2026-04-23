import { Platform } from 'react-native'
import { render, screen } from '@testing-library/react-native'

import { TravelHeroExtras } from '@/components/travel/details/TravelHeroExtras'

const mockQuickFacts = jest.fn((_props: any) => null)
const mockTravelHeroQuickJumps = jest.fn((_props: any) => null)

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

describe('TravelHeroExtras', () => {
  const originalPlatformOS = Platform.OS

  beforeEach(() => {
    Platform.OS = originalPlatformOS as any
    mockQuickFacts.mockClear()
    mockTravelHeroQuickJumps.mockClear()
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
})
