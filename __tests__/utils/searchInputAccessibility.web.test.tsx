import type { Root } from 'react-dom/client'
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

let ReactActual: typeof import('react')
let createRoot: typeof import('react-dom/client').createRoot
let RN: typeof import('react-native')
let searchProps: typeof import('@/utils/webProps').searchInputAccessibilityProps
beforeAll(() => {
  jest.resetModules()
  jest.doMock('react-native', () => jest.requireActual('react-native-web'))
  ReactActual = require('react')
  ;({ createRoot } = require('react-dom/client'))
  RN = require('react-native')
  searchProps = require('@/utils/webProps').searchInputAccessibilityProps
})

it('produces one real RNW searchbox; the same input without semantics produces zero', async () => {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root: Root = createRoot(container)
  try {
    await ReactActual.act(async () => root.render(ReactActual.createElement(RN.TextInput, { accessibilityLabel: 'Search', returnKeyType: 'search' })))
    expect(container.querySelectorAll('[role="searchbox"]')).toHaveLength(0)
    await ReactActual.act(async () => root.render(ReactActual.createElement(RN.TextInput, { ...searchProps(), accessibilityLabel: 'Search', returnKeyType: 'search' })))
    expect(container.querySelectorAll('input[role="searchbox"]')).toHaveLength(1)
    expect(container.querySelector('input')?.getAttribute('aria-label')).toBe('Search')
  } finally {
    await ReactActual.act(async () => root.unmount())
    container.remove()
  }
})

it.each(['ios', 'android'] as const)('uses the native search accessibility role on %s', (os) => {
  const original = RN.Platform.OS
  Object.defineProperty(RN.Platform, 'OS', { configurable: true, value: os })
  try { expect(searchProps()).toEqual({ accessibilityRole: 'search' }) }
  finally { Object.defineProperty(RN.Platform, 'OS', { configurable: true, value: original }) }
})

it('keeps semantics on the search input family, including the map focusable alias', () => {
  const paths = ['components/trips/MyCreatedTripsList.tsx', 'components/mainPage/StickySearchBar.tsx', 'screens/tabs/QuestsContentPanel.tsx', 'components/subscriptions/SubscriptionsTabContent.tsx', 'components/messages/ThreadList.tsx', 'components/home/HomeHeroSearchBar.tsx', 'components/trips/PublicTripsCatalog.tsx', 'screens/tabs/PlacesScreen.tsx', 'components/MapPage/MapSearchInput.tsx', 'components/UserPoints/PointsListGrid.tsx', 'components/UserPoints/PointsListHeader.tsx']
  for (const file of paths) {
    const source = fs.readFileSync(path.join(process.cwd(), file), 'utf8')
    const inputs: Array<ts.JsxOpeningElement | ts.JsxSelfClosingElement> = []
    const visit = (node: ts.Node) => {
      if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && ['TextInput', 'FocusableInput'].includes(node.tagName.getText())) inputs.push(node)
      ts.forEachChild(node, visit)
    }
    visit(ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX))
    expect(inputs.length).toBeGreaterThan(0)
    for (const input of inputs) {
      const semantics = input.attributes.properties.some((prop) => ts.isJsxSpreadAttribute(prop) && ts.isCallExpression(prop.expression) && prop.expression.expression.getText() === 'searchInputAccessibilityProps')
      expect({ file, semantics }).toEqual({ file, semantics: true })
    }
  }
})
