/**
 * @jest-environment jsdom
 */
import React from 'react'
import { render } from '@testing-library/react-native'

import type { BreadcrumbModel } from '@/hooks/useBreadcrumbModel'

// The web module itself: the jest platform resolves the no-op `.native` twin.
const BreadcrumbsJsonLd = require('@/components/seo/BreadcrumbsJsonLd.tsx').default as React.ComponentType<{ model: BreadcrumbModel }>

jest.mock('expo-router', () => ({ usePathname: () => '/pl/quests/12/brest-fortress' }))
jest.mock('@/hooks/useBreadcrumbModel', () => ({ useBreadcrumbModel: () => null, default: () => null }))
const mockHeadRenders: unknown[] = []
jest.mock('expo-router/head', () => ({
  __esModule: true,
  default: ({ children }: { children: unknown }) => {
    mockHeadRenders.push(children)
    return null
  },
}))

const questModel: BreadcrumbModel = {
  items: [
    { label: 'Questy', path: '/quests' },
    { label: 'Rozkaz nr 1: trzy dni Twierdzy Brzeskiej', path: '/pl/quests/12/brest-fortress' },
  ],
  depth: 3,
  currentTitle: 'Rozkaz nr 1: trzy dni Twierdzy Brzeskiej',
  pageContextTitle: 'Questy',
  backToPath: '/quests',
  showBreadcrumbs: true,
}

// #2466: the quest detail graph owns the page's one BreadcrumbList; the header
// copy beside it made three lists on every translated detail.
describe('BreadcrumbsJsonLd ownership', () => {
  beforeEach(() => { mockHeadRenders.length = 0 })

  it('emits nothing when the screen owns the BreadcrumbList', () => {
    render(<BreadcrumbsJsonLd model={{ ...questModel, structuredDataOwnedByScreen: true }} />)
    expect(mockHeadRenders).toHaveLength(0)
  })

  it('still emits the header list for pages without a screen owner', () => {
    render(<BreadcrumbsJsonLd model={questModel} />)
    const script = mockHeadRenders.at(-1) as React.ReactElement<{ children: string }>
    expect(JSON.parse(script.props.children)['@type']).toBe('BreadcrumbList')
  })
})
