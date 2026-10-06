import type React from 'react'

/**
 * #2215: перелив `ShimmerOverlay` на web — настоящий серверный рендер
 * react-native-web (как у статического экспорта), а не проп в
 * react-test-renderer: инлайн `animationKeyframes` проходил снимок пропов и
 * при этом не доходил до CSS.
 */
let createElement: typeof import('react').createElement
let renderToStaticMarkup: typeof import('react-dom/server').renderToStaticMarkup
let StyleSheet: { getSheet: () => { textContent: string } }
let ShimmerOverlay: React.ComponentType<any>

beforeAll(() => {
  jest.resetModules()
  jest.doMock('react-native', () => jest.requireActual('react-native-web'))
  ;({ createElement } = require('react'))
  ;({ renderToStaticMarkup } = require('react-dom/server.node'))
  ;({ StyleSheet } = require('react-native'))
  ShimmerOverlay = require('@/components/ui/ShimmerOverlay').default
})

const declarationsOf = (node: Element): string => {
  const sheet = StyleSheet.getSheet().textContent
  return Array.from(node.classList)
    .map((name) => sheet.match(new RegExp(`\\.${name}\\{([^}]*)\\}`))?.[1] ?? '')
    .join('')
}

describe('ShimmerOverlay: перелив в серверной разметке (#2215)', () => {
  it('анимация — классом из таблицы стилей, без мёртвого animation-keyframes', () => {
    const host = document.createElement('div')
    host.innerHTML = renderToStaticMarkup(createElement(ShimmerOverlay, { testID: 'shimmer' }))
    expect(host.innerHTML).not.toContain('animation-keyframes')

    const sweep = host.querySelector('[data-testid="shimmer"] > div > div')
    expect(sweep).not.toBeNull()
    const declarations = declarationsOf(sweep!)
    const name = declarations.match(/animation-name:([^;]+)/)?.[1]
    expect(name).toBeTruthy()
    expect(declarations).toContain('animation-duration:1.8s')
    expect(declarations).toContain('animation-iteration-count:infinite')
    expect(declarations).toContain('background-image:linear-gradient(')

    // Кадры лежат в той же встроенной таблице — работают до гидратации.
    const sheet = StyleSheet.getSheet().textContent
    const keyframes = sheet.match(new RegExp(`@keyframes ${name!.trim()}\\{[^@]*`))?.[0] ?? ''
    expect(keyframes).toContain('translateX(-100%)')
    expect(keyframes).toContain('translateX(100%)')
  })
})
