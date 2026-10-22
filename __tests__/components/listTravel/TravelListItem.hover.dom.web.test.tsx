import fs from 'fs'
import path from 'path'
import type React from 'react'
import type { Root } from 'react-dom/client'
import type { Travel } from '@/types/types'

let act: typeof import('react').act
let createElement: typeof import('react').createElement
let createRoot: typeof import('react-dom/client').createRoot
let TravelListItem: React.ComponentType<any>
let TravelModerationFeedback: React.ComponentType<any>
let hoverTransform: string

beforeAll(() => {
  jest.resetModules()
  jest.doMock('react-native', () => jest.requireActual('react-native-web'))
  jest.doMock('@expo/vector-icons/Feather', () => ({ __esModule: true, default: () => null }))
  jest.doMock('expo-router', () => ({ router: { push: jest.fn() }, usePathname: () => '/metravel' }))
  jest.doMock('@/components/ui/UnifiedTravelCard', () => {
    const ReactActual = require('react')
    return {
      __esModule: true,
      default: ({ testID, contentSlot }: { testID: string; contentSlot: React.ReactNode }) =>
        ReactActual.createElement('div', { 'data-testid': testID }, contentSlot),
    }
  })
  jest.doMock('@/components/travel/FavoriteButton', () => {
    const ReactActual = require('react')
    return { __esModule: true, default: () => ReactActual.createElement('button', { 'data-testid': 'favorite-action' }, 'Favorite') }
  })
  jest.doMock('@/components/travel/TravelStatusButton', () => ({ __esModule: true, default: () => null }))
  jest.doMock('@/components/safety/ContentSafetyActions', () => ({ __esModule: true, default: () => null }))
  jest.doMock('@/hooks/useHiddenContent', () => ({ useHiddenContent: () => ({ hidden: false, unhide: jest.fn() }) }))
  ;({ act, createElement } = require('react'))
  ;({ createRoot } = require('react-dom/client'))
  ;({ CARD_HOVER_LIFT_TRANSFORM: hoverTransform } = require('@/components/ui/unifiedTravelCardTokens'))
  TravelListItem = require('@/components/listTravel/TravelListItem').default
  TravelModerationFeedback = require('@/components/travel/TravelModerationFeedback').default
})

const travel = {
  id: 42, slug: 'hover-regression', name: 'Author trip', userIds: '7', countryName: '',
  publication_status: 'draft', moderation_decision: 'rejected',
  moderation_decision_reason: 'Please correct the route description.',
} as Travel

describe('TravelListItem DOM hover boundary with a portal', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(async () => {
    await act(async () => root.unmount())
    container.remove()
  })

  const renderItem = async (props: Record<string, unknown> = {}) => {
    await act(async () => root.render(createElement(TravelListItem, {
      travel, currentUserId: '7', isMobile: false,
      renderAuthorFeedback: (onCorrect: () => void) => createElement(TravelModerationFeedback, { travel, onCorrect, list: true }),
      ...props,
    })))
  }

  const node = (selector: string): HTMLElement => {
    const found = document.body.querySelector<HTMLElement>(selector)
    expect(found).not.toBeNull()
    return found!
  }

  const mouse = async (target: Element, type: 'mouseover' | 'mouseout' | 'click', relatedTarget: Element | null = null) => {
    await act(async () => {
      target.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, relatedTarget }))
    })
  }

  it('does not retain a lifted transform when its own portal closes under the pointer', async () => {
    await renderItem()
    const anchor = node('[data-testid="travel-card-link"]')
    const wrapper = anchor.parentElement!
    const opener = node('[data-testid="moderation-reason-expand"]')
    const idleTransform = window.getComputedStyle(wrapper).transform

    await mouse(opener, 'mouseover')
    await mouse(opener, 'click')
    const panel = node('[data-testid="bottom-sheet-panel"]')
    expect(wrapper.contains(panel)).toBe(false)

    // React's common fiber ancestor is still the card, although the portal is
    // outside its DOM. Closing the portal removes the node before its mouseout.
    await mouse(opener, 'mouseout', panel)
    await mouse(panel, 'mouseover', opener)
    const modalAnimation = panel.closest('[aria-modal="true"]')!.parentElement!.parentElement!
    const close = panel.querySelector<HTMLElement>('[role="button"]')!
    await mouse(close, 'click')
    await act(async () => {
      modalAnimation.dispatchEvent(new Event('animationend', { bubbles: true }))
    })
    expect(document.body.querySelector('[data-testid="bottom-sheet-panel"]')).toBeNull()
    await mouse(document.body, 'mouseover')

    // No artificial card enter→leave here: that would conceal the old stale state.
    expect(window.getComputedStyle(wrapper).transform).toBe(idleTransform)
  })

  it('keeps the anchor, hoisted action and feedback in one CSS hover boundary', async () => {
    await renderItem()
    const wrapper = node('[data-travel-card-hover="true"]')
    expect(wrapper.contains(node('[data-testid="travel-card-link"]'))).toBe(true)
    expect(wrapper.contains(node('[data-testid="favorite-action"]'))).toBe(true)
    expect(wrapper.contains(node('[data-testid="travel-moderation-feedback"]'))).toBe(true)
    expect(node('[data-testid="travel-card-link"]').contains(node('[data-testid="favorite-action"]'))).toBe(false)
    expect(wrapper.style.getPropertyValue('--travel-card-hover-transform')).toBe(hoverTransform)
  })

  it.each([{ isMobile: true }, { selectable: true }])('does not mark non-desktop wrapper hover (%j)', async (props) => {
    await renderItem(props)
    expect(container.querySelector('[data-travel-card-hover]')).toBeNull()
  })

  it('exports a reachable mouse-only hover rule that uses the shared card transform', async () => {
    await renderItem()
    const style = document.createElement('style')
    style.textContent = fs.readFileSync(path.join(process.cwd(), 'app/global.css'), 'utf8')
    document.head.appendChild(style)
    try {
      const matches: { rule: CSSStyleRule; media: string | null }[] = []
      const walk = (rules: CSSRuleList, media: string | null) => {
        for (const rule of Array.from(rules)) {
          if ('selectorText' in rule && (rule as CSSStyleRule).selectorText.includes('[data-travel-card-hover')) {
            matches.push({ rule: rule as CSSStyleRule, media })
          } else if ('cssRules' in rule && 'media' in rule) {
            walk((rule as CSSMediaRule).cssRules, (rule as CSSMediaRule).media.mediaText)
          }
        }
      }
      walk((style.sheet as CSSStyleSheet).cssRules, null)
      expect(matches).toHaveLength(1)
      const { rule, media } = matches[0]
      expect(media).toContain('(hover: hover)')
      expect(media).toContain('(pointer: fine)')
      expect(rule.selectorText).toBe('[data-travel-card-hover="true"]:hover')
      expect(rule.style.getPropertyValue('transform')).toBe('var(--travel-card-hover-transform)')
      // jsdom does not emulate browser hover/media/var resolution. Check the
      // exported rule against the actual DOM, not an RN style prop snapshot.
      expect(container.querySelectorAll(rule.selectorText.replace(':hover', ''))).toHaveLength(1)
    } finally {
      style.remove()
    }
  })
})
