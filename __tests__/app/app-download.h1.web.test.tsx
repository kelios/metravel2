import { render } from '@testing-library/react-native'
import { Platform } from 'react-native'

// #1617: /app previously had 11+ real <h1> tags — a hidden sr-only duplicate
// reusing the SEO title (removed here) plus every level 2/4 Heading in the
// feature grid and install steps rendering as <h1> due to the Typography.tsx
// aria-level bug (fixed separately). This locks in exactly one level-1
// heading: the visible hero.
jest.mock('expo-router', () => ({
  useIsFocused: () => true,
}))
jest.mock('@/components/layout/CustomHeader', () => () => null)
jest.mock('@/components/seo/LazyInstantSEO', () => () => null)

function loadAppDownloadScreen() {
  (Platform as { OS: string }).OS = 'web'
  return require('@/app/app').default
}

describe('AppDownloadScreen single H1 (#1617)', () => {
  it('has exactly one level-1 heading: the visible hero title', () => {
    const AppDownloadScreen = loadAppDownloadScreen()
    const { UNSAFE_root } = render(<AppDownloadScreen />)

    const level1Headers = new Set(
      UNSAFE_root
        .findAllByProps({ accessibilityRole: 'header' })
        .filter((node) => node.props['aria-level'] === 1)
        .map((node) => String(node.props.children)),
    )
    expect(Array.from(level1Headers)).toEqual(['MeTravel — путешествия в кармане'])
  })

  it('renders the feature-grid and install-step subheadings as level 2/4, not level 1', () => {
    const AppDownloadScreen = loadAppDownloadScreen()
    const { UNSAFE_root } = render(<AppDownloadScreen />)

    const level2 = UNSAFE_root
      .findAllByProps({ accessibilityRole: 'header' })
      .filter((node) => node.props['aria-level'] === 2)
      .map((node) => String(node.props.children))
    const level4 = UNSAFE_root
      .findAllByProps({ accessibilityRole: 'header' })
      .filter((node) => node.props['aria-level'] === 4)
      .map((node) => String(node.props.children))

    expect(new Set(level2)).toEqual(new Set(['Что внутри', 'Как установить']))
    expect(new Set(level4)).toEqual(
      new Set([
        'Карта мест', 'Городские квесты', 'Путеводители', 'Своё избранное', // feature grid
        'Нажмите «Установить»', 'Откройте Google Play', 'Откройте приложение', // install steps
      ]),
    )
  })
})
