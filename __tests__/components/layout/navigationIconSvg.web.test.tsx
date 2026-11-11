import fs from 'fs'
import path from 'path'

// #3234: иконки дока и шапки рисуются на каждой странице. На web они собираются
// из DOM-примитивов `navigationIconSvg.web.tsx`, чтобы react-native-svg не
// попадал в общий чанк первого экрана.
const root = path.join(__dirname, '..', '..', '..')

it('keeps navigation icons off react-native-svg; geometry imports the platform primitives', () => {
  for (const file of ['components/layout/NavigationIcon.tsx', 'components/layout/BelarusOutlineIcon.tsx']) {
    const source = fs.readFileSync(path.join(root, file), 'utf8')
    expect(source).not.toMatch(/from ['"]react-native-svg['"]/)
    expect(source).toMatch(/from ['"]\.\/navigationIconSvg['"]/)
  }
  const web = fs.readFileSync(path.join(root, 'components/layout/navigationIconSvg.web.tsx'), 'utf8')
  expect(web).not.toMatch(/from ['"]react-native-svg['"]/)
})

describe('web navigation icon markup', () => {
  let renderToStaticMarkup: typeof import('react-dom/server').renderToStaticMarkup
  let createElement: typeof import('react').createElement
  let NavigationIcon: typeof import('@/components/layout/NavigationIcon').default

  beforeAll(() => {
    jest.resetModules()
    jest.doMock('react-native', () => jest.requireActual('react-native-web'))
    jest.doMock('./../../../components/layout/navigationIconSvg', () =>
      jest.requireActual('./../../../components/layout/navigationIconSvg.web'))
    ;({ createElement } = require('react'))
    ;({ renderToStaticMarkup } = require('react-dom/server.node'))
    NavigationIcon = require('@/components/layout/NavigationIcon').default
  })

  it.each(['quest-route', 'route-walk', 'map-fold', 'dice', 'bike', 'belarus-outline'] as const)(
    'renders %s as a hidden, non-focusable inline <svg>',
    (name) => {
      const host = document.createElement('div')
      host.innerHTML = renderToStaticMarkup(createElement(NavigationIcon, { name, color: '#123456', size: 22 }))
      const svg = host.querySelector('svg')
      expect(svg).not.toBeNull()
      expect(svg!.getAttribute('width')).toBe('22')
      expect(svg!.getAttribute('viewBox')).toBe('0 0 24 24')
      expect(svg!.getAttribute('aria-hidden')).toBe('true')
      expect(svg!.getAttribute('focusable')).toBe('false')
      expect(svg!.querySelector('path, circle, rect')).not.toBeNull()
      expect(host.innerHTML).toContain('#123456')
    },
  )
})
